const express = require('express');
const router = express.Router();
const { agentState, getActiveAlerts } = require('../services/agentOrchestrator');
const FACILITY_CONFIG = require('../data/facilityConfig');

router.get('/', async (req, res) => {
  try {
    const iotOutput = agentState.iot?.lastOutput;
    const scadaOutput = agentState.scada?.lastOutput;
    const permitOutput = agentState.permit?.lastOutput;
    const visionOutput = agentState.vision?.lastOutput;
    const activeAlerts = getActiveAlerts();

    const zones = FACILITY_CONFIG.zones.map(zone => {
      const zoneId = zone.zone_id;

      // IoT data for zone
      const iotZone = iotOutput?.results?.find(r => r.zone_id === zoneId);
      // SCADA zone summary
      const scadaZone = scadaOutput?.zone_risk_summary?.[zoneId];
      // Permits for zone
      const zonePermits = (permitOutput?.permits || []).filter(p => p.zone_id === zoneId && p.status === 'ACTIVE');
      // Vision for zone
      const visionZone = visionOutput?.results?.find(r => r.zone_id === zoneId);
      // Active alerts in zone
      const zoneAlerts = activeAlerts.filter(a => a.zone_id === zoneId);

      // Aggregate risk
      const riskScores = [
        iotZone?.risk_score ?? 0,
        scadaZone?.max_risk_score ?? 0,
        visionZone?.risk_score ?? 0
      ].filter(s => s > 0);
      const aggRisk = riskScores.length > 0 ? Math.max(...riskScores) : 0;

      let status = 'NORMAL';
      if (aggRisk >= 75) status = 'CRITICAL';
      else if (aggRisk >= 50) status = 'HIGH';
      else if (aggRisk >= 25) status = 'MEDIUM';

      return {
        zone_id: zoneId,
        name: zone.name,
        area_sqm: zone.area_sqm,
        max_occupancy: zone.max_occupancy,
        lat_lng_bounds: zone.lat_lng_bounds,
        risk_score: aggRisk,
        status,
        active_alerts: zoneAlerts.length,
        active_permits: zonePermits.length,
        iot: {
          hazard_classification: iotZone?.hazard_classification ?? 'NORMAL',
          risk_score: iotZone?.risk_score ?? 0,
          gas_concentration: iotZone?.raw_context?.sensor_readings?.gas_concentration ?? 0,
          compound_flags: iotZone?.raw_context?.compound_flags?.length ?? 0
        },
        scada: {
          max_risk_score: scadaZone?.max_risk_score ?? 0,
          anomalous_assets: scadaZone?.anomalous_assets ?? 0,
          total_assets: scadaZone?.total_assets ?? 0
        },
        vision: {
          ppe_compliance: visionZone?.ppe_compliance_score ?? 1.0,
          person_count: visionZone?.person_count ?? 0,
          crowd_density: visionZone?.crowd_density ?? 0
        },
        permits: zonePermits.map(p => ({
          permit_id: p.permit_id,
          type: p.type,
          risk_level: p.risk_level,
          status: p.status
        }))
      };
    });

    res.json({ zones, count: zones.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
