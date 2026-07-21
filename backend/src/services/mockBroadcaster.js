/**
 * Dev mock broadcaster.
 *
 * This is intentionally limited to labeled heartbeat/status events for local
 * UI work. It never emits synthetic telemetry, compound risk scores, alerts,
 * or incidents, so demo data can only come from the real five-agent pipeline.
 */

function startMockBroadcaster(io, agentState) {
  console.warn('[MockBroadcaster] DEV_MOCK_MODE enabled. Synthetic telemetry is disabled.');

  const intervalId = setInterval(() => {
    // Check if any real agents are ACTIVE
    if (agentState) {
      const anyRealAgent = Object.values(agentState).some(state => state.status === 'ACTIVE');
      if (anyRealAgent) {
        console.log('[MockBroadcaster] Real agents detected. Auto-disabling DEV_MOCK_MODE.');
        io.emit('dev_mock_status', {
          enabled: false,
          label: 'DEV_MOCK_MODE',
          timestamp: new Date().toISOString(),
          note: 'Disabled because real agents are connected.'
        });
        clearInterval(intervalId);
        return;
      }
    }

    const now = new Date().toISOString();
    const heartbeat = {};

    ['scada', 'iot', 'vision', 'permit', 'master'].forEach((name) => {
      heartbeat[name] = {
        status: 'DEV_MOCK_MODE',
        lastSeen: now,
        errorCount: 0,
        source: 'dev_mock_status'
      };
    });

    io.emit('agent_heartbeat', heartbeat);
    io.emit('dev_mock_status', {
      enabled: true,
      label: 'DEV_MOCK_MODE',
      timestamp: now,
      note: 'No synthetic telemetry or alerts are emitted in this mode.'
    });
  }, 10000);

  // Initial emit
  io.emit('dev_mock_status', {
    enabled: true,
    label: 'DEV_MOCK_MODE',
    timestamp: new Date().toISOString(),
    note: 'Started in mock mode.'
  });
  
  return intervalId;
}

module.exports = { startMockBroadcaster };
