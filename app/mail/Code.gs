/**
 * Tixup backend — Google Apps Script web app.
 * Deploy: Extensions → Apps Script → paste → Deploy → New deployment →
 *   type "Web app", Execute as "Me", Who has access "Anyone". Copy the /exec URL.
 *
 * Three jobs, one endpoint (text/plain POST, JSON body):
 *   1. Invite mail   { to: [emails], space: {id,name}, inviter: {name,email}, link }
 *   2. Space storage { action: 'load', space: '<id>', member?: {email} }
 *      `load` also records the caller as present and returns `online`: e-mails seen in the
 *      last PRESENCE_TTL_S seconds (kept in CacheService, never written to Drive).
 *                    { action: 'save', space: {id,name,visibility}, tasks: [...], by?: {name,email} }
 *   3. User profile  { action: 'profile', user: {email} }
 *                    { action: 'saveProfile', user: {email,name}, spaces: [...], boxes: {spaceId: [...]}, active?: '<spaceId>' }
 *      The profile is the account's list of spaces (and their boxes), keyed by e-mail, so the same
 *      account sees the same spaces in every browser / device.
 *   Box permissions (v4): the owner's `save` may carry space.boxes [{id,name}] and space.access
 *      { boxId: { default: 'edit'|'view'|'hidden', members: { email: level } } }. Only the owner
 *      (the first saver) can change them. A member's `load` leaves out Tix in boxes hidden from
 *      them and lists only the boxes they can see (each with its `level`); a member's `save`
 *      keeps every Tix they cannot edit exactly as it was (see mergeMemberTasks_).
 * Documents are JSON files in the "Tixup Data" folder of the deploying account's Drive.
 * Last write wins.
 */
var TEMPLATE_URL = 'https://bohemiansalt82.github.io/tixup/email/invite.html';
var MAX_RECIPIENTS = 10;      // per request
var RATE_LIMIT_PER_HOUR = 30; // per inviter email
var SENDER_NAME = 'Tixup';
var DATA_FOLDER_NAME = 'Tixup Data';
var PRESENCE_TTL_S = 45;      // a member counts as online this long after their last load
var MAX_DOC_BYTES = 4 * 1024 * 1024;
var BACKEND_VERSION = 4;      // bump on every change; `?action=ping` / { action: 'ping' } report it

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = body.action || 'invite';
    if (action === 'ping') return json_({ ok: true, service: 'tixup-backend', version: BACKEND_VERSION });
    if (action === 'load') return json_(loadSpace_(body));
    if (action === 'save') return json_(saveSpace_(body));
    if (action === 'profile') return json_(loadProfile_(body));
    if (action === 'saveProfile') return json_(saveProfile_(body));
    if (action !== 'invite') return json_({ ok: false, error: 'Unknown action' });
    return json_(sendInvites_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'load') return json_(loadSpace_({ space: p.space }));
  return json_({ ok: true, service: 'tixup-backend', version: BACKEND_VERSION });
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
  var online = touchPresence_(id, isEmail(email) ? email : null);
  var base = { ok: true, found: true, online: online, rev: doc.rev, updatedAt: doc.updatedAt, version: BACKEND_VERSION };
  if (isOwner_(doc, email)) {
    base.space = doc.space;
    base.tasks = doc.tasks || [];
    return base;
  }
  // Member (or anonymous GET): only the boxes / Tix they may see, never the rule table itself.
  var access = doc.space.access || {};
  var space = {};
  Object.keys(doc.space).forEach(function (k) { if (k !== 'access' && k !== 'boxes') space[k] = doc.space[k]; });
  space.boxes = (doc.space.boxes || [])
    .map(function (b) { return { id: b.id, name: b.name, level: levelFor_(access, b.id, email) }; })
    .filter(function (b) { return b.level !== 'hidden'; });
  base.space = space;
  base.tasks = (doc.tasks || []).filter(function (t) { return levelFor_(access, t && t.boxId, email) !== 'hidden'; });
  return base;
}

