import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

const STATUS_GROUPS = [
  { label: 'Pipeline - Initial', items: ['New Enquiry','Contacted','Requirement Discussed'] },
  { label: 'Pipeline - Quotation', items: ['Quotation Requested','Quotation Sent','Negotiation'] },
  { label: 'Won / Success', items: ['Converted','Purchased','Repeat Customer'] },
  { label: 'Shipping', items: ['Material Dispatched','Material Reached'] },
  { label: 'Lost / Closed', items: ['No Response','Not Interested','No Current Requirement','Invalid Lead','Closed Lost'] },
];

export default function BulkTools() {
  const { leads, messageTemplates, companySettings, updateLeadStatus, updateLead, showBanner } = useApp();
  const [selected, setSelected] = useState(new Set());
  const [newStatus, setNewStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [msgModal, setMsgModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  const filtered = leads.filter(l => {
    const s = search.toLowerCase();
    const matchS = !search || l.customerName?.toLowerCase().includes(s) || (l.contact || '').includes(s);
    const matchF = statusFilter === 'all' || l.status === statusFilter;
    return matchS && matchF;
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map(l => l.id)));
  const clearAll = () => setSelected(new Set());
  const selectByStatus = (status) => setSelected(new Set(leads.filter(l => l.status === status).map(l => l.id)));

  const bulkUpdateStatus = () => {
    if (!newStatus || !selected.size) return;
    selected.forEach(id => updateLeadStatus(id, newStatus));
    showBanner(`✅ Updated ${selected.size} leads to "${newStatus}"`, 'success');
    setSelected(new Set()); setNewStatus('');
  };

  const bulkUpdateFollowUp = () => {
    if (!followUpDate || !selected.size) return;
    selected.forEach(id => updateLead(id, { followUpDate }));
    showBanner(`📅 Set follow-up date for ${selected.size} leads`, 'success');
    setSelected(new Set()); setFollowUpDate('');
  };

  const loadTemplate = (tplId) => {
    setSelectedTemplate(tplId);
    const tpl = messageTemplates.find(t => t.id === tplId);
    if (tpl) setBulkMessage(tpl.content || tpl.message || '');
  };

  const sendBulkMessages = () => {
    if (!bulkMessage || !selected.size) return;
    const selectedLeads = leads.filter(l => selected.has(l.id));
    selectedLeads.forEach(lead => {
      const msg = bulkMessage
        .replace(/\{\{customerName\}\}/g, lead.customerName)
        .replace(/\{\{customer\}\}/g, lead.customerName)
        .replace(/\{\{product\}\}/g, lead.product || '')
        .replace(/\{\{orderValue\}\}/g, lead.orderValue || '')
        .replace(/\{\{city\}\}/g, lead.city || '')
        .replace(/\{\{company\}\}/g, companySettings.name || 'Company');
      window.open(`https://wa.me/91${lead.contact}?text=${encodeURIComponent(msg)}`);
    });
    showBanner(`📤 Opened WhatsApp for ${selectedLeads.length} leads`, 'success');
    setMsgModal(false);
  };

  return (
    <div className="page-section">
      <div className="section-header">
        <h2 className="section-title">⚡ Bulk Tools</h2>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{selected.size} selected</span>
      </div>

      {/* Quick action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button className="btn btn-primary" onClick={() => { if (!selected.size) { alert('Select leads first'); return; } setMsgModal(true); }}><MessageCircle size={14} /> Send Messages ({selected.size})</button>
      </div>

      {/* Bulk actions */}
      <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ marginBottom: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulk Actions</h4>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>NEW STATUS</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="">Select status...</option>
              {STATUS_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map(s => <option key={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={bulkUpdateStatus} disabled={!newStatus || !selected.size}>Update Status ({selected.size})</button>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>SET FOLLOW-UP DATE</label>
            <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={bulkUpdateFollowUp} disabled={!followUpDate || !selected.size}>Set Follow-up ({selected.size})</button>
        </div>
      </div>

      {/* Filters + quick select */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, minWidth: 150 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 160 }}>
          <option value="all">All Statuses</option>
          {STATUS_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map(s => <option key={s}>{s}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={selectAll}>Select All ({filtered.length})</button>
        <button className="btn btn-secondary" onClick={() => selectByStatus('Converted')}>Select Converted</button>
        <button className="btn btn-secondary" onClick={() => selectByStatus('Quotation Sent')}>Select Quoted</button>
        <button className="btn btn-secondary" onClick={clearAll} style={{ color: '#ef4444' }}>✕ Clear</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={e => e.target.checked ? selectAll() : clearAll()} style={{ accentColor: 'var(--primary)' }} /></th>
              <th>Lead ID</th><th>Customer</th><th>Contact</th><th>Status</th><th>Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>No leads found</td></tr>
            )}
            {filtered.map(l => (
              <tr key={l.id} style={{ background: selected.has(l.id) ? 'rgba(16,185,129,0.06)' : undefined }}>
                <td><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} style={{ accentColor: 'var(--primary)' }} /></td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{l.id}</td>
                <td style={{ fontWeight: 600 }}>{l.customerName}</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{l.contact}</td>
                <td>
                  <span className="status-dot" style={{ background: DATA_CONFIG.getStatusColor(l.status) }} />
                  {l.status}
                </td>
                <td style={{ fontWeight: 600 }}>₹{(l.orderValue || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Message Modal */}
      {msgModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMsgModal(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Send Bulk Message</h2>
              <button className="btn-icon" onClick={() => setMsgModal(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Message Template or Custom</label>
                <select value={selectedTemplate} onChange={e => loadTemplate(e.target.value)} style={{ marginBottom: '0.75rem' }}>
                  <option value="">Custom Message</option>
                  {messageTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <textarea value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} rows={5}
                  placeholder="Hi {{customer}}, your message here..." required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.75rem', resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                  💡 Use <code>{'{{customer}}'}</code>, <code>{'{{product}}'}</code>, <code>{'{{city}}'}</code>, <code>{'{{orderValue}}'}</code> as placeholders<br />
                  Recipients: <strong style={{ color: 'var(--primary)' }}>{selected.size} leads</strong>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setMsgModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendBulkMessages} disabled={!bulkMessage || !selected.size}>
                <MessageCircle size={14} /> Send via WhatsApp ({selected.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
