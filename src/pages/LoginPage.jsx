import { useState } from 'react';
import { Flame, Eye, EyeOff, LogIn, User, Lock, AlertCircle } from 'lucide-react';
import { signInWithEmail, isFirebaseConfigured, reinitFirebase } from '../firebase';

// ── Simple local auth helpers ─────────────────────────────────────────────────
const LS_USERS_KEY = 'indimart_local_users';
const LS_SESSION_KEY = 'indimart_local_session';

function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS_KEY) || 'null') || null; } catch { return null; }
}
function initDefaultUser() {
  const users = { admin: btoa('admin123') };
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
  return users;
}
function localSignIn(username, password) {
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
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fbAvailable = isFirebaseConfigured();
  const isEmail = username.includes('@');

  const friendlyFb = (code) => {
    const map = {
      'auth/invalid-credential': 'Wrong email or password.',
      'auth/user-not-found': 'No account with this email.',
      'auth/wrong-password': 'Wrong password.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/too-many-requests': 'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] || 'Sign in failed. Try again.';
  };

  const [fbConfigText, setFbConfigText] = useState('');
  const [showFbConfig, setShowFbConfig] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Enter your username or email.'); return; }
    if (!password) { setError('Enter your password.'); return; }

    // If input looks like an email — use Firebase auth
    if (isEmail) {
      // If Firebase not configured yet, need config first
      if (!fbAvailable && !fbConfigText.trim()) {
        setShowFbConfig(true);
        setError('Paste your Firebase config below to sign in with email.');
        return;
      }
      setLoading(true);
      try {
        // If config was pasted, init Firebase first
        if (!fbAvailable && fbConfigText.trim()) {
          const pairs = {};
          const re = /(\w+)\s*:\s*["']([^"']+)["']/g;
          let m;
          while ((m = re.exec(fbConfigText)) !== null) pairs[m[1]] = m[2];
          if (!pairs.apiKey || !pairs.projectId || !pairs.appId) {
            setError('Invalid Firebase config. Make sure apiKey, projectId and appId are present.');
            setLoading(false);
            return;
          }
          await reinitFirebase(pairs);
        }
        const user = await signInWithEmail(username.trim(), password);
        onLogin(user);
      } catch (err) {
        setError(friendlyFb(err.code));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Otherwise use local username/password
    const result = localSignIn(username, password);
    if (result.ok) { onLogin(result.user); }
    else { setError(result.error); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', padding: '2rem 2rem 1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 0 24px rgba(245,158,11,0.35)' }}>
            <Flame size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#f1f5f9' }}>Indimart CRM</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>Sign in to continue</p>
        </div>

        <div style={{ padding: '1.5rem 2rem 2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={12} />
                {isEmail ? 'Email' : 'Username or Email'}
                {isEmail && fbAvailable && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.68rem', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '1px 7px', borderRadius: 999, fontWeight: 600 }}>Firebase</span>
                )}
              </label>
              <input
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin  or  you@email.com"
                required autoFocus autoComplete="username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={12} /> Password</label>
              <div style={{ display: 'flex' }}>
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ flex: 1, borderRadius: '0.5rem 0 0 0.5rem', borderRight: 'none' }}
                />
                <button type="button" onClick={() => setShowPw(x => !x)}
                  style={{ padding: '0 0.75rem', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderLeft: 'none', borderRadius: '0 0.5rem 0.5rem 0', cursor: 'pointer', color: 'var(--text-dim)' }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', fontSize: '0.82rem', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {loading ? 'Signing in...' : <><LogIn size={16} /> Sign In</>}
            </button>

            {/* Firebase config paste — shown when email entered but no Firebase config in this browser */}
            {isEmail && !fbAvailable && showFbConfig && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.6rem', padding: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>
                  <AlertCircle size={13} /> Firebase config not found in this browser
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                  Paste your Firebase SDK config (Firebase Console → Project Settings):
                </p>
                <textarea
                  rows={5}
                  value={fbConfigText}
                  onChange={e => setFbConfigText(e.target.value)}
                  placeholder={"const firebaseConfig = {\n  apiKey: \"AIza...\",\n  projectId: \"...\",\n  appId: \"1:...\"\n};"}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.7rem', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '0.4rem', padding: '0.5rem', color: 'var(--text-main)', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                  Saved locally in your browser — you won't need to paste it again.
                </p>
              </div>
            )}

            {!isEmail && (
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Default: <strong style={{ color: 'var(--primary)' }}>admin</strong> / <strong style={{ color: 'var(--primary)' }}>admin123</strong>
                {fbAvailable && <><br />Or enter your <strong>Firebase email</strong> to sign in with Firebase.</>}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
