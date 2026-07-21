/**
 * Socket.IO Event Handlers
 * Handles client-emitted events from the dashboard.
 */

const { acknowledgeAlert, suppressAlert } = require('../services/agentOrchestrator');
const axios = require('axios');
require('dotenv').config();

const AGENT_URLS = {
  scada:  process.env.SCADA_AGENT_URL  || 'http://localhost:8001',
  iot:    process.env.IOT_AGENT_URL    || 'http://localhost:8002',
  vision: process.env.VISION_AGENT_URL || 'http://localhost:8003',
  permit: process.env.PERMIT_AGENT_URL || 'http://localhost:8004',
};

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send current state on connect
    socket.emit('connection_ack', {
      message: 'Connected to Industrial Guardian AI',
      timestamp: new Date().toISOString()
    });

    // ── Operator Events ────────────────────────────────────────────

    socket.on('acknowledge_alert', (alertId) => {
      const updated = acknowledgeAlert(alertId);
      if (updated) {
        io.emit('alert_updated', updated);
        console.log(`[Socket.IO] Alert ${alertId} acknowledged`);
      }
    });

    socket.on('suppress_alert', ({ alertId, reason }) => {
      const updated = suppressAlert(alertId, reason);
      if (updated) {
        io.emit('alert_updated', updated);
        console.log(`[Socket.IO] Alert ${alertId} suppressed: ${reason}`);
      }
    });

    // ── Demo Scenario Trigger ──────────────────────────────────────

    socket.on('trigger_scenario', async (scenarioId) => {
      console.log(`[Socket.IO] Demo scenario triggered: ${scenarioId}`);
      io.emit('scenario_triggering', { scenarioId, timestamp: new Date().toISOString() });

      try {
        // Trigger anomalies across agents based on scenario
        await triggerScenario(scenarioId, io);
        io.emit('scenario_triggered', {
          scenarioId,
          message: `Scenario ${scenarioId} injected — monitoring agents for compound detection`,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        io.emit('scenario_error', { scenarioId, error: err.message });
      }
    });

    socket.on('reset_scenario', async () => {
      console.log('[Socket.IO] Resetting all scenarios');
      await resetAllScenarios();
      io.emit('scenario_reset', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Trigger a demo scenario by injecting correlated anomalies across agents.
 * [Innovation] Agents detect independently — they don't know a scenario was triggered.
 */
async function triggerScenario(scenarioId, io) {
  const scenarios = {
    'CR-001': async () => {
      // Explosion Precursor: SCADA pressure + IoT gas + Permit HOT_WORK conflict
      return Promise.allSettled([
        axios.post(`${AGENT_URLS.scada}/inject-anomaly`, {
          asset_id: 'ASSET-A07',
          anomaly_type: 'gradual_drift',
          severity: 0.85,
          duration_minutes: 30,
          parameter: 'pressure',
          propagate: true
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.iot}/inject-anomaly`, {
          zone_id: 'ZONE-02',
          sensors: ['gas_concentration', 'ambient_temperature'],
          anomaly_type: 'gradual_drift',
          severity: 0.80,
          duration_minutes: 30
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.permit}/inject-scenario`, {
          scenario: 'HOT_WORK_GAS_CONFLICT',
          zone_id: 'ZONE-02'
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.vision}/inject-scenario`, {
          zone_id: 'ZONE-02',
          persons: 5,
          no_helmet: 2,
          no_vest: 1,
          fire: 0,
          smoke: 0,
          restricted_area_intrusion: 1
        }, { timeout: 5000 })
      ]);
    },

    'CR-002': async () => {
      // Confined Space Fatality Risk: IoT air quality + Permit CONFINED_SPACE
      return Promise.allSettled([
        axios.post(`${AGENT_URLS.iot}/inject-anomaly`, {
          zone_id: 'ZONE-04',
          sensors: ['air_quality_index', 'gas_concentration', 'ventilation_flow'],
          anomaly_type: 'gradual_drift',
          severity: 0.75,
          duration_minutes: 20
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.permit}/inject-scenario`, {
          scenario: 'CONFINED_SPACE_VENTILATION',
          zone_id: 'ZONE-04'
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.vision}/inject-scenario`, {
          zone_id: 'ZONE-04',
          persons: 3,
          no_helmet: 1,
          no_vest: 0
        }, { timeout: 5000 })
      ]);
    },

    'CR-003': async () => {
      // Equipment Cascade: SCADA multi-asset + IoT temperature + Maintenance permit
      return Promise.allSettled([
        axios.post(`${AGENT_URLS.scada}/inject-anomaly`, {
          asset_id: 'ASSET-A15',
          anomaly_type: 'gradual_drift',
          severity: 0.82,
          duration_minutes: 45,
          parameter: 'vibration',
          propagate: true
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.scada}/inject-anomaly`, {
          asset_id: 'ASSET-B22',
          anomaly_type: 'sudden_spike',
          severity: 0.70,
          duration_minutes: 20,
          parameter: 'temperature',
          propagate: false
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.iot}/inject-anomaly`, {
          zone_id: 'ZONE-01',
          sensors: ['ambient_temperature'],
          anomaly_type: 'gradual_drift',
          severity: 0.60,
          duration_minutes: 45
        }, { timeout: 5000 }),
        axios.post(`${AGENT_URLS.permit}/inject-scenario`, {
          scenario: 'MAINTENANCE_DURING_ANOMALY',
          zone_id: 'ZONE-01'
        }, { timeout: 5000 })
      ]);
    },

    'RESET': async () => {
      return resetAllScenarios();
    }
  };

  const handler = scenarios[scenarioId];
  if (handler) {
    const results = await handler();
    if (Array.isArray(results)) {
      const mapped = results.map((result, index) => ({
        step: index + 1,
        status: result.status,
        value: result.status === 'fulfilled' ? result.value?.data ?? result.value : undefined,
        reason: result.status === 'rejected' ? result.reason?.message ?? String(result.reason) : undefined
      }));

      if (mapped.some((item) => item.status === 'rejected')) {
        const error = new Error(`Scenario ${scenarioId} did not reach every agent`);
        error.details = mapped;
        throw error;
      }
      return mapped;
    }
    return results;
  } else {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
}

async function resetAllScenarios() {
  return Promise.allSettled([
    axios.post(`${AGENT_URLS.scada}/clear-anomalies`, {}, { timeout: 5000 }),
    axios.post(`${AGENT_URLS.iot}/clear-anomalies`, {}, { timeout: 5000 }),
    axios.post(`${AGENT_URLS.vision}/clear-anomalies`, {}, { timeout: 5000 }),
    axios.post(`${AGENT_URLS.permit}/clear-anomalies`, {}, { timeout: 5000 }),
  ]);
}

module.exports = { setupSocketHandlers, triggerScenario, resetAllScenarios };
