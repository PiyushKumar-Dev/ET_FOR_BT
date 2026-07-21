/**
 * Socket.IO + API services for Industrial Guardian AI frontend
 */

import { io } from 'socket.io-client';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ─── Socket.IO ───────────────────────────────────────────────────────────────
export const socket = io(BACKEND_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling']
});

// ─── REST API ─────────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: `${BACKEND_URL}/api`, timeout: 10000 });

export const facilityApi = {
  getOverview: () => api.get('/facility/FAC-001'),
};

export const zonesApi = {
  getAll: () => api.get('/zones'),
};

export const assetsApi = {
  getAll: (params = {}) => api.get('/assets', { params }),
};

export const alertsApi = {
  getActive: () => api.get('/alerts/active'),
  getHistory: (params = {}) => api.get('/alerts/history', { params }),
  acknowledge: (id) => api.post(`/alerts/${id}/acknowledge`),
  suppress: (id, reason) => api.post(`/alerts/${id}/suppress`, { reason }),
};

export const incidentsApi = {
  getTimeline: (params = {}) => api.get('/incidents', { params }),
};

export const permitsApi = {
  getActive: () => api.get('/permits/active'),
};

export const personnelApi = {
  getActive: (params = {}) => api.get('/personnel/active', { params }),
};

export const agentsApi = {
  getStatus: () => api.get('/agents/status'),
  getHealth: () => api.get('/agents/health'),
  getLastOutput: (agent) => api.get(`/agents/${agent}/last-output`),
};

export const scenarioApi = {
  trigger: (scenario_id) => api.post('/scenario/trigger', { scenario_id }),
  reset: () => api.post('/scenario/reset'),
};
