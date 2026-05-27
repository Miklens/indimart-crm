import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

export default function Insights() {
  const { leads, invoiceHistory } = useApp();

  const contactLTV = {}; // key = contact || name fallback
  const contactMeta = {}; // key -> { contact, name }
  invoiceHistory.forEach(inv => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    const contact = inv.customerContact || inv.contact || '';
    const name = inv.customerName || '';
    const digits = contact.replace(/\D/g, '');
    const normContact = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10) || contact.trim();
    const key = normContact || name.trim() || inv.invoiceNumber;
    contactLTV[key] = (contactLTV[key] || 0) + (parseFloat(latest.totalAmount) || 0);
    if (!contactMeta[key]) contactMeta[key] = { contact, name };
  });

  const vipCount = Object.values(contactLTV).filter(v => v > 50000).length;
  const totalCustomers = Object.keys(contactLTV).length;
  const activeLeads = leads.filter(l => !DATA_CONFIG.getDeadStatusLabels().includes(l.status)).length;
  const wonCount = leads.filter(l => DATA_CONFIG.getWonStatusLabels().includes(l.status)).length;
  const conversionRate = leads.length ? ((wonCount / leads.length) * 100).toFixed(1) : 0;

  // Top customers by LTV
  const topCustomers = Object.entries(contactLTV)
    .map(([key, ltv]) => ({ key, ltv, ...contactMeta[key] }))
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 10);

  // City breakdown
  const cityData = {};
  leads.forEach(l => { const c = l.city || 'Unknown'; cityData[c] = (cityData[c] || 0) + 1; });
  const topCities = Object.entries(cityData).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // State breakdown
  const stateData = {};
  leads.forEach(l => { const s = l.state || 'Unknown'; stateData[s] = (stateData[s] || 0) + 1; });
  const topStates = Object.entries(stateData).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Source breakdown
  const sourceData = {};
  leads.forEach(l => { const s = l.source || 'Unknown'; sourceData[s] = (sourceData[s] || 0) + 1; });

  return (
    <div className="page-section">
      <div className="section-header"><h2 className="section-title">Customer Insights</h2></div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="segment-card"><h3>Total Customers</h3><div className="value">{totalCustomers}</div><div className="desc">Unique buyers</div></div>
        <div className="segment-card" style={{ borderColor: '#f59e0b' }}><h3>⭐ VIP Customers</h3><div className="value" style={{ color: '#f59e0b' }}>{vipCount}</div><div className="desc">LTV &gt; ₹50,000</div></div>
        <div className="segment-card"><h3>Active Leads</h3><div className="value">{activeLeads}</div><div className="desc">In pipeline</div></div>
        <div className="segment-card"><h3>Conversion Rate</h3><div className="value">{conversionRate}%</div><div className="desc">{wonCount} won / {leads.length} total</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Top customers */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>🏆 Top Customers by LTV</h3>
          {topCustomers.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No billed customers yet.</div>}
          {topCustomers.map((c, i) => (
            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: i === 0 ? '#f59e0b' : 'var(--text-dim)', fontSize: '0.8rem' }}>#{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.name || c.key}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{c.contact}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, color: c.ltv > 50000 ? '#f59e0b' : 'var(--primary)', fontSize: '0.88rem' }}>₹{c.ltv.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* City breakdown */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>📍 Leads by City</h3>
          {topCities.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No city data yet.</div>}
          {topCities.map(([city, count]) => (
            <div key={city} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.83rem' }}>{city}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{count}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 3, width: `${(count / leads.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* State breakdown */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>🗺️ Leads by State</h3>
          {topStates.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No state data yet.</div>}
          {topStates.map(([state, count]) => (
            <div key={state} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.83rem' }}>{state}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{count} ({leads.length ? ((count / leads.length) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <div style={{ height: '100%', background: '#8b5cf6', borderRadius: 3, width: `${(count / leads.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Source breakdown */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>🔗 Leads by Source</h3>
          {Object.entries(sourceData).length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No source data yet.</div>}
          {Object.entries(sourceData).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
            <div key={src} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.83rem' }}>{src}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{count} ({leads.length ? ((count / leads.length) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <div style={{ height: '100%', background: '#6366f1', borderRadius: 3, width: `${(count / leads.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
