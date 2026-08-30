import { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, Users, Bell, FileText, Menu, Sun, Moon, Search, ArrowLeft } from 'lucide-react';
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

const SECTION_TITLES = {
  dashboard: 'Overview',
  leads: 'Leads Tracker',
  followups: 'Daily Tasks',
  catalog: 'Product Catalog',
  products: 'Product Demand',
  sales: 'Sales History',
  invoices: 'Invoices & Billing',
  bulk: 'Bulk Sync Tools',
  templates: 'Message Templates',
  segments: 'Customer Insights',
  settings: 'Settings',
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

  // Keep track of active overlays for system back button
  const drawerOpenRef = useRef(drawerOpen);
  const searchOpenRef = useRef(searchOpen);
  const customer360Ref = useRef(customer360);
  const currentSectionRef = useRef(currentSection);

  useEffect(() => { drawerOpenRef.current = drawerOpen; }, [drawerOpen]);
  useEffect(() => { searchOpenRef.current = searchOpen; }, [searchOpen]);
  useEffect(() => { customer360Ref.current = customer360; }, [customer360]);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);

  // ── Browser / System Navigation Integration (Hardware Back Button & Swipe Gesture) ──
  useEffect(() => {
    // Set initial state
    if (!window.history.state) {
      window.history.replaceState({ section: 'dashboard', isRoot: true }, '');
    }

    const handlePopState = (e) => {
      // 1. If Customer 360 is open, close it
      if (customer360Ref.current) {
        setCustomer360(null);
        return;
      }
      // 2. If Search modal is open, close it
      if (searchOpenRef.current) {
        setSearchOpen(false);
        return;
      }
      // 3. If Navigation drawer is open, close it
      if (drawerOpenRef.current) {
        setDrawerOpen(false);
        return;
      }

      // 4. Dispatch a custom event so child modals (LeadModal, InvoiceModal) can close on system back
      const handled = window.dispatchEvent(new CustomEvent('app:system-back', { cancelable: true }));
      if (!handled) return;

      // 5. Navigate back to previous section or dashboard
      if (e.state && e.state.section) {
        setCurrentSection(e.state.section);
      } else if (currentSectionRef.current !== 'dashboard') {
        setCurrentSection('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentSection]);

  const navigateToSection = useCallback((sec) => {
    if (sec === currentSectionRef.current) return;
    window.history.pushState({ section: sec }, '');
    setCurrentSection(sec);
    setDrawerOpen(false);
  }, [setCurrentSection]);

  const handleSystemBack = () => {
    if (customer360) {
      setCustomer360(null);
    } else if (searchOpen) {
      setSearchOpen(false);
    } else if (drawerOpen) {
      setDrawerOpen(false);
    } else if (currentSection !== 'dashboard') {
      window.history.back();
    }
  };

  const openSearchWithHistory = (open) => {
    if (open) {
      window.history.pushState({ overlay: 'search', section: currentSection }, '');
      setSearchOpen(true);
    } else {
      setSearchOpen(false);
    }
  };

  const openCustomer360WithHistory = (cust) => {
    if (cust) {
      window.history.pushState({ overlay: 'customer360', section: currentSection }, '');
      setCustomer360(cust);
    } else {
      setCustomer360(null);
    }
  };

  const openDrawerWithHistory = (open) => {
    if (open) {
      window.history.pushState({ overlay: 'drawer', section: currentSection }, '');
      setDrawerOpen(true);
    } else {
      setDrawerOpen(false);
    }
  };

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
        openSearchWithHistory(!searchOpen);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen]);

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
      openDrawerWithHistory(true);
    } else {
      navigateToSection(id);
    }
  };

  const isHome = currentSection === 'dashboard';

  return (
    <AppUIContext.Provider value={{ openCustomer360: openCustomer360WithHistory }}>
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
        {/* Mobile Top App Bar with Native Back & Section Title */}
        <header className="mobile-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {!isHome ? (
              <button 
                className="btn-icon" 
                onClick={handleSystemBack} 
                title="Go Back"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '50%', width: 34, height: 34 }}
              >
                <ArrowLeft size={18} style={{ color: 'var(--primary)' }} />
              </button>
            ) : (
              <button className="btn-icon" onClick={() => openDrawerWithHistory(true)} title="Open Navigation Menu">
                <Menu size={22} />
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {isHome ? (
                <>
                  <div style={{
                    width: 28, height: 28, borderRadius: '7px',
                    background: 'linear-gradient(135deg, #00d09c, #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 800, color: '#fff',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
                    flexShrink: 0
                  }}>IM</div>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>IndiaMART CRM</span>
                </>
              ) : (
                <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-main)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {SECTION_TITLES[currentSection] || 'IndiaMART CRM'}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button className="btn-icon" onClick={() => openSearchWithHistory(true)} title="Search (⌘K)">
              <Search size={18} />
            </button>
            <button className="btn-icon" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={19} />}
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
          onClose={() => openSearchWithHistory(false)}
          onOpenCustomer360={(c) => { openCustomer360WithHistory(c); openSearchWithHistory(false); }}
        />
      )}

      {/* Customer 360 modal */}
      {customer360 && (
        <Customer360 customer={customer360} onClose={() => openCustomer360WithHistory(null)} />
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
