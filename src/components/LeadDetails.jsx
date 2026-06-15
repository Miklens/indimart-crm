import { useState } from 'react';
import { ArrowLeft, Edit, RefreshCw, Truck, PackageCheck, FileText, MessageCircle, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';
import InvoiceModal from './InvoiceModal';
import ProductPicker from './ProductPicker';

const STATUS_OPTIONS = DATA_CONFIG.getSimpleStatusOptions();

export default function LeadDetails({ leadId, onBack, onEdit }) {
  const { leads, invoiceHistory, updateLeadStatus, updateLead, addLead, showBanner } = useApp();
  const [showInvoice, setShowInvoice] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState(null);
  const lead = leads.find(l => l.id === leadId);
  const currentSimpleStatus = lead ? DATA_CONFIG.getSimpleStatusLabel(lead.status) : 'New Enquiry';

  const handleGenerateInvoice = () => {
    const realItems = (lead?.productList || []).filter(it => it.name?.trim());
    if (realItems.length > 1) { setPickerOpen(true); }
    else { setInvoiceItems(null); setShowInvoice(true); }
  };

  if (!lead) return null;

  const relatedInvoices = invoiceHistory.filter(inv => inv.leadId === leadId);
  const totalInvoiceValue = relatedInvoices.reduce((sum, inv) => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return sum + (parseFloat(latest.totalAmount) || 0);
  }, 0);
  const totalPaid = relatedInvoices.reduce((sum, inv) => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return sum + (parseFloat(latest.receivedAmount) || 0);
  }, 0);
  const balance = totalInvoiceValue - totalPaid;
  const payPercent = totalInvoiceValue > 0 ? Math.min((totalPaid / totalInvoiceValue) * 100, 100).toFixed(0) : 0;

  const reorder = () => {
    if (!window.confirm(`Create a new enquiry for ${lead.customerName}?`)) return;
    const rest = { ...lead };
    delete rest.id;
    delete rest.history;
    // eslint-disable-next-line react-hooks/purity
    addLead({ ...rest, date: new Date().toISOString().split('T')[0], status: 'New Enquiry', paymentStatus: 'Pending', paymentReceivedAmount: 0, transactionId: '', dispatchDate: '', dispatchMethod: '', trackingId: '', materialReachedDate: '', remarks: `Reorder from ${lead.id}`, history: [{ status: 'New Enquiry', timestamp: Date.now() }] });
    showBanner(`✅ Reorder enquiry created for ${lead.customerName}`, 'success');
    onBack();
  };

  const statusColor = DATA_CONFIG.getStatusColor(lead.status);

  return (
    <div className="page-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14} /> Back to Leads</button>
        <h2 style={{ fontSize: '1.3rem' }}>{lead.customerName}</h2>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{lead.contact}{lead.city ? ` · ${lead.city}, ${lead.state}` : ''}</span>
        <span style={{ marginLeft: 'auto', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 999, padding: '3px 12px', fontSize: '0.75rem', fontWeight: 700 }}>{DATA_CONFIG.getSimpleStatusLabel(lead.status)}</span>
      </div>

      {/* Quick actions */}
      <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => { updateLeadStatus(leadId, 'Material Dispatched'); showBanner('✅ Marked In Transit', 'success'); }}><Truck size={14} /> Mark In Transit</button>
          <button className="btn btn-secondary" onClick={() => { updateLeadStatus(leadId, 'Material Reached'); showBanner('✅ Marked Delivered', 'success'); }}><PackageCheck size={14} /> Mark Delivered</button>
          <button className="btn btn-secondary" onClick={() => window.open(`https://wa.me/91${lead.contact}`)}><MessageCircle size={14} /> WhatsApp</button>
          <button className="btn btn-secondary" onClick={handleGenerateInvoice}><FileText size={14} /> Generate Invoice</button>
          <button className="btn btn-secondary" onClick={reorder}><RefreshCw size={14} /> Reorder</button>
          <button className="btn btn-primary" onClick={() => onEdit(leadId)}><Edit size={14} /> Edit Lead</button>
        </div>

        {/* Inline status update */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Update Status:</label>
          <select value={currentSimpleStatus} onChange={e => {
            const nextStatus = DATA_CONFIG.resolveStatusFromSimple(e.target.value);
            updateLeadStatus(leadId, nextStatus);
            showBanner(`✅ Status → ${e.target.value}`, 'success');
          }} style={{ minWidth: 200 }}>
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {DATA_CONFIG.getLostStatusLabels().includes(lead.status) && (
            <input
              key={leadId + '-lr'}
              defaultValue={lead.lostReason || ''}
              onBlur={e => { if (e.target.value !== (lead.lostReason || '')) updateLead(leadId, { lostReason: e.target.value }); }}
              placeholder="Lost reason..."
              style={{ flex: 1, minWidth: 160 }}
            />
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-label">Payment Status</div>
          <div className="kpi-value" style={{ color: '#10b981', fontSize: '1.2rem' }}>₹{totalPaid.toLocaleString()} / ₹{totalInvoiceValue.toLocaleString()}</div>
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: 5, borderRadius: 3, marginTop: 6 }}>
            <div style={{ width: `${payPercent}%`, background: '#10b981', height: '100%', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>Balance: ₹{balance.toLocaleString()}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-label">Shipping Status</div>
          <div className="kpi-value" style={{ color: '#3b82f6', fontSize: '1.1rem' }}>
            {lead.status === 'Material Reached' ? 'Delivered' : lead.status === 'Material Dispatched' ? 'In Transit' : 'Not Shipped'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 6 }}>{lead.trackingId || 'No tracking info'}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-label">Current Stage</div>
          <div className="kpi-value" style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{DATA_CONFIG.getSimpleStatusLabel(lead.status)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 6 }}>
            {lead.history?.length ? `Since ${new Date(lead.history[lead.history.length - 1].timestamp).toLocaleDateString()}` : 'N/A'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        {/* Transaction details */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '0.95rem' }}>Transaction Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Products Ordered</div>
              <div style={{ fontWeight: 600 }}>{lead.product || '-'}</div>
              {lead.productList?.length > 1 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  {lead.productList.map((p, i) => <div key={i}>• {p.name} × {p.qty}</div>)}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Lead Source</div>
              <div style={{ fontWeight: 600 }}>{lead.source || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Transaction ID</div>
              <input value={lead.transactionId || ''} onChange={e => updateLead(leadId, { transactionId: e.target.value })}
                className="table-inline-input" placeholder="Txn / UTR No." style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Courier / Method</div>
              <input value={lead.dispatchMethod || ''} onChange={e => updateLead(leadId, { dispatchMethod: e.target.value })}
                className="table-inline-input" placeholder="e.g. DTDC" style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Tracking / AWB #</div>
              <input value={lead.trackingId || ''} onChange={e => updateLead(leadId, { trackingId: e.target.value })}
                className="table-inline-input" placeholder="AWB number" style={{ width: '100%', fontFamily: 'monospace' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Dispatch Date</div>
              <input type="date" value={lead.dispatchDate || ''} onChange={e => updateLead(leadId, { dispatchDate: e.target.value })}
                className="table-inline-input" style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Material Reached Date</div>
              <input type="date" value={lead.materialReachedDate || ''} onChange={e => updateLead(leadId, { materialReachedDate: e.target.value })}
                className="table-inline-input" style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Payment Status</div>
              <select value={lead.paymentStatus || 'Pending'} onChange={e => updateLead(leadId, { paymentStatus: e.target.value })}
                className="table-inline-select" style={{ width: '100%', color: lead.paymentStatus === 'Paid' ? '#10b981' : lead.paymentStatus === 'Partial' ? '#f59e0b' : '#ef4444' }}>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Received Amount (₹)</div>
              <input type="number" value={lead.paymentReceivedAmount || ''} onChange={e => updateLead(leadId, { paymentReceivedAmount: parseFloat(e.target.value) || 0 })}
                className="table-inline-input" placeholder="0" style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Follow-up Date</div>
              <input type="date" value={lead.followUpDate || ''} onChange={e => updateLead(leadId, { followUpDate: e.target.value })}
                className="table-inline-input" style={{ width: '100%', color: lead.followUpDate && lead.followUpDate < new Date().toISOString().split('T')[0] ? '#ef4444' : undefined }} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Customer Feedback / Rating</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={lead.customerFeedback || ''} onChange={e => updateLead(leadId, { customerFeedback: e.target.value })}
                className="table-inline-input" placeholder="Customer feedback..." style={{ flex: 1 }} />
              <select value={lead.customerRating || ''} onChange={e => updateLead(leadId, { customerRating: e.target.value })}
                className="table-inline-select" style={{ width: 100 }}>
                <option value="">Rating</option>
                {['⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐','⭐⭐⭐⭐⭐'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {lead.remarks && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>Remarks</div>
              <div style={{ background: 'var(--bg-card2)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', border: '1px solid var(--glass-border)' }}>{lead.remarks}</div>
            </div>
          )}

          {/* Related invoices */}
          {relatedInvoices.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                Invoices ({relatedInvoices.length})
              </h4>
              <div className="table-wrapper" style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Invoice #</th><th>Date</th><th>Amount</th><th>Payment</th><th></th></tr></thead>
                  <tbody>
                    {relatedInvoices.map(inv => {
                      const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
                      return (
                        <tr key={inv.invoiceNumber}>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{inv.invoiceNumber}</td>
                          <td>{latest.invoiceDate || '-'}</td>
                          <td>₹{(latest.totalAmount || 0).toLocaleString()}</td>
                          <td style={{ color: latest.paymentStatus === 'Paid' ? '#10b981' : latest.paymentStatus === 'Partial' ? '#f59e0b' : '#ef4444' }}>
                            {latest.paymentStatus || 'Pending'}
                          </td>
                          <td>
                            <button className="btn-icon" style={{ color: '#f59e0b' }} title="View Invoice" onClick={() => setViewInvoice(inv)}>
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="glass-card" style={{ maxHeight: 450, overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '0.95rem' }}>Lead Timeline</h3>
          {lead.history?.length ? (
            lead.history.slice().reverse().map((item, i) => (
              <div key={i} style={{ position: 'relative', paddingLeft: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: -12, width: 2, background: 'var(--glass-border-strong)' }} />
                <div style={{ position: 'absolute', left: -3, top: 2, width: 8, height: 8, borderRadius: '50%', background: DATA_CONFIG.getStatusColor(item.status) }} />
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.status}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{new Date(item.timestamp).toLocaleString()}</div>
                {item.note && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 2 }}>{item.note}</div>}
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No history recorded</div>
          )}
        </div>
      </div>

      {pickerOpen && <ProductPicker lead={lead} onConfirm={(items) => { setInvoiceItems(items); setPickerOpen(false); setShowInvoice(true); }} onClose={() => setPickerOpen(false)} />}
      {showInvoice && <InvoiceModal leadId={leadId} initialItems={invoiceItems} onClose={() => { setShowInvoice(false); setInvoiceItems(null); }} />}
      {viewInvoice && <InvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
    </div>
  );
}
