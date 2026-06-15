/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateInvoiceNumber, flattenInvoices, DATA_CONFIG, normalizeContact, getLeadForInvoice } from '../utils/dataConfig';
import { isFirebaseConfigured, initFirebaseIfConfigured } from '../firebase';
import {
  fsSetLead, fsUpdateLead, fsDeleteLead, fsListenLeads,
  fsSetInvoice, fsDeleteInvoice, fsListenInvoices,
  fsSetProduct, fsDeleteProduct, fsGetProducts,
  fsSetTemplate, fsDeleteTemplate, fsGetTemplates,
  fsGetSettings, fsSetSettings, fsGetMaxInvoiceNumber,
} from '../services/firestoreService';
import { scheduleGsBackup, gsTestConnection, gsPullAll } from '../services/gsBackupService';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  name: '', gst: '', companyGst: '', vat: '', cst: '', pan: '',
  state: '', address: '', email: '', mobile: '',
  bankName: '', accNo: '', branch: '', ifsc: '',
  invoicePrefix: '', invoiceFormat: 'standard', seal: '',
  invoiceFinYear: 'auto', invoiceStartNumber: ''
};

const SAMPLE_LEADS = [
  { id: 'IM001', date: '2026-05-16', customerName: 'Ravi Agro', contact: '9876543210', product: 'Bio NPK 11:6:6', status: 'Quotation Sent', followUpDate: new Date().toISOString().split('T')[0], orderValue: 0, remarks: 'Bulk enquiry', state: 'Maharashtra', city: 'Nashik', source: 'IndiaMART Direct', timestamp: Date.now(), productList: [{ name: 'Bio NPK 11:6:6', qty: 10, price: 1200, gst: '5', hsn: '31010099' }], history: [{ status: 'New Enquiry', timestamp: Date.now() - 10000 }, { status: 'Quotation Sent', timestamp: Date.now() }] },
  { id: 'IM002', date: '2026-05-15', customerName: 'Suresh Kumar', contact: '9988776655', product: 'Amino Zinc', status: 'Purchased', followUpDate: '', orderValue: 45000, remarks: 'Regular buyer', state: 'Karnataka', city: 'Belagavi', source: 'IndiaMART BuyLead', timestamp: Date.now() - 86400000, productList: [{ name: 'Amino Zinc', qty: 50, price: 850, gst: '5', hsn: '' }], history: [{ status: 'Purchased', timestamp: Date.now() }] },
  { id: 'IM003', date: '2026-04-10', customerName: 'Agro World', contact: '9123456789', product: 'Organic Potash', status: 'Converted', followUpDate: '', orderValue: 125000, remarks: 'Large export enquiry', state: 'Maharashtra', city: 'Pune', source: 'IndiaMART Direct', timestamp: Date.now() - 2592000000, productList: [{ name: 'Organic Potash', qty: 100, price: 950, gst: '12', hsn: '' }], history: [{ status: 'Converted', timestamp: Date.now() }] },
  { id: 'IM004', date: '2026-03-22', customerName: 'Farmer Friend', contact: '9000011111', product: 'Bio NPK 11:6:6', status: 'Closed Lost', lostReason: 'No Response', followUpDate: '', orderValue: 0, remarks: 'Trial pack', state: 'Punjab', city: 'Ludhiana', source: 'IndiaMART BuyLead', timestamp: Date.now() - 5184000000, productList: [], history: [{ status: 'Closed Lost', timestamp: Date.now() }] },
  { id: 'IM005', date: '2026-02-05', customerName: 'Green Bio', contact: '8888877777', product: 'Amino Zinc', status: 'Contacted', followUpDate: '', orderValue: 0, remarks: 'Distributor discussion', state: 'Andhra Pradesh', city: 'Guntur', source: 'WhatsApp', timestamp: Date.now() - 7776000000, productList: [], history: [{ status: 'Contacted', timestamp: Date.now() }] }
];

const SAMPLE_PRODUCTS = [
  { id: 'P001', name: 'Bio NPK 11:6:6', price: 1200, hsn: '31010099', gst: '5', category: 'Biofertilizers' },
  { id: 'P002', name: 'Amino Zinc', price: 850, hsn: '', gst: '5', category: 'Micronutrients' },
  { id: 'P003', name: 'Organic Potash', price: 950, hsn: '', gst: '12', category: 'Biofertilizers' }
];



