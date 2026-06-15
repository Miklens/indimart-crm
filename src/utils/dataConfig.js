export const DATA_CONFIG = {
  statuses: {
    NEW_ENQUIRY: { label: 'New Enquiry', color: '#3b82f6', category: 'pipeline', stage: 1, isActive: true },
    CONTACTED: { label: 'Contacted', color: '#06b6d4', category: 'pipeline', stage: 2, isActive: true },
    QUOTED: { label: 'Quoted', color: '#f59e0b', category: 'quotation', stage: 3, isActive: true },
    NOT_RESPONDING: { label: 'Not Responding', color: '#94a3b8', category: 'lost', stage: 0, isActive: false },
    WON: { label: 'Won', color: '#10b981', category: 'won', stage: 4, isActive: true },
    LOST: { label: 'Lost', color: '#dc2626', category: 'lost', stage: 0, isActive: false },
    NOT_INTERESTED: { label: 'Not Interested', color: '#64748b', category: 'lost', stage: 0, isActive: false },
  },
  getStatusColor(status) {
    const clean = this.getSimpleStatusLabel(status);
    const found = Object.values(this.statuses).find(s => s.label === clean);
    return found ? found.color : '#94a3b8';
  },
  getLostStatuses() {
    return Object.values(this.statuses).filter(s => s.category === 'lost');
  },
  getLostStatusLabels() {
    return ['Lost', 'Closed Lost', 'Invalid Lead', 'No Response', 'No Current Requirement', 'Not Responding', 'Not Interested'];
  },
  getDeadStatusLabels() {
    return ['Lost', 'Closed Lost', 'Invalid Lead', 'No Response', 'No Current Requirement', 'Not Responding', 'Not Interested'];
  },
  getWonStatuses() {
    return Object.values(this.statuses).filter(s => s.category === 'won');
  },
  getWonStatusLabels() {
    return ['Won', 'Converted', 'Purchased', 'Repeat Customer', 'Material Dispatched', 'Material Reached'];
  },
  getContactedStatusLabels() {
    return ['Contacted', 'Requirement Discussed', 'Quoted', 'Quotation Requested', 'Quotation Sent', 'Negotiation', 'Won', 'Converted', 'Purchased', 'Repeat Customer', 'Material Dispatched', 'Material Reached'];
  },
  getSimpleStatusLabel(status) {
    const map = {
      'New Enquiry': 'New Enquiry',
      'Contacted': 'Contacted',
      'Requirement Discussed': 'Contacted',
      'Quotation Requested': 'Quoted',
      'Quotation Sent': 'Quoted',
      'Negotiation': 'Quoted',
      'Quoted': 'Quoted',
      'Converted': 'Won',
      'Purchased': 'Won',
      'Repeat Customer': 'Won',
      'Material Dispatched': 'Won',
      'Material Reached': 'Won',
      'Won': 'Won',
      'No Response': 'Not Responding',
      'Not Responding': 'Not Responding',
      'Not Interested': 'Not Interested',
      'No Current Requirement': 'Lost',
      'Invalid Lead': 'Lost',
      'Closed Lost': 'Lost',
      'Lost': 'Lost',
    };
    return map[status] || status || 'New Enquiry';
  },
  resolveStatusFromSimple(status) {
    return status;
  },
  getStatusGroupStatuses(group) {
    const groups = {
      all: ['New Enquiry', 'Contacted', 'Quoted', 'Not Responding', 'Won', 'Lost', 'Not Interested', 'Converted', 'Purchased', 'Repeat Customer', 'Material Dispatched', 'Material Reached'],
      pipeline: ['New Enquiry', 'Contacted', 'Requirement Discussed'],
      quoted: ['Quoted', 'Quotation Requested', 'Quotation Sent', 'Negotiation'],
      won: ['Won', 'Converted', 'Purchased', 'Repeat Customer', 'Material Dispatched', 'Material Reached'],
      inTransit: ['Material Dispatched'],
      delivered: ['Material Reached'],
      lost: ['Not Responding', 'Lost', 'Not Interested', 'Closed Lost', 'Invalid Lead', 'No Response', 'No Current Requirement'],
    };
    return groups[group] || [];
  },
  getStatusFilterOptions() {
    return [
      { id: 'all', label: 'All Statuses' },
      { id: 'pipeline', label: 'Pipeline' },
      { id: 'quoted', label: 'Quoted' },
      { id: 'won', label: 'Won' },
      { id: 'lost', label: 'Lost / Closed' },
    ];
  },
  getSimpleStatusOptions() {
    return [
      { label: 'New Enquiry', value: 'New Enquiry' },
      { label: 'Contacted', value: 'Contacted' },
      { label: 'Quoted', value: 'Quoted' },
      { label: 'Not Responding', value: 'Not Responding' },
      { label: 'Won', value: 'Won' },
      { label: 'Lost', value: 'Lost' },
      { label: 'Not Interested', value: 'Not Interested' },
    ];
  },
  sources: [
    'IndiaMART Direct', 'IndiaMART BuyLead', 'JustDial', 'Website',
    'Referral', 'WhatsApp', 'Email', 'Phone', 'Trade Show', 'Other'
  ],
  lostReasons: [
    'No Response', 'Not Interested', 'No Current Requirement', 'Price Too High',
    'Competitor Selected', 'Product Not Available', 'Location Issue', 'Invalid Contact', 'Other'
  ],
  allStatusLabels() {
    return ['New Enquiry', 'Contacted', 'Quoted', 'Not Responding', 'Won', 'Lost', 'Not Interested'];
  }
};

