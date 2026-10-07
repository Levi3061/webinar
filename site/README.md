# AI Cinematic Films Webinar — landing page

Static site, no build step. Upload the whole `site/` folder to your host.

- `index.html` — landing page (Razorpay payment button `pl_TkGpobePwrFp00` appears twice: price card + final section)
- `thanks.html` — post-payment page (set it as the redirect URL in the Razorpay payment button settings)
- `assets/` — logo, host photo, AI film clips (web-compressed, muted) and their poster frames

Webinar time is set in the script at the bottom of `index.html` (`START` / `END`, in UTC).
The price-hold timer length is `HOLD_MIN` (10 minutes, remembered per browser).
