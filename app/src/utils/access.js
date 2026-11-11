/**
 * Box permissions for invited members of a space.
 *
 * The space owner sets, per box, a default level for every invited member plus optional
 * per-member overrides:
 *   access = { [boxId]: { default: 'edit'|'view'|'hidden', members: { [email]: level } } }
 * Levels: 'edit' (see + change), 'view' (see only), 'hidden' (box and its Tix not shown).
 * Tix without a box, and boxes the owner never configured, are 'edit' — the behaviour before
 * permissions existed. The owner always has 'edit'.
 *
 * The same rules run in app/mail/Code.gs (`levelFor_`): the backend leaves hidden Tix out of a
 * member's `load` and ignores a member's changes to Tix they cannot edit. The client mirrors it so
 * the UI hides / locks the same things.
 */
export const LEVELS = ['edit', 'view', 'hidden'];
export const LEVEL_LABELS = { edit: '편집', view: '보기', hidden: '숨김' };
export const LEVEL_HINTS = {
  edit: 'Box와 Tix를 보고 수정할 수 있어요',
  view: 'Box와 Tix를 볼 수만 있어요',
  hidden: 'Box가 보이지 않아요',
};
export const DEFAULT_LEVEL = 'edit';

const norm = (email) => String(email || '').trim().toLowerCase();
const valid = (level) => (LEVELS.includes(level) ? level : null);

/** Level of `email` on `boxId` under `access` (owner handled by the caller). */
export function levelFor(access, boxId, email) {
  if (!boxId || !access) return DEFAULT_LEVEL;
  const rule = access[boxId];
  if (!rule) return DEFAULT_LEVEL;
  return valid(rule.members?.[norm(email)]) || valid(rule.default) || DEFAULT_LEVEL;
}

/** Drops unknown levels / empty rules and lower-cases member e-mails. */
export function cleanAccess(access) {
  const out = {};
  Object.entries(access || {}).forEach(([boxId, rule]) => {
    if (!rule) return;
    const members = {};
    Object.entries(rule.members || {}).forEach(([email, level]) => {
      if (valid(level) && norm(email)) members[norm(email)] = level;
    });
    const def = valid(rule.default) || DEFAULT_LEVEL;
    if (def === DEFAULT_LEVEL && !Object.keys(members).length) return;
    out[boxId] = { default: def, members };
  });
  return out;
}

export const sameEmail = (a, b) => !!a && !!b && norm(a) === norm(b);
