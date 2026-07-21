const express = require('express');
const router = express.Router();
const { Alert } = require('../models/index');

router.get('/', async (req, res) => {
  try {
    const { severity, zone_id, agent, hours = 24, limit = 100 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 3600 * 1000);
    const query = { createdAt: { $gte: since } };
    if (severity) query.severity = severity;
    if (zone_id) query.zone_id = zone_id;
    const incidents = await Alert.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ incidents, count: incidents.length });
  } catch (err) {
    // Fallback: return sample timeline data
    res.json({ incidents: [], count: 0, note: 'MongoDB not connected — showing empty timeline' });
  }
});

module.exports = router;
