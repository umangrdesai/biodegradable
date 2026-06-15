export default {
  async fetch(request, env) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BioDegradableAi — Coming Soon</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --green: #1B4332;
      --green2: #2D6A4F;
      --cream: #F8F6F0;
      --mn: 'Courier New', monospace;
    }
    body {
      background: var(--green);
      color: var(--cream);
      font-family: var(--mn);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      padding: 2rem;
    }
    .label {
      font-size: .7rem;
      letter-spacing: .2em;
      opacity: .5;
      text-transform: uppercase;
    }
    h1 {
      font-family: 'Georgia', serif;
      font-size: clamp(2.5rem, 8vw, 6rem);
      font-weight: 400;
      letter-spacing: -.02em;
      line-height: 1;
      text-align: center;
    }
    .sub {
      font-size: .8rem;
      letter-spacing: .12em;
      opacity: .6;
      text-align: center;
    }
    .dot { display: inline-block; width: 6px; height: 6px; background: #52B788; border-radius: 50%; margin: 0 .5rem; vertical-align: middle; }
  </style>
</head>
<body>
  <p class="label">// system offline</p>
  <h1>BioDegradable<br>Ai</h1>
  <p class="sub">under construction <span class="dot"></span> back soon</p>
  <p class="label">ephemeral by design</p>
</body>
</html>`;

    return new Response(html, {
      status: 503,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Retry-After": "86400",
      },
    });
  }
};
