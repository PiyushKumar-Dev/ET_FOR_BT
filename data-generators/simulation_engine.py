"""
Realistic Simulation Engine — Industrial Guardian AI
ET Hackathon 2026

[Innovation] Markov-chain driven state machine that produces:
- Continuously drifting sensor readings (never static)
- Realistic shift patterns (morning calm → afternoon busy → night reduced)
- Automatic emergency escalation every 3-8 minutes (random)
- Multi-stage incident evolution: NORMAL → DEGRADING → WARNING → CRITICAL → RESOLVING
- Correlated anomalies — gas rises BEFORE hot work conflict is detected

This runs as a background thread inside each agent.
"""

import time
import math
import random
import threading
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable, List
from enum import Enum


class FacilityState(Enum):
    NORMAL    = "NORMAL"
    DEGRADING = "DEGRADING"
    WARNING   = "WARNING"
    CRITICAL  = "CRITICAL"
    RESOLVING = "RESOLVING"


# ─── State Transition Probabilities ──────────────────────────────────────────
# Each state has {next_state: probability, stay_probability: ...}
STATE_TRANSITIONS = {
    FacilityState.NORMAL: {
        FacilityState.NORMAL:    0.92,
        FacilityState.DEGRADING: 0.08,
    },
    FacilityState.DEGRADING: {
        FacilityState.NORMAL:    0.20,
        FacilityState.DEGRADING: 0.50,
        FacilityState.WARNING:   0.30,
    },
    FacilityState.WARNING: {
        FacilityState.DEGRADING: 0.15,
        FacilityState.WARNING:   0.45,
        FacilityState.CRITICAL:  0.40,
    },
    FacilityState.CRITICAL: {
        FacilityState.CRITICAL:  0.60,
        FacilityState.RESOLVING: 0.40,
    },
    FacilityState.RESOLVING: {
        FacilityState.RESOLVING: 0.35,
        FacilityState.WARNING:   0.25,
        FacilityState.NORMAL:    0.40,
    }
}

# How long each state persists before a transition check (seconds)
STATE_DURATIONS = {
    FacilityState.NORMAL:    (60, 180),    # 1-3 minutes normal
    FacilityState.DEGRADING: (30, 90),     # 30-90s degrading
    FacilityState.WARNING:   (20, 60),     # 20-60s warning
    FacilityState.CRITICAL:  (30, 120),    # 30-120s critical
    FacilityState.RESOLVING: (30, 90),     # 30-90s resolving
}

# Compound scenario IDs mapped to zone and agents
EMERGENCY_SCENARIOS = [
    {
        "id": "CR-001",
        "name": "Explosion Precursor",
        "probability": 0.35,    # Most dramatic — show often
        "zones": ["ZONE-02"],
        "severity": "CRITICAL",
        "duration_seconds": (120, 240)
    },
    {
        "id": "CR-002",
        "name": "Confined Space Fatality Risk",
        "probability": 0.25,
        "zones": ["ZONE-04"],
        "severity": "CRITICAL",
        "duration_seconds": (90, 180)
    },
    {
        "id": "CR-003",
        "name": "Equipment Cascade Failure",
        "probability": 0.20,
        "zones": ["ZONE-01"],
        "severity": "HIGH",
        "duration_seconds": (120, 300)
    },
    {
        "id": "CR-006",
        "name": "Fire Triangle Formation",
        "probability": 0.10,
        "zones": ["ZONE-02", "ZONE-03"],
        "severity": "CRITICAL",
        "duration_seconds": (60, 120)
    },
    {
        "id": "CR-004",
        "name": "PPE Non-Compliance",
        "probability": 0.10,
        "zones": ["ZONE-01", "ZONE-06"],
        "severity": "HIGH",
        "duration_seconds": (90, 180)
    }
]


