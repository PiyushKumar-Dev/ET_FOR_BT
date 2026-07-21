/**
 * Industrial Guardian AI — Backend Entry Point
 * Express + Socket.IO + Mongoose + Agent Orchestrator
 * [Scalability] Microservice-ready: agents are independently hosted
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Routes
const facilityRoutes = require('./routes/facility');
const alertRoutes = require('./routes/alerts');
const assetRoutes = require('./routes/assets');
const zoneRoutes = require('./routes/zones');
const incidentRoutes = require('./routes/incidents');
const permitRoutes = require('./routes/permits');
const personnelRoutes = require('./routes/personnel');
const scenarioRoutes = require('./routes/scenarios');
const agentRoutes = require('./routes/agents');

// Services
const { startOrchestrator } = require('./services/agentOrchestrator');
const { setupSocketHandlers } = require('./socket/socketHandlers');
const { seedDatabase } = require('./services/seedService');
const { startMockBroadcaster } = require('./services/mockBroadcaster');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach io to req for use in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/facility', facilityRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/scenario', scenarioRoutes);
app.use('/api/agents', agentRoutes);

// ─── Master Agent Webhook (internal) ──────────────────────────────────────────
app.post('/api/internal/master-update', (req, res) => {
  const masterOutput = req.body;
  if (masterOutput && masterOutput.agent === 'master') {
    // Broadcast to all connected clients
    io.emit('risk_update', masterOutput);

    // If compound risk detected, emit alert
    if (masterOutput.compound_risk_detected && masterOutput.severity === 'CRITICAL') {
      const alert = {
        id: `ALERT-${Date.now()}`,
        timestamp: masterOutput.timestamp,
        severity: masterOutput.severity,
        zone_id: masterOutput.zone_id,
        compound_risk_id: masterOutput.compound_risk_id,
        compound_risk_name: masterOutput.compound_risk_name,
        risk_score: masterOutput.risk_score,
        contributing_agents: masterOutput.contributing_agents,
        recommendations: masterOutput.recommendations,
        acknowledged: false,
        suppressed: false
      };
      io.emit('alert_triggered', alert);

      // Persist alert to DB
      require('./models/Alert').create(alert).catch(console.error);
    }
  }
  res.json({ received: true });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'industrial-guardian-backend',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
setupSocketHandlers(io);

// ─── Database & Startup ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/industrial_guardian';
const PORT = parseInt(process.env.BACKEND_PORT || '3000');
const DEV_MOCK_MODE = process.env.DEV_MOCK_MODE === 'true';

function shouldEnableDevMockMode() {
  if (!DEV_MOCK_MODE) return false;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Backend] DEV_MOCK_MODE ignored because NODE_ENV=production');
    return false;
  }
  return true;
}

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[Backend] MongoDB connected');

    // Seed initial data if empty
    await seedDatabase();

    // Start agent orchestrator (polls agents every 30s)
    startOrchestrator(io);

    if (shouldEnableDevMockMode()) {
      const { agentState } = require('./services/agentOrchestrator');
      startMockBroadcaster(io, agentState);
    } else {
      console.log('[Backend] DEV_MOCK_MODE disabled. Live risk data will only come from real agents.');
    }

    server.listen(PORT, () => {
      console.log(`[Backend] Server running on http://localhost:${PORT}`);
      console.log(`[Backend] Socket.IO ready`);
    });
  } catch (err) {
    console.error('[Backend] Startup error:', err);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
