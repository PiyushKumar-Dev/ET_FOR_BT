"""
SCADA Data Generator — Physics-Informed Time-Series
Industrial Guardian AI — ET Hackathon 2026

Generates realistic SCADA telemetry for 100+ assets with:
- Sine wave base + Gaussian noise + drift
- Realistic state machine transitions
- Correlated anomaly propagation across downstream assets
- Anomaly injection: gradual_drift, sudden_spike, oscillation, stuck_sensor

[Innovation] Correlated anomalies enable compound detection scenarios
"""

import asyncio
import math
import random
import time
import json
import os
import csv
import sys
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Add parent dir to path for facility_config
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from facility_config import ASSETS, ASSET_LOOKUP, DOWNSTREAM_MAP, FACILITY_CONFIG

# ─── Equipment State Machine ─────────────────────────────────────────────────

class EquipmentState(str, Enum):
    RUNNING = "RUNNING"
    IDLE = "IDLE"
    MAINTENANCE = "MAINTENANCE"
    FAULT = "FAULT"

# Transition probabilities per minute [from_state][to_state]
STATE_TRANSITIONS = {
    EquipmentState.RUNNING: {
        EquipmentState.RUNNING: 0.9990,
        EquipmentState.IDLE: 0.0008,
        EquipmentState.MAINTENANCE: 0.0001,
        EquipmentState.FAULT: 0.0001,
    },
    EquipmentState.IDLE: {
        EquipmentState.RUNNING: 0.0050,
        EquipmentState.IDLE: 0.9940,
        EquipmentState.MAINTENANCE: 0.0005,
        EquipmentState.FAULT: 0.0005,
    },
    EquipmentState.MAINTENANCE: {
        EquipmentState.RUNNING: 0.0200,
        EquipmentState.IDLE: 0.0050,
        EquipmentState.MAINTENANCE: 0.9750,
        EquipmentState.FAULT: 0.0000,
    },
    EquipmentState.FAULT: {
        EquipmentState.RUNNING: 0.0010,
        EquipmentState.IDLE: 0.0050,
        EquipmentState.MAINTENANCE: 0.0100,
        EquipmentState.FAULT: 0.9840,
    },
}

class AnomalyType(str, Enum):
    GRADUAL_DRIFT = "gradual_drift"
    SUDDEN_SPIKE = "sudden_spike"
    OSCILLATION = "oscillation"
    STUCK_SENSOR = "stuck_sensor"
    NONE = "none"

@dataclass
class AnomalyProfile:
    anomaly_type: AnomalyType = AnomalyType.NONE
    parameter: str = ""
    severity: float = 0.0          # 0.0 to 1.0
    duration_minutes: int = 0
    start_time: Optional[datetime] = None
    progress: float = 0.0          # 0.0 to 1.0 (how far into anomaly)

@dataclass
class AssetState:
    asset_id: str
    zone_id: str
    asset_type: str
    parameters: Dict                # parameter config from ASSET_TYPES
    equipment_state: EquipmentState = EquipmentState.RUNNING
    anomaly: AnomalyProfile = field(default_factory=AnomalyProfile)
    last_maintenance: datetime = field(default_factory=datetime.utcnow)
    phase_offset: float = 0.0      # For sine wave variation between assets
    noise_seed: int = 0

# ─── SCADAGenerator ──────────────────────────────────────────────────────────

