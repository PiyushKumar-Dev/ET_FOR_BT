/**
 * Mongoose Models — Industrial Guardian AI
 * [Technical Excellence] All schemas reflect real industrial data structures
 */

const mongoose = require('mongoose');

// ─── Alert ────────────────────────────────────────────────────────────────────
const AlertSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  timestamp: { type: Date, default: Date.now },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  zone_id: String,
  asset_id: String,
  compound_risk_id: String,
  compound_risk_name: String,
  risk_score: Number,
  confidence: Number,
  contributing_agents: [String],
  agent_findings_summary: mongoose.Schema.Types.Mixed,
  similar_historical_incidents: mongoose.Schema.Types.Mixed,
  recommendations: mongoose.Schema.Types.Mixed,
  explainability: mongoose.Schema.Types.Mixed,
  acknowledged: { type: Boolean, default: false },
  acknowledged_at: Date,
  suppressed: { type: Boolean, default: false },
  suppressed_reason: String,
  facility_id: { type: String, default: 'FAC-001' }
}, { timestamps: true });

// ─── Incident ─────────────────────────────────────────────────────────────────
const IncidentSchema = new mongoose.Schema({
  incident_id: { type: String, unique: true },
  date: String,
  zone: String,
  assets_involved: [String],
  category: String,
  severity: String,
  root_cause: String,
  contributing_factors: [String],
  resolution: String,
  regulatory_references: [String],
  outcome: String,
  days_lost: Number,
  investigation_completed: Boolean,
  corrective_actions_implemented: Boolean,
  facility_id: String,
  full_text: String
}, { timestamps: true });

// ─── AgentOutput ──────────────────────────────────────────────────────────────
const AgentOutputSchema = new mongoose.Schema({
  agent: String,
  timestamp: Date,
  facility_id: String,
  zone_id: String,
  asset_id: String,
  risk_score: Number,
  confidence: Number,
  severity: String,
  compound_risk_detected: Boolean,
  compound_risk_id: String,
  findings: mongoose.Schema.Types.Mixed,
  recommendations: mongoose.Schema.Types.Mixed,
  explainability: mongoose.Schema.Types.Mixed,
  raw_context: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// ─── Permit ───────────────────────────────────────────────────────────────────
const PermitSchema = new mongoose.Schema({
  permit_id: { type: String, unique: true },
  type: String,
  zone_id: String,
  asset_ids: [String],
  issued_by: String,
  valid_from: Date,
  valid_until: Date,
  status: String,
  risk_level: String,
  conditions: [String],
  work_description: String,
  personnel_authorized: [String],
  facility_id: String
}, { timestamps: true });

// ─── Zone ─────────────────────────────────────────────────────────────────────
const ZoneSchema = new mongoose.Schema({
  zone_id: { type: String, unique: true },
  name: String,
  area_sqm: Number,
  max_occupancy: Number,
  current_risk_score: { type: Number, default: 0 },
  current_status: { type: String, default: 'NORMAL' },
  lat_lng_bounds: mongoose.Schema.Types.Mixed,
  facility_id: String
}, { timestamps: true });

// ─── Asset ────────────────────────────────────────────────────────────────────
const AssetSchema = new mongoose.Schema({
  asset_id: { type: String, unique: true },
  zone_id: String,
  asset_type: String,
  name: String,
  equipment_status: { type: String, default: 'RUNNING' },
  health_score: { type: Number, default: 100 },
  risk_score: { type: Number, default: 0 },
  last_maintenance: Date,
  failure_history_count: Number,
  facility_id: String
}, { timestamps: true });

// ─── Sensor ───────────────────────────────────────────────────────────────────
const SensorSchema = new mongoose.Schema({
  sensor_id: { type: String, unique: true },
  asset_id: String,
  zone_id: String,
  type: String,
  unit: String,
  status: { type: String, default: 'ACTIVE' },
  last_calibration: Date,
  facility_id: String
}, { timestamps: true });

// ─── Personnel ────────────────────────────────────────────────────────────────
const PersonnelSchema = new mongoose.Schema({
  personnel_id: { type: String, unique: true },
  name: String,
  role: String,
  current_zone: String,
  shift_start: Date,
  shift_end: Date,
  certifications: [String],
  ppe_compliance_status: { type: String, default: 'COMPLIANT' },
  facility_id: String
}, { timestamps: true });

// ─── Telemetry ────────────────────────────────────────────────────────────────
const TelemetrySchema = new mongoose.Schema({
  sensor_id: String,
  asset_id: String,
  zone_id: String,
  timestamp: Date,
  readings: mongoose.Schema.Types.Mixed,
  facility_id: String
}, { timestamps: true });

// ─── Recommendation ───────────────────────────────────────────────────────────
const RecommendationSchema = new mongoose.Schema({
  recommendation_id: { type: String, unique: true },
  alert_id: String,
  priority: Number,
  action: String,
  rationale: String,
  estimated_risk_reduction: Number,
  time_to_act: String,
  status: { type: String, default: 'PENDING' },
  facility_id: String
}, { timestamps: true });

const Alert = mongoose.model('Alert', AlertSchema);
const Incident = mongoose.model('Incident', IncidentSchema);
const AgentOutput = mongoose.model('AgentOutput', AgentOutputSchema);
const Permit = mongoose.model('Permit', PermitSchema);
const Zone = mongoose.model('Zone', ZoneSchema);
const Asset = mongoose.model('Asset', AssetSchema);
const Sensor = mongoose.model('Sensor', SensorSchema);
const Personnel = mongoose.model('Personnel', PersonnelSchema);
const Telemetry = mongoose.model('Telemetry', TelemetrySchema);
const Recommendation = mongoose.model('Recommendation', RecommendationSchema);

module.exports = { 
  Alert, Incident, AgentOutput, Permit, Zone, Asset, 
  Sensor, Personnel, Telemetry, Recommendation 
};
