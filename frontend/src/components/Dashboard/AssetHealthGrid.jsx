/**
 * Asset Health Grid — Top 20 assets by risk, color-coded cards
 */

import { useState, useEffect } from 'react';
import { assetsApi } from '../../services/api';

function getRiskCardClass(riskScore) {
  if (riskScore >= 70) return 'risk-critical';
  if (riskScore >= 40) return 'risk-high';
  if (riskScore >= 20) return 'risk-medium';
  return '';
}

function getHealthBarClass(healthScore) {
  if (healthScore >= 70) return 'good';
  if (healthScore >= 40) return 'warning';
  return 'critical';
}

function AssetCard({ asset }) {
  const riskClass = getRiskCardClass(asset.risk_score);
  const healthClass = getHealthBarClass(asset.health_score);

  return (
    <div className={`asset-card ${riskClass}`}>
      <div className="asset-id">{asset.asset_id}</div>
      <div className="asset-zone-label">{asset.zone_id} · {asset.asset_type}</div>

      {/* Health bar */}
      <div className="health-bar-container">
        <div className={`health-bar ${healthClass}`} style={{ width: `${asset.health_score}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Health: <strong style={{ color: 'var(--text-primary)' }}>{asset.health_score}</strong>
        </span>
        <span style={{ fontSize: 10, color: asset.risk_score >= 70 ? 'var(--risk-critical)' :
          asset.risk_score >= 40 ? 'var(--risk-high)' : 'var(--risk-low)' }}>
          Risk: <strong>{asset.risk_score}</strong>
        </span>
      </div>

      {/* Status badge */}
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 3,
          background: asset.equipment_status === 'RUNNING' ? 'rgba(16,185,129,0.12)' :
                      asset.equipment_status === 'FAULT' ? 'rgba(255,45,85,0.12)' : 'rgba(251,191,36,0.12)',
          color: asset.equipment_status === 'RUNNING' ? 'var(--risk-low)' :
                 asset.equipment_status === 'FAULT' ? 'var(--risk-critical)' : 'var(--risk-medium)',
          fontWeight: 700, textTransform: 'uppercase'
        }}>
          {asset.equipment_status}
        </span>
        {asset.top_anomaly && (
          <span style={{ fontSize: 9, color: 'var(--risk-medium)', fontFamily: 'var(--font-mono)' }}>
            ⚠ {asset.top_anomaly}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AssetHealthGrid({ telemetry }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await assetsApi.getAll({ sort_by: 'risk_score', limit: 20 });
        setAssets(res.data.assets || []);
      } catch {
        // Generate sample data
        setAssets(generateSampleAssets());
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  // Update from telemetry stream
  useEffect(() => {
    if (telemetry?.assets) {
      setAssets(prev => {
        const updated = [...prev];
        telemetry.assets.forEach(ta => {
          const idx = updated.findIndex(a => a.asset_id === ta.asset_id);
          if (idx >= 0) updated[idx] = { ...updated[idx], ...ta };
        });
        return updated.sort((a, b) => b.risk_score - a.risk_score);
      });
    }
  }, [telemetry]);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <span className="card-title">Asset Health Grid</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Top 20 by risk</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map(asset => (
            <AssetCard key={asset.asset_id} asset={asset} />
          ))}
          {assets.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20 }}>
              Loading asset data...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateSampleAssets() {
  const zones = ['ZONE-01', 'ZONE-02', 'ZONE-03', 'ZONE-04'];
  const types = ['ROTATING', 'STATIC', 'ELECTRICAL'];
  const statuses = ['RUNNING', 'RUNNING', 'RUNNING', 'IDLE', 'FAULT'];
  return Array.from({ length: 20 }, (_, i) => ({
    asset_id: `ASSET-${String.fromCharCode(65 + Math.floor(i / 10))}${String(i % 100).padStart(2, '0')}`,
    zone_id: zones[i % zones.length],
    asset_type: types[i % types.length],
    equipment_status: statuses[i % statuses.length],
    health_score: Math.max(20, 95 - i * 3 + Math.random() * 10),
    risk_score: Math.min(95, i * 4 + Math.random() * 10),
    top_anomaly: i < 5 ? ['pressure', 'temperature', 'vibration'][i % 3] : null
  }));
}
