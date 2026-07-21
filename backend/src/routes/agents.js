const express = require('express');
const router = express.Router();
const { getAgentStatus, AGENT_URLS } = require('../services/agentOrchestrator');
const axios = require('axios');

router.get('/status', async (req, res) => {
  const status = getAgentStatus();
  res.json({ agents: status, timestamp: new Date().toISOString() });
});

// Health check all agents
router.get('/health', async (req, res) => {
  const results = {};
  await Promise.allSettled(
    Object.entries(AGENT_URLS).map(async ([name, url]) => {
      try {
        const r = await axios.get(`${url}/health`, { timeout: 3000 });
        results[name] = { status: 'ONLINE', data: r.data };
      } catch {
        results[name] = { status: 'OFFLINE' };
      }
    })
  );
  res.json({ agents: results, timestamp: new Date().toISOString() });
});

// Get last output from specific agent
router.get('/:agent/last-output', (req, res) => {
  const { agentState } = require('../services/agentOrchestrator');
  const state = agentState[req.params.agent];
  if (state?.lastOutput) {
    res.json(state.lastOutput);
  } else {
    res.json({ message: `No output cached for ${req.params.agent}` });
  }
});

module.exports = router;