function sanitizeInvoiceNumbers(history) {
  const fix = str => {
    if (!str) return str;
    const customMatches = [...str.matchAll(/([A-Z]+\/\d{2}-\d{2}\/I?N?\d+)/gi)];
    if (customMatches.length > 1) {
      const prefix = customMatches[0][1].match(/^([A-Z]+\/\d{2}-\d{2}\/)/i)?.[1] || '';
      const lastSeg = customMatches[customMatches.length - 1][1];
      const lastNum = lastSeg.match(/(\d+)$/)?.[1] || '';
      return prefix + 'IN' + lastNum;
    }
    const stdMatches = [...str.matchAll(/IN(\d+)/gi)];
    if (stdMatches.length > 1) return 'IN' + stdMatches[stdMatches.length - 1][1];
    return str;
  };

  return history.map(inv => {
    // Fix duplicate invoice number strings
    const fixedNum = fix(inv.invoiceNumber);

    // Parse items if stored as JSON string (from GS migration)
    const parseItems = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      try { return JSON.parse(raw); } catch { return []; }
    };

    // Normalize flat GS-migrated invoice into versioned shape
    // A properly shaped invoice has a `versions` array; flat ones don't
    let normalized;
    if (!Array.isArray(inv.versions) || inv.versions.length === 0) {
      const versionEntry = {
        invoiceNumber: fixedNum,
        invoiceDate: inv.invoiceDate || inv.date || '',
        items: parseItems(inv.items),
        totalAmount: parseFloat(inv.totalAmount) || 0,
        otherCharges: parseFloat(inv.otherCharges) || 0,
        roundOff: parseFloat(inv.roundOff) || 0,
        receivedAmount: parseFloat(inv.receivedAmount) || 0,
        paymentStatus: inv.paymentStatus || 'Pending',
        status: inv.status || 'Pending',
        version: 1,
        createdAt: inv.createdAt || new Date().toISOString(),
        id: inv.id || inv.invoiceNumber,
      };
      normalized = {
        invoiceNumber: fixedNum,
        customerName: inv.customerName || '',
        customerContact: normalizeContact(inv.customerContact || inv.contact || ''),
        customerGst: inv.customerGst || inv.gst || '',
        customerCity: inv.customerCity || inv.city || '',
        customerState: inv.customerState || inv.state || '',
        leadId: inv.leadId || '',
        latestVersion: 1,
        createdAt: inv.createdAt || new Date().toISOString(),
        updatedAt: inv.updatedAt || new Date().toISOString(),
        versions: [versionEntry],
      };
    } else if (fixedNum !== inv.invoiceNumber) {
      // Just fix the invoice number, keep versions
      normalized = {
        ...inv,
        invoiceNumber: fixedNum,
        versions: inv.versions.map(v => ({ ...v, invoiceNumber: fixedNum, items: parseItems(v.items) })),
      };
    } else {
      // Already properly shaped — just ensure items are parsed in each version
      normalized = {
        ...inv,
        versions: inv.versions.map(v => ({ ...v, items: parseItems(v.items) })),
      };
    }
    return normalized;
  });
}

