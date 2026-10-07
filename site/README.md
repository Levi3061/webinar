# AI Cinematic Films Webinar — landing page

Static site, no build step. Deploy the contents of this folder to **https://heyjay.ai/webinar/**
(so the page lives at `heyjay.ai/webinar/` and the thank-you page at `heyjay.ai/webinar/thanks.html`).

- `index.html` — landing page (Razorpay payment button `pl_TkGpobePwrFp00` appears twice: price card + final section)
- `thanks.html` — post-payment page
- `assets/` — logo, host photo, AI film clips (web-compressed, muted) and their poster frames

## After deploying
1. Razorpay → Payment Buttons → this button → set the redirect URL to `https://heyjay.ai/webinar/thanks.html`.
2. Make sure `heyjay.ai` is listed as a website on the Razorpay account that owns the button.
3. Open the page on a phone and make one test payment.

If the page goes at a different path than `/webinar/`, update the `canonical`, `og:url` and `og:image` URLs at the top of `index.html`.

Webinar time is set in the script at the bottom of `index.html` (`START` / `END`, in UTC).
The price-hold timer length is `HOLD_MIN` (10 minutes, remembered per browser).
