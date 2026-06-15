import { useState } from 'react';
import { MessageCircle, X, Upload, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';
import { fsSetLead } from '../services/firestoreService';

export default function BulkTools() {
  const { leads, messageTemplates, companySettings, updateLeadStatus, updateLead, deleteLead, showBanner, updateInvoiceField, invoiceHistory } = useApp();
  const [selected, setSelected] = useState(new Set());
  const [newStatus, setNewStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [msgModal, setMsgModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const STATUS_FILTERS = DATA_CONFIG.getStatusFilterOptions();
  const STATUS_OPTIONS = DATA_CONFIG.getSimpleStatusOptions();
  const [bulkMessage, setBulkMessage] = useState('');

  // Excel Recovery States
  const [fileLeads, setFileLeads] = useState([]);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const [masterSelections, setMasterSelections] = useState({});

  const normalizeContact = (raw) => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return digits.slice(-10);
  };

  // Group leads by normalized contact numbers to find duplicates
  const groupedContacts = {};
  leads.forEach(l => {
    const norm = normalizeContact(l.contact);
    if (!norm || norm.length < 10) return;
    if (!groupedContacts[norm]) groupedContacts[norm] = [];
    groupedContacts[norm].push(l);
  });

  const duplicateGroups = Object.entries(groupedContacts)
    .filter(([, group]) => group.length > 1)
    .map(([contact, group]) => ({ contact, group }));

  const handleMerge = async (contact, group) => {
    const masterId = masterSelections[contact] || group[0].id;
    const masterLead = group.find(l => l.id === masterId);
    const duplicates = group.filter(l => l.id !== masterId);

    if (!window.confirm(`Are you sure you want to merge these duplicate leads into ${masterLead.customerName} (${masterLead.id})? This will combine products, remarks, and update invoices.`)) {
      return;
    }

    try {
      // 1. Combine product rows
      const masterProds = masterLead.productList?.length 
        ? masterLead.productList 
        : [{ name: masterLead.product, qty: 1, price: masterLead.orderValue, gst: '5', hsn: '' }];
      
      let mergedProducts = [...masterProds];
      duplicates.forEach(d => {
        const dProds = d.productList?.length 
          ? d.productList 
          : [{ name: d.product, qty: 1, price: d.orderValue, gst: '5', hsn: '' }];
        mergedProducts = [...mergedProducts, ...dProds];
      });

      // Remove empty or placeholder items
      mergedProducts = mergedProducts.filter(p => p.name?.trim());

      // 2. Recalculate combined order value
      const newOrderValue = mergedProducts.reduce((sum, p) => {
        const base = (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 0);
        const tax = base * ((parseFloat(p.gst) || 0) / 100);
        return sum + base + tax;
      }, 0);

      // 3. Combine remarks
      const combinedRemarks = [
        masterLead.remarks,
        ...duplicates.map(d => d.remarks)
      ].filter(Boolean).join('\n---\n');

      // 4. Combine history logs chronologically
      let combinedHistory = [...(masterLead.history || [])];
      duplicates.forEach(d => {
        combinedHistory = [...combinedHistory, ...(d.history || [])];
      });
      combinedHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      combinedHistory.push({
        status: masterLead.status,
        // eslint-disable-next-line react-hooks/purity
        timestamp: Date.now(),
        note: `Merged duplicate leads: ${duplicates.map(d => d.id).join(', ')}`
      });

      // 5. Fallback fields (if master doesn't have it, but one of duplicates does)
      const updates = {
        productList: mergedProducts,
        product: mergedProducts.map(p => p.name).join(', '),
        orderValue: parseFloat(newOrderValue.toFixed(2)),
        remarks: combinedRemarks,
        history: combinedHistory,
        city: masterLead.city || duplicates.find(d => d.city)?.city || '',
        state: masterLead.state || duplicates.find(d => d.state)?.state || '',
        gst: masterLead.gst || duplicates.find(d => d.gst)?.gst || '',
        source: masterLead.source || duplicates.find(d => d.source)?.source || 'Other',
      };

      // 6. Update master lead
      await updateLead(masterLead.id, updates);

      // 7. Update any invoices pointing to deleted duplicates
      const deletedIds = new Set(duplicates.map(d => d.id));
      const linkedInvoices = invoiceHistory.filter(inv => deletedIds.has(inv.leadId));
      for (const inv of linkedInvoices) {
        await updateInvoiceField(inv.invoiceNumber, 'leadId', masterLead.id);
      }

      // 8. Delete duplicate leads
      for (const d of duplicates) {
        await deleteLead(d.id);
      }

      showBanner(`✅ Merged duplicate group into ${masterLead.id}!`, 'success');
    } catch (err) {
      console.error(err);
      showBanner(`❌ Merge failed: ${err.message}`, 'error');
    }
  };

  const parseExcelDate = (val) => {
    if (!val) return '';
    if (val instanceof Date) {
      const day = String(val.getDate()).padStart(2, '0');
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const year = val.getFullYear();
      return `${year}-${month}-${day}`;
    }
    const str = String(val).trim();
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    return str;
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRestoreStatus('Reading Excel file...');
    try {
      const ExcelJS = (await import('exceljs')).default;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.worksheets.find(w => w.name === 'Leads') || workbook.worksheets[0];
      if (!worksheet) {
        setRestoreStatus('❌ Error: No worksheets found in Excel file');
        return;
      }

      setRestoreStatus(`Parsing sheet "${worksheet.name}"...`);
      
      const parsedRows = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header row
        const values = row.values;
        if (!values || values.length < 3) return;
        
        parsedRows.push({
          date: parseExcelDate(values[1]),
          id: String(values[2] || '').trim(),
          customerName: String(values[3] || '').trim(),
          contact: normalizeContact(values[4]),
          city: String(values[5] || '').trim(),
          state: String(values[6] || '').trim(),
          source: String(values[7] || 'IndiaMART Direct').trim(),
          gstNo: String(values[8] || '').trim(),
          productName: String(values[9] || '').trim(),
          qty: parseFloat(values[10]) || 1,
          unitPrice: parseFloat(values[11]) || 0,
          subtotal: parseFloat(values[12]) || 0,
          totalValue: parseFloat(values[13]) || 0,
          status: String(values[14] || 'New Enquiry').trim(),
          followUpDate: parseExcelDate(values[15]),
          lostReason: String(values[16] || '').trim(),
          remarks: String(values[17] || '').trim()
        });
      });

      if (parsedRows.length === 0) {
        setRestoreStatus('❌ Error: No lead rows found in the sheet');
        return;
      }

      // Group by ID
      const groupedLeads = {};
      parsedRows.forEach(row => {
        if (!row.id) return;
        if (!groupedLeads[row.id]) {
          groupedLeads[row.id] = {
            id: row.id,
            date: row.date,
            customerName: row.customerName,
            contact: row.contact,
            city: row.city,
            state: row.state,
            source: row.source,
            gst: row.gstNo,
            status: row.status,
            followUpDate: row.followUpDate,
            lostReason: row.lostReason,
            remarks: row.remarks,
            orderValue: 0,
            timestamp: Date.now(),
            productList: []
          };
        }
        
        groupedLeads[row.id].productList.push({
          name: row.productName || 'IndiaMART Enquiry',
          qty: row.qty,
          price: row.unitPrice,
          gst: '5',
          hsn: ''
        });
        groupedLeads[row.id].orderValue += row.subtotal || (row.qty * row.unitPrice) || 0;
      });

      const finalLeads = Object.values(groupedLeads);
      setFileLeads(finalLeads);
      setRestoreStatus(`✔️ Successfully loaded ${finalLeads.length} leads from Excel file. Review the preview below and click "Restore Leads" to save.`);
    } catch (err) {
      console.error(err);
      setRestoreStatus(`❌ Error parsing Excel: ${err.message}`);
    }
  };

  const handleRestoreSubmit = async () => {
    if (fileLeads.length === 0) return;
    setIsRestoring(true);
    setRestoreStatus(`Restoring ${fileLeads.length} leads to database...`);
    try {
      let successCount = 0;
      for (const lead of fileLeads) {
        await fsSetLead({
          ...lead,
          history: [{ status: lead.status, timestamp: Date.now(), note: 'Restored from Excel' }]
        });
        successCount++;
        setRestoreStatus(`Restoring leads... (${successCount}/${fileLeads.length})`);
      }
      setRestoreStatus(`✅ Successfully restored ${successCount} leads into your database!`);
      showBanner(`Restored ${successCount} leads from Excel backup!`, 'success');
      setFileLeads([]);
    } catch (err) {
      console.error(err);
      setRestoreStatus(`❌ Error writing to database: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };


  const filtered = leads.filter(l => {
    const s = search.toLowerCase();
    const matchS = !search || l.customerName?.toLowerCase().includes(s) || (l.contact || '').includes(s);
    const matchF = statusFilter === 'all' || DATA_CONFIG.getStatusGroupStatuses(statusFilter).includes(l.status);
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

  const bulkDeleteLeads = () => {
    if (!selected.size) return;
    if (!window.confirm(`Are you sure you want to delete ${selected.size} selected leads?`)) return;
    selected.forEach(id => deleteLead(id));
    showBanner(`🗑️ Deleted ${selected.size} leads`, 'success');
    setSelected(new Set());
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
        <button className="btn btn-danger" onClick={bulkDeleteLeads} disabled={!selected.size} style={{ background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>🗑️ Delete Selected ({selected.size})</button>
      </div>

      {/* Bulk actions */}
      <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ marginBottom: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulk Actions</h4>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>NEW STATUS</label>
            <select value={newStatus} onChange={e => setNewStatus(DATA_CONFIG.resolveStatusFromSimple(e.target.value))}>
              <option value="">Select status...</option>
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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

      {/* Excel Restore & Recovery Tool */}
      <div className="glass-card" style={{ marginBottom: '1.25rem', border: '1px solid rgba(16,185,129,0.3)' }}>
        <h4 style={{ marginBottom: '0.5rem', color: '#10b981', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📂 Restore & Recover Leads from Excel
        </h4>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          Restore and merge historical leads directly from an Excel report (e.g. <code>Indimart_CRM_Report_2026-05-27.xlsx</code>) using their original Lead IDs.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input 
            type="file" 
            accept=".xlsx" 
            onChange={handleExcelUpload} 
            style={{ display: 'none' }} 
            id="excel-restore-input" 
          />
          <label 
            htmlFor="excel-restore-input" 
            className="btn btn-secondary" 
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Upload size={14} /> Select Excel Report
          </label>
          
          {fileLeads.length > 0 && (
            <button 
              className="btn btn-primary" 
              onClick={handleRestoreSubmit} 
              disabled={isRestoring}
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none' }}
            >
              <CheckCircle size={14} /> {isRestoring ? 'Restoring...' : `Restore ${fileLeads.length} Leads`}
            </button>
          )}
        </div>

        {restoreStatus && (
          <div style={{ 
            fontSize: '0.78rem', 
            background: 'rgba(0,0,0,0.15)', 
            padding: '0.75rem', 
            borderRadius: '0.4rem', 
            border: '1px solid var(--glass-border)',
            color: restoreStatus.startsWith('❌') ? '#fca5a5' : restoreStatus.startsWith('✅') || restoreStatus.startsWith('✔️') ? '#a7f3d0' : 'var(--text-dim)'
          }}>
            {restoreStatus}
          </div>
        )}

        {fileLeads.length > 0 && (
          <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '0.4rem' }}>
            <table style={{ margin: 0, fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th>Lead ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {fileLeads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{lead.id}</td>
                    <td>{lead.date}</td>
                    <td style={{ fontWeight: 600 }}>{lead.customerName}</td>
                    <td>{lead.contact}</td>
                    <td>{lead.status}</td>
                    <td>{lead.productList.map(p => `${p.name} (x${p.qty})`).join(', ')}</td>
                    <td style={{ fontWeight: 600 }}>₹{lead.orderValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 👯‍♂️ Duplicate Lead Merging */}
      <div className="glass-card" style={{ marginBottom: '1.25rem', border: '1px solid rgba(139,92,246,0.3)' }}>
        <h4 style={{ marginBottom: '0.5rem', color: '#8b5cf6', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          👯‍♂️ Duplicate Lead Merging &amp; Deduplication
        </h4>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          Identify leads sharing the same normalized contact number. Merge them to consolidate product lists, order values, chronological histories, and update invoice links.
        </p>

        {duplicateGroups.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: '#10b981', padding: '0.5rem 0', fontWeight: 600 }}>
            ✓ No duplicate leads detected in your current database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {duplicateGroups.map(({ contact, group }) => {
              const currentMasterId = masterSelections[contact] || group[0].id;
              return (
                <div key={contact} style={{ border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      📞 Group: {contact} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({group.length} duplicates)</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Master Lead:</span>
                      <select 
                        value={currentMasterId} 
                        onChange={e => setMasterSelections(prev => ({ ...prev, [contact]: e.target.value }))}
                        style={{ fontSize: '0.75rem', padding: '2px 8px', minWidth: 120 }}
                      >
                        {group.map(l => (
                          <option key={l.id} value={l.id}>{l.id} - {l.customerName}</option>
                        ))}
                      </select>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none' }}
                        onClick={() => handleMerge(contact, group)}
                      >
                        Merge Group
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ margin: 0, fontSize: '0.72rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <th style={{ width: 60 }}>Role</th>
                          <th>Lead ID</th>
                          <th>Date</th>
                          <th>Customer Name</th>
                          <th>Product(s)</th>
                          <th>Status</th>
                          <th>Value</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map(lead => {
                          const isMaster = lead.id === currentMasterId;
                          return (
                            <tr key={lead.id} style={{ background: isMaster ? 'rgba(139,92,246,0.05)' : undefined }}>
                              <td style={{ fontWeight: 700, color: isMaster ? '#8b5cf6' : 'var(--text-dim)' }}>
                                {isMaster ? '★ MASTER' : 'DUPLICATE'}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{lead.id}</td>
                              <td>{lead.date}</td>
                              <td style={{ fontWeight: 600 }}>{lead.customerName}</td>
                              <td>{lead.product || lead.productList?.map(p => p.name).join(', ')}</td>
                              <td>
                                <span className="status-dot" style={{ background: DATA_CONFIG.getStatusColor(lead.status), marginRight: 4 }} />
                                {DATA_CONFIG.getSimpleStatusLabel(lead.status)}
                              </td>
                              <td style={{ fontWeight: 600 }}>₹{(lead.orderValue || 0).toLocaleString()}</td>
                              <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.remarks}>{lead.remarks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters + quick select */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, minWidth: 150 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 160 }}>
          {STATUS_FILTERS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={selectAll}>Select All ({filtered.length})</button>
        <button className="btn btn-secondary" onClick={() => selectByStatus(DATA_CONFIG.resolveStatusFromSimple('Won'))}>Select Won</button>
        <button className="btn btn-secondary" onClick={() => selectByStatus(DATA_CONFIG.resolveStatusFromSimple('Quoted'))}>Select Quoted</button>
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
                  {DATA_CONFIG.getSimpleStatusLabel(l.status)}
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
