import { useState, useRef } from 'react';
import { Plus, Search, Eye, FileText, Edit3, Trash2, MessageCircle, Filter, Upload, FolderPlus, Link, X, LayoutGrid, List, Phone, MapPin, Calendar, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAppUI } from '../context/AppUIContext';
import { DATA_CONFIG, normalizeDisplayDate } from '../utils/dataConfig';
import LeadModal from '../components/LeadModal';
import LeadDetails from '../components/LeadDetails';
import ProductPicker from '../components/ProductPicker';
import InvoiceModal from '../components/InvoiceModal';

export default function Leads() {
  const { leads, invoiceHistory, updateLeadStatus, updateLead, deleteLead, addLead, showBanner, products, addProduct, companySettings, saveSettings } = useApp();
  const { openCustomer360 } = useAppUI();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [modalLeadId, setModalLeadId] = useState(undefined);
  const [showModal, setShowModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [prevFilters, setPrevFilters] = useState({ search, statusFilter, sourceFilter, activeTab });

  if (search !== prevFilters.search || statusFilter !== prevFilters.statusFilter || sourceFilter !== prevFilters.sourceFilter || activeTab !== prevFilters.activeTab) {
    setPrevFilters({ search, statusFilter, sourceFilter, activeTab });
    setVisibleCount(50);
  }

  const STATUS_FILTERS = DATA_CONFIG.getStatusFilterOptions();
  const STATUS_OPTIONS = DATA_CONFIG.getSimpleStatusOptions();
  const [detailsLeadId, setDetailsLeadId] = useState(null);
  const [pickerLead, setPickerLead] = useState(null);
  const [invoiceLead, setInvoiceLead] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState(null);
  const [quickAddProduct, setQuickAddProduct] = useState(null);
  const [linkProductContext, setLinkProductContext] = useState(null);
  const csvRef = useRef(null);

  const getAvatarColor = (name) => {
    const colors = [
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #f59e0b, #b45309)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #06b6d4, #0e7490)'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  const handleQuickAddProduct = (name, price = 0, hsn = '', gst = '5') => {
    setQuickAddProduct({ name, price, hsn, gst });
  };

  const handleQuickAddSave = (productData, newCustomCategory) => {
    if (newCustomCategory) {
      const currentCustom = companySettings.customCategories || [];
      if (!currentCustom.includes(newCustomCategory)) {
        saveSettings({
          ...companySettings,
          customCategories: [...currentCustom, newCustomCategory]
        });
      }
    }
    addProduct(productData);
    showBanner(`Product "${productData.name}" added to catalog.`, 'success');
    setQuickAddProduct(null);
  };

  const handleLinkProductConfirm = (leadId, itemIdx, selectedProductName) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    if (itemIdx === -1) {
      updateLead(leadId, { linkedProduct: selectedProductName });
    } else {
      const newList = [...(lead.productList || [])];
      if (newList[itemIdx]) {
        newList[itemIdx] = { ...newList[itemIdx], linkedProduct: selectedProductName };
      }
      updateLead(leadId, { productList: newList });
    }
    showBanner('Enquiry product mapped to catalog successfully.', 'success');
    setLinkProductContext(null);
  };

  const handleUnlinkProduct = (leadId, itemIdx) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    if (itemIdx === -1) {
      updateLead(leadId, { linkedProduct: null });
    } else {
      const newList = [...(lead.productList || [])];
      if (newList[itemIdx]) {
        const itemCopy = { ...newList[itemIdx] };
        delete itemCopy.linkedProduct;
        newList[itemIdx] = itemCopy;
      }
      updateLead(leadId, { productList: newList });
    }
    showBanner('Mapping removed.', 'info');
  };

  const openAdd = () => { setModalLeadId(undefined); setShowModal(true); };
  const openEdit = (id) => { setModalLeadId(id); setShowModal(true); };

  const handleInvoiceClick = (lead) => {
    setPickerLead(lead);
  };

  const handlePickerConfirm = (items) => {
    setInvoiceItems(items);
    setInvoiceLead({ ...pickerLead, productList: items });
    setPickerLead(null);
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
          city: row.city || '', state: row.state || '',
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

  const normC = (raw) => {
    if (!raw) return '';
    const d = String(raw).replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) return d.slice(2);
    return d.slice(-10);
  };

  const leadCountsByContact = {};
  leads.forEach(l => {
    const key = normC(l.contact) || l.customerName?.trim();
    if (key) {
      leadCountsByContact[key] = (leadCountsByContact[key] || 0) + 1;
    }
  });
  const unpaidBilledLeadIds = new Set(
    invoiceHistory
      .filter(inv => {
        const l = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
        return l.paymentStatus !== 'Paid';
      })
      .map(inv => {
        const lead = DATA_CONFIG.getLeadForInvoice(inv, leads);
        return lead ? lead.id : null;
      })
      .filter(Boolean)
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
      const clean = String(str).trim();
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        const [d, m, y] = clean.split('-');
        return new Date(`${y}-${m}-${d}`);
      }
      const parsed = new Date(clean);
      return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    };
    const dateDiff = toDate(b.date) - toDate(a.date);
    if (dateDiff !== 0) return dateDiff;
    
    const timeDiff = (b.timestamp || 0) - (a.timestamp || 0);
    if (timeDiff !== 0) return timeDiff;

    const getNum = (id) => {
      const match = String(id || '').match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return getNum(b.id) - getNum(a.id);
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this lead?')) { deleteLead(id); showBanner('Lead deleted.', 'info'); }
  };

  const payColor = (ps) => ps === 'Paid' ? '#10b981' : ps === 'Partial' ? '#f59e0b' : '#ef4444';

  const [viewMode, setViewMode] = useState('list');

  if (detailsLeadId) return <LeadDetails leadId={detailsLeadId} onBack={() => setDetailsLeadId(null)} onEdit={openEdit} />;

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">👥 Leads Tracker</h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} leads
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View switcher on desktop */}
          <div className="desktop-only" style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '0.6rem', padding: 3, marginRight: '0.5rem' }}>
            <button 
              className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setViewMode('list')} 
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', border: 'none', minHeight: 32, borderRadius: '0.45rem', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <List size={13} /> List
            </button>
            <button 
              className={`btn ${viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setViewMode('kanban')} 
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', border: 'none', minHeight: 32, borderRadius: '0.45rem', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <LayoutGrid size={13} /> Kanban
            </button>
          </div>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          <button className="btn btn-secondary desktop-only" onClick={() => csvRef.current?.click()} style={{ fontSize: '0.82rem' }}>
            <Upload size={14} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: '0.82rem' }}>
            <Plus size={15} /> New Lead
          </button>
        </div>
      </div>

      {/* Tabs with pill counts */}
      <div className="tabs">
        {[
          { id: 'all', label: 'All Leads', count: leads.length },
          { id: 'payment', label: 'Pending Payment', count: unpaidBilledLeadIds.size },
          { id: 'dispatch', label: 'In Transit', count: leads.filter(l => l.status === 'Material Dispatched').length },
          { id: 'delivered', label: 'Delivered', count: leads.filter(l => l.status === 'Material Reached').length },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
            {t.count > 0 && (
              <span style={{ 
                marginLeft: 6, 
                background: activeTab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--primary-light)', 
                color: activeTab === t.id ? '#fff' : 'var(--primary)', 
                borderRadius: 999, 
                padding: '1px 6px', 
                fontSize: '0.68rem', 
                fontWeight: 800 
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search & Filter bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, product, phone or ID..." style={{ paddingLeft: '2.25rem' }} />
        </div>
        <div style={{ position: 'relative', minWidth: 140 }}>
          <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', zIndex: 1 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ paddingLeft: '2.25rem' }}>
            {STATUS_FILTERS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <select className="desktop-only" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ minWidth: 130 }}>
          <option value="all">All Sources</option>
          {DATA_CONFIG.sources.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── MOBILE TOUCH CARDS (Shown on mobile screens) ── */}
      <div className="mobile-only">
        {filtered.length === 0 && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
            No leads matching your filters
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.slice(0, visibleCount).map(lead => (
            <div 
              key={lead.id} 
              className="glass-card"
              style={{
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                borderLeft: `4px solid ${DATA_CONFIG.getStatusColor(lead.status)}`,
              }}
            >
              {/* Card Header: Avatar + Customer Name + Date + WhatsApp quick button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: getAvatarColor(lead.customerName),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}>
                    {(lead.customerName || 'U')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div 
                      style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-main)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      onClick={() => openCustomer360({ name: lead.customerName, contact: lead.contact, city: lead.city })}
                    >
                      {lead.customerName}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: 2 }}>
                      <span>{normalizeDisplayDate(lead.date)}</span>
                      {lead.city && <span>• {lead.city}</span>}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => window.open(`https://wa.me/91${lead.contact}`)}
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
                    flexShrink: 0
                  }}
                >
                  <MessageCircle size={14} /> <span>Chat</span>
                </button>
              </div>

              {/* Product enquiry & value */}
              <div style={{ background: 'var(--bg-input)', padding: '0.65rem 0.75rem', borderRadius: '0.65rem', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{lead.product || 'No product specified'}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>₹{(lead.orderValue || 0).toLocaleString()}</span>
                </div>
                {lead.contact && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={11} /> <span>+91 {lead.contact}</span>
                  </div>
                )}
              </div>

              {/* Status Picker & Follow-up Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 3, fontWeight: 700 }}>STATUS</label>
                  <select 
                    value={DATA_CONFIG.getSimpleStatusLabel(lead.status)}
                    onChange={e => {
                      const resolved = DATA_CONFIG.resolveStatusFromSimple(e.target.value);
                      updateLeadStatus(lead.id, resolved);
                      showBanner(`✅ Updated status to ${e.target.value}`, 'success');
                    }}
                    style={{ fontSize: '0.82rem', padding: '0.5rem 0.6rem', minHeight: 38 }}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 3, fontWeight: 700 }}>FOLLOW-UP</label>
                  <input 
                    type="date"
                    value={lead.followUpDate || ''}
                    onChange={e => updateLead(lead.id, { followUpDate: e.target.value })}
                    style={{ fontSize: '0.82rem', padding: '0.5rem 0.6rem', minHeight: 38 }}
                  />
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--glass-border)', paddingTop: '0.65rem', marginTop: 2 }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setDetailsLeadId(lead.id)}
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', minHeight: 34, gap: 4 }}
                >
                  <Eye size={13} /> View
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => openEdit(lead.id)}
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', minHeight: 34, gap: 4 }}
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleInvoiceClick(lead)}
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', minHeight: 34, gap: 4, color: '#f59e0b' }}
                >
                  <FileText size={13} /> Invoice
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDelete(lead.id)}
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem', minHeight: 34 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DESKTOP VIEW (Shown on wide screens) ── */}
      <div className="desktop-only">
        {viewMode === 'list' ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Customer</th>
                  <th>Product Enquiry</th>
                  <th>Dispatch</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Follow-up</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>No leads matching your filters</td></tr>
                )}
                {filtered.slice(0, visibleCount).map(lead => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{lead.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                      {normalizeDisplayDate(lead.date)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: getAvatarColor(lead.customerName),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 800, fontSize: '0.78rem', flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          {(lead.customerName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span 
                              style={{ fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.88rem' }}
                              onClick={() => openCustomer360({ name: lead.customerName, contact: lead.contact, city: lead.city })}
                              title="Open Customer 360"
                            >
                              {lead.customerName}
                            </span>
                            {(() => {
                              const key = normC(lead.contact) || lead.customerName?.trim();
                              const count = leadCountsByContact[key] || 1;
                              if (count > 1) {
                                return (
                                  <span style={{ fontSize: '0.62rem', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '1px 6px', borderRadius: 999, fontWeight: 800, border: '1px solid rgba(59,130,246,0.3)' }}>
                                    Repeat ({count})
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 1 }}>
                            {lead.contact}{lead.city ? ` • ${lead.city}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{lead.product}</span>
                          {!lead.linkedProduct && !lead.productList?.length && lead.product && (
                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                              {!products.some(p => p.name === lead.product.trim()) && (
                                <button 
                                  type="button"
                                  className="btn-icon" 
                                  style={{ color: '#10b981', padding: 2, minWidth: 24, minHeight: 24 }} 
                                  title="Add to Product Catalog"
                                  onClick={() => handleQuickAddProduct(lead.product)}
                                >
                                  <FolderPlus size={13} />
                                </button>
                              )}
                              <button 
                                type="button"
                                className="btn-icon" 
                                style={{ color: '#3b82f6', padding: 2, minWidth: 24, minHeight: 24 }} 
                                title="Link to Catalog Product"
                                onClick={() => setLinkProductContext({ leadId: lead.id, itemIdx: -1, currentName: lead.product })}
                              >
                                <Link size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                        {lead.linkedProduct && (
                          <div style={{ fontSize: '0.7rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                            <span>Linked: <strong>{lead.linkedProduct}</strong></span>
                            <button 
                              type="button"
                              className="btn-icon" 
                              style={{ color: '#3b82f6', padding: 1, minWidth: 20, minHeight: 20 }} 
                              title="Change mapping"
                              onClick={() => setLinkProductContext({ leadId: lead.id, itemIdx: -1, currentName: lead.product })}
                            >
                              <Link size={10} />
                            </button>
                            <button 
                              type="button"
                              className="btn-icon" 
                              style={{ color: '#ef4444', padding: 1, minWidth: 20, minHeight: 20 }} 
                              title="Remove mapping"
                              onClick={() => handleUnlinkProduct(lead.id, -1)}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                      </div>
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
                      <div style={{ minWidth: 145 }}>
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
                        <div style={{ fontSize: '0.7rem', color: payColor(lead.paymentStatus), marginTop: 3, fontWeight: 700 }}>
                          ● {lead.paymentStatus || 'Pending'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0 0.4rem', minWidth: 100 }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>₹</span>
                        <input type="number" className="table-inline-input"
                          key={lead.id + '-val-' + lead.orderValue}
                          defaultValue={lead.orderValue || 0}
                          onBlur={e => updateLead(lead.id, { orderValue: parseFloat(e.target.value) || 0 })}
                          style={{ border: 'none', padding: '0.35rem 0', background: 'transparent', fontWeight: 700, textAlign: 'right' }} />
                      </div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <input type="date" className="table-inline-input" value={lead.followUpDate || ''}
                        onChange={e => updateLead(lead.id, { followUpDate: e.target.value })}
                        style={{ fontSize: '0.75rem', color: lead.followUpDate && lead.followUpDate < new Date().toISOString().split('T')[0] ? '#ef4444' : undefined, fontWeight: 600 }} />
                    </td>
                    <td style={{ maxWidth: 180 }}>
                      <input className="table-inline-input"
                        key={lead.id + '-rem-' + (lead.remarks || '').slice(0,10)}
                        defaultValue={lead.remarks || ''} placeholder="Remarks..."
                        onBlur={e => { if (e.target.value !== (lead.remarks || '')) updateLead(lead.id, { remarks: e.target.value }); }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                        <button className="btn-icon" style={{ color: '#25d366' }} title="WhatsApp" onClick={() => window.open(`https://wa.me/91${lead.contact}`)}>
                          <MessageCircle size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: '#38bdf8' }} title="View Details" onClick={() => setDetailsLeadId(lead.id)}>
                          <Eye size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: 'var(--primary)' }} title="Edit Lead" onClick={() => openEdit(lead.id)}>
                          <Edit3 size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: '#f59e0b' }} title="Create Invoice" onClick={() => handleInvoiceClick(lead)}>
                          <FileText size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: '#ef4444' }} title="Delete Lead" onClick={() => handleDelete(lead.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban View */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem', marginTop: '1rem', alignItems: 'flex-start' }}>
            {STATUS_OPTIONS.map(col => {
              const colLeads = filtered.filter(l => DATA_CONFIG.getSimpleStatusLabel(l.status) === col.value);
              return (
                <div key={col.value} style={{ background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--glass-border)', padding: '1rem', minHeight: '60vh', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '2px solid ' + DATA_CONFIG.getStatusColor(col.value) }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{col.label}</span>
                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 999, fontWeight: 800, color: 'var(--text-dim)' }}>{colLeads.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {colLeads.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1.5rem 0' }}>No leads here</div>}
                    {colLeads.map(lead => (
                      <div 
                        key={lead.id} 
                        className="glass-card" 
                        style={{ padding: '0.9rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '3px solid ' + DATA_CONFIG.getStatusColor(lead.status), cursor: 'pointer' }}
                        onClick={() => setDetailsLeadId(lead.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                          <span style={{ color: 'var(--primary)' }}>{lead.id}</span>
                          <span>₹{(lead.orderValue || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lead.customerName}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{lead.product}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--glass-border)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                          <span>{normalizeDisplayDate(lead.date)}</span>
                          <span>{lead.city || 'Direct'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setVisibleCount(prev => prev + 50)} style={{ padding: '0.65rem 1.5rem', fontSize: '0.85rem' }}>
            Load More Leads ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <LeadModal leadId={modalLeadId} onClose={() => setShowModal(false)} />
      )}
      {pickerLead && (
        <ProductPicker lead={pickerLead} onClose={() => setPickerLead(null)} onConfirm={handlePickerConfirm} />
      )}
      {invoiceLead && (
        <InvoiceModal lead={invoiceLead} initialProducts={invoiceItems} onClose={() => { setInvoiceLead(null); setInvoiceItems(null); }} />
      )}
    </div>
  );
}
