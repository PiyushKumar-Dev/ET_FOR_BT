/**
 * Main App — React Router setup
 * Industrial Guardian AI — ET Hackathon 2026
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import KPIBar from './components/Dashboard/KPIBar';
import Dashboard from './pages/Dashboard';
import FacilityMapPage from './pages/FacilityMapPage';
import AgentIntelligence from './pages/AgentIntelligence';
import DemoControl from './pages/DemoControl';
import './index.css';

function App() {
  const [masterOutput, setMasterOutput] = useState(null);
  const [agentHeartbeat, setAgentHeartbeat] = useState({});
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Socket.IO subscriptions
  useSocket({
    connect: () => setSocketConnected(true),
    disconnect: () => setSocketConnected(false),
    risk_update: (data) => setMasterOutput(data),
    agent_heartbeat: (data) => setAgentHeartbeat(data),
    alert_triggered: (alert) => {
      setActiveAlerts(prev => {
        const exists = prev.find(a => a.id === alert.id);
        if (exists) return prev;
        return [alert, ...prev].slice(0, 50);
      });
    },
    alert_updated: (updated) => {
      setActiveAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
    },
    telemetry_stream: (data) => setTelemetry(data),
    scenario_triggered: (data) => console.log('[App] Scenario triggered:', data),
    scenario_reset: () => console.log('[App] Scenario reset')
  });

  const sharedProps = { masterOutput, agentHeartbeat, activeAlerts, setActiveAlerts, telemetry, socketConnected };

  return (
    <Router>
      <div className="app-shell">
        <KPIBar masterOutput={masterOutput} agentHeartbeat={agentHeartbeat}
                activeAlerts={activeAlerts} socketConnected={socketConnected} />
        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard {...sharedProps} />} />
              <Route path="/map" element={<FacilityMapPage {...sharedProps} />} />
              <Route path="/agents" element={<AgentIntelligence {...sharedProps} />} />
              <Route path="/demo" element={<DemoControl {...sharedProps} />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

function Sidebar() {
  const navItems = [
    { to: '/', icon: '⚡', label: 'Dashboard' },
    { to: '/map', icon: '🗺️', label: 'Facility Map' },
    { to: '/agents', icon: '🤖', label: 'Agent Intelligence' },
    { to: '/demo', icon: '🎮', label: 'Demo Scenarios' },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end={item.to === '/'}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default App;
