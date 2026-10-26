// Purpose: Provides shared React helpers, UI widgets, and dashboard utilities used across student and faculty pages.
// Shared helpers + components (React via CDN, icons from lucide-react only)
const { useState, useEffect, useCallback, useRef } = React;
const I = LucideReact;

const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const userEmail = localStorage.getItem('userEmail');
const authHeaders = json => ({ ...(json ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` });
function handleLogout() { localStorage.clear(); window.location.href = '/'; }

const SLOTS = [
  { value: '08:00 - 09:00', label: '08:00 AM - 09:00 AM' },
  { value: '09:00 - 10:00', label: '09:00 AM - 10:00 AM' },
  { value: '10:00 - 11:00', label: '10:00 AM - 11:00 AM' },
  { value: '11:00 - 12:00', label: '11:00 AM - 12:00 PM' },
  { value: '12:00 - 13:00', label: '12:00 PM - 01:00 PM' },
  { value: '13:00 - 14:00', label: '01:00 PM - 02:00 PM' },
  { value: '14:00 - 15:00', label: '02:00 PM - 03:00 PM' },
  { value: '15:00 - 16:00', label: '03:00 PM - 04:00 PM' },
  { value: '16:00 - 17:00', label: '04:00 PM - 05:00 PM' },
  { value: '17:00 - 18:00', label: '05:00 PM - 06:00 PM' }
];
const isMorning = slot => parseInt(slot.value.split(':')[0], 10) < 13;   // locked by default
const isSlotLockExempt = (resource, date) => {
  if (['Block 1 - Heritage Block', 'Block 2'].includes(resource?.building)) return true;
  if (resource?.type?.toLowerCase().includes('auditorium')) return true;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
};
const slotRange = (date, value) => { const [s, e] = value.split(' - '); return [new Date(`${date}T${s}:00+05:30`), new Date(`${date}T${e}:00+05:30`)]; };
const dateOf = v => new Date(v).toLocaleDateString();
const timeOf = v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((message, type = 'error') => {
    setToast({ message, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  return [toast, show];
}

function Toast({ toast }) {
  if (!toast) return null;
  const Icon = toast.type === 'success' ? I.CheckCircle2 : I.AlertCircle;
  return <div className={`toast toast--${toast.type}`} role="status"><Icon size={18} strokeWidth={1.5} />{toast.message}</div>;
}

function Shell({ portal, tag, toast, children }) {
  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <div className="brand"><I.Leaf size={22} strokeWidth={1.5} /><span className="brand-name">Smart Campus RMS</span><span className="brand-portal">{portal}</span></div>
        <div className="topbar-right">
          <span className="user">{userEmail}</span>{tag}
          <button className="btn btn-quiet" onClick={handleLogout} aria-label="Logout"><I.LogOut size={16} strokeWidth={1.5} /><span className="hide-sm">Logout</span></button>
        </div>
      </div></header>
      <main className="container">{children}</main>
      <Toast toast={toast} />
    </>
  );
}

function Field({ label, className = '', children }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}</label>;
}

function StatusBadge({ status }) {
  const s = String(status || '');
  const k = s === 'APPROVED' ? 'ok' : s === 'REJECTED' ? 'no' : 'wait';
  const Icon = { ok: I.CheckCircle2, no: I.XCircle, wait: I.Hourglass }[k];
  return <span className={`badge badge--${k}`}><Icon size={14} strokeWidth={1.75} />{s.toUpperCase().replace(/_/g, ' ')}</span>;
}

function When({ b }) { return <>{dateOf(b.start_time)}<small className="sub">{timeOf(b.start_time)} - {timeOf(b.end_time)}</small></>; }

function SlotGrid({ items, onPick }) {
  return (
    <div className="slots" role="group" aria-label="Time slots">
      {items.map(s => { const Icon = I[s.icon]; return (
        <button key={s.value} type="button" className={`slot slot--${s.state}`} disabled={s.disabled} aria-pressed={s.state === 'picked'} onClick={() => onPick(s)}>
          <Icon size={18} strokeWidth={1.5} /><span className="slot-time">{s.label}</span><span className="slot-text">{s.text}</span>
        </button>); })}
    </div>
  );
}

function Legend({ items }) {
  return <div className="legend">{items.map(([k, t]) => <span key={k}><i className={`dot dot--${k}`} />{t}</span>)}</div>;
}

function Empty({ icon, children }) { const Icon = I[icon]; return <div className="empty"><Icon size={28} strokeWidth={1.25} /><span>{children}</span></div>; }