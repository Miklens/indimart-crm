import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Users, FileText, User, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

const RESULT_TYPES = {
  lead:     { icon: Users,    color: '#3b82f6', label: 'Lead' },
  invoice:  { icon: FileText, color: '#8b5cf6', label: 'Invoice' },
  customer: { icon: User,     color: '#10b981', label: 'Customer' },
};

function highlight(text, query) {
  if (!query || !text) return text || '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(16,185,129,0.3)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch({ onClose, onOpenCustomer360 }) {
  const { leads, invoiceHistory, setCurrentSection } = useApp();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    const out = [];

    // Unique customers derived from leads
    const customerMap = {};
    leads.forEach(l => {
      const key = (l.contact || '').trim() || l.customerName;
      if (!customerMap[key]) customerMap[key] = { name: l.customerName, contact: l.contact, city: l.city, leads: [] };
      customerMap[key].leads.push(l);
    });
    Object.values(customerMap).forEach(c => {
      if (
        c.name?.toLowerCase().includes(q) ||
        (c.contact || '').includes(q) ||
        c.city?.toLowerCase().includes(q)
      ) {
        const totalValue = c.leads.reduce((s, l) => s + (parseFloat(l.orderValue) || 0), 0);
        out.push({
          type: 'customer',
          id: c.contact || c.name,
          title: c.name,
          sub: `${c.city || 'Unknown city'} · ₹${totalValue.toLocaleString()} LTV · ${c.leads.length} lead${c.leads.length !== 1 ? 's' : ''}`,
          data: c,
        });
      }
    });

    // Leads
    leads.forEach(l => {
      if (
        l.customerName?.toLowerCase().includes(q) ||
        (l.contact || '').includes(q) ||
        l.product?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.id?.toLowerCase().includes(q) ||
        l.status?.toLowerCase().includes(q)
      ) {
        out.push({
          type: 'lead',
          id: l.id,
          title: l.customerName,
          sub: `${l.product || '—'} · ${l.status} · ₹${(l.orderValue || 0).toLocaleString()}`,
          statusColor: DATA_CONFIG.getStatusColor(l.status),
          data: l,
        });
      }
    });

    // Invoices
    invoiceHistory.forEach(inv => {
      const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
      if (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q) ||
        (inv.customerContact || '').includes(q)
      ) {
        out.push({
          type: 'invoice',
          id: inv.invoiceNumber,
          title: inv.invoiceNumber,
          sub: `${inv.customerName} · ₹${(latest.totalAmount || 0).toLocaleString()} · ${latest.paymentStatus || 'Pending'}`,
          data: inv,
        });
      }
    });

    return out.slice(0, 12);
  }, [query, leads, invoiceHistory]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && items[cursor]) { selectItem(items[cursor]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  const selectItem = (item) => {
    if (item.type === 'customer') {
      onOpenCustomer360(item.data);
      onClose();
    } else if (item.type === 'lead') {
      setCurrentSection('leads');
      onClose();
    } else if (item.type === 'invoice') {
      setCurrentSection('invoices');
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const grouped = { customer: [], lead: [], invoice: [] };
  items.forEach(it => grouped[it.type].push(it));
  const ORDER = ['customer', 'lead', 'invoice'];

  return (
    <div className="gsearch-overlay" onClick={onClose}>
      <div className="gsearch-box" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="gsearch-input-row">
          <Search size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="gsearch-input"
            placeholder="Search leads, invoices, customers..."
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="gsearch-clear" onClick={() => { setQuery(''); setCursor(0); }}><X size={14} /></button>
          )}
          <kbd className="gsearch-esc" onClick={onClose}>Esc</kbd>
        </div>

        {/* Results */}
        <div className="gsearch-results" ref={listRef}>
          {query.trim().length === 0 && (
            <div className="gsearch-empty">
              <Search size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
              <div>Type to search across leads, invoices &amp; customers</div>
              <div style={{ fontSize: '0.72rem', marginTop: 4, opacity: 0.5 }}>Use ↑ ↓ to navigate · Enter to select · Esc to close</div>
            </div>
          )}

          {query.trim().length > 0 && items.length === 0 && (
            <div className="gsearch-empty">
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🔍</div>
              <div>No results for <strong>"{query}"</strong></div>
            </div>
          )}

          {ORDER.map(type => {
            const group = grouped[type];
            if (!group.length) return null;
            const { icon: Icon, color, label } = RESULT_TYPES[type];
            let flatIdx = ORDER.slice(0, ORDER.indexOf(type)).reduce((s, t) => s + grouped[t].length, 0);
            return (
              <div key={type} className="gsearch-group">
                <div className="gsearch-group-label">
                  <Icon size={11} style={{ color }} /> {label}s
                </div>
                {group.map((item, i) => {
                  const idx = flatIdx + i;
                  const active = cursor === idx;
                  return (
                    <div
                      key={item.id}
                      data-active={active}
                      className={`gsearch-item${active ? ' active' : ''}`}
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setCursor(idx)}
                    >
                      <div className="gsearch-item-icon" style={{ background: `${color}22`, color }}>
                        <Icon size={14} />
                      </div>
                      <div className="gsearch-item-body">
                        <div className="gsearch-item-title">
                          {highlight(item.title, query)}
                          {item.statusColor && (
                            <span style={{ marginLeft: 6, fontSize: '0.65rem', background: `${item.statusColor}22`, color: item.statusColor, padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>
                              {item.data?.status}
                            </span>
                          )}
                        </div>
                        <div className="gsearch-item-sub">{highlight(item.sub, query)}</div>
                      </div>
                      <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {items.length > 0 && (
          <div className="gsearch-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>Esc</kbd> Close</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{items.length} result{items.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
