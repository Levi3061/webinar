# Masterclass booking setup

Same flow as the webinar, but a **separate** Google Sheet + script, so nothing about the live webinar changes.
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
   | `WEBINAR_SHEET_ID` | **required**: the webinar Sheet's id (see [below](#webinar_sheet_id--required)) |
   | `CALL_SHEET_NOTE` | one or two lines on Call Sheet access for the confirmation email (see [below](#call_sheet_note--call-sheet-access-line-in-the-email)) |

3. Run **setupCheck** (first time: **Review permissions → Allow**, it needs to read your Sheets).
   It should print `All good. Mode: LIVE · webinar sheet: "…" linked, N paid webinar bookings`.
   It stops with an error if `WEBINAR_SHEET_ID` is missing or wrong, and warns if `CALL_SHEET_NOTE` is empty.

### `WEBINAR_SHEET_ID` — required
**Why it's needed:** the ₹399 attendee discount depends on it. On every booking the script looks in the webinar
Sheet's **Registrations** tab: if a row with Status **paid** has the same email or the same WhatsApp number,
the order is made at **₹2,599**, otherwise **₹2,999**. Without the id nobody gets the discount, and since almost
every buyer comes from the webinar, almost everyone would be overcharged.

**Where to get it:**
1. Open the webinar Google Sheet: the one the webinar Apps Script is attached to, with the **Registrations** tab
   (the one shared with Jay).
2. Look at the address bar: `https://docs.google.com/spreadsheets/d/`**`1AbCdEf…XyZ`**`/edit#gid=0`
3. Copy only the bold part, between `/d/` and `/edit`, and paste it as the value.

Things to keep in mind:
- Make the masterclass Sheet + script from the **same Google account** that owns the webinar Sheet (or one it is
  shared with). The script runs as you, so that account must be able to open the webinar Sheet.
- Don't rename the **Registrations** tab or move its columns (Email = C, Phone = D, Status = I).
- It is checked live on every booking, so webinar bookings made later still count.
- Someone who paid for the webinar with a different email *and* number won't match: the checkout tells them to
  retry with the details they used for the webinar.

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
Book with an email/number that **is** in the webinar Sheet (expect ₹2,599) and one that **isn't** (expect ₹2,999).
Check the Masterclass tab (Status **paid**, Email **sent**, Webinar attendee yes/no), the email, and the WhatsApp redirect.
