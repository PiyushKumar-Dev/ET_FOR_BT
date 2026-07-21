/**
 * Agent Intelligence Page — 5 agent cards + Compound Flow Diagram
 * [UX] This is the page technical judges will study most carefully.
 */

import { useState, useEffect } from 'react';
import { agentsApi } from '../services/api';

const AGENTS = [
  { key: 'scada', label: 'SCADA Agent', icon: '📊', color: '#3b82f6', method: 'Isolation Forest + SHAP', port: 8001 },
  { key: 'iot',   label: 'IoT Agent',   icon: '🌡️', color: '#22d3ee', method: 'Rule Engine + ML',     port: 8002 },
  { key: 'vision',label: 'Vision Agent',icon: '👁️', color: '#a78bfa', method: 'YOLOv8 + Simulation',  port: 8003 },
  { key: 'permit',label: 'Permit Agent',icon: '📋', color: '#fbbf24', method: 'LangChain + Rules',     port: 8004 },
  { key: 'master',label: 'Master AI',   icon: '🧠', color: '#ff2d55', method: 'FAISS RAG + LLM Fusion', port: 8005 },
];

function AgentCard({ agent, output, status }) {
  const [expanded, setExpanded] = useState(false);
  const agentInfo = AGENTS.find(a => a.key === agent);
  if (!agentInfo) return null;

  const result = output?.result || output?.results?.[0] || output?.highest_risk_zone || output;
  const riskScore = result?.risk_score ?? 0;
  const severity = result?.severity ?? 'LOW';
  const confidence = result?.confidence ?? 0;
  const findings = result?.findings?.slice(0, 3) ?? [];
  const narrative = result?.explainability?.narrative ?? 'Awaiting analysis...';

  return (
    <div className="card animate-fadein" style={{
      borderColor: status === 'ACTIVE' ? `${agentInfo.color}30` : 'var(--border-subtle)',
      borderLeftWidth: 3,
      borderLeftColor: status === 'ACTIVE' ? agentInfo.color : 'var(--border-subtle)'
    }}>
      {/* Agent header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${agentInfo.color}20`, border: `1px solid ${agentInfo.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>
            {agentInfo.icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{agentInfo.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>:{agentInfo.port} · {agentInfo.method}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`agent-dot ${status ?? 'UNKNOWN'}`} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{status ?? 'UNKNOWN'}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: riskScore >= 70 ? 'var(--risk-critical)' : riskScore >= 40 ? 'var(--risk-high)' : 'var(--text-primary)' }}>
            {riskScore}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Score</div>
        </div>
        <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: agentInfo.color }}>{(confidence * 100).toFixed(0)}%</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</div>
        </div>
        <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <span className={`badge ${severity}`} style={{ fontSize: 9 }}>{severity}</span>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase' }}>Severity</div>
        </div>
      </div>

      {/* Top findings */}
      {findings.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>Top Findings</div>
          {findings.map((f, i) => (
            <div key={i} style={{
              fontSize: 10, color: 'var(--text-secondary)', padding: '4px 0',
              borderBottom: i < findings.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              display: 'flex', alignItems: 'flex-start', gap: 6
            }}>
              <span style={{ color: agentInfo.color, fontSize: 9, marginTop: 1 }}>▸</span>
              {f.description || `${f.parameter}: ${f.current_value}`}
            </div>
          ))}
        </div>
      )}

      {/* Narrative */}
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
        {narrative.substring(0, 150)}{narrative.length > 150 ? '...' : ''}
      </div>

      {/* Expand JSON */}
      <button onClick={() => setExpanded(!expanded)} className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px' }}>
        {expanded ? '▲ Hide JSON' : '▼ Show Raw JSON'}
      </button>

      {expanded && (
        <div style={{
          marginTop: 10, background: 'var(--bg-base)', borderRadius: 8,
          padding: 12, maxHeight: 200, overflow: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 9, color: '#22d3ee'
        }}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function CompoundFlowDiagram({ masterOutput, agentHeartbeat }) {
  const contributingAgents = masterOutput?.contributing_agents ?? [];
  const detected = masterOutput?.compound_risk_detected ?? false;

  return (
    <div className="card" style={{ background: 'var(--bg-surface)' }}>
      <div className="card-header">
        <span className="card-title">⚡ Compound Risk Detection Flow</span>
        {detected && <span className="badge CRITICAL">ACTIVE</span>}
      </div>

      {/* Flow diagram */}
      <div className="compound-flow">
        {AGENTS.filter(a => a.key !== 'master').map(agent => (
          <div key={agent.key} className="flow-agent-bubble">
            <div className={`flow-bubble ${contributingAgents.includes(agent.key) ? 'contributing' : ''}`}
              style={{ borderColor: contributingAgents.includes(agent.key) ? agent.color : 'var(--border-subtle)' }}>
              <span style={{ fontSize: 22 }}>{agent.icon}</span>
              {masterOutput?.raw_context?.agent_summaries?.[agent.key]?.risk_score > 0 && (
                <div className="flow-score-badge">
                  {masterOutput.raw_context.agent_summaries[agent.key].risk_score}
                </div>
              )}
            </div>
            <div className="flow-bubble-label" style={{ color: contributingAgents.includes(agent.key) ? agent.color : 'var(--text-muted)' }}>
              {agent.label.split(' ')[0]}
            </div>
          </div>
        ))}

        <div className="flow-arrow">→</div>

        {/* Master AI */}
        <div className="flow-agent-bubble">
          <div className={`flow-bubble master ${detected ? 'contributing' : ''}`}>
            <span>🧠</span>
            {masterOutput?.risk_score > 0 && (
              <div className="flow-score-badge" style={{ borderColor: 'var(--risk-critical)', color: 'var(--risk-critical)', fontSize: 10 }}>
                {masterOutput.risk_score}
              </div>
            )}
          </div>
          <div className="flow-bubble-label" style={{ color: detected ? 'var(--risk-critical)' : 'var(--text-muted)' }}>
            Master AI
          </div>
        </div>

        {detected && (
          <>
            <div className="flow-arrow" style={{ color: 'var(--risk-critical)' }}>→</div>
            <div className="flow-agent-bubble">
              <div className="flow-bubble" style={{
                background: 'rgba(255,45,85,0.15)',
                borderColor: 'var(--risk-critical)',
                boxShadow: '0 0 20px rgba(255,45,85,0.3)',
                width: 80, height: 80
              }}>
                <span style={{ fontSize: 24 }}>🚨</span>
              </div>
              <div className="flow-bubble-label" style={{ color: 'var(--risk-critical)' }}>
                Compound Alert
              </div>
            </div>
          </>
        )}
      </div>

      {/* Compound scenario details */}
      {detected && (
        <div style={{
          background: 'rgba(255,45,85,0.06)', border: '1px solid rgba(255,45,85,0.2)',
          borderRadius: 'var(--radius-md)', padding: 14, marginTop: 16
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--risk-critical)', marginBottom: 8 }}>
            {masterOutput.compound_risk_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
            {masterOutput.explainability?.narrative}
          </div>
          {masterOutput.explainability?.regulatory_references?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {masterOutput.explainability.regulatory_references.map(ref => (
                <span key={ref} style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(167,139,250,0.1)', color: 'var(--accent-purple)',
                  border: '1px solid rgba(167,139,250,0.2)', fontWeight: 600
                }}>{ref}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RAG incidents */}
      {masterOutput?.similar_historical_incidents?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            📚 Similar Historical Incidents (RAG Retrieval)
          </div>
          {masterOutput.similar_historical_incidents.map(inc => (
            <div key={inc.incident_id} className="rag-incident">
              <div className="rag-incident-id">{inc.incident_id} · {inc.date} · Similarity: {(inc.similarity_score * 100).toFixed(0)}%</div>
              <div className="rag-incident-desc">{inc.description}</div>
              <div className="rag-incident-reg">📌 {inc.regulatory_reference}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentIntelligence({ masterOutput, agentHeartbeat }) {
  const [agentOutputs, setAgentOutputs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const outputs = {};
      for (const agent of ['scada', 'iot', 'vision', 'permit', 'master']) {
        try {
          const res = await agentsApi.getLastOutput(agent);
          outputs[agent] = res.data;
        } catch { outputs[agent] = null; }
      }
      setAgentOutputs(outputs);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [masterOutput]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Compound flow diagram — centrepiece */}
      <CompoundFlowDiagram masterOutput={masterOutput} agentHeartbeat={agentHeartbeat} />

      {/* 5 agent cards */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Individual Agent Outputs
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {AGENTS.map(agent => (
            <AgentCard key={agent.key}
              agent={agent.key}
              output={agentOutputs[agent.key]}
              status={agentHeartbeat?.[agent.key]?.status ?? 'UNKNOWN'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
