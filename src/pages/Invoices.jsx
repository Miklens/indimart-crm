import React, { useState, useEffect } from 'react';
import { Search, FileText, Trash2, Download, RefreshCw, Eye, Copy, Phone, MapPin, Calendar, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAppUI } from '../context/AppUIContext';
import InvoiceModal from '../components/InvoiceModal';
import LeadDetails from '../components/LeadDetails';

export default function Invoices() {
  const { invoiceHistory, updateInvoiceField, updateInvoicePayment, deleteInvoice, deleteInvoiceVersion, showBanner } = useApp();
  const { openCustomer360 } = useAppUI();
  const [search, setSearch] = useState('');
  const [viewInvoice, setViewInvoice] = useState(null);
  const [duplicateInvoice, setDuplicateInvoice] = useState(null);
  const [viewLeadId, setViewLeadId] = useState(null);
  const [expandedVersions, setExpandedVersions] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(50);
  const [prevSearch, setPrevSearch] = useState(search);

  if (search !== prevSearch) {
    setPrevSearch(search);
    setVisibleCount(50);
  }

  // ── System Back Button / Gesture Navigation Listener ──
  useEffect(() => {
    const handleBack = (e) => {
      if (viewInvoice) {
        setViewInvoice(null);
        e.preventDefault();
      } else if (duplicateInvoice) {
        setDuplicateInvoice(null);
        e.preventDefault();
      } else if (viewLeadId) {
        setViewLeadId(null);
        e.preventDefault();
      }
    };
    window.addEventListener('app:system-back', handleBack);
    return () => window.removeEventListener('app:system-back', handleBack);
  }, [viewInvoice, duplicateInvoice, viewLeadId]);

  const toggleVersions = (invNo) => setExpandedVersions(prev => {
    const next = new Set(prev);
    if (next.has(invNo)) next.delete(invNo); else next.add(invNo);
    return next;
  });

  const getInvNum = (inv) => {
    const m = inv.invoiceNumber?.match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  };

  const filtered = invoiceHistory
    .filter(inv => {
      if (!search) return true;
      const s = search.toLowerCase();
      const name = (inv.customerName || '').toLowerCase();
      const contact = inv.customerContact || inv.contact || '';
      const city = (inv.customerCity || inv.city || '').toLowerCase();
      return inv.invoiceNumber.toLowerCase().includes(s) || name.includes(s) || contact.includes(s) || city.includes(s);
    })
    .sort((a, b) => {
      const nd = getInvNum(b) - getInvNum(a);
      if (nd !== 0) return nd;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  const handlePaymentStatus = (invNo, val) => {
    const inv = invoiceHistory.find(i => i.invoiceNumber === invNo);
    if (!inv) return;
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    const total = latest.totalAmount || 0;
    const received = val === 'Paid' ? total : val === 'Pending' ? 0 : (latest.receivedAmount || 0);
    updateInvoicePayment(invNo, received, total);
    showBanner(`Invoice ${invNo} payment → ${val}`, 'success');
  };

  const exportCSV = () => {
    const header = ['Invoice Number','Invoice Date','Customer Name','Contact','GST','City','State','Total Amount','Received Amount','Payment Status','Status'];
    const rows = invoiceHistory.map(inv => {
      const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
      return [inv.invoiceNumber, latest.invoiceDate || '', inv.customerName || '', inv.customerContact || '', inv.customerGst || '', inv.customerCity || '', inv.customerState || '', latest.totalAmount ?? '', latest.receivedAmount ?? '', latest.paymentStatus || '', latest.status || ''];
    });
    const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const payColor = (ps) => ps === 'Paid' ? '#10b981' : ps === 'Partial' ? '#f59e0b' : '#ef4444';

  if (viewLeadId) return <LeadDetails leadId={viewLeadId} onBack={() => setViewLeadId(null)} />;

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">📄 Invoices & Billing</h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>{invoiceHistory.length} invoice{invoiceHistory.length !== 1 ? 's' : ''} total</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setSearch('')}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: 360 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice #, customer, phone..." style={{ paddingLeft: '2.25rem' }} />
      </div>

      {/* ── MOBILE TOUCH CARDS (Invoices) ── */}
      <div className="mobile-only">
        {filtered.length === 0 && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
            No invoices found
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.slice(0, visibleCount).map(inv => {
            const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
            const total = parseFloat(latest.totalAmount) || 0;
            const received = parseFloat(latest.receivedAmount) || 0;
            const pending = Math.max(0, total - received);
            const ps = latest.paymentStatus || 'Pending';

            return (
              <div 
                key={inv.invoiceNumber}
                className="glass-card"
                style={{
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  borderLeft: `4px solid ${payColor(ps)}`,
                }}
              >
                {/* Header: Invoice # + Date + WhatsApp */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--primary)' }}>
                        {inv.invoiceNumber}
                      </span>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 800, 
                        padding: '2px 7px', 
                        borderRadius: 999,
                        background: `${payColor(ps)}18`,
                        color: payColor(ps),
                        border: `1px solid ${payColor(ps)}33`
                      }}>
                        {ps}
                      </span>
                    </div>
                    <div 
                      style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', marginTop: 4, cursor: 'pointer' }}
                      onClick={() => openCustomer360({ name: inv.customerName, contact: inv.customerContact, city: inv.customerCity })}
                    >
                      {inv.customerName}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      {latest.invoiceDate || '—'} {inv.customerCity ? `• ${inv.customerCity}` : ''}
                    </div>
                  </div>

                  {inv.customerContact && (
                    <button 
                      onClick={() => window.open(`https://wa.me/91${inv.customerContact}?text=Hello%20${encodeURIComponent(inv.customerName)},%20regarding%20Invoice%20${inv.invoiceNumber}%20for%20Rs.${total.toLocaleString()}...`)}
                      style={{
                        background: 'rgba(37, 211, 102, 0.15)',
                        border: '1px solid rgba(37, 211, 102, 0.35)',
                        color: '#25d366',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <MessageCircle size={14} /> <span>Share</span>
                    </button>
                  )}
                </div>

                {/* Financials Strip */}
                <div style={{ background: 'var(--bg-input)', padding: '0.65rem 0.85rem', borderRadius: '0.65rem', border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700 }}>BILLED</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>₹{total.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700 }}>RECEIVED</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#10b981' }}>₹{received.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700 }}>BALANCE</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: pending > 0 ? '#ef4444' : '#10b981' }}>₹{pending.toLocaleString()}</div>
                  </div>
                </div>

                {/* Quick Status Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-dim)', marginBottom: 2, fontWeight: 700 }}>PAYMENT</label>
                    <select 
                      value={ps} 
                      onChange={e => handlePaymentStatus(inv.invoiceNumber, e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem', minHeight: 36 }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Partial">Partial</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-dim)', marginBottom: 2, fontWeight: 700 }}>DELIVERY</label>
                    <select 
                      value={latest.deliveryStatus || 'Pending'}
                      onChange={e => {
                        updateInvoiceField(inv.invoiceNumber, 'deliveryStatus', e.target.value);
                        showBanner(`Delivery status → ${e.target.value}`, 'success');
                      }}
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem', minHeight: 36 }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Material Dispatched">Dispatched</option>
                      <option value="Material Reached">Reached</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--glass-border)', paddingTop: '0.65rem' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setViewInvoice({ ...inv, _editMode: false, initialVersion: inv.versions?.length - 1 })}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.76rem', minHeight: 34, gap: 4 }}
                  >
                    <Eye size={13} /> View / Print
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setDuplicateInvoice(inv)}
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.76rem', minHeight: 34, gap: 4 }}
                  >
                    <Copy size={13} /> Copy
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => { if (window.confirm(`Delete invoice ${inv.invoiceNumber}?`)) { deleteInvoice(inv.invoiceNumber); showBanner('Invoice deleted', 'info'); } }}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.76rem', minHeight: 34 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP TABLE VIEW ── */}
      <div className="desktop-only table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th><th>Date</th><th>Customer</th><th>Contact</th><th>City</th>
              <th>Amount</th><th>Received</th><th>Payment</th><th>Delivery</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>No invoices found</td></tr>
            )}
            {filtered.slice(0, visibleCount).map(inv => {
              const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
              const hasVersions = (inv.versions?.length || 0) > 1;
              const isExpanded = expandedVersions.has(inv.invoiceNumber);

              return (
                <React.Fragment key={inv.invoiceNumber}>
                  <tr>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', cursor: 'pointer' }}
                          onClick={() => setViewInvoice({ ...inv, _editMode: false, initialVersion: inv.versions?.length - 1 })}>
                          {inv.invoiceNumber}
                        </span>
                        {hasVersions && (
                          <button className="btn-icon" style={{ padding: 1, minWidth: 20, minHeight: 20, fontSize: '0.65rem' }}
                            onClick={() => toggleVersions(inv.invoiceNumber)}>
                            v{inv.versions.length}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{latest.invoiceDate || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer' }}
                        onClick={() => openCustomer360({ name: inv.customerName, contact: inv.customerContact, city: inv.customerCity })}>
                        {inv.customerName}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{inv.customerContact || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{inv.customerCity || '—'}</td>
                    <td style={{ fontWeight: 700 }}>₹{(latest.totalAmount || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>₹{(latest.receivedAmount || 0).toLocaleString()}</td>
                    <td>
                      <select className="table-inline-select" value={latest.paymentStatus || 'Pending'}
                        onChange={e => handlePaymentStatus(inv.invoiceNumber, e.target.value)}
                        style={{ color: payColor(latest.paymentStatus), fontWeight: 700 }}>
                        <option value="Pending">Pending</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </td>
                    <td>
                      <select className="table-inline-select" value={latest.deliveryStatus || 'Pending'}
                        onChange={e => { updateInvoiceField(inv.invoiceNumber, 'deliveryStatus', e.target.value); showBanner('Delivery status updated', 'success'); }}>
                        <option value="Pending">Pending</option>
                        <option value="Material Dispatched">Dispatched</option>
                        <option value="Material Reached">Reached</option>
                      </select>
                    </td>
                    <td><span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-dim)' }}>{latest.status || 'Active'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button className="btn-icon" style={{ color: 'var(--primary)' }} title="View"
                          onClick={() => setViewInvoice({ ...inv, _editMode: false, initialVersion: inv.versions?.length - 1 })}>
                          <Eye size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: '#38bdf8' }} title="Duplicate"
                          onClick={() => setDuplicateInvoice(inv)}>
                          <Copy size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: '#ef4444' }} title="Delete"
                          onClick={() => { if (window.confirm(`Delete invoice ${inv.invoiceNumber}?`)) { deleteInvoice(inv.invoiceNumber); showBanner('Invoice deleted', 'info'); } }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setVisibleCount(p => p + 50)}>
            Load More ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {viewInvoice && (
        <InvoiceModal lead={viewInvoice} editInvoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
      {duplicateInvoice && (
        <InvoiceModal duplicateFrom={duplicateInvoice} onClose={() => setDuplicateInvoice(null)} />
      )}
    </div>
  );
}