// ---------------------------------------------------------------- box permissions

var LEVELS_ = ['edit', 'view', 'hidden'];

function isOwner_(doc, email) {
  var owner = doc && doc.space && doc.space.owner;
  return !owner || (isEmail(email) && String(owner).toLowerCase() === String(email).toLowerCase());
}

/** Same rule as app/src/utils/access.js levelFor(). */
function levelFor_(access, boxId, email) {
  if (!boxId || !access || !access[boxId]) return 'edit';
  var rule = access[boxId];
  var m = rule.members && email ? rule.members[String(email).toLowerCase()] : null;
  if (LEVELS_.indexOf(m) !== -1) return m;
  return LEVELS_.indexOf(rule.default) !== -1 ? rule.default : 'edit';
}

function cleanBoxes_(boxes) {
  if (!Array.isArray(boxes)) return null;
  return boxes.filter(function (b) { return b && cleanId_(b.id); }).slice(0, 500)
    .map(function (b) { return { id: b.id, name: String(b.name || 'Box').slice(0, 200) }; });
}

function cleanAccess_(access) {
  if (!access || typeof access !== 'object') return null;
  var out = {};
  Object.keys(access).forEach(function (boxId) {
    var rule = access[boxId];
    if (!cleanId_(boxId) || !rule) return;
    var members = {};
    Object.keys(rule.members || {}).forEach(function (e) {
      if (isEmail(e) && LEVELS_.indexOf(rule.members[e]) !== -1) members[String(e).toLowerCase()] = rule.members[e];
    });
    out[boxId] = { default: LEVELS_.indexOf(rule.default) !== -1 ? rule.default : 'edit', members: members };
  });
  return out;
}

/**
 * A member's save: their list wins for Tix they can edit (order included); every Tix they cannot
 * edit (hidden from them or view-only) stays exactly as before, slotted back after the Tix that
 * preceded it. A member can neither create a Tix in, nor move one into, a box they cannot edit.
 */
function mergeMemberTasks_(prev, mine, access, email) {
  var can = function (t) { return levelFor_(access, t && t.boxId, email) === 'edit'; };
  var prevById = {};
  prev.forEach(function (t) { if (t && t.id) prevById[t.id] = t; });
  var out = [];
  var seen = {};
  mine.forEach(function (t) {
    if (!t || !t.id || seen[t.id]) return;
    var p = prevById[t.id];
    if (p && !can(p)) return;           // protected: re-inserted below from prev
    if (!can(t)) { if (p) { out.push(p); seen[p.id] = true; } return; } // moved / created into a locked box
    out.push(t);
    seen[t.id] = true;
  });
  prev.forEach(function (p, i) {
    if (!p || !p.id || seen[p.id] || can(p)) return; // editable ones the member dropped were deleted
    var at = 0;
    for (var j = i - 1; j >= 0; j--) {
      var k = out.indexOf(prev[j]);
      if (k === -1) k = indexById_(out, prev[j] && prev[j].id);
      if (k !== -1) { at = k + 1; break; }
    }
    out.splice(at, 0, p);
    seen[p.id] = true;
  });
  return out;
}

function indexById_(list, id) {
  if (!id) return -1;
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return i;
  return -1;
}

