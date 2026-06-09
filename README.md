# BioDegradableAI — Pre-Launch Site

## Cloudflare Pages Deployment

**Project:** biodegradableai  
**Status:** Pre-launch (pages.dev only, not connected to custom domain yet)  
**Stack:** Static HTML — no build step required

## Cloudflare Pages Setup

### Step 1 — Create the project (do this once)
1. Go to https://dash.cloudflare.com
2. Click **Workers & Pages** → **Create application** → **Pages** tab
3. Choose **"Upload assets"** (direct upload, no Git required)
4. Project name: `biodegradableai`
5. Upload the contents of the `/public` folder
6. Click **Deploy site**
7. Your site will be live at: `https://biodegradableai.pages.dev`

### Step 2 — Subsequent deploys (via Wrangler CLI)
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy public --project-name=biodegradableai
```

### Step 3 — When ready to go live with custom domain
1. In Cloudflare Pages → your project → **Custom domains**
2. Add `biodegradableai.com`
3. Cloudflare handles SSL automatically

## File Structure
```
public/
  index.html          ← main landing page (3 rotating panels)
  _headers            ← security + cache headers
  _redirects          ← SPA fallback
  assets/
    logo.png          ← original logo (white bg)
    favicon_32.png    ← browser tab icon
    favicon_64.png    ← browser tab icon HiRes
```

## Design System
- Colors: Forest green `#1B4332`, Amber `#C97D29`, Cream `#F8F6F0`
- Fonts: Poppins (display) + DM Mono (technical)
- Three rotating concepts: Subpoena Test, Assignment Desk, Last Private Thought
