import { useState, useRef } from 'react';
import { Save, Upload, X, Wifi, Download, Upload as UploadIcon, RefreshCw, Trash2, Flame, CheckCircle, AlertCircle, Settings2, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStoredFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, reinitFirebase, isFirebaseConfigured } from '../firebase';
import { normalizeDisplayDate } from '../utils/dataConfig';
import MigrationWizard from '../components/MigrationWizard';

export default function Settings() {
  const { companySettings, saveSettings, gsUrl, saveGsUrl, autoSyncEnabled, toggleAutoSync, testConnection, pullFromSheets, pushToSheets, fullSync, clearLocalCache, isSyncing, showBanner, leads, invoiceHistory } = useApp();
  const [form, setForm] = useState({ ...companySettings });
  const [testingConn, setTestingConn] = useState(false);
  const [localGsUrl, setLocalGsUrl] = useState(gsUrl);
  const sealRef = useRef(null);
  const [showMigration, setShowMigration] = useState(false);

  // Firebase config state
  const [fbConfigured, setFbConfigured] = useState(isFirebaseConfigured);
  const [showFbForm, setShowFbForm] = useState(false);
  const [fbForm, setFbForm] = useState(() => getStoredFirebaseConfig() || { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' });
  const [fbSecrets, setFbSecrets] = useState({});
  const [fbSaving, setFbSaving] = useState(false);

  const handleSaveFirebase = async () => {
    if (!fbForm.apiKey || !fbForm.projectId || !fbForm.appId) {
      showBanner('❌ apiKey, projectId and appId are required', 'error'); return;
    }
    setFbSaving(true);
    try {
      await reinitFirebase(fbForm);
      setFbConfigured(true);
      setShowFbForm(false);
      showBanner('🔥 Firebase connected successfully!', 'success');
    } catch (e) {
      showBanner('❌ Firebase error: ' + e.message, 'error');
    } finally { setFbSaving(false); }
  };

  const handleDisconnectFirebase = () => {
    clearFirebaseConfig();
    setFbConfigured(false);
    setShowFbForm(false);
    setFbForm({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' });
    showBanner('Firebase disconnected. Using local storage only.', 'info');
  };

  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    saveSettings(form);
    showBanner('✅ Settings saved!', 'success');
  };

  const handleSealUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, seal: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleTestConn = async () => {
    setTestingConn(true);
    saveGsUrl(localGsUrl);
    await testConnection(localGsUrl);
    setTestingConn(false);
  };

  const exportData = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

      // ── 1. Dashboard Sheet (added first so it appears as tab #1) ──────────
      const ds = wb.addWorksheet('Dashboard');
      ds.getColumn(1).width = 32;
      ds.getColumn(2).width = 22;
      ds.getColumn(3).width = 22;
      ds.getColumn(4).width = 11;
      ds.getColumn(5).width = 11;

      const dsCenter = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const dsLeft   = { horizontal: 'left',   vertical: 'middle', wrapText: true };
      const dsThin   = { style: 'thin' };
      const dsBord   = { top: dsThin, left: dsThin, bottom: dsThin, right: dsThin };
      const greenFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      const blueFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      const purpleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      const amberFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
      const redFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
      const darkFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      const whiteBold  = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };

      const dsSection = (label, fill) => {
        const r = ds.addRow([label, '', '', '', '']);
        ds.mergeCells(r.number, 1, r.number, 5);
        r.getCell(1).fill = fill; r.getCell(1).font = whiteBold;
        r.getCell(1).alignment = dsCenter; r.getCell(1).border = dsBord;
        r.height = 22;
      };
      const dsColHead = (c1, c2, c3) => {
        const r = ds.addRow([c1, c2, c3, '', '']);
        ds.mergeCells(r.number, 4, r.number, 5);
        [1,2,3].forEach(col => {
          r.getCell(col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          r.getCell(col).fill = darkFill; r.getCell(col).alignment = dsCenter; r.getCell(col).border = dsBord;
        });
      };
      const dsDataRow = (c1, c2, c3, extraFn) => {
        const r = ds.addRow([c1, c2, c3, '', '']);
        ds.mergeCells(r.number, 4, r.number, 5);
        r.getCell(1).alignment = dsLeft; r.getCell(2).alignment = dsCenter; r.getCell(3).alignment = dsCenter;
        r.eachCell(c => { c.border = dsBord; });
        if (extraFn) extraFn(r);
        return r;
      };

      // Title
      const titleR = ds.addRow([`IndiaMART CRM — Dashboard Report  |  ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, '', '', '', '']);
      ds.mergeCells(titleR.number, 1, titleR.number, 5);
      titleR.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleR.getCell(1).fill = darkFill; titleR.getCell(1).alignment = dsCenter; titleR.height = 28;

      // KPI calculations — only invoices with actual payment received count as "billed"
      const dsPaidInv = invoiceHistory.filter(inv => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return (parseFloat(v.receivedAmount)||0) > 0; });
      const dsConfirmedRev = dsPaidInv.reduce((s, inv) => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return s + (parseFloat(v.totalAmount)||0); }, 0);
      const dsTotalReceived = dsPaidInv.reduce((s, inv) => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return s + (parseFloat(v.receivedAmount)||0); }, 0);
      const dsBilledIds = new Set(dsPaidInv.map(inv => inv.leadId).filter(Boolean));
      const dsValidLeads = leads.filter(l => l.status !== 'Invalid Lead').length;
      const dsConvRate = dsValidLeads ? ((dsBilledIds.size / dsValidLeads) * 100).toFixed(1) : '0';
      const dsContactedCount = leads.filter(l => !['New Enquiry','Invalid Lead'].includes(l.status)).length;
      const dsContactRate = leads.length ? ((dsContactedCount / leads.length) * 100).toFixed(1) : '0';
      const dsPending = Math.max(0, dsConfirmedRev - dsTotalReceived);
      const dsInTransit = leads.filter(l => l.status === 'Material Dispatched').length;
      const dsWonAll = ['Converted','Purchased','Repeat Customer','Material Dispatched','Material Reached'];
      const dsProjectedRev = leads.filter(l => !dsBilledIds.has(l.id) && !['Purchased','Closed Lost','Invalid Lead','No Response','Not Interested','No Current Requirement'].includes(l.status)).reduce((s,l) => s+(l.orderValue||0), 0);

      // KPI section
      dsSection('📊  KEY PERFORMANCE INDICATORS', greenFill);
      dsColHead('KPI', 'Value', 'Notes');
      [
        ['Pipeline Enquiries',    leads.length,      `${dsContactRate}% Contacted`,                    false],
        ['Actual Sales (Billed)', dsConfirmedRev,    `From ${dsPaidInv.length} orders`,                true],
        ['Outstanding Payments',  dsPending,         `Collected: ₹${dsTotalReceived.toLocaleString('en-IN')}`, true],
        ['In-Transit Orders',     dsInTransit,       'Material Dispatched',                            false],
        ['Projected Revenue',     dsProjectedRev,    'Unbilled Enquiries',                             true],
        ['Conversion Rate',       `${dsConvRate}%`,  `${dsBilledIds.size} Billed / ${dsValidLeads} Valid`, false],
      ].forEach(([kpi, val, note, isCurrency]) => {
        dsDataRow(kpi, val, note, r => {
          r.getCell(1).font = { bold: true };
          r.getCell(2).font = { bold: true, size: 12, color: { argb: 'FF10B981' } };
          r.getCell(3).font = { size: 10, color: { argb: 'FF64748B' } };
          if (isCurrency) r.getCell(2).numFmt = '"₹"#,##0';
        });
      });
      ds.addRow([]);

      // Status Distribution
      dsSection('🎯  LEAD STATUS DISTRIBUTION', blueFill);
      dsColHead('Status', 'Count', '% of Total');
      const dsStatusCounts = {};
      leads.forEach(l => { dsStatusCounts[l.status] = (dsStatusCounts[l.status]||0) + 1; });
      const dsWonOnes  = ['Converted','Purchased','Repeat Customer','Material Dispatched','Material Reached'];
      const dsLostOnes = ['Closed Lost','Invalid Lead','Not Interested','No Response','No Current Requirement'];
      Object.entries(dsStatusCounts).sort((a,b) => b[1]-a[1]).forEach(([status, count]) => {
        dsDataRow(status, count, leads.length ? `${((count/leads.length)*100).toFixed(1)}%` : '0%', r => {
          if (dsWonOnes.includes(status)) { r.getCell(1).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FFD1FAE5'} }; r.getCell(1).font = { bold:true, color:{argb:'FF065F46'} }; }
          else if (dsLostOnes.includes(status)) { r.getCell(1).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FFFEE2E2'} }; r.getCell(1).font = { color:{argb:'FF991B1B'} }; }
        });
      });
      ds.addRow([]);

      // Top Products — use invoices first, fall back to won leads
      dsSection('🏆  TOP PRODUCTS BY REVENUE', purpleFill);
      dsColHead('Product', 'Revenue (₹)', 'Share %');
      const dsProdRev = {};
      if (dsPaidInv.length) {
        dsPaidInv.forEach(inv => {
          const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv;
          (v.items||[]).forEach(p => { if (!p.name) return; dsProdRev[p.name] = (dsProdRev[p.name]||0)+((parseFloat(p.price)||0)*(parseFloat(p.qty)||1)); });
        });
      } else {
        leads.filter(l => dsWonAll.includes(l.status)).forEach(l => {
          (l.productList||[{name:l.product,price:l.orderValue,qty:1}]).forEach(p => { if (!p.name) return; dsProdRev[p.name] = (dsProdRev[p.name]||0)+((parseFloat(p.price)||0)*(parseFloat(p.qty)||1)); });
        });
      }
      const dsTopProds = Object.entries(dsProdRev).sort((a,b)=>b[1]-a[1]).slice(0,10);
      const dsTotalProdRev = dsTopProds.reduce((s,[,v])=>s+v, 0);
      dsTopProds.forEach(([name,rev],i) => {
        dsDataRow(`${i+1}. ${name}`, rev, dsTotalProdRev ? `${((rev/dsTotalProdRev)*100).toFixed(1)}%` : '0%', r => {
          r.getCell(2).numFmt = '"₹"#,##0';
          if (i===0) r.eachCell(c => { c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFEF3C7'}}; c.font={bold:true,color:{argb:'FF92400E'}}; });
        });
      });
      ds.addRow([]);

      // City-wise Revenue — use invoices for accuracy
      dsSection('🗺️  CITY-WISE REVENUE', amberFill);
      dsColHead('City', 'Revenue (₹)', 'Share %');
      const dsCityRev = {};
      if (dsPaidInv.length) {
        dsPaidInv.forEach(inv => {
          const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv;
          const raw = (inv.customerCity||'Other').trim() || 'Other';
          const city = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
          dsCityRev[city] = (dsCityRev[city]||0) + (parseFloat(v.totalAmount)||0);
        });
      } else {
        leads.filter(l => dsWonAll.includes(l.status)).forEach(l => { const city=l.city||'Other'; dsCityRev[city]=(dsCityRev[city]||0)+(parseFloat(l.orderValue)||0); });
      }
      const dsTopCities = Object.entries(dsCityRev).sort((a,b)=>b[1]-a[1]).slice(0,10);
      const dsTotalCityRev = dsTopCities.reduce((s,[,v])=>s+v, 0);
      dsTopCities.forEach(([city,rev]) => {
        dsDataRow(city, rev, dsTotalCityRev ? `${((rev/dsTotalCityRev)*100).toFixed(1)}%` : '0%', r => { r.getCell(2).numFmt = '"₹"#,##0'; });
      });
      ds.addRow([]);

      // Sales Funnel
      dsSection('🔽  SALES FUNNEL', redFill);
      dsColHead('Stage', 'Count', 'Conversion %');
      const dsQuotedSt = ['Quotation Sent','Negotiation',...dsWonAll];
      const pct100 = n => leads.length ? `${((n/leads.length)*100).toFixed(1)}%` : '0%';
      [
        ['Total Leads',          leads.length,                                                       '100%'],
        ['Contacted',            dsContactedCount,                                                   pct100(dsContactedCount)],
        ['Quoted / Negotiation', leads.filter(l=>dsQuotedSt.includes(l.status)).length,             pct100(leads.filter(l=>dsQuotedSt.includes(l.status)).length)],
        ['Converted / Billed',   dsBilledIds.size,                                                   dsValidLeads ? `${((dsBilledIds.size/dsValidLeads)*100).toFixed(1)}%` : '0%'],
        ['Won (All Stages)',      leads.filter(l=>dsWonAll.includes(l.status)).length,               pct100(leads.filter(l=>dsWonAll.includes(l.status)).length)],
      ].forEach(([stage,cnt,p]) => dsDataRow(stage, cnt, p));
      ds.addRow([]);

      // Monthly Trend — revenue from invoices (matches Actual Sales total exactly)
      dsSection('📈  MONTHLY REVENUE TREND', greenFill);
      dsColHead('Month', 'Received (₹)', 'Leads Added');
      const dsMonthly = {};
      leads.forEach(l => {
        const month = (l.date||'').substring(0,7); if (!month) return;
        if (!dsMonthly[month]) dsMonthly[month] = { revenue:0, count:0 };
        dsMonthly[month].count++;
      });
      dsPaidInv.forEach(inv => {
        const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv;
        const dateStr = String(v.invoiceDate || inv.createdAt || '');
        let month = '';
        if (/^\d{4}-\d{2}/.test(dateStr)) {
          month = dateStr.substring(0, 7); // YYYY-MM-DD → YYYY-MM
        } else if (/^\d{2}-\d{2}-\d{4}/.test(dateStr)) {
          const parts = dateStr.split('-');
          month = `${parts[2]}-${parts[1]}`; // DD-MM-YYYY → YYYY-MM
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
          const parts = dateStr.split('/');
          month = `${parts[2]}-${parts[1]}`; // DD/MM/YYYY → YYYY-MM
        }
        if (!month) return;
        if (!dsMonthly[month]) dsMonthly[month] = { revenue:0, count:0 };
        dsMonthly[month].revenue += (parseFloat(v.receivedAmount)||0);
      });
      Object.keys(dsMonthly).sort().forEach(month => {
        dsDataRow(month, dsMonthly[month].revenue, dsMonthly[month].count, r => { r.getCell(2).numFmt = '"₹"#,##0'; });
      });

      // ── 2. Leads Sheet ────────────────────────────────────────────────────
      const ws = wb.addWorksheet('Leads');
      ws.columns = [
        { header: 'Date', width: 15 },
        { header: 'Lead ID', width: 12 },
        { header: 'Customer Name', width: 25 },
        { header: 'Mobile Number', width: 18 },
        { header: 'City', width: 15 },
        { header: 'State', width: 15 },
        { header: 'Source', width: 18 },
        { header: 'GST No.', width: 18 },
        { header: 'Product Name', width: 30 },
        { header: 'Qty', width: 8 },
        { header: 'Unit Price', width: 12 },
        { header: 'Subtotal', width: 12 },
        { header: 'Total Value', width: 15 },
        { header: 'Current Status', width: 20 },
        { header: 'Follow-up', width: 15 },
        { header: 'Lost Reason', width: 20 },
        { header: 'Remarks', width: 35 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.height = 30;
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF059669' } },
          left: { style: 'thin', color: { argb: 'FF059669' } },
          bottom: { style: 'thin', color: { argb: 'FF059669' } },
          right: { style: 'thin', color: { argb: 'FF059669' } },
        };
      });

      let currentRow = 2;
      leads.forEach(l => {
        const productList = l.productList && l.productList.length
          ? l.productList
          : [{ name: l.product, qty: 1, price: l.orderValue }];
        const rowCount = productList.length;

        productList.forEach((p, idx) => {
          const rowData = [
            idx === 0 ? normalizeDisplayDate(l.date) : '',
            idx === 0 ? l.id : '',
            idx === 0 ? l.customerName : '',
            idx === 0 ? l.contact : '',
            idx === 0 ? l.city : '',
            idx === 0 ? l.state : '',
            idx === 0 ? (l.source || '') : '',
            idx === 0 ? (l.gst || '') : '',
            p.name || '',
            p.qty || 0,
            p.price || 0,
            (p.price || 0) * (p.qty || 0),
            idx === 0 ? (l.orderValue || 0) : '',
            idx === 0 ? l.status : '',
            idx === 0 ? normalizeDisplayDate(l.followUpDate) : '',
            idx === 0 ? (l.lostReason || '') : '',
            idx === 0 ? (l.remarks || '') : '',
          ];

          const row = ws.addRow(rowData);
          row.getCell(11).numFmt = '"₹"#,##0';
          row.getCell(12).numFmt = '"₹"#,##0';
          row.getCell(13).numFmt = '"₹"#,##0';

          if (idx === 0) {
            const statusCell = row.getCell(14);
            const wonStatuses = ['Converted', 'Purchased', 'Repeat Customer', 'Material Dispatched', 'Material Reached'];
            const lostStatuses = ['Closed Lost', 'Invalid Lead', 'Not Interested', 'No Response', 'No Current Requirement'];
            if (wonStatuses.includes(l.status)) {
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
              statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
            } else if (lostStatuses.includes(l.status)) {
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
              statusCell.font = { color: { argb: 'FF991B1B' } };
            }
          }

          row.eachCell(cell => {
            cell.alignment = { vertical: 'top', wrapText: true };
          });
        });

        if (rowCount > 1) {
          const mergeCols = [1, 2, 3, 4, 5, 6, 7, 8, 13, 14, 15, 16, 17];
          mergeCols.forEach(col => {
            ws.mergeCells(currentRow, col, currentRow + rowCount - 1, col);
          });
        }
        currentRow += rowCount;
      });

      ws.views = [{ state: 'frozen', ySplit: 1 }];

      // ── 2. Summary Sheet ──────────────────────────────────────────────────
      const ss = wb.addWorksheet('Summary');
      const totalLeads = leads.length;
      const totalValue = leads.reduce((s, l) => s + (l.orderValue || 0), 0);
      const ssPaidInv = invoiceHistory.filter(inv => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return (parseFloat(v.receivedAmount)||0) > 0; });
      const ssBilledIds = new Set(ssPaidInv.map(inv => inv.leadId).filter(Boolean));
      const ssValidLeads = leads.filter(l => l.status !== 'Invalid Lead').length;
      const convertedLeads = ssBilledIds.size;
      const conversionRate = ssValidLeads > 0 ? ((convertedLeads / ssValidLeads) * 100).toFixed(2) : 0;
      const statusCounts = {};
      leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

      ss.addRow(['Metric', 'Value', 'Percentage']);
      ss.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      ss.addRow(['Total Leads', totalLeads, '100%']);
      ss.addRow(['Total Value', totalValue, '-']);
      ss.getRow(3).getCell(2).numFmt = '"₹"#,##0';
      const convRate = parseFloat(conversionRate);
      ss.addRow(['Converted / Billed', convertedLeads, `${convRate.toFixed(2)}% of Valid`]);
      ss.addRow(['Pending (Valid, Unbilled)', ssValidLeads - convertedLeads, `${(100 - convRate).toFixed(2)}% of Valid`]);
      ss.addRow([]);
      ss.addRow(['Status Breakdown', 'Count', 'Percentage']);
      ss.getRow(ss.lastRow.number).eachCell(cell => {
        cell.font = { bold: true };
      });
      Object.keys(statusCounts).sort((a, b) => statusCounts[b] - statusCounts[a]).forEach(status => {
        const count = statusCounts[status];
        const pct = ((count / totalLeads) * 100).toFixed(2);
        ss.addRow([status, count, `${pct}%`]);
      });
      ss.getColumn(1).width = 25;
      ss.getColumn(2).width = 15;
      ss.getColumn(3).width = 15;
      ss.eachRow((row, rowNum) => {
        if (rowNum > 1) {
          row.eachCell(cell => {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            if (rowNum <= 5) cell.font = { ...cell.font, bold: true, size: 11 };
          });
        }
      });

      // ── 3. Invoices Sheet ─────────────────────────────────────────────────
      if (invoiceHistory.length) {
        const is = wb.addWorksheet('Invoices');
        is.columns = [
          { header: 'Invoice No.', width: 20 },
          { header: 'Date', width: 15 },
          { header: 'Customer', width: 25 },
          { header: 'Contact', width: 18 },
          { header: 'City', width: 15 },
          { header: 'State', width: 15 },
          { header: 'Amount (₹)', width: 15 },
          { header: 'Received (₹)', width: 15 },
          { header: 'Payment Status', width: 15 },
          { header: 'Invoice Status', width: 15 },
        ];
        const invHeader = is.getRow(1);
        invHeader.height = 30;
        invHeader.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        invoiceHistory.forEach(inv => {
          const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
          const row = is.addRow([
            inv.invoiceNumber,
            latest.invoiceDate,
            inv.customerName,
            inv.customerContact,
            inv.customerCity,
            inv.customerState,
            latest.totalAmount || 0,
            latest.receivedAmount || 0,
            latest.paymentStatus || 'Pending',
            latest.status || '-',
          ]);
          row.getCell(7).numFmt = '"₹"#,##0';
          row.getCell(8).numFmt = '"₹"#,##0';
          row.eachCell(cell => { cell.alignment = { vertical: 'middle', horizontal: 'left' }; });
        });
        is.views = [{ state: 'frozen', ySplit: 1 }];
      }

      // ── 4. Download ───────────────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Indimart_CRM_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showBanner('✅ Data exported to Excel!', 'success');
    } catch (err) {
      showBanner('❌ Export failed: ' + err.message, 'error');
    }
  };

  // Data source summary
  const dataSource = fbConfigured
    ? (gsUrl ? 'Firebase (primary) + Google Sheets (backup)' : 'Firebase only')
    : (gsUrl ? 'Google Sheets only (no Firebase)' : 'Local device only (no cloud)');
  const dataSourceColor = fbConfigured ? '#10b981' : gsUrl ? '#f59e0b' : '#ef4444';

  return (
    <div className="page-section">
      <div className="section-header"><h2 className="section-title">Settings</h2></div>

      {/* ── Data Source Status Banner ── */}
      <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.25)', border: `1.5px solid ${dataSourceColor}`, borderRadius: '0.75rem', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>📡 Current Data Source</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: dataSourceColor }}>{dataSource}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: fbConfigured ? '#10b981' : '#64748b', display: 'inline-block' }} />
            <span style={{ color: fbConfigured ? '#10b981' : '#64748b' }}>Firebase {fbConfigured ? `● ON — reads & writes go to Firestore (${getStoredFirebaseConfig()?.projectId})` : '○ OFF — not connected'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: gsUrl ? '#3b82f6' : '#64748b', display: 'inline-block' }} />
            <span style={{ color: gsUrl ? '#3b82f6' : '#64748b' }}>Google Sheets {gsUrl ? `● ${autoSyncEnabled ? 'ON — auto-backup active' : 'ON — manual sync only (auto off)'}` : '○ OFF — no URL saved'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
            <span style={{ color: '#8b5cf6' }}>Local Cache ● always active (offline fallback)</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Company details */}
        <form onSubmit={handleSettingsSubmit} style={{ display: 'contents' }}>
          <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', color: 'var(--primary)' }}>Company Details</h3>
            <div className="form-row three">
              <div className="form-group"><label>Company Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="form-group"><label>GSTIN / UIN (Full)</label><input value={form.gst || ''} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} placeholder="e.g. 29AAKCM6046P1ZN" /></div>
              <div className="form-group"><label>GST (Invoice Display)</label><input value={form.companyGst || ''} onChange={e => setForm(f => ({ ...f, companyGst: e.target.value }))} placeholder="e.g. 29AAKCM6046P1ZN" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Mobile</label><input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} style={{ resize: 'none' }} /></div>
            <div className="form-row">
              <div className="form-group"><label>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
              <div className="form-group"><label>VAT TIN</label><input value={form.vat || ''} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))} placeholder="e.g. 29491370401" /></div>
              <div className="form-group"><label>CST No.</label><input value={form.cst || ''} onChange={e => setForm(f => ({ ...f, cst: e.target.value }))} placeholder="e.g. 29491370401" /></div>
              <div className="form-group"><label>PAN</label><input value={form.pan || ''} onChange={e => setForm(f => ({ ...f, pan: e.target.value }))} placeholder="e.g. AAKCM6046P" /></div>
            </div>

            <h4 style={{ margin: '1rem 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Bank Details</h4>
            <div className="form-row">
              <div className="form-group"><label>Bank Name</label><input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} /></div>
              <div className="form-group"><label>Account No.</label><input value={form.accNo} onChange={e => setForm(f => ({ ...f, accNo: e.target.value }))} /></div>
              <div className="form-group"><label>IFSC Code</label><input value={form.ifsc} onChange={e => setForm(f => ({ ...f, ifsc: e.target.value }))} /></div>
              <div className="form-group"><label>Branch</label><input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} /></div>
            </div>

            <h4 style={{ margin: '1rem 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Invoice Settings</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Invoice Format</label>
                <select value={form.invoiceFormat || 'standard'} onChange={e => setForm(f => ({ ...f, invoiceFormat: e.target.value }))}>
                  <option value="standard">Standard (e.g. IN101)</option>
                  <option value="custom">Custom Prefix (e.g. PI/25-26/IN101)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Invoice Prefix</label>
                <input value={form.invoicePrefix || ''} onChange={e => setForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="e.g. PI" disabled={form.invoiceFormat !== 'custom'} style={{ opacity: form.invoiceFormat !== 'custom' ? 0.4 : 1 }} />
              </div>
            </div>
            {form.invoiceFormat === 'custom' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Financial Year <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>(for invoice number format)</span></label>
                  <select
                    value={form.invoiceFinYear || 'auto'}
                    onChange={e => setForm(f => ({ ...f, invoiceFinYear: e.target.value }))}
                  >
                    <option value="auto">Auto (based on today's date)</option>
                    {(() => {
                      const now = new Date();
                      const yr = now.getFullYear();
                      return [yr - 1, yr, yr + 1].map(y => {
                        const fy = `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
                        return <option key={fy} value={fy}>{fy} (April {y} – March {y + 1})</option>;
                      });
                    })()}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    Active year: <strong style={{ color: 'var(--primary)' }}>
                      {(() => {
                        if (form.invoiceFinYear && form.invoiceFinYear !== 'auto') return form.invoiceFinYear;
                        const now = new Date();
                        const y = now.getFullYear();
                        const m = now.getMonth();
                        return m >= 3
                          ? `${String(y).slice(-2)}-${String(y+1).slice(-2)}`
                          : `${String(y-1).slice(-2)}-${String(y).slice(-2)}`;
                      })()}
                    </strong>
                  </div>
                </div>
                <div className="form-group">
                  <label>Invoice Start Number <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>(for new financial year reset)</span></label>
                  <input
                    type="number" min="1"
                    value={form.invoiceStartNumber || ''}
                    onChange={e => setForm(f => ({ ...f, invoiceStartNumber: e.target.value }))}
                    placeholder="e.g. 101 (leave blank = continue from last)"
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4 }}>Set this when starting a new financial year to reset counter</div>
                </div>
              </div>
            )}
            {/* Live preview */}
            <div style={{ padding: '0.6rem 0.9rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '0.5rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Next invoice preview: </span>
              <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>
                {(() => {
                  const fmt = form.invoiceFormat || 'standard';
                  const prefix = (form.invoicePrefix || '').trim();
                  const startNum = parseInt(form.invoiceStartNumber) || 101;
                  if (fmt === 'custom' && prefix) {
                    let fy = form.invoiceFinYear && form.invoiceFinYear !== 'auto' ? form.invoiceFinYear : null;
                    if (!fy) {
                      const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
                      fy = m >= 3 ? `${String(y).slice(-2)}-${String(y+1).slice(-2)}` : `${String(y-1).slice(-2)}-${String(y).slice(-2)}`;
                    }
                    return `${prefix}/${fy}/IN${startNum}`;
                  }
                  return `IN${startNum}`;
                })()}
              </strong>
            </div>

            <h4 style={{ margin: '1rem 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Company Seal</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {form.seal && <img src={form.seal} alt="seal" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }} />}
              <input ref={sealRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSealUpload} />
              <button type="button" className="btn btn-secondary" onClick={() => sealRef.current?.click()}><Upload size={14} /> Upload Seal</button>
              {form.seal && <button type="button" className="btn btn-danger" onClick={() => setForm(f => ({ ...f, seal: '' }))}><X size={14} /> Remove</button>}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save Settings</button>
            </div>
          </div>
        </form>

        {/* Firebase */}
        <div className="glass-card" style={{ gridColumn: '1 / -1', border: fbConfigured ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={16} style={{ color: '#f59e0b' }} /> Firebase Database
              <span style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '1px 6px' }}>PRIMARY — all data reads &amp; writes</span>
            </h3>
            {fbConfigured ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 999, padding: '3px 10px', fontWeight: 700 }}>
                <CheckCircle size={12} /> Active · {getStoredFirebaseConfig()?.projectId}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 999, padding: '3px 10px', fontWeight: 700 }}>
                <AlertCircle size={12} /> Disabled — using local cache only
              </span>
            )}
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {fbConfigured
              ? '✅ Data is fetched from and saved to Firestore in real-time. Works across all devices and browsers.'
              : '⚠️ Firebase is off. Data only exists on this device in local storage.'}
          </p>

          {!showFbForm && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowFbForm(true)}>
                <Settings2 size={14} /> {fbConfigured ? 'Edit Config' : 'Connect Firebase'}
              </button>
              {fbConfigured && (
                <>
                  <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none' }} onClick={() => setShowMigration(true)}>
                    <Flame size={14} /> Migrate Local Data → Firebase
                  </button>
                  <button className="btn btn-danger" onClick={handleDisconnectFirebase} title="Removes Firebase config. Data stays in local cache only.">
                    <X size={14} /> Disconnect Firebase
                  </button>
                </>
              )}
            </div>
          )}

          {showFbForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[{k:'apiKey',l:'API Key',s:true},{k:'authDomain',l:'Auth Domain',s:false},{k:'projectId',l:'Project ID',s:false},{k:'storageBucket',l:'Storage Bucket',s:false},{k:'messagingSenderId',l:'Messaging Sender ID',s:false},{k:'appId',l:'App ID',s:true}].map(({k,l,s}) => (
                <div key={k} className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.72rem' }}>{l}{['apiKey','projectId','appId'].includes(k) && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}</label>
                  <div style={{ display: 'flex' }}>
                    <input
                      type={s && !fbSecrets[k] ? 'password' : 'text'}
                      value={fbForm[k] || ''}
                      onChange={e => setFbForm(f => ({ ...f, [k]: e.target.value.trim() }))}
                      style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', borderRadius: s ? '0.4rem 0 0 0.4rem' : '0.4rem', borderRight: s ? 'none' : undefined }}
                    />
                    {s && <button type="button" onClick={() => setFbSecrets(x => ({ ...x, [k]: !x[k] }))} style={{ padding: '0 0.6rem', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderLeft: 'none', borderRadius: '0 0.4rem 0.4rem 0', cursor: 'pointer', color: 'var(--text-dim)' }}>{fbSecrets[k] ? <EyeOff size={13}/> : <Eye size={13}/>}</button>}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setShowFbForm(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none' }} onClick={handleSaveFirebase} disabled={fbSaving}>
                  <Flame size={14} /> {fbSaving ? 'Connecting...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Google Sheets Sync */}
        <div className="glass-card" style={{ gridColumn: '1 / -1', border: gsUrl ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={16} /> Google Sheets
              <span style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '1px 6px' }}>BACKUP — writes only, never primary</span>
            </h3>
            {gsUrl ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 999, padding: '3px 10px', fontWeight: 700 }}>
                <CheckCircle size={12} /> URL saved · {autoSyncEnabled ? 'Auto-backup ON' : 'Manual only'}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 999, padding: '3px 10px', fontWeight: 700 }}>
                <AlertCircle size={12} /> Disabled — no URL
              </span>
            )}
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {gsUrl
              ? (autoSyncEnabled ? '🔄 Every save automatically mirrors data to Google Sheets in background. Firebase remains the source of truth.' : '📋 Google Sheets URL saved. Use manual buttons below to push/pull. Auto-backup is currently OFF.')
              : '📋 Paste your Google Apps Script URL below to enable Sheets backup. This never replaces Firebase — it only mirrors data.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input value={localGsUrl} onChange={e => setLocalGsUrl(e.target.value)} placeholder="Paste Google Apps Script Web App URL here" style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn-secondary" onClick={handleTestConn} disabled={testingConn || !localGsUrl}><Wifi size={14} />{testingConn ? ' Testing...' : ' Test'}</button>
            {gsUrl && <button className="btn btn-danger" onClick={() => { saveGsUrl(''); setLocalGsUrl(''); showBanner('Google Sheets disconnected.', 'info'); }} title="Clear URL to stop all GS syncing"><X size={14} /> Disable GS</button>}
          </div>
          {gsUrl && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={pullFromSheets} disabled={isSyncing}><Download size={14} /> Pull from Sheets</button>
                <button className="btn btn-secondary" onClick={pushToSheets} disabled={isSyncing}><UploadIcon size={14} /> Push to Sheets</button>
                <button className="btn btn-primary" onClick={fullSync} disabled={isSyncing}><RefreshCw size={14} /> Full Sync</button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <div onClick={() => toggleAutoSync(!autoSyncEnabled)} style={{ width: 36, height: 20, background: autoSyncEnabled ? 'var(--primary)' : '#334155', borderRadius: 999, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: autoSyncEnabled ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                </div>
                <span><strong>Auto-backup on save</strong> — {autoSyncEnabled ? 'every save silently mirrors to Sheets' : 'OFF — use manual Push button above'}</span>
              </label>
            </>
          )}
        </div>

        {/* Data Management */}
        <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--primary)' }}>Data Management</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={exportData}><Download size={14} /> Export All Data (Excel)</button>
            <button className="btn btn-danger" onClick={clearLocalCache}><Trash2 size={14} /> Clear All Local Data</button>
          </div>
        </div>
      </div>

      {showMigration && <MigrationWizard onClose={() => setShowMigration(false)} />}
    </div>
  );
}
