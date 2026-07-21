/**
 * KPI Bar — Always-visible top status bar
 * Shows: Facility Risk Score | Active Alerts | Personnel | Agent Status | Timestamp
 */

import { useState, useEffect } from 'react';

function getRiskClass(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

const AGENT_NAMES = ['scada', 'iot', 'vision', 'permit', 'master'];
const AGENT_LABELS = { scada: 'SCADA', iot: 'IoT', vision: 'Vision', permit: 'Permit', master: 'Master' };
const AGENT_ICONS = { scada: '📊', iot: '🌡️', vision: '👁️', permit: '📋', master: '🧠' };

export default function KPIBar({ masterOutput, agentHeartbeat, activeAlerts, socketConnected }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const riskScore = masterOutput?.risk_score ?? 0;
  const severity = masterOutput?.severity ?? 'LOW';
  const riskClass = getRiskClass(riskScore);
  const criticalAlerts = activeAlerts?.filter(a => a.severity === 'CRITICAL' && !a.acknowledged && !a.suppressed).length ?? 0;
  const compoundDetected = masterOutput?.compound_risk_detected ?? false;

  return (
    <header className="kpi-bar" id="kpi-bar">
      <div className="kpi-brand">
        <div className="kpi-brand-logo">🛡️</div>
        <span className="kpi-brand-name">Industrial Guardian AI</span>
      </div>

      <div className="kpi-items">
        {/* Facility Risk Score */}
        <div className={`kpi-item ${compoundDetected ? 'critical' : ''}`} style={compoundDetected ? { borderColor: 'rgba(255,45,85,0.4)' } : {}}>
          <div>
            <div className="kpi-label">Facility Risk</div>
            <div className={`kpi-value ${riskClass}`}>{riskScore}</div>
          </div>
          <div className={`badge ${severity}`} style={{ marginLeft: 4 }}>{severity}</div>
        </div>

        {/* Critical Alerts */}
        <div className="kpi-item">
          <div>
            <div className="kpi-label">Critical Alerts</div>
            <div className={`kpi-value ${criticalAlerts > 0 ? 'critical' : 'low'}`}>{criticalAlerts}</div>
          </div>
          <span style={{ fontSize: 18 }}>{criticalAlerts > 0 ? '🚨' : '✅'}</span>
        </div>

        {/* Active Alerts Total */}
        <div className="kpi-item">
          <div>
            <div className="kpi-label">Active Alerts</div>
            <div className="kpi-value">{activeAlerts?.filter(a => !a.acknowledged && !a.suppressed).length ?? 0}</div>
          </div>
        </div>

        {/* Compound Detection */}
        {compoundDetected && (
          <div className="kpi-item" style={{ borderColor: 'rgba(255,45,85,0.4)', background: 'rgba(255,45,85,0.06)' }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <div>
              <div className="kpi-label">Compound Risk</div>
              <div style={{ fontSize: 11, color: 'var(--risk-critical)', fontWeight: 700, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {masterOutput?.compound_risk_name ?? 'DETECTED'}
              </div>
            </div>
          </div>
        )}

        {/* Agent Status Dots */}
        <div className="kpi-item" style={{ gap: 10 }}>
          <div className="kpi-label" style={{ marginBottom: 4 }}>Agents</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {AGENT_NAMES.map(name => {
              const status = agentHeartbeat[name]?.status ?? 'UNKNOWN';
              return (
                <div key={name} title={`${AGENT_LABELS[name]}: ${status}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span className={`agent-dot ${status}`} />
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{AGENT_LABELS[name]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timestamp + Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', paddingLeft: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`agent-dot ${socketConnected ? 'ACTIVE' : 'OFFLINE'}`} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{socketConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {time.toLocaleTimeString()}
        </div>
      </div>
    </header>
  );
}
