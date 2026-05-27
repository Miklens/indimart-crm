import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const EMPTY_NEW = { name: '', qty: 1, price: 0, gst: '5', hsn: '' };

export default function ProductPicker({ lead, onConfirm, onClose }) {
  const { products } = useApp();

  const baseItems = lead?.productList?.length
    ? lead.productList
    : lead?.product
      ? [{ name: lead.product, qty: lead.qty || 1, price: lead.orderValue || 0, gst: '5', hsn: '' }]
      : [];

  const [items, setItems] = useState(baseItems);
  const [selected, setSelected] = useState(new Set(baseItems.map((_, i) => i)));
  const [newRow, setNewRow] = useState(null); // null = hidden, object = adding row

  const toggle = (i) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const selectAll = (val) => setSelected(val ? new Set(items.map((_, i) => i)) : new Set());

  const removeItem = (i) => {
    setItems(prev => prev.filter((_, idx) => idx !== i));
    setSelected(prev => {
      const next = new Set();
      prev.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1); });
      return next;
    });
  };

  const handleAddRow = () => {
    if (!newRow?.name?.trim()) { return; }
    const cat = products.find(p => p.name === newRow.name.trim());
    const row = {
      name: newRow.name.trim(),
      qty: parseFloat(newRow.qty) || 1,
      price: parseFloat(newRow.price) || (cat?.price || 0),
      gst: newRow.gst || cat?.gst || '5',
      hsn: newRow.hsn || cat?.hsn || '',
    };
    setItems(prev => {
      const next = [...prev, row];
      setSelected(s => new Set([...s, next.length - 1]));
      return next;
    });
    setNewRow(null);
  };

  const updateNewRow = (field, val) => {
    setNewRow(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'name') {
        const cat = products.find(p => p.name === val);
        if (cat) { updated.price = cat.price; updated.gst = cat.gst || '5'; updated.hsn = cat.hsn || ''; }
      }
      return updated;
    });
  };

  const handleConfirm = () => {
    const chosen = items.filter((_, i) => selected.has(i));
    if (!chosen.length) { alert('Please select at least one product.'); return; }
    onConfirm(chosen);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520, padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Products for Invoice</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>{lead?.customerName}</p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '1rem 1.5rem', maxHeight: '55vh', overflowY: 'auto' }}>
          {items.length === 0 && !newRow && (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1.5rem' }}>No products yet. Add one below.</div>
          )}

          {/* Existing items */}
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '0.5rem', background: selected.has(i) ? 'rgba(16,185,129,0.08)' : 'transparent', border: `1px solid ${selected.has(i) ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)'}`, marginBottom: '0.5rem', transition: 'all 0.15s' }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggle(i)}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  Qty: {item.qty} · Rate: ₹{(parseFloat(item.price) || 0).toLocaleString()} · GST: {item.gst || 5}%{item.hsn ? ` · HSN: ${item.hsn}` : ''}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', minWidth: 60, textAlign: 'right' }}>
                ₹{((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1)).toLocaleString()}
              </div>
              <button className="btn-icon" style={{ color: '#ef4444', padding: '2px 4px', flexShrink: 0 }} onClick={() => removeItem(i)} title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {/* Add new product row */}
          {newRow !== null && (
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px dashed rgba(59,130,246,0.4)', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Product</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 60px', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <div>
                  <input
                    list="picker-prod-list"
                    placeholder="Product name *"
                    value={newRow.name}
                    onChange={e => updateNewRow('name', e.target.value)}
                    autoFocus
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                  <datalist id="picker-prod-list">
                    {products.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                </div>
                <input type="number" placeholder="Qty" min="0" step="any"
                  value={newRow.qty} onChange={e => updateNewRow('qty', e.target.value)}
                  style={{ fontSize: '0.82rem' }} />
                <input type="number" placeholder="Rate ₹" min="0" step="any"
                  value={newRow.price} onChange={e => updateNewRow('price', e.target.value)}
                  style={{ fontSize: '0.82rem' }} />
                <select value={newRow.gst} onChange={e => updateNewRow('gst', e.target.value)} style={{ fontSize: '0.82rem' }}>
                  {['0','5','12','18','28'].map(g => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>
              <input placeholder="HSN code (optional)" value={newRow.hsn}
                onChange={e => updateNewRow('hsn', e.target.value)}
                style={{ width: '100%', fontSize: '0.78rem', marginBottom: '0.5rem' }} />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 10px' }} onClick={() => setNewRow(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                  onClick={handleAddRow} disabled={!newRow.name?.trim()}>
                  Add →
                </button>
              </div>
            </div>
          )}

          {/* Add product button */}
          {newRow === null && (
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', borderStyle: 'dashed', color: 'var(--primary)', justifyContent: 'center' }}
              onClick={() => setNewRow({ ...EMPTY_NEW })}>
              <Plus size={13} /> Add Product
            </button>
          )}
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => selectAll(true)} style={{ fontSize: '0.78rem' }}>Select All</button>
            <button className="btn btn-secondary" onClick={() => selectAll(false)} style={{ fontSize: '0.78rem' }}>Clear All</button>
          </div>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={selected.size === 0}>
            Generate Invoice ({selected.size}) →
          </button>
        </div>
      </div>
    </div>
  );
}
