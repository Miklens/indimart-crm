import { useEffect, useRef, useState, useCallback } from 'react';
import { Users, TrendingUp, AlertCircle, Truck, DollarSign, Zap, FileDown } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';

Chart.register(...registerables);

const ChartCard = ({ title, canvasRef, height = 200, hasData = true }) => (
  <div className="glass-card" style={{ padding: '1rem' }}>
    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h4>
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

  // KPI calculations — only invoices with actual payment received count as "billed"
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
  const inTransitCount = leads.filter(l => DATA_CONFIG.getStatusGroupStatuses('inTransit').includes(l.status)).length;
  const validLeads = leads.filter(l => !DATA_CONFIG.getLostStatusLabels().includes(l.status)).length;
  const conversionRate = validLeads ? ((billedLeadIds.size / validLeads) * 100).toFixed(0) : 0;
  const contacted = leads.filter(l => DATA_CONFIG.getContactedStatusLabels().includes(l.status));
  const contactRate = leads.length ? ((contacted.length / leads.length) * 100).toFixed(0) : 0;

  const kpis = [
    { label: 'Pipeline Enquiries', value: leads.length, sub: `${contactRate}% Contacted`, color: '#3b82f6', icon: Users, onClick: () => setCurrentSection('leads') },
    { label: 'ACTUAL SALES (BILLED)', value: `₹${confirmedRevenue.toLocaleString()}`, sub: `From ${paidOrderCount} Orders`, color: '#10b981', icon: TrendingUp },
    { label: 'Outstanding Payments', value: `₹${Math.max(0, pendingPaymentTotal).toLocaleString()}`, sub: `Collected: ₹${totalReceived.toLocaleString()}`, color: pendingPaymentTotal > 0 ? '#ef4444' : '#10b981', icon: AlertCircle, onClick: () => setCurrentSection('invoices') },
    { label: 'In-Transit Orders', value: inTransitCount, sub: 'Active Shipments', color: '#3b82f6', icon: Truck, onClick: () => setCurrentSection('leads') },
    { label: 'Projected Revenue', value: `₹${projectedRevenue.toLocaleString()}`, sub: 'Unbilled Enquiries', color: '#f59e0b', icon: DollarSign },
    { label: '🚀 Conversion Rate', value: `${conversionRate}%`, sub: `${billedLeadIds.size} Billed / ${validLeads} Valid`, color: '#10b981', icon: Zap },
  ];

  useEffect(() => {
    // Destroy old charts
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
        options: { plugins: { legend: { display: false } }, cutout: '70%', responsive: true, maintainAspectRatio: false },
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: chartColor.text, boxWidth: 10, font: { size: 10 } } } } },
      });
    }

    // 3. Top product categories bar
    const categoryRevenue = {};
    const wonLabels = DATA_CONFIG.getWonStatusLabels();
    leads.filter(l => wonLabels.includes(l.status)).forEach(l => {
      (l.productList || [{ name: l.product, price: l.orderValue, qty: 1 }]).forEach(item => {
        if (!item.name) return;
        
        // Find product category
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
        data: { labels: sortedCats.map(p=>p[0]), datasets: [{ label: 'Revenue (₹)', data: sortedCats.map(p=>p[1]), backgroundColor: '#10b981', borderRadius: 5 }] },
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: chartColor.text, boxWidth: 10 } } } },
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
        data: { labels: ['Total','Contacted','Quoted','Converted','Purchased'], datasets: [{ data: funnelData, backgroundColor: ['#3b82f6','#06b6d4','#f59e0b','#10b981','#047857'], borderRadius: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: chartColor.grid }, ticks: { color: chartColor.text } }, x: { grid: { display: false }, ticks: { color: chartColor.text } } } },
      });
    }

    // 6. Monthly trend line with Month-over-Month comparison
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
            { label: 'Total Enquiries', data: months.map(m => monthlyData[m].count), borderColor: '#3b82f6', backgroundColor: 'transparent', fill: false, tension: 0.4, borderDash: [5, 5] }
          ] 
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartColor.text } } }, scales: { y: { grid: { color: chartColor.grid }, ticks: { color: chartColor.text } }, x: { grid: { display: false }, ticks: { color: chartColor.text } } } },
      });
    }

    return () => { Object.values(chartsRef.current).forEach(c => c?.destroy()); };
  }, [leads, invoiceHistory, products]); // eslint-disable-line react-hooks/exhaustive-deps



  const exportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = dashboardRef.current;
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `IndiaMART_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
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
      <div className="section-header">
        <h2 className="section-title">Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <button className="btn btn-secondary" onClick={exportPDF} disabled={exporting} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileDown size={13} />{exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `4px solid ${kpi.color}`, cursor: kpi.onClick ? 'pointer' : 'default' }} onClick={kpi.onClick}>
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value" style={{ color: kpi.color, fontSize: '1.6rem' }}>{kpi.value}</span>
            <div className="kpi-trend"><kpi.icon size={12} /> {kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ROI Calculator */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--primary)' }}>💰 ROI Calculator</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>MONTHLY COST (₹)</label>
            <input type="number" value={monthlyCost} onChange={e => { const v = parseFloat(e.target.value) || 0; setMonthlyCost(v); localStorage.setItem('indimart_monthlyCost', v); }}
              placeholder="e.g. 50000" style={{ width: '100%' }} />
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid #10b981', margin: 0 }}>
            <span className="kpi-label">Net ROI</span>
            <span className="kpi-value" style={{ color: (confirmedRevenue - monthlyCost) >= 0 ? '#10b981' : '#ef4444', fontSize: '1.4rem' }}>
              ₹{(confirmedRevenue - monthlyCost).toLocaleString()}
            </span>
            <div className="kpi-trend">{monthlyCost > 0 ? `${((confirmedRevenue / monthlyCost) * 100).toFixed(0)}% return` : 'Enter cost to calculate'}</div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6', margin: 0 }}>
            <span className="kpi-label">Cost Per Lead</span>
            <span className="kpi-value" style={{ color: '#3b82f6', fontSize: '1.4rem' }}>
              {leads.length && monthlyCost ? `₹${Math.round(monthlyCost / leads.length).toLocaleString()}` : '—'}
            </span>
            <div className="kpi-trend">{leads.length} total leads</div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b', margin: 0 }}>
            <span className="kpi-label">Cost Per Conversion</span>
            <span className="kpi-value" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>
              {billedLeadIds.size && monthlyCost ? `₹${Math.round(monthlyCost / billedLeadIds.size).toLocaleString()}` : '—'}
            </span>
            <div className="kpi-trend">{billedLeadIds.size} conversions</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        <ChartCard title="Lead Status Distribution" canvasRef={refDist} hasData={leads.length > 0} />
        <ChartCard title="Lost Reason Analysis" canvasRef={refLost} hasData={leads.filter(l => DATA_CONFIG.getLostStatusLabels().includes(l.status)).length > 0} />
        <ChartCard title="Top Categories by Revenue" canvasRef={refProduct} hasData={leads.filter(l => DATA_CONFIG.getWonStatusLabels().includes(l.status)).length > 0} />
        <ChartCard title="City-wise Revenue" canvasRef={refCity} hasData={leads.filter(l => DATA_CONFIG.getWonStatusLabels().includes(l.status)).length > 0} />
        <ChartCard title="Sales Funnel" canvasRef={refFunnel} hasData={leads.length > 0} />
        <ChartCard title="Monthly Revenue Trend" canvasRef={refTrend} hasData={leads.filter(l => l.date).length > 0} />
      </div>

      {leads.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', marginTop: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No data yet</h3>
          <p>Add your first lead to see analytics here.</p>
        </div>
      )}
    </div>
  );
}
