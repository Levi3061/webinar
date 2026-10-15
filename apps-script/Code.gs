/**
 * AI Ad Films & Cinematic Films Webinar — registration + payment backend
 * (Sarv Media × Jay Patel, Fri 23 Oct 2026, 8–10 PM IST)
 *
 * Lives in the Google Sheet's Apps Script editor (Extensions → Apps Script).
 * Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone.
 *
 * Secrets are NOT in this file. Set them in Project Settings → Script properties:
 *   RAZORPAY_KEY_ID      rzp_test_… (later rzp_live_…)
 *   RAZORPAY_KEY_SECRET  the matching Key Secret
 *   GROUP_LINK           https://chat.whatsapp.com/…
 *   WEBHOOK_TOKEN        any long random text; also goes in the Razorpay webhook URL
 *   BREVO_KEY, FROM_EMAIL   optional, only if Gmail's daily email limit runs out
 *
 * The landing page calls this web app twice per booking:
 *   {action:'order', name, email, phone, city, source} → creates a Razorpay order, saves a "created" row
 *   {action:'verify', order_id, payment_id, signature}  → checks the signature, marks the row "paid",
 *                                                          emails the group link, returns it to the page
 * Razorpay also calls it directly (webhook, event payment.captured) as a backup, so a booking
 * still gets saved and emailed if the buyer closes the browser right after paying.
 */

const SHEET_NAME = 'Registrations';
const AMOUNT_PAISE = 9900;                       // ₹99
const WEBINAR = 'AI Ad Films & Cinematic Films Webinar';
const WHEN_TEXT = 'शुक्रवार, 23 October 2026 · रात 8–10 बजे (IST) · Zoom पर live';
const CAL_DATES = '20261023T143000Z/20261023T163000Z';
const SUPPORT_WA = '+91 95587 73923';
const FROM_NAME = 'Jay Patel × Sarv Media';
const HEADERS = ['Time', 'Name', 'Email', 'Phone', 'City', 'Source', 'Order ID', 'Payment ID', 'Status', 'Paid at', 'Email', 'Notes'];
const COL = { name: 2, email: 3, phone: 4, order: 7, payment: 8, status: 9, paidAt: 10, emailed: 11, notes: 12 };

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return json_({ ok: true, service: 'webinar-registration' }); }

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  try {
    if (body.event) return json_(handleWebhook_(body, (e.parameter || {}).token));
    if (body.action === 'order') return json_(createOrder_(body));
    if (body.action === 'verify') return json_(verifyPayment_(body));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- 1. create order ---------- */
function createOrder_(p) {
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase();
  const phone = String(p.phone || '').replace(/\D/g, '').slice(-10), city = clean_(p.city, 60);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: 'invalid details' };
  }
  const order = razorpay_('post', '/orders', {
    amount: AMOUNT_PAISE, currency: 'INR', receipt: 'web23oct-' + Date.now(),
    notes: { webinar: 'Webinar 23 Oct', name: name, email: email, phone: phone, city: city }
  });
  withLock_(function () {
    sheet_().appendRow([new Date(), name, email, "'" + phone, city, clean_(p.source, 30), order.id, '', 'created', '', '', '']);
  });
  return {
    ok: true, key_id: prop_('RAZORPAY_KEY_ID'), order_id: order.id, amount: order.amount, currency: order.currency,
    name: name, email: email, phone: phone
  };
}

/* ---------- 2. verify after checkout ---------- */
function verifyPayment_(p) {
  const orderId = String(p.order_id || ''), paymentId = String(p.payment_id || ''), sig = String(p.signature || '');
  if (!orderId || !paymentId || !sig) return { ok: false, error: 'missing fields' };
  const expected = hmacHex_(orderId + '|' + paymentId, prop_('RAZORPAY_KEY_SECRET'));
  if (!safeEqual_(expected, sig)) return { ok: false, error: 'signature mismatch' };
  markPaid_(orderId, paymentId, 'checkout');
  return { ok: true, group_link: prop_('GROUP_LINK') };
}

/* ---------- 3. webhook backup ---------- */
// Apps Script can't read request headers, so the webhook URL carries ?token=WEBHOOK_TOKEN,
// and the payment is re-checked against Razorpay's API before anything is marked paid.
function handleWebhook_(body, token) {
  if (!token || !safeEqual_(token, prop_('WEBHOOK_TOKEN'))) return { ok: false, error: 'bad token' };
  if (body.event !== 'payment.captured' && body.event !== 'order.paid') return { ok: true, ignored: body.event };
  const ent = body.payload && body.payload.payment && body.payload.payment.entity;
  if (!ent || !ent.id) return { ok: false, error: 'no payment' };
  const pay = razorpay_('get', '/payments/' + encodeURIComponent(ent.id));
  if (pay.status !== 'captured' || pay.amount !== AMOUNT_PAISE || !pay.order_id) return { ok: true, ignored: 'not ours' };
  markPaid_(pay.order_id, pay.id, 'webhook', pay);
  return { ok: true };
}

