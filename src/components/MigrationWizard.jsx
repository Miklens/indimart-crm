import { useState } from 'react';
import { Database, ArrowRight, CheckCircle, XCircle, FileText, Users, Package, MessageSquare, Settings, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fsMigrateAll } from '../services/firestoreService';
import { gsPullAll } from '../services/gsBackupService';

const STEPS = {
  SELECT:    'select',
  PREVIEW:   'preview',
  MIGRATING: 'migrating',
  DONE:      'done',
  ERROR:     'error',
};

function CountBadge({ label, count, icon: Icon, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.65rem',
      padding: '0.7rem 1rem', background: 'var(--bg-card2)',
      borderRadius: '0.6rem', border: `1px solid ${color}33`,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: '0.4rem', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{count}</div>
      </div>
    </div>
  );
}

export default function MigrationWizard({ onClose }) {
  const { leads, invoiceHistory, products, messageTemplates, companySettings, gsUrl } = useApp();
  const [step, setStep] = useState(STEPS.SELECT);
  const [source, setSource] = useState('local'); // 'local' | 'sheets'
  const [migData, setMigData] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  const localData = {
    leads, invoices: invoiceHistory, products,
    templates: messageTemplates, settings: companySettings,
  };

  const handlePreview = async () => {
    if (source === 'local') {
      setMigData(localData);
      setStep(STEPS.PREVIEW);
    } else {
      if (!gsUrl) { setErrorMsg('No Google Sheets URL configured. Go to Settings → Google Sheets first.'); setStep(STEPS.ERROR); return; }
      setStep(STEPS.MIGRATING);
      setProgress({ done: 0, total: 1, label: 'Pulling data from Google Sheets...' });
      try {
        const res = await gsPullAll(gsUrl);
        const data = {
          leads: res.leads || [],
          invoices: (res.invoices || []).map(wrapInvoice),
          products: res.products || [],
          templates: res.templates || [],
          settings: res.settings || companySettings,
        };
        setMigData(data);
        setStep(STEPS.PREVIEW);
      } catch (e) {
        setErrorMsg('Failed to pull from Google Sheets: ' + e.message);
        setStep(STEPS.ERROR);
      }
    }
  };

  const handleMigrate = async () => {
    if (!migData) return;
    setStep(STEPS.MIGRATING);
    setProgress({ done: 0, total: 0, label: 'Starting migration...' });
    try {
      const res = await fsMigrateAll(
        migData,
        (done, total, label) => setProgress({ done, total, label })
      );
      setResult(res);
      setStep(STEPS.DONE);
    } catch (e) {
      setErrorMsg(e.message || 'Migration failed');
      setStep(STEPS.ERROR);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560, width: '95vw', padding: 0 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', borderRadius: '0.75rem 0.75rem 0 0', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9' }}>Migrate to Firebase</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>One-time migration — your data moves to Firestore</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* ── STEP: SELECT SOURCE ── */}
          {step === STEPS.SELECT && (
            <>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                Where should we pull the data to migrate?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { id: 'local', label: 'This Browser (localStorage)', sub: 'Use data already in this app — fastest option', icon: Database, color: '#3b82f6' },
                  { id: 'sheets', label: 'Google Sheets', sub: 'Pull latest data from your Google Sheets backend', icon: FileText, color: '#10b981' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setSource(opt.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.9rem 1rem', borderRadius: '0.7rem', cursor: 'pointer',
                      border: `2px solid ${source === opt.id ? opt.color : 'var(--glass-border)'}`,
                      background: source === opt.id ? `${opt.color}0d` : 'var(--bg-card2)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.4rem', background: `${opt.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <opt.icon size={16} style={{ color: opt.color }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{opt.sub}</div>
                    </div>
                    {source === opt.id && <CheckCircle size={16} style={{ color: opt.color, marginLeft: 'auto', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePreview}>
                  Preview Data <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === STEPS.PREVIEW && migData && (
            <>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                The following data will be written to Firebase Firestore:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <CountBadge label="Leads" count={migData.leads?.length || 0} icon={Users} color="#3b82f6" />
                <CountBadge label="Invoices" count={migData.invoices?.length || 0} icon={FileText} color="#8b5cf6" />
                <CountBadge label="Products" count={migData.products?.length || 0} icon={Package} color="#10b981" />
                <CountBadge label="Templates" count={migData.templates?.length || 0} icon={MessageSquare} color="#f59e0b" />
                <CountBadge label="Settings" count={migData.settings ? 1 : 0} icon={Settings} color="#94a3b8" />
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.6rem', fontSize: '0.78rem', color: '#f59e0b', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                ⚠️ This will <strong>overwrite</strong> any existing Firestore documents with the same IDs. Existing data not in this migration will remain untouched.
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(STEPS.SELECT)}>Back</button>
                <button className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none' }} onClick={handleMigrate}>
                  <Flame size={14} /> Start Migration
                </button>
              </div>
            </>
          )}

          {/* ── STEP: MIGRATING ── */}
          {step === STEPS.MIGRATING && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', animation: 'spin 2s linear infinite' }}>
                <Flame size={24} color="#fff" />
              </div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Migrating to Firebase...</h4>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>{progress.label}</p>
              {progress.total > 0 && (
                <>
                  <div style={{ background: 'var(--bg-card2)', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#10b981)', borderRadius: 999, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{progress.done} / {progress.total} records ({pct}%)</div>
                </>
              )}
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === STEPS.DONE && result && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CheckCircle size={28} color="#10b981" />
              </div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#10b981' }}>Migration Complete!</h4>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                {result.done} records written to Firebase Firestore.<br />
                Your app will now use Firebase as the primary database.
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
                Done — Start Using Firebase
              </button>
            </div>
          )}

          {/* ── STEP: ERROR ── */}
          {step === STEPS.ERROR && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <XCircle size={28} color="#ef4444" />
              </div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#ef4444' }}>Migration Failed</h4>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{errorMsg}</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Close</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setStep(STEPS.SELECT); setErrorMsg(''); }}>Try Again</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function wrapInvoice(inv) {
  if (inv.versions?.length) return inv;
  return {
    invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, customerContact: inv.customerContact,
    customerGst: inv.customerGst, customerCity: inv.customerCity, customerState: inv.customerState,
    leadId: inv.leadId, latestVersion: 1, createdAt: inv.createdAt, updatedAt: inv.updatedAt,
    versions: [{ id: inv.id, invoiceNumber: inv.invoiceNumber, invoiceDate: inv.invoiceDate, items: inv.items, totalAmount: inv.totalAmount, otherCharges: inv.otherCharges || 0, roundOff: inv.roundOff || 0, status: inv.status, receivedAmount: inv.receivedAmount || 0, paymentStatus: inv.paymentStatus || 'Pending', version: 1, createdAt: inv.createdAt }],
  };
}
