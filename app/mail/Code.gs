/**
 * Tixup backend — Google Apps Script web app.
 * Deploy: Extensions → Apps Script → paste → Deploy → New deployment →
 *   type "Web app", Execute as "Me", Who has access "Anyone". Copy the /exec URL.
 *
 * Two jobs, one endpoint (text/plain POST, JSON body):
 *   1. Invite mail   { to: [emails], space: {id,name}, inviter: {name,email}, link }
 *   2. Space storage { action: 'load', space: '<id>', member?: {email} }
 *                    { action: 'save', space: {id,name,visibility}, tasks: [...], by?: {name,email} }
 * Space documents are JSON files in the "Tixup Data" folder of the deploying account's Drive,
 * so everyone who opens an invite link sees the same Tix. Last write wins.
 */
var TEMPLATE_URL = 'https://bohemiansalt82.github.io/tixup/email/invite.html';
var MAX_RECIPIENTS = 10;      // per request
var RATE_LIMIT_PER_HOUR = 30; // per inviter email
var SENDER_NAME = 'Tixup';
var DATA_FOLDER_NAME = 'Tixup Data';
var MAX_DOC_BYTES = 4 * 1024 * 1024;

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = body.action || 'invite';
    if (action === 'load') return json_(loadSpace_(body));
    if (action === 'save') return json_(saveSpace_(body));
    if (action !== 'invite') return json_({ ok: false, error: 'Unknown action' });
    return json_(sendInvites_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'load') return json_(loadSpace_({ space: p.space }));
  return json_({ ok: true, service: 'tixup-backend' });
}

// ---------------------------------------------------------------- invites

function sendInvites_(body) {
  var to = (body.to || []).filter(isEmail).slice(0, MAX_RECIPIENTS);
  if (!to.length) return { ok: false, error: 'No valid recipients' };
  if (!body.link || String(body.link).indexOf('https://') !== 0) return { ok: false, error: 'Invalid link' };

  var inviterEmail = (body.inviter && body.inviter.email) || 'anonymous';
  if (!allowRate_(inviterEmail)) return { ok: false, error: 'Too many invites, try again later' };

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
  return { ok: true, sent: to.length };
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

// ---------------------------------------------------------------- space storage

/** Returns the shared document for a space; records the caller as a member. */
function loadSpace_(body) {
  var id = cleanId_(body.space);
  if (!id) return { ok: false, error: 'Invalid space id' };
  var doc = readDoc_(id);
  if (!doc) return { ok: true, found: false };

  var email = body.member && body.member.email;
  if (isEmail(email) && email !== doc.space.owner && (doc.space.members || []).indexOf(email) === -1) {
    doc.space.members = (doc.space.members || []).concat([email]);
    writeDoc_(id, doc);
  }
  return { ok: true, found: true, space: doc.space, tasks: doc.tasks || [], rev: doc.rev, updatedAt: doc.updatedAt };
}

/** Replaces the task list of a space (last write wins) and bumps its revision. */
function saveSpace_(body) {
  var meta = body.space || {};
  var id = cleanId_(meta.id);
  if (!id) return { ok: false, error: 'Invalid space id' };
  if (!Array.isArray(body.tasks)) return { ok: false, error: 'tasks must be an array' };
  var by = body.by && body.by.email;
  if (!isEmail(by)) by = null;
  var byName = by && body.by.name ? String(body.by.name).slice(0, 100) : null;

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var prev = readDoc_(id);
    var doc = {
      space: {
        id: id,
        name: String(meta.name || (prev && prev.space.name) || 'Space').slice(0, 200),
        visibility: meta.visibility === 'public' ? 'public' : ((prev && prev.space.visibility) || 'private'),
        owner: (prev && prev.space.owner) || by,
        ownerName: (prev && prev.space.ownerName) || byName,
        members: (prev && prev.space.members) || [],
      },
      tasks: body.tasks,
      rev: ((prev && prev.rev) || 0) + 1,
      updatedAt: Date.now(),
      updatedBy: by,
    };
    var json = JSON.stringify(doc);
    if (json.length > MAX_DOC_BYTES) return { ok: false, error: 'Space is too large' };
    writeDoc_(id, doc, json);
    return { ok: true, rev: doc.rev, updatedAt: doc.updatedAt };
  } finally {
    lock.releaseLock();
  }
}

function dataFolder_() {
  var props = PropertiesService.getScriptProperties();
  var fid = props.getProperty('dataFolderId');
  if (fid) {
    try { return DriveApp.getFolderById(fid); } catch (e) { /* folder gone, recreate */ }
  }
  var it = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(DATA_FOLDER_NAME);
  props.setProperty('dataFolderId', folder.getId());
  return folder;
}

function docFile_(id) {
  var props = PropertiesService.getScriptProperties();
  var key = 'file:' + id;
  var fid = props.getProperty(key);
  if (fid) {
    try {
      var f = DriveApp.getFileById(fid);
      if (!f.isTrashed()) return f;
    } catch (e) { /* fall through to search */ }
  }
  var it = dataFolder_().getFilesByName(id + '.json');
  if (!it.hasNext()) return null;
  var file = it.next();
  props.setProperty(key, file.getId());
  return file;
}

function readDoc_(id) {
  var f = docFile_(id);
  if (!f) return null;
  try {
    var doc = JSON.parse(f.getBlob().getDataAsString());
    if (!doc || !doc.space) return null;
    return doc;
  } catch (e) {
    return null;
  }
}

function writeDoc_(id, doc, json) {
  var s = json || JSON.stringify(doc);
  var f = docFile_(id);
  if (f) {
    f.setContent(s);
  } else {
    var file = dataFolder_().createFile(id + '.json', s, 'application/json');
    PropertiesService.getScriptProperties().setProperty('file:' + id, file.getId());
  }
}

// ---------------------------------------------------------------- helpers

function cleanId_(s) {
  return (typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s)) ? s : null;
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
