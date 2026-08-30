import { useState } from 'react';
import { Calendar, AlertCircle, MessageCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATA_CONFIG } from '../utils/dataConfig';
import LeadModal from '../components/LeadModal';

const getTodayString = () => new Date().toISOString().split('T')[0];
const getNext7DaysString = () => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

export default function FollowUps() {
  const { leads, updateLeadStatus, updateLead, showBanner } = useApp();
  const STATUS_OPTIONS = DATA_CONFIG.getSimpleStatusOptions();
  const [filter, setFilter] = useState('all');
  const [editId, setEditId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);

  const today = getTodayString();
  const dead = DATA_CONFIG.getDeadStatusLabels();
  const allTasks = leads.filter(l => l.followUpDate && !dead.includes(l.status));
  const overdue = allTasks.filter(t => t.followUpDate < today).length;
  const todayCount = allTasks.filter(t => t.followUpDate === today).length;
  const next7 = getNext7DaysString();
  const upcoming = allTasks.filter(t => t.followUpDate > today && t.followUpDate <= next7).length;
  const shown = allTasks
    .filter(t => {
      if (filter === 'overdue') return t.followUpDate < today;
      if (filter === 'today') return t.followUpDate === today;
      if (filter === 'upcoming') return t.followUpDate > today && t.followUpDate <= next7;
      return true;
    })
    .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

  // Date Formatting Helper (local YYYY-MM-DD)
  const formatDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Calendar Logic
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const totalDays = lastDay.getDate();
    
    const days = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }
    
    while (days.length < 42) {
      const nextD = new Date(year, month + 1, days.length - startDayOfWeek - totalDays + 1);
      days.push({ date: nextD, isCurrentMonth: false });
    }
    
    return days;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, dayStr) => {
    e.preventDefault();
    if (dragOverDay !== dayStr) {
      setDragOverDay(dayStr);
    }
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = (e, dayStr) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedId;
    setDragOverDay(null);
    if (taskId) {
      updateLead(taskId, { followUpDate: dayStr });
      showBanner(`✅ Rescheduled to ${dayStr}`, 'success');
      setDraggedId(null);
    }
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
          <div key={k.tab} className="kpi-card" style={{ borderLeft: `4px solid ${k.color}`, cursor: 'pointer', background: filter === k.tab ? `${k.color}11` : undefined }} onClick={() => { setFilter(k.tab); setViewMode('list'); }}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value" style={{ color: k.color }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Toggle & Filter View tabs */}
      <div className="tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <button className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} style={{ margin: 0, padding: '6px 16px', borderRadius: '6px' }}>List View</button>
          <button className={`tab-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')} style={{ margin: 0, padding: '6px 16px', borderRadius: '6px' }}>Calendar View</button>
        </div>
        {viewMode === 'list' && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[{ id: 'all', label: 'All Pending' }, { id: 'overdue', label: '🔴 Overdue' }, { id: 'today', label: '🟡 Today' }, { id: 'upcoming', label: '🟢 Upcoming' }].map(t => (
              <button key={t.id} className={`tab-btn ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{t.label}</button>
            ))}
          </div>
        )}
        {viewMode === 'calendar' && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💡 Drag tasks to reschedule, click to edit.</span>
          </div>
        )}
      </div>

      {viewMode === 'list' ? (
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
                      <select className="table-inline-select" value={DATA_CONFIG.getSimpleStatusLabel(task.status)}
                        onChange={e => { updateLeadStatus(task.id, DATA_CONFIG.resolveStatusFromSimple(e.target.value)); showBanner(`✅ ${task.id} → ${e.target.value}`, 'success'); }}>
                        {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <div style={{ marginTop: 3 }}>
                        <span className="status-dot" style={{ background: DATA_CONFIG.getStatusColor(task.status) }} />
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{DATA_CONFIG.getSimpleStatusLabel(task.status)}</span>
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
      ) : (
        <div className="calendar-view">
          {/* Month Navigation Control */}
          <div className="calendar-header">
            <div className="calendar-title">
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              <span>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="calendar-nav-btn" onClick={prevMonth} title="Previous Month">
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-secondary" onClick={goToToday} style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
                Today
              </button>
              <button className="calendar-nav-btn" onClick={nextMonth} title="Next Month">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Titles */}
          <div className="calendar-weekdays">
            {weekDays.map(wd => (
              <div key={wd}>{wd}</div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="calendar-grid">
            {days.map(({ date, isCurrentMonth }, idx) => {
              const dayStr = formatDateString(date);
              const dayTasks = allTasks.filter(t => t.followUpDate === dayStr);
              const isToday = dayStr === today;
              const isDragOver = dragOverDay === dayStr;

              return (
                <div
                  key={`${dayStr}-${idx}`}
                  className={`calendar-day ${!isCurrentMonth ? 'outside-month' : ''} ${isToday ? 'today-day' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, dayStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayStr)}
                >
                  <div className="calendar-day-number">{date.getDate()}</div>
                  <div className="calendar-day-tasks">
                    {dayTasks.map(task => {
                      const statusColor = DATA_CONFIG.getStatusColor(task.status);
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setEditId(task.id)}
                          className="calendar-task-badge"
                          style={{
                            backgroundColor: `${statusColor}14`,
                            color: statusColor,
                            borderColor: `${statusColor}33`,
                          }}
                          title={`${task.customerName} - ${task.product} (${task.status})`}
                        >
                          {task.customerName}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editId && <LeadModal leadId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

