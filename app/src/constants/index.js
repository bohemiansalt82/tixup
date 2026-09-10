export const CELL_WIDTH = 48;
export const VIRTUAL_WIDTH = 35000;
export const CENTER_PX = 1000000;
export const INITIAL_PAN_OFFSET = CENTER_PX - VIRTUAL_WIDTH / 2;

export const BASE_EPOCH = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

export const STATUS_LABELS = {
  pending: 'Pending',
  inprogress: 'In Progress',
  done: 'Done',
  overdue: 'Overdue',
  pause: 'Pause',
  drop: 'Drop',
};


// Google OAuth (Google Identity Services). Override with VITE_GOOGLE_CLIENT_ID in .env.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '881041308072-r7sgkntptqnpm78jdmnhlvhhp2vvo9d6.apps.googleusercontent.com';

// Invitation mail endpoint (Google Apps Script web app, see app/mail/README.md).
// Not a secret: it is public in the client bundle either way. Empty = fall back to mailto:.
export const INVITE_MAIL_ENDPOINT =
  import.meta.env.VITE_INVITE_MAIL_ENDPOINT ||
  '';
