/**
 * Zone Status Grid — Live zone tiles with animated risk indicators
 */

import { useState, useEffect } from 'react';
import { zonesApi } from '../../services/api';

const ZONE_ICONS = {
  'ZONE-01': '⚙️', 'ZONE-02': '🔧', 'ZONE-03': '⚡',
  'ZONE-04': '📦', 'ZONE-05': '🖥️', 'ZONE-06': '🔩'
};

function ZoneTile({ zone }) {
  const risk = zone.risk_score ?? 0;
  const status = zone.status ?? 'NORMAL';

  const colors = {
    CRITICAL: { bg: 'rgba(255,45,85,0.12)', border: 'rgba(255,45,85,0.4)', text: '#ff2d55' },
    HIGH:     { bg: 'rgba(255,107,43,0.10)', border: 'rgba(255,107,43,0.35)', text: '#ff6b2b' },
    MEDIUM:   { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24' },
    NORMAL:   { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', text: '#10b981' },
  };
  const c = colors[status] || colors.NORMAL;

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
      transition: 'all 0.4s ease',
      animation: status === 'CRITICAL' ? 'pulseCritical 2s infinite' : undefined
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{ZONE_ICONS[zone.zone_id] || '📍'}</span>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: c.text }}>{zone.zone_id}</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{zone.name}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: c.text, lineHeight: 1 }}>{risk}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>risk</div>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>👤 {zone.vision?.person_count ?? 0}</span>
        <span>💨 {zone.iot?.gas_concentration?.toFixed(1) ?? '0.0'} ppm</span>
        <span>🌡️ {zone.iot?.hazard_classification ?? 'NORMAL'}</span>
        <span style={{ marginLeft: 'auto' }}>📋 {zone.active_permits ?? 0}</span>
      </div>

      {/* PPE Compliance bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 3, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width 0.5s ease',
            width: `${((zone.vision?.ppe_compliance ?? 1) * 100)}%`,
            background: (zone.vision?.ppe_compliance ?? 1) > 0.85
              ? 'var(--risk-low)' : 'var(--risk-critical)'
          }} />
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
          PPE: {((zone.vision?.ppe_compliance ?? 1) * 100).toFixed(0)}%
          {zone.scada?.anomalous_assets > 0 &&
            ` · ⚠ ${zone.scada.anomalous_assets} asset${zone.scada.anomalous_assets > 1 ? 's' : ''} anomalous`}
        </div>
      </div>
    </div>
  );
}

export default function ZoneStatusGrid() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await zonesApi.getAll();
        setZones(res.data.zones || []);
      } catch {
        // sample fallback
        setZones(generateSampleZones());
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card full-width">
      <div className="card-header">
        <span className="card-title">🏭 Zone Status — Live</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Updates every 10s</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {zones.map(z => <ZoneTile key={z.zone_id} zone={z} />)}
      </div>
    </div>
  );
}

function generateSampleZones() {
  return ['ZONE-01','ZONE-02','ZONE-03','ZONE-04','ZONE-05','ZONE-06'].map((id, i) => ({
    zone_id: id,
    name: ['Primary Processing','Secondary Processing','Utility Zone','Storage Area','Control Room','Maintenance'][i],
    risk_score: [22,18,35,12,8,28][i],
    status: ['NORMAL','NORMAL','MEDIUM','NORMAL','NORMAL','MEDIUM'][i],
    active_permits: [2,1,3,1,0,2][i],
    iot: { gas_concentration: Math.random() * 8, hazard_classification: 'NORMAL' },
    vision: { ppe_compliance: 0.85 + Math.random() * 0.15, person_count: Math.floor(Math.random() * 8) },
    scada: { anomalous_assets: 0, total_assets: 10 }
  }));
}
