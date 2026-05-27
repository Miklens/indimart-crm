import { useState, useEffect, createContext, useContext } from 'react';
import { LayoutDashboard, Users, Bell, FileText, Menu, Sun, Moon, Search } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import SyncBanner from './components/SyncBanner';
import GlobalSearch from './components/GlobalSearch';
import Customer360 from './components/Customer360';
import FirebaseSetup from './pages/FirebaseSetup';
import LoginPage, { getLocalSession, clearLocalSession } from './pages/LoginPage';
import { isFirebaseConfigured, onAuthStateChanged, initFirebaseIfConfigured } from './firebase';

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

export const AppUIContext = createContext({ openCustomer360: () => {} });
export function useAppUI() { return useContext(AppUIContext); }

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
  // Show Firebase setup if not yet configured AND user hasn't dismissed it
  const [showFbSetup, setShowFbSetup] = useState(
    () => !isFirebaseConfigured() && localStorage.getItem('indimart_fb_setup_skipped') !== '1'
  );
  // Auth state — null=loading, false=not logged in, object=logged in user
  const [authUser, setAuthUser] = useState(() => {
    // Check local session first (works without Firebase)
    const localSession = getLocalSession();
    if (localSession) return localSession;
    // If Firebase not configured and no local session, show login
    if (!isFirebaseConfigured()) return false;
    return null; // loading — wait for Firebase auth state
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    initFirebaseIfConfigured();
    const unsub = onAuthStateChanged((user) => {
      // Don't override a valid local session with Firebase null
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

  // Global Cmd/Ctrl+K listener
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

  // Auth loading spinner
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

  // Not logged in — show login page
  if (authUser === false) {
    return <LoginPage onLogin={(user) => setAuthUser(user || 'skip')} />;
  }

  // Firebase first-run setup screen (shown after all hooks)
  if (showFbSetup) {
    return (
      <FirebaseSetup
        onComplete={() => setShowFbSetup(false)}
        onSkip={() => setShowFbSetup(false)}
      />
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const overdueCount = leads.filter(l =>
    l.followUpDate && l.followUpDate <= today &&
    !['No Response','Not Interested','No Current Requirement','Invalid Lead','Closed Lost'].includes(l.status)
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <Sidebar
        mobileOpen={drawerOpen}
        onMobileClose={() => setDrawerOpen(false)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      {drawerOpen && (
        <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} />
      )}

      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <SyncBanner />
        <Page />
      </main>

      {/* Mobile bottom navigation */}
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

      {/* Floating theme toggle — mobile only, top-right */}
      <button
        onClick={toggleTheme}
        className="mobile-theme-fab"
        title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        style={{
          position: 'fixed', top: 12, right: 58, zIndex: 190,
          width: 38, height: 38, borderRadius: '50%', border: 'none',
          background: theme === 'dark' ? '#1e3a5f' : '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: theme === 'dark' ? '#f59e0b' : '#1e293b',
        }}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Mobile search FAB */}
      <button
        onClick={() => setSearchOpen(true)}
        className="mobile-theme-fab"
        title="Search (Ctrl+K)"
        style={{
          position: 'fixed', top: 12, right: 14, zIndex: 190,
          width: 38, height: 38, borderRadius: '50%', border: 'none',
          background: theme === 'dark' ? '#1e3a5f' : '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--primary)',
        }}
      >
        <Search size={17} />
      </button>

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