export function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function normalizeDisplayDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return formatDate(new Date(dateStr));
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

export function numberToWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ',
    'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ',
    'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const s = n.toString();
  if (s.length > 9) return 'overflow';
  const p = ('000000000' + s).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!p) return '';
  const seg = (g) => a[Number(g)] || b[Number(g[0])] + (a[Number(g[1])] ? ' ' + a[Number(g[1])] : '') + ' ';
  let str = '';
  str += Number(p[1]) ? seg(p[1]) + 'crore ' : '';
  str += Number(p[2]) ? seg(p[2]) + 'lakh ' : '';
  str += Number(p[3]) ? seg(p[3]) + 'thousand ' : '';
  str += Number(p[4]) ? a[Number(p[4])] + 'hundred ' : '';
  str += Number(p[5]) ? ((str !== '') ? 'and ' : '') + seg(p[5]) : '';
  return str.trim();
}

export function flattenInvoices(invoiceHistory) {
  return (invoiceHistory || []).map(inv => {
    const versions = inv.versions?.length ? inv.versions : [inv];
    const latest = versions[versions.length - 1];
    return {
      id: latest.id || inv.invoiceNumber,
      invoiceNumber: inv.invoiceNumber, invoiceDate: latest.invoiceDate,
      customerName: inv.customerName, customerContact: inv.customerContact,
      customerGst: inv.customerGst, customerCity: inv.customerCity, customerState: inv.customerState,
      leadId: inv.leadId, items: latest.items, totalAmount: latest.totalAmount,
      otherCharges: latest.otherCharges || 0, roundOff: latest.roundOff || 0,
      receivedAmount: latest.receivedAmount || 0, paymentStatus: latest.paymentStatus || 'Pending',
      status: latest.status, versions, latestVersion: inv.latestVersion || versions.length,
      createdAt: inv.createdAt, updatedAt: inv.updatedAt,
    };
  });
}

export function generateInvoiceNumber(invoiceHistory, companySettings) {
  const invoiceFormat = companySettings.invoiceFormat || 'standard';
  const invoicePrefix = (companySettings.invoicePrefix || '').trim();
  let nextNumber = 101;
  if (invoiceHistory && invoiceHistory.length > 0) {
    const maxInvoice = invoiceHistory.reduce((max, inv) => {
      const match = inv.invoiceNumber.match(/IN(\d+)$/i) || inv.invoiceNumber.match(/(\d+)$/);
      const num = match ? parseInt(match[1]) : 0;
      return num > max ? num : max;
    }, 0);
    if (maxInvoice > 0) nextNumber = maxInvoice + 1;
  }
  if (invoiceFormat === 'custom' && invoicePrefix) {
    const now = new Date();
    const yearCode = now.getFullYear().toString().slice(-2);
    const nextYearCode = (now.getFullYear() + 1).toString().slice(-2);
    return `${invoicePrefix}/${yearCode}-${nextYearCode}/IN${nextNumber}`;
  }
  return `IN${nextNumber}`;
}

export function normalizeContact(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

export function getLeadForInvoice(inv, leadsList) {
  if (!inv || !leadsList) return null;
  const normInvContact = normalizeContact(inv.customerContact || inv.contact);
  
  if (normInvContact) {
    const matchingLeads = leadsList.filter(l => normalizeContact(l.contact) === normInvContact);
    if (matchingLeads.length > 0) {
      const exactMatch = matchingLeads.find(l => l.id === inv.leadId);
      if (exactMatch) return exactMatch;
      return matchingLeads.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    }
  }
  
  if (inv.leadId) {
    const lead = leadsList.find(l => l.id === inv.leadId);
    if (lead) {
      const normLeadContact = normalizeContact(lead.contact);
      if (!normLeadContact || !normInvContact || normLeadContact === normInvContact) {
        return lead;
      }
    }
  }
  return null;
}

// Add these to DATA_CONFIG export
DATA_CONFIG.normalizeContact = normalizeContact;
DATA_CONFIG.getLeadForInvoice = getLeadForInvoice;