class SensorValueSimulator:
    """
    Produces realistic, continuously-evolving sensor readings.
    Uses Ornstein-Uhlenbeck mean-reversion + time-of-day patterns + state modifiers.
    """

    def __init__(self, baseline: float, min_val: float, max_val: float,
                 noise_std: float = 0.02, reversion_speed: float = 0.1):
        self.baseline = baseline
        self.min_val = min_val
        self.max_val = max_val
        self.noise_std = noise_std
        self.reversion_speed = reversion_speed
        self.current = baseline + random.gauss(0, noise_std * baseline)
        self._lock = threading.Lock()

    def step(self, state: FacilityState, zone_multiplier: float = 1.0,
             drift_direction: float = 0.0, dt: float = 5.0) -> float:
        """
        Advance by dt seconds.
        state: current facility state affects deviation magnitude
        drift_direction: +1 = rising anomaly, -1 = falling
        """
        state_multipliers = {
            FacilityState.NORMAL:    1.0,
            FacilityState.DEGRADING: 1.3,
            FacilityState.WARNING:   1.8,
            FacilityState.CRITICAL:  2.5,
            FacilityState.RESOLVING: 1.2,
        }
        mult = state_multipliers.get(state, 1.0) * zone_multiplier

        # Ornstein-Uhlenbeck mean reversion
        target = self.baseline + drift_direction * (self.max_val - self.baseline) * 0.6
        mean_reversion = self.reversion_speed * (target - self.current) * dt
        noise = random.gauss(0, self.noise_std * self.baseline * mult * math.sqrt(dt))

        with self._lock:
            self.current = max(self.min_val, min(self.max_val, self.current + mean_reversion + noise))
            return round(self.current, 3)

    def get(self) -> float:
        with self._lock:
            return round(self.current, 3)

    def force(self, value: float):
        with self._lock:
            self.current = max(self.min_val, min(self.max_val, value))


def get_shift_factor() -> float:
    """
    Morning (6-14): 1.0 — normal operations
    Afternoon (14-22): 1.15 — peak activity
    Night (22-6): 0.75 — reduced personnel
    Shift handover (5:45-6:15, 13:45-14:15, 21:45-22:15): 1.25 — high risk window
    """
    hour = datetime.now().hour
    minute = datetime.now().minute
    time_of_day = hour + minute / 60

    # Shift handover windows: +25% risk
    handover_windows = [(5.75, 6.25), (13.75, 14.25), (21.75, 22.25)]
    for start, end in handover_windows:
        if start <= time_of_day <= end:
            return 1.25

    if 6 <= time_of_day < 14:
        return 1.0
    elif 14 <= time_of_day < 22:
        return 1.15
    else:
        return 0.75


class AssetState(Enum):
    RUNNING = "RUNNING"
    IDLE = "IDLE"
    MAINTENANCE = "MAINTENANCE"
    FAULT = "FAULT"

DOWNSTREAM_MAP = {
    "ASSET-001": ["ASSET-002", "ASSET-003"],
    "ASSET-007": ["ASSET-008"],
    "ASSET-015": ["ASSET-016", "ASSET-017"]
}

