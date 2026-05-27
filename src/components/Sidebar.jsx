import { useState, useRef } from 'react';
import { LayoutDashboard, Users, ShoppingBag, Package, FileText, Repeat, ListChecks, MessageSquare, BarChart2, Settings, ChevronLeft, ChevronRight, Bell, RefreshCw, Wifi, WifiOff, Loader, Upload, Download, Sun, Moon, Search, LogOut, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { signOutUser, isFirebaseConfigured, getCurrentUser } from '../firebase';
import { DATA_CONFIG } from '../utils/dataConfig';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'followups', label: 'Follow-ups', icon: Bell },
  { id: 'catalog', label: 'Catalog', icon: ShoppingBag },
  { id: 'products', label: 'Product Demand', icon: Package },
  { id: 'sales', label: 'Sales History', icon: Repeat },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'bulk', label: 'Bulk Tools', icon: ListChecks },
  { id: 'templates', label: 'Templates', icon: MessageSquare },
  { id: 'segments', label: 'Insights', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onMobileClose, theme, onThemeToggle }) {
  const { currentSection, setCurrentSection, leads, syncStatus, isSyncing, autoSyncEnabled, toggleAutoSync, gsUrl, addLead, invoiceHistory, showBanner } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const csvRef = useRef(null);

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
          orderValue: parseFloat(row.ordervalue || row['order value'] || 0),
          remarks: row.remarks || '',
          followUpDate: row.followupdate || '',
          productList: [],
          history: [{ status: 'New Enquiry', timestamp: Date.now() }],
        });
        imported++;
      });
      showBanner(`✅ Imported ${imported} leads`, 'success');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const header = ['ID','Date','Customer','Contact','City','State','Product','Value','Status','Follow-up','Remarks'];
    const rows = leads.map(l => [l.id, l.date, l.customerName, l.contact, l.city||'', l.state||'', l.product||'', l.orderValue||0, l.status, l.followUpDate||'', (l.remarks||'').replace(/,/g,' ')]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showBanner('📥 Leads exported to CSV', 'success');
  };

  const today = new Date().toISOString().split('T')[0];
  const overdueFollowups = leads.filter(l => l.followUpDate && l.followUpDate <= today && !DATA_CONFIG.getDeadStatusLabels().includes(l.status)).length;

  const SyncIcon = isSyncing ? Loader : syncStatus.status === 'connected' ? Wifi : syncStatus.status === 'error' ? WifiOff : Wifi;
  const syncColor = syncStatus.status === 'connected' ? '#10b981' : syncStatus.status === 'error' ? '#ef4444' : syncStatus.status === 'syncing' ? '#f59e0b' : '#94a3b8';

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <aside style={{
      width: collapsed ? 56 : 220,
      minWidth: collapsed ? 56 : 220,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.25s ease, width 0.2s',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100%',
      overflow: 'hidden',
      zIndex: 160,
      ...(mobileOpen ? { transform: 'translateX(0)' } : {}),
    }}
    className="app-sidebar"
    >
      {/* Header */}
      <div style={{ padding: collapsed ? '1rem 0.6rem' : '1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 60 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>IM</div>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f1f5f9', letterSpacing: '-0.01em' }}>IndiaMART CRM</span>
          </div>
        )}
        <button className="btn-icon" onClick={() => { if (onMobileClose) onMobileClose(); else setCollapsed(c => !c); }} style={{ marginLeft: collapsed ? 'auto' : 0, color: '#94a3b8' }}>
          {mobileOpen ? <X size={18} /> : collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Search trigger */}
      {!collapsed && (
        <div style={{ padding: '0.5rem 0.75rem' }}>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <Search size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
            <kbd style={{ fontSize: '0.6rem', background: 'var(--bg-card2)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>Ctrl K</kbd>
          </button>
        </div>
      )}

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0.4rem 0.5rem', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentSection === id;
          return (
            <button
              key={id}
              onClick={() => { setCurrentSection(id); if (onMobileClose) onMobileClose(); }}
              title={collapsed ? label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem',
                width: '100%', padding: collapsed ? '0.65rem' : '0.6rem 0.75rem',
                borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                background: active ? 'rgba(16,185,129,0.18)' : 'transparent',
                color: active ? '#10b981' : '#8da4bf',
                fontWeight: active ? 700 : 500,
                fontSize: '0.82rem',
                marginBottom: '0.1rem',
                transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>{overdueFollowups}</span>
              )}
              {collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick actions: Import / Export */}
      {!collapsed && (
        <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          <button onClick={() => csvRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.5rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.15rem' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Upload size={13} /><span>Import CSV</span>
          </button>
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.5rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8', fontSize: '0.78rem' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Download size={13} /><span>Export Data</span>
          </button>

          {/* Theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', padding: '0.35rem 0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#7a90a8', fontWeight: 600 }}>Appearance</span>
            <div className="theme-toggle" onClick={onThemeToggle} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
              <button className={`theme-toggle-btn${theme === 'light' ? ' active' : ''}`}><Sun size={13} /></button>
              <button className={`theme-toggle-btn${theme === 'dark' ? ' active' : ''}`}><Moon size={13} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Sync status + auto-sync toggle */}
      {!collapsed && gsUrl && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <SyncIcon size={12} style={{ color: syncColor, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            <span style={{ fontSize: '0.7rem', color: syncColor, fontWeight: 600 }}>{syncStatus.text}</span>
          </div>
          <button
            onClick={() => toggleAutoSync(!autoSyncEnabled)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', width: '100%' }}
          >
            <div style={{ width: 32, height: 16, background: autoSyncEnabled ? '#10b981' : '#334155', borderRadius: 999, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: autoSyncEnabled ? 18 : 2, width: 12, height: 12, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Auto-sync {autoSyncEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      )}
      {/* Logout button — only shown when Firebase auth is active */}
      {isFirebaseConfigured() && getCurrentUser() && (
        <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={async () => { await signOutUser(); window.location.reload(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.75rem', width: '100%', color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}
          >
            <LogOut size={13} />
            {!collapsed && <span>Sign Out ({getCurrentUser()?.email?.split('@')[0]})</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
