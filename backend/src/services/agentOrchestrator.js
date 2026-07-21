/**
 * Agent Orchestrator Service
 * [Scalability] Polls all 5 agents every 30s, handles failures gracefully,
 * caches last valid output for 5 minutes.
 */

const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const AGENT_URLS = {
  scada:  process.env.SCADA_AGENT_URL  || 'http://localhost:8001',
  iot:    process.env.IOT_AGENT_URL    || 'http://localhost:8002',
  vision: process.env.VISION_AGENT_URL || 'http://localhost:8003',
  permit: process.env.PERMIT_AGENT_URL || 'http://localhost:8004',
  master: process.env.MASTER_AGENT_URL || 'http://localhost:8005',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Agent state store
const agentState = {
  scada:  { status: 'UNKNOWN', lastOutput: null, lastSeen: null, errorCount: 0 },
  iot:    { status: 'UNKNOWN', lastOutput: null, lastSeen: null, errorCount: 0 },
  vision: { status: 'UNKNOWN', lastOutput: null, lastSeen: null, errorCount: 0 },
  permit: { status: 'UNKNOWN', lastOutput: null, lastSeen: null, errorCount: 0 },
  master: { status: 'UNKNOWN', lastOutput: null, lastSeen: null, errorCount: 0 },
};

let io = null;

/**
 * Poll a single agent for its latest analysis.
 * Returns null on failure — never throws.
 */
async function pollAgent(agentName) {
  const url = AGENT_URLS[agentName];
  if (!url) return null;

  try {
    const response = await axios.post(`${url}/analyze`, {}, { timeout: 10000 });
    if (response.status === 200 && response.data) {
      agentState[agentName].status = 'ACTIVE';
      agentState[agentName].lastOutput = response.data;
      agentState[agentName].lastSeen = new Date().toISOString();
      agentState[agentName].errorCount = 0;
      return response.data;
    }
  } catch (err) {
    agentState[agentName].errorCount++;
    const errorCount = agentState[agentName].errorCount;

    // Mark DEGRADED after 2 failures, OFFLINE after 5
    if (errorCount >= 5) {
      agentState[agentName].status = 'OFFLINE';
    } else if (errorCount >= 2) {
      agentState[agentName].status = 'DEGRADED';
    }

    // Return cached output if fresh enough
    const lastSeen = agentState[agentName].lastSeen;
    if (lastSeen && agentState[agentName].lastOutput) {
      const age = Date.now() - new Date(lastSeen).getTime();
      if (age < CACHE_TTL_MS) {
        console.log(`[Orchestrator] Using cached ${agentName} output (${Math.round(age/1000)}s old)`);
        return agentState[agentName].lastOutput;
      }
    }
  }
  return null;
}

/**
 * Poll Master Agent and broadcast risk update.
 * Master agent internally polls other agents.
 */
async function runMasterAnalysis() {
  const url = AGENT_URLS.master;
  try {
    const response = await axios.post(`${url}/analyze`, {}, { timeout: 20000 });
    if (response.status === 200 && response.data) {
      const masterOutput = response.data;
      agentState.master.status = 'ACTIVE';
      agentState.master.lastOutput = masterOutput;
      agentState.master.lastSeen = new Date().toISOString();
      agentState.master.errorCount = 0;

      // Broadcast to frontend
      if (io) {
        io.emit('risk_update', masterOutput);

        // If compound CRITICAL, trigger alert
        if (masterOutput.compound_risk_detected && masterOutput.severity === 'CRITICAL') {
          const alert = {
            id: `ALERT-${Date.now()}`,
            timestamp: masterOutput.timestamp,
            severity: masterOutput.severity,
            zone_id: masterOutput.zone_id,
            compound_risk_id: masterOutput.compound_risk_id,
            compound_risk_name: masterOutput.compound_risk_name,
            risk_score: masterOutput.risk_score,
            confidence: masterOutput.confidence,
            contributing_agents: masterOutput.contributing_agents,
            agent_findings_summary: masterOutput.agent_findings_summary,
            similar_historical_incidents: masterOutput.similar_historical_incidents,
            recommendations: masterOutput.recommendations,
            explainability: masterOutput.explainability,
            acknowledged: false,
            suppressed: false
          };
          io.emit('alert_triggered', alert);
          activeAlerts.set(alert.id, alert);
        }
      }

      return masterOutput;
    }
  } catch (err) {
    agentState.master.errorCount++;
    agentState.master.status = agentState.master.errorCount >= 5 ? 'OFFLINE' : 'DEGRADED';
    console.error(`[Orchestrator] Master agent error: ${err.message}`);
  }
  return null;
}

// In-memory alert store (also persisted to MongoDB)
const activeAlerts = new Map();

/**
 * Stream latest telemetry data from SCADA agent to frontend.
 */
async function streamTelemetry() {
  const scadaOutput = agentState.scada.lastOutput;
  if (scadaOutput && io) {
    io.emit('telemetry_stream', {
      timestamp: new Date().toISOString(),
      assets: (scadaOutput.results || []).slice(0, 20),
      zone_summary: scadaOutput.zone_risk_summary || {}
    });
  }
}

/**
 * Emit agent heartbeat to frontend (every 10 seconds).
 */
function emitHeartbeat() {
  if (!io) return;
  const heartbeat = {};
  for (const [name, state] of Object.entries(agentState)) {
    heartbeat[name] = {
      status: state.status,
      lastSeen: state.lastSeen,
      errorCount: state.errorCount
    };
  }
  io.emit('agent_heartbeat', heartbeat);
}

/**
 * Get current agent status map.
 */
function getAgentStatus() {
  const status = {};
  for (const [name, state] of Object.entries(agentState)) {
    status[name] = {
      status: state.status,
      lastSeen: state.lastSeen,
      errorCount: state.errorCount,
      url: AGENT_URLS[name]
    };
  }
  return status;
}

function getActiveAlerts() {
  return Array.from(activeAlerts.values()).filter(a => !a.suppressed && !a.acknowledged);
}

function acknowledgeAlert(alertId) {
  const alert = activeAlerts.get(alertId);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    if (io) io.emit('alert_acknowledged', { alertId, timestamp: alert.acknowledged_at });
    return alert;
  }
  return null;
}

