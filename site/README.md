# AI Ad Films & Cinematic Films Webinar — landing page

Static site served by a Cloudflare Worker at **https://heyjay.sarvmedia.com/** (config: `../wrangler.jsonc`).

- `index.html` — landing page: Jay's intro video, ₹99 price card, book buttons → checkout.html
- `checkout.html` — separate checkout page: order summary + booking form (Razorpay Checkout); the landing
  page's book buttons link here
- `thank-you.html` — shown after a verified payment; opens the WhatsApp group (the link comes from the
  Apps Script backend, it is not in these files)
- `404.html` — sends stray visitors back to the page
- `assets/` — logo, photos, intro video, AI film clips, bonus covers

Backend setup: `../apps-script/SETUP.md`. The booking form talks to the Apps Script web app set in
`var SCRIPT_URL` in the script at the bottom of `checkout.html`.

Webinar time is set in the same script (`START` / `END`, in UTC). The price-hold timer is `HOLD_MIN`
(10 minutes, remembered per browser). If the page moves to another address, update the `canonical`,
`og:url` and `og:image` URLs at the top of `index.html`.
