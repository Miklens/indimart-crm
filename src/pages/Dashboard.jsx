import { useEffect, useRef, useState, useCallback } from 'react';
import { Users, TrendingUp, AlertCircle, Truck, DollarSign, Zap, FileDown, Plus, FileText, ListChecks, ArrowUpRight, CheckCircle, Sparkles } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

Chart.register(...registerables);

const ChartCard = ({ title, canvasRef, height = 220, hasData = true }) => (
  <div className="glass-card" style={{ padding: '1.25rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {title}
      </h4>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
    </div>
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {hasData ? (
        <canvas ref={canvasRef} />
      ) : (
        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' }}>No data available</div>
      )}
    </div>
  </div>
);

export default function Dashboard() {
  const { leads, invoiceHistory, setCurrentSection, products } = useApp();
  const [monthlyCost, setMonthlyCost] = useState(() => parseFloat(localStorage.getItem('indimart_monthlyCost') || '0'));
  const dashboardRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const chartsRef = useRef({});
  const refDist = useRef(null);
  const refLost = useRef(null);
  const refProduct = useRef(null);
  const refCity = useRef(null);
  const refFunnel = useRef(null);
  const refTrend = useRef(null);
  const canvasRefs = { dist: refDist, lost: refLost, product: refProduct, city: refCity, funnel: refFunnel, trend: refTrend };

  // KPI calculations
  const paidInvoices = invoiceHistory.filter(inv => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return (parseFloat(latest.receivedAmount) || 0) > 0;
  });
  const confirmedRevenue = paidInvoices.reduce((sum, inv) => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return sum + (parseFloat(latest.totalAmount) || 0);
  }, 0);
  const totalReceived = paidInvoices.reduce((sum, inv) => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return sum + (parseFloat(latest.receivedAmount) || 0);
  }, 0);
  const pendingPaymentTotal = confirmedRevenue - totalReceived;
  const billedLeadIds = new Set(
    paidInvoices
      .map(inv => {
        const lead = DATA_CONFIG.getLeadForInvoice(inv, leads);
        return lead ? lead.id : null;
      })
      .filter(Boolean)
  );
  const paidOrderCount = paidInvoices.length;
  const projectedRevenue = leads
    .filter(l => !billedLeadIds.has(l.id) && !new Set([...DATA_CONFIG.getWonStatusLabels(), ...DATA_CONFIG.getLostStatusLabels()]).has(l.status))
    .reduce((sum, l) => sum + (l.orderValue || 0), 0);
  const inTransitCount = invoiceHistory.filter(inv => {
    const latest = inv.versions?.length ? inv.versions[inv.versions.length - 1] : inv;
    return latest.deliveryStatus === 'Material Dispatched';
  }).length;
  const validLeads = leads.filter(l => !DATA_CONFIG.getLostStatusLabels().includes(l.status)).length;
  const conversionRate = validLeads ? ((billedLeadIds.size / validLeads) * 100).toFixed(0) : 0;
  const contacted = leads.filter(l => DATA_CONFIG.getContactedStatusLabels().includes(l.status));
  const contactRate = leads.length ? ((contacted.length / leads.length) * 100).toFixed(0) : 0;

  const kpis = [
    { label: 'Pipeline Leads', value: leads.length, sub: `${contactRate}% Contacted`, color: '#38bdf8', icon: Users, onClick: () => setCurrentSection('leads'), bgGlow: 'rgba(56,189,248,0.1)' },
    { label: 'ACTUAL BILLED SALES', value: `₹${confirmedRevenue.toLocaleString()}`, sub: `From ${paidOrderCount} Orders`, color: '#10b981', icon: TrendingUp, bgGlow: 'rgba(16,185,129,0.12)' },
    { label: 'Outstanding Balance', value: `₹${Math.max(0, pendingPaymentTotal).toLocaleString()}`, sub: `Collected: ₹${totalReceived.toLocaleString()}`, color: pendingPaymentTotal > 0 ? '#ef4444' : '#10b981', icon: AlertCircle, onClick: () => setCurrentSection('invoices'), bgGlow: 'rgba(239,68,68,0.1)' },
    { label: 'In-Transit Shipments', value: inTransitCount, sub: 'Active Deliveries', color: '#6366f1', icon: Truck, onClick: () => setCurrentSection('invoices'), bgGlow: 'rgba(99,102,241,0.1)' },
    { label: 'Projected Pipeline', value: `₹${projectedRevenue.toLocaleString()}`, sub: 'Unbilled Enquiries', color: '#f59e0b', icon: DollarSign, bgGlow: 'rgba(245,158,11,0.1)' },
    { label: 'Conversion Success', value: `${conversionRate}%`, sub: `${billedLeadIds.size} Billed / ${validLeads} Valid`, color: '#10b981', icon: Zap, bgGlow: 'rgba(16,185,129,0.12)' },
  ];

  useEffect(() => {
    Object.values(chartsRef.current).forEach(c => c?.destroy());
    chartsRef.current = {};

    const chartColor = { grid: 'rgba(255,255,255,0.05)', text: '#94a3b8' };

    // 1. Status distribution donut
    const statusCounts = {};
    leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
    if (canvasRefs.dist.current && leads.length) {
      chartsRef.current.dist = new Chart(canvasRefs.dist.current, {
        type: 'doughnut',
        data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: Object.keys(statusCounts).map(s => DATA_CONFIG.getStatusColor(s)), borderWidth: 0 }] },
        options: { plugins: { legend: { display: false } }, cutout: '72%', responsive: true, maintainAspectRatio: false },
      });
    }

    // 2. Lost reasons polar
    const lostLeads = leads.filter(l => DATA_CONFIG.getLostStatusLabels().includes(l.status));
    const reasonCounts = {};
    lostLeads.forEach(l => { reasonCounts[l.lostReason || 'Unknown'] = (reasonCounts[l.lostReason || 'Unknown'] || 0) + 1; });
    if (canvasRefs.lost.current && lostLeads.length) {
      chartsRef.current.lost = new Chart(canvasRefs.lost.current, {
        type: 'polarArea',
        data: { labels: Object.keys(reasonCounts), datasets: [{ data: Object.values(reasonCounts), backgroundColor: ['#ef4444','#f97316','#f59e0b','#84cc16','#06b6d4','#3b82f6','#6366f1'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: chartColor.text, boxWidth: 8, font: { size: 10 } } } } },
      });
    }

    // 3. Top product categories bar
    const categoryRevenue = {};
    const wonLabels = DATA_CONFIG.getWonStatusLabels();
    leads.filter(l => wonLabels.includes(l.status)).forEach(l => {
      (l.productList || [{ name: l.product, price: l.orderValue, qty: 1 }]).forEach(item => {
        if (!item.name) return;
        const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const itemClean = clean(item.name.replace('[NEW] ', ''));
        const catProduct = products.find(p => clean(p.name) === itemClean) || 
                           products.find(p => itemClean.includes(clean(p.name))) || 
                           products.find(p => clean(p.name).includes(itemClean));
        const category = catProduct?.category || 'Uncategorized';
        categoryRevenue[category] = (categoryRevenue[category] || 0) + ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1));
      });
    });
    const sortedCats = Object.entries(categoryRevenue).sort((a,b) => b[1]-a[1]).slice(0,5);
    if (canvasRefs.product.current && sortedCats.length) {
      chartsRef.current.product = new Chart(canvasRefs.product.current, {
        type: 'bar',
        data: { labels: sortedCats.map(p=>p[0]), datasets: [{ label: 'Revenue (₹)', data: sortedCats.map(p=>p[1]), backgroundColor: '#10b981', borderRadius: 6 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: chartColor.text } }, y: { grid: { display: false }, ticks: { color: chartColor.text } } } },
      });
    }

    // 4. City revenue pie
    const cityRevenue = {};
    leads.filter(l => wonLabels.includes(l.status)).forEach(l => {
      const city = l.city || 'Other';
      cityRevenue[city] = (cityRevenue[city] || 0) + (parseFloat(l.orderValue) || 0);
    });
    const sortedCities = Object.entries(cityRevenue).sort((a,b) => b[1]-a[1]).slice(0,5);
    if (canvasRefs.city.current && sortedCities.length) {
      chartsRef.current.city = new Chart(canvasRefs.city.current, {
        type: 'pie',
        data: { labels: sortedCities.map(c=>c[0]), datasets: [{ data: sortedCities.map(c=>c[1]), backgroundColor: ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: chartColor.text, boxWidth: 8 } } } },
      });
    }

    // 5. Sales funnel bar
    const funnelData = [
      leads.length,
      leads.filter(l => DATA_CONFIG.getContactedStatusLabels().includes(l.status)).length,
      leads.filter(l => [...DATA_CONFIG.getStatusGroupStatuses('quoted'), ...wonLabels].includes(l.status)).length,
      leads.filter(l => wonLabels.includes(l.status)).length,
      leads.filter(l => wonLabels.includes(l.status)).length,
    ];
    if (canvasRefs.funnel.current && leads.length) {
      chartsRef.current.funnel = new Chart(canvasRefs.funnel.current, {
        type: 'bar',
        data: { labels: ['Total','Contacted','Quoted','Converted','Purchased'], datasets: [{ data: funnelData, backgroundColor: ['#3b82f6','#06b6d4','#f59e0b','#10b981','#047857'], borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: chartColor.grid }, ticks: { color: chartColor.text } }, x: { grid: { display: false }, ticks: { color: chartColor.text } } } },
      });
    }

    // 6. Monthly trend line
    const monthlyData = {};
    leads.forEach(l => {
      const month = (l.date || '').substring(0, 7);
      if (!month) return;
      if (!monthlyData[month]) monthlyData[month] = { revenue: 0, count: 0 };
      if (wonLabels.includes(l.status)) monthlyData[month].revenue += l.orderValue;
      monthlyData[month].count++;
    });
    const months = Object.keys(monthlyData).sort();
    if (canvasRefs.trend.current && months.length) {
      chartsRef.current.trend = new Chart(canvasRefs.trend.current, {
        type: 'line',
        data: { 
          labels: months, 
          datasets: [
            { label: 'Revenue (₹)', data: months.map(m => monthlyData[m].revenue), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
            { label: 'Total Enquiries', data: months.map(m => monthlyData[m].count), borderColor: '#38bdf8', backgroundColor: 'transparent', fill: false, tension: 0.4, borderDash: [4, 4] }
          ] 
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartColor.text } } }, scales: { y: { grid: { color: chartColor.grid }, ticks: { color: chartColor.text } }, x: { grid: { display: false }, ticks: { color: chartColor.text } } } },
      });
    }

    return () => { Object.values(chartsRef.current).forEach(c => c?.destroy()); };
  }, [leads, invoiceHistory, products]);

  const exportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = dashboardRef.current;
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `IndiaMART_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#070d18' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css'] },
      }).from(el).save();
    } catch (e) {
      alert('PDF export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="page-section" ref={dashboardRef}>
      {/* Header with Groww-style date & export action */}
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ Overview & Analytics</span>
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={exportPDF} disabled={exporting} style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}>
            <FileDown size={14} /> {exporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Quick Action Dock (Zepto/Blinkit speed dock) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => setCurrentSection('leads')}
          style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={16} /> <span>View Leads</span>
          </div>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem' }}>{leads.length}</span>
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={() => setCurrentSection('invoices')}
          style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={16} style={{ color: 'var(--primary)' }} /> <span>Invoices & Billing</span>
          </div>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem' }}>{invoiceHistory.length}</span>
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={() => setCurrentSection('bulk')}
          style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ListChecks size={16} style={{ color: '#f59e0b' }} /> <span>Bulk Actions</span>
          </div>
          <ArrowUpRight size={14} style={{ color: 'var(--text-dim)' }} />
        </button>
      </div>

      {/* Groww-style KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpis.map((kpi, i) => (
          <div 
            key={i} 
            className="kpi-card" 
            style={{ 
              cursor: kpi.onClick ? 'pointer' : 'default',
              borderTop: `3px solid ${kpi.color}`
            }} 
            onClick={kpi.onClick}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="kpi-label">{kpi.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: '0.45rem', background: kpi.bgGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                <kpi.icon size={15} />
              </div>
            </div>
            <span className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</span>
            <div className="kpi-trend">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color, display: 'inline-block' }} />
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Modern ROI Calculator */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💰 Marketing ROI & Acquisition Economics</span>
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Auto-calculated from paid invoices</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6, fontWeight: 700 }}>INDIA MART MONTHLY COST (₹)</label>
            <input type="number" value={monthlyCost} onChange={e => { const v = parseFloat(e.target.value) || 0; setMonthlyCost(v); localStorage.setItem('indimart_monthlyCost', v); }}
              placeholder="e.g. 50000" />
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid #10b981', margin: 0, padding: '1rem' }}>
            <span className="kpi-label">Net Return</span>
            <span className="kpi-value" style={{ color: (confirmedRevenue - monthlyCost) >= 0 ? '#10b981' : '#ef4444', fontSize: '1.45rem' }}>
              ₹{(confirmedRevenue - monthlyCost).toLocaleString()}
            </span>
            <div className="kpi-trend">{monthlyCost > 0 ? `${((confirmedRevenue / monthlyCost) * 100).toFixed(0)}% ROI` : 'Enter subscription cost'}</div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid #38bdf8', margin: 0, padding: '1rem' }}>
            <span className="kpi-label">Cost Per Lead</span>
            <span className="kpi-value" style={{ color: '#38bdf8', fontSize: '1.45rem' }}>
              {leads.length && monthlyCost ? `₹${Math.round(monthlyCost / leads.length).toLocaleString()}` : '—'}
            </span>
            <div className="kpi-trend">{leads.length} total captured</div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b', margin: 0, padding: '1rem' }}>
            <span className="kpi-label">Cost Per Paid Order</span>
            <span className="kpi-value" style={{ color: '#f59e0b', fontSize: '1.45rem' }}>
              {billedLeadIds.size && monthlyCost ? `₹${Math.round(monthlyCost / billedLeadIds.size).toLocaleString()}` : '—'}
            </span>
            <div className="kpi-trend">{billedLeadIds.size} paid conversions</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <ChartCard title="Lead Status Distribution" canvasRef={refDist} hasData={leads.length > 0} />
        <ChartCard title="Monthly Revenue & Pipeline Trend" canvasRef={refTrend} hasData={leads.filter(l => l.date).length > 0} />
        <ChartCard title="Sales Funnel Conversion" canvasRef={refFunnel} hasData={leads.length > 0} />
        <ChartCard title="Top Categories by Revenue" canvasRef={refProduct} hasData={leads.filter(l => DATA_CONFIG.getWonStatusLabels().includes(l.status)).length > 0} />
        <ChartCard title="City-wise Revenue Performance" canvasRef={refCity} hasData={leads.filter(l => DATA_CONFIG.getWonStatusLabels().includes(l.status)).length > 0} />
        <ChartCard title="Lost Deal Root Cause Analysis" canvasRef={refLost} hasData={leads.filter(l => DATA_CONFIG.getLostStatusLabels().includes(l.status)).length > 0} />
      </div>
    </div>
  );
}
