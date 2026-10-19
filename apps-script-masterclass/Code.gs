/**
 * AI Realism Masterclass — registration + payment backend (Sarv Media × Jay Patel)
 *
 * A SEPARATE Apps Script project from the webinar one: make a new Google Sheet
 * ("Masterclass Registrations") → Extensions → Apps Script → paste this file.
 * Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone.
 *
 * Script properties (Project Settings → Script properties):
 *   RAZORPAY_KEY_ID      rzp_live_… (same Razorpay account as the webinar is fine)
 *   RAZORPAY_KEY_SECRET  the matching Key Secret
 *   GROUP_LINK           the MASTERCLASS WhatsApp group invite link
 *   WEBHOOK_TOKEN        any long random text (different from the webinar one); also in the webhook URL
 *   CALL_SHEET_NOTE      one or two lines on how buyers get Call Sheet access, added to the confirmation
 *                        email. Empty = the email only says access comes in the WhatsApp group.
 *   BREVO_KEY, FROM_EMAIL   optional, only if Gmail's daily email limit runs out
 *
 * The masterclass checkout page calls this web app twice per booking:
 *   {action:'order', name, email, phone, source} → creates a ₹2,599 Razorpay order, saves a "created" row
 *   {action:'verify', order_id, payment_id, signature} → checks the signature, marks the row "paid",
 *                                                  emails the group link, returns it to the page
 * Razorpay also calls it directly (webhook, payment.captured) as a backup. Every order carries
 * notes.product = 'masterclass', so webinar payments on the same Razorpay account are ignored here
 * (and the webinar script ignores these, since it only accepts ₹99).
 */

const SHEET_NAME = 'Masterclass';
const PRODUCT = 'masterclass';
const PRICE = 259900;               // ₹2,599 for everyone (the pages show it as the Diwali offer, ₹9,999 crossed out)
// Bookings close when Day 1 starts: Thu 29 Oct 2026, 8:00 PM IST
const BOOKINGS_CLOSE = new Date('2026-10-29T14:30:00Z');
const TITLE = 'AI Realism Masterclass';
const WHEN_TEXT = '4 live sessions · 29, 30, 31 Oct और 1 Nov 2026 · रात 8–11 बजे (IST) · Zoom पर, हिंदी में';
const SUPPORT_WA = '+91 95587 73923';
const FROM_NAME = 'Jay Patel × Sarv Media';
const HEADERS = ['Time', 'Name', 'Email', 'Phone', 'Source', 'Order ID', 'Payment ID', 'Status', 'Paid at', 'Email', 'Notes', 'Amount'];
const COL = { name: 2, email: 3, phone: 4, order: 6, payment: 7, status: 8, paidAt: 9, emailed: 10, notes: 11, amount: 12 };

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return json_({ ok: true, service: 'masterclass-registration' }); }

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

