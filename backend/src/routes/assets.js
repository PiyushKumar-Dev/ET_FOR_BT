const express = require('express');
const router = express.Router();
const { agentState } = require('../services/agentOrchestrator');
const FACILITY_CONFIG = require('../data/facilityConfig');

router.get('/', async (req, res) => {
  try {
    const { zone_id, sort_by = 'risk_score', limit = 20 } = req.query;
    const scadaOutput = agentState.scada?.lastOutput;
    
    let assets = FACILITY_CONFIG.assets.map(asset => {
      // Enrich with latest SCADA data if available
      const scadaResult = scadaOutput?.results?.find(r => r.asset_id === asset.asset_id);
      return {
        ...asset,
        health_score: scadaResult?.health_score ?? 85,
        risk_score: scadaResult?.risk_score ?? 0,
        equipment_status: scadaResult?.equipment_status ?? 'RUNNING',
        severity: scadaResult?.severity ?? 'LOW',
        top_anomaly: scadaResult?.findings?.[0]?.parameter ?? null,
        anomaly_description: scadaResult?.findings?.[0]?.description ?? null
      };
    });

    if (zone_id) assets = assets.filter(a => a.zone_id === zone_id);
    if (sort_by === 'risk_score') assets.sort((a, b) => b.risk_score - a.risk_score);
    else if (sort_by === 'health_score') assets.sort((a, b) => a.health_score - b.health_score);

    res.json({
      assets: assets.slice(0, parseInt(limit)),
      total: assets.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
