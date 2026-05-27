import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

const EMPTY_ROW = { name: '', qty: 1, price: 0, gst: '5', hsn: '', _lastHint: null };

export default function LeadModal({ leadId, onClose }) {
  const { leads, products, addLead, updateLead, showBanner } = useApp();
  const [autofillToast, setAutofillToast] = useState(false);
  const existing = leadId ? leads.find(l => l.id === leadId) : null;

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customerName: '', contact: '', city: '', state: '', gst: '',
    source: 'IndiaMART Direct', status: 'New Enquiry',
    followUpDate: '', remarks: '', lostReason: '',
  });
  const [productRows, setProductRows] = useState([{ ...EMPTY_ROW }]);
  const [orderValue, setOrderValue] = useState(0);

  useEffect(() => {
    if (existing) {
      setForm({
        date: existing.date?.includes('T') ? existing.date.split('T')[0] : (existing.date || ''),
        customerName: existing.customerName || '',
        contact: existing.contact || '',
        city: existing.city || '',
        state: existing.state || '',
        gst: existing.gst || '',
        source: existing.source || 'IndiaMART Direct',
        status: existing.status || 'New Enquiry',
        followUpDate: existing.followUpDate || '',
        remarks: existing.remarks || '',
        lostReason: existing.lostReason || '',
      });
      if (existing.productList?.length) {
        setProductRows(existing.productList);
      } else {
        setProductRows([{ name: existing.product || '', qty: 1, price: existing.orderValue || 0, gst: '5', hsn: '' }]);
      }
      setOrderValue(existing.orderValue || 0);
    }
  }, [existing]);

  // Recalculate order value when product rows change
  useEffect(() => {
    const total = productRows.reduce((sum, row) => {
      const base = (parseFloat(row.price) || 0) * (parseFloat(row.qty) || 0);
      const tax = base * ((parseFloat(row.gst) || 0) / 100);
      return sum + base + tax;
    }, 0);
    setOrderValue(parseFloat(total.toFixed(2)));
  }, [productRows]);

  const updateRow = (idx, field, value) => {
    setProductRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-fill price from catalog
      if (field === 'name') {
        const catProd = products.find(p => p.name === value);
        if (catProd) {
          updated[idx].price = catProd.price;
          updated[idx].gst = catProd.gst || '5';
          updated[idx].hsn = catProd.hsn || '';
        }
        // Check customer history for last price
        let lastPrice = null;
        const normFn = r => { const d = String(r||'').replace(/\D/g,''); return d.length===12&&d.startsWith('91')?d.slice(2):d.slice(-10)||r.trim(); };
        if (form.contact) {
          const pastLeads = leads.filter(l => normFn(l.contact) === normFn(form.contact) && l.id !== leadId);
          pastLeads.slice().reverse().forEach(l => {
            if (lastPrice !== null) return;
            const items = l.productList || [{ name: l.product, price: l.orderValue }];
            const match = items.find(i => i.name === value);
            if (match) lastPrice = match.price;
          });
          if (lastPrice !== null) {
            updated[idx].price = lastPrice;
            updated[idx]._lastHint = lastPrice;
          } else {
            updated[idx]._lastHint = null;
          }
        }
      }
      return updated;
    });
  };

  const normFn = r => { const d = String(r||'').replace(/\D/g,''); return d.length===12&&d.startsWith('91')?d.slice(2):d.slice(-10)||r.trim(); };
  const autoFill = (phone) => {
    if (!phone || phone.length < 5) return;
    const pastLead = leads.slice().reverse().find(l => normFn(l.contact) === normFn(phone));
    if (pastLead) {
      setForm(f => ({
        ...f,
        customerName: f.customerName || pastLead.customerName,
        city: f.city || pastLead.city || '',
        state: f.state || pastLead.state || '',
        gst: f.gst || pastLead.gst || '',
      }));
      // Pre-fill products from last order if rows are empty
      const firstRowEmpty = productRows.length === 1 && !productRows[0].name;
      if (firstRowEmpty) {
        const lastOrder = leads.slice().reverse().find(l => normFn(l.contact) === normFn(phone) && (l.productList?.length || l.product));
        if (lastOrder) {
          const items = lastOrder.productList?.length ? lastOrder.productList : [{ name: lastOrder.product, qty: 1, price: lastOrder.orderValue, gst: '5', hsn: '' }];
          setProductRows(items);
          setAutofillToast(true);
          setTimeout(() => setAutofillToast(false), 2500);
        }
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const productList = productRows.filter(r => r.name?.trim());
    const baseData = {
      ...form,
      contact: form.contact.trim().replace(/\s+/g, ''), // strip whitespace before save
      productList,
      product: productList.map(p => p.name).join(', '),
      orderValue,
      timestamp: Date.now(),
    };
    if (existing) {
      const oldStatus = existing.status;
      const history = [...(existing.history || [])];
      if (oldStatus !== form.status) {
        history.push({ status: form.status, timestamp: Date.now(), note: `Updated from ${oldStatus}` });
      }
      updateLead(leadId, { ...baseData, history });
      showBanner(`✅ Lead ${leadId} updated.`, 'success');
    } else {
      addLead(baseData);
      showBanner('✅ New lead created!', 'success');
    }
    onClose();
  };

  const isLost = DATA_CONFIG.getLostStatusLabels().includes(form.status);

  // Build unique customer suggestions from existing leads
  const customerSuggestions = [...new Map(leads.map(l => [l.contact, l])).values()];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content wide">
        <div className="modal-header">
          <h2>{existing ? 'Edit Lead' : 'New IndiaMART Enquiry'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {autofillToast && (
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 600, padding: '3px 12px', borderRadius: 20, animation: 'fadeIn 0.2s' }}>
                ✅ Last Order Pre-filled
              </span>
            )}
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Datalists for autocomplete */}
        <datalist id="contact-suggestions">
          {customerSuggestions.map(l => <option key={l.contact} value={l.contact}>{l.customerName}</option>)}
        </datalist>
        <datalist id="name-suggestions">
          {customerSuggestions.map(l => <option key={l.contact} value={l.customerName} />)}
        </datalist>
        <datalist id="city-suggestions">
          {[...new Set(leads.map(l => l.city).filter(Boolean))].map(c => <option key={c} value={c} />)}
        </datalist>

        <form onSubmit={handleSubmit}>
          <div className="form-row three" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Contact (Phone)</label>
              <input type="text" list="contact-suggestions" value={form.contact} onChange={e => { setForm(f => ({ ...f, contact: e.target.value })); autoFill(e.target.value); }} placeholder="10-digit mobile" required />
            </div>
            <div className="form-group">
              <label>Customer Name</label>
              <input type="text" list="name-suggestions" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} required />
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label>City</label>
              <input type="text" list="city-suggestions" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input type="text" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Customer GST</label>
              <input type="text" value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} placeholder="e.g. 29AAKCM6046P1ZN" />
            </div>
            <div className="form-group">
              <label>Source</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {DATA_CONFIG.sources.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Product Rows */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Products</label>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={() => setProductRows(r => [...r, { ...EMPTY_ROW }])}>
                <Plus size={12} /> Add Row
              </button>
            </div>
            {productRows.map((row, idx) => {
              const rowBase = (parseFloat(row.price) || 0) * (parseFloat(row.qty) || 0);
              const rowTax = rowBase * ((parseFloat(row.gst) || 0) / 100);
              const rowTotal = rowBase + rowTax;
              return (
                <div key={idx} style={{ marginBottom: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr 0.7fr 0.8fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <div>
                      <input list="prod-suggestions" placeholder="Product name" value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)} required style={{ width: '100%' }} />
                      {row._lastHint != null && (
                        <div style={{ fontSize: '0.6rem', color: '#f59e0b', marginTop: 2 }}>Last: ₹{Number(row._lastHint).toLocaleString()}</div>
                      )}
                    </div>
                    <input type="number" placeholder="Qty" value={row.qty} onChange={e => updateRow(idx, 'qty', e.target.value)} min="0" step="any" />
                    <input type="number" placeholder="Price ₹" value={row.price} onChange={e => updateRow(idx, 'price', e.target.value)} min="0" step="any" />
                    <select value={row.gst} onChange={e => updateRow(idx, 'gst', e.target.value)}>
                      {['0','5','12','18','28'].map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)', fontSize: '0.8rem' }}>₹{rowTotal.toLocaleString()}</div>
                    <button type="button" className="btn-icon" style={{ color: '#ef4444' }} onClick={() => setProductRows(r => r.filter((_, i) => i !== idx))} disabled={productRows.length === 1}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            <datalist id="prod-suggestions">
              {products.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
            <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
              Total: ₹{orderValue.toLocaleString()}
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: '0.75rem' }}>
            {existing && (
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <optgroup label="Pipeline">
                    {['New Enquiry','Contacted','Requirement Discussed','Quotation Requested','Quotation Sent','Negotiation'].map(s => <option key={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label="Won">
                    {['Converted','Purchased','Repeat Customer','Material Dispatched','Material Reached'].map(s => <option key={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label="Lost">
                    {['No Response','Not Interested','No Current Requirement','Invalid Lead','Closed Lost'].map(s => <option key={s}>{s}</option>)}
                  </optgroup>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Follow-up Date</label>
              <input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} />
            </div>
          </div>

          {isLost && (
            <div className="form-group">
              <label>Lost Reason</label>
              <select value={form.lostReason} onChange={e => setForm(f => ({ ...f, lostReason: e.target.value }))}>
                <option value="">Select reason...</option>
                {DATA_CONFIG.lostReasons.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Remarks</label>
            <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{existing ? 'Save Changes' : 'Create Lead'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
