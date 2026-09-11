export const CELL_WIDTH = 48;
export const VIRTUAL_WIDTH = 35000;
export const CENTER_PX = 1000000;
export const INITIAL_PAN_OFFSET = CENTER_PX - VIRTUAL_WIDTH / 2;

export const BASE_EPOCH = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

// Tag presets for the list view "Tags" column (Figma Marker V2 colours in ListView.css).
export const TAGS = ['Design', 'IT', 'Dev', 'Marketing', 'Product', 'Consulting', 'HR'];

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

// Backend endpoint (Google Apps Script web app, see app/mail/README.md). It sends invitation
// mail and stores shared space data so invitees see the same Tix.
// Not a secret: it is public in the client bundle either way. Empty = local-only + mailto: fallback.
export const API_ENDPOINT =
  import.meta.env.VITE_API_ENDPOINT ||
  import.meta.env.VITE_INVITE_MAIL_ENDPOINT ||
  'https://script.google.com/macros/s/AKfycbymujAE3REANZnfk8RmlSF6cBp2eArl2py-W7mtc3Bv90fDzAmWVyzMz3wmKPo13Ogi/exec';
export const INVITE_MAIL_ENDPOINT = API_ENDPOINT;
