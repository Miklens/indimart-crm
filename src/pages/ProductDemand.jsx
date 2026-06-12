import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

export default function ProductDemand() {
  const { leads, products } = useApp();
  const [activeMode, setActiveMode] = useState('products'); // 'products' or 'categories'

  const productStats = {};
  const categoryStats = {};

  leads.forEach(l => {
    const items = l.productList?.length ? l.productList : [{ name: l.product, qty: l.qty || 1, price: l.orderValue }];
    items.forEach(item => {
      if (!item?.name) return;
      
      // Calculate product stats
      if (!productStats[item.name]) productStats[item.name] = { name: item.name, enquiries: 0, totalQty: 0, revenue: 0, converted: 0, cities: new Set() };
      const ps = productStats[item.name];
      ps.enquiries++;
      ps.totalQty += (parseFloat(item.qty) || 0);
      ps.revenue += (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
      if (DATA_CONFIG.getWonStatusLabels().includes(l.status)) ps.converted++;
      if (l.city) ps.cities.add(l.city);

      // Find product category from catalog
      const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const itemClean = clean(item.name.replace('[NEW] ', ''));
      const catProduct = products.find(p => clean(p.name) === itemClean) || 
                         products.find(p => itemClean.includes(clean(p.name))) || 
                         products.find(p => clean(p.name).includes(itemClean));
      
      const category = catProduct?.category || 'Uncategorized';
      
      if (!categoryStats[category]) categoryStats[category] = { name: category, enquiries: 0, totalQty: 0, revenue: 0, converted: 0, cities: new Set() };
      const cs = categoryStats[category];
      cs.enquiries++;
      cs.totalQty += (parseFloat(item.qty) || 0);
      cs.revenue += (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
      if (DATA_CONFIG.getWonStatusLabels().includes(l.status)) cs.converted++;
      if (l.city) cs.cities.add(l.city);
    });
  });

  const sortedProducts = Object.values(productStats).sort((a, b) => b.enquiries - a.enquiries);
  const sortedCategories = Object.values(categoryStats).sort((a, b) => b.enquiries - a.enquiries);
  
  const currentData = activeMode === 'products' ? sortedProducts : sortedCategories;

  return (
    <div className="page-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="section-title">Product Demand Analytics</h2>
        
        {/* Toggle Mode */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <button 
            className={`btn ${activeMode === 'products' ? 'btn-primary' : ''}`}
            onClick={() => setActiveMode('products')}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: activeMode === 'products' ? undefined : 'transparent', border: 'none', color: activeMode === 'products' ? '#fff' : 'var(--text-dim)' }}
          >
            Individual Products
          </button>
          <button 
            className={`btn ${activeMode === 'categories' ? 'btn-primary' : ''}`}
            onClick={() => setActiveMode('categories')}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: activeMode === 'categories' ? undefined : 'transparent', border: 'none', color: activeMode === 'categories' ? '#fff' : 'var(--text-dim)' }}
          >
            Categories / Groups
          </button>
        </div>
      </div>

      {currentData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <p>No product data yet. Add leads with products to see analytics.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {currentData.map(p => (
          <div key={p.name} className="glass-card">
            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', flex: 1 }}>{p.name}</h3>
              <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700 }}>{p.enquiries} enquiries</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>₹{p.revenue.toLocaleString()}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Revenue</div>
              </div>
              <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{p.enquiries > 0 ? ((p.converted / p.enquiries) * 100).toFixed(0) : 0}%</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Conv. Rate</div>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Total Qty: <strong style={{ color: 'var(--text-main)' }}>{p.totalQty.toFixed(1)}</strong> ·
              Cities: <strong style={{ color: 'var(--text-main)' }}>{p.cities.size}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