export function AppProvider({ children }) {
  const fbEnabled = isFirebaseConfigured();

  // ── State — seeded from localStorage cache for instant render ──────────────
  const [leads, setLeads] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('indimart_leads') || 'null');
      if (!s || s.length === 0) { localStorage.setItem('indimart_leads', JSON.stringify(SAMPLE_LEADS)); return SAMPLE_LEADS; }
      return s;
    } catch { return SAMPLE_LEADS; }
  });
  const [products, setProducts] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('indimart_products') || 'null');
      if (!s || s.length === 0) { localStorage.setItem('indimart_products', JSON.stringify(SAMPLE_PRODUCTS)); return SAMPLE_PRODUCTS; }
      return s;
    } catch { return SAMPLE_PRODUCTS; }
  });
  const [invoiceHistory, setInvoiceHistory] = useState(() => {
    try { return sanitizeInvoiceNumbers(JSON.parse(localStorage.getItem('indimart_invoice_history') || '[]')); }
    catch { return []; }
  });
  const [companySettings, setCompanySettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('indimart_settings') || '{}') }; }
    catch { return DEFAULT_SETTINGS; }
  });
  const [messageTemplates, setMessageTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('indimart_templates') || '[]'); } catch { return []; }
  });

  // ── Firebase + GS state ───────────────────────────────────────────────────
  const [gsUrl, setGsUrl] = useState(() => localStorage.getItem('indimart_gsUrl') || '');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => localStorage.getItem('indimart_autoSync') === 'true');
  const [invoicesLoaded, setInvoicesLoaded] = useState(!fbEnabled);
  const [leadsLoaded, setLeadsLoaded] = useState(!fbEnabled);
  const [syncStatus, setSyncStatus] = useState({ status: fbEnabled ? 'syncing' : 'idle', text: fbEnabled ? 'Connecting...' : 'No Firebase' });
  const [syncBanner, setSyncBanner] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSection, setCurrentSection] = useState('dashboard');
  const unsubLeadsRef = useRef(null);
  const unsubInvoicesRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const persist = useCallback((key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, []);

  const showBanner = useCallback((msg, type = 'info') => {
    setSyncBanner({ msg, type });
    setTimeout(() => setSyncBanner(null), 5000);
  }, []);

  const updateSyncStatus = useCallback((status, text) => {
    setSyncStatus({ status, text });
  }, []);

  // ── GS background backup scheduler ───────────────────────────────────────
  const gsBackup = useCallback((overrides = {}) => {
    if (!gsUrl) return;
    scheduleGsBackup(gsUrl, {
      leads, invoices: invoiceHistory, products,
      settings: companySettings, templates: messageTemplates,
      ...overrides,
    });
  }, [gsUrl, leads, invoiceHistory, products, companySettings, messageTemplates]);

  // ── Firebase real-time listeners ──────────────────────────────────────────
  useEffect(() => {
    if (!fbEnabled) return;
    try { initFirebaseIfConfigured(); } catch (e) { console.error('Firebase init:', e); return; }

    // Leads listener
    unsubLeadsRef.current = fsListenLeads((fsLeads) => {
      setLeads(fsLeads);
      persist('indimart_leads', fsLeads);
      setLeadsLoaded(true);
      updateSyncStatus('connected', 'Live ✓');
    });

    // Invoices listener
    unsubInvoicesRef.current = fsListenInvoices((fsInvoices) => {
      setInvoiceHistory(sanitizeInvoiceNumbers(fsInvoices));
      persist('indimart_invoice_history', fsInvoices);
      setInvoicesLoaded(true);
    });

    // One-time fetch for products, templates, settings
    Promise.all([fsGetProducts(), fsGetTemplates(), fsGetSettings()]).then(([prods, tmpls, sett]) => {
      if (prods?.length) { setProducts(prods); persist('indimart_products', prods); }
      if (tmpls?.length) { setMessageTemplates(tmpls); persist('indimart_templates', tmpls); }
      if (sett) { setCompanySettings(s => { const n = { ...s, ...sett }; persist('indimart_settings', n); return n; }); }
    }).catch(e => console.warn('Firebase initial fetch:', e));

    return () => {
      unsubLeadsRef.current?.();
      unsubInvoicesRef.current?.();
    };
  }, [fbEnabled]); // eslint-disable-line

  // Retroactive sync of lead statuses based on invoice payment history
  // Business rule: Invoice generated + no payment = Quoted, Payment received = Won
  // If no invoice exists, demote from Won or Quoted status back to early pipeline stage.
  useEffect(() => {
    if (!invoicesLoaded || !leadsLoaded) return;

    // Build a map of leadId -> invoices for efficient lookup, utilizing contact-matching validation
    const invoicesByLeadId = {};
    (invoiceHistory || []).forEach(inv => {
      // 1. If explicit leadId is set on invoice, use it directly (highly robust for duplicates)
      if (inv.leadId) {
        if (!invoicesByLeadId[inv.leadId]) invoicesByLeadId[inv.leadId] = [];
        invoicesByLeadId[inv.leadId].push(inv);
        return;
      }
      // 2. Otherwise fall back to getLeadForInvoice contact matching
      const matchedLead = getLeadForInvoice(inv, leads);
      if (!matchedLead) return;
      if (!invoicesByLeadId[matchedLead.id]) invoicesByLeadId[matchedLead.id] = [];
      invoicesByLeadId[matchedLead.id].push(inv);
    });

    let needsUpdate = false;
    const fsUpdates = [];

    const updatedLeadsList = leads.map(l => {
      const leadInvoices = invoicesByLeadId[l.id] || [];
      
      if (leadInvoices.length === 0) {
        const isWon = DATA_CONFIG.getWonStatusLabels().includes(l.status);
        const isQuoted = DATA_CONFIG.getStatusGroupStatuses('quoted').includes(l.status);
        const hasPayment = l.paymentStatus !== 'Pending' || l.paymentReceivedAmount > 0;
        
        if (isWon || isQuoted || hasPayment) {
          needsUpdate = true;
          let newStatus = l.status;
          
          if (isWon || isQuoted) {
            let fallback = 'Contacted';
            const nonWonQuotedHistory = (l.history || [])
              .slice()
              .reverse()
              .find(h => h.status && 
                !DATA_CONFIG.getWonStatusLabels().includes(h.status) && 
                !DATA_CONFIG.getStatusGroupStatuses('quoted').includes(h.status)
              );
            if (nonWonQuotedHistory) {
              fallback = nonWonQuotedHistory.status;
            }
            newStatus = fallback;
          }
          
          const history = [...(l.history || [])];
          if (newStatus !== l.status) {
            history.push({ 
              status: newStatus, 
              timestamp: Date.now(), 
              note: `Demoted because no linked invoices exist` 
            });
          }
          
          const updatedLead = {
            ...l,
            paymentReceivedAmount: 0,
            paymentStatus: 'Pending',
            status: newStatus,
            history
          };
          fsUpdates.push({ id: l.id, data: {
            status: updatedLead.status,
            paymentReceivedAmount: updatedLead.paymentReceivedAmount,
            paymentStatus: updatedLead.paymentStatus,
            history: updatedLead.history
          }});
          return updatedLead;
        }
        return l;
      }

      // Process leads WITH invoices
      const totalReceived = leadInvoices.reduce((sum, inv) => {
        const v = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
        return sum + (parseFloat(v.receivedAmount) || 0);
      }, 0);
      const totalValue = leadInvoices.reduce((sum, inv) => {
        const v = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
        return sum + (parseFloat(v.totalAmount) || 0);
      }, 0);
      const paymentStatus = totalReceived >= totalValue && totalValue > 0 ? 'Paid' : totalReceived > 0 ? 'Partial' : 'Pending';
      
      let newStatus = l.status;
      if (totalReceived > 0) {
        // Payment received -> auto-sync to 'Won' only if it's not already in a Won status category
        if (!DATA_CONFIG.getWonStatusLabels().includes(l.status)) {
          newStatus = 'Won';
        }
      } else {
        // If payment is pending/0, set it to Quoted if it was in early pipeline stages
        if (['New Enquiry', 'Contacted', 'Requirement Discussed'].includes(l.status)) {
          newStatus = 'Quoted';
        }
      }
      
      const statusDiff = newStatus !== l.status;
      const amountDiff = l.paymentReceivedAmount !== totalReceived;
      const statusPayDiff = l.paymentStatus !== paymentStatus;
      
      if (statusDiff || amountDiff || statusPayDiff) {
        needsUpdate = true;
        const history = [...(l.history || [])];
        if (statusDiff) {
          history.push({ status: newStatus, timestamp: Date.now(), note: `Status auto-synced to ${newStatus} based on invoice payments` });
        }
        const updatedLead = {
          ...l,
          paymentReceivedAmount: totalReceived,
          paymentStatus: paymentStatus,
          status: newStatus,
          history
        };
        fsUpdates.push({ id: l.id, data: {
          status: updatedLead.status,
          paymentReceivedAmount: updatedLead.paymentReceivedAmount,
          paymentStatus: updatedLead.paymentStatus,
          history: updatedLead.history
        }});
        return updatedLead;
      }
      return l;
    });

    if (needsUpdate) {
      setLeads(updatedLeadsList);
      persist('indimart_leads', updatedLeadsList);
      if (fbEnabled) {
        fsUpdates.forEach(up => {
          fsUpdateLead(up.id, up.data).catch(console.error);
        });
      }
    }
  }, [invoiceHistory, leads, fbEnabled, persist, invoicesLoaded, leadsLoaded]);

  // ── Lead operations ───────────────────────────────────────────────────────
  const addLead = useCallback((leadData) => {
    setLeads(prev => {
      const lastNum = prev.filter(l => l.id?.startsWith('IM'))
        .map(l => parseInt(l.id.replace('IM', ''))).filter(n => !isNaN(n)).sort((a, b) => b - a)[0] || 0;
      const resolvedStatus = leadData.status || 'New Enquiry';
      const newLead = {
        paymentStatus: 'Pending', paymentReceivedAmount: 0, transactionId: '',
        dispatchDate: '', dispatchMethod: '', trackingId: '', materialReachedDate: '',
        customerFeedback: '', customerRating: '',
        ...leadData,
        contact: normalizeContact(leadData.contact || ''),
        id: 'IM' + (lastNum + 1).toString().padStart(3, '0'),
        status: resolvedStatus,
        orderValue: parseFloat(leadData.orderValue) || 0,
        timestamp: Date.now(),
        history: leadData.history?.length ? leadData.history : [{ status: resolvedStatus, timestamp: Date.now(), note: 'Lead created' }],
      };
      const updated = [...prev, newLead];
      persist('indimart_leads', updated);
      if (fbEnabled) fsSetLead(newLead).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]);

  const updateLead = useCallback((id, updates) => {
    // Normalize contact if being updated
    const normalizedUpdates = updates.contact
      ? { ...updates, contact: normalizeContact(updates.contact) }
      : updates;

    setLeads(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...normalizedUpdates } : l);
      persist('indimart_leads', updated);
      if (fbEnabled) fsUpdateLead(id, normalizedUpdates).catch(console.error);
      return updated;
    });

    // If name or contact changed, propagate to all linked invoices (outside setLeads to avoid nested updaters)
    if (normalizedUpdates.customerName !== undefined || normalizedUpdates.contact !== undefined) {
      setInvoiceHistory(prevInv => {
        const hasLinked = prevInv.some(inv => inv.leadId === id);
        if (!hasLinked) return prevInv;
        const changed = prevInv.map(inv => {
          if (inv.leadId !== id) return inv;
          const patch = {};
          if (normalizedUpdates.customerName !== undefined) patch.customerName = normalizedUpdates.customerName;
          if (normalizedUpdates.contact !== undefined) patch.customerContact = normalizeContact(normalizedUpdates.contact);
          const updatedInv = { ...inv, ...patch };
          if (fbEnabled) fsSetInvoice(updatedInv).catch(console.error);
          return updatedInv;
        });
        persist('indimart_invoice_history', changed);
        return changed;
      });
    }
  }, [persist, fbEnabled]);

  const updateLeadStatus = useCallback((id, newStatus) => {
    setLeads(prev => {
      const updated = prev.map(l => {
        if (l.id !== id) return l;
        const history = [...(l.history || []), { status: newStatus, timestamp: Date.now(), note: `Quick update from ${l.status}` }];
        const extra = {};
        if (newStatus === 'Material Dispatched' && !l.dispatchDate) extra.dispatchDate = new Date().toISOString().split('T')[0];
        if (newStatus === 'Material Reached' && !l.materialReachedDate) extra.materialReachedDate = new Date().toISOString().split('T')[0];
        return { ...l, status: newStatus, history, ...extra };
      });
      persist('indimart_leads', updated);
      const lead = updated.find(l => l.id === id);
      if (fbEnabled && lead) fsSetLead(lead).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]);

  const deleteLead = useCallback((id) => {
    setLeads(prev => {
      const u = prev.filter(l => l.id !== id);
      persist('indimart_leads', u);
      if (fbEnabled) fsDeleteLead(id).catch(console.error);
      return u;
    });
  }, [persist, fbEnabled]);

  // ── Product operations ────────────────────────────────────────────────────
  const addProduct = useCallback((productData) => {
    setProducts(prev => {
      const newProduct = { ...productData, id: 'P' + Date.now().toString().slice(-6) };
      const updated = [...prev, newProduct];
      persist('indimart_products', updated);
      if (fbEnabled) fsSetProduct(newProduct).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]);

  const updateProduct = useCallback((id, updates) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      persist('indimart_products', updated);
      if (fbEnabled) fsSetProduct(updated.find(p => p.id === id)).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]);

  const deleteProduct = useCallback((id) => {
    setProducts(prev => {
      const u = prev.filter(p => p.id !== id);
      persist('indimart_products', u);
      if (fbEnabled) fsDeleteProduct(id).catch(console.error);
      return u;
    });
  }, [persist, fbEnabled]);

  // ── Template operations ───────────────────────────────────────────────────
  const saveTemplate = useCallback((templateData) => {
    setMessageTemplates(prev => {
      let updated;
      if (templateData.id && prev.find(t => t.id === templateData.id)) {
        updated = prev.map(t => t.id === templateData.id ? { ...t, ...templateData } : t);
      } else {
        updated = [...prev, { ...templateData, id: 'TPL' + Date.now() }];
      }
      const tpl = updated.find(t => t.id === (templateData.id || updated[updated.length - 1]?.id));
      persist('indimart_templates', updated);
      if (fbEnabled && tpl) fsSetTemplate(tpl).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]);

  const deleteTemplate = useCallback((id) => {
    setMessageTemplates(prev => {
      const u = prev.filter(t => t.id !== id);
      persist('indimart_templates', u);
      if (fbEnabled) fsDeleteTemplate(id).catch(console.error);
      return u;
    });
  }, [persist, fbEnabled]);

  // ── Invoice operations ────────────────────────────────────────────────────
  const saveInvoiceToHistory = useCallback((invoiceData) => {
    setInvoiceHistory(prev => {
      if (!invoiceData.totalAmount && invoiceData.items) {
        invoiceData.totalAmount = invoiceData.items.reduce((s, it) => s + ((parseFloat(it.price) || 0) * (parseFloat(it.qty) || 1)), 0);
      }
      // Normalize contact for consistent cross-device matching
      const normContact = normalizeContact(invoiceData.customerContact || '');
      
      // Use getLeadForInvoice to find the correct lead based on customer contact
      const matchedLead = getLeadForInvoice({ ...invoiceData, customerContact: normContact }, leads);
      const resolvedLeadId = matchedLead ? matchedLead.id : '';

      const existing = prev.find(inv => inv.invoiceNumber === invoiceData.invoiceNumber);
      let updated, upserted;
      if (existing) {
        const nextVersion = (existing.versions?.length || 0) + 1;
        const versionEntry = { ...invoiceData, customerContact: normContact, leadId: resolvedLeadId, version: nextVersion, createdAt: new Date().toISOString(), id: `INV${Date.now()}` };
        const versions = existing.versions
          ? [...existing.versions, versionEntry]
          : [{ ...existing, version: 1, createdAt: existing.createdAt || new Date().toISOString() }, versionEntry];
        upserted = { ...existing,
          customerName: invoiceData.customerName,
          customerContact: normContact,
          customerGst: invoiceData.customerGst,
          customerCity: invoiceData.customerCity,
          customerState: invoiceData.customerState,
          leadId: resolvedLeadId || existing.leadId || '',
          updatedAt: new Date().toISOString(), versions, latestVersion: nextVersion };
        updated = prev.map(inv => inv.invoiceNumber === invoiceData.invoiceNumber ? upserted : inv);
      } else {
        upserted = {
          invoiceNumber: invoiceData.invoiceNumber,
          customerName: invoiceData.customerName,
          customerContact: normContact,
          customerGst: invoiceData.customerGst,
          customerCity: invoiceData.customerCity,
          customerState: invoiceData.customerState,
          leadId: resolvedLeadId, latestVersion: 1,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          versions: [{ ...invoiceData, customerContact: normContact, leadId: resolvedLeadId, version: 1, createdAt: new Date().toISOString(), id: `INV${Date.now()}` }],
        };
        updated = [...prev, upserted];
      }
      persist('indimart_invoice_history', updated);
      if (fbEnabled) fsSetInvoice(upserted).catch(console.error);

      // Auto update lead status when invoice is generated
      if (resolvedLeadId) {
        setLeads(prevLeads => {
          const updatedLeads = prevLeads.map(l => {
            if (l.id !== resolvedLeadId) return l;
            const newPayStatus = invoiceData.paymentStatus || 'Pending';
            let newStatus = l.status;
            
            if (['Paid', 'Partial'].includes(newPayStatus)) {
              newStatus = 'Won';
            } else {
              // If payment is pending, set status to Quoted if it is currently Won or pipeline
              if (['New Enquiry', 'Contacted', 'Requirement Discussed', ...DATA_CONFIG.getWonStatusLabels()].includes(l.status)) {
                newStatus = 'Quoted';
              }
            }
            
            const history = [...(l.history || [])];
            if (newStatus !== l.status) {
              history.push({ status: newStatus, timestamp: Date.now(), note: `Status auto-updated to ${newStatus} via Invoice generation` });
            }
            const updatedLead = { ...l, paymentStatus: newPayStatus, status: newStatus, history };
            if (fbEnabled) fsSetLead(updatedLead).catch(console.error);
            return updatedLead;
          });
          persist('indimart_leads', updatedLeads);
          return updatedLeads;
        });
      }

      return updated;
    });
  }, [persist, fbEnabled, leads]);

  function syncPaymentToLead(updatedHistory, invoiceNumber) {
    const inv = updatedHistory.find(i => i.invoiceNumber === invoiceNumber);
    if (!inv) return;
    setLeads(prevLeads => {
      const matchedLead = getLeadForInvoice(inv, prevLeads);
      if (!matchedLead) return prevLeads;
      
      const leadInvoices = updatedHistory.filter(i => {
        if (i.leadId && matchedLead.id) return i.leadId === matchedLead.id;
        const targetLead = getLeadForInvoice(i, prevLeads);
        return targetLead && targetLead.id === matchedLead.id;
      });
      const totalReceived = leadInvoices.reduce((sum, i) => {
        const v = i.versions?.length ? i.versions[i.versions.length - 1] : i;
        return sum + (parseFloat(v.receivedAmount) || 0);
      }, 0);
      const totalValue = leadInvoices.reduce((sum, i) => {
        const v = i.versions?.length ? i.versions[i.versions.length - 1] : i;
        return sum + (parseFloat(v.totalAmount) || 0);
      }, 0);
      const newPayStatus = totalReceived >= totalValue && totalValue > 0 ? 'Paid' : totalReceived > 0 ? 'Partial' : 'Pending';
      
      const updatedLeads = prevLeads.map(l => {
        if (l.id !== matchedLead.id) return l;
        
        return { ...l, paymentReceivedAmount: totalReceived, paymentStatus: newPayStatus };
      });
      persist('indimart_leads', updatedLeads);
      const updatedLead = updatedLeads.find(l => l.id === matchedLead.id);
      if (fbEnabled && updatedLead) {
        fsUpdateLead(matchedLead.id, { 
          paymentReceivedAmount: totalReceived, 
          paymentStatus: newPayStatus
        }).catch(console.error);
      }
      return updatedLeads;
    });
  }

  const updateInvoiceField = useCallback((invoiceNumber, field, value) => {
    setInvoiceHistory(prev => {
      const updated = prev.map(inv => {
        if (inv.invoiceNumber !== invoiceNumber) return inv;
        const versions = [...(inv.versions || [])];
        if (versions.length > 0) versions[versions.length - 1] = { ...versions[versions.length - 1], [field]: value };
        return { ...inv, [field]: value, versions };
      });
      persist('indimart_invoice_history', updated);
      syncPaymentToLead(updated, invoiceNumber);
      const upserted = updated.find(i => i.invoiceNumber === invoiceNumber);
      if (fbEnabled && upserted) fsSetInvoice(upserted).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]); // eslint-disable-line
  
  const updateInvoicePayment = useCallback((invoiceNumber, receivedAmount, totalAmount) => {
    const amt = parseFloat(receivedAmount) || 0;
    const total = parseFloat(totalAmount) || 0;
    const paymentStatus = amt >= total && total > 0 ? 'Paid' : amt > 0 ? 'Partial' : 'Pending';
    setInvoiceHistory(prev => {
      const updated = prev.map(inv => {
        if (inv.invoiceNumber !== invoiceNumber) return inv;
        const versions = [...(inv.versions || [])];
        if (versions.length > 0) versions[versions.length - 1] = { ...versions[versions.length - 1], receivedAmount: amt, paymentStatus };
        return { ...inv, versions };
      });
      persist('indimart_invoice_history', updated);
      syncPaymentToLead(updated, invoiceNumber);
      const upserted = updated.find(i => i.invoiceNumber === invoiceNumber);
      if (fbEnabled && upserted) fsSetInvoice(upserted).catch(console.error);
      return updated;
    });
  }, [persist, fbEnabled]); // eslint-disable-line

  const deleteInvoice = useCallback((invoiceNumber) => {
    setInvoiceHistory(prev => {
      const u = prev.filter(inv => inv.invoiceNumber !== invoiceNumber);
      persist('indimart_invoice_history', u);
      if (fbEnabled) fsDeleteInvoice(invoiceNumber).catch(console.error);
      return u;
    });
  }, [persist, fbEnabled]);

  const deleteInvoiceVersion = useCallback((invoiceNumber, versionIndex) => {
    setInvoiceHistory(prev => {
      const inv = prev.find(i => i.invoiceNumber === invoiceNumber);
      if (!inv) return prev;
      const versions = (inv.versions || []).filter((_, i) => i !== versionIndex);
      let updated;
      if (versions.length === 0) {
        // No versions left — delete whole invoice
        updated = prev.filter(i => i.invoiceNumber !== invoiceNumber);
        if (fbEnabled) fsDeleteInvoice(invoiceNumber).catch(console.error);
      } else {
        const latest = versions[versions.length - 1];
        const upserted = { ...inv, versions, latestVersion: versions.length, updatedAt: new Date().toISOString(),
          customerName: latest.customerName || inv.customerName };
        updated = prev.map(i => i.invoiceNumber === invoiceNumber ? upserted : i);
        if (fbEnabled) fsSetInvoice(upserted).catch(console.error);
      }
      persist('indimart_invoice_history', updated);
      return updated;
    });
  }, [persist, fbEnabled]);

  // ── Settings ──────────────────────────────────────────────────────────────
  const saveSettings = useCallback((newSettings) => {
    setCompanySettings(newSettings);
    persist('indimart_settings', newSettings);
    if (fbEnabled) fsSetSettings(newSettings).catch(console.error);
  }, [persist, fbEnabled]);

  // ── GS helpers (kept for migration + backup) ──────────────────────────────
  const saveGsUrl = useCallback((url) => {
    setGsUrl(url);
    localStorage.setItem('indimart_gsUrl', url);
  }, []);

  const toggleAutoSync = useCallback((enabled) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('indimart_autoSync', enabled ? 'true' : 'false');
  }, []);

  const getNextInvoiceNumber = useCallback(async () => {
    const invoiceFormat = companySettings.invoiceFormat || 'standard';
    const invoicePrefix = (companySettings.invoicePrefix || '').trim();
    // Resolve financial year string
    const resolveFY = () => {
      const saved = companySettings.invoiceFinYear;
      if (saved && saved !== 'auto') return saved;
      const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
      return m >= 3
        ? `${String(y).slice(-2)}-${String(y+1).slice(-2)}`
        : `${String(y-1).slice(-2)}-${String(y).slice(-2)}`;
    };
    // Resolve start number override (for new financial year)
    const startOverride = parseInt(companySettings.invoiceStartNumber) || null;
    const buildNumber = (maxNum) => {
      const nextNumber = startOverride || (maxNum + 1);
      if (invoiceFormat === 'custom' && invoicePrefix) {
        return `${invoicePrefix}/${resolveFY()}/IN${nextNumber}`;
      }
      return `IN${nextNumber}`;
    };
    if (fbEnabled) {
      try {
        const maxNum = await fsGetMaxInvoiceNumber();
        return buildNumber(maxNum);
      } catch (e) {
        console.warn('fsGetMaxInvoiceNumber failed, falling back to local state:', e);
      }
    }
    // Fallback: derive from local state (offline / no Firebase)
    return generateInvoiceNumber(invoiceHistory, companySettings);
  }, [fbEnabled, invoiceHistory, companySettings]);

  const testConnection = useCallback(async (url) => {
    try {
      updateSyncStatus('syncing', 'Testing...');
      await gsTestConnection(url);
      updateSyncStatus('connected', 'GS Connected ✓');
      showBanner('✅ Google Sheets connection successful!', 'success');
      return true;
    } catch (err) {
      updateSyncStatus('error', 'GS connection failed');
      showBanner('❌ GS Connection failed: ' + err.message, 'error');
      return false;
    }
  }, [updateSyncStatus, showBanner]);

  // pullFromSheets: used for migration — pulls GS data into local state + Firebase
  const pullFromSheets = useCallback(async () => {
    if (isSyncing || !gsUrl) return;
    setIsSyncing(true);
    updateSyncStatus('syncing', 'Pulling from Google Sheets...');
    try {
      const res = await gsPullAll(gsUrl);
      if (res.leads) { setLeads(res.leads); persist('indimart_leads', res.leads); }
      if (res.products?.length) { setProducts(res.products); persist('indimart_products', res.products); }
      if (res.settings) { setCompanySettings(s => { const n = { ...s, ...res.settings }; persist('indimart_settings', n); return n; }); }
      if (res.templates) { setMessageTemplates(res.templates); persist('indimart_templates', res.templates); }
      if (res.invoices) {
        const mapped = res.invoices.map(wrapInvoice);
        setInvoiceHistory(mapped); persist('indimart_invoice_history', mapped);
      }
      localStorage.setItem('indimart_lastSync', Date.now().toString());
      updateSyncStatus('connected', 'Pulled ✓');
      showBanner(`✅ Pulled data from Google Sheets.`, 'success');
    } catch (err) {
      updateSyncStatus('error', 'Pull failed');
      showBanner('❌ Pull failed: ' + err.message, 'error');
    } finally { setIsSyncing(false); }
  }, [isSyncing, gsUrl, persist, updateSyncStatus, showBanner]);

  // pushToSheets: manual backup push
  const pushToSheets = useCallback(async () => {
    if (isSyncing || !gsUrl) return;
    setIsSyncing(true);
    updateSyncStatus('syncing', 'Pushing to Google Sheets...');
    try {
      await new Promise((res, rej) => {
        const body = JSON.stringify({ action: 'syncAll', leads, products, settings: companySettings, invoices: flattenInvoices(invoiceHistory), templates: messageTemplates });
        fetch(gsUrl, { method: 'POST', body }).then(r => r.json()).then(d => d.success ? res(d) : rej(new Error(d.error))).catch(rej);
      });
      localStorage.setItem('indimart_lastSync', Date.now().toString());
      updateSyncStatus('connected', 'Synced ✓');
      showBanner(`✅ Pushed ${leads.length} leads to Google Sheets.`, 'success');
    } catch (err) {
      updateSyncStatus('error', 'Push failed');
      showBanner('❌ Push failed: ' + err.message, 'error');
    } finally { setIsSyncing(false); }
  }, [isSyncing, gsUrl, leads, products, companySettings, invoiceHistory, messageTemplates, updateSyncStatus, showBanner]);

  const fullSync = pushToSheets; // kept for API compat

  const clearLocalCache = useCallback(() => {
    ['indimart_leads', 'indimart_invoice_history', 'indimart_products', 'indimart_templates'].forEach(k => localStorage.removeItem(k));
    setLeads([]); setInvoiceHistory([]); setProducts([]); setMessageTemplates([]);
    showBanner('🗑️ Local cache cleared.', 'info');
  }, [showBanner]);

  const importCompleteData = useCallback(async (data) => {
    if (!data) throw new Error('No data provided');
    
    // 1. Update local state and persist to localStorage
    if (Array.isArray(data.leads)) {
      setLeads(data.leads);
      persist('indimart_leads', data.leads);
    }
    if (Array.isArray(data.products)) {
      setProducts(data.products);
      persist('indimart_products', data.products);
    }
    if (data.companySettings) {
      setCompanySettings(data.companySettings);
      persist('indimart_settings', data.companySettings);
    }
    if (Array.isArray(data.messageTemplates)) {
      setMessageTemplates(data.messageTemplates);
      persist('indimart_templates', data.messageTemplates);
    }
    if (Array.isArray(data.invoiceHistory)) {
      const mapped = sanitizeInvoiceNumbers(data.invoiceHistory);
      setInvoiceHistory(mapped);
      persist('indimart_invoice_history', mapped);
    }
    if (data.gsUrl !== undefined) {
      setGsUrl(data.gsUrl);
      localStorage.setItem('indimart_gsUrl', data.gsUrl);
    }

    // 2. If Firebase is active, sync all imported data to Firestore
    if (fbEnabled) {
      showBanner('Syncing imported data to Firebase...', 'info');
      try {
        if (data.companySettings) {
          await fsSetSettings(data.companySettings);
        }
        if (Array.isArray(data.leads)) {
          for (const l of data.leads) {
            await fsSetLead(l);
          }
        }
        if (Array.isArray(data.products)) {
          for (const p of data.products) {
            await fsSetProduct(p);
          }
        }
        if (Array.isArray(data.messageTemplates)) {
          for (const t of data.messageTemplates) {
            await fsSetTemplate(t);
          }
        }
        if (Array.isArray(data.invoiceHistory)) {
          for (const inv of data.invoiceHistory) {
            await fsSetInvoice(inv);
          }
        }
        showBanner('✅ Backup restored & synced to Firebase!', 'success');
      } catch (err) {
        showBanner('⚠️ Local restore succeeded, but Firebase sync failed: ' + err.message, 'warning');
      }
    } else {
      showBanner('✅ Backup restored locally!', 'success');
    }
  }, [fbEnabled, persist, showBanner]);

  // ── Auto GS backup when data changes (if GS URL set) ─────────────────────
  useEffect(() => {
    if (!autoSyncEnabled || !gsUrl) return;
    gsBackup();
  }, [leads, invoiceHistory, products, companySettings, messageTemplates]); // eslint-disable-line

  const value = {
    leads, products, invoiceHistory, companySettings, messageTemplates,
    gsUrl, autoSyncEnabled, syncStatus, syncBanner, isSyncing, currentSection,
    fbEnabled,
    setCurrentSection, addLead, updateLead, updateLeadStatus, deleteLead,
    addProduct, updateProduct, deleteProduct,
    saveTemplate, deleteTemplate,
    saveInvoiceToHistory, updateInvoiceField, updateInvoicePayment, deleteInvoice, deleteInvoiceVersion,
    saveSettings, saveGsUrl, toggleAutoSync, getNextInvoiceNumber,
    testConnection, pullFromSheets, pushToSheets, fullSync, clearLocalCache,
    importCompleteData,
    showBanner,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

function wrapInvoice(inv) {
  if (inv.versions?.length) return inv;
  return {
    invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, customerContact: inv.customerContact, customerGst: inv.customerGst, customerCity: inv.customerCity, customerState: inv.customerState, leadId: inv.leadId, latestVersion: 1, createdAt: inv.createdAt, updatedAt: inv.updatedAt,
    versions: [{ id: inv.id, invoiceNumber: inv.invoiceNumber, invoiceDate: inv.invoiceDate, items: inv.items, totalAmount: inv.totalAmount, otherCharges: inv.otherCharges || 0, roundOff: inv.roundOff || 0, status: inv.status, receivedAmount: inv.receivedAmount || 0, paymentStatus: inv.paymentStatus || 'Pending', version: 1, createdAt: inv.createdAt }],
  };
}
