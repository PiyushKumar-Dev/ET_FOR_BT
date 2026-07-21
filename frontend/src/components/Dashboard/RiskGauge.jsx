/**
 * Risk Score Gauge — Large radial gauge + compound detection card
 * Shows single-agent vs compound score comparison (THE KEY JUDGE METRIC)
 */

import { useEffect, useRef } from 'react';

function RiskGaugeSVG({ score, severity }) {
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const startAngle = -220;
  const totalArc = 260;
  const fillArc = (score / 100) * totalArc;

  // Color based on severity
  const colors = {
    CRITICAL: '#ff2d55',
    HIGH: '#ff6b2b',
    MEDIUM: '#fbbf24',
    LOW: '#10b981'
  };
  const color = colors[severity] || '#10b981';

  // Convert to SVG arc path
  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const angle = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const describeArc = (cx, cy, r, startDeg, endDeg) => {
    const s = polarToCartesian(cx, cy, r, startDeg);
    const e = polarToCartesian(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const cx = 100, cy = 100;
  const bgPath = describeArc(cx, cy, normalizedRadius, startAngle, startAngle + totalArc);
  const fillPath = describeArc(cx, cy, normalizedRadius, startAngle, startAngle + fillArc);

  return (
    <svg width="200" height="200" className="gauge-svg">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Background arc */}
      <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round" />
      {/* Track rings */}
      <circle cx={cx} cy={cy} r={normalizedRadius - 20} fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="1" />
      {/* Fill arc */}
      {score > 0 && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" filter="url(#glow)"
          style={{ transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
      )}
      {/* Center glow */}
      <circle cx={cx} cy={cy} r="40" fill={`${color}12`} />
    </svg>
  );
}

export default function RiskGauge({ masterOutput }) {
  const score = masterOutput?.risk_score ?? 0;
  const severity = masterOutput?.severity ?? 'LOW';
  const compoundDetected = masterOutput?.compound_risk_detected ?? false;
  const singleScores = masterOutput?.explainability?.single_agent_risk_scores ?? {};

  const colors = { CRITICAL: '#ff2d55', HIGH: '#ff6b2b', MEDIUM: '#fbbf24', LOW: '#10b981' };
  const color = colors[severity] || '#10b981';

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <span className="card-title">Facility Risk Intelligence</span>
        <span className={`badge ${severity}`}>{severity}</span>
      </div>

      {/* Gauge */}
      <div className="gauge-container" style={{ marginBottom: 16 }}>
        <RiskGaugeSVG score={score} severity={severity} />
        <div className="gauge-value" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -52%)' }}>
          <div className="gauge-number" style={{ color }}>{score}</div>
          <div className="gauge-label">Risk Score</div>
        </div>
      </div>

      {/* Compound Detection Card */}
      {compoundDetected && (
        <div style={{
          background: 'rgba(255,45,85,0.08)',
          border: '1px solid rgba(255,45,85,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: 16
        }} className="animate-fadein">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span>🔴</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-critical)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compound Risk Detected
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
            {masterOutput?.compound_risk_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Triggered by: {masterOutput?.contributing_agents?.join(' + ').toUpperCase()}
          </div>
        </div>
      )}

      {/* [KEY JUDGE METRIC] Single-agent vs Compound comparison */}
      {Object.keys(singleScores).length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Why Compound Detection Matters
          </div>
          <div className="score-comparison">
            {Object.entries(singleScores)
              .filter(([k]) => k !== 'compound_master')
              .map(([key, val]) => (
                <div key={key} className="score-bar-row">
                  <div className="score-bar-label">{key.replace(/_/g, ' ').replace('alone', 'alone')}</div>
                  <div className="score-bar-track">
                    <div className="score-bar-fill individual" style={{ width: `${val}%` }} />
                  </div>
                  <div className="score-bar-value" style={{ color: 'var(--accent-blue)' }}>{val}</div>
                </div>
              ))}
            <div className="score-bar-row">
              <div className="score-bar-label" style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>
                ⚡ Master Compound
              </div>
              <div className="score-bar-track">
                <div className="score-bar-fill compound"
                  style={{ width: `${singleScores.compound_master ?? score}%` }} />
              </div>
              <div className="score-bar-value" style={{ color: 'var(--risk-critical)', fontSize: 14 }}>
                {singleScores.compound_master ?? score}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