class FacilitySimulationEngine:
    """
    Master simulation engine — drives all sensor states with realistic time evolution.
    Run as a singleton background thread inside each agent.
    """

    def __init__(self,
                 zone_ids: List[str],
                 on_state_change: Optional[Callable] = None,
                 on_emergency: Optional[Callable] = None,
                 tick_interval: float = 5.0):
        self.zone_ids = zone_ids
        self.on_state_change = on_state_change
        self.on_emergency = on_emergency
        self.tick_interval = tick_interval

        # Zone-level states
        self.zone_states: Dict[str, FacilityState] = {z: FacilityState.NORMAL for z in zone_ids}
        self.zone_state_duration: Dict[str, float] = {z: random.uniform(30, 120) for z in zone_ids}
        self.zone_state_timer: Dict[str, float] = {z: 0.0 for z in zone_ids}
        self.zone_drift: Dict[str, float] = {z: 0.0 for z in zone_ids}  # -1 to +1

        # Asset-level states
        self.asset_states: Dict[str, AssetState] = {}
        self.injected_asset_anomalies: Dict[str, Dict] = {}

        # Active emergency
        self.active_emergency: Optional[Dict] = None
        self.emergency_end_time: Optional[float] = None

        # Next emergency scheduled
        self._next_emergency_in = random.uniform(90, 240)  # first emergency in 1.5-4 min
        self._time_since_last_emergency = 0.0

        # Anomaly injection overrides (from demo triggers)
        self.injected_anomalies: Dict[str, Dict] = {}

        # Global tick counter
        self.tick = 0
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="SimEngine")
        self._thread.start()

    def stop(self):
        self._running = False

    def inject_asset_anomaly(self, asset_id: str, anomaly_type: str, severity: float, duration_minutes: int):
        """API to inject 4 modes of anomalies at the asset level."""
        with self._lock:
            self.injected_asset_anomalies[asset_id] = {
                "type": anomaly_type, # gradual_drift, sudden_spike, oscillation, stuck_sensor
                "severity": severity,
                "expires_at": time.time() + duration_minutes * 60
            }
            # Cross-asset correlation: Propagate to downstream assets
            downstream = DOWNSTREAM_MAP.get(asset_id, [])
            for ds_asset in downstream:
                self.injected_asset_anomalies[ds_asset] = {
                    "type": "gradual_drift",
                    "severity": severity * 0.6,  # Diminished effect downstream
                    "expires_at": time.time() + duration_minutes * 60
                }

    def inject_anomaly(self, zone_id: str, anomaly: Dict):
        """External injection (from demo trigger or API)."""
        with self._lock:
            self.injected_anomalies[zone_id] = {
                **anomaly,
                "expires_at": time.time() + anomaly.get("duration_seconds", 300)
            }
            # Force state to match severity
            severity = anomaly.get("severity", 0.5)
            if severity >= 0.8:
                self.zone_states[zone_id] = FacilityState.CRITICAL
            elif severity >= 0.5:
                self.zone_states[zone_id] = FacilityState.WARNING
            self.zone_drift[zone_id] = severity

    def clear_anomaly(self, zone_id: Optional[str] = None):
        with self._lock:
            if zone_id:
                self.injected_anomalies.pop(zone_id, None)
                self.zone_states[zone_id] = FacilityState.NORMAL
                self.zone_drift[zone_id] = 0.0
            else:
                self.injected_anomalies.clear()
                self.injected_asset_anomalies.clear()
                for z in self.zone_ids:
                    self.zone_states[z] = FacilityState.NORMAL
                    self.zone_drift[z] = 0.0
                self.active_emergency = None
                self.emergency_end_time = None

    def get_zone_state(self, zone_id: str) -> FacilityState:
        with self._lock:
            return self.zone_states.get(zone_id, FacilityState.NORMAL)

    def get_zone_drift(self, zone_id: str) -> float:
        with self._lock:
            return self.zone_drift.get(zone_id, 0.0)

    def get_active_emergency(self) -> Optional[Dict]:
        with self._lock:
            return self.active_emergency

    def _transition_zone_state(self, zone_id: str):
        """Markov chain state transition for a zone."""
        current = self.zone_states[zone_id]
        transitions = STATE_TRANSITIONS[current]

        rand = random.random()
        cumulative = 0.0
        for next_state, prob in transitions.items():
            cumulative += prob
            if rand <= cumulative:
                new_state = next_state
                break
        else:
            new_state = current

        if new_state != current:
            self.zone_states[zone_id] = new_state
            # Adjust drift
            drift_map = {
                FacilityState.NORMAL:    0.0,
                FacilityState.DEGRADING: random.uniform(0.2, 0.4),
                FacilityState.WARNING:   random.uniform(0.5, 0.7),
                FacilityState.CRITICAL:  random.uniform(0.75, 0.95),
                FacilityState.RESOLVING: random.uniform(0.1, 0.3),
            }
            self.zone_drift[zone_id] = drift_map[new_state]

            # Reset timer
            lo, hi = STATE_DURATIONS[new_state]
            self.zone_state_duration[zone_id] = random.uniform(lo, hi)
            self.zone_state_timer[zone_id] = 0.0

            if self.on_state_change:
                self.on_state_change(zone_id, current, new_state)

    def _select_emergency(self) -> Dict:
        """Choose an emergency scenario based on weighted probabilities."""
        weights = [s["probability"] for s in EMERGENCY_SCENARIOS]
        total = sum(weights)
        rand = random.random() * total
        cumulative = 0.0
        for scenario in EMERGENCY_SCENARIOS:
            cumulative += scenario["probability"]
            if rand <= cumulative:
                return scenario
        return EMERGENCY_SCENARIOS[0]

    def _start_emergency(self):
        """Trigger a random emergency scenario."""
        scenario = self._select_emergency()
        duration = random.uniform(*scenario["duration_seconds"])

        with self._lock:
            self.active_emergency = {
                **scenario,
                "started_at": datetime.utcnow().isoformat() + "Z",
                "ends_at": (datetime.utcnow() + timedelta(seconds=duration)).isoformat() + "Z"
            }
            self.emergency_end_time = time.time() + duration

            # Force affected zones to CRITICAL/WARNING
            for zone_id in scenario["zones"]:
                if zone_id in self.zone_ids:
                    if scenario["severity"] == "CRITICAL":
                        self.zone_states[zone_id] = FacilityState.CRITICAL
                        self.zone_drift[zone_id] = random.uniform(0.8, 1.0)
                    else:
                        self.zone_states[zone_id] = FacilityState.WARNING
                        self.zone_drift[zone_id] = random.uniform(0.55, 0.75)

        if self.on_emergency:
            self.on_emergency(scenario, duration)

    def _run_loop(self):
        """Main simulation tick loop."""
        while self._running:
            try:
                self._tick()
            except Exception as e:
                print(f"[SimEngine] Tick error: {e}")
            time.sleep(self.tick_interval)

    def _tick(self):
        dt = self.tick_interval
        self.tick += 1
        now = time.time()
        shift_factor = get_shift_factor()

        # ── Emergency lifecycle ────────────────────────────────────────────
        with self._lock:
            # Check if active emergency has expired → start resolving
            if self.active_emergency and self.emergency_end_time:
                if now >= self.emergency_end_time:
                    for zone_id in self.active_emergency.get("zones", []):
                        if zone_id in self.zone_ids:
                            self.zone_states[zone_id] = FacilityState.RESOLVING
                            self.zone_drift[zone_id] = 0.2
                    self.active_emergency = None
                    self.emergency_end_time = None
                    # Schedule next emergency
                    self._next_emergency_in = random.uniform(120, 360)
                    self._time_since_last_emergency = 0.0

            # Check if injected anomalies have expired
            expired = [z for z, a in self.injected_anomalies.items()
                       if now >= a.get("expires_at", 0)]
            for z in expired:
                del self.injected_anomalies[z]
                self.zone_states[z] = FacilityState.RESOLVING
                self.zone_drift[z] = 0.15

        # ── Emergency trigger check ────────────────────────────────────────
        self._time_since_last_emergency += dt
        if (self._time_since_last_emergency >= self._next_emergency_in
                and not self.active_emergency
                and not self.injected_anomalies):
            # Extra probability boost during shift handover or peak hours
            trigger_prob = 0.9 if shift_factor >= 1.15 else 0.75
            if random.random() < trigger_prob:
                self._start_emergency()

        # ── Zone state machine ticks ───────────────────────────────────────
        for zone_id in self.zone_ids:
            with self._lock:
                # Skip zones under active emergency control
                in_emergency = (self.active_emergency and
                                zone_id in self.active_emergency.get("zones", []))
                in_injection = zone_id in self.injected_anomalies

            if in_emergency or in_injection:
                continue

            with self._lock:
                self.zone_state_timer[zone_id] += dt
                if self.zone_state_timer[zone_id] >= self.zone_state_duration[zone_id]:
                    self._transition_zone_state(zone_id)

        # ── Gradual drift in non-critical zones (realistic background noise) ─
        with self._lock:
            for zone_id in self.zone_ids:
                state = self.zone_states[zone_id]
                if state == FacilityState.NORMAL:
                    # Small random walk in drift
                    drift = self.zone_drift[zone_id]
                    drift += random.gauss(0, 0.02)
                    self.zone_drift[zone_id] = max(-0.1, min(0.15, drift))


