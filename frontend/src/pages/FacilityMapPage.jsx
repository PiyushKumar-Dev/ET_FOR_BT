/**
 * Facility Map Page — Interactive Leaflet map with zone overlays and risk heatmap
 * [UX] Risk heatmap updates every 30s via Socket.IO
 */

import { useEffect, useRef, useState } from 'react';
import { zonesApi, assetsApi } from '../services/api';

// Lazy-load Leaflet to avoid SSR issues
let L = null;
let mapInstance = null;
let zoneLayerGroup = null;

const ZONE_BOUNDS_APPROX = {
  'ZONE-01': [[19.0750, 72.8760], [19.0770, 72.8790]],
  'ZONE-02': [[19.0770, 72.8790], [19.0785, 72.8820]],
  'ZONE-03': [[19.0785, 72.8760], [19.0800, 72.8820]],
  'ZONE-04': [[19.0750, 72.8820], [19.0800, 72.8860]],
  'ZONE-05': [[19.0755, 72.8860], [19.0775, 72.8880]],
  'ZONE-06': [[19.0775, 72.8860], [19.0800, 72.8880]],
};

function getRiskColor(score) {
  if (score >= 75) return '#ff2d55';
  if (score >= 50) return '#ff6b2b';
  if (score >= 25) return '#fbbf24';
  return '#10b981';
}

