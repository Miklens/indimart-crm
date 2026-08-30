// ── Simple local auth helpers ─────────────────────────────────────────────────
const LS_USERS_KEY = 'indimart_local_users';
const LS_SESSION_KEY = 'indimart_local_session';

export function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS_KEY) || 'null') || null; } catch { return null; }
}

export function initDefaultUser() {
  const users = { admin: btoa('admin123') };
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
  return users;
}

export function localSignIn(username, password) {
  let users = getLocalUsers();
  if (!users) users = initDefaultUser();
  const stored = users[username.trim().toLowerCase()];
  if (!stored) return { ok: false, error: 'Username not found.' };
  if (stored !== btoa(password)) return { ok: false, error: 'Wrong password.' };
  const session = { username: username.trim().toLowerCase(), loginAt: Date.now() };
  localStorage.setItem(LS_SESSION_KEY, JSON.stringify(session));
  return { ok: true, user: session };
}

export function getLocalSession() {
  try { return JSON.parse(localStorage.getItem(LS_SESSION_KEY) || 'null'); } catch { return null; }
}

export function clearLocalSession() {
  localStorage.removeItem(LS_SESSION_KEY);
}

export function changeLocalPassword(username, oldPw, newPw) {
  const users = getLocalUsers() || initDefaultUser();
  if (users[username] !== btoa(oldPw)) return false;
  users[username] = btoa(newPw);
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
  return true;
}
