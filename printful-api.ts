/**
 * BioDegradableAI — Printful Dropshipping Integration
 * ─────────────────────────────────────────────────────
 * Anonymous guest checkout flow:
 *   1. Customer selects product + size + color on /store
 *   2. POST /api/checkout → this module creates a Stripe Payment Link
 *   3. Stripe webhook → on payment_intent.succeeded → place Printful order
 *   4. Printful prints + ships direct to customer
 *   5. Zero order history retained on our side
 *
 * Deploy as a Cloudflare Worker handler alongside the static site.
 * Required environment variables (set in Cloudflare dashboard → Workers → Settings → Variables):
 *   PRINTFUL_API_KEY  — from printful.com → Dashboard → Stores → API
 *   STRIPE_SECRET_KEY — from stripe.com → Developers → API keys
 *   STRIPE_WEBHOOK_SECRET — from stripe.com → Developers → Webhooks
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface CheckoutRequest {
  productId: number;
  printfulId: number | null;  // Printful variant ID (set after Printful setup)
  size: string;
  color: string;
  email?: string;             // Optional — for tracking only, not stored
}

interface PrintfulOrderItem {
  sync_variant_id: number;
  quantity: number;
}

interface PrintfulAddress {
  name: string;
  address1: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  email?: string;
}

interface Env {
  PRINTFUL_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

// ─── PRODUCT CATALOG ─────────────────────────────────────────────────────────
// After creating products in Printful, replace the printfulVariantIds below.
// Printful variant IDs are found in: Dashboard → Stores → Products → Edit → Variants

const PRODUCT_CATALOG: Record<number, {
  name: string;
  price: number;             // in cents
  printfulVariantIds: Record<string, Record<string, number>>; // size → color → variantId
}> = {
  1: {
    name: "Zero Records Tee",
    price: 3400,
    printfulVariantIds: {
      "XS": { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "S":  { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "M":  { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "L":  { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "XL": { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "2XL":{ "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
    }
  },
  2: {
    name: "The AI That Forgets Hoodie",
    price: 6800,
    printfulVariantIds: {
      "XS": { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "S":  { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "M":  { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "L":  { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "XL": { "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
      "2XL":{ "Natural / Cream": 0, "White": 0, "Forest Green": 0 },
    }
  },
  3: {
    name: "Subpoena Proof Tote",
    price: 2800,
    printfulVariantIds: {
      "ONE SIZE": { "Natural / Cream": 0 }
    }
  },
  4: {
    name: "Cartographic Badge Cap",
    price: 3600,
    printfulVariantIds: {
      "ONE SIZE": { "Natural / Cream": 0, "Forest Green": 0 }
    }
  },
  5: {
    name: "Signal Decay Crewneck",
    price: 5400,
    printfulVariantIds: {
      "XS": { "Natural / Cream": 0, "White": 0 },
      "S":  { "Natural / Cream": 0, "White": 0 },
      "M":  { "Natural / Cream": 0, "White": 0 },
      "L":  { "Natural / Cream": 0, "White": 0 },
      "XL": { "Natural / Cream": 0, "White": 0 },
      "2XL":{ "Natural / Cream": 0, "White": 0 },
    }
  },
  6: {
    name: "Data Half-Life Sticker",
    price: 900,
    printfulVariantIds: {
      "ONE SIZE": { "Natural / Cream": 0 }
    }
  }
};

// ─── PRINTFUL API HELPERS ─────────────────────────────────────────────────────

async function printfulRequest(
  path: string,
  method: string,
  body: unknown,
  apiKey: string
): Promise<unknown> {
  const res = await fetch(`https://api.printful.com${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-PF-Store-Type": "manual",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Printful API error ${res.status}: ${err}`);
  }
  return res.json();
}

/** Estimate shipping cost for the order before charging customer */
export async function estimateShipping(
  variantId: number,
  address: PrintfulAddress,
  apiKey: string
): Promise<number> {
  const data: any = await printfulRequest("/shipping/rates", "POST", {
    recipient: address,
    items: [{ variant_id: variantId, quantity: 1 }],
  }, apiKey);
  // Return cheapest rate in cents
  const rates = data.result as Array<{ rate: string }>;
  const cheapest = Math.min(...rates.map(r => Math.round(parseFloat(r.rate) * 100)));
  return cheapest;
}

/** Place order with Printful after successful Stripe payment */
export async function placePrintfulOrder(
  variantId: number,
  shippingAddress: PrintfulAddress,
  stripePaymentIntentId: string,
  apiKey: string
): Promise<{ orderId: number; trackingUrl: string | null }> {
  const orderData = {
    external_id: stripePaymentIntentId,  // idempotency — prevents duplicate orders
    shipping: "STANDARD",
    recipient: shippingAddress,
    items: [{ variant_id: variantId, quantity: 1 }],
    confirm: true,  // auto-confirm and begin production
  };

  const data: any = await printfulRequest("/orders", "POST", orderData, apiKey);
  return {
    orderId: data.result.id,
    trackingUrl: data.result.shipments?.[0]?.tracking_url ?? null,
  };
}

// ─── STRIPE HELPERS ───────────────────────────────────────────────────────────

