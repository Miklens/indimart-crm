import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Printer, Save, Edit3, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { numberToWords, formatDate } from '../utils/dataConfig';

const CE = ({ id, style, children, onBlur }) => <span id={id} contentEditable suppressContentEditableWarning onBlur={onBlur} style={{ outline: 'none', ...style }}>{children}</span>;

export default function InvoiceModal({ leadId, invoice: existingInvoice, onClose, initialItems, isDuplicate }) {
  const { leads, invoiceHistory, products, companySettings: c, saveInvoiceToHistory, getNextInvoiceNumber, showBanner, updateLead } = useApp();
  const inv = existingInvoice;
  const lead = (leadId || inv?.leadId) ? leads.find(l => l.id === (leadId || inv.leadId)) : null;
  const latest = inv?.versions?.length ? inv.versions[inv.versions.length - 1] : inv;

  const cust = useMemo(() => {
    return lead ? lead : inv ? {
      customerName: inv.customerName || latest?.customerName || '',
      contact: inv.customerContact || inv.contact || latest?.customerContact || '',
      gst: inv.customerGst || inv.gst || latest?.customerGst || '',
      city: inv.customerCity || inv.city || latest?.customerCity || '',
      state: inv.customerState || inv.state || latest?.customerState || '',
      id: inv.leadId || '',
    } : {};
  }, [lead, inv, latest]);

  // Resolve items — exact same logic as old HTML generateInvoice()
  const resolvedItems = (() => {
    // 1. initialItems from picker (highest priority)
    if (initialItems?.length) {
      const real = initialItems.filter(it => it.name?.trim());
      if (real.length) return real;
    }
    // 2. Existing saved invoice version items
    if (latest?.items?.length) {
      const real = latest.items.filter(it => it.name?.trim());
      if (real.length) return real;
    }
    // 3. From lead — exact same as old HTML:
    // lead.productList OR fallback to [{ name: lead.product, price: lead.orderValue, qty: 1 }]
    const rawList = (lead?.productList?.length)
      ? lead.productList
      : lead?.product?.trim()
        ? [{ name: lead.product.trim(), price: lead.orderValue || 0, qty: lead.qty || 1, hsn: lead.hsn || '', gst: '5', unit: 'Ltr' }]
        : [];
    // Catalog fallback — fill missing gst/hsn from products catalog (same as old HTML)
    return rawList.map(item => {
      if (!item.gst || !item.hsn) {
        const cat = (products || []).find(p => p.name === item.name);
        if (cat) return { ...item, gst: item.gst || cat.gst || '5', hsn: item.hsn || cat.hsn || '' };
      }
      return { ...item, gst: item.gst || '5', unit: item.unit || 'Ltr' };
    }).filter(it => it.name?.trim());
  })();

  // All editable values kept in state so saves always capture latest values
  const [rawItems, setRawItems] = useState(() =>
    resolvedItems.length ? resolvedItems : [{ name: '', qty: 1, price: 0, gst: '5', hsn: '', unit: 'Ltr' }]
  );
  const [invNo, setInvNo] = useState(() => isDuplicate ? '' : (latest?.invoiceNumber || inv?.invoiceNumber || ''));
  const [invDate, setInvDate] = useState(() => latest?.invoiceDate || formatDate(new Date()));

  // Fetch invoice number from Firestore (async, cross-device safe)
  useEffect(() => {
    if (invNo) return; // already have a number (viewing existing invoice)
    let cancelled = false;
    getNextInvoiceNumber().then(num => {
      if (!cancelled) setInvNo(num);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const updateItem = (idx, field, val) => { setIsDirty(true); setRawItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it)); };
  const addItem = () => { setIsDirty(true); setRawItems(prev => [...prev, { name: '', qty: 1, price: 0, gst: '5', hsn: '', unit: 'Ltr' }]); };
  const removeItem = (idx) => { setIsDirty(true); setRawItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev); };

  const [freight, setFreight] = useState(latest?.otherCharges || 0);
  const markDirty = () => setIsDirty(true);
  const [roundOffOverride, setRoundOffOverride] = useState(null); // null = auto-calculate
  // Auto-open edit mode if no real items exist so user can fill them in
  const hasRealItems = resolvedItems.some(it => it.name?.trim());
  const [editMode, setEditMode] = useState(!hasRealItems);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [isDirty, setIsDirty] = useState(!existingInvoice || isDuplicate); // new or duplicated invoices start dirty

  // Consignee state — separate from buyer, defaults to same or loaded from invoice/version
  const [consigneeName, setConsigneeName] = useState(() => latest?.consigneeName || inv?.consigneeName || cust.customerName || '');
  const [consigneeAddr, setConsigneeAddr] = useState(() => latest?.consigneeAddr || inv?.consigneeAddr || (cust.city ? `${cust.city}${cust.state ? ', ' + cust.state : ''}` : ''));
  const [consigneeState, setConsigneeState] = useState(() => latest?.consigneeState || inv?.consigneeState || cust.state || '');
  const [consigneeMob, setConsigneeMob] = useState(() => latest?.consigneeMob || inv?.consigneeMob || cust.contact || '');
  const [consigneeGst, setConsigneeGst] = useState(() => latest?.consigneeGst || inv?.consigneeGst || cust.gst || cust.customerGst || '-');

  // Buyer state — tracks live edits to the Buyer fields
  const [buyerName, setBuyerName] = useState(() => latest?.customerName || inv?.customerName || cust.customerName || '');
  const [buyerContact, setBuyerContact] = useState(() => latest?.customerContact || inv?.customerContact || cust.contact || '');
  const [buyerGst, setBuyerGst] = useState(() => latest?.customerGst || inv?.customerGst || cust.gst || cust.customerGst || '-');
  const [buyerCity, setBuyerCity] = useState(() => latest?.customerCity || inv?.customerCity || cust.city || '');
  const [buyerState, setBuyerState] = useState(() => latest?.customerState || inv?.customerState || cust.state || '');

  // Company details state
  const [compName, setCompName] = useState(() => latest?.companyName || c.name || '');
  const [compAddress, setCompAddress] = useState(() => latest?.companyAddress || c.address || '');
  const [compGst, setCompGst] = useState(() => latest?.companyGst || c.companyGst || c.gst || '');
  const [compMobile, setCompMobile] = useState(() => latest?.companyMobile || c.mobile || '');
  const [compEmail, setCompEmail] = useState(() => latest?.companyEmail || c.email || '');
  const [compBankName, setCompBankName] = useState(() => latest?.companyBankName || c.bankName || '');
  const [compAccNo, setCompAccNo] = useState(() => latest?.companyAccNo || c.accNo || '');
  const [compBranch, setCompBranch] = useState(() => latest?.companyBranch || c.branch || '');
  const [compIfsc, setCompIfsc] = useState(() => latest?.companyIfsc || c.ifsc || '');
  const [compVat, setCompVat] = useState(() => latest?.companyVat || c.vat || '');
  const [compCst, setCompCst] = useState(() => latest?.companyCst || c.cst || '');
  const [compPan, setCompPan] = useState(() => latest?.companyPan || c.pan || '');

  // Metadata fields state
  const [deliveryNote, setDeliveryNote] = useState(() => latest?.deliveryNote || '');
  const [paymentTerms, setPaymentTerms] = useState(() => latest?.paymentTerms || 'Advance');
  const [supplierRef, setSupplierRef] = useState(() => latest?.supplierRef || '');
  const [otherRef, setOtherRef] = useState(() => latest?.otherRef || 'Freight Terms- To Pay Basis');
  const [buyerOrderNo, setBuyerOrderNo] = useState(() => latest?.buyerOrderNo || '');
  const [buyerOrderDate, setBuyerOrderDate] = useState(() => latest?.buyerOrderDate || '');
  const [despatchedThrough, setDespatchedThrough] = useState(() => latest?.despatchedThrough || lead?.dispatchMethod || '');
  const [destination, setDestination] = useState(() => latest?.destination || cust.city || '');
  const [termsOfDelivery, setTermsOfDelivery] = useState(() => latest?.termsOfDelivery || '');

  // Totals calc
  let subtotal = 0, totalQty = 0;
  const taxGroups = {};
  rawItems.forEach(item => {
    const base = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
    const rate = parseFloat(item.gst) || 5;
    subtotal += base; totalQty += (parseFloat(item.qty) || 0);
    taxGroups[rate] = (taxGroups[rate] || 0) + base * (rate / 100);
  });
  const totalTax = Object.values(taxGroups).reduce((s, v) => s + v, 0);
  const rawTotal = subtotal + totalTax + parseFloat(freight || 0);
  const autoRoundOff = Math.round(rawTotal) - rawTotal;
  const roundOff = roundOffOverride !== null ? parseFloat(roundOffOverride) || 0 : autoRoundOff;
  const grandTotal = rawTotal + roundOff;
  const isInterstate = (cust.state || '').toLowerCase().trim() !== (c.state || '').toLowerCase().trim();

  // Split items for page 2 if >8
  const PAGE1_ROWS = 8;
  const page1Items = rawItems.slice(0, PAGE1_ROWS);
  const page2Items = rawItems.slice(PAGE1_ROWS);
  const showPage2 = page2Items.length > 0;

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const saveVersion = useCallback(async () => {
    if (saving) return; // prevent double-save
    setSaving(true);
    const finalNo = invNo;
    const finalDate = invDate;
    try {
      await new Promise(resolve => {
        saveInvoiceToHistory({
          invoiceNumber: finalNo, invoiceDate: finalDate,
          customerName: buyerName, customerContact: buyerContact,
          customerGst: buyerGst || '-',
          customerCity: buyerCity || '', customerState: buyerState || '',
          leadId: cust.id || leadId, items: rawItems, totalAmount: grandTotal,
          otherCharges: parseFloat(freight) || 0, roundOff,
          receivedAmount: isDuplicate ? 0 : (latest?.receivedAmount || 0),
          paymentStatus: isDuplicate ? 'Pending' : (latest?.paymentStatus || 'Pending'),
          status: 'Sent',
          consigneeName,
          consigneeAddr,
          consigneeState,
          consigneeMob,
          consigneeGst,
          // Company details
          companyName: compName,
          companyAddress: compAddress,
          companyGst: compGst,
          companyMobile: compMobile,
          companyEmail: compEmail,
          companyBankName: compBankName,
          companyAccNo: compAccNo,
          companyBranch: compBranch,
          companyIfsc: compIfsc,
          companyVat: compVat,
          companyCst: compCst,
          companyPan: compPan,
          // Metadata
          deliveryNote,
          paymentTerms,
          supplierRef,
          otherRef,
          buyerOrderNo,
          buyerOrderDate,
          despatchedThrough,
          destination,
          termsOfDelivery,
        });
        resolve();
      });
      showBanner(`✅ Invoice ${finalNo} saved!`, 'success');
      setSavedToast(true);
      setIsDirty(false);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (e) {
      showBanner(`❌ Save failed: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [saving, invNo, invDate, cust, leadId, rawItems, grandTotal, freight, roundOff, latest, saveInvoiceToHistory, showBanner, setSavedToast, setIsDirty, consigneeName, consigneeAddr, consigneeState, consigneeMob, consigneeGst, buyerName, buyerContact, buyerGst, buyerCity, buyerState, isDuplicate, compName, compAddress, compGst, compMobile, compEmail, compBankName, compAccNo, compBranch, compIfsc, compVat, compCst, compPan, deliveryNote, paymentTerms, supplierRef, otherRef, buyerOrderNo, buyerOrderDate, despatchedThrough, destination, termsOfDelivery]);

  const handlePrint = () => {
    // Save if: new invoice (not yet in history) OR user made changes (isDirty)
    const alreadySaved = invoiceHistory.some(i => i.invoiceNumber === invNo);
    if (!alreadySaved || isDirty) saveVersion();

    const src = document.getElementById('printRoot');
    if (!src) return;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Allow popups for this site to print.'); return; }

    // DO NOT copy parent stylesheets — they contain dark-mode CSS vars that make text invisible.
    // Use self-contained styles only.
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Invoice ${invNo}</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; color: #000;
          font-family: Arial, Helvetica, sans-serif; font-size: 10pt; }
        .no-print { display: none !important; }
        #printRoot { padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        td, th { padding: 3px 5px; }
        #invoiceContent, #invoiceContentPage2 {
          width: 210mm; margin: 0 auto; background: #fff !important;
          box-shadow: none !important; color: #000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #invoiceContent *, #invoiceContentPage2 * { color: #000 !important; }
        .grand-total-row { background: #f8fafc !important; font-weight: bold; }
        @page { margin: 8mm; size: A4; }
        @media print {
          #invoiceContent, #invoiceContentPage2 { margin: 0 !important; }
          [contenteditable] { cursor: default !important; border: none !important; outline: none !important; }
        }
      </style>
    </head><body>${src.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      setTimeout(() => win.close(), 1200);
    }, 450);
  };

  const handleExcelExport = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = c.name || 'Indimart';
      wb.created = new Date();
      const ws = wb.addWorksheet('Invoice ' + invNo);

      // Column widths
      ws.columns = [
        { width: 5 },  // A - Sl
        { width: 14 }, // B - HSN
        { width: 34 }, // C - Description
        { width: 10 }, // D - Qty
        { width: 8 },  // E - Unit
        { width: 13 }, // F - Rate
        { width: 7 },  // G - GST%
        { width: 15 }, // H - Amount
      ];

      // Reusable style helpers
      const thin = { style: 'thin' };
      const bord = { border: { top: thin, bottom: thin, left: thin, right: thin } };
      const boldF = { bold: true };

      const setCell = (r, col, val, font, align, fill, border) => {
        const cl = ws.getCell(r, col);
        cl.value = val;
        if (font) cl.font = font;
        if (align) cl.alignment = align;
        if (fill) cl.fill = fill;
        if (border) cl.border = border;
        return cl;
      };
      const m = (r1, c1, r2, c2) => ws.mergeCells(r1, c1, r2, c2);
      const blueHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAF8' } };
      const greenFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5F5E3' } };
      const darkGreen  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D8348' } };
      const centerM    = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const rightM     = { horizontal: 'right',  vertical: 'middle' };
      const leftM      = { horizontal: 'left',   vertical: 'middle', wrapText: true };

      let row = 1;

      // ── TITLE ──────────────────────────────────────────────────────────────
      m(row, 1, row, 8);
      setCell(row, 1, 'PROFORMA INVOICE', { bold: true, size: 14 }, centerM);
      ws.getRow(row).height = 24;
      row++;

      // ── COMPANY HEADER ─────────────────────────────────────────────────────
      m(row, 1, row, 8);
      setCell(row, 1, c.name || 'Your Company', { bold: true, size: 12 }, centerM);
      ws.getRow(row).height = 18; row++;

      m(row, 1, row, 8);
      setCell(row, 1, c.address || '', null, centerM);
      row++;

      m(row, 1, row, 8);
      setCell(row, 1,
        `GSTIN: ${c.companyGst || c.gst || '-'}  |  Mob: ${c.mobile || '-'}  |  Email: ${c.email || '-'}`,
        { size: 9 }, centerM);
      row++;

      row++; // spacer

      // ── BUYER / INVOICE META ───────────────────────────────────────────────
      // Left 4 cols = buyer/consignee, Right 4 cols = invoice fields
      const metaData = [
        ['Buyer:', cust.customerName || '-', 'Invoice No.:', invNo],
        [cust.gst ? `GSTIN: ${cust.gst}` : '', `${cust.city || ''}${cust.state ? ', '+cust.state : ''}`, 'Date:', invDate],
        [`Mob: ${cust.contact || '-'}`, '', 'Payment Terms:', 'Advance'],
        ['', '', 'Freight Terms:', 'To Pay Basis'],
        ['Consignee:', consigneeName || cust.customerName || '-', 'Dispatched Through:', lead?.dispatchMethod || '-'],
        [`Mob: ${consigneeMob || cust.contact || '-'}`, consigneeAddr || '', 'Destination:', cust.city || '-'],
        [`GSTIN: ${consigneeGst || '-'}`, '', 'Supplier Ref:', '-'],
      ];
      metaData.forEach(([la, lb, ra, rb]) => {
        m(row, 1, row, 2); setCell(row, 1, la, la.endsWith(':') || la === 'Buyer:' || la === 'Consignee:' ? boldF : null, leftM);
        m(row, 3, row, 4); setCell(row, 3, lb, null, leftM);
        m(row, 5, row, 6); setCell(row, 5, ra, boldF, leftM);
        m(row, 7, row, 8); setCell(row, 7, rb, null, leftM);
        row++;
      });

      row++; // spacer

      // ── ITEMS TABLE HEADER ─────────────────────────────────────────────────
      ['Sl.', 'HSN Code', 'Description of Goods', 'Qty', 'Unit', 'Rate (₹)', 'GST%', 'Amount (₹)']
        .forEach((h, i) => setCell(row, i+1, h, boldF, centerM, blueHeader, bord.border));
      ws.getRow(row).height = 18;
      row++;

      // ── ITEM ROWS ──────────────────────────────────────────────────────────
      rawItems.forEach((item, i) => {
        const amt = (parseFloat(item.price)||0) * (parseFloat(item.qty)||1);
        setCell(row, 1, i+1,                              null,  centerM, null, bord.border);
        setCell(row, 2, item.hsn || '-',                  null,  centerM, null, bord.border);
        setCell(row, 3, item.name || '',                  null,  leftM,   null, bord.border);
        setCell(row, 4, parseFloat(item.qty)||0,          null,  rightM,  null, bord.border); ws.getCell(row,4).numFmt = '0.00';
        setCell(row, 5, item.unit || 'Ltr',               null,  centerM, null, bord.border);
        setCell(row, 6, parseFloat(item.price)||0,        null,  rightM,  null, bord.border); ws.getCell(row,6).numFmt = '#,##0.00';
        setCell(row, 7, `${item.gst||'5'}%`,              null,  centerM, null, bord.border);
        setCell(row, 8, parseFloat(amt.toFixed(2)),       null,  rightM,  null, bord.border); ws.getCell(row,8).numFmt = '#,##0.00';
        row++;
      });

      // Totals row
      m(row,1,row,3); setCell(row,1,'Total', boldF, rightM, blueHeader, bord.border);
      setCell(row,4, parseFloat(totalQty.toFixed(2)), boldF, rightM, blueHeader, bord.border); ws.getCell(row,4).numFmt='0.00';
      setCell(row,5,'', null,null,blueHeader,bord.border);
      setCell(row,6,'', null,null,blueHeader,bord.border);
      setCell(row,7,'', null,null,blueHeader,bord.border);
      setCell(row,8, parseFloat(subtotal.toFixed(2)), boldF, rightM, blueHeader, bord.border); ws.getCell(row,8).numFmt='#,##0.00';
      row++;

      row++; // spacer

      // ── TAX BREAKDOWN ──────────────────────────────────────────────────────
      m(row,1,row,8); setCell(row,1,'TAX BREAKDOWN', boldF, centerM, blueHeader); row++;

      const taxLine = (label, amount) => {
        m(row,1,row,6); setCell(row,1, label, boldF, leftM, null, bord.border);
        m(row,7,row,8); setCell(row,7, parseFloat(amount.toFixed(2)), null, rightM, null, bord.border);
        ws.getCell(row,7).numFmt = '#,##0.00';
        row++;
      };

      taxLine('Subtotal', subtotal);
      Object.entries(taxGroups).sort(([a2],[b2])=>+a2-+b2).forEach(([rate, taxAmt]) => {
        if (isInterstate) {
          taxLine(`IGST @ ${rate}%`, taxAmt);
        } else {
          taxLine(`CGST @ ${rate/2}%`, taxAmt/2);
          taxLine(`SGST @ ${rate/2}%`, taxAmt/2);
        }
      });
      taxLine(`Other Charges (Freight/Pkg)`, parseFloat(freight||0));
      taxLine(`Round Off (+/-)`, roundOff);

      // Grand Total row
      m(row,1,row,6);
      setCell(row,1,'GRAND TOTAL', { bold:true, size:11, color:{argb:'FFFFFFFF'} }, centerM, darkGreen, bord.border);
      m(row,7,row,8);
      setCell(row,7, parseFloat(grandTotal.toFixed(2)), { bold:true, size:11, color:{argb:'FFFFFFFF'} }, rightM, darkGreen, bord.border);
      ws.getCell(row,7).numFmt = '#,##0.00';
      ws.getRow(row).height = 18;
      row++;

      row++;

      // Amount in words
      const words = numberToWords(Math.floor(Math.abs(grandTotal)));
      const wordsStr = words ? words.charAt(0).toUpperCase() + words.slice(1) + ' Rupees Only' : '-';
      m(row,1,row,8);
      setCell(row,1, `Amount in Words: ${wordsStr}`, { bold:true, italic:true }, leftM, greenFill, bord.border);
      row++;

      row++;

      // ── BANK DETAILS + TAX REGISTRATION ───────────────────────────────────
      m(row,1,row,4); setCell(row,1,"Company's Bank Details",    boldF, leftM, blueHeader, bord.border);
      m(row,5,row,8); setCell(row,5,"Company's Tax Registration", boldF, leftM, blueHeader, bord.border);
      row++;

      [
        [`Bank Name : ${c.bankName||'-'}`,   `GST No.  : ${c.companyGst||c.gst||'-'}`],
        [`A/c No.   : ${c.accNo||'-'}`,       `PAN      : ${c.pan||'-'}`],
        [`Branch    : ${c.branch||'-'}`,      `VAT TIN  : ${c.vat||'-'}`],
        [`IFSC Code : ${c.ifsc||'-'}`,        `CST No.  : ${c.cst||'-'}`],
      ].forEach(([l, r2]) => {
        m(row,1,row,4); setCell(row,1, l, null, leftM, null, bord.border);
        m(row,5,row,8); setCell(row,5, r2, null, leftM, null, bord.border);
        row++;
      });

      row++;

      // ── DECLARATION ────────────────────────────────────────────────────────
      m(row,1,row,8);
      setCell(row,1,
        'Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
        { italic:true, size:9 }, leftM, null, bord.border);
      ws.getRow(row).height = 30;
      row++;

      row++;

      // ── PAYMENT STATUS ─────────────────────────────────────────────────────
      m(row,1,row,8); setCell(row,1,'Payment Information', boldF, leftM, blueHeader, bord.border); row++;

      m(row,1,row,4); setCell(row,1, `Payment Status : ${latest?.paymentStatus||'Pending'}`, null, leftM, null, bord.border);
      m(row,5,row,8); setCell(row,5, `Amount Received: ₹${parseFloat(latest?.receivedAmount||0).toLocaleString('en-IN')}`, null, leftM, null, bord.border);
      row++;

      m(row,1,row,4); setCell(row,1, `Invoice Total  : ₹${grandTotal.toLocaleString('en-IN')}`, boldF, leftM, null, bord.border);
      m(row,5,row,8); setCell(row,5, `Balance Due    : ₹${(grandTotal - parseFloat(latest?.receivedAmount||0)).toLocaleString('en-IN')}`, boldF, leftM, null, bord.border);
      row++;

      row++;

      // ── SIGNATURE ──────────────────────────────────────────────────────────
      m(row,1,row,4); setCell(row,1, "Customer's Seal and Signature", null, centerM, null, bord.border);
      m(row,5,row,8); setCell(row,5, `For ${c.name||'Company'}\n\n\nAuthorised Signatory`, null, centerM, null, bord.border);
      ws.getRow(row).height = 60;
      row++;

      m(row,1,row,8);
      setCell(row,1, 'This is a Computer Generated Invoice', { italic:true, size:8, color:{argb:'FF888888'} }, centerM);
      row++;

      // ── WRITE FILE ─────────────────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invNo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { alert('Excel export failed: ' + e.message); }
  };

  const thStyle = { border: 'none', borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', background: '#fff', fontSize: '7.5pt', color: '#000' };
  const tdStyle = { border: 'none', borderRight: '1px solid #000', padding: '2px 4px', fontSize: '7.5pt', color: '#000', background: '#fff' };
  const emptyRows = Array.from({ length: Math.max(0, 8 - page1Items.length) });

  const InvoicePage = ({ items: pageItems, pageNum, totalPages }) => (
    <div
      id={pageNum === 1 ? 'invoiceContent' : 'invoiceContentPage2'}
      contentEditable={editMode ? 'true' : undefined}
      suppressContentEditableWarning
      style={{ width: '210mm', minHeight: '297mm', padding: '10mm 12mm', background: 'white', margin: '2rem auto', color: 'black', fontFamily: 'Arial, sans-serif', boxShadow: editMode ? '0 0 0 3px #f59e0b, 0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.2)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontSize: '8.5pt', pageBreakAfter: 'always' }}
    >
      <style>{`
        [contenteditable='true']:focus { background: rgba(255,255,100,0.35) !important; outline: 1px dashed #f59e0b; }
        #invoiceContent *, #invoiceContentPage2 * { color: #000 !important; box-sizing: border-box; }
        #invoiceContent table, #invoiceContentPage2 table { background: #fff !important; }
        @media print { [contenteditable] { cursor: default !important; } }
        @media print { .grand-total-row { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
      `}</style>

      {/* Title */}
      <div style={{ position: 'relative', padding: '2px 0 4px 0' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11.5pt', letterSpacing: '0.3px' }}>Proforma Invoice</div>
        <div style={{ position: 'absolute', right: 0, top: 2, fontSize: '8pt', fontWeight: 'bold' }}>Page {pageNum} of {totalPages}</div>
      </div>

      <div style={{ border: '1.5px solid #000', display: 'flex', flexDirection: 'column', width: '100%', flex: 1 }}>
        {/* Header Row */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000' }}>
          <tbody>
            <tr>
              {/* LEFT: Company + Buyer + Consignee */}
              <td style={{ width: '50%', padding: '6px 8px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '10.5pt', marginBottom: 2 }}>
                  <CE onBlur={e => { markDirty(); setCompName(e.target.innerText.trim()); }} style={{ fontWeight: 'bold', fontSize: '10.5pt' }}>{compName}</CE>
                </div>
                <div style={{ fontSize: '7.5pt', lineHeight: 1.3, marginBottom: 3 }}>
                  <CE onBlur={e => { markDirty(); setCompAddress(e.target.innerText.trim()); }} style={{ whiteSpace: 'pre-line', fontSize: '7.5pt' }}>{compAddress}</CE>
                </div>
                <div style={{ fontSize: '7.5pt', lineHeight: 1.4, marginBottom: 2 }}>
                  <div>GSTIN/UIN: <CE onBlur={e => { markDirty(); setCompGst(e.target.innerText.trim()); }}>{compGst}</CE></div>
                  <div>Mob:- <CE onBlur={e => { markDirty(); setCompMobile(e.target.innerText.trim()); }}>{compMobile}</CE></div>
                  <div>E-Mail: <CE onBlur={e => { markDirty(); setCompEmail(e.target.innerText.trim()); }}>{compEmail}</CE></div>
                </div>
                <div style={{ borderBottom: '1px solid #000', margin: '4px 0' }} />
                <div style={{ fontWeight: 'bold', fontSize: '8.5pt', marginBottom: 2 }}>Buyer :</div>
                <div style={{ fontWeight: 'bold', fontSize: '8pt', marginBottom: 1 }}><CE onBlur={e => { markDirty(); setBuyerName(e.target.innerText.trim()); }}>{buyerName || '-'}</CE></div>
                <div style={{ fontSize: '7.5pt', lineHeight: 1.3 }}>
                  <div><CE onBlur={e => { markDirty(); setBuyerCity(e.target.innerText.trim()); }}>{buyerCity || ''}</CE></div>
                  <div>State: <CE onBlur={e => { markDirty(); setBuyerState(e.target.innerText.trim()); }}>{buyerState || '-'}</CE></div>
                  <div>Mob:- <CE onBlur={e => { markDirty(); setBuyerContact(e.target.innerText.trim()); }}>{buyerContact || '-'}</CE></div>
                  <div>GSTN- <CE onBlur={e => { markDirty(); setBuyerGst(e.target.innerText.trim()); }}>{buyerGst || '-'}</CE></div>
                </div>
                <div style={{ borderBottom: '1px solid #000', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '8.5pt' }}>Consignee:</span>
                  {lead && (
                    <div className="no-print" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <select 
                        value="" 
                        onChange={e => {
                          const val = e.target.value;
                          if (!val) return;
                          if (val === 'default') {
                            setConsigneeName(cust.customerName || '');
                            setConsigneeAddr(cust.city ? `${cust.city}${cust.state ? ', ' + cust.state : ''}` : '');
                            setConsigneeState(cust.state || '');
                            setConsigneeMob(cust.contact || '');
                            setConsigneeGst(cust.gst || cust.customerGst || '-');
                            markDirty();
                          } else {
                            const found = (lead?.addresses || []).find(a => a.id === val);
                            if (found) {
                              setConsigneeName(found.consigneeName);
                              setConsigneeAddr(found.consigneeAddr);
                              setConsigneeState(found.consigneeState);
                              setConsigneeMob(found.consigneeMob);
                              setConsigneeGst(found.consigneeGst);
                              markDirty();
                            }
                          }
                          e.target.value = ""; // reset dropdown
                        }}
                        style={{ fontSize: '7.5pt', padding: '1px 4px', background: '#2d3748', color: '#fff', border: '1px solid #4a5568', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        <option value="">-- Select Saved Location --</option>
                        <option value="default">Default (Same as Buyer)</option>
                        {(lead?.addresses || []).map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const label = prompt("Enter a label for this address location (e.g. Warehouse 1, Chennai Office):");
                          if (!label) return;
                          const newAddr = {
                            id: 'addr_' + Date.now(),
                            label: label.trim(),
                            consigneeName,
                            consigneeAddr,
                            consigneeState,
                            consigneeMob,
                            consigneeGst
                          };
                          const updatedAddresses = [...(lead?.addresses || []), newAddr];
                          updateLead(lead.id, { addresses: updatedAddresses });
                          showBanner(`Location "${label.trim()}" saved!`, 'success');
                        }}
                        style={{ fontSize: '7pt', background: '#319795', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Save Location
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '7.5pt', lineHeight: 1.3 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '8pt' }}><CE onBlur={e => { markDirty(); setConsigneeName(e.target.innerText.trim()); }}>{consigneeName || 'Same as Buyer'}</CE></div>
                  <CE onBlur={e => { markDirty(); setConsigneeAddr(e.target.innerText.trim()); }}>{consigneeAddr}</CE>
                  <div>State: <CE onBlur={e => { markDirty(); setConsigneeState(e.target.innerText.trim()); }}>{consigneeState || '-'}</CE></div>
                  <div>Mob:- <CE onBlur={e => { markDirty(); setConsigneeMob(e.target.innerText.trim()); }}>{consigneeMob || '-'}</CE></div>
                  <div>GSTN- <CE onBlur={e => { markDirty(); setConsigneeGst(e.target.innerText.trim()); }}>{consigneeGst || '-'}</CE></div>
                </div>
              </td>
              {/* RIGHT: Invoice details */}
              <td style={{ width: '50%', padding: '6px 8px', verticalAlign: 'top' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000', paddingBottom: 3, marginBottom: 3 }}>
                  <div style={{ fontSize: '7.5pt', paddingRight: 6 }}><strong>Invoice No.</strong><br /><span contentEditable suppressContentEditableWarning onBlur={e => { markDirty(); setInvNo(e.target.innerText.trim()); }} style={{ outline: 'none', fontWeight: 'bold', fontSize: '8pt' }}>{invNo}</span></div>
                  <div style={{ fontSize: '7.5pt', borderLeft: '1px solid #000', paddingLeft: 8 }}><strong>Dated</strong><br /><span contentEditable suppressContentEditableWarning onBlur={e => { markDirty(); setInvDate(e.target.innerText.trim()); }} style={{ outline: 'none', fontWeight: 'bold', fontSize: '8pt' }}>{invDate}</span></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000', padding: '2px 0', marginBottom: 3 }}>
                  <div style={{ fontSize: '7.5pt', paddingRight: 6 }}>Delivery Note<br /><CE onBlur={e => { markDirty(); setDeliveryNote(e.target.innerText.trim()); }}>{deliveryNote}</CE></div>
                  <div style={{ fontSize: '7.5pt', borderLeft: '1px solid #000', paddingLeft: 8 }}>Mode/Terms of Payment<br /><CE onBlur={e => { markDirty(); setPaymentTerms(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{paymentTerms}</CE></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000', padding: '2px 0', marginBottom: 3 }}>
                  <div style={{ fontSize: '7.5pt', paddingRight: 6 }}>Supplier's Ref.<br /><CE onBlur={e => { markDirty(); setSupplierRef(e.target.innerText.trim()); }}>{supplierRef}</CE></div>
                  <div style={{ fontSize: '7.5pt', borderLeft: '1px solid #000', paddingLeft: 8 }}>Other Reference(s)<br /><CE onBlur={e => { markDirty(); setOtherRef(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{otherRef}</CE></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000', padding: '2px 0', marginBottom: 3 }}>
                  <div style={{ fontSize: '7.5pt', paddingRight: 6 }}>Buyer's Order No.<br /><CE onBlur={e => { markDirty(); setBuyerOrderNo(e.target.innerText.trim()); }}>{buyerOrderNo}</CE></div>
                  <div style={{ fontSize: '7.5pt', borderLeft: '1px solid #000', paddingLeft: 8 }}>Dated<br /><CE onBlur={e => { markDirty(); setBuyerOrderDate(e.target.innerText.trim()); }}>{buyerOrderDate}</CE></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000', padding: '2px 0', marginBottom: 3 }}>
                  <div style={{ fontSize: '7.5pt' }}>Despatched through<br /><CE onBlur={e => { markDirty(); setDespatchedThrough(e.target.innerText.trim()); }}>{despatchedThrough}</CE></div>
                  <div style={{ fontSize: '7.5pt' }}>Destination<br /><CE onBlur={e => { markDirty(); setDestination(e.target.innerText.trim()); }}>{destination}</CE></div>
                </div>
                <div style={{ fontSize: '7.5pt', padding: '1px 0' }}>Terms of Delivery <CE onBlur={e => { markDirty(); setTermsOfDelivery(e.target.innerText.trim()); }}>{termsOfDelivery}</CE></div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000', fontSize: '7.5pt' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 28 }}>Sl.<br />No.</th>
              <th style={{ ...thStyle, width: 65 }}>HSN Code</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Description of Goods</th>
              <th style={{ ...thStyle, width: 55 }}>Quantity</th>
              <th style={{ ...thStyle, width: 55 }}>Rate</th>
              <th style={{ ...thStyle, width: 32 }}>GST</th>
              <th style={{ ...thStyle, width: 32 }}>per</th>
              <th style={{ ...thStyle, width: 70, borderRight: 'none' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item, i) => {
              const globalIdx = pageNum === 1 ? i : PAGE1_ROWS + i;
              const amt = ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1));
              // Sync contentEditable change back to rawItems state
              const onCE = (field, convert) => (e) => {
                const val = e.currentTarget.innerText.trim();
                updateItem(globalIdx, field, convert ? convert(val) : val); // updateItem already calls markDirty
              };
              const ceStyle = { outline: 'none', display: 'block', width: '100%' };
              return (
                <tr key={i} style={{ height: 18 }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {globalIdx + 1}
                    {editMode && rawItems.length > 1 && (
                      <span onClick={() => removeItem(globalIdx)} style={{ color: '#ef4444', cursor: 'pointer', marginLeft: 3, fontSize: '9pt' }}>✕</span>
                    )}
                  </td>
                  <td contentEditable suppressContentEditableWarning onBlur={onCE('hsn')} style={{ ...tdStyle, textDecoration: 'underline' }}>
                    <span style={ceStyle}>{item.hsn || '-'}</span>
                  </td>
                  <td contentEditable suppressContentEditableWarning onBlur={onCE('name')} style={{ ...tdStyle, textAlign: 'left' }}>
                    <span style={ceStyle}>{item.name || ''}</span>
                  </td>
                  <td contentEditable suppressContentEditableWarning onBlur={onCE('qty', v => parseFloat(v) || 0)} style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={ceStyle}>{(parseFloat(item.qty) || 0).toFixed(2)}</span>
                  </td>
                  <td contentEditable suppressContentEditableWarning onBlur={onCE('price', v => parseFloat(v) || 0)} style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={ceStyle}>{(parseFloat(item.price) || 0).toFixed(2)}</span>
                  </td>
                  <td contentEditable suppressContentEditableWarning onBlur={onCE('gst', v => v.replace('%',''))} style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={ceStyle}>{item.gst || '5'}%</span>
                  </td>
                  <td contentEditable suppressContentEditableWarning onBlur={onCE('unit')} style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={ceStyle}>{item.unit || 'Ltr'}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderRight: 'none' }}>{amt.toFixed(2)}</td>
                </tr>
              );
            })}
            {pageNum === 1 && emptyRows.map((_, i) => (
              <tr key={`e${i}`} style={{ height: 16 }}>
                {[...Array(8)].map((_, j) => <td key={j} style={{ ...tdStyle, borderRight: j === 7 ? 'none' : '1px solid #000' }}>&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
          {pageNum === totalPages && (
            <tfoot>
              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan={3} style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right' }}>Total</td>
                <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right' }}>{totalQty.toFixed(2)}</td>
                <td style={{ ...tdStyle }}></td><td style={{ ...tdStyle }}></td><td style={{ ...tdStyle }}></td>
                <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right', borderRight: 'none' }}>{subtotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Add Row button — always on last page so user can add items anytime */}
        {pageNum === totalPages && (
          <div className="no-print" style={{ padding: '4px 6px', borderBottom: '1px solid #000' }}>
            <button onClick={addItem} style={{ fontSize: '7pt', background: '#e0f2fe', border: '1px dashed #0284c7', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', color: '#0284c7', fontWeight: 600 }}>+ Add Row</button>
          </div>
        )}

        {/* Tax + Totals (only on last page) */}
        {pageNum === totalPages && (
          <>
            {/* Tax rows */}
            {Object.entries(taxGroups).sort(([a], [b]) => +a - +b).map(([rate, taxAmt]) =>
              isInterstate ? (
                <div key={rate} style={{ display: 'grid', gridTemplateColumns: '1fr 110px', borderBottom: '1px solid #000', padding: '2px 6px', fontSize: '8.5pt' }}>
                  <div style={{ textAlign: 'right', fontWeight: 'bold' }}>IGST @ {rate}%</div>
                  <div style={{ textAlign: 'right', borderLeft: '1px solid #000', paddingRight: 4, fontWeight: 'bold' }}>{taxAmt.toFixed(2)}</div>
                </div>
              ) : [taxAmt / 2, taxAmt / 2].map((half, j) => (
                <div key={`${rate}-${j}`} style={{ display: 'grid', gridTemplateColumns: '1fr 110px', borderBottom: '1px solid #000', padding: '2px 6px', fontSize: '8.5pt' }}>
                  <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{j === 0 ? 'CGST' : 'SGST'} @ {(+rate / 2)}%</div>
                  <div style={{ textAlign: 'right', borderLeft: '1px solid #000', paddingRight: 4, fontWeight: 'bold' }}>{half.toFixed(2)}</div>
                </div>
              ))
            )}
            {/* Other charges + round off + grand total */}
            <div style={{ borderBottom: '1px solid #000', display: 'grid', gridTemplateColumns: '1fr 110px', padding: '2px 6px', fontSize: '8.5pt' }}>
              <div style={{ textAlign: 'right' }}>Other Charges (Freight/Pkg)</div>
              <div
                contentEditable suppressContentEditableWarning
                onBlur={e => { markDirty(); setFreight(parseFloat(e.currentTarget.innerText.trim()) || 0); }}
                style={{ textAlign: 'right', borderLeft: '1px solid #000', paddingRight: 4, outline: 'none' }}
              >{parseFloat(freight || 0).toFixed(2)}</div>
            </div>
            <div style={{ borderBottom: '1px solid #000', display: 'grid', gridTemplateColumns: '1fr 110px', padding: '2px 6px', fontSize: '8.5pt' }}>
              <div style={{ textAlign: 'right' }}>Round off (+/-)</div>
              <div
                contentEditable suppressContentEditableWarning
                onBlur={e => {
                  markDirty();
                  const v = e.currentTarget.innerText.trim();
                  setRoundOffOverride(v === '' ? null : parseFloat(v) || 0);
                }}
                style={{ textAlign: 'right', borderLeft: '1px solid #000', paddingRight: 4, outline: 'none' }}
              >{roundOff.toFixed(2)}</div>
            </div>
            <div className="grand-total-row" style={{ display: 'grid', gridTemplateColumns: '1fr 110px', padding: '4px 6px', background: '#f8fafc', fontSize: '9.5pt', fontWeight: 'bold', borderBottom: '1px solid #000' }}>
              <div style={{ textAlign: 'right', textTransform: 'uppercase' }}>Grand Total</div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid #000', paddingRight: 4 }}>₹{grandTotal.toLocaleString('en-IN')}</div>
            </div>

            {/* Amount in words */}
            <div style={{ borderBottom: '1px solid #000', padding: '3px 6px', fontSize: '7.5pt' }}>
              <strong>Amount Chargeable (in words):</strong>{' '}
              <em>{(s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '')(numberToWords(Math.floor(Math.abs(grandTotal))))} Rupees Only</em>
            </div>

            {/* Bank + Tax registration */}
            <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000', fontSize: '7.5pt' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', padding: '4px 6px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Company's Bank Details</div>
                    <div style={{ fontSize: '7pt' }}>
                      <div>Bank Name : <CE onBlur={e => { markDirty(); setCompBankName(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compBankName || '-'}</CE></div>
                      <div>A/c No. : <CE onBlur={e => { markDirty(); setCompAccNo(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compAccNo || '-'}</CE></div>
                      <div>Branch : <CE onBlur={e => { markDirty(); setCompBranch(e.target.innerText.trim()); }}>{compBranch || '-'}</CE></div>
                      <div>IFS Code : <CE onBlur={e => { markDirty(); setCompIfsc(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compIfsc || '-'}</CE></div>
                    </div>
                  </td>
                  <td style={{ width: '50%', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Company's Tax Registration</div>
                    <div style={{ fontSize: '7pt' }}>
                      <div>Company's VAT TIN: <CE onBlur={e => { markDirty(); setCompVat(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compVat || '-'}</CE></div>
                      <div>Company's CST No. : <CE onBlur={e => { markDirty(); setCompCst(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compCst || '-'}</CE></div>
                      <div>Company's GST No. : <CE onBlur={e => { markDirty(); setCompGst(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compGst || '-'}</CE></div>
                      <div>Company's PAN : <CE onBlur={e => { markDirty(); setCompPan(e.target.innerText.trim()); }} style={{ fontWeight: 'bold' }}>{compPan || '-'}</CE></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Declaration */}
            <div style={{ borderBottom: '1px solid #000', padding: '3px 6px', fontSize: '7pt' }}>
              <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </div>

            {/* Signature */}
            <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '7pt', minHeight: 90 }}>
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div>Customer's Seal and Signature</div>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                {c.seal && <img src={c.seal} alt="seal" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain', marginBottom: 4 }} />}
                <div style={{ paddingTop: 4 }}>for <CE style={{ fontWeight: 'bold' }}>{c.name || 'Company'}</CE><br /><span style={{ fontWeight: 'bold', fontSize: '6pt' }}>Authorised Signatory</span></div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '3px', fontSize: '6pt', color: '#555' }}>
              This is a Computer Generated Invoice
            </div>
          </>
        )}

        {/* Page 2 header (when on page 2) */}
        {pageNum === 2 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000', padding: '6px 8px', fontSize: '8pt' }}>
              <div><strong>Buyer:</strong> <span style={{ display: 'block', marginTop: 2 }}>{cust.customerName}</span></div>
              <div style={{ textAlign: 'right' }}><strong>Page 2 of 2</strong></div>
            </div>
            {/* Bank + Tax repeated on page 2 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000', fontSize: '7.5pt', marginTop: 'auto' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', padding: '4px 6px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 2, textDecoration: 'underline' }}>Company's Bank Details</div>
                    <div style={{ fontSize: '7pt' }}>
                      <div>Bank Name: <strong>{c.bankName || '-'}</strong></div>
                      <div>A/c No.: <strong>{c.accNo || '-'}</strong></div>
                      <div>Branch: {c.branch || '-'}</div>
                      <div>IFS Code: <strong>{c.ifsc || '-'}</strong></div>
                    </div>
                  </td>
                  <td style={{ width: '50%', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 2, textDecoration: 'underline' }}>Company's Tax & Registration</div>
                    <div style={{ fontSize: '7pt' }}>
                      <div>VAT TIN: <strong>{c.vat || '-'}</strong></div>
                      <div>CST No.: <strong>{c.cst || '-'}</strong></div>
                      <div>GST No.: <strong>{c.companyGst || c.gst || '-'}</strong></div>
                      <div>PAN: <strong>{c.pan || '-'}</strong></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            {/* Declaration + Signature on page 2 */}
            <div style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000', padding: '3px 6px', fontSize: '7pt' }}>
              <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </div>
            <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '7pt', minHeight: 80 }}>
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>Customer's Seal and Signature</div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                {c.seal && <img src={c.seal} alt="seal" style={{ maxWidth: 100, maxHeight: 50, objectFit: 'contain', marginBottom: 4 }} />}
                <div>for <CE style={{ fontWeight: 'bold' }}>{c.name || 'Company'}</CE><br /><span style={{ fontWeight: 'bold', fontSize: '6pt' }}>Authorised Signatory</span></div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '3px', fontSize: '6pt', color: '#555' }}>This is a Computer Generated Invoice</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content fullscreen" style={{ background: '#1a2436', padding: 0 }}>
        {/* Toolbar */}
        <div className="no-print" style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', background: '#1a2436', position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ fontWeight: 700, flex: 1, fontSize: '0.95rem' }}>Invoice {invNo}</span>
          <button className="btn btn-secondary" onClick={() => setEditMode(e => !e)}
            title={editMode ? 'Click anywhere on the invoice to edit any text. Click Lock Edits when done.' : 'Makes every field on the invoice directly editable — click any text to change it'}
            style={{ background: editMode ? 'rgba(245,158,11,0.25)' : undefined, borderColor: editMode ? '#f59e0b' : undefined, color: editMode ? '#f59e0b' : undefined, fontWeight: editMode ? 700 : undefined }}>
            <Edit3 size={14} /> {editMode ? '✎ Full Edit ON — click any text' : 'Enable Full Edit'}
          </button>
          <button className="btn btn-secondary" onClick={saveVersion} disabled={saving}
            style={{ background: savedToast ? 'rgba(16,185,129,0.25)' : undefined, borderColor: savedToast ? '#10b981' : undefined, color: savedToast ? '#10b981' : undefined, transition: 'all 0.3s' }}>
            <Save size={14} />{saving ? ' Saving...' : savedToast ? ' ✓ Saved!' : ' Save Version'}
          </button>
          <button className="btn btn-secondary" onClick={handleExcelExport}><Download size={14} /> Excel</button>
          <button className="btn btn-primary" onClick={handlePrint}><Printer size={14} /> Print / PDF</button>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div id="printRoot" style={{ padding: '1rem', overflowY: 'auto', maxHeight: 'calc(95vh - 56px)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          {InvoicePage({ items: page1Items, pageNum: 1, totalPages: showPage2 ? 2 : 1 })}
          {showPage2 && InvoicePage({ items: page2Items, pageNum: 2, totalPages: 2 })}
        </div>
      </div>
    </div>
  );
}