/** Marks `email` as present in the space and returns everyone seen within PRESENCE_TTL_S. */
function touchPresence_(spaceId, email) {
  var cache = CacheService.getScriptCache();
  var key = 'presence:' + spaceId;
  var now = Date.now();
  var seen = {};
  try { seen = JSON.parse(cache.get(key) || '{}') || {}; } catch (e) { seen = {}; }
  if (email) seen[String(email).toLowerCase()] = now;
  var online = [];
  Object.keys(seen).forEach(function (k) {
    if (now - seen[k] <= PRESENCE_TTL_S * 1000) online.push(k); else delete seen[k];
  });
  cache.put(key, JSON.stringify(seen), PRESENCE_TTL_S * 2);
  return online;
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
    var owner = !prev || isOwner_(prev, by);
    var prevAccess = (prev && prev.space.access) || {};
    var space = {
      id: id,
      name: String((owner ? meta.name : null) || (prev && prev.space.name) || meta.name || 'Space').slice(0, 200),
      visibility: owner && meta.visibility === 'public' ? 'public' : ((prev && prev.space.visibility) || 'private'),
      owner: (prev && prev.space.owner) || by,
      ownerName: (prev && prev.space.ownerName) || byName,
      members: (prev && prev.space.members) || [],
    };
    var boxes = owner ? cleanBoxes_(meta.boxes) : null;
    var access = owner ? cleanAccess_(meta.access) : null;
    space.boxes = boxes || (prev && prev.space.boxes) || [];
    space.access = access || prevAccess;
    var doc = {
      space: space,
      tasks: owner || !prev ? body.tasks : mergeMemberTasks_(prev.tasks || [], body.tasks, prevAccess, by),
      rev: ((prev && prev.rev) || 0) + 1,
      updatedAt: Date.now(),
      updatedBy: by,
    };
    var json = JSON.stringify(doc);
    if (json.length > MAX_DOC_BYTES) return { ok: false, error: 'Space is too large' };
    writeDoc_(id, doc, json);
    return { ok: true, rev: doc.rev, updatedAt: doc.updatedAt, version: BACKEND_VERSION };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- user profiles

/** Document id for an account: e-mail is case-insensitive, hashed so it is a safe file name. */
function profileId_(email) {
  if (!isEmail(email)) return null;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(email).trim().toLowerCase(), Utilities.Charset.UTF_8);
  return 'user-' + digest.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

/** Returns the account's spaces / boxes. */
function loadProfile_(body) {
  var id = profileId_(body.user && body.user.email);
  if (!id) return { ok: false, error: 'Invalid user' };
  var doc = readJson_(id);
  if (!doc || !Array.isArray(doc.spaces)) return { ok: true, found: false };
  return { ok: true, found: true, spaces: doc.spaces, boxes: doc.boxes || {}, active: doc.active || null, rev: doc.rev, updatedAt: doc.updatedAt };
}

/** Replaces the account's spaces / boxes (last write wins) and bumps the revision. */
function saveProfile_(body) {
  var email = body.user && body.user.email;
  var id = profileId_(email);
  if (!id) return { ok: false, error: 'Invalid user' };
  if (!Array.isArray(body.spaces)) return { ok: false, error: 'spaces must be an array' };
  var spaces = body.spaces.filter(function (s) { return s && cleanId_(s.id); });
  var boxes = {};
  if (body.boxes && typeof body.boxes === 'object') {
    Object.keys(body.boxes).forEach(function (k) {
      if (cleanId_(k) && Array.isArray(body.boxes[k])) boxes[k] = body.boxes[k];
    });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var prev = readJson_(id);
    var doc = {
      email: String(email).trim().toLowerCase(),
      name: body.user.name ? String(body.user.name).slice(0, 100) : ((prev && prev.name) || null),
      spaces: spaces,
      boxes: boxes,
      active: cleanId_(body.active) || ((prev && prev.active) || null), // last space the user was looking at
      rev: ((prev && prev.rev) || 0) + 1,
      updatedAt: Date.now(),
    };
    var json = JSON.stringify(doc);
    if (json.length > MAX_DOC_BYTES) return { ok: false, error: 'Profile is too large' };
    writeDoc_(id, doc, json);
    return { ok: true, rev: doc.rev, updatedAt: doc.updatedAt };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Drive storage

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

function readJson_(id) {
  var f = docFile_(id);
  if (!f) return null;
  try {
    return JSON.parse(f.getBlob().getDataAsString());
  } catch (e) {
    return null;
  }
}

function readDoc_(id) {
  var doc = readJson_(id);
  return doc && doc.space ? doc : null;
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
