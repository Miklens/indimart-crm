/**
 * Firestore Service — all CRUD + real-time listeners for Indimart CRM
 *
 * Collections layout:
 *   /leads/{leadId}
 *   /invoices/{invoiceNumber}
 *   /products/{productId}
 *   /templates/{templateId}
 *   /settings/company          (single doc)
 *   /meta/app                  (single doc: lastSync, version, etc.)
 */

import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, writeBatch, onSnapshot, serverTimestamp,
  query, orderBy
} from 'firebase/firestore';
import { getDb } from '../firebase';

// ─── Collection refs ────────────────────────────────────────────────────────

const col = (name) => collection(getDb(), name);
const ref = (col, id) => doc(getDb(), col, id);

// ─── Generic helpers ─────────────────────────────────────────────────────────

function clean(obj) {
  // Remove undefined values — Firestore rejects them
  return JSON.parse(JSON.stringify(obj));
}

// Firestore doc IDs cannot contain '/' — sanitize invoice numbers (e.g. PI/26-27/IN105 → PI_26-27_IN105)
function safeInvoiceId(invoiceNumber) {
  return (invoiceNumber || '').replace(/\//g, '_');
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function fsGetLeads() {
  const snap = await getDocs(query(col('leads'), orderBy('timestamp', 'desc')));
  return snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
}

export async function fsSetLead(lead) {
  const id = lead.id || lead._fsId;
  if (!id) throw new Error('Lead id required');
  await setDoc(ref('leads', id), clean({ ...lead, _updatedAt: serverTimestamp() }), { merge: true });
}

export async function fsUpdateLead(id, updates) {
  await updateDoc(ref('leads', id), clean({ ...updates, _updatedAt: serverTimestamp() }));
}

export async function fsDeleteLead(id) {
  await deleteDoc(ref('leads', id));
}

export function fsListenLeads(callback) {
  return onSnapshot(
    query(col('leads'), orderBy('timestamp', 'desc')),
    snap => callback(snap.docs.map(d => ({ ...d.data(), _fsId: d.id }))),
    err => console.error('leads listener:', err)
  );
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export async function fsGetInvoices() {
  const snap = await getDocs(query(col('invoices'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
}

export async function fsSetInvoice(invoice) {
  const id = safeInvoiceId(invoice.invoiceNumber);
  if (!id) throw new Error('invoiceNumber required');
  // IMPORTANT: Do NOT use merge:true for invoices.
  // merge:true does deep-merge on arrays, so removed items/versions persist in Firestore
  // and overwrite local state when the listener fires. Full overwrite ensures deletions stick.
  await setDoc(ref('invoices', id), clean({ ...invoice, _updatedAt: serverTimestamp() }));
}

export async function fsUpdateInvoice(invoiceNumber, updates) {
  await updateDoc(ref('invoices', safeInvoiceId(invoiceNumber)), clean({ ...updates, _updatedAt: serverTimestamp() }));
}

export async function fsDeleteInvoice(invoiceNumber) {
  await deleteDoc(ref('invoices', safeInvoiceId(invoiceNumber)));
}

export function fsListenInvoices(callback) {
  return onSnapshot(
    query(col('invoices'), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ ...d.data(), _fsId: d.id }))),
    err => console.error('invoices listener:', err)
  );
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function fsGetProducts() {
  const snap = await getDocs(col('products'));
  return snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
}

export async function fsSetProduct(product) {
  const id = product.id || product._fsId;
  if (!id) throw new Error('Product id required');
  await setDoc(ref('products', id), clean({ ...product, _updatedAt: serverTimestamp() }), { merge: true });
}

export async function fsDeleteProduct(id) {
  await deleteDoc(ref('products', id));
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function fsGetTemplates() {
  const snap = await getDocs(col('templates'));
  return snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
}

export async function fsSetTemplate(template) {
  const id = template.id || template._fsId;
  if (!id) throw new Error('Template id required');
  await setDoc(ref('templates', id), clean({ ...template, _updatedAt: serverTimestamp() }), { merge: true });
}

export async function fsDeleteTemplate(id) {
  await deleteDoc(ref('templates', id));
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fsGetSettings() {
  const snap = await getDoc(ref('settings', 'company'));
  return snap.exists() ? snap.data() : null;
}

export async function fsSetSettings(settings) {
  await setDoc(ref('settings', 'company'), clean({ ...settings, _updatedAt: serverTimestamp() }), { merge: true });
}

// ─── Invoice number sequencing ───────────────────────────────────────────────

export async function fsGetMaxInvoiceNumber() {
  const snap = await getDocs(col('invoices'));
  let max = 100;
  snap.docs.forEach(d => {
    // doc ID has slashes replaced with underscores, but number is still at the end
    const match = d.id.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > max) max = n;
    }
  });
  return max;
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export async function fsGetMeta() {
  const snap = await getDoc(ref('meta', 'app'));
  return snap.exists() ? snap.data() : {};
}

export async function fsSetMeta(data) {
  await setDoc(ref('meta', 'app'), clean({ ...data, _updatedAt: serverTimestamp() }), { merge: true });
}

// ─── Batch migration ─────────────────────────────────────────────────────────

/**
 * Migrate all local data to Firestore in batches of 500 (Firestore limit).
 * onProgress(done, total, label) called throughout.
 */
export async function fsMigrateAll({ leads, invoices, products, templates, settings }, onProgress) {
  const db = getDb();
  const allOps = [];

  leads.forEach(l => allOps.push({ col: 'leads', id: l.id, data: l }));
  invoices.forEach(i => {
    const safeId = safeInvoiceId(i.invoiceNumber);
    allOps.push({ col: 'invoices', id: safeId, data: { ...i, _docId: safeId } });
  });
  products.forEach(p => allOps.push({ col: 'products', id: p.id, data: p }));
  templates.forEach(t => allOps.push({ col: 'templates', id: t.id, data: t }));
  if (settings) allOps.push({ col: 'settings', id: 'company', data: settings });

  const total = allOps.length;
  let done = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
    const chunk = allOps.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(op => {
      const docRef = doc(db, op.col, op.id);
      batch.set(docRef, clean({ ...op.data, _updatedAt: serverTimestamp() }), { merge: true });
    });
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, total, `Migrated ${done}/${total} records`);
  }

  await fsSetMeta({ migratedAt: new Date().toISOString(), totalRecords: total });
  return { done, total };
}

// ─── Full export (all collections → plain objects) ───────────────────────────

export async function fsExportAll() {
  const [leads, invoices, products, templates, settings] = await Promise.all([
    fsGetLeads(), fsGetInvoices(), fsGetProducts(), fsGetTemplates(), fsGetSettings()
  ]);
  return { leads, invoices, products, templates, settings };
}
