/**
 * Dashboard Page — Main 5-panel live view
 */

import RiskGauge from '../components/Dashboard/RiskGauge';
import AlertFeed from '../components/AlertPanel/AlertFeed';
import AssetHealthGrid from '../components/Dashboard/AssetHealthGrid';
import IncidentTimeline from '../components/IncidentTimeline/IncidentTimeline';
import LiveRiskChart from '../components/Dashboard/LiveRiskChart';
import ZoneStatusGrid from '../components/Dashboard/ZoneStatusGrid';

export default function Dashboard({ masterOutput, agentHeartbeat, activeAlerts, setActiveAlerts, telemetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top row: Risk Gauge + Alert Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
        <RiskGauge masterOutput={masterOutput} />
        <AlertFeed activeAlerts={activeAlerts} setActiveAlerts={setActiveAlerts} />
      </div>

      {/* Live risk evolution chart */}
      <LiveRiskChart masterOutput={masterOutput} agentHeartbeat={agentHeartbeat} />

      {/* Zone status grid */}
      <ZoneStatusGrid />

      {/* Asset health grid */}
      <AssetHealthGrid telemetry={telemetry} />

      {/* Incident timeline */}
      <IncidentTimeline activeAlerts={activeAlerts} masterOutput={masterOutput} />
    </div>
  );
}
