import { useApp } from '../context/AppContext';

export default function SyncBanner() {
  const { syncBanner } = useApp();
  if (!syncBanner) return null;
  return (
    <div className={`sync-banner ${syncBanner.type}`} style={{ margin: '0 1.5rem 0.75rem' }}>
      {syncBanner.msg}
    </div>
  );
}
