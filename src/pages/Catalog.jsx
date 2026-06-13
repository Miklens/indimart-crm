import { useState } from 'react';
import { Plus, Edit3, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

const CATEGORIES = [
  'Biofertilizers', 'Biopesticides', 'Biostimulants', 'Humic Acid', 
  'Fulvic Acids', 'Chemical Pesticides', 'Herbicides', 'Micronutrients', 'Macronutrients'
];

function ProductModal({ product, onClose, onSave, companySettings }) {
  const [form, setForm] = useState({ 
    name: product?.name || '', 
    price: product?.price || '', 
    hsn: product?.hsn || '', 
    gst: product?.gst || '5',
    category: product?.category || '' 
  });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  const allCategories = [
    ...CATEGORIES,
    ...(companySettings?.customCategories || [])
  ];

  const handle = (e) => {
    e.preventDefault();
    const finalCategory = showCustomInput ? customCategoryName.trim() : form.category;
    onSave({ 
      ...form, 
      category: finalCategory,
      price: parseFloat(form.price) || 0 
    }, showCustomInput ? finalCategory : null);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handle}>
          <div className="form-group"><label>Product Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          
          <div className="form-group"><label>Category / Group</label>
            <select 
              value={showCustomInput ? '__custom__' : form.category} 
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setShowCustomInput(true);
                  setForm(f => ({ ...f, category: '' }));
                } else {
                  setShowCustomInput(false);
                  setForm(f => ({ ...f, category: e.target.value }));
                }
              }}
            >
              <option value="">Select category...</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Add Custom Category...</option>
            </select>
          </div>

          {showCustomInput && (
            <div className="form-group animate-fade-in" style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '0.4rem', border: '1px solid var(--glass-border)' }}>
              <label style={{ fontSize: '0.72rem' }}>Custom Category Name</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  value={customCategoryName} 
                  onChange={e => setCustomCategoryName(e.target.value)} 
                  placeholder="e.g. Organic Soil"
                  required
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomCategoryName('');
                  }}
                  style={{ padding: '0 0.75rem', fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group"><label>Price (₹)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} min="0" step="any" required /></div>
            <div className="form-group"><label>HSN Code</label><input value={form.hsn} onChange={e => setForm(f => ({ ...f, hsn: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>GST %</label>
            <select value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))}>
              {['0','5','12','18','28'].map(g => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{product ? 'Save' : 'Add Product'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Catalog() {
  const { products, leads, addProduct, updateProduct, deleteProduct, showBanner, companySettings, saveSettings } = useApp();
  const [editProduct, setEditProduct] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showOnlyCatalogStats, setShowOnlyCatalogStats] = useState(true);

  const handleSave = (data, newCustomCategory) => {
    if (newCustomCategory) {
      const currentCustom = companySettings.customCategories || [];
      if (!currentCustom.includes(newCustomCategory)) {
        saveSettings({
          ...companySettings,
          customCategories: [...currentCustom, newCustomCategory]
        });
      }
    }
    if (editProduct) { updateProduct(editProduct.id, data); showBanner('Product updated.', 'success'); setEditProduct(null); }
    else { addProduct(data); showBanner('Product added.', 'success'); setShowAdd(false); }
  };

  // Product stats from leads
  const productStats = {};
  leads.forEach(l => {
    const items = l.productList?.length ? l.productList : [{ name: l.product, price: l.orderValue, qty: 1 }];
    items.forEach(item => {
      if (!item.name) return;
      if (!productStats[item.name]) productStats[item.name] = { enquiries: 0, revenue: 0, converted: 0 };
      productStats[item.name].enquiries++;
      productStats[item.name].revenue += (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
      if (DATA_CONFIG.getWonStatusLabels().includes(l.status)) productStats[item.name].converted++;
    });
  });

  const catalogProductNames = new Set(products.map(p => p.name?.trim().toLowerCase()));
  const statsEntries = Object.entries(productStats).filter(([name]) => {
    if (showOnlyCatalogStats) {
      return catalogProductNames.has(name?.trim().toLowerCase());
    }
    return true;
  });

  return (
    <div className="page-section">
      <div className="section-header">
        <h2 className="section-title">Product Catalog</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Product</button>
      </div>

      <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
        <table>
          <thead><tr><th>Product Name</th><th>Category</th><th>HSN</th><th>GST</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>No products yet. Add products to auto-fill in lead forms.</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{p.category || '-'}</td>
                <td>{p.hsn || '-'}</td>
                <td>{p.gst || '5'}%</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{(p.price || 0).toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" style={{ color: 'var(--primary)' }} onClick={() => setEditProduct(p)}><Edit3 size={15} /></button>
                    <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => { if (window.confirm('Delete product?')) { deleteProduct(p.id); showBanner('Product deleted.', 'info'); } }}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Product stats */}
      {Object.keys(productStats).length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Product Performance</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-dim)' }}>
              <input 
                type="checkbox" 
                checked={showOnlyCatalogStats} 
                onChange={e => setShowOnlyCatalogStats(e.target.checked)} 
              />
              Show only catalog products
            </label>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Product</th><th>Enquiries</th><th>Revenue</th><th>Conv. Rate</th></tr></thead>
              <tbody>
                {statsEntries.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>No matching catalog products with enquiries.</td></tr>
                ) : (
                  statsEntries.sort((a, b) => b[1].revenue - a[1].revenue).map(([name, stats]) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 600 }}>{name}</td>
                      <td>{stats.enquiries}</td>
                      <td style={{ fontWeight: 600 }}>₹{stats.revenue.toLocaleString()}</td>
                      <td>{stats.enquiries > 0 ? ((stats.converted / stats.enquiries) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(showAdd || editProduct) && (
        <ProductModal
          product={editProduct}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
          onSave={handleSave}
          companySettings={companySettings}
        />
      )}
    </div>
  );
}
