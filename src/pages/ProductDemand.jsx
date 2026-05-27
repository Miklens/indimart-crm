import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

export default function ProductDemand() {
  const { leads } = useApp();

  const productStats = {};
  leads.forEach(l => {
    const items = l.productList?.length ? l.productList : [{ name: l.product, qty: l.qty || 1, price: l.orderValue }];
    items.forEach(item => {
      if (!item?.name) return;
      if (!productStats[item.name]) productStats[item.name] = { name: item.name, enquiries: 0, totalQty: 0, revenue: 0, converted: 0, cities: new Set() };
      const s = productStats[item.name];
      s.enquiries++;
      s.totalQty += (item.qty || 0);
      s.revenue += (item.price || 0) * (item.qty || 1);
      if (DATA_CONFIG.getWonStatusLabels().includes(l.status)) s.converted++;
      if (l.city) s.cities.add(l.city);
    });
  });

  const sorted = Object.values(productStats).sort((a, b) => b.enquiries - a.enquiries);

  return (
    <div className="page-section">
      <div className="section-header"><h2 className="section-title">Product Demand Analytics</h2></div>

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <p>No product data yet. Add leads with products to see analytics.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {sorted.map(p => (
          <div key={p.name} className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
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