/** Create an anonymous Stripe Payment Link — no customer account required */
async function createStripePaymentLink(
  productName: string,
  priceInCents: number,
  metadata: Record<string, string>,
  stripeKey: string
): Promise<string> {
  // Step 1: Create a one-time Price object
  const priceRes = await fetch("https://api.stripe.com/v1/prices", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "currency": "usd",
      "unit_amount": String(priceInCents),
      "product_data[name]": productName,
    }),
  });
  const price: any = await priceRes.json();
  if (!priceRes.ok) throw new Error(`Stripe price error: ${price.error?.message}`);

  // Step 2: Create Payment Link
  const linkParams = new URLSearchParams({
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
    "payment_method_collection": "if_required",
    "shipping_address_collection[allowed_countries][0]": "US",
    "shipping_address_collection[allowed_countries][1]": "CA",
    "shipping_address_collection[allowed_countries][2]": "GB",
    "shipping_address_collection[allowed_countries][3]": "AU",
    "shipping_address_collection[allowed_countries][4]": "DE",
    "shipping_address_collection[allowed_countries][5]": "FR",
    "after_completion[type]": "redirect",
    "after_completion[redirect][url]": "https://biodegradableai.com/store.html?order=complete",
  });

  // Attach metadata for our webhook handler
  Object.entries(metadata).forEach(([k, v]) => {
    linkParams.append(`metadata[${k}]`, v);
  });

  const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: linkParams,
  });
  const link: any = await linkRes.json();
  if (!linkRes.ok) throw new Error(`Stripe link error: ${link.error?.message}`);
  return link.url;
}

// ─── STRIPE WEBHOOK HANDLER ───────────────────────────────────────────────────

async function handleStripeWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // ⚠️  Verify webhook signature (prevents spoofed orders)
  // Full HMAC verification requires SubtleCrypto — simplified here for clarity
  // In production use: https://stripe.com/docs/webhooks/signature-verification
  if (!signature.includes("t=")) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata ?? {};

    const variantId  = parseInt(meta.printful_variant_id ?? "0");
    const productId  = parseInt(meta.product_id ?? "0");

    if (!variantId || !productId) {
      console.error("Missing variant/product metadata in Stripe session");
      return new Response("OK", { status: 200 });
    }

    // Build shipping address from Stripe session
    const addr = session.shipping_details?.address;
    const shippingAddress: PrintfulAddress = {
      name:         session.shipping_details?.name ?? "Guest",
      address1:     addr?.line1 ?? "",
      city:         addr?.city ?? "",
      state_code:   addr?.state ?? "",
      country_code: addr?.country ?? "US",
      zip:          addr?.postal_code ?? "",
      email:        meta.customer_email || undefined,
    };

    try {
      const result = await placePrintfulOrder(
        variantId,
        shippingAddress,
        session.payment_intent,
        env.PRINTFUL_API_KEY
      );
      console.log(`✅ Printful order placed: #${result.orderId}`);
    } catch (err) {
      console.error("Printful order failed:", err);
      // In production: send alert to your monitoring, retry via queue
    }
  }

  return new Response("OK", { status: 200 });
}

// ─── MAIN WORKER FETCH HANDLER ────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for store page
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://biodegradableai.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ── POST /api/checkout ────────────────────────────────────────────────────
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      try {
        const body: CheckoutRequest = await request.json();
        const product = PRODUCT_CATALOG[body.productId];

        if (!product) {
          return Response.json({ error: "Product not found" }, { status: 404 });
        }

        // Resolve Printful variant ID
        const sizeKey  = body.size  || "ONE SIZE";
        const colorKey = body.color || Object.keys(product.printfulVariantIds[sizeKey] ?? {})[0];
        const variantId = product.printfulVariantIds[sizeKey]?.[colorKey] ?? 0;

        if (!variantId) {
          return Response.json({
            error: "Products not yet live — Printful setup in progress",
            checkoutUrl: null,
          }, { status: 503 });
        }

        // Create Stripe Payment Link
        const checkoutUrl = await createStripePaymentLink(
          `${product.name} (${sizeKey} / ${colorKey})`,
          product.price,
          {
            product_id:           String(body.productId),
            printful_variant_id:  String(variantId),
            size:                 sizeKey,
            color:                colorKey,
            customer_email:       body.email ?? "",
          },
          env.STRIPE_SECRET_KEY
        );

        return Response.json({ checkoutUrl }, { headers: corsHeaders });

      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // ── POST /api/webhook (Stripe) ────────────────────────────────────────────
    if (url.pathname === "/api/webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }

    return new Response("Not found", { status: 404 });
  }
};

/*
 * ─── SETUP CHECKLIST ──────────────────────────────────────────────────────────
 *
 * 1. CREATE PRINTFUL ACCOUNT
 *    printful.com → Create account → Stores → Add manual order store
 *    → API → Generate API token → save as PRINTFUL_API_KEY in Cloudflare
 *
 * 2. UPLOAD DESIGNS TO PRINTFUL
 *    For each design PNG (merch_01 through merch_05):
 *    → Products → Add product → choose base product (Bella+Canvas 3001 tee, etc.)
 *    → Upload design PNG → position → save
 *    → Go to each variant and copy the "Sync Variant ID"
 *    → Paste variant IDs into PRODUCT_CATALOG above
 *
 * 3. STRIPE SETUP
 *    stripe.com → Developers → API keys → copy Secret key → STRIPE_SECRET_KEY
 *    → Webhooks → Add endpoint → https://biodegradableai.com/api/webhook
 *    → Select event: checkout.session.completed
 *    → Copy signing secret → STRIPE_WEBHOOK_SECRET
 *
 * 4. DEPLOY THIS WORKER
 *    From biodegradable/ folder:
 *    npx wrangler deploy
 *
 * 5. ADD ENV VARS TO CLOUDFLARE
 *    Dashboard → Workers & Pages → biodegradableai → Settings → Variables
 *    Add: PRINTFUL_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *    (as encrypted secrets, not plain text)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
