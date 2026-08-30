import { useState, useRef } from 'react';
import { X, Phone, MapPin, TrendingUp, FileText, Clock, MessageCircle, Plus, Trash2, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG, normalizeDisplayDate, detectCountry, getWhatsAppLink } from '../utils/dataConfig';

import InvoiceModal from './InvoiceModal';

function normC(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  return d.slice(-10);
}

function StatPill({ label, value, color = 'var(--primary)' }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.75rem 1rem', background: 'var(--bg-card2)', borderRadius: '0.75rem', border: '1px solid var(--glass-border)', minWidth: 100 }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const PAY_COLOR = { Paid: '#10b981', Partial: '#f59e0b', Pending: '#ef4444' };

export default function Customer360({ customer, onClose }) {
  const { leads, invoiceHistory, updateLead, setCurrentSection } = useApp();
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('Call');
  const [expandedLead, setExpandedLead] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const noteInputRef = useRef(null);

  const custContact = normC(customer.contact);

  const custLeads = leads.filter(l => {
    if (custContact && normC(l.contact) === custContact) return true;
    if (customer.name && l.customerName === customer.name) return true;
    return false;
  });

  const custInvoices = invoiceHistory.filter(inv => {
    const c = normC(inv.customerContact || inv.contact || '');
    const n = inv.customerName || '';
    if (custContact && c === custContact) return true;
    if (customer.name && n === customer.name) return true;
    return false;
  });

  const totalBilled = custInvoices.reduce((s, inv) => {
    const l = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return s + (parseFloat(l.totalAmount) || 0);
  }, 0);
  const totalReceived = custInvoices.reduce((s, inv) => {
    const l = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return s + (parseFloat(l.receivedAmount) || 0);
  }, 0);
  const totalOutstanding = totalBilled - totalReceived;

  const dates = custLeads.map(l => l.followUpDate || l.date).filter(Boolean).sort().reverse();
  const lastContact = dates[0] ? normalizeDisplayDate(dates[0]) : '—';

  const isVip = totalBilled >= 100000 || custInvoices.length >= 3;

  const latestLead = custLeads.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  })[0];

  const countryInfo = detectCountry(`${customer.city || ''} ${customer.state || ''} ${customer.country || ''}`, customer.contact);

  const addNote = () => {
    if (!noteText.trim() || !latestLead) return;
    const now = Date.now();
    const note = { id: now, text: noteText.trim(), type: noteType, timestamp: now };
    const notes = [...(latestLead.activityNotes || []), note];
    updateLead(latestLead.id, { activityNotes: notes });
    setNoteText('');
    noteInputRef.current?.focus();
  };

  const deleteNote = (noteId) => {
    if (!latestLead) return;
    const notes = (latestLead.activityNotes || []).filter(n => n.id !== noteId);
    updateLead(latestLead.id, { activityNotes: notes });
  };

  const allNotes = custLeads.flatMap(l => (l.activityNotes || []).map(n => ({ ...n, leadId: l.id }))).sort((a, b) => b.timestamp - a.timestamp);

  const NOTE_TYPES = ['Call', 'WhatsApp', 'Visit', 'Email', 'Note'];
  const NOTE_ICONS = { Call: '📞', WhatsApp: '💬', Visit: '🤝', Email: '📧', Note: '📝' };
  const NOTE_COLOR = { Call: '#3b82f6', WhatsApp: '#10b981', Visit: '#f59e0b', Email: '#8b5cf6', Note: '#94a3b8' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 820, width: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.5rem 1.5rem 1rem', background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-sidebar) 100%)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 10, borderRadius: '0.75rem 0.75rem 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: 4 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                  {customer.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{customer.name}</h2>
                    {countryInfo && (
                      <span style={{ fontSize: '0.72rem', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', padding: '2px 8px', borderRadius: 999, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{countryInfo.flag}</span> <span>{countryInfo.name}</span>
                      </span>
                    )}
                    {isVip && <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>⭐ VIP</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 4, flexWrap: 'wrap' }}>
                    {customer.contact && <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} /> {customer.contact}</span>}
                    {customer.city && <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {customer.city}</span>}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> Last contact: {lastContact}</span>
                  </div>
                </div>
              </div>
            </div>
            <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}><X size={18} /></button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <StatPill label="Lifetime Value (Billed)" value={`₹${totalBilled.toLocaleString()}`} color="var(--primary)" />
            <StatPill label="Collected" value={`₹${totalReceived.toLocaleString()}`} color="#10b981" />
            <StatPill label="Outstanding" value={`₹${Math.max(0, totalOutstanding).toLocaleString()}`} color={totalOutstanding > 0 ? '#ef4444' : '#10b981'} />
            <StatPill label="Leads" value={custLeads.length} color="#3b82f6" />
            <StatPill label="Invoices" value={custInvoices.length} color="#f59e0b" />
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* LEFT — Leads */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={14} /> Lead History ({custLeads.length})</h3>

            {custLeads.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', padding: '1rem', textAlign: 'center' }}>No leads found</div>}

            {custLeads.sort((a, b) => new Date(b.date) - new Date(a.date)).map(lead => {
              const isExpanded = expandedLead === lead.id;
              const statusColor = DATA_CONFIG.getStatusColor(lead.status);
              return (
                <div key={lead.id} style={{ background: 'var(--bg-card2)', borderRadius: '0.6rem', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', cursor: 'pointer' }}
                    onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.product || 'No product'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{normalizeDisplayDate(lead.date)} · ₹{(lead.orderValue || 0).toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', background: `${statusColor}22`, color: statusColor, padding: '2px 7px', borderRadius: 999, fontWeight: 600, flexShrink: 0 }}>{lead.status}</span>
                    {isExpanded ? <ChevronUp size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> : <ChevronDown size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0.6rem 0.85rem 0.85rem', borderTop: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.75rem' }}>
                      {[
                        ['Source', lead.source],
                        ['City', lead.city || lead.state],
                        ['Follow-up', normalizeDisplayDate(lead.followUpDate)],
                        ['Payment', lead.paymentStatus || 'Pending'],
                        ['Dispatch', normalizeDisplayDate(lead.dispatchDate)],
                        ['Tracking', lead.trackingId],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ color: 'var(--text-dim)' }}>{k}: </span>
                          <span style={{ fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                      {lead.remarks && (
                        <div style={{ gridColumn: '1/-1', marginTop: 4, fontStyle: 'italic', color: 'var(--text-dim)' }}>"{lead.remarks}"</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT — Invoices & Activity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Invoices ({custInvoices.length})</h3>

              {custInvoices.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', padding: '0.75rem', textAlign: 'center', background: 'var(--bg-card2)', borderRadius: '0.6rem' }}>No invoices created yet</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {custInvoices.map(inv => {
                  const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
                  const total = parseFloat(latest.totalAmount) || 0;
                  const received = parseFloat(latest.receivedAmount) || 0;
                  const pending = total - received;
                  const ps = latest.paymentStatus || 'Pending';

                  return (
                    <div key={inv.invoiceNumber} style={{ background: 'var(--bg-card2)', borderRadius: '0.6rem', border: '1px solid var(--glass-border)', padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setViewInvoice(inv)}>
                          {inv.invoiceNumber}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 2 }}>{latest.invoiceDate || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>₹{total.toLocaleString()}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                          <span style={{ fontSize: '0.65rem', color: PAY_COLOR[ps] || '#ef4444', fontWeight: 700 }}>● {ps}</span>
                          {pending > 0 && <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>Due: ₹{pending.toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            {customer.contact && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={getWhatsAppLink(customer.contact)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', fontSize: '0.78rem', color: '#25d366', borderColor: 'rgba(37,211,102,0.3)' }}
                >
                  <MessageCircle size={14} /> WhatsApp Chat
                </a>
                {totalOutstanding > 0 && (
                  <a
                    href={getWhatsAppLink(customer.contact, `Dear ${customer.name}, your outstanding payment of ₹${totalOutstanding.toLocaleString()} is pending. Please clear at your earliest. Thank you!`)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', fontSize: '0.78rem', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
                  >
                    💰 Send Payment Reminder
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Invoice View Modal */}
        {viewInvoice && <InvoiceModal invoice={invoiceHistory.find(i => i.invoiceNumber === viewInvoice.invoiceNumber) || viewInvoice} onClose={() => setViewInvoice(null)} />}
      </div>
    </div>
  );
}