/* ---------- 1. create order (the price is set here, never by the page) ---------- */
function createOrder_(p) {
  if (BOOKINGS_CLOSE && new Date() >= BOOKINGS_CLOSE) return { ok: false, error: 'bookings closed' };
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase();
  const phone = String(p.phone || '').replace(/\D/g, '').slice(-10);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: 'invalid details' };
  }
  const order = razorpay_('post', '/orders', {
    amount: PRICE, currency: 'INR', receipt: 'mc-' + Date.now(),
    notes: { product: PRODUCT, name: name, email: email, phone: phone }
  });
  withLock_(function () {
    sheet_().appendRow([new Date(), name, email, "'" + phone, clean_(p.source, 30),
      order.id, '', 'created', '', '', '', PRICE / 100]);
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
function handleWebhook_(body, token) {
  if (!token || !safeEqual_(token, prop_('WEBHOOK_TOKEN'))) return { ok: false, error: 'bad token' };
  if (body.event !== 'payment.captured' && body.event !== 'order.paid') return { ok: true, ignored: body.event };
  const ent = body.payload && body.payload.payment && body.payload.payment.entity;
  if (!ent || !ent.id) return { ok: false, error: 'no payment' };
  const pay = razorpay_('get', '/payments/' + encodeURIComponent(ent.id));
  if (pay.status !== 'captured' || !pay.order_id) return { ok: true, ignored: 'not captured' };
  if (pay.amount !== PRICE) return { ok: true, ignored: 'not ours' };
  const order = razorpay_('get', '/orders/' + encodeURIComponent(pay.order_id));
  if (!order.notes || order.notes.product !== PRODUCT) return { ok: true, ignored: 'not ours' };
  markPaid_(pay.order_id, pay.id, 'webhook', order);
  return { ok: true };
}

/* ---------- shared ---------- */
function markPaid_(orderId, paymentId, via, order) {
  let toEmail = null;
  withLock_(function () {
    const sh = sheet_();
    let row = findRow_(sh, orderId);
    if (!row) {   // order made outside the page flow, or the row was deleted: rebuild it from Razorpay
      const n = (order && order.notes) || {};
      sh.appendRow([new Date(), n.name || '', n.email || '', "'" + (n.phone || ''), via, orderId, '', 'created', '', '', '',
        order && order.amount ? order.amount / 100 : '']);
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
  const callSheet = prop_('CALL_SHEET_NOTE');
  const subject = 'Masterclass seat confirm ✓ ' + TITLE;
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:540px">'
    + '<p>नमस्ते ' + esc_(name) + ',</p>'
    + '<p>आपकी seat confirm हो गई है — <b>' + TITLE + '</b><br>' + WHEN_TEXT + '</p>'
    + '<p><b>अभी करो:</b> Masterclass का WhatsApp group join करो। Zoom link, Day 1 prep और Call Sheet access वहीं मिलेंगे।</p>'
    + '<p><a href="' + group + '" style="display:inline-block;background:#25D366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">WhatsApp group join करो</a></p>'
    + '<p><b>Day 1 से पहले:</b> laptop + browser तैयार रखो। Higgsfield plan अभी मत ख़रीदना — Day 1 पर साथ में करेंगे।</p>'
    + (callSheet ? '<p>' + esc_(callSheet) + '</p>' : '')
    + '<p>कोई सवाल? WhatsApp करो: ' + SUPPORT_WA + '</p>'
    + '<p>— Jay Patel × Sarv Media</p></div>';
  sendMail_(email, name, subject, html);
}

// Optional: Triggers → Add trigger → sendReminder → Time-driven → before each session.
function sendReminder() {
  const group = prop_('GROUP_LINK');
  const rows = sheet_().getDataRange().getValues().slice(1);
  rows.forEach(function (r) {
    if (r[COL.status - 1] !== 'paid' || !r[COL.email - 1]) return;
    try {
      sendMail_(r[COL.email - 1], r[COL.name - 1], 'आज रात 8 बजे: ' + TITLE,
        '<p>आज रात 8 बजे Zoom पर मिलते हैं। Zoom link WhatsApp group में है।</p>'
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

/** Run once from the editor after setting Script properties: checks keys and creates the tab. */
function setupCheck() {
  ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'GROUP_LINK', 'WEBHOOK_TOKEN'].forEach(function (k) {
    if (!prop_(k)) throw new Error('Missing script property: ' + k);
  });
  sheet_();
  razorpay_('get', '/orders?count=1');
  if (!prop_('CALL_SHEET_NOTE')) console.warn('CALL_SHEET_NOTE is empty: confirmation emails will only say Call Sheet access comes in the WhatsApp group.');
  console.log('All good. Mode: ' + (prop_('RAZORPAY_KEY_ID').indexOf('rzp_live_') === 0 ? 'LIVE' : 'TEST')
    + ' · price: ₹' + PRICE / 100 + ' · emails left today: ' + MailApp.getRemainingDailyQuota());
}
