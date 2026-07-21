const express = require('express');
const router = express.Router();
const { triggerScenario, resetAllScenarios } = require('../socket/socketHandlers');

// POST /api/scenario/trigger
router.post('/trigger', async (req, res) => {
  const { scenario_id } = req.body;
  if (!scenario_id) return res.status(400).json({ error: 'scenario_id required' });

  try {
    const downstream = await triggerScenario(scenario_id, req.io);
    req.io.emit('scenario_triggered', {
      scenarioId: scenario_id,
      timestamp: new Date().toISOString()
    });
    res.json({
      triggered: scenario_id,
      downstream,
      message: `Scenario ${scenario_id} injected across agents`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.details || [] });
  }
});

// POST /api/scenario/reset
router.post('/reset', async (req, res) => {
  try {
    const downstream = await resetAllScenarios();
    req.io.emit('scenario_reset', { timestamp: new Date().toISOString() });
    res.json({ reset: true, downstream, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
