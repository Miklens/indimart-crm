import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Bell, FileText, Menu, Sun, Moon, Search } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import SyncBanner from './components/SyncBanner';
import GlobalSearch from './components/GlobalSearch';
import Customer360 from './components/Customer360';
import LoginPage from './pages/LoginPage';
import { getLocalSession } from './utils/localAuth';
import { isFirebaseConfigured, onAuthStateChanged, initFirebaseIfConfigured } from './firebase';
import { DATA_CONFIG } from './utils/dataConfig';

import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import FollowUps from './pages/FollowUps';
import Catalog from './pages/Catalog';
import ProductDemand from './pages/ProductDemand';
import SalesHistory from './pages/SalesHistory';
import Invoices from './pages/Invoices';
import BulkTools from './pages/BulkTools';
import Templates from './pages/Templates';
import Insights from './pages/Insights';
import Settings from './pages/Settings';

import { AppUIContext } from './context/AppUIContext';

const PAGES = {
  dashboard: Dashboard,
  leads: Leads,
  followups: FollowUps,
  catalog: Catalog,
  products: ProductDemand,
  sales: SalesHistory,
  invoices: Invoices,
  bulk: BulkTools,
  templates: Templates,
  segments: Insights,
  settings: Settings,
};

const MOBILE_NAV = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'followups', label: 'Tasks', icon: Bell },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'settings', label: 'More', icon: Menu },
];

function AppInner() {
  const { currentSection, setCurrentSection, leads } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('indimart_theme') || 'dark');
  const [searchOpen, setSearchOpen] = useState(false);
  const [customer360, setCustomer360] = useState(null);

  const [authUser, setAuthUser] = useState(() => {
    const localSession = getLocalSession();
    if (localSession) return localSession;
    if (!isFirebaseConfigured()) return false;
    return null;
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    initFirebaseIfConfigured();
    const unsub = onAuthStateChanged((user) => {
      if (!user && getLocalSession()) return;
      setAuthUser(user || false);
    });
    return unsub;
  }, []);

  const Page = PAGES[currentSection] || Dashboard;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('indimart_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (authUser === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--glass-border)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          Checking login...
        </div>
      </div>
    );
  }

  if (authUser === false) {
    return <LoginPage onLogin={(user) => setAuthUser(user || 'skip')} />;
  }

  const today = new Date().toISOString().split('T')[0];
  const overdueCount = leads.filter(l =>
    l.followUpDate && l.followUpDate <= today &&
    !DATA_CONFIG.getDeadStatusLabels().includes(l.status)
  ).length;

  const handleMobileNav = (id) => {
    if (id === 'settings') {
      setDrawerOpen(true);
    } else {
      setCurrentSection(id);
      setDrawerOpen(false);
    }
  };

  return (
    <AppUIContext.Provider value={{ openCustomer360: setCustomer360 }}>
    <div style={{ display: 'flex', flex: 1, height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      <Sidebar
        mobileOpen={drawerOpen}
        onMobileClose={() => setDrawerOpen(false)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      {drawerOpen && (
        <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} />
      )}

      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh' }}>
        {/* Mobile Top App Bar (Header on Mobile) */}
        <header className="mobile-top-bar">
          <button className="btn-icon" onClick={() => setDrawerOpen(true)} title="Open Navigation Menu">
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '7px',
              background: 'linear-gradient(135deg, #00d09c, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800, color: '#fff',
              boxShadow: '0 2px 8px rgba(16,185,129,0.4)'
            }}>IM</div>
            <span style={{ fontWeight: 800, fontSize: '0.96rem', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>IndiaMART CRM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button className="btn-icon" onClick={() => setSearchOpen(true)} title="Search (⌘K)">
              <Search size={19} />
            </button>
            <button className="btn-icon" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>

        <SyncBanner />
        <Page />
      </main>

      {/* Mobile bottom navigation dock */}
      <nav className="mobile-nav">
        {MOBILE_NAV.map(({ id, label, icon: Icon }) => {
          const isActive = id === 'settings' ? drawerOpen : currentSection === id;
          const showDot = id === 'followups' && overdueCount > 0;
          return (
            <button key={id} className={`mobile-nav-item${isActive ? ' active' : ''}`} onClick={() => handleMobileNav(id)}>
              {showDot && <span className="nav-dot" />}
              <Icon size={20} />
              <span>{label}</span>
              {id === 'followups' && overdueCount > 0 && (
                <span style={{ position: 'absolute', top: 5, right: 'calc(50% - 18px)', background: '#ef4444', color: '#fff', fontSize: '0.5rem', fontWeight: 700, padding: '1px 4px', borderRadius: 999, minWidth: 14, textAlign: 'center' }}>{overdueCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Global search overlay */}
      {searchOpen && (
        <GlobalSearch
          onClose={() => setSearchOpen(false)}
          onOpenCustomer360={(c) => { setCustomer360(c); setSearchOpen(false); }}
        />
      )}

      {/* Customer 360 modal */}
      {customer360 && (
        <Customer360 customer={customer360} onClose={() => setCustomer360(null)} />
      )}
    </div>
    </AppUIContext.Provider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
