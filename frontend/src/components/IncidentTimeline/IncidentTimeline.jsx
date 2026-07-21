/**
 * Incident Timeline — 24h event log with filters
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

function timeAgo(ts) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return 'just now'; }
}

export default function IncidentTimeline({ activeAlerts, masterOutput }) {
  const [filter, setFilter] = useState('ALL');

  // Build timeline from active alerts + master output history
  const events = [...(activeAlerts || [])].map(a => ({
    id: a.id,
    type: 'ALERT',
    severity: a.severity,
    zone_id: a.zone_id,
    title: a.compound_risk_name || 'Alert Triggered',
    description: a.explainability?.narrative?.substring(0, 120) + '...' || '',
    timestamp: a.timestamp,
    agents: a.contributing_agents,
    acknowledged: a.acknowledged,
    suppressed: a.suppressed,
    risk_score: a.risk_score
  })).reverse();

  const filtered = filter === 'ALL' ? events :
    events.filter(e => filter === 'CRITICAL' ? e.severity === 'CRITICAL' :
      filter === 'HIGH' ? ['HIGH', 'CRITICAL'].includes(e.severity) : e.severity === filter);

  return (
    <div className="card full-width">
      <div className="card-header">
        <span className="card-title">Incident Timeline (24h)</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', cursor: 'pointer', border: '1px solid',
                borderColor: filter === f ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: filter === f ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: filter === f ? 'var(--accent-blue)' : 'var(--text-muted)'
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
          No events in the last 24 hours
        </div>
      ) : (
        <div className="timeline">
          {filtered.map(event => (
            <div key={event.id} className="timeline-item">
              <div className={`timeline-dot ${event.severity}`} />
              <div className="timeline-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span className="timeline-title">{event.title}</span>
                  <span className={`badge ${event.severity}`}>{event.severity}</span>
                  {event.acknowledged && (
                    <span style={{ fontSize: 9, color: 'var(--risk-low)', fontWeight: 700 }}>✓ ACK</span>
                  )}
                  {event.suppressed && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>SUPPRESSED</span>
                  )}
                </div>
                <div className="timeline-meta">
                  <span>{event.zone_id}</span>
                  {event.agents?.map(a => <span key={a} style={{ color: 'var(--accent-blue)' }}>{a}</span>)}
                  {event.risk_score && <span>Risk: {event.risk_score}</span>}
                  <span style={{ marginLeft: 'auto' }}>{timeAgo(event.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
