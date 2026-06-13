import React, { useState, useEffect } from 'react';
import { Search, FileText, Trash2, Download, RefreshCw, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAppUI } from '../App';
import InvoiceModal from '../components/InvoiceModal';
import LeadDetails from '../components/LeadDetails';

export default function Invoices() {
  const { invoiceHistory, leads, updateInvoiceField, updateInvoicePayment, deleteInvoice, deleteInvoiceVersion, updateLeadStatus, showBanner } = useApp();
  const { openCustomer360 } = useAppUI();
  const [search, setSearch] = useState('');
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewLeadId, setViewLeadId] = useState(null);
  const [expandedVersions, setExpandedVersions] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [search]);

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

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Invoice History</h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>{invoiceHistory.length} invoice{invoiceHistory.length !== 1 ? 's' : ''} total</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setSearch('')}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." style={{ paddingLeft: '2rem' }} />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th><th>Date</th><th>Customer</th><th>Contact</th><th>City</th>
              <th>Amount</th><th>Received</th><th>Payment</th><th>Delivery</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>No invoices yet. Generate one from the Leads page.</td></tr>
            )}
            {filtered.slice(0, visibleCount).map(inv => {
              const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
              const customerName = inv.customerName || '';
              const customerContact = inv.customerContact || inv.contact || '';
              const customerCity = inv.customerCity || inv.city || '';
              const lead = leads.find(l => l.id === inv.leadId);
              const shippingStatus = lead?.status || 'N/A';
              const shipColor = shippingStatus === 'Material Reached' ? '#10b981' : shippingStatus === 'Material Dispatched' ? '#3b82f6' : '#94a3b8';
              const payColor = latest.paymentStatus === 'Paid' ? '#10b981' : latest.paymentStatus === 'Partial' ? '#f59e0b' : '#ef4444';
              const expanded = expandedVersions.has(inv.invoiceNumber);
              const versionCount = inv.versions?.length || 0;
              return (
                <React.Fragment key={inv.invoiceNumber}>
                <tr>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                    {inv.invoiceNumber}
                    {versionCount > 1 && (
                      <span onClick={() => toggleVersions(inv.invoiceNumber)}
                        style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: 10, marginLeft: 6, cursor: 'pointer' }}>
                        v{versionCount} {expanded ? '▴' : '▾'}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>{latest.invoiceDate || '-'}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                      onClick={() => openCustomer360({ name: customerName, contact: customerContact, city: customerCity })}
                      title="View Customer 360">
                      {customerName || '-'}
                    </span>
                  </td>
                  <td>{customerContact || '-'}</td>
                  <td>{customerCity || '-'}</td>
                  <td style={{ fontWeight: 600 }}>₹{(latest.totalAmount || 0).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '0.4rem', padding: '0 0.35rem', width: 110 }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>₹</span>
                      <input type="number" className="table-inline-input"
                        key={inv.invoiceNumber + '-' + (latest.receivedAmount || 0)}
                        defaultValue={latest.receivedAmount || 0}
                        onBlur={e => {
                          const amt = parseFloat(e.target.value) || 0;
                          updateInvoicePayment(inv.invoiceNumber, amt, latest.totalAmount || 0);
                          showBanner(`Payment updated for ${inv.invoiceNumber}`, 'success');
                        }}
                        style={{ border: 'none', padding: '0.3rem 0', background: 'transparent', fontWeight: 600, textAlign: 'right', color: (latest.receivedAmount || 0) > 0 ? '#10b981' : undefined }}
                      />
                    </div>
                  </td>
                  <td>
                    <select className="table-inline-select" value={latest.paymentStatus || 'Pending'}
                      onChange={e => handlePaymentStatus(inv.invoiceNumber, e.target.value)}
                      style={{ fontWeight: 600, color: payColor, background: `${payColor}22`, borderColor: `${payColor}44`, width: 110 }}>
                      <option value="Pending">Pending</option>
                      <option value="Partial">Partial</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </td>
                  <td>
                    {lead && (
                      <select className="table-inline-select" value={shippingStatus}
                        onChange={e => { updateLeadStatus(inv.leadId, e.target.value); }}
                        style={{ fontWeight: 600, color: shipColor, width: 130 }}>
                        <option value="Converted">Order Placed</option>
                        <option value="Material Dispatched">In Transit</option>
                        <option value="Material Reached">Delivered</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <select className="table-inline-select" value={latest.status || 'Pending'}
                      onChange={e => updateInvoiceField(inv.invoiceNumber, 'status', e.target.value)}
                      style={{ width: 100, color: latest.status === 'Sent' ? '#10b981' : '#94a3b8' }}>
                      <option value="Pending">Pending</option>
                      <option value="Sent">Sent</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" style={{ color: '#f59e0b' }} title="View Invoice" onClick={() => setViewInvoice(inv)}>
                        <FileText size={15} />
                      </button>
                      {inv.leadId && (
                        <button className="btn-icon" style={{ color: '#3b82f6' }} title="Customer Profile" onClick={() => setViewLeadId(inv.leadId)}>
                          <Eye size={15} />
                        </button>
                      )}
                      <button className="btn-icon" style={{ color: '#ef4444' }} title="Delete" onClick={() => { if (window.confirm('Delete this invoice?')) { deleteInvoice(inv.invoiceNumber); showBanner('Invoice deleted.', 'info'); } }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded && versionCount > 0 && [...inv.versions].reverse().map((ver, vi) => {
                  const isLatest = vi === 0;
                  const vNum = ver.version || (versionCount - vi);
                  // Real index in original (non-reversed) versions array
                  const realIdx = versionCount - 1 - vi;
                  return (
                    <tr key={`${inv.invoiceNumber}-v${vi}`} style={{ background: isLatest ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)', fontSize: '0.75rem' }}>
                      <td style={{ paddingLeft: '1.5rem', fontWeight: isLatest ? 700 : 400, color: isLatest ? '#10b981' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        &#x2514; v{vNum} {isLatest && <span style={{ fontSize: '0.6rem', background: '#10b98133', color: '#10b981', borderRadius: 4, padding: '1px 4px', marginLeft: 3 }}>latest</span>}
                      </td>
                      <td style={{ color: 'var(--text-dim)' }}>{ver.invoiceDate || '-'}</td>
                      <td colSpan={2} style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{ver.createdAt ? new Date(ver.createdAt).toLocaleString() : '-'}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{ver.items?.length || 0} items</td>
                      <td style={{ fontWeight: 600, color: isLatest ? '#10b981' : 'var(--text-dim)' }}>₹{(ver.totalAmount || 0).toLocaleString()}</td>
                      <td style={{ color: 'var(--text-dim)' }}>₹{(ver.receivedAmount || 0).toLocaleString()}</td>
                      <td colSpan={4}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                            onClick={() => setViewInvoice({ ...inv, versions: [ver] })}>
                            View v{vNum}
                          </button>
                          <button className="btn-icon" style={{ color: '#ef4444', padding: '2px 4px' }}
                            title={`Delete v${vNum}`}
                            onClick={() => {
                              const msg = versionCount === 1
                                ? `Delete the only version of ${inv.invoiceNumber}? This will remove the entire invoice.`
                                : `Delete v${vNum} of ${inv.invoiceNumber}?`;
                              if (window.confirm(msg)) {
                                deleteInvoiceVersion(inv.invoiceNumber, realIdx);
                                showBanner(`Version v${vNum} deleted.`, 'info');
                              }
                            }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setVisibleCount(prev => prev + 50)}>
            Load More Invoices ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {viewInvoice && <InvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {viewLeadId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewLeadId(null)} style={{ overflowY: 'auto', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '1rem', padding: '1.5rem', maxWidth: 900, width: '100%', margin: 'auto', border: '1px solid var(--glass-border)' }}>
            <LeadDetails leadId={viewLeadId} onBack={() => setViewLeadId(null)} onEdit={() => setViewLeadId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
