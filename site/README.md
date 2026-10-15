# AI Ad Films & Cinematic Films Webinar — landing page

Static site, no build step. Deploy the contents of this folder to **https://gujjuaiwithjp.com/webinar/**.

- `index.html` — landing page with Jay's intro video, ₹99 price card and booking form
- `thank-you.html` — shown after a confirmed payment; opens the WhatsApp group (the link comes from the
  backend, it is not in these files)
- `assets/` — logo, photos, intro video, AI film clips, bonus covers

## Before going live
1. Set up the Google Sheet backend: see `../apps-script/SETUP.md`.
2. Put its Web app URL in `index.html`: `var SCRIPT_URL = '';` near the top of the script at the bottom.
   While it is empty, the form shows "Booking जल्द शुरू होगी" instead of taking payments.

Webinar time is set in the same script (`START` / `END`, in UTC). The price-hold timer is `HOLD_MIN` (10 minutes,
remembered per browser). If the page goes at a different path than `/webinar/`, update the `canonical`, `og:url`
and `og:image` URLs at the top of `index.html`.
