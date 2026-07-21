/**
 * Live Risk Chart — Real-time 60-second rolling risk score chart
 * Shows individual agent scores + compound master score evolving over time
 */

import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { format } from 'date-fns';

const MAX_POINTS = 60; // 60 data points = 60 seconds of history

const AGENT_COLORS = {
  master:  '#ff2d55',
  scada:   '#3b82f6',
  iot:     '#22d3ee',
  vision:  '#a78bfa',
  permit:  '#fbbf24',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
      borderRadius: 8, padding: '10px 14px', fontSize: 11
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 3 }}>
          <strong>{p.name.toUpperCase()}</strong>: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function LiveRiskChart({ masterOutput, agentHeartbeat }) {
  const [dataPoints, setDataPoints] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!masterOutput) return;

    const now = new Date();
    const label = format(now, 'HH:mm:ss');
    const summaries = masterOutput?.raw_context?.agent_summaries ?? {};

    const newPoint = {
      time: label,
      master:  masterOutput.risk_score ?? 0,
      scada:   Math.round(summaries.scada?.risk_score ?? 0),
      iot:     Math.round(summaries.iot?.risk_score ?? 0),
      vision:  Math.round(summaries.vision?.risk_score ?? 0),
      permit:  Math.round(summaries.permit?.risk_score ?? 0),
      compound: masterOutput.compound_risk_detected ? masterOutput.risk_score : null
    };

    setDataPoints(prev => [...prev.slice(-MAX_POINTS + 1), newPoint]);
  }, [masterOutput]);

  // Also add blank points every 5 seconds if no master output to keep chart moving
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!masterOutput) {
        const now = new Date();
        setDataPoints(prev => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          // Slightly vary last point
          const varied = {
            ...last,
            time: format(now, 'HH:mm:ss'),
            master: Math.max(0, Math.min(100, last.master + (Math.random() - 0.5) * 4)),
            scada:  Math.max(0, Math.min(100, last.scada + (Math.random() - 0.5) * 3)),
            iot:    Math.max(0, Math.min(100, last.iot + (Math.random() - 0.5) * 3)),
          };
          return [...prev.slice(-MAX_POINTS + 1), varied];
        });
      }
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [masterOutput]);

  const criticalZone = masterOutput?.compound_risk_detected;

  return (
    <div className="card full-width">
      <div className="card-header">
        <span className="card-title">📈 Live Risk Evolution — 60s Rolling Window</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {criticalZone && (
            <span className="badge CRITICAL" style={{ animation: 'scenarioPulse 1s infinite' }}>
              ⚡ Compound Active
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {dataPoints.length} samples
          </span>
        </div>
      </div>

      {dataPoints.length < 2 ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          <div className="spinner" style={{ marginRight: 10 }} />
          Waiting for live data from agents...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dataPoints} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4a5c7a' }}
              interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#4a5c7a' }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={70} stroke="rgba(255,45,85,0.4)" strokeDasharray="4 4"
              label={{ value: 'CRITICAL', position: 'right', fontSize: 9, fill: '#ff2d55' }} />
            <ReferenceLine y={45} stroke="rgba(255,107,43,0.3)" strokeDasharray="4 4"
              label={{ value: 'HIGH', position: 'right', fontSize: 9, fill: '#ff6b2b' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="scada" stroke={AGENT_COLORS.scada}
              strokeWidth={1.5} dot={false} name="scada" />
            <Line type="monotone" dataKey="iot" stroke={AGENT_COLORS.iot}
              strokeWidth={1.5} dot={false} name="iot" />
            <Line type="monotone" dataKey="vision" stroke={AGENT_COLORS.vision}
              strokeWidth={1.5} dot={false} name="vision" />
            <Line type="monotone" dataKey="permit" stroke={AGENT_COLORS.permit}
              strokeWidth={1.5} dot={false} name="permit" />
            <Line type="monotone" dataKey="master" stroke={AGENT_COLORS.master}
              strokeWidth={3} dot={false} name="master (compound)" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
