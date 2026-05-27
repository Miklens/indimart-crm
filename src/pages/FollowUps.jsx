import { useState } from 'react';
import { Calendar, AlertCircle, MessageCircle, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';
import LeadModal from '../components/LeadModal';

const STATUS_GROUPS = [
  { label: 'Pipeline', items: ['New Enquiry','Contacted','Requirement Discussed','Quotation Requested','Quotation Sent','Negotiation'] },
  { label: 'Won / Shipping', items: ['Converted','Purchased','Repeat Customer','Material Dispatched','Material Reached'] },
  { label: 'Lost', items: ['No Response','Not Interested','No Current Requirement','Invalid Lead','Closed Lost'] },
];

export default function FollowUps() {
  const { leads, updateLeadStatus, updateLead, showBanner } = useApp();
  const [filter, setFilter] = useState('all');
  const [editId, setEditId] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const dead = DATA_CONFIG.getDeadStatusLabels();
  const allTasks = leads.filter(l => l.followUpDate && !dead.includes(l.status));
  const overdue = allTasks.filter(t => t.followUpDate < today).length;
  const todayCount = allTasks.filter(t => t.followUpDate === today).length;
  const upcoming = allTasks.filter(t => t.followUpDate > today && t.followUpDate <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]).length;

  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const shown = allTasks
    .filter(t => {
      if (filter === 'overdue') return t.followUpDate < today;
      if (filter === 'today') return t.followUpDate === today;
      if (filter === 'upcoming') return t.followUpDate > today && t.followUpDate <= next7;
      return true;
    })
    .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

  return (
    <div className="page-section">
      <div className="section-header">
        <h2 className="section-title">Follow-ups & Daily Tasks</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{allTasks.length} pending tasks</span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Overdue', value: overdue, color: '#ef4444', tab: 'overdue' },
          { label: "Today's Tasks", value: todayCount, color: '#f59e0b', tab: 'today' },
          { label: 'Upcoming (7d)', value: upcoming, color: '#10b981', tab: 'upcoming' },
        ].map(k => (
          <div key={k.tab} className="kpi-card" style={{ borderLeft: `4px solid ${k.color}`, cursor: 'pointer', background: filter === k.tab ? `${k.color}11` : undefined }} onClick={() => setFilter(k.tab)}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value" style={{ color: k.color }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {[{ id: 'all', label: 'All Pending' }, { id: 'overdue', label: '🔴 Overdue' }, { id: 'today', label: '🟡 Today' }, { id: 'upcoming', label: '🟢 Upcoming' }].map(t => (
          <button key={t.id} className={`tab-btn ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Follow-up Date</th><th>Customer</th><th>Update Status</th><th>Product</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>No follow-ups in this filter</td></tr>
            )}
            {shown.map(task => {
              const isOvr = task.followUpDate < today;
              return (
                <tr key={task.id}>
                  <td>
                    <div style={{ color: isOvr ? '#ef4444' : 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      {isOvr ? <AlertCircle size={12} /> : <Calendar size={12} />}
                      {task.followUpDate}
                    </div>
                    <input type="date" className="table-inline-input" value={task.followUpDate || ''}
                      onChange={e => { updateLead(task.id, { followUpDate: e.target.value }); showBanner(`✅ Follow-up rescheduled`, 'success'); }}
                      style={{ fontSize: '0.68rem', padding: '2px 4px' }} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{task.customerName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{task.contact}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{task.city || ''}</div>
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <select className="table-inline-select" value={task.status}
                      onChange={e => { updateLeadStatus(task.id, e.target.value); showBanner(`✅ ${task.id} → ${e.target.value}`, 'success'); }}>
                      {STATUS_GROUPS.map(g => (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map(s => <option key={s}>{s}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <div style={{ marginTop: 3 }}>
                      <span className="status-dot" style={{ background: DATA_CONFIG.getStatusColor(task.status) }} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{task.status}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.83rem' }}>{task.product}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn-icon" style={{ color: '#25d366' }} title="WhatsApp" onClick={() => window.open(`https://wa.me/91${task.contact}`)}>
                        <MessageCircle size={14} />
                      </button>
                      <button className="btn-icon" style={{ color: '#10b981' }} title="Mark Done (clear follow-up)" onClick={() => { updateLead(task.id, { followUpDate: '' }); showBanner(`✅ Follow-up cleared for ${task.customerName}`, 'success'); }}>
                        <CheckCircle size={14} />
                      </button>
                      <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '3px 10px' }} onClick={() => setEditId(task.id)}>Edit</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editId && <LeadModal leadId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}
