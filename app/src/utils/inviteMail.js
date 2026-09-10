/**
 * Sends invitation emails through the mail endpoint (a Google Apps Script web app,
 * see app/mail/README.md). When no endpoint is configured the caller falls back to mailto:.
 */
import { INVITE_MAIL_ENDPOINT as ENDPOINT } from '../constants';

export const canSendMail = () => Boolean(ENDPOINT);

export async function sendInviteMail({ to, space, inviter, link }) {
  if (!ENDPOINT) throw new Error('Mail endpoint is not configured');
  // text/plain keeps this a "simple" request (no CORS preflight), which Apps Script requires.
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      to,
      space: { id: space.id, name: space.name },
      inviter: inviter ? { name: inviter.name, email: inviter.email } : null,
      link,
    }),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Mail endpoint returned ${res.status}`);
  return data; // { ok: true, sent: n }
}
