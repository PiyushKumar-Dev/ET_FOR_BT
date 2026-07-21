const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const PERMIT_AGENT_URL = process.env.PERMIT_AGENT_URL || 'http://localhost:8004';

router.get('/active', async (req, res) => {
  try {
    const response = await axios.get(`${PERMIT_AGENT_URL}/permits/active`, { timeout: 5000 });
    res.json(response.data);
  } catch {
    res.json({ permits: [], note: 'Permit agent unavailable' });
  }
});

router.get('/', async (req, res) => {
  try {
    const response = await axios.get(`${PERMIT_AGENT_URL}/permits/all`, { timeout: 5000 });
    res.json(response.data);
  } catch {
    res.json({ permits: [] });
  }
});

router.post('/:id/suspend', async (req, res) => {
  try {
    const response = await axios.post(`${PERMIT_AGENT_URL}/permits/suspend`,
      { permit_id: req.params.id }, { timeout: 5000 });
    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Could not suspend permit' });
  }
});

module.exports = router;