# ─── Sensor Config Templates ──────────────────────────────────────────────────
# Used by agents to create SensorValueSimulator instances per asset/sensor

SCADA_SENSOR_CONFIGS = {
    "ROTATING": {
        "temperature":    {"baseline": 75.0,  "min": 45.0,  "max": 180.0, "noise": 0.015},
        "vibration":      {"baseline": 2.1,   "min": 0.5,   "max": 12.0,  "noise": 0.04},
        "pressure":       {"baseline": 4.5,   "min": 1.0,   "max": 10.0,  "noise": 0.02},
        "current_draw":   {"baseline": 42.0,  "min": 20.0,  "max": 95.0,  "noise": 0.02},
        "rpm":            {"baseline": 1480.0,"min": 0.0,   "max": 1600.0,"noise": 0.01},
    },
    "STATIC": {
        "pressure":       {"baseline": 6.2,   "min": 0.5,   "max": 15.0,  "noise": 0.018},
        "temperature":    {"baseline": 55.0,  "min": 20.0,  "max": 140.0, "noise": 0.012},
        "flow_rate":      {"baseline": 125.0, "min": 0.0,   "max": 250.0, "noise": 0.025},
        "level":          {"baseline": 68.0,  "min": 10.0,  "max": 95.0,  "noise": 0.01},
    },
    "ELECTRICAL": {
        "voltage":        {"baseline": 415.0, "min": 380.0, "max": 450.0, "noise": 0.005},
        "current_draw":   {"baseline": 38.0,  "min": 5.0,   "max": 80.0,  "noise": 0.02},
        "power_factor":   {"baseline": 0.92,  "min": 0.7,   "max": 1.0,   "noise": 0.008},
        "temperature":    {"baseline": 42.0,  "min": 20.0,  "max": 85.0,  "noise": 0.015},
        "insulation_resistance": {"baseline": 500.0, "min": 50.0, "max": 1000.0, "noise": 0.02},
    },
    "ENVIRONMENTAL": {
        "ambient_temperature": {"baseline": 32.0, "min": 18.0, "max": 55.0, "noise": 0.01},
        "humidity":            {"baseline": 58.0, "min": 20.0, "max": 95.0, "noise": 0.02},
        "noise_level":         {"baseline": 72.0, "min": 40.0, "max": 110.0,"noise": 0.03},
    }
}

