import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged, createUserWithEmailAndPassword,
} from 'firebase/auth';

const STORAGE_KEY = 'indimart_firebase_config';

export function getStoredFirebaseConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isFirebaseConfigured() {
  const cfg = getStoredFirebaseConfig();
  return !!(cfg?.apiKey && cfg?.projectId && cfg?.appId);
}

let _app = null;
let _db = null;

export function getFirebaseApp() {
  if (_app) return _app;
  const cfg = getStoredFirebaseConfig();
  if (!cfg?.apiKey) return null;
  if (getApps().length > 0) _app = getApps()[0];
  else _app = initializeApp(cfg);
  return _app;
}

export function getDb() {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}

export async function reinitFirebase(config) {
  if (_app) {
    try { await deleteApp(_app); } catch {}
    _app = null;
    _db = null;
  }
  saveFirebaseConfig(config);
  _app = initializeApp(config);
  _db = getFirestore(_app);
  // Enable offline persistence
  try {
    await enableIndexedDbPersistence(_db);
  } catch (err) {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('Firestore persistence:', err.code);
    }
  }
  return _db;
}

// Call once on app start if already configured
export function initFirebaseIfConfigured() {
  if (!isFirebaseConfigured()) return null;
  return getDb();
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

export async function signInWithEmail(email, password) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function createAccount(email, password) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOutUser() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await fbSignOut(auth);
}

export function onAuthStateChanged(callback) {
  const auth = getFirebaseAuth();
  if (!auth) { callback(null); return () => {}; }
  return fbOnAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  const auth = getFirebaseAuth();
  return auth?.currentUser || null;
}
