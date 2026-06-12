import { useState, useRef } from 'react';
import { Plus, Search, Eye, FileText, Edit3, Trash2, MessageCircle, Filter, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAppUI } from '../App';
import { DATA_CONFIG, normalizeDisplayDate } from '../utils/dataConfig';
import LeadModal from '../components/LeadModal';
import LeadDetails from '../components/LeadDetails';
import ProductPicker from '../components/ProductPicker';
import InvoiceModal from '../components/InvoiceModal';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'payment', label: 'Pending Payment' },
  { id: 'dispatch', label: 'In Transit' },
  { id: 'delivered', label: 'Delivered' },
];

export default function Leads() {
  const { leads, invoiceHistory, updateLeadStatus, updateLead, deleteLead, addLead, showBanner } = useApp();
  const { openCustomer360 } = useAppUI();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [modalLeadId, setModalLeadId] = useState(undefined);
  const [showModal, setShowModal] = useState(false);

  const STATUS_FILTERS = DATA_CONFIG.getStatusFilterOptions();
  const STATUS_OPTIONS = DATA_CONFIG.getSimpleStatusOptions();
  const [detailsLeadId, setDetailsLeadId] = useState(null);
  const [pickerLead, setPickerLead] = useState(null);
  const [invoiceLead, setInvoiceLead] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState(null);
  const csvRef = useRef(null);

  const openAdd = () => { setModalLeadId(undefined); setShowModal(true); };
  const openEdit = (id) => { setModalLeadId(id); setShowModal(true); };

  const handleInvoiceClick = (lead) => {
    const realItems = (lead.productList || []).filter(it => it.name?.trim());
    if (realItems.length > 1) {
      setPickerLead(lead);
    } else {
      setInvoiceItems(null); // let InvoiceModal resolve items from lead directly
      setInvoiceLead(lead);
    }
  };

  const handlePickerConfirm = (items) => {
    setInvoiceItems(items);
    setInvoiceLead({ ...pickerLead, productList: items });
    setPickerLead(null);
  };

  const handleReorder = (lead) => {
    const newLead = { ...lead, id: undefined, date: new Date().toISOString().split('T')[0], status: 'New Enquiry', followUpDate: '', remarks: `Reorder from ${lead.id}`, history: [], timestamp: Date.now() };
    delete newLead.id;
    addLead(newLead);
    showBanner(`✅ Reorder lead created for ${lead.customerName}`, 'success');
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      let imported = 0;
      lines.slice(1).forEach(line => {
        const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
        const row = {};
        headers.forEach((h, i) => row[h] = vals[i] || '');
        if (!row.customername && !row['customer name']) return;
        addLead({
          customerName: row.customername || row['customer name'] || '',
          contact: row.contact || row.mobile || row.phone || '',
          product: row.product || '',
          city: row.city || '',
          state: row.state || '',
          date: row.date || new Date().toISOString().split('T')[0],
          status: row.status || 'New Enquiry',
          source: row.source || 'Other',
          orderValue: parseFloat(row.ordervalue || row['order value'] || row.value || 0),
          remarks: row.remarks || row.notes || '',
          followUpDate: row.followupdate || row['follow up date'] || '',
          productList: [],
          history: [{ status: 'New Enquiry', timestamp: Date.now() }],
        });
        imported++;
      });
      showBanner(`✅ Imported ${imported} leads from CSV`, 'success');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Leads that have at least one invoice and are not fully paid
  const billedLeadIds = new Set(invoiceHistory.map(inv => inv.leadId).filter(Boolean));
  const unpaidBilledLeadIds = new Set(
    invoiceHistory
      .filter(inv => { const l = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv; return l.paymentStatus !== 'Paid'; })
      .map(inv => inv.leadId).filter(Boolean)
  );

  const filtered = leads.filter(l => {
    const s = search.toLowerCase();
    const matchSearch = !search || l.customerName?.toLowerCase().includes(s) || l.product?.toLowerCase().includes(s) || (l.contact || '').includes(s) || l.id?.toLowerCase().includes(s) || l.trackingId?.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || DATA_CONFIG.getStatusGroupStatuses(statusFilter).includes(l.status);
    const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
    let matchTab = true;
    if (activeTab === 'payment') matchTab = unpaidBilledLeadIds.has(l.id);
    if (activeTab === 'dispatch') matchTab = l.status === 'Material Dispatched';
    if (activeTab === 'delivered') matchTab = l.status === 'Material Reached';
    return matchSearch && matchStatus && matchSource && matchTab;
  }).sort((a, b) => {
    const toDate = (str) => {
      if (!str) return new Date(0);
      if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        const [d, m, y] = str.split('-');
        return new Date(`${y}-${m}-${d}`);
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? new Date(0) : d;
    };
    const dateDiff = toDate(b.date) - toDate(a.date);
    if (dateDiff !== 0) return dateDiff;
    
    const getNum = (id) => {
      const match = String(id || '').match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    const idDiff = getNum(b.id) - getNum(a.id);
    return idDiff !== 0 ? idDiff : (b.timestamp || 0) - (a.timestamp || 0);
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this lead?')) { deleteLead(id); showBanner('Lead deleted.', 'info'); }
  };

  const payColor = (ps) => ps === 'Paid' ? '#10b981' : ps === 'Partial' ? '#f59e0b' : '#ef4444';

  if (detailsLeadId) return <LeadDetails leadId={detailsLeadId} onBack={() => setDetailsLeadId(null)} onEdit={openEdit} />;

  return (
    <div className="page-section">
      <div className="section-header">
        <h2 className="section-title">Leads Tracker</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          <button className="btn btn-secondary" onClick={() => csvRef.current?.click()}><Upload size={14} /> Import CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> New Lead</button>
        </div>
      </div>

      {/* Tabs with live counts */}
      <div className="tabs">
        {[
          { id: 'all', label: 'All', count: leads.length },
          { id: 'payment', label: 'Pending Payment', count: unpaidBilledLeadIds.size },
          { id: 'dispatch', label: 'In Transit', count: leads.filter(l => l.status === 'Material Dispatched').length },
          { id: 'delivered', label: 'Delivered', count: leads.filter(l => l.status === 'Material Reached').length },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
            {t.count > 0 && <span style={{ marginLeft: 5, background: activeTab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--primary-light)', color: activeTab === t.id ? '#fff' : 'var(--primary)', borderRadius: 999, padding: '0 5px', fontSize: '0.65rem', fontWeight: 700 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." style={{ paddingLeft: '2rem' }} />
        </div>
        <div style={{ position: 'relative', minWidth: 160 }}>
          <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', zIndex: 1 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ paddingLeft: '2rem' }}>
            {STATUS_FILTERS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ minWidth: 140 }}>
          <option value="all">All Sources</option>
          {DATA_CONFIG.sources.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Date</th><th>Customer</th><th>Product</th>
              <th>Dispatch</th><th>Status</th><th>Value (₹)</th><th>Follow-up</th><th>Remarks</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-dim)' }}>No leads found</td></tr>
            )}
            {filtered.map(lead => (
              <tr key={lead.id}>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{lead.id}</td>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{normalizeDisplayDate(lead.date)}</td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => openCustomer360({ name: lead.customerName, contact: lead.contact, city: lead.city })}
                    title="View Customer 360">
                    {lead.customerName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{lead.contact}{lead.city ? ` | ${lead.city}` : ''}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{lead.product}</div>
                  {lead.productList?.length > 1 && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{lead.productList.length} items</div>}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 110 }}>
                    <input className="table-inline-input"
                      key={lead.id + '-dm-' + lead.dispatchMethod}
                      defaultValue={lead.dispatchMethod || ''} placeholder="Courier"
                      onBlur={e => { if (e.target.value !== (lead.dispatchMethod || '')) updateLead(lead.id, { dispatchMethod: e.target.value }); }} />
                    <input className="table-inline-input"
                      key={lead.id + '-tid-' + lead.trackingId}
                      defaultValue={lead.trackingId || ''} placeholder="AWB #" style={{ fontFamily: 'monospace' }}
                      onBlur={e => { if (e.target.value !== (lead.trackingId || '')) updateLead(lead.id, { trackingId: e.target.value }); }} />
                    <input type="date" className="table-inline-input"
                      key={lead.id + '-dd-' + lead.dispatchDate}
                      defaultValue={lead.dispatchDate || ''} title="Dispatch Date" style={{ fontSize: '0.68rem' }}
                      onChange={e => updateLead(lead.id, { dispatchDate: e.target.value })} />
                  </div>
                </td>
                <td>
                  <div style={{ minWidth: 155 }}>
                    {(() => {
                      const simpleStatus = DATA_CONFIG.getSimpleStatusLabel(lead.status);
                      return (
                        <select className="table-inline-select" value={simpleStatus} onChange={e => {
                          const resolved = DATA_CONFIG.resolveStatusFromSimple(e.target.value);
                          updateLeadStatus(lead.id, resolved);
                          showBanner(`✅ ${lead.id} → ${e.target.value}`, 'success');
                        }}>
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      );
                    })()}
                    <div style={{ fontSize: '0.68rem', color: payColor(lead.paymentStatus), marginTop: 3 }}>● {lead.paymentStatus || 'Pending'}</div>
                    {DATA_CONFIG.getLostStatusLabels().includes(lead.status) || DATA_CONFIG.getSimpleStatusLabel(lead.status) === 'Lost' ? (
                      <input className="table-inline-input"
                        key={lead.id + '-lr-' + (lead.lostReason || '')}
                        defaultValue={lead.lostReason || ''} placeholder="Lost reason"
                        onBlur={e => { if (e.target.value !== (lead.lostReason || '')) updateLead(lead.id, { lostReason: e.target.value }); }}
                        style={{ marginTop: 3, background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }} />
                    ) : null}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '0.4rem', padding: '0 0.35rem', minWidth: 100 }}>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>₹</span>
                    <input type="number" className="table-inline-input"
                      key={lead.id + '-val-' + lead.orderValue}
                      defaultValue={lead.orderValue || 0}
                      onBlur={e => updateLead(lead.id, { orderValue: parseFloat(e.target.value) || 0 })}
                      style={{ border: 'none', padding: '0.3rem 0', background: 'transparent', fontWeight: 600, textAlign: 'right' }} />
                  </div>
                </td>
                <td style={{ minWidth: 120 }}>
                  <input type="date" className="table-inline-input" value={lead.followUpDate || ''}
                    onChange={e => updateLead(lead.id, { followUpDate: e.target.value })}
                    style={{ fontSize: '0.72rem', color: lead.followUpDate && lead.followUpDate < new Date().toISOString().split('T')[0] ? '#ef4444' : undefined }} />
                </td>
                <td style={{ maxWidth: 180 }}>
                  <input className="table-inline-input"
                    key={lead.id + '-rem-' + (lead.remarks || '').slice(0,10)}
                    defaultValue={lead.remarks || ''} placeholder="Remarks"
                    onBlur={e => { if (e.target.value !== (lead.remarks || '')) updateLead(lead.id, { remarks: e.target.value }); }} />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <button className="btn-icon" style={{ color: '#25d366' }} title="WhatsApp" onClick={() => window.open(`https://wa.me/91${lead.contact}`)}>
                      <MessageCircle size={14} />
                    </button>
                    <button className="btn-icon" style={{ color: '#3b82f6' }} title="View" onClick={() => setDetailsLeadId(lead.id)}>
                      <Eye size={14} />
                    </button>
                    <button className="btn-icon" style={{ color: 'var(--primary)' }} title="Edit" onClick={() => openEdit(lead.id)}>
                      <Edit3 size={14} />
                    </button>
                    <button className="btn-icon" style={{ color: '#f59e0b' }} title="Generate Invoice" onClick={() => handleInvoiceClick(lead)}>
                      <FileText size={14} />
                    </button>
                    <button className="btn-icon" style={{ color: '#ef4444' }} title="Delete" onClick={() => handleDelete(lead.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <LeadModal leadId={modalLeadId} onClose={() => setShowModal(false)} />}
      {pickerLead && <ProductPicker lead={pickerLead} onConfirm={handlePickerConfirm} onClose={() => setPickerLead(null)} />}
      {invoiceLead && (
        <InvoiceModal
          leadId={invoiceLead.id}
          invoice={null}
          initialItems={invoiceItems}
          onClose={() => { setInvoiceLead(null); setInvoiceItems(null); }}
        />
      )}
    </div>
  );
}