IOT_SENSOR_CONFIGS = {
    "gas_concentration":    {"baseline": 3.5,  "min": 0.0,  "max": 50.0,  "noise": 0.08},
    "ambient_temperature":  {"baseline": 32.0, "min": 15.0, "max": 65.0,  "noise": 0.02},
    "humidity":             {"baseline": 58.0, "min": 20.0, "max": 98.0,  "noise": 0.03},
    "air_quality_index":    {"baseline": 45.0, "min": 0.0,  "max": 300.0, "noise": 0.04},
    "smoke_density":        {"baseline": 0.02, "min": 0.0,  "max": 1.0,   "noise": 0.05},
    "ventilation_flow":     {"baseline": 1.8,  "min": 0.0,  "max": 5.0,   "noise": 0.03},
    "co_level":             {"baseline": 8.0,  "min": 0.0,  "max": 200.0, "noise": 0.06},
    "noise_level":          {"baseline": 68.0, "min": 35.0, "max": 130.0, "noise": 0.04},
    "uv_index":             {"baseline": 3.2,  "min": 0.0,  "max": 11.0,  "noise": 0.03},
    "vibration_level":      {"baseline": 1.8,  "min": 0.0,  "max": 10.0,  "noise": 0.05},
}

# Sensor criticality thresholds for compound flagging
IOT_CRITICAL_THRESHOLDS = {
    "gas_concentration":    {"warning": 10.0,  "critical": 20.0},
    "ambient_temperature":  {"warning": 45.0,  "critical": 55.0},
    "smoke_density":        {"warning": 0.3,   "critical": 0.6},
    "air_quality_index":    {"warning": 100.0, "critical": 200.0},
    "co_level":             {"warning": 50.0,  "critical": 100.0},
    "ventilation_flow":     {"warning": 0.5,   "critical": 0.2},   # Low = bad
    "vibration_level":      {"warning": 5.0,   "critical": 8.0},
}


def create_iot_simulators() -> Dict[str, SensorValueSimulator]:
    """Create one SensorValueSimulator per IoT sensor type."""
    return {
        name: SensorValueSimulator(
            baseline=cfg["baseline"],
            min_val=cfg["min"],
            max_val=cfg["max"],
            noise_std=cfg["noise"]
        )
        for name, cfg in IOT_SENSOR_CONFIGS.items()
    }


def create_scada_simulators(asset_type: str) -> Dict[str, SensorValueSimulator]:
    """Create simulators for a given SCADA asset type."""
    configs = SCADA_SENSOR_CONFIGS.get(asset_type, SCADA_SENSOR_CONFIGS["ROTATING"])
    return {
        name: SensorValueSimulator(
            baseline=cfg["baseline"],
            min_val=cfg["min"],
            max_val=cfg["max"],
            noise_std=cfg["noise"]
        )
        for name, cfg in configs.items()
    }
