import { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SalesHistory() {
  const { invoiceHistory, leads, addLead, showBanner } = useApp();
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [search]);

  const normC = r => { const d = String(r||'').replace(/\D/g,''); return d.length===12&&d.startsWith('91')?d.slice(2):d.slice(-10)||r.trim(); };
  const handleReorder = (contact, name) => {
    const nc = normC(contact);
    const lastLead = leads.slice().reverse().find(l => normC(l.contact) === nc);
    if (!lastLead) { showBanner('No lead found for this customer.', 'info'); return; }
    addLead({ ...lastLead, id: undefined, date: new Date().toISOString().split('T')[0], status: 'New Enquiry', followUpDate: '', remarks: `Reorder from ${lastLead.id}`, history: [] });
    showBanner(`✅ Reorder lead created for ${name}`, 'success');
  };

  if (!invoiceHistory.length) {
    return (
      <div className="page-section">
        <div className="section-header"><h2 className="section-title">Sales History</h2></div>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
          <p>No sales yet. Generate an invoice to see sales history here.</p>
        </div>
      </div>
    );
  }

  // Group by customer contact (fallback to name if contact blank)
  const customers = {};
  invoiceHistory.forEach(inv => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    const rawContact = inv.customerContact || inv.contact || '';
    const digits = rawContact.replace(/\D/g, '');
    const contact = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10) || rawContact.trim();
    const name = inv.customerName || '';
    const key = contact || name.trim() || inv.invoiceNumber;
    if (!customers[key]) {
      customers[key] = { name, contact, key, invoices: [], totalValue: 0, totalOrders: 0 };
    }
    customers[key].invoices.push({ ...inv, latest });
    customers[key].totalValue += parseFloat(latest.totalAmount || 0) || 0;
    customers[key].totalOrders++;
  });

  const sorted = Object.values(customers).sort((a, b) => b.totalValue - a.totalValue);

  const filtered = sorted.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(s);
    const contactMatch = c.contact.includes(s);
    const productMatch = c.invoices.some(inv => 
      (inv.latest?.items || []).some(item => 
        item.name?.toLowerCase().includes(s)
      )
    );
    const invoiceMatch = c.invoices.some(inv => inv.invoiceNumber.toLowerCase().includes(s));
    return nameMatch || contactMatch || productMatch || invoiceMatch;
  });

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Sales History</h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search customer, contact, product, invoice..." 
          style={{ paddingLeft: '2rem' }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {filtered.slice(0, visibleCount).map(c => {
          const isVip = c.totalValue > 50000;
          return (
            <div key={c.key} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>{c.name}</h3>
                    {isVip && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700 }}>⭐ VIP</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 4 }}>📞 {c.contact} · {c.totalOrders} order{c.totalOrders !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lifetime Value</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isVip ? '#f59e0b' : 'var(--primary)' }}>₹{c.totalValue.toLocaleString()}</div>
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => handleReorder(c.contact, c.name)}>
                    <RefreshCw size={12} /> Reorder
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card2)', borderRadius: '0.5rem', padding: '1rem', border: '1px solid var(--glass-border)' }}>
                {c.invoices.map(inv => (
                  <div key={inv.invoiceNumber} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>📄 {inv.invoiceNumber}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{inv.latest.invoiceDate || '-'}</span>
                    </div>
                    {(inv.latest.items || []).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0 0.35rem 0.5rem', borderBottom: '1px solid var(--td-border)' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 1 }}>Qty: {item.qty} · ₹{(item.price || 0).toLocaleString()}/unit</div>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>₹{((item.price || 0) * (item.qty || 1)).toLocaleString()}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0 0', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Invoice Total</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>₹{(inv.latest.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setVisibleCount(prev => prev + 50)}>
            Load More Customers ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
