import { GOOGLE_CLIENT_ID } from '../constants';
import { userFromGoogleProfile } from '../store/useAuth';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gisPromise = null; reject(new Error('Google Identity Services failed to load')); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Opens the Google OAuth popup and resolves with a Tixup user object.
 * The current origin must be listed under "Authorized JavaScript origins"
 * for GOOGLE_CLIENT_ID in Google Cloud Console.
 */
export async function signInWithGoogle() {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Client ID is not configured');
  await loadGis();

  const tokenResponse = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (res) => (res.error ? reject(new Error(res.error)) : resolve(res)),
      error_callback: (err) => reject(new Error(err?.type || 'popup_failed')),
    });
    client.requestAccessToken();
  });

  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google profile');
  return userFromGoogleProfile(await res.json());
}
