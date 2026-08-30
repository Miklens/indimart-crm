/**
 * Google Sheets Backup Service
 *
 * All writes here are fire-and-forget.
 * Firebase is the source of truth — this is a silent background backup.
 * Failures are logged but never surface to the user as blocking errors.
 */

import { flattenInvoices } from '../utils/dataConfig';

const GS_DEBOUNCE_MS = 3000; // wait 3s of inactivity before pushing
let _timer = null;
let _pending = null; // latest snapshot to push

/**
 * Schedule a background push to Google Sheets.
 * Debounced — multiple rapid writes collapse into one push.
 */
export function scheduleGsBackup(gsUrl, { leads, invoices, products, settings, templates }) {
  if (!gsUrl) return;
  _pending = { leads, invoices, products, settings, templates };
  clearTimeout(_timer);
  _timer = setTimeout(() => _flushGsBackup(gsUrl), GS_DEBOUNCE_MS);
}

async function _flushGsBackup(gsUrl) {
  if (!_pending) return;
  const snapshot = { ..._pending };
  _pending = null;
  try {
    await fetch(gsUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'syncAll',
        leads: snapshot.leads,
        products: snapshot.products,
        settings: snapshot.settings,
        templates: snapshot.templates,
        invoices: flattenInvoices(snapshot.invoices || []),
      }),
    });
    localStorage.setItem('indimart_gsLastBackup', Date.now().toString());
  } catch (err) {
    console.warn('[GS Backup] failed silently:', err.message);
  }
}

/**
 * Force-flush immediately (e.g. before app close).
 */
export function flushGsBackupNow(gsUrl, data) {
  clearTimeout(_timer);
  return _flushGsBackup(gsUrl, data);
}

/**
 * Pull all data from Google Sheets (for migration).
 */
export async function gsPullAll(gsUrl) {
  const u = new URL(gsUrl);
  u.searchParams.set('action', 'getAll');
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown GS error');
  return data;
}

/**
 * Test GS connection.
 */
export async function gsTestConnection(gsUrl) {
  const u = new URL(gsUrl);
  u.searchParams.set('action', 'getSettings');
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Test failed');
  return true;
}