function suppressAlert(alertId, reason) {
  const alert = activeAlerts.get(alertId);
  if (alert) {
    alert.suppressed = true;
    alert.suppressed_reason = reason;
    alert.suppressed_at = new Date().toISOString();
    if (io) io.emit('alert_suppressed', { alertId, reason });
    return alert;
  }
  return null;
}

/**
 * Start the orchestrator — sets up all polling intervals.
 * [Scalability] Interval-based polling simulates MQTT/Kafka subscription.
 */
function startOrchestrator(socketIo) {
  io = socketIo;
  console.log('[Orchestrator] Starting agent orchestration...');

  // Initial health check for all agents
  setTimeout(async () => {
    for (const agentName of ['scada', 'iot', 'vision', 'permit']) {
      try {
        const url = AGENT_URLS[agentName];
        const res = await axios.get(`${url}/health`, { timeout: 5000 });
        if (res.status === 200) {
          agentState[agentName].status = 'ACTIVE';
          console.log(`[Orchestrator] ${agentName} agent: ONLINE`);
        }
      } catch (err) {
        agentState[agentName].status = 'OFFLINE';
        console.log(`[Orchestrator] ${agentName} agent: OFFLINE (${err.message})`);
      }
    }
  }, 2000);

  // Poll Master Agent every 30 seconds (it internally handles other agents)
  cron.schedule('*/30 * * * * *', async () => {
    await runMasterAnalysis();
  });

  // Poll individual sub-agents every 30 seconds for telemetry
  cron.schedule('*/30 * * * * *', async () => {
    await Promise.allSettled([
      pollAgent('scada'),
      pollAgent('iot'),
      pollAgent('vision'),
      pollAgent('permit')
    ]);
  });

  // Stream telemetry every 5 seconds
  cron.schedule('*/5 * * * * *', streamTelemetry);

  // Emit heartbeat every 10 seconds
  cron.schedule('*/10 * * * * *', emitHeartbeat);

  console.log('[Orchestrator] All cron jobs scheduled');
}

module.exports = {
  startOrchestrator,
  getAgentStatus,
  getActiveAlerts,
  acknowledgeAlert,
  suppressAlert,
  agentState,
  AGENT_URLS
};
