# Masterclass booking setup

Same flow as the webinar, but a **separate** Google Sheet + script, so nothing about the live webinar changes.
Everyone pays **₹2,599** (the pages show it as the Diwali offer, ₹9,999 crossed out). There is no check against the webinar Sheet.
Pages: `site/masterclass/` → https://heyjay.sarvmedia.com/masterclass/ (deployed with the rest of `site/`).

## 1. WhatsApp group
Masterclass group invite link: `https://chat.whatsapp.com/HSCXV6o7dEJD18qopNxxk6` (set group messages to admins-only).
It goes only into the `GROUP_LINK` script property below — never on the pages.

## 2. Google Sheet + script
1. New Google Sheet: **Masterclass Registrations** → **Extensions → Apps Script** → paste `Code.gs` from this folder → Save.
2. **Project Settings → Script properties**:

   | Property | Value |
   |---|---|
   | `RAZORPAY_KEY_ID` | your live Key ID (`rzp_live_…`), same Razorpay account as the webinar is fine |
   | `RAZORPAY_KEY_SECRET` | its Key Secret |
   | `GROUP_LINK` | `https://chat.whatsapp.com/HSCXV6o7dEJD18qopNxxk6` (the **masterclass** group, not the webinar one) |
   | `WEBHOOK_TOKEN` | new random text (not the webinar one) |
   | `CALL_SHEET_NOTE` | one or two lines on Call Sheet access for the confirmation email (see [below](#call_sheet_note--call-sheet-access-line-in-the-email)) |

3. Run **setupCheck** (first time: **Review permissions → Allow**).
   It should print `All good. Mode: LIVE · price: ₹2599 · …`, and warns if `CALL_SHEET_NOTE` is empty.

### `CALL_SHEET_NOTE` — Call Sheet access line in the email
**Why it's needed:** the masterclass includes the AI Realism Call Sheet (tool.sarvmedia.com). This line tells
each buyer, in their confirmation email, how they get in. If it's empty, the email only says Call Sheet access
will come in the WhatsApp group.

**Where to get it:** nothing to copy, you write it. First confirm with whoever runs tool.sarvmedia.com how
buyers get access (an invite to their email, a sign-up link, a login sent before Day 1), then write it as
one or two plain-text sentences. Examples:
- `Call Sheet access: Day 1 से पहले tool.sarvmedia.com का invite इसी email पर आएगा।`
- `Call Sheet: tool.sarvmedia.com पर इसी email से sign up करो, Day 1 से पहले access on हो जाएगा।`

It's plain text (no formatting); most mail apps still make the link clickable. You can add or change it any time
in Script properties without redeploying. Emails sent after the change use the new text.

## 3. Publish
**Deploy → New deployment → Web app** · Execute as **Me** · Access **Anyone** → copy the `/exec` URL.
Put it in `site/masterclass/checkout.html`: `var SCRIPT_URL = '…';` (or send it to us).
After any later code change: **Manage deployments → Edit → New version**.

## 4. Razorpay webhook (Live Mode)
Add a **second** webhook: `<masterclass /exec URL>?token=<masterclass WEBHOOK_TOKEN>`, event **payment.captured**.
Each script ignores the other's payments (the webinar one only accepts ₹99; this one only orders tagged `masterclass`).

## 5. Dates
Thu 29 Oct → Sun 1 Nov 2026, 8–11 PM IST, in Hindi. Bookings close automatically when Day 1 starts (29 Oct, 8 PM IST):
- `START = Date.UTC(2026, 9, 29, 14, 30)` in `site/masterclass/index.html` and `checkout.html`
- `BOOKINGS_CLOSE = new Date('2026-10-29T14:30:00Z')` in `Code.gs`

If the dates change, update those three plus the date text on the pages and `WHEN_TEXT` in `Code.gs`.

## 6. Test
Book once (Razorpay should ask for ₹2,599). Check the Masterclass tab (Status **paid**, Email **sent**),
the confirmation email (with your Call Sheet line), and the WhatsApp redirect. Refund the test payment from Razorpay.