function ZoneDetailPanel({ zone, onClose }) {
  if (!zone) return null;
  return (
    <div className="animate-slidein" style={{
      position: 'absolute', right: 16, top: 16, width: 300, zIndex: 1000,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
      borderRadius: 'var(--radius-lg)', padding: 20,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-cyan)' }}>{zone.zone_id}</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{zone.name}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      {/* Zone risk */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{
          background: `${getRiskColor(zone.risk_score)}20`,
          border: `1px solid ${getRiskColor(zone.risk_score)}50`,
          borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center'
        }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: getRiskColor(zone.risk_score) }}>{zone.risk_score}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Score</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-blue)' }}>{zone.vision?.person_count ?? 0}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Personnel</div>
        </div>
      </div>

      {/* IoT sensors */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>IoT Sensors</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {zone.iot?.gas_concentration > 0 && (
            <div style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', borderRadius: 4, padding: '3px 8px', color: 'var(--accent-blue)' }}>
              Gas: {zone.iot.gas_concentration?.toFixed(1)} ppm
            </div>
          )}
          <div style={{ fontSize: 11, background: 'var(--bg-card)', borderRadius: 4, padding: '3px 8px', color: 'var(--text-secondary)' }}>
            {zone.iot?.hazard_classification || 'NORMAL'}
          </div>
        </div>
      </div>

      {/* Active permits */}
      {zone.permits?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Active Permits ({zone.permits.length})
          </div>
          {zone.permits.map(p => (
            <div key={p.permit_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: 10 }}>{p.permit_id}</span>
              <span className={`badge ${p.risk_level === 'CRITICAL' ? 'CRITICAL' : p.risk_level === 'HIGH' ? 'HIGH' : 'LOW'}`}>
                {p.type.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PPE compliance */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>PPE Compliance</div>
        <div style={{ background: 'var(--bg-base)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
            width: `${(zone.vision?.ppe_compliance ?? 1) * 100}%`,
            background: zone.vision?.ppe_compliance > 0.8 ? 'var(--risk-low)' : 'var(--risk-critical)'
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {((zone.vision?.ppe_compliance ?? 1) * 100).toFixed(0)}% compliant
        </div>
      </div>
    </div>
  );
}

export default function FacilityMapPage({ masterOutput }) {
  const mapRef = useRef(null);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Load zone data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await zonesApi.getAll();
        setZones(res.data.zones || []);
      } catch {
        setZones(generateSampleZones());
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    const initMap = async () => {
      if (mapInstance) return;
      const leaflet = await import('leaflet');
      L = leaflet.default;
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current) return;

      mapInstance = L.map(mapRef.current, {
        center: [19.0775, 72.8820],
        zoom: 15,
        zoomControl: true
      });

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19
      }).addTo(mapInstance);

      zoneLayerGroup = L.layerGroup().addTo(mapInstance);
      setMapReady(true);
    };

    initMap();
    return () => {
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    };
  }, []);

  // Draw zone polygons whenever zones update
  useEffect(() => {
    if (!mapReady || !L || !zoneLayerGroup || zones.length === 0) return;

    zoneLayerGroup.clearLayers();

    zones.forEach(zone => {
      const bounds = ZONE_BOUNDS_APPROX[zone.zone_id];
      if (!bounds) return;

      const color = getRiskColor(zone.risk_score || 0);
      const fillOpacity = Math.max(0.08, (zone.risk_score || 0) / 100 * 0.35);

      const rect = L.rectangle(bounds, {
        color,
        weight: 2,
        opacity: 0.8,
        fillColor: color,
        fillOpacity
      });

      rect.bindTooltip(`
        <div style="font-family: Inter, sans-serif; font-size: 12px; color: #f0f4ff">
          <strong>${zone.zone_id}</strong> — ${zone.name}<br/>
          Risk: <strong style="color: ${color}">${zone.risk_score || 0}</strong> |
          Personnel: ${zone.vision?.person_count || 0} |
          Permits: ${zone.active_permits || 0}
        </div>
      `, { className: 'leaflet-dark-tooltip' });

      rect.on('click', () => setSelectedZone(zone));
      rect.addTo(zoneLayerGroup);

      // Zone label
      const center = [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2
      ];
      const labelIcon = L.divIcon({
        html: `<div style="
          color: ${color}; font-family: JetBrains Mono, monospace;
          font-size: 10px; font-weight: 700; text-shadow: 0 0 6px rgba(0,0,0,0.8);
          white-space: nowrap; pointer-events: none;">
          ${zone.zone_id}<br/>
          <span style="font-size: 14px; font-weight: 900;">${zone.risk_score || 0}</span>
        </div>`,
        className: '',
        iconSize: [80, 30],
        iconAnchor: [40, 15]
      });
      L.marker(center, { icon: labelIcon, interactive: false }).addTo(zoneLayerGroup);
    });
  }, [zones, mapReady]);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 100px)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

      {/* Zone detail panel */}
      {selectedZone && (
        <ZoneDetailPanel zone={selectedZone} onClose={() => setSelectedZone(null)} />
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
        background: 'var(--bg-overlay)', border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)', padding: '12px 16px',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Risk Level</div>
        {[['CRITICAL', '#ff2d55', '>75'], ['HIGH', '#ff6b2b', '50-75'], ['MEDIUM', '#fbbf24', '25-50'], ['NORMAL', '#10b981', '<25']].map(([label, color, range]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color, opacity: 0.8 }} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{label} ({range})</span>
          </div>
        ))}
      </div>

      {/* Current risk summary overlay */}
      {masterOutput?.compound_risk_detected && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 1000,
          background: 'rgba(255,45,85,0.15)', border: '1px solid rgba(255,45,85,0.4)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          backdropFilter: 'blur(12px)', maxWidth: 280
        }} className="animate-fadein">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-critical)', marginBottom: 4 }}>
            🔴 COMPOUND RISK ACTIVE
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{masterOutput.compound_risk_name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Zone: {masterOutput.zone_id} | Risk: {masterOutput.risk_score}/100
          </div>
        </div>
      )}
    </div>
  );
}

function generateSampleZones() {
  return ['ZONE-01', 'ZONE-02', 'ZONE-03', 'ZONE-04', 'ZONE-05', 'ZONE-06'].map((id, i) => ({
    zone_id: id,
    name: ['Primary Processing', 'Secondary Processing', 'Utility Zone', 'Storage Area', 'Control Room', 'Maintenance Workshop'][i],
    risk_score: [22, 18, 35, 12, 8, 28][i],
    active_permits: [2, 1, 3, 1, 0, 2][i],
    iot: { hazard_classification: 'NORMAL', gas_concentration: Math.random() * 5 },
    vision: { ppe_compliance: 0.85 + Math.random() * 0.15, person_count: Math.floor(Math.random() * 8) },
    permits: []
  }));
}
