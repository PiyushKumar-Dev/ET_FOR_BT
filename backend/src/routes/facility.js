const express = require('express');
const router = express.Router();
const FACILITY_CONFIG = require('../data/facilityConfig');

router.get('/:id', async (req, res) => {
  try {
    const { getAgentStatus, getActiveAlerts } = require('../services/agentOrchestrator');
    const agentStatus = getAgentStatus();
    const activeAlerts = getActiveAlerts();

    res.json({
      facility: {
        facility_id: FACILITY_CONFIG.facility_id,
        facility_name: FACILITY_CONFIG.facility_name,
        location: FACILITY_CONFIG.location,
        zone_count: FACILITY_CONFIG.zones.length,
        asset_count: FACILITY_CONFIG.assets.length
      },
      current_status: {
        overall_risk_score: agentStatus.master?.lastOutput?.risk_score ?? 0,
        severity: agentStatus.master?.lastOutput?.severity ?? 'LOW',
        compound_risk_detected: agentStatus.master?.lastOutput?.compound_risk_detected ?? false,
        active_critical_alerts: activeAlerts.filter(a => a.severity === 'CRITICAL').length,
        active_alerts_total: activeAlerts.length,
        agent_status: agentStatus,
        last_updated: new Date().toISOString()
      },
      zones: FACILITY_CONFIG.zones
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
