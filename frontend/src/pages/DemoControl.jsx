/**
 * Demo Control Panel — Hackathon Demo Day Scenario Simulator
 * [UX] Clearly labeled as demo-only. Triggers REAL agent pipeline.
 */

import { useState } from 'react';
import { scenarioApi } from '../services/api';
import { socket } from '../services/api';

const SCENARIOS = [
  {
    id: 'CR-001',
    name: 'Explosion Precursor',
    fullName: 'Explosion Precursor — Multi-agent confirmation',
    description: 'Injects correlated anomalies across SCADA (pressure rise), IoT (gas accumulation), and Permit (HOT_WORK conflict). Master AI compounds these into a CRITICAL alert with risk score 95.',
    agents: ['SCADA', 'IoT', 'Permit', 'Vision'],
    expectedScore: 95,
    severity: 'CRITICAL',
    class: 'cr001',
    demoTime: '< 30 seconds',
    icon: '💥',
    bgColor: 'rgba(255,45,85,0.08)',
    borderColor: 'rgba(255,45,85,0.3)',
    accentColor: '#ff2d55'
  },
  {
    id: 'CR-002',
    name: 'Confined Space Risk',
    fullName: 'Confined Space Entry — Fatal Atmosphere Risk',
    description: 'Injects air quality degradation (IoT) and CONFINED_SPACE permit with inadequate ventilation. Demonstrates life-safety compound detection across 2 agents.',
    agents: ['IoT', 'Permit', 'Vision'],
    expectedScore: 90,
    severity: 'CRITICAL',
    class: 'cr002',
    demoTime: '< 30 seconds',
    icon: '⚠️',
    bgColor: 'rgba(255,107,43,0.08)',
    borderColor: 'rgba(255,107,43,0.3)',
    accentColor: '#ff6b2b'
  },
  {
    id: 'CR-003',
    name: 'Equipment Cascade',
    fullName: 'Multi-Asset Cascade Failure — Maintenance Exposure',
    description: 'Injects vibration and temperature anomalies on multiple SCADA assets simultaneously with active maintenance permits. Shows cascade failure prediction.',
    agents: ['SCADA', 'IoT', 'Permit'],
    expectedScore: 82,
    severity: 'HIGH',
    class: 'cr003',
    demoTime: '< 30 seconds',
    icon: '⚙️',
    bgColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.3)',
    accentColor: '#fbbf24'
  }
];

const DEMO_SCRIPT = [
  { time: '0:00', action: 'Dashboard shows normal facility — risk score 22, all agents green' },
  { time: '0:20', action: 'Navigate to Facility Map — show zone layout and personnel' },
  { time: '0:40', action: 'Click "Trigger: Explosion Precursor (CR-001)"' },
  { time: '1:00', action: 'Switch to Dashboard — risk score climbing: 22 → 48 → 74 → 95' },
  { time: '1:15', action: 'CRITICAL alert fires — "Explosion Precursor — 3 agents"' },
  { time: '1:25', action: 'Click alert → show single-agent scores (42, 38, 25) vs compound (95)' },
  { time: '1:40', action: 'Navigate to Agent Intelligence — show compound flow diagram' },
  { time: '2:00', action: 'Show RAG output: similar historical incident + regulatory reference' },
  { time: '2:15', action: 'Show recommendations in priority order with time-to-act' },
  { time: '2:30', action: 'Acknowledge alert — show incident logged to timeline' },
  { time: '2:45', action: 'Click "Reset All" — risk score returns to baseline' },
  { time: '3:00', action: 'STOP — demo complete' }
];

