# Webinar booking setup (for Jay)

About 30 minutes. Do it on a laptop, logged in to the Google account that should own the
registrations and send the confirmation emails.

## 1. Google Sheet + script

1. Create a new Google Sheet named **Webinar 23 Oct Registrations**.
2. **Extensions → Apps Script.** Delete everything in `Code.gs` and paste in the whole `Code.gs` from this folder. Save.
3. **Project Settings (gear icon) → Script properties → Add script property.** Add these four:

   | Property | Value |
   |---|---|
   | `RAZORPAY_KEY_ID` | Test Key ID from Razorpay, starts with `rzp_test_` |
   | `RAZORPAY_KEY_SECRET` | The matching Test Key Secret |
   | `GROUP_LINK` | `https://chat.whatsapp.com/K2YA2401azhCHw4I7Z42oa` |
   | `WEBHOOK_TOKEN` | Any long random text, e.g. 30 random letters and numbers. Keep it, it's used in step 3. |

   The Key Secret stays only here. Don't send it to anyone or paste it anywhere else.
4. Back in the editor, pick **setupCheck** in the function dropdown and press **Run**. Allow the permissions
   Google asks for (it's your own script). The log should say **All good. Mode: TEST**.
   A **Registrations** tab appears in the Sheet.

## 2. Publish it

1. **Deploy → New deployment → Select type: Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone**
2. Press **Deploy** and copy the **Web app URL** (ends in `/exec`). Send that URL to us; it goes into the landing page.
3. After any later change to the code: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.**
   Otherwise the old code keeps running. The URL stays the same.

## 3. Razorpay webhook (backup for people who close the page right after paying)

Razorpay Dashboard (Test Mode) → **Account & Settings → Webhooks → Add New Webhook**

- Webhook URL: the Web app URL + `?token=` + your WEBHOOK_TOKEN, e.g.
  `https://script.google.com/macros/s/AKfy…/exec?token=YOUR_WEBHOOK_TOKEN`
- Secret: anything (not used; the token in the URL does that job)
- Active events: tick **payment.captured**
- Save.

## 4. Test (test mode, no real money)

On a phone, open the landing page, fill the form and pay with Razorpay's test details
(test card `4111 1111 1111 1111`, any future expiry, any CVV; or test UPI `success@razorpay`).

Check:
- The thank-you page opens and WhatsApp opens the group after 3 seconds
- A row in the Sheet with Status **paid** and Email **sent**
- The confirmation email arrived (check Spam / Promotions)
- The Add to Calendar link shows Fri 23 Oct, 8 PM IST

## 5. Go live

1. Razorpay Live Mode → API Keys → **Generate Key** (only if no live key exists yet; if one exists and is used
   elsewhere, reuse it rather than regenerating, or the other integration stops working).
2. Replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Script properties with the live ones and run
   **setupCheck** again; it should say **Mode: LIVE**.
3. Add the same webhook in **Live Mode** too (webhooks are separate per mode).
4. Make sure **heyjay.sarvmedia.com** is listed as your website in Razorpay.
5. Make one real ₹99 payment, check everything as in step 4, then refund it from the dashboard.

## 6. On the day (optional)

- Reminder email: Apps Script → **Triggers (clock icon) → Add trigger** → function **sendReminder** →
  Time-driven → Specific date and time → 23 Oct 2026, 6 PM.
- Post the Zoom link in the group at 7 PM.
- Compare paid rows in the Sheet with the group member count; message anyone missing.

## Limits

- Normal Gmail sends 100 emails a day from a script (Google Workspace: 1,500). If more than that may book in a day,
  make a free Brevo account and add `BREVO_KEY` and `FROM_EMAIL` (a sender verified in Brevo) as script properties;
  the script switches over by itself.
- A WhatsApp group holds 1,024 people. At about 900, make a second group and change `GROUP_LINK`.