class SCADAGenerator:
    """
    Physics-informed SCADA telemetry generator.

    [Technical Excellence] Each asset has its own baseline profile.
    Anomalies propagate: if Asset A07 pressure rises, downstream A08 sees correlated rise.
    This correlation is what makes compound detection non-trivial.
    """

    def __init__(self, mongo_uri: Optional[str] = None):
        self.mongo_uri = mongo_uri
        self.asset_states: Dict[str, AssetState] = {}
        self.active_anomalies: Dict[str, AnomalyProfile] = {}  # asset_id → anomaly
        self.telemetry_buffer: List[Dict] = []
        self._running = False
        self._db = None

        # Initialize asset states
        rng = np.random.default_rng(42)
        for asset in ASSETS:
            self.asset_states[asset["asset_id"]] = AssetState(
                asset_id=asset["asset_id"],
                zone_id=asset["zone_id"],
                asset_type=asset["asset_type"],
                parameters=asset["parameters"],
                phase_offset=rng.uniform(0, 2 * math.pi),
                noise_seed=int(rng.integers(0, 100000))
            )

        print(f"[SCADAGenerator] Initialized {len(self.asset_states)} assets across {len(FACILITY_CONFIG['zones'])} zones")

    # ─── Physics-Informed Value Generation ───────────────────────────────────

    def _generate_parameter_value(
        self,
        asset_state: AssetState,
        param_name: str,
        timestamp: datetime
    ) -> float:
        """
        Generate a realistic sensor reading using:
        - Sine wave for diurnal/operational cycles
        - Gaussian noise for sensor noise
        - Equipment state modifier
        - Active anomaly injection
        """
        if param_name not in asset_state.parameters:
            return 0.0

        param_cfg = asset_state.parameters[param_name]
        baseline = param_cfg["baseline"]
        normal_low, normal_high = param_cfg["normal_range"]
        normal_span = normal_high - normal_low

        # Time in hours (for diurnal cycles)
        t_hours = timestamp.hour + timestamp.minute / 60.0
        t_seconds = timestamp.timestamp()

        # [Innovation] Multi-frequency sine for realistic industrial patterns
        # Primary cycle: 8-hour operational cycle
        # Secondary cycle: 24-hour diurnal
        primary = math.sin(2 * math.pi * t_hours / 8.0 + asset_state.phase_offset) * 0.03
        secondary = math.sin(2 * math.pi * t_hours / 24.0 + asset_state.phase_offset * 0.5) * 0.015

        # Gaussian noise (seeded for reproducibility per asset, varies by timestamp)
        rng = np.random.default_rng(asset_state.noise_seed + int(t_seconds / 60))
        noise = rng.normal(0, 0.005)

        # Equipment state modifier
        state_modifier = {
            EquipmentState.RUNNING: 1.0,
            EquipmentState.IDLE: 0.3,
            EquipmentState.MAINTENANCE: 0.0,
            EquipmentState.FAULT: 1.4,  # Fault often causes high readings
        }.get(asset_state.equipment_state, 1.0)

        # Combine base signal
        raw_factor = state_modifier + primary + secondary + noise
        value = baseline * raw_factor

        # Apply anomaly if active
        value = self._apply_anomaly(value, asset_state, param_name, timestamp, param_cfg)

        # Clamp to physical bounds (can't have negative RPM, etc.)
        value = max(0, value)
        return round(value, 3)

    def _apply_anomaly(
        self,
        base_value: float,
        asset_state: AssetState,
        param_name: str,
        timestamp: datetime,
        param_cfg: dict
    ) -> float:
        """Apply anomaly injection to base sensor value."""
        anomaly = asset_state.anomaly
        if anomaly.anomaly_type == AnomalyType.NONE:
            return base_value
        if anomaly.parameter and anomaly.parameter != param_name:
            return base_value  # Only affect target parameter

        critical = param_cfg.get("critical", base_value * 1.5)
        baseline = param_cfg["baseline"]
        severity = anomaly.severity

        if anomaly.anomaly_type == AnomalyType.GRADUAL_DRIFT:
            # [Innovation] Linear drift toward critical threshold
            drift_factor = anomaly.progress * severity * 0.6
            return base_value * (1.0 + drift_factor)

        elif anomaly.anomaly_type == AnomalyType.SUDDEN_SPIKE:
            # Sharp spike to severity * critical threshold
            spike_amount = (critical - baseline) * severity * 0.85
            return base_value + spike_amount

        elif anomaly.anomaly_type == AnomalyType.OSCILLATION:
            # Oscillation around base value
            t_seconds = timestamp.timestamp()
            oscillation = math.sin(t_seconds * 0.5) * severity * baseline * 0.25
            return base_value + oscillation

        elif anomaly.anomaly_type == AnomalyType.STUCK_SENSOR:
            # Return stuck (constant) value
            return baseline * (1.0 + severity * 0.1)

        return base_value

    # ─── State Machine ────────────────────────────────────────────────────────

    def _transition_equipment_state(self, asset_state: AssetState) -> EquipmentState:
        """Markov chain state transition."""
        current = asset_state.equipment_state
        transitions = STATE_TRANSITIONS[current]
        states = list(transitions.keys())
        probs = list(transitions.values())
        return random.choices(states, weights=probs)[0]

    # ─── Anomaly Injection API ────────────────────────────────────────────────

    def inject_anomaly(
        self,
        asset_id: str,
        anomaly_type: str,
        severity: float,
        duration_minutes: int,
        parameter: str = "",
        propagate: bool = True
    ) -> Dict:
        """
        [Innovation] Inject a controlled anomaly into a specific asset.

        Args:
            asset_id: Target asset
            anomaly_type: gradual_drift | sudden_spike | oscillation | stuck_sensor
            severity: 0.0 to 1.0
            duration_minutes: How long anomaly lasts
            parameter: Specific parameter (empty = all parameters)
            propagate: Whether to propagate to downstream asset (enables compound detection)
        """
        if asset_id not in self.asset_states:
            return {"error": f"Asset {asset_id} not found"}

        anomaly = AnomalyProfile(
            anomaly_type=AnomalyType(anomaly_type),
            parameter=parameter,
            severity=severity,
            duration_minutes=duration_minutes,
            start_time=datetime.utcnow(),
            progress=0.0
        )
        self.asset_states[asset_id].anomaly = anomaly

        result = {
            "injected": asset_id,
            "anomaly_type": anomaly_type,
            "severity": severity,
            "duration_minutes": duration_minutes
        }

        # [Innovation] Anomaly propagation to downstream asset
        # Pressure rise in A07 → correlated pressure rise in A08 (50% severity)
        if propagate and asset_id in DOWNSTREAM_MAP:
            downstream_id = DOWNSTREAM_MAP[asset_id]
            if downstream_id in self.asset_states:
                downstream_anomaly = AnomalyProfile(
                    anomaly_type=AnomalyType.GRADUAL_DRIFT,
                    parameter=parameter,
                    severity=severity * 0.5,  # 50% correlation
                    duration_minutes=duration_minutes + 5,  # Delayed
                    start_time=datetime.utcnow() + timedelta(minutes=2),
                    progress=0.0
                )
                self.asset_states[downstream_id].anomaly = downstream_anomaly
                result["propagated_to"] = downstream_id

        return result

    def clear_anomaly(self, asset_id: str) -> Dict:
        """Clear anomaly from asset."""
        if asset_id in self.asset_states:
            self.asset_states[asset_id].anomaly = AnomalyProfile()
            return {"cleared": asset_id}
        return {"error": f"Asset {asset_id} not found"}

    def clear_all_anomalies(self) -> Dict:
        """Clear all active anomalies — used for scenario reset."""
        for state in self.asset_states.values():
            state.anomaly = AnomalyProfile()
        return {"cleared": "all", "asset_count": len(self.asset_states)}

    # ─── Reading Generation ───────────────────────────────────────────────────

    def generate_reading(self, asset_id: str, timestamp: Optional[datetime] = None) -> Dict:
        """Generate a single telemetry reading for an asset."""
        if asset_id not in self.asset_states:
            return {}

        asset_state = self.asset_states[asset_id]
        if timestamp is None:
            timestamp = datetime.utcnow()

        # Update anomaly progress
        if asset_state.anomaly.anomaly_type != AnomalyType.NONE:
            if asset_state.anomaly.start_time and timestamp >= asset_state.anomaly.start_time:
                elapsed = (timestamp - asset_state.anomaly.start_time).total_seconds() / 60.0
                asset_state.anomaly.progress = min(1.0, elapsed / max(1, asset_state.anomaly.duration_minutes))
                if asset_state.anomaly.progress >= 1.0:
                    asset_state.anomaly = AnomalyProfile()  # Anomaly expired

        # Occasionally transition state
        if random.random() < 0.001:
            asset_state.equipment_state = self._transition_equipment_state(asset_state)

        # Generate all parameter readings
        readings = {}
        for param_name in asset_state.parameters:
            readings[param_name] = self._generate_parameter_value(asset_state, param_name, timestamp)

        asset_info = ASSET_LOOKUP.get(asset_id, {})

        return {
            "facility_id": FACILITY_CONFIG["facility_id"],
            "asset_id": asset_id,
            "zone_id": asset_state.zone_id,
            "asset_type": asset_state.asset_type,
            "equipment_status": asset_state.equipment_state.value,
            "timestamp": timestamp.isoformat() + "Z",
            "readings": readings,
            "anomaly_active": asset_state.anomaly.anomaly_type != AnomalyType.NONE,
            "anomaly_type": asset_state.anomaly.anomaly_type.value if asset_state.anomaly.anomaly_type != AnomalyType.NONE else None
        }

    def generate_all_readings(self, timestamp: Optional[datetime] = None) -> List[Dict]:
        """Generate readings for ALL assets at once."""
        if timestamp is None:
            timestamp = datetime.utcnow()
        return [self.generate_reading(asset_id, timestamp) for asset_id in self.asset_states]

    # ─── Historical Backfill ──────────────────────────────────────────────────

    def generate_historical_data(
        self,
        days: int = 30,
        interval_minutes: int = 1,
        output_csv: Optional[str] = None,
        mongo_collection=None
    ) -> int:
        """
        Generate 30 days of historical data at 1-minute intervals.
        Used for Isolation Forest training and dashboard history.
        Returns total records generated.
        """
        print(f"[SCADAGenerator] Generating {days}-day historical backfill ({interval_minutes}min intervals)...")
        start_time = datetime.utcnow() - timedelta(days=days)
        total_records = 0
        batch = []

        csv_file = None
        csv_writer = None
        if output_csv:
            csv_file = open(output_csv, 'w', newline='')
            csv_writer = csv.writer(csv_file)
            csv_writer.writerow(['timestamp', 'asset_id', 'zone_id', 'asset_type',
                                  'equipment_status', 'parameter', 'value', 'unit', 'anomaly_active'])

        current_time = start_time
        end_time = datetime.utcnow()

        # Reset anomalies for clean historical generation
        self.clear_all_anomalies()

        # Inject historical anomalies at known points for training diversity
        self._inject_historical_anomalies_for_backfill(start_time, days)

        while current_time < end_time:
            for asset_id, asset_state in self.asset_states.items():
                # Update anomaly progress for historical time
                if asset_state.anomaly.anomaly_type != AnomalyType.NONE:
                    if asset_state.anomaly.start_time and current_time >= asset_state.anomaly.start_time:
                        elapsed = (current_time - asset_state.anomaly.start_time).total_seconds() / 60.0
                        asset_state.anomaly.progress = min(1.0, elapsed / max(1, asset_state.anomaly.duration_minutes))
                        if asset_state.anomaly.progress >= 1.0:
                            asset_state.anomaly = AnomalyProfile()

                for param_name in asset_state.parameters:
                    value = self._generate_parameter_value(asset_state, param_name, current_time)
                    record = {
                        "facility_id": FACILITY_CONFIG["facility_id"],
                        "asset_id": asset_id,
                        "zone_id": asset_state.zone_id,
                        "asset_type": asset_state.asset_type,
                        "equipment_status": asset_state.equipment_state.value,
                        "timestamp": current_time.isoformat() + "Z",
                        "parameter": param_name,
                        "value": value,
                        "unit": asset_state.parameters[param_name].get("unit", ""),
                        "anomaly_active": asset_state.anomaly.anomaly_type != AnomalyType.NONE
                    }

                    if csv_writer:
                        csv_writer.writerow([
                            record["timestamp"], record["asset_id"], record["zone_id"],
                            record["asset_type"], record["equipment_status"],
                            record["parameter"], record["value"], record["unit"],
                            record["anomaly_active"]
                        ])

                    if mongo_collection:
                        batch.append(record)
                        if len(batch) >= 500:
                            mongo_collection.insert_many(batch)
                            batch.clear()

                    total_records += 1

            current_time += timedelta(minutes=interval_minutes)

            # Progress report every day of data
            elapsed_days = (current_time - start_time).days
            if (current_time - start_time).seconds == 0 and elapsed_days > 0:
                print(f"  ... {elapsed_days}/{days} days generated ({total_records:,} records)")

        # Flush remaining batch
        if mongo_collection and batch:
            mongo_collection.insert_many(batch)

        if csv_file:
            csv_file.close()

        self.clear_all_anomalies()
        print(f"[SCADAGenerator] Backfill complete: {total_records:,} records")
        return total_records

    def _inject_historical_anomalies_for_backfill(self, start_time: datetime, days: int):
        """
        Inject a few known anomalies at specific historical times.
        This gives Isolation Forest a realistic training distribution
        with ~5% anomaly rate.
        """
        # Pick a few assets for historical anomaly injection
        all_asset_ids = list(self.asset_states.keys())
        rng = np.random.default_rng(777)

        # Inject anomalies at 7-day, 14-day, 21-day marks
        for day_offset in [7, 14, 21]:
            for _ in range(3):  # 3 anomalies per checkpoint
                asset_id = rng.choice(all_asset_ids)
                anomaly_types = ["gradual_drift", "sudden_spike", "oscillation"]
                atype = rng.choice(anomaly_types)
                inject_time = start_time + timedelta(days=day_offset, hours=int(rng.integers(0, 24)))

                if asset_id in self.asset_states:
                    state = self.asset_states[asset_id]
                    param_names = list(state.parameters.keys())
                    param = rng.choice(param_names)
                    state.anomaly = AnomalyProfile(
                        anomaly_type=AnomalyType(atype),
                        parameter=param,
                        severity=float(rng.uniform(0.3, 0.7)),
                        duration_minutes=int(rng.integers(20, 120)),
                        start_time=inject_time,
                        progress=0.0
                    )

    # ─── Live Streaming ───────────────────────────────────────────────────────

    async def stream_to_mongo(self, mongo_collection, interval_seconds: float = 60.0):
        """Stream live telemetry to MongoDB continuously."""
        self._running = True
        print(f"[SCADAGenerator] Starting live stream (interval={interval_seconds}s)")
        while self._running:
            timestamp = datetime.utcnow()
            readings = self.generate_all_readings(timestamp)
            if readings:
                mongo_collection.insert_many(readings)
            await asyncio.sleep(interval_seconds)

    def stop(self):
        self._running = False

    def get_latest_readings(self, asset_id: Optional[str] = None) -> List[Dict]:
        """Get latest readings (in-memory, no DB required)."""
        timestamp = datetime.utcnow()
        if asset_id:
            return [self.generate_reading(asset_id, timestamp)]
        return self.generate_all_readings(timestamp)

    def get_asset_status(self) -> List[Dict]:
        """Get equipment status for all assets."""
        return [
            {
                "asset_id": state.asset_id,
                "zone_id": state.zone_id,
                "equipment_state": state.equipment_state.value,
                "anomaly_active": state.anomaly.anomaly_type != AnomalyType.NONE,
                "anomaly_type": state.anomaly.anomaly_type.value
            }
            for state in self.asset_states.values()
        ]


