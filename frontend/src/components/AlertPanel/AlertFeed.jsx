/**
 * Alert Feed — Real-time scrolling alert list with expand/acknowledge/suppress
 */

import { useState } from 'react';
import { alertsApi } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

function timeAgo(ts) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return 'just now'; }
}

function AlertItem({ alert, onAcknowledge, onSuppress }) {
  const [expanded, setExpanded] = useState(false);

  if (alert.acknowledged || alert.suppressed) return null;

  return (
    <div
      className={`alert-item ${alert.severity} animate-fadein`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="alert-item-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${alert.severity}`}>{alert.severity}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {alert.zone_id}
          </span>
          {alert.compound_risk_id && (
            <span style={{ fontSize: 10, color: 'var(--accent-purple)', fontWeight: 600 }}>
              ⚡ {alert.compound_risk_id}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(alert.timestamp)}</span>
      </div>

      <div className="alert-item-description">
        {alert.compound_risk_name || alert.description || 'Alert triggered'}
      </div>

      <div className="alert-item-meta">
        {alert.contributing_agents?.map(a => (
          <span key={a} style={{ background: 'rgba(59,130,246,0.1)', padding: '1px 5px', borderRadius: 3, color: 'var(--accent-blue)', fontWeight: 600 }}>
            {a.toUpperCase()}
          </span>
        ))}
        {alert.risk_score && (
          <span>Risk: <strong style={{ color: 'var(--risk-critical)' }}>{alert.risk_score}</strong></span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}
          onClick={e => e.stopPropagation()}>

          {/* Explainability narrative */}
          {alert.explainability?.narrative && (
            <div style={{
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: 'var(--radius-sm)', padding: '10px', marginBottom: 10, fontSize: 11,
              color: 'var(--text-secondary)', lineHeight: 1.6
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 4, textTransform: 'uppercase' }}>
                🧠 AI Explanation
              </div>
              {alert.explainability.narrative}
            </div>
          )}

          {/* Recommendations */}
          {alert.recommendations?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Recommended Actions
              </div>
              {alert.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, padding: '6px 0',
                  borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none'
                }}>
                  <span style={{ background: 'var(--accent-primary)', color: 'white', width: 18, height: 18, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {rec.priority}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{rec.action}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      ⏱ {rec.time_to_act} — {rec.rationale}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Similar incidents */}
          {alert.similar_historical_incidents?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                📚 Similar Historical Incidents (RAG)
              </div>
              {alert.similar_historical_incidents.slice(0, 2).map(inc => (
                <div key={inc.incident_id} className="rag-incident">
                  <div className="rag-incident-id">{inc.incident_id} — {inc.date}</div>
                  <div className="rag-incident-desc">{inc.description}</div>
                  <div className="rag-incident-reg">📌 {inc.regulatory_reference}</div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-warning" onClick={() => onAcknowledge(alert.id)}>
              ✓ Acknowledge
            </button>
            <button className="btn btn-ghost" onClick={() => onSuppress(alert.id, 'Operator review')}>
              ✕ Suppress
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertFeed({ activeAlerts, setActiveAlerts }) {
  const handleAcknowledge = async (alertId) => {
    try {
      await alertsApi.acknowledge(alertId);
      setActiveAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));
    } catch {
      setActiveAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));
    }
  };

  const handleSuppress = async (alertId, reason) => {
    try {
      await alertsApi.suppress(alertId, reason);
      setActiveAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, suppressed: true } : a
      ));
    } catch {
      setActiveAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, suppressed: true } : a
      ));
    }
  };

  const visible = activeAlerts?.filter(a => !a.acknowledged && !a.suppressed) ?? [];

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <span className="card-title">Active Alerts</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {visible.length} active
        </span>
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 12 }}>No active alerts — facility operating normally</div>
        </div>
      ) : (
        <div className="alert-feed">
          {visible.map(alert => (
            <AlertItem key={alert.id} alert={alert}
              onAcknowledge={handleAcknowledge}
              onSuppress={handleSuppress} />
          ))}
        </div>
      )}
    </div>
  );
}
