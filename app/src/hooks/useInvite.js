import { useState } from 'react';
import { useAuth } from '../store/useAuth';
import { useSpaces } from '../store/useSpaces';
import { canSendMail, sendInviteMail } from '../utils/inviteMail';

/**
 * Member invite flow shared by the TopBar and the dashboard header: open the InviteModal, record
 * the emails on the space, then send mail through the backend (or hand off to mailto:).
 */
export function useInvite() {
  const user = useAuth();
  const { activeSpace, addMembers } = useSpaces();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'info'|'ok'|'error', text }
  const showToast = (kind, text, ms = 3200) => {
    setToast({ kind, text });
    if (ms) setTimeout(() => setToast(null), ms);
  };

  const handleInvite = async (emails, link) => {
    if (!activeSpace) return;
    addMembers(activeSpace.id, emails);
    setInviteOpen(false);

    if (canSendMail()) {
      showToast('info', `Sending ${emails.length} invite${emails.length > 1 ? 's' : ''}…`, 0);
      try {
        const res = await sendInviteMail({ to: emails, space: activeSpace, inviter: user, link });
        showToast('ok', `Invite sent to ${res.sent} ${res.sent > 1 ? 'people' : 'person'}.`);
      } catch (err) {
        console.error('Invite mail failed:', err);
        showToast('error', `Could not send: ${err.message}`, 6000);
      }
      return;
    }

    // No mail endpoint configured: hand the invite to the user's mail client.
    const subject = encodeURIComponent(`You're invited to "${activeSpace?.name ?? 'a space'}" on Tixup`);
    const body = encodeURIComponent(
      `${user?.name ?? 'A teammate'} invited you to the Tixup space "${activeSpace?.name ?? ''}".\n\nOpen this link to join:\n${link}\n\n— Tixup`,
    );
    window.location.href = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;
  };

  return { user, activeSpace, inviteOpen, setInviteOpen, toast, handleInvite };
}
