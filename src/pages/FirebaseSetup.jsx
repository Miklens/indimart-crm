import { useState } from 'react';
import { Flame, CheckCircle, XCircle, Loader, ChevronRight, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { reinitFirebase } from '../firebase';

const FIELD_META = [
  { key: 'apiKey',            label: 'API Key',             placeholder: 'AIzaSy...',                   secret: true  },
  { key: 'authDomain',        label: 'Auth Domain',         placeholder: 'your-project.firebaseapp.com', secret: false },
  { key: 'projectId',         label: 'Project ID',          placeholder: 'your-project-id',              secret: false },
  { key: 'storageBucket',     label: 'Storage Bucket',      placeholder: 'your-project.appspot.com',     secret: false },
  { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789',                    secret: false },
  { key: 'appId',             label: 'App ID',              placeholder: '1:123...:web:abc...',          secret: true  },
];

export default function FirebaseSetup({ onComplete, onSkip }) {
  const [cfg, setCfg] = useState({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' });
  const [showSecret, setShowSecret] = useState({});
  const [status, setStatus] = useState('idle'); // idle | testing | ok | error
  const [error, setError] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleChange = (key, val) => setCfg(prev => ({ ...prev, [key]: val.trim() }));

  // Auto-parse pasted Firebase config object
  const handlePaste = (text) => {
    setPasteText(text);
    try {
      // Match key: "value" pairs from Firebase SDK config snippet
      const pairs = {};
      const re = /(\w+)\s*:\s*["']([^"']+)["']/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (FIELD_META.find(f => f.key === m[1])) pairs[m[1]] = m[2];
      }
      if (Object.keys(pairs).length >= 3) {
        setCfg(prev => ({ ...prev, ...pairs }));
        setPasteMode(false);
        setPasteText('');
      }
    } catch (err) {
      console.warn('Auto-parse config failed', err);
    }
  };

  const isComplete = FIELD_META.filter(f => ['apiKey', 'projectId', 'appId'].includes(f.key)).every(f => cfg[f.key]);

  const handleSave = async () => {
    if (!isComplete) return;
    setStatus('testing');
    setError('');
    try {
      await reinitFirebase(cfg);
      setStatus('ok');
      setTimeout(() => onComplete(), 800);
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Firebase initialization failed. Check your config.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-main)', padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--bg-card)', border: '1px solid var(--glass-border-strong)',
        borderRadius: '1.25rem', overflow: 'hidden',
        boxShadow: 'var(--shadow-modal)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
          padding: '2rem 2rem 1.5rem', textAlign: 'center',
          borderBottom: '1px solid rgba(16,185,129,0.2)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 0 24px rgba(245,158,11,0.4)',
          }}>
            <Flame size={28} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9' }}>
            Connect Firebase
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Firebase will be your primary database with real-time sync.<br />
            Google Sheets will continue as an automatic backup.
          </p>
        </div>

        <div style={{ padding: '1.5rem 2rem 2rem' }}>

          {/* How to get config link */}
          <a
            href="https://console.firebase.google.com"
            target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
              marginBottom: '1.25rem', padding: '0.5rem 1rem',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '0.6rem', color: '#f59e0b', fontSize: '0.78rem',
              textDecoration: 'none', fontWeight: 600,
            }}
          >
            <ExternalLink size={13} />
            Open Firebase Console to get your config
            <ChevronRight size={12} />
          </a>

          {/* Paste mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setPasteMode(false)}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)',
                background: !pasteMode ? 'var(--primary)' : 'var(--bg-card2)',
                color: !pasteMode ? '#fff' : 'var(--text-dim)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              }}
            >
              Field by Field
            </button>
            <button
              onClick={() => setPasteMode(true)}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)',
                background: pasteMode ? 'var(--primary)' : 'var(--bg-card2)',
                color: pasteMode ? '#fff' : 'var(--text-dim)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              }}
            >
              Paste Config Object
            </button>
          </div>

          {pasteMode ? (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 6, display: 'block' }}>
                Paste your Firebase SDK config snippet below:
              </label>
              <textarea
                rows={8}
                value={pasteText}
                onChange={e => handlePaste(e.target.value)}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIza...",\n  authDomain: "...",\n  projectId: "...",\n  ...\n};`}
                style={{
                  width: '100%', fontFamily: 'monospace', fontSize: '0.75rem',
                  background: 'var(--bg-input)', border: '1px solid var(--glass-border)',
                  borderRadius: '0.5rem', padding: '0.75rem', color: 'var(--text-main)',
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Values will be auto-extracted. Switch to "Field by Field" to review.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {FIELD_META.map(({ key, label, placeholder, secret }) => {
                const shown = showSecret[key];
                const required = ['apiKey', 'projectId', 'appId'].includes(key);
                return (
                  <div key={key}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                      {label}
                      {required && <span style={{ color: '#ef4444', fontSize: '0.65rem' }}>*required</span>}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <input
                        type={secret && !shown ? 'password' : 'text'}
                        value={cfg[key]}
                        onChange={e => handleChange(key, e.target.value)}
                        placeholder={placeholder}
                        style={{
                          flex: 1, fontFamily: 'monospace', fontSize: '0.78rem',
                          borderRadius: secret ? '0.4rem 0 0 0.4rem' : '0.4rem',
                          borderRight: secret ? 'none' : undefined,
                        }}
                      />
                      {secret && (
                        <button
                          onClick={() => setShowSecret(s => ({ ...s, [key]: !s[key] }))}
                          style={{
                            padding: '0 0.6rem', height: 36, background: 'var(--bg-input)',
                            border: '1px solid var(--glass-border)', borderLeft: 'none',
                            borderRadius: '0 0.4rem 0.4rem 0', cursor: 'pointer', color: 'var(--text-dim)',
                          }}
                        >
                          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              padding: '0.75rem', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.6rem',
              color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem',
            }}>
              <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {status === 'ok' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem', background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.6rem',
              color: '#10b981', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem',
            }}>
              <CheckCircle size={16} />
              Firebase connected! Loading your data...
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!isComplete || status === 'testing' || status === 'ok'}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '0.65rem', border: 'none',
              background: isComplete ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'var(--bg-card2)',
              color: isComplete ? '#fff' : 'var(--text-muted)', cursor: isComplete ? 'pointer' : 'not-allowed',
              fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 0.2s', boxShadow: isComplete ? '0 4px 20px rgba(245,158,11,0.3)' : 'none',
            }}
          >
            {status === 'testing' ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
             : status === 'ok' ? <><CheckCircle size={16} /> Connected!</>
             : <><Flame size={16} /> Connect to Firebase</>}
          </button>

          <p style={{ margin: '1rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Your config is stored locally in your browser only.<br />
            You can change it anytime in <strong>Settings → Firebase</strong>.
          </p>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <button
              onClick={() => { localStorage.setItem('indimart_fb_setup_skipped', '1'); onSkip ? onSkip() : onComplete(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', fontSize: '0.8rem', textDecoration: 'underline',
                padding: '0.25rem 0.5rem',
              }}
            >
              Skip — Use app without Firebase (local storage only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
