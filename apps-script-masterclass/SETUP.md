# Masterclass booking setup

Same flow as the webinar, but a **separate** Google Sheet + script, so nothing about the live webinar changes.
Pages: `site/masterclass/` → https://heyjay.sarvmedia.com/masterclass/ (deployed with the rest of `site/`).

## 1. WhatsApp group
Create the masterclass group (admins-only messages), copy its invite link.

## 2. Google Sheet + script
1. New Google Sheet: **Masterclass Registrations** → **Extensions → Apps Script** → paste `Code.gs` from this folder → Save.
2. **Project Settings → Script properties**:

   | Property | Value |
   |---|---|
   | `RAZORPAY_KEY_ID` | your live Key ID (`rzp_live_…`), same Razorpay account as the webinar is fine |
   | `RAZORPAY_KEY_SECRET` | its Key Secret |
   | `GROUP_LINK` | the **masterclass** WhatsApp group link |
   | `WEBHOOK_TOKEN` | new random text (not the webinar one) |
   | `WEBINAR_SHEET_ID` | the webinar Sheet's id — the long part of its URL between `/d/` and `/edit` |
   | `CALL_SHEET_NOTE` | optional — one line about Call Sheet access for the confirmation email |

3. Run **setupCheck** → should say `All good. Mode: LIVE · webinar sheet: linked, N rows`.

## 3. Publish
**Deploy → New deployment → Web app** · Execute as **Me** · Access **Anyone** → copy the `/exec` URL.
Put it in `site/masterclass/checkout.html`: `var SCRIPT_URL = '…';` (or send it to us).
After any later code change: **Manage deployments → Edit → New version**.

## 4. Razorpay webhook (Live Mode)
Add a **second** webhook: `<masterclass /exec URL>?token=<masterclass WEBHOOK_TOKEN>`, event **payment.captured**.
Each script ignores the other's payments (the webinar one only accepts ₹99; this one only orders tagged `masterclass`).

## 5. Dates (before going live)
The dates appear as text on the three pages and in `WHEN_TEXT` in `Code.gs`. When final, also set:
- `START` in `site/masterclass/index.html` and `checkout.html` (Day 1, 8 PM IST in UTC, e.g. `Date.UTC(2026, 10, 1, 14, 30)`)
- `BOOKINGS_CLOSE` in `Code.gs` (same moment, e.g. `new Date('2026-11-01T14:30:00Z')`)

## 6. Test
Book with an email/number that **is** in the webinar Sheet (expect ₹2,599) and one that **isn't** (expect ₹2,999).
Check the Masterclass tab (Status **paid**, Email **sent**, Webinar attendee yes/no), the email, and the WhatsApp redirect.