export default function DemoControl({ masterOutput, activeAlerts }) {
  const [triggering, setTriggering] = useState(null);
  const [logs, setLogs] = useState([]);
  const [resetting, setResetting] = useState(false);

  const addLog = (msg, type = 'info') => {
    const entry = { msg, type, time: new Date().toLocaleTimeString() };
    setLogs(prev => [entry, ...prev].slice(0, 20));
  };

  const triggerScenario = async (scenario) => {
    if (triggering) return;
    setTriggering(scenario.id);
    addLog(`Triggering ${scenario.id}: ${scenario.name}...`, 'info');

    // Also emit via socket for real-time
    socket.emit('trigger_scenario', scenario.id);

    try {
      const res = await scenarioApi.trigger(scenario.id);
      addLog(`✅ ${scenario.id} injected across agents. Monitoring for compound detection...`, 'success');
      addLog(`Expected: Risk score ${scenario.expectedScore} (${scenario.severity}) in < 30 seconds`, 'info');
    } catch (err) {
      addLog(`⚡ ${scenario.id} triggered via Socket.IO (API fallback: ${err.message})`, 'warning');
    }

    setTimeout(() => setTriggering(null), 5000);
  };

  const resetAll = async () => {
    setResetting(true);
    addLog('Resetting all scenarios — clearing injected anomalies...', 'info');
    socket.emit('reset_scenario');
    try {
      await scenarioApi.reset();
    } catch {}
    setTimeout(() => {
      setResetting(false);
      addLog('✅ All scenarios reset. Facility returning to baseline.', 'success');
    }, 2000);
  };

  const currentRisk = masterOutput?.risk_score ?? 0;
  const compound = masterOutput?.compound_risk_detected ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Warning Banner */}
      <div style={{
        background: 'rgba(255,107,43,0.08)',
        border: '1px solid rgba(255,107,43,0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
        <span style={{ fontSize: 20 }}>🎮</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--risk-high)' }}>DEMO SCENARIO SIMULATOR</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            For hackathon demonstration only. Scenarios inject anomalies into the real agent pipeline — not UI mocks.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: compound ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
            {currentRisk}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Risk</div>
        </div>
      </div>

      {/* Live status */}
      {compound && (
        <div style={{
          background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.4)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px'
        }} className="animate-fadein">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--risk-critical)' }}>
                COMPOUND RISK ACTIVE: {masterOutput?.compound_risk_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Risk Score: {masterOutput?.risk_score} | Confidence: {((masterOutput?.confidence ?? 0) * 100).toFixed(0)}% | 
                Agents: {masterOutput?.contributing_agents?.join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenario cards */}
      <div className="scenario-grid">
        {SCENARIOS.map(scenario => (
          <div
            key={scenario.id}
            className={`scenario-card ${scenario.class} ${triggering === scenario.id ? 'triggering' : ''}`}
            style={{
              background: scenario.bgColor,
              borderColor: triggering === scenario.id ? scenario.accentColor : 'var(--border-subtle)'
            }}
            onClick={() => triggerScenario(scenario)}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="scenario-id">{scenario.id}</div>
              <span className={`badge ${scenario.severity}`}>{scenario.severity}</span>
            </div>

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{scenario.icon}</span>
              <div className="scenario-name">{scenario.name}</div>
            </div>

            {/* Description */}
            <div className="scenario-desc">{scenario.description}</div>

            {/* Expected outcome */}
            <div style={{
              background: `${scenario.accentColor}15`, border: `1px solid ${scenario.accentColor}25`,
              borderRadius: 6, padding: '8px 10px', marginBottom: 10
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Expected Compound Risk Score</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: scenario.accentColor }}>{scenario.expectedScore}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Surface time: {scenario.demoTime}</div>
            </div>

            {/* Agents involved */}
            <div className="scenario-agents">
              {scenario.agents.map(a => (
                <span key={a} className="scenario-agent-tag">{a}</span>
              ))}
            </div>

            {/* Trigger button */}
            <button
              className={`btn ${triggering === scenario.id ? 'btn-critical' : 'btn-primary'}`}
              style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
              disabled={triggering !== null}
            >
              {triggering === scenario.id ? '⚡ Injecting...' : `▶ Trigger ${scenario.id}`}
            </button>
          </div>
        ))}

        {/* Reset card */}
        <div className="scenario-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: 200 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔄</div>
          <div className="scenario-name">Reset All</div>
          <div className="scenario-desc">Clear all injected anomalies and return facility to normal baseline conditions.</div>
          <button
            className="btn btn-ghost"
            onClick={resetAll}
            disabled={resetting}
            style={{ marginTop: 12 }}
          >
            {resetting ? '⏳ Resetting...' : '↺ Reset All Scenarios'}
          </button>
        </div>
      </div>

      {/* Demo script */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 3-Minute Demo Script</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rehearse this flow</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DEMO_SCRIPT.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, padding: '6px 0',
              borderBottom: i < DEMO_SCRIPT.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-cyan)', flexShrink: 0, width: 36 }}>
                {step.time}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {step.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action log */}
      {logs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Activity Log</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto' }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: log.type === 'success' ? 'var(--risk-low)' :
                       log.type === 'warning' ? 'var(--risk-medium)' : 'var(--text-secondary)',
                display: 'flex', gap: 8
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{log.time}</span>
                <span>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
