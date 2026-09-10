import { useSyncExternalStore } from 'react';

// Same localStorage key as the vanilla app (dist/assets/js/tixup-auth.js)
const USER_KEY = 'tixup-user';
const listeners = new Set();

let cachedRaw = null;
let cachedUser = null;

export function getUser() {
  let raw = null;
  try { raw = localStorage.getItem(USER_KEY); } catch { raw = null; }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try { cachedUser = raw ? JSON.parse(raw) : null; } catch { cachedUser = null; }
  }
  return cachedUser;
}

function emit() {
  listeners.forEach((l) => l());
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emit();
}

export function logout() {
  localStorage.removeItem(USER_KEY);
  emit();
}

export function avatarFor(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=6C5CE7&color=fff&size=128`;
}

export function demoLogin(name, email) {
  const id = 'demo-' + btoa(unescape(encodeURIComponent(email))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  const user = { id, name, email, picture: avatarFor(name) };
  setUser(user);
  return user;
}

export function userFromGoogleProfile(profile) {
  const name = profile.name || profile.email.split('@')[0];
  return {
    id: 'google-' + profile.sub,
    name,
    email: profile.email,
    picture: profile.picture || avatarFor(name),
  };
}

function subscribe(callback) {
  listeners.add(callback);
  const onStorage = (e) => { if (e.key === USER_KEY || e.key === null) callback(); };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getUser);
}

/** Called after any successful login: store the user and clear #login / #signup so Dashboard shows. */
export function finishLogin(user) {
  setUser(user);
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
