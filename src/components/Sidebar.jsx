import { useState, useRef } from 'react';
import { LayoutDashboard, Users, ShoppingBag, Package, FileText, Repeat, ListChecks, MessageSquare, BarChart2, Settings, ChevronLeft, ChevronRight, Bell, Wifi, WifiOff, Loader, Upload, Download, Sun, Moon, Search, LogOut, X, Sparkles } from 'lucide-react';
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
  const { currentSection, setCurrentSection, leads, syncStatus, isSyncing, autoSyncEnabled, toggleAutoSync, gsUrl, addLead, showBanner } = useApp();
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

  const handleExportCSV = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ds = wb.addWorksheet('Leads Data');
      ds.columns = [
        { header: 'ID', key: 'id', width: 12 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Customer Name', key: 'customerName', width: 24 },
        { header: 'Contact', key: 'contact', width: 16 },
        { header: 'City', key: 'city', width: 16 },
        { header: 'State', key: 'state', width: 16 },
        { header: 'Product', key: 'product', width: 26 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Order Value', key: 'orderValue', width: 14 },
        { header: 'Remarks', key: 'remarks', width: 30 },
      ];
      leads.forEach(l => ds.addRow(l));
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IndiaMART_CRM_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showBanner('✅ Data exported to Excel!', 'success');
    } catch (err) {
      showBanner('❌ Export failed: ' + err.message, 'error');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const overdueFollowups = leads.filter(l => l.followUpDate && l.followUpDate <= today && !DATA_CONFIG.getDeadStatusLabels().includes(l.status)).length;

  const SyncIcon = isSyncing ? Loader : syncStatus.status === 'connected' ? Wifi : syncStatus.status === 'error' ? WifiOff : Wifi;
  const syncColor = syncStatus.status === 'connected' ? '#10b981' : syncStatus.status === 'error' ? '#ef4444' : syncStatus.status === 'syncing' ? '#f59e0b' : '#94a3b8';

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minWidth: collapsed ? 64 : 240,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.3s var(--ease-spring), width 0.25s var(--ease-spring)',
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
      {/* Brand Header */}
      <div style={{ padding: collapsed ? '1.2rem 0.6rem' : '1.2rem 1.1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 68 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #00d09c 0%, #059669 100%)',
              borderRadius: '0.65rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.82rem', fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 14px rgba(16,185,129,0.45)',
              flexShrink: 0
            }}>
              IM
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                IndiaMART CRM
                <span style={{ fontSize: '0.58rem', background: 'rgba(16,185,129,0.18)', color: '#10b981', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>PRO</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span> Live Connected
              </div>
            </div>
          </div>
        )}
        <button className="btn-icon" onClick={() => { if (onMobileClose) onMobileClose(); else setCollapsed(c => !c); }} style={{ marginLeft: collapsed ? 'auto' : 0, color: 'var(--text-dim)' }}>
          {mobileOpen ? <X size={18} /> : collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Global Search Bar (Zepto/Instagram styled) */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 0.85rem 0.25rem' }}>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', padding: '0.55rem 0.75rem',
              borderRadius: '0.65rem',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-input)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'all 0.2s var(--ease-spring)'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(16,185,129,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
          >
            <Search size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Quick search...</span>
            <kbd style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '2px 5px', color: 'var(--text-dim)', fontFamily: 'inherit', fontWeight: 600 }}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation Items (Instagram/Groww styled) */}
      <nav style={{ flex: 1, padding: '0.5rem 0.65rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentSection === id;
          return (
            <button
              key={id}
              onClick={() => { setCurrentSection(id); if (onMobileClose) onMobileClose(); }}
              title={collapsed ? label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                width: '100%', padding: collapsed ? '0.75rem' : '0.65rem 0.85rem',
                borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                background: active ? 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.08))' : 'transparent',
                color: active ? '#10b981' : 'var(--text-dim)',
                fontWeight: active ? 700 : 500,
                fontSize: '0.85rem',
                transition: 'all 0.2s var(--ease-spring)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                border: active ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'var(--text-main)';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-dim)';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <Icon size={18} style={{ flexShrink: 0, color: active ? '#10b981' : 'inherit' }} />
              {!collapsed && <span style={{ letterSpacing: '-0.01em' }}>{label}</span>}
              {!collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999, boxShadow: '0 0 10px rgba(239,68,68,0.5)' }}>{overdueFollowups}</span>
              )}
              {collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 8px #ef4444' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick actions & Profile Footer */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 0.85rem', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => csvRef.current?.click()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
              <Upload size={12} /> Import
            </button>
            <button onClick={handleExportCSV} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
              <Download size={12} /> Backup
            </button>
          </div>

          {/* Theme Switcher Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.2rem', marginTop: '2px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Theme Mode</span>
            <div className="theme-toggle" onClick={onThemeToggle} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
              <button className={`theme-toggle-btn${theme === 'light' ? ' active' : ''}`}><Sun size={13} /></button>
              <button className={`theme-toggle-btn${theme === 'dark' ? ' active' : ''}`}><Moon size={13} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Logout button */}
      {isFirebaseConfigured() && getCurrentUser() && (
        <div style={{ padding: '0.5rem 0.85rem 0.85rem', borderTop: '1px solid var(--glass-border)' }}>
          <button
            onClick={async () => { await signOutUser(); window.location.reload(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '0.65rem',
              cursor: 'pointer',
              padding: '0.5rem',
              width: '100%',
              color: '#f87171',
              fontSize: '0.78rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={14} />
            {!collapsed && <span>Sign Out ({getCurrentUser()?.email?.split('@')[0]})</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
