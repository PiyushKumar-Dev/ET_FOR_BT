const express = require('express');
const router = express.Router();
const { Alert } = require('../models/index');
const { getActiveAlerts, acknowledgeAlert, suppressAlert } = require('../services/agentOrchestrator');

// GET active alerts
router.get('/active', async (req, res) => {
  try {
    const alerts = getActiveAlerts();
    res.json({ alerts, count: alerts.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET alert history
router.get('/history', async (req, res) => {
  try {
    const { severity, zone_id, limit = 50 } = req.query;
    const query = {};
    if (severity) query.severity = severity;
    if (zone_id) query.zone_id = zone_id;
    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST acknowledge
router.post('/:id/acknowledge', (req, res) => {
  const updated = acknowledgeAlert(req.params.id);
  if (updated) {
    req.io.emit('alert_updated', updated);
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

// POST suppress
router.post('/:id/suppress', (req, res) => {
  const { reason } = req.body;
  const updated = suppressAlert(req.params.id, reason);
  if (updated) {
    req.io.emit('alert_updated', updated);
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

module.exports = router;