/* ---------- shared ---------- */
function markPaid_(orderId, paymentId, via, pay) {
  let toEmail = null;
  withLock_(function () {
    const sh = sheet_();
    let row = findRow_(sh, orderId);
    if (!row) {   // order made outside the page flow, or the row was deleted: rebuild it from Razorpay
      const n = (pay && pay.notes) || {};
      sh.appendRow([new Date(), n.name || '', n.email || (pay && pay.email) || '', "'" + (n.phone || (pay && pay.contact) || ''),
        n.city || '', via, orderId, '', 'created', '', '', '']);
      row = sh.getLastRow();
    }
    if (sh.getRange(row, COL.status).getValue() !== 'paid') {
      sh.getRange(row, COL.payment).setValue(paymentId);
      sh.getRange(row, COL.status).setValue('paid');
      sh.getRange(row, COL.paidAt).setValue(new Date());
      sh.getRange(row, COL.notes).setValue('confirmed via ' + via);
    }
    if (!sh.getRange(row, COL.emailed).getValue()) {
      sh.getRange(row, COL.emailed).setValue('sending');
      toEmail = { row: row, name: sh.getRange(row, COL.name).getValue(), email: sh.getRange(row, COL.email).getValue() };
    }
  });
  if (toEmail && toEmail.email) {
    let status;
    try { sendConfirmation_(toEmail.name, toEmail.email); status = 'sent'; }
    catch (err) { status = 'failed: ' + err; }
    withLock_(function () { sheet_().getRange(toEmail.row, COL.emailed).setValue(status); });
  }
}

function sendConfirmation_(name, email) {
  const group = prop_('GROUP_LINK');
  const cal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(WEBINAR + ' (Sarv Media × Jay Patel)')
    + '&dates=' + CAL_DATES
    + '&details=' + encodeURIComponent('Zoom link WhatsApp group में 1 घंटा पहले आएगा: ' + group);
  const subject = 'Seat book हो गई ✓ शुक्रवार 23 Oct, रात 8 बजे';
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:520px">'
    + '<p>नमस्ते ' + esc_(name) + ',</p>'
    + '<p>आपकी seat book हो गई है — <b>' + WEBINAR + '</b><br>' + WHEN_TEXT + '</p>'
    + '<p><b>एक last step:</b> WhatsApp group join करो। Zoom link webinar से 1 घंटा पहले वहीं आएगा।</p>'
    + '<p><a href="' + group + '" style="display:inline-block;background:#25D366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">WhatsApp group join करो</a></p>'
    + '<p><a href="' + cal + '">Google Calendar में add करो</a></p>'
    + '<p>कोई सवाल? WhatsApp करो: ' + SUPPORT_WA + '</p>'
    + '<p>— Jay Patel × Sarv Media</p></div>';
  sendMail_(email, name, subject, html);
}

// Optional: Triggers → Add trigger → sendReminder → Time-driven → specific date 23 Oct 2026, 6–7 PM.
function sendReminder() {
  const group = prop_('GROUP_LINK');
  const rows = sheet_().getDataRange().getValues().slice(1);
  rows.forEach(function (r) {
    if (r[COL.status - 1] !== 'paid' || !r[COL.email - 1]) return;
    try {
      sendMail_(r[COL.email - 1], r[COL.name - 1], 'आज रात 8 बजे: ' + WEBINAR,
        '<p>आज रात 8 बजे Zoom पर मिलते हैं। Zoom link 7 बजे WhatsApp group में आएगा।</p>'
        + '<p><a href="' + group + '">Group अभी तक join नहीं किया? यहाँ tap करो</a></p>');
    } catch (err) { console.error('reminder failed for ' + r[COL.email - 1] + ': ' + err); }
  });
}

function sendMail_(to, name, subject, html) {
  if (MailApp.getRemainingDailyQuota() > 0) {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: FROM_NAME });
    return;
  }
  const key = prop_('BREVO_KEY'), from = prop_('FROM_EMAIL');
  if (!key || !from) throw new Error('daily email quota used up');
  const res = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'post', contentType: 'application/json', headers: { 'api-key': key }, muteHttpExceptions: true,
    payload: JSON.stringify({ sender: { name: FROM_NAME, email: from }, to: [{ email: to, name: String(name || '') }],
      subject: subject, htmlContent: html })
  });
  if (res.getResponseCode() >= 300) throw new Error('Brevo ' + res.getResponseCode());
}

function razorpay_(method, path, payload) {
  const auth = Utilities.base64Encode(prop_('RAZORPAY_KEY_ID') + ':' + prop_('RAZORPAY_KEY_SECRET'));
  const opts = { method: method, headers: { Authorization: 'Basic ' + auth }, muteHttpExceptions: true };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  const res = UrlFetchApp.fetch('https://api.razorpay.com/v1' + path, opts);
  const data = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() >= 300) throw new Error('Razorpay ' + res.getResponseCode() + ': ' + ((data.error && data.error.description) || ''));
  return data;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}
function findRow_(sh, orderId) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, COL.order, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === orderId) return i + 2;
  return 0;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { fn(); } finally { lock.releaseLock(); }
}
function hmacHex_(msg, secret) {
  return Utilities.computeHmacSha256Signature(msg, secret)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function clean_(s, max) { return String(s || '').replace(/[\r\n\t]+/g, ' ').trim().replace(/^[=+\-@]+/, '').slice(0, max); }
function esc_(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/** Run once from the editor after setting Script properties: checks keys and creates the sheet. */
function setupCheck() {
  ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'GROUP_LINK', 'WEBHOOK_TOKEN'].forEach(function (k) {
    if (!prop_(k)) throw new Error('Missing script property: ' + k);
  });
  sheet_();
  razorpay_('get', '/orders?count=1');
  console.log('All good. Mode: ' + (prop_('RAZORPAY_KEY_ID').indexOf('rzp_live_') === 0 ? 'LIVE' : 'TEST')
    + ' · emails left today: ' + MailApp.getRemainingDailyQuota());
}
