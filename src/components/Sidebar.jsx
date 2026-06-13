import { useState, useRef } from 'react';
import { LayoutDashboard, Users, ShoppingBag, Package, FileText, Repeat, ListChecks, MessageSquare, BarChart2, Settings, ChevronLeft, ChevronRight, Bell, RefreshCw, Wifi, WifiOff, Loader, Upload, Download, Sun, Moon, Search, LogOut, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { signOutUser, isFirebaseConfigured, getCurrentUser } from '../firebase';
import { DATA_CONFIG, normalizeDisplayDate } from '../utils/dataConfig';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'followups', label: 'Follow-ups', icon: Bell },
  { id: 'catalog', label: 'Catalog', icon: ShoppingBag },
  { id: 'products', label: 'Product Demand', icon: Package },
  { id: 'sales', label: 'Sales History', icon: Repeat },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'bulk', label: 'Bulk Tools', icon: ListChecks },
  { id: 'templates', label: 'Templates', icon: MessageSquare },
  { id: 'segments', label: 'Insights', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onMobileClose, theme, onThemeToggle }) {
  const { currentSection, setCurrentSection, leads, syncStatus, isSyncing, autoSyncEnabled, toggleAutoSync, gsUrl, addLead, invoiceHistory, showBanner, companySettings, products } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const csvRef = useRef(null);

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      let imported = 0;
      lines.slice(1).forEach(line => {
        const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
        const row = {};
        headers.forEach((h, i) => row[h] = vals[i] || '');
        if (!row.customername && !row['customer name']) return;
        addLead({
          customerName: row.customername || row['customer name'] || '',
          contact: row.contact || row.mobile || row.phone || '',
          product: row.product || '',
          city: row.city || '', state: row.state || '',
          date: row.date || new Date().toISOString().split('T')[0],
          status: row.status || 'New Enquiry',
          source: row.source || 'Other',
          orderValue: parseFloat(row.ordervalue || row['order value'] || 0),
          remarks: row.remarks || '',
          followUpDate: row.followupdate || '',
          productList: [],
          history: [{ status: 'New Enquiry', timestamp: Date.now() }],
        });
        imported++;
      });
      showBanner(`✅ Imported ${imported} leads`, 'success');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportCSV = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

      // ── 1. Dashboard Sheet (added first so it appears as tab #1) ──────────
      const ds = wb.addWorksheet('Dashboard');

      const cleanCityName = (rawCity, rawState) => {
        if (!rawCity) return 'Other';
        let city = rawCity.trim();
        if (city.includes(',')) {
          const parts = city.split(',').map(p => p.trim());
          const cleanParts = parts.filter(p => {
            const lower = p.toLowerCase();
            return lower !== 'india' && !/^\d{6}$/.test(lower) && !lower.startsWith('india -') && !/^\d+$/.test(lower);
          });
          if (cleanParts.length > 0) {
            const stateLower = (rawState || '').toLowerCase();
            const lastPart = cleanParts[cleanParts.length - 1];
            const lastPartLower = lastPart.toLowerCase();
            const indianStates = [
              'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat',
              'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh',
              'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab',
              'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh',
              'uttarakhand', 'west bengal', 'delhi'
            ];
            if (indianStates.includes(lastPartLower) || lastPartLower === stateLower) {
              city = cleanParts[cleanParts.length - 2] || lastPart;
            } else {
              city = lastPart;
            }
          }
        }
        const indianStates = [
          'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat',
          'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh',
          'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab',
          'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh',
          'uttarakhand', 'west bengal', 'delhi'
        ];
        if (indianStates.includes(city.toLowerCase())) {
          return 'Other';
        }
        return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };
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
      const dsValidLeads = leads.filter(l => DATA_CONFIG.getSimpleStatusLabel(l.status) !== 'Lost').length;
      const dsConvRate = dsValidLeads ? ((dsBilledIds.size / dsValidLeads) * 100).toFixed(1) : '0';
      const dsContactedCount = leads.filter(l => ['Contacted', 'Quoted', 'Won'].includes(DATA_CONFIG.getSimpleStatusLabel(l.status))).length;
      const dsContactRate = leads.length ? ((dsContactedCount / leads.length) * 100).toFixed(1) : '0';
      const dsPending = Math.max(0, dsConfirmedRev - dsTotalReceived);
      const dsInTransit = leads.filter(l => DATA_CONFIG.getStatusGroupStatuses('inTransit').includes(l.status)).length;
      const dsWonAll = DATA_CONFIG.getWonStatusLabels();
      const dsProjectedRev = leads.filter(l => !dsBilledIds.has(l.id) && !['Lost', 'Not Responding', 'Not Interested', 'Won'].includes(DATA_CONFIG.getSimpleStatusLabel(l.status))).reduce((s,l) => s+(l.orderValue||0), 0);

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
      leads.forEach(l => {
        const simple = DATA_CONFIG.getSimpleStatusLabel(l.status);
        dsStatusCounts[simple] = (dsStatusCounts[simple]||0) + 1;
      });
      const dsWonOnes  = ['Won'];
      const dsLostOnes = ['Lost', 'Not Responding', 'Not Interested'];
      const orderedStatuses = ['New Enquiry', 'Contacted', 'Quoted', 'Not Responding', 'Won', 'Lost', 'Not Interested'];
      
      orderedStatuses.forEach(status => {
        const count = dsStatusCounts[status] || 0;
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
          const city = cleanCityName(inv.customerCity || inv.city, inv.customerState || inv.state);
          dsCityRev[city] = (dsCityRev[city]||0) + (parseFloat(v.totalAmount)||0);
        });
      } else {
        leads.filter(l => dsWonAll.includes(l.status)).forEach(l => {
          const city = cleanCityName(l.city, l.state);
          dsCityRev[city] = (dsCityRev[city]||0) + (parseFloat(l.orderValue)||0);
        });
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
            idx === 0 ? cleanCityName(l.city, l.state) : '',
            idx === 0 ? l.state : '',
            idx === 0 ? (l.source || '') : '',
            idx === 0 ? (l.gst || '') : '',
            p.name || '',
            p.qty || 0,
            p.price || 0,
            (p.price || 0) * (p.qty || 0),
            idx === 0 ? (l.orderValue || 0) : '',
            idx === 0 ? DATA_CONFIG.getSimpleStatusLabel(l.status) : '',
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
            const simple = DATA_CONFIG.getSimpleStatusLabel(l.status);
            const wonStatuses = ['Won'];
            const lostStatuses = ['Lost', 'Not Responding', 'Not Interested'];
            if (wonStatuses.includes(simple)) {
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
              statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
            } else if (lostStatuses.includes(simple)) {
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

      // ── 3. Summary Sheet ──────────────────────────────────────────────────
      const ss = wb.addWorksheet('Summary');
      const totalLeads = leads.length;
      const totalValue = leads.reduce((s, l) => s + (l.orderValue || 0), 0);
      const ssPaidInv = invoiceHistory.filter(inv => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return (parseFloat(v.receivedAmount)||0) > 0; });
      const ssBilledIds = new Set(ssPaidInv.map(inv => inv.leadId).filter(Boolean));
      const ssValidLeads = leads.filter(l => DATA_CONFIG.getSimpleStatusLabel(l.status) !== 'Lost').length;
      const convertedLeads = ssBilledIds.size;
      const conversionRate = ssValidLeads > 0 ? ((convertedLeads / ssValidLeads) * 100).toFixed(2) : 0;
      const statusCounts = {};
      leads.forEach(l => {
        const simple = DATA_CONFIG.getSimpleStatusLabel(l.status);
        statusCounts[simple] = (statusCounts[simple] || 0) + 1;
      });

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
      orderedStatuses.forEach(status => {
        const count = statusCounts[status] || 0;
        const pct = totalLeads ? ((count / totalLeads) * 100).toFixed(2) : '0.00';
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

      // ── 4. Invoices Sheet ─────────────────────────────────────────────────
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
            cleanCityName(inv.customerCity || inv.city, inv.customerState || inv.state),
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

      // ── 5. Download ───────────────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indiamart_CRM_REPORT_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showBanner('✅ Data exported to Excel!', 'success');
    } catch (err) {
      showBanner('❌ Export failed: ' + err.message, 'error');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const overdueFollowups = leads.filter(l => l.followUpDate && l.followUpDate <= today && !DATA_CONFIG.getDeadStatusLabels().includes(l.status)).length;

  const SyncIcon = isSyncing ? Loader : syncStatus.status === 'connected' ? Wifi : syncStatus.status === 'error' ? WifiOff : Wifi;
  const syncColor = syncStatus.status === 'connected' ? '#10b981' : syncStatus.status === 'error' ? '#ef4444' : syncStatus.status === 'syncing' ? '#f59e0b' : '#94a3b8';

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <aside style={{
      width: collapsed ? 56 : 220,
      minWidth: collapsed ? 56 : 220,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.25s ease, width 0.2s',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100%',
      overflow: 'hidden',
      zIndex: 160,
      ...(mobileOpen ? { transform: 'translateX(0)' } : {}),
    }}
    className="app-sidebar"
    >
      {/* Header */}
      <div style={{ padding: collapsed ? '1rem 0.6rem' : '1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 60 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>IM</div>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f1f5f9', letterSpacing: '-0.01em' }}>IndiaMART CRM</span>
          </div>
        )}
        <button className="btn-icon" onClick={() => { if (onMobileClose) onMobileClose(); else setCollapsed(c => !c); }} style={{ marginLeft: collapsed ? 'auto' : 0, color: '#94a3b8' }}>
          {mobileOpen ? <X size={18} /> : collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Search trigger */}
      {!collapsed && (
        <div style={{ padding: '0.5rem 0.75rem' }}>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <Search size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
            <kbd style={{ fontSize: '0.6rem', background: 'var(--bg-card2)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>Ctrl K</kbd>
          </button>
        </div>
      )}

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0.4rem 0.5rem', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentSection === id;
          return (
            <button
              key={id}
              onClick={() => { setCurrentSection(id); if (onMobileClose) onMobileClose(); }}
              title={collapsed ? label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem',
                width: '100%', padding: collapsed ? '0.65rem' : '0.6rem 0.75rem',
                borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                background: active ? 'rgba(16,185,129,0.18)' : 'transparent',
                color: active ? '#10b981' : '#8da4bf',
                fontWeight: active ? 700 : 500,
                fontSize: '0.82rem',
                marginBottom: '0.1rem',
                transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>{overdueFollowups}</span>
              )}
              {collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick actions: Import / Export */}
      {!collapsed && (
        <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          <button onClick={() => csvRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.5rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.15rem' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Upload size={13} /><span>Import CSV</span>
          </button>
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.5rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8', fontSize: '0.78rem' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Download size={13} /><span>Export Data</span>
          </button>

          {/* Theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', padding: '0.35rem 0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#7a90a8', fontWeight: 600 }}>Appearance</span>
            <div className="theme-toggle" onClick={onThemeToggle} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
              <button className={`theme-toggle-btn${theme === 'light' ? ' active' : ''}`}><Sun size={13} /></button>
              <button className={`theme-toggle-btn${theme === 'dark' ? ' active' : ''}`}><Moon size={13} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Sync status + auto-sync toggle */}
      {!collapsed && gsUrl && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <SyncIcon size={12} style={{ color: syncColor, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            <span style={{ fontSize: '0.7rem', color: syncColor, fontWeight: 600 }}>{syncStatus.text}</span>
          </div>
          <button
            onClick={() => toggleAutoSync(!autoSyncEnabled)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', width: '100%' }}
          >
            <div style={{ width: 32, height: 16, background: autoSyncEnabled ? '#10b981' : '#334155', borderRadius: 999, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: autoSyncEnabled ? 18 : 2, width: 12, height: 12, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Auto-sync {autoSyncEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      )}
      {/* Logout button — only shown when Firebase auth is active */}
      {isFirebaseConfigured() && getCurrentUser() && (
        <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={async () => { await signOutUser(); window.location.reload(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.75rem', width: '100%', color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}
          >
            <LogOut size={13} />
            {!collapsed && <span>Sign Out ({getCurrentUser()?.email?.split('@')[0]})</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
