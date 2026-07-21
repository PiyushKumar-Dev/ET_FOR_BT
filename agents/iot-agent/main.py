"""
IoT Intelligence Agent — FastAPI + Simulation Engine + Compound Detection
Industrial Guardian AI — ET Hackathon 2026

[Innovation] Every /analyze call returns LIVE, evolving sensor data driven by
the Markov-chain FacilitySimulationEngine. Data is never static.
- Sensors drift continuously via Ornstein-Uhlenbeck process
- Emergency states trigger automatically every 2-6 minutes
- Compound flags (FIRE_RISK, GAS_LEAK etc.) emerge from multi-sensor correlation
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import sys, os, time, math, random
from datetime import datetime
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../data-generators'))
from facility_config import FACILITY_CONFIG
from simulation_engine import (
    FacilitySimulationEngine, FacilityState,
    create_iot_simulators, IOT_CRITICAL_THRESHOLDS,
    get_shift_factor, SensorValueSimulator
)

app = FastAPI(title="IoT Intelligence Agent", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

agent_start_time = datetime.utcnow()
analysis_count = 0

ZONE_IDS = [z["zone_id"] for z in FACILITY_CONFIG["zones"]]
ZONE_META = {z["zone_id"]: z for z in FACILITY_CONFIG["zones"]}

# ─── Per-Zone Sensor Simulators ───────────────────────────────────────────────
# Each zone has its own set of sensor simulators with small zone-specific offsets
zone_sensors: Dict[str, Dict] = {
    zone_id: create_iot_simulators()
    for zone_id in ZONE_IDS
}

# Apply small zone-specific baseline offsets to make zones feel different
_ZONE_OFFSETS = {
    "ZONE-01": {"gas_concentration": 1.2, "ambient_temperature": 2.0},
    "ZONE-02": {"gas_concentration": 2.5, "ambient_temperature": 4.0},   # Hotter zone
    "ZONE-03": {"gas_concentration": 0.8, "ambient_temperature": 1.5},
    "ZONE-04": {"gas_concentration": 0.5, "ambient_temperature": -1.0},  # Cooler storage
    "ZONE-05": {"gas_concentration": 0.1, "ambient_temperature": -3.0},  # Control room AC
    "ZONE-06": {"gas_concentration": 1.8, "ambient_temperature": 3.0},
}
for z_id, offsets in _ZONE_OFFSETS.items():
    if z_id in zone_sensors:
        for sensor_name, offset in offsets.items():
            if sensor_name in zone_sensors[z_id]:
                sim = zone_sensors[z_id][sensor_name]
                sim.baseline = max(sim.min_val, sim.baseline + offset)
                sim.force(sim.baseline)

# ─── Simulation Engine ────────────────────────────────────────────────────────
def _on_state_change(zone_id: str, old_state, new_state):
    print(f"[IoT-Agent] {zone_id}: {old_state.value} → {new_state.value}")

def _on_emergency(scenario: Dict, duration: float):
    print(f"[IoT-Agent] 🚨 EMERGENCY: {scenario['name']} ({duration:.0f}s) zones={scenario['zones']}")

sim_engine = FacilitySimulationEngine(
    zone_ids=ZONE_IDS,
    on_state_change=_on_state_change,
    on_emergency=_on_emergency,
    tick_interval=4.0
)
sim_engine.start()

# ─── Compound Detection Rules ─────────────────────────────────────────────────

def compute_compound_flags(readings: Dict, zone_id: str) -> List[Dict]:
    """[Innovation] Multi-sensor correlation → compound hazard flags."""
    flags = []

    gas  = readings.get("gas_concentration", 0)
    temp = readings.get("ambient_temperature", 30)
    smoke= readings.get("smoke_density", 0)
    vent = readings.get("ventilation_flow", 2.0)
    co   = readings.get("co_level", 0)
    aqi  = readings.get("air_quality_index", 30)
    noise= readings.get("noise_level", 60)

    # FIRE_RISK: high temp + smoke OR high temp + gas + low ventilation
    if (temp > 45 and smoke > 0.25) or (temp > 50 and gas > 8 and vent < 0.8):
        severity = min(1.0, ((temp - 40) / 20 + smoke / 0.5 + gas / 15) / 3)
        flags.append({
            "flag": "FIRE_RISK",
            "severity": round(severity, 3),
            "description": f"Fire preconditions: temp={temp:.1f}°C, smoke={smoke:.3f}, gas={gas:.1f}ppm",
            "contributing_sensors": ["ambient_temperature", "smoke_density", "gas_concentration"]
        })

    # GAS_LEAK: elevated gas + low ventilation
    if gas > 12 and vent < 1.0:
        severity = min(1.0, gas / 25 + (1.0 - vent) / 2)
        flags.append({
            "flag": "GAS_LEAK",
            "severity": round(severity, 3),
            "description": f"Gas leak signature: {gas:.1f}ppm with ventilation {vent:.2f}m/s",
            "contributing_sensors": ["gas_concentration", "ventilation_flow"]
        })

    # AIR_QUALITY_DEGRADATION: high AQI + CO
    if aqi > 80 or co > 35:
        severity = min(1.0, max(aqi / 200, co / 80))
        flags.append({
            "flag": "AIR_QUALITY_DEGRADATION",
            "severity": round(severity, 3),
            "description": f"Air quality degraded: AQI={aqi:.0f}, CO={co:.1f}ppm",
            "contributing_sensors": ["air_quality_index", "co_level"]
        })

    # GAS_ACCUMULATION: gas rising over threshold without leak speed
    if 8 < gas <= 20 and vent < 1.5:
        flags.append({
            "flag": "GAS_ACCUMULATION",
            "severity": round(gas / 20, 3),
            "description": f"Gas accumulation in enclosed area: {gas:.1f}ppm",
            "contributing_sensors": ["gas_concentration", "ventilation_flow"]
        })

    # THERMAL_RUNAWAY: temperature rising fast
    if temp > 50 and smoke > 0.1:
        flags.append({
            "flag": "THERMAL_RUNAWAY_RISK",
            "severity": round(min(1.0, (temp - 45) / 20), 3),
            "description": f"Thermal runaway precursor: {temp:.1f}°C",
            "contributing_sensors": ["ambient_temperature", "smoke_density"]
        })

    # NOISE_OVEREXPOSURE: high noise
    if noise > 85:
        severity = min(1.0, (noise - 85) / 30)
        flags.append({
            "flag": "NOISE_OVEREXPOSURE",
            "severity": round(severity, 3),
            "description": f"Hazardous noise level: {noise:.1f} dB",
            "contributing_sensors": ["noise_level"]
        })

    # FIRE_OR_COMBUSTION: very high temp + high smoke
    if temp > 60 and smoke > 0.4:
        severity = min(1.0, ((temp - 60) / 40 + smoke / 0.8) / 2)
        flags.append({
            "flag": "FIRE_OR_COMBUSTION",
            "severity": round(severity, 3),
            "description": f"Active fire/combustion: temp={temp:.1f}°C, smoke={smoke:.3f}",
            "contributing_sensors": ["ambient_temperature", "smoke_density"]
        })

    return flags


def get_hazard_classification(readings: Dict, compound_flags: List[Dict]) -> str:
    """Determine zone-level hazard classification."""
    flag_types = [f["flag"] for f in compound_flags]
    gas = readings.get("gas_concentration", 0)
    temp = readings.get("ambient_temperature", 30)

    if "FIRE_OR_COMBUSTION" in flag_types:
        return "FIRE_OR_COMBUSTION"
    elif "FIRE_RISK" in flag_types and "GAS_LEAK" in flag_types:
        return "EXPLOSIVE_ATMOSPHERE"
    elif "FIRE_RISK" in flag_types:
        return "FIRE_RISK"
    elif "GAS_LEAK" in flag_types:
        return "GAS_LEAK"
    elif "GAS_ACCUMULATION" in flag_types:
        return "GAS_ACCUMULATION"
    elif "AIR_QUALITY_DEGRADATION" in flag_types:
        return "AIR_QUALITY_DEGRADATION"
    elif "NOISE_OVEREXPOSURE" in flag_types:
        return "NOISE_OVEREXPOSURE"
    elif gas > 8 or temp > 45:
        return "ELEVATED_RISK"
    return "NORMAL"


def build_zone_output(zone_id: str) -> Dict:
    """Build full IoT agent output for a zone using live simulator values."""
    global analysis_count
    analysis_count += 1

    zone_state = sim_engine.get_zone_state(zone_id)
    zone_drift = sim_engine.get_zone_drift(zone_id)
    shift_factor = get_shift_factor()

    # Determine drift direction from state
    drift_dir = zone_drift if zone_state != FacilityState.RESOLVING else -0.3

    # Step all sensors forward
    sensors = zone_sensors[zone_id]
    readings = {}
    for sensor_name, sim in sensors.items():
        val = sim.step(zone_state, zone_multiplier=shift_factor, drift_direction=drift_dir, dt=4.0)
        readings[sensor_name] = val

    # Special handling for CRITICAL state — ensure readings look alarming
    if zone_state == FacilityState.CRITICAL:
        # Gas spikes to > 15ppm in critical zones
        if readings["gas_concentration"] < 12:
            sensors["gas_concentration"].force(random.uniform(14, 28))
            readings["gas_concentration"] = sensors["gas_concentration"].get()
        # Temp spikes
        if readings["ambient_temperature"] < 42:
            sensors["ambient_temperature"].force(random.uniform(45, 60))
            readings["ambient_temperature"] = sensors["ambient_temperature"].get()
        # Smoke rises
        if readings["smoke_density"] < 0.2:
            sensors["smoke_density"].force(random.uniform(0.25, 0.55))
            readings["smoke_density"] = sensors["smoke_density"].get()
        # Ventilation drops
        if readings["ventilation_flow"] > 0.8:
            sensors["ventilation_flow"].force(random.uniform(0.1, 0.6))
            readings["ventilation_flow"] = sensors["ventilation_flow"].get()

    # Compound flags
    compound_flags = compute_compound_flags(readings, zone_id)
    hazard = get_hazard_classification(readings, compound_flags)

    # Findings from threshold crossings
    findings = []
    for sensor_name, value in readings.items():
        thresholds = IOT_CRITICAL_THRESHOLDS.get(sensor_name)
        if not thresholds:
            continue
        critical_t = thresholds.get("critical")
        warning_t = thresholds.get("warning")

        # For ventilation: low is bad (invert logic)
        is_low_bad = sensor_name == "ventilation_flow"

        if is_low_bad:
            if critical_t and value <= critical_t:
                findings.append({
                    "type": "violation",
                    "parameter": sensor_name,
                    "current_value": value,
                    "threshold": critical_t,
                    "unit": "m/s",
                    "deviation_percent": round((critical_t - value) / critical_t * 100, 1),
                    "trend": "FALLING",
                    "description": f"Critically low ventilation in {zone_id}: {value:.2f} m/s"
                })
            elif warning_t and value <= warning_t:
                findings.append({
                    "type": "anomaly",
                    "parameter": sensor_name,
                    "current_value": value,
                    "threshold": warning_t,
                    "unit": "m/s",
                    "deviation_percent": round((warning_t - value) / warning_t * 100, 1),
                    "trend": "FALLING",
                    "description": f"Low ventilation in {zone_id}: {value:.2f} m/s"
                })
        else:
            if critical_t and value >= critical_t:
                findings.append({
                    "type": "violation",
                    "parameter": sensor_name,
                    "current_value": value,
                    "threshold": critical_t,
                    "unit": _get_unit(sensor_name),
                    "deviation_percent": round((value - critical_t) / critical_t * 100, 1),
                    "trend": "RISING",
                    "description": f"CRITICAL {sensor_name} in {zone_id}: {value}"
                })
            elif warning_t and value >= warning_t:
                findings.append({
                    "type": "anomaly",
                    "parameter": sensor_name,
                    "current_value": value,
                    "threshold": warning_t,
                    "unit": _get_unit(sensor_name),
                    "deviation_percent": round((value - warning_t) / warning_t * 100, 1),
                    "trend": "RISING",
                    "description": f"Elevated {sensor_name} in {zone_id}: {value}"
                })

    # Risk score — weighted from state + flags + findings
    state_base_risk = {
        FacilityState.NORMAL:    random.uniform(2, 12),
        FacilityState.DEGRADING: random.uniform(18, 35),
        FacilityState.WARNING:   random.uniform(35, 55),
        FacilityState.CRITICAL:  random.uniform(62, 88),
        FacilityState.RESOLVING: random.uniform(15, 30),
    }[zone_state]

    flag_bonus = sum(f["severity"] * 20 for f in compound_flags)
    risk_score = int(min(92, max(2, state_base_risk + flag_bonus)))

    # Severity from risk score
    if risk_score >= 70:
        severity = "CRITICAL"
    elif risk_score >= 45:
        severity = "HIGH"
    elif risk_score >= 20:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    confidence = round(0.72 + len(findings) * 0.04 + len(compound_flags) * 0.06, 3)
    confidence = min(0.97, confidence)

    return {
        "agent": "iot",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "facility_id": FACILITY_CONFIG["facility_id"],
        "zone_id": zone_id,
        "asset_id": None,
        "risk_score": risk_score,
        "confidence": confidence,
        "severity": severity,
        "hazard_classification": hazard,
        "facility_state": zone_state.value,
        "findings": findings[:6],
        "recommendations": _build_recommendations(findings, compound_flags, zone_id),
        "raw_context": {
            "sensor_readings": readings,
            "compound_flags": compound_flags,
            "shift_factor": shift_factor,
            "zone_state": zone_state.value
        },
        "explainability": {
            "method": "rule_engine_OU",
            "feature_contributions": {
                s: round(abs(v - zone_sensors[zone_id][s].baseline) /
                         max(1, zone_sensors[zone_id][s].baseline), 3)
                for s, v in readings.items()
            },
            "narrative": _build_narrative(zone_id, zone_state, readings, compound_flags, hazard)
        }
    }


def _get_unit(sensor_name: str) -> str:
    units = {
        "gas_concentration": "ppm",
        "ambient_temperature": "°C",
        "smoke_density": "OD/m",
        "air_quality_index": "AQI",
        "co_level": "ppm",
        "ventilation_flow": "m/s",
        "humidity": "%RH",
        "noise_level": "dB",
        "vibration_level": "mm/s"
    }
    return units.get(sensor_name, "units")


def _build_narrative(zone_id, state, readings, flags, hazard):
    gas  = readings.get("gas_concentration", 0)
    temp = readings.get("ambient_temperature", 30)
    vent = readings.get("ventilation_flow", 2.0)
    co   = readings.get("co_level", 0)

    state_desc = {
        FacilityState.NORMAL:    "operating within normal parameters",
        FacilityState.DEGRADING: "showing early signs of degradation",
        FacilityState.WARNING:   "approaching hazardous thresholds",
        FacilityState.CRITICAL:  "in CRITICAL condition — immediate action required",
        FacilityState.RESOLVING: "recovering from elevated state"
    }[state]

    narrative = f"Zone {zone_id} IoT sensors are {state_desc}. "

    if gas > 8:
        narrative += f"Gas concentration is elevated at {gas:.1f} ppm ({gas/10:.1f}× safe limit). "
    if temp > 45:
        narrative += f"Ambient temperature is {temp:.1f}°C (threshold: 45°C). "
    if vent < 1.0:
        narrative += f"Ventilation flow critically low at {vent:.2f} m/s. "
    if co > 30:
        narrative += f"CO level at {co:.1f} ppm requires attention. "

    if flags:
        flag_names = [f["flag"].replace("_", " ").title() for f in flags[:2]]
        narrative += f"Compound risk flags raised: {', '.join(flag_names)}."

    return narrative


def _build_recommendations(findings, flags, zone_id):
    recs = []
    if any(f["flag"] == "GAS_LEAK" for f in flags):
        recs.append({
            "priority": 1,
            "action": f"Isolate gas sources in {zone_id} and verify area is clear of personnel",
            "rationale": "Gas leak detected — explosion risk if ignition sources present",
            "estimated_risk_reduction": 0.55,
            "time_to_act": "< 5 minutes"
        })
    if any(f["flag"] == "FIRE_OR_COMBUSTION" for f in flags):
        recs.append({
            "priority": 1,
            "action": f"Evacuate {zone_id} and dispatch emergency services immediately",
            "rationale": "Active fire or combustion detected",
            "estimated_risk_reduction": 0.90,
            "time_to_act": "IMMEDIATE"
        })
    elif any(f["flag"] == "FIRE_RISK" for f in flags):
        recs.append({
            "priority": 1 if not recs else 2,
            "action": f"Activate fire suppression and evacuate {zone_id}",
            "rationale": "Fire risk conditions — high temperature + smoke",
            "estimated_risk_reduction": 0.60,
            "time_to_act": "IMMEDIATE"
        })
    if any(f["flag"] == "NOISE_OVEREXPOSURE" for f in flags):
        recs.append({
            "priority": len(recs) + 1,
            "action": f"Mandate hearing protection in {zone_id}",
            "rationale": "Hazardous noise levels detected",
            "estimated_risk_reduction": 0.20,
            "time_to_act": "< 1 hour"
        })
    if any(f.get("parameter") == "ventilation_flow" for f in findings):
        recs.append({
            "priority": len(recs) + 1,
            "action": "Restore ventilation in zone before entry",
            "rationale": "Insufficient ventilation — confined space risk",
            "estimated_risk_reduction": 0.35,
            "time_to_act": "< 15 minutes"
        })
    return recs


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy", "agent": "iot",
        "active_emergency": sim_engine.get_active_emergency(),
        "zones": {z: sim_engine.get_zone_state(z).value for z in ZONE_IDS}
    }

@app.get("/status")
async def status():
    return {
        "agent": "iot", "status": "ACTIVE",
        "analysis_count": analysis_count,
        "simulation_tick": sim_engine.tick,
        "zone_states": {z: sim_engine.get_zone_state(z).value for z in ZONE_IDS},
        "active_emergency": sim_engine.get_active_emergency()
    }

class AnalyzeRequest(BaseModel):
    zone_id: Optional[str] = None

@app.post("/analyze")
async def analyze(request: AnalyzeRequest = AnalyzeRequest()):
    start = time.time()
    zones = [request.zone_id] if request.zone_id else ZONE_IDS
    results = [build_zone_output(z) for z in zones]
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    highest = results[0] if results else None
    return {
        "agent": "iot",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "facility_id": FACILITY_CONFIG["facility_id"],
        "zones_analyzed": len(results),
        "processing_ms": round((time.time() - start) * 1000, 1),
        "results": results,
        "highest_risk_zone": highest,
        "active_emergency": sim_engine.get_active_emergency()
    }

@app.post("/predict")
async def predict(request: AnalyzeRequest = AnalyzeRequest()):
    return await analyze(request)

class InjectRequest(BaseModel):
    zone_id: str
    sensors: List[str] = []
    anomaly_type: str = "gradual_drift"
    severity: float = 0.8
    duration_minutes: int = 15

@app.post("/inject-anomaly")
async def inject_anomaly(request: InjectRequest):
    sim_engine.inject_anomaly(request.zone_id, {
        "sensors": request.sensors,
        "anomaly_type": request.anomaly_type,
        "severity": request.severity,
        "duration_seconds": request.duration_minutes * 60
    })
    return {"injected": request.zone_id, "severity": request.severity}

@app.post("/clear-anomalies")
async def clear_anomalies():
    sim_engine.clear_anomaly()
    return {"cleared": "all"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("IOT_AGENT_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
