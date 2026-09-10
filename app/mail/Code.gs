/**
 * Tixup invite mailer — Google Apps Script web app.
 * Deploy: Extensions → Apps Script → paste → Deploy → New deployment →
 *   type "Web app", Execute as "Me", Who has access "Anyone". Copy the /exec URL.
 * The Tixup app POSTs { to: [emails], space: {id,name}, inviter: {name,email}, link }.
 * Emails are sent from the Google account that deployed the script.
 */
var TEMPLATE_URL = 'https://bohemiansalt82.github.io/tixup/email/invite.html';
var MAX_RECIPIENTS = 10;      // per request
var RATE_LIMIT_PER_HOUR = 30; // per inviter email
var SENDER_NAME = 'Tixup';

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var to = (body.to || []).filter(isEmail).slice(0, MAX_RECIPIENTS);
    if (!to.length) return json_({ ok: false, error: 'No valid recipients' });
    if (!body.link || String(body.link).indexOf('https://') !== 0) return json_({ ok: false, error: 'Invalid link' });

    var inviterEmail = (body.inviter && body.inviter.email) || 'anonymous';
    if (!allowRate_(inviterEmail)) return json_({ ok: false, error: 'Too many invites, try again later' });

    var spaceName = (body.space && body.space.name) || 'a space';
    var html = renderTemplate_({
      SPACE_NAME: spaceName,
      INVITER_NAME: (body.inviter && body.inviter.name) || 'A teammate',
      INVITER_EMAIL: inviterEmail,
      INVITE_LINK: String(body.link),
      YEAR: String(new Date().getFullYear()),
    });
    var subject = 'You\'re invited to "' + spaceName + '" on Tixup';
    var text = ((body.inviter && body.inviter.name) || 'A teammate') + ' invited you to the Tixup space "' +
      spaceName + '".\n\nOpen this link to join:\n' + body.link + '\n\n— Tixup';

    to.forEach(function (addr) {
      MailApp.sendEmail({ to: addr, subject: subject, body: text, htmlBody: html, name: SENDER_NAME });
    });
    return json_({ ok: true, sent: to.length });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'tixup-invite-mailer' });
}

function renderTemplate_(vars) {
  var tpl = UrlFetchApp.fetch(TEMPLATE_URL, { muteHttpExceptions: true }).getContentText();
  tpl = tpl.replace(/<script[\s\S]*?<\/script>/gi, ''); // preview helper is browser-only
  return tpl.replace(/\{\{(\w+)\}\}/g, function (_, k) { return escapeHtml_(vars[k] || ''); });
}

function allowRate_(key) {
  var cache = CacheService.getScriptCache();
  var k = 'rl:' + key;
  var n = Number(cache.get(k) || 0);
  if (n >= RATE_LIMIT_PER_HOUR) return false;
  cache.put(k, String(n + 1), 3600);
  return true;
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