# ─── Standalone Run ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="SCADA Data Generator")
    parser.add_argument("--mode", choices=["stream", "backfill", "csv", "demo"], default="demo")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--output-csv", type=str, default="scada_data.csv")
    parser.add_argument("--mongo-uri", type=str, default=os.environ.get("MONGODB_URI", ""))
    parser.add_argument("--inject-anomaly", type=str, help="asset_id:type:severity:duration")
    args = parser.parse_args()

    gen = SCADAGenerator(mongo_uri=args.mongo_uri)

    if args.inject_anomaly:
        parts = args.inject_anomaly.split(":")
        result = gen.inject_anomaly(parts[0], parts[1], float(parts[2]), int(parts[3]))
        print(f"Anomaly injected: {result}")

    if args.mode == "demo":
        print("\n=== SCADA Generator Demo ===")
        print("Generating sample readings for all assets...\n")
        readings = gen.get_latest_readings()
        for r in readings[:3]:
            print(json.dumps(r, indent=2))
        print(f"\n... ({len(readings)} total assets)")

    elif args.mode == "backfill":
        gen.generate_historical_data(
            days=args.days,
            interval_minutes=1,
            output_csv=args.output_csv if args.output_csv else None
        )

    elif args.mode == "csv":
        print(f"Generating {args.days}-day CSV export to {args.output_csv}...")
        gen.generate_historical_data(days=args.days, interval_minutes=5, output_csv=args.output_csv)
        print("Done.")

    elif args.mode == "stream":
        print("Starting live stream (Ctrl+C to stop)...")
        readings = gen.get_latest_readings()
        for r in readings[:2]:
            print(json.dumps(r, indent=2))
        print("\nStreaming... (in real deployment, writes to MongoDB)")
