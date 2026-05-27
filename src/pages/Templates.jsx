import { useState } from 'react';
import { Plus, Edit3, Trash2, X, MessageCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const CATEGORIES = ['Follow-up', 'Quotation', 'Reminder', 'Thank You', 'Other'];
const CAT_COLORS = { 'Follow-up': '#3b82f6', 'Quotation': '#f59e0b', 'Reminder': '#8b5cf6', 'Thank You': '#10b981', 'Other': '#94a3b8' };

function TemplateModal({ tpl, onClose, onSave }) {
  const [form, setForm] = useState({ name: tpl?.name || '', content: tpl?.content || tpl?.message || '', category: tpl?.category || 'Follow-up' });
  const handle = (e) => { e.preventDefault(); onSave({ ...form, id: tpl?.id }); onClose(); };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>{tpl ? 'Edit Template' : 'New Message Template'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handle}>
          <div className="form-grid">
            <div className="form-group full-width"><label>Template Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Follow-up Message" /></div>
            <div className="form-group full-width">
              <label>Message Content</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }} required placeholder="Hi {{customer}}, Your message here..." />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>💡 Use <code>{'{{customer}}'}</code>, <code>{'{{product}}'}</code>, <code>{'{{orderValue}}'}</code>, <code>{'{{city}}'}</code>, <code>{'{{company}}'}</code></div>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Template</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fillTemplate(content, lead, companyName) {
  return (content || '')
    .replace(/\{\{customerName\}\}/g, lead?.customerName || '')
    .replace(/\{\{customer\}\}/g, lead?.customerName || '')
    .replace(/\{\{product\}\}/g, lead?.product || '')
    .replace(/\{\{orderValue\}\}/g, lead?.orderValue || '')
    .replace(/\{\{city\}\}/g, lead?.city || '')
    .replace(/\{\{contact\}\}/g, lead?.contact || '')
    .replace(/\{\{company\}\}/g, companyName || '');
}

export default function Templates() {
  const { leads, messageTemplates, saveTemplate, deleteTemplate, showBanner, companySettings } = useApp();
  const [editTpl, setEditTpl] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [sendModal, setSendModal] = useState(null);
  const [selectedLead, setSelectedLead] = useState('');

  const tplContent = sendModal ? (sendModal.tpl.content || sendModal.tpl.message || '') : '';
  const preview = sendModal && selectedLead
    ? fillTemplate(tplContent, leads.find(l => l.id === selectedLead), companySettings?.name)
    : tplContent;

  const sendWA = () => {
    const lead = leads.find(l => l.id === selectedLead);
    if (!lead) return;
    const msg = fillTemplate(tplContent, lead, companySettings?.name);
    window.open(`https://wa.me/91${lead.contact}?text=${encodeURIComponent(msg)}`);
    setSendModal(null);
  };

  return (
    <div className="page-section">
      <div className="section-header">
        <h2 className="section-title">Message Templates</h2>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Template</button>
      </div>

      {messageTemplates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
          <p>No templates yet. Create WhatsApp message templates to quickly communicate with leads.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {messageTemplates.map(tpl => (
          <div key={tpl.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', margin: '0 0 4px' }}>{tpl.name}</h3>
                {tpl.category && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${CAT_COLORS[tpl.category] || '#94a3b8'}22`, color: CAT_COLORS[tpl.category] || '#94a3b8', border: `1px solid ${CAT_COLORS[tpl.category] || '#94a3b8'}44` }}>
                    {tpl.category}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn-icon" style={{ color: 'var(--primary)' }} onClick={() => setEditTpl(tpl)}><Edit3 size={14} /></button>
                <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => { if (window.confirm('Delete template?')) { deleteTemplate(tpl.id); showBanner('Template deleted.', 'info'); } }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'pre-wrap', flex: 1, maxHeight: 120, overflow: 'hidden' }}>{tpl.content || tpl.message}</div>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setSendModal({ tpl }); setSelectedLead(''); }}><MessageCircle size={14} /> Send via WhatsApp</button>
          </div>
        ))}
      </div>

      {/* Send modal */}
      {sendModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSendModal(null)}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Send: {sendModal.tpl.name}</h2>
              <button className="btn-icon" onClick={() => setSendModal(null)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label>Select Lead</label>
              <select value={selectedLead} onChange={e => setSelectedLead(e.target.value)}>
                <option value="">-- Choose a lead --</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.customerName} ({l.contact})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Message Preview</label>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.82rem', whiteSpace: 'pre-wrap', minHeight: 100, color: 'var(--text-main)' }}>{preview}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSendModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendWA} disabled={!selectedLead}><MessageCircle size={14} /> Open WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {(showNew || editTpl) && (
        <TemplateModal
          tpl={editTpl}
          onClose={() => { setShowNew(false); setEditTpl(null); }}
          onSave={(data) => { saveTemplate(data); showBanner('Template saved.', 'success'); }}
        />
      )}
    </div>
  );
}
