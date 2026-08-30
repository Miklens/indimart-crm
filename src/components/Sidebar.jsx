import { useState, useRef } from 'react';
import { LayoutDashboard, Users, ShoppingBag, Package, FileText, Repeat, ListChecks, MessageSquare, BarChart2, Settings, ChevronLeft, ChevronRight, Bell, Wifi, WifiOff, Loader, Upload, Download, Sun, Moon, Search, LogOut, X, FileSpreadsheet } from 'lucide-react';
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
  const { currentSection, setCurrentSection, leads, syncStatus, isSyncing, addLead, showBanner, invoiceHistory } = useApp();
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

  // ── Executive Excel Export Engine ──────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

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
        return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };

      // ── 1. Dashboard Sheet ────────────────────────────────────────────────
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
      const purpleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      const amberFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
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
      const titleR = ds.addRow([`IndiaMART CRM — Executive Report  |  ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, '', '', '', '']);
      ds.mergeCells(titleR.number, 1, titleR.number, 5);
      titleR.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleR.getCell(1).fill = darkFill; titleR.getCell(1).alignment = dsCenter; titleR.height = 28;

      const dsPaidInv = (invoiceHistory || []).filter(inv => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return (parseFloat(v.receivedAmount)||0) > 0; });
      const dsConfirmedRev = dsPaidInv.reduce((s, inv) => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return s + (parseFloat(v.totalAmount)||0); }, 0);
      const dsTotalReceived = dsPaidInv.reduce((s, inv) => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return s + (parseFloat(v.receivedAmount)||0); }, 0);
      const dsBilledIds = new Set(dsPaidInv.map(inv => inv.leadId).filter(Boolean));
      const dsValidLeads = leads.filter(l => !DATA_CONFIG.getLostStatusLabels().includes(l.status)).length;
      const dsConvRate = dsValidLeads ? ((dsBilledIds.size / dsValidLeads) * 100).toFixed(1) : '0';
      const dsPending = Math.max(0, dsConfirmedRev - dsTotalReceived);
      const dsInTransit = (invoiceHistory || []).filter(inv => { const v = inv.versions?.length ? inv.versions[inv.versions.length-1] : inv; return v.deliveryStatus === 'Material Dispatched'; }).length;
      const dsWonAll = DATA_CONFIG.getWonStatusLabels();
      const dsProjectedRev = leads.filter(l => !dsBilledIds.has(l.id) && !['Lost', 'Not Responding', 'Not Interested', 'Won'].includes(DATA_CONFIG.getSimpleStatusLabel(l.status))).reduce((s,l) => s+(l.orderValue||0), 0);

      dsSection('📊  KEY PERFORMANCE INDICATORS', greenFill);
      dsColHead('KPI Metric', 'Value', 'Notes / Context');
      [
        ['Pipeline Enquiries',    leads.length,      'Total Inbound Leads',                            false],
        ['Actual Sales (Billed)', dsConfirmedRev,    `From ${dsPaidInv.length} paid orders`,           true],
        ['Outstanding Payments',  dsPending,         `Collected: ₹${dsTotalReceived.toLocaleString('en-IN')}`, true],
        ['In-Transit Orders',     dsInTransit,       'Active Material Dispatches',                     false],
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

      // Top Products
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

      // City Revenue
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
        { header: 'Remarks', width: 35 },
      ];
      const headerRow = ws.getRow(1);
      headerRow.height = 30;
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
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
            idx === 0 ? (l.remarks || '') : '',
          ];

          const row = ws.addRow(rowData);
          row.getCell(11).numFmt = '"₹"#,##0';
          row.getCell(12).numFmt = '"₹"#,##0';
          row.getCell(13).numFmt = '"₹"#,##0';
        });

        if (rowCount > 1) {
          const mergeCols = [1, 2, 3, 4, 5, 6, 7, 8, 13, 14];
          mergeCols.forEach(col => {
            ws.mergeCells(currentRow, col, currentRow + rowCount - 1, col);
          });
        }
        currentRow += rowCount;
      });

      // ── 3. Summary Sheet ──────────────────────────────────────────────────
      const ss = wb.addWorksheet('Summary');
      ss.addRow(['Metric', 'Value', 'Percentage']);
      ss.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      ss.addRow(['Total Leads', leads.length, '100%']);
      ss.addRow(['Total Value', leads.reduce((s, l) => s + (l.orderValue || 0), 0), '-']);
      ss.getRow(3).getCell(2).numFmt = '"₹"#,##0';
      ss.addRow(['Converted / Billed', dsBilledIds.size, `${dsConvRate}% of Valid`]);
      ss.getColumn(1).width = 25;
      ss.getColumn(2).width = 18;
      ss.getColumn(3).width = 18;

      // ── 4. Invoices Sheet ─────────────────────────────────────────────────
      if (invoiceHistory?.length) {
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
          { header: 'Delivery Status', width: 18 },
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
            latest.deliveryStatus || '-',
          ]);
          row.getCell(7).numFmt = '"₹"#,##0';
          row.getCell(8).numFmt = '"₹"#,##0';
        });
      }

      // ── 5. Download ───────────────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IndiaMART_Executive_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showBanner('📊 Professional Excel Report exported successfully!', 'success');
    } catch (err) {
      showBanner('❌ Export failed: ' + err.message, 'error');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const overdueFollowups = leads.filter(l => l.followUpDate && l.followUpDate <= today && !DATA_CONFIG.getDeadStatusLabels().includes(l.status)).length;

  return (
    <aside 
      className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}
      style={{
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: collapsed ? '1.2rem 0.6rem' : '1.2rem 1.1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 68 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #00d09c 0%, #059669 100%)',
              borderRadius: '0.65rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.82rem', fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 14px rgba(16,185,129,0.45)',
              flexShrink: 0
            }}>
              IM
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                IndiaMART CRM
                <span style={{ fontSize: '0.58rem', background: 'rgba(16,185,129,0.18)', color: '#10b981', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>PRO</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span> Live Connected
              </div>
            </div>
          </div>
        )}
        <button className="btn-icon" onClick={() => { if (onMobileClose) onMobileClose(); else setCollapsed(c => !c); }} style={{ marginLeft: collapsed ? 'auto' : 0, color: 'var(--text-dim)' }}>
          {mobileOpen ? <X size={18} /> : collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Global Search Bar */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 0.85rem 0.25rem' }}>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', padding: '0.55rem 0.75rem',
              borderRadius: '0.65rem',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-input)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'all 0.2s var(--ease-spring)'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(16,185,129,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
          >
            <Search size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Quick search...</span>
            <kbd style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '2px 5px', color: 'var(--text-dim)', fontFamily: 'inherit', fontWeight: 600 }}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <nav style={{ flex: 1, padding: '0.5rem 0.65rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentSection === id;
          return (
            <button
              key={id}
              onClick={() => { setCurrentSection(id); if (onMobileClose) onMobileClose(); }}
              title={collapsed ? label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                width: '100%', padding: collapsed ? '0.75rem' : '0.65rem 0.85rem',
                borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                background: active ? 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.08))' : 'transparent',
                color: active ? '#10b981' : 'var(--text-dim)',
                fontWeight: active ? 700 : 500,
                fontSize: '0.85rem',
                transition: 'all 0.2s var(--ease-spring)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                border: active ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'var(--text-main)';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-dim)';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <Icon size={18} style={{ flexShrink: 0, color: active ? '#10b981' : 'inherit' }} />
              {!collapsed && <span style={{ letterSpacing: '-0.01em' }}>{label}</span>}
              {!collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999, boxShadow: '0 0 10px rgba(239,68,68,0.5)' }}>{overdueFollowups}</span>
              )}
              {collapsed && id === 'followups' && overdueFollowups > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 8px #ef4444' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick actions & Professional Export */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 0.85rem', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          
          {/* Professional Excel Export Button */}
          <button 
            className="btn btn-primary"
            onClick={handleExportCSV}
            title="Export executive formatted Excel report (Dashboard, Leads, Summary, Invoices)"
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
            }}
          >
            <FileSpreadsheet size={15} /> <span>Export Excel Report</span>
          </button>

          <button onClick={() => csvRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Upload size={12} /> Import Leads CSV
          </button>

          {/* Theme Switcher Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.1rem', marginTop: '2px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Theme Mode</span>
            <div className="theme-toggle" onClick={onThemeToggle} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
              <button className={`theme-toggle-btn${theme === 'light' ? ' active' : ''}`}><Sun size={13} /></button>
              <button className={`theme-toggle-btn${theme === 'dark' ? ' active' : ''}`}><Moon size={13} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Logout button */}
      {isFirebaseConfigured() && getCurrentUser() && (
        <div style={{ padding: '0.5rem 0.85rem 0.85rem', borderTop: '1px solid var(--glass-border)' }}>
          <button
            onClick={async () => { await signOutUser(); window.location.reload(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '0.65rem',
              cursor: 'pointer',
              padding: '0.5rem',
              width: '100%',
              color: '#f87171',
              fontSize: '0.78rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={14} />
            {!collapsed && <span>Sign Out ({getCurrentUser()?.email?.split('@')[0]})</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
