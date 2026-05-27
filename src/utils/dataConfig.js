export const DATA_CONFIG = {
  statuses: {
    NEW_ENQUIRY: { label: 'New Enquiry', color: '#3b82f6', category: 'pipeline', stage: 1, isActive: true },
    CONTACTED: { label: 'Contacted', color: '#06b6d4', category: 'pipeline', stage: 2, isActive: true },
    REQUIREMENT_DISCUSSED: { label: 'Requirement Discussed', color: '#8b5cf6', category: 'pipeline', stage: 3, isActive: true },
    QUOTATION_REQUESTED: { label: 'Quotation Requested', color: '#f59e0b', category: 'quotation', stage: 4, isActive: true },
    QUOTATION_SENT: { label: 'Quotation Sent', color: '#f97316', category: 'quotation', stage: 5, isActive: true },
    NEGOTIATION: { label: 'Negotiation', color: '#ec4899', category: 'quotation', stage: 6, isActive: true },
    CONVERTED: { label: 'Converted', color: '#10b981', category: 'won', stage: 7, isActive: true },
    PURCHASED: { label: 'Purchased', color: '#059669', category: 'won', stage: 8, isActive: true },
    REPEAT_CUSTOMER: { label: 'Repeat Customer', color: '#047857', category: 'won', stage: 9, isActive: true },
    MATERIAL_DISPATCHED: { label: 'Material Dispatched', color: '#0284c7', category: 'won', stage: 10, isActive: true },
    MATERIAL_REACHED: { label: 'Material Reached', color: '#0891b2', category: 'won', stage: 11, isActive: true },
    NO_RESPONSE: { label: 'No Response', color: '#94a3b8', category: 'lost', stage: 0, isActive: false },
    NOT_INTERESTED: { label: 'Not Interested', color: '#64748b', category: 'lost', stage: 0, isActive: false },
    NO_CURRENT_REQUIREMENT: { label: 'No Current Requirement', color: '#475569', category: 'lost', stage: 0, isActive: false },
    INVALID_LEAD: { label: 'Invalid Lead', color: '#ef4444', category: 'lost', stage: 0, isActive: false },
    CLOSED_LOST: { label: 'Closed Lost', color: '#dc2626', category: 'lost', stage: 0, isActive: false },
  },
  getStatusColor(status) {
    const found = Object.values(this.statuses).find(s => s.label === status);
    return found ? found.color : '#94a3b8';
  },
  getLostStatuses() {
    return Object.values(this.statuses).filter(s => s.category === 'lost');
  },
  getLostStatusLabels() {
    return this.getLostStatuses().map(s => s.label);
  },
  getDeadStatusLabels() {
    return Object.values(this.statuses).filter(s => !s.isActive).map(s => s.label);
  },
  getWonStatuses() {
    return Object.values(this.statuses).filter(s => s.category === 'won');
  },
  getWonStatusLabels() {
    return this.getWonStatuses().map(s => s.label);
  },
  getContactedStatusLabels() {
    return Object.values(this.statuses)
      .filter(s => s.label !== 'New Enquiry' && s.label !== 'Invalid Lead')
      .map(s => s.label);
  },
  getSimpleStatusLabel(status) {
    const map = {
      'Quotation Requested': 'Quoted',
      'Quotation Sent': 'Quoted',
      'Converted': 'Won',
      'Purchased': 'Won',
      'Repeat Customer': 'Won',
      'Material Dispatched': 'In Transit',
      'Material Reached': 'Delivered',
      'No Response': 'Lost',
      'Not Interested': 'Lost',
      'No Current Requirement': 'Lost',
      'Invalid Lead': 'Lost',
      'Closed Lost': 'Lost',
    };
    return map[status] || status;
  },
  resolveStatusFromSimple(status) {
    const map = {
      'Quoted': 'Quotation Sent',
      'Won': 'Converted',
      'In Transit': 'Material Dispatched',
      'Delivered': 'Material Reached',
      'Lost': 'Closed Lost',
    };
    return map[status] || status;
  },
  getStatusGroupStatuses(group) {
    const groups = {
      all: this.allStatusLabels(),
      pipeline: ['New Enquiry', 'Contacted', 'Requirement Discussed'],
      quoted: ['Quotation Requested', 'Quotation Sent', 'Negotiation'],
      negotiation: ['Negotiation'],
      won: ['Converted', 'Purchased', 'Repeat Customer'],
      inTransit: ['Material Dispatched'],
      delivered: ['Material Reached'],
      lost: this.getLostStatusLabels(),
    };
    return groups[group] || [];
  },
  getStatusFilterOptions() {
    return [
      { id: 'all', label: 'All Statuses' },
      { id: 'pipeline', label: 'Pipeline' },
      { id: 'quoted', label: 'Quoted' },
      { id: 'negotiation', label: 'Negotiation' },
      { id: 'won', label: 'Won' },
      { id: 'inTransit', label: 'In Transit' },
      { id: 'delivered', label: 'Delivered' },
      { id: 'lost', label: 'Lost' },
    ];
  },
  getSimpleStatusOptions() {
    return [
      { label: 'New Enquiry', value: 'New Enquiry' },
      { label: 'Contacted', value: 'Contacted' },
      { label: 'Requirement Discussed', value: 'Requirement Discussed' },
      { label: 'Quoted', value: 'Quoted' },
      { label: 'Negotiation', value: 'Negotiation' },
      { label: 'Won', value: 'Won' },
      { label: 'In Transit', value: 'In Transit' },
      { label: 'Delivered', value: 'Delivered' },
      { label: 'Lost', value: 'Lost' },
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
    return Object.values(this.statuses).map(s => s.label);
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
