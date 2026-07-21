"""
IoT Environmental Sensor Generator
Industrial Guardian AI — ET Hackathon 2026

Generates environmental sensor data across all zones.
[Innovation] Multi-sensor compound signals enable cross-agent compound detection.
Gas concentration correlates with SCADA pressure anomalies in same zone.
"""

import math
import random
import json
import os
import sys
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from facility_config import FACILITY_CONFIG, IOT_SENSOR_CONFIG, ASSET_LOOKUP

class IoTGenerator:
    """
    Environmental sensor simulator for all zones.

    [Innovation] Multi-sensor compound detection:
    - Gas concentration rises when SCADA pressure anomaly in same zone
    - Smoke rises when temperature anomaly exceeds threshold for sustained period
    - Air quality falls when both gas and smoke increase
    """

    def __init__(self, scada_generator=None):
        self.zones = [z["zone_id"] for z in FACILITY_CONFIG["zones"]]
        self.scada_gen = scada_generator  # Reference to SCADA gen for cross-correlation
        self.sensor_states: Dict[str, Dict[str, float]] = {}  # zone → sensor → current_value
        self.active_anomalies: Dict[str, Dict] = {}           # zone → anomaly config
        self.phase_offsets: Dict[str, float] = {}

        rng = np.random.default_rng(99)
        for zone_id in self.zones:
            self.phase_offsets[zone_id] = rng.uniform(0, 2 * math.pi)
            self.sensor_states[zone_id] = {
                sensor: cfg["baseline"]
                for sensor, cfg in IOT_SENSOR_CONFIG.items()
            }

        print(f"[IoTGenerator] Initialized {len(self.zones)} zones, {len(IOT_SENSOR_CONFIG)} sensors each")

    def _base_sensor_value(self, zone_id: str, sensor: str, timestamp: datetime) -> float:
        """Generate base sensor reading with physics-informed noise."""
        cfg = IOT_SENSOR_CONFIG[sensor]
        baseline = cfg["baseline"]
        phase = self.phase_offsets.get(zone_id, 0.0)

        t_hours = timestamp.hour + timestamp.minute / 60.0
        # Diurnal cycle
        cycle = math.sin(2 * math.pi * t_hours / 24.0 + phase) * 0.04
        # Sensor drift
        drift_rate = cfg.get("sensor_drift_rate", 0.001)
        drift = random.gauss(0, drift_rate)
        # Gaussian noise
        noise = random.gauss(0, 0.008)

        value = baseline * (1.0 + cycle + drift + noise)

        # Physical bounds
        normal_low, normal_high = cfg["normal_range"]
        value = max(normal_low * 0.5, min(normal_high * 1.5, value))
        return round(value, 3)

    def _apply_iot_anomaly(self, zone_id: str, sensor: str, base_value: float, timestamp: datetime) -> float:
        """Apply active IoT anomaly injection."""
        if zone_id not in self.active_anomalies:
            return base_value

        anomaly = self.active_anomalies[zone_id]
        if sensor not in anomaly.get("sensors", [sensor]):
            return base_value

        start_time = anomaly.get("start_time", timestamp)
        duration = anomaly.get("duration_minutes", 60)
        elapsed_min = (timestamp - start_time).total_seconds() / 60.0

        if elapsed_min < 0 or elapsed_min > duration:
            return base_value

        progress = min(1.0, elapsed_min / max(1, duration))
        cfg = IOT_SENSOR_CONFIG[sensor]
        severity = anomaly.get("severity", 0.5)
        atype = anomaly.get("type", "gradual_drift")

        if atype == "gradual_drift":
            target = cfg["critical_threshold"] * 0.8
            return base_value + (target - cfg["baseline"]) * progress * severity

        elif atype == "sudden_spike":
            return cfg["warning_threshold"] + (cfg["critical_threshold"] - cfg["warning_threshold"]) * severity

        elif atype == "oscillation":
            t_sec = (timestamp - start_time).total_seconds()
            osc = math.sin(t_sec * 0.2) * severity * cfg["baseline"] * 0.3
            return base_value + osc

        return base_value

    def _apply_scada_correlation(self, zone_id: str, sensor: str, base_value: float) -> float:
        """
        [Innovation] Cross-domain correlation: SCADA pressure anomaly → IoT gas concentration rise.
        This is the key signal that enables compound detection across agents.
        """
        if self.scada_gen is None:
            return base_value

        # Check if any asset in this zone has an active SCADA anomaly
        zone_assets = [
            state for state in self.scada_gen.asset_states.values()
            if state.zone_id == zone_id and state.anomaly.anomaly_type.value != "none"
        ]

        if not zone_assets:
            return base_value

        # Highest severity anomaly in zone
        max_severity = max(a.anomaly.severity for a in zone_assets)
        max_progress = max(a.anomaly.progress for a in zone_assets)

        # [Innovation] Physics-based correlations:
        # Pressure anomaly → gas concentration rises (leak scenario)
        if sensor == "gas_concentration":
            pressure_anomalies = [
                a for a in zone_assets
                if a.anomaly.parameter in ("pressure", "")
            ]
            if pressure_anomalies:
                correlation_factor = max_severity * max_progress * 8.0  # ppm rise
                return base_value + correlation_factor

        # Temperature anomaly (sustained) → smoke level rises
        elif sensor == "smoke_level":
            temp_anomalies = [
                a for a in zone_assets
                if a.anomaly.parameter in ("temperature", "")
                and a.anomaly.progress > 0.3  # Needs to be sustained
            ]
            if temp_anomalies:
                smoke_rise = max_severity * max_progress * 12.0  # % smoke
                return base_value + smoke_rise

        # Gas + smoke → air quality degrades
        elif sensor == "air_quality_index":
            if zone_assets:
                aqi_rise = max_severity * max_progress * 60.0  # AQI units
                return base_value + aqi_rise

        return base_value

    def inject_zone_anomaly(
        self,
        zone_id: str,
        sensors: List[str],
        anomaly_type: str,
        severity: float,
        duration_minutes: int
    ) -> Dict:
        """Inject a multi-sensor anomaly into a zone."""
        if zone_id not in self.zones:
            return {"error": f"Zone {zone_id} not found"}

        self.active_anomalies[zone_id] = {
            "type": anomaly_type,
            "sensors": sensors,
            "severity": severity,
            "duration_minutes": duration_minutes,
            "start_time": datetime.utcnow()
        }

        return {
            "zone_id": zone_id,
            "injected_sensors": sensors,
            "anomaly_type": anomaly_type,
            "severity": severity
        }

    def clear_zone_anomaly(self, zone_id: str) -> Dict:
        if zone_id in self.active_anomalies:
            del self.active_anomalies[zone_id]
        return {"cleared": zone_id}

    def clear_all_anomalies(self) -> Dict:
        self.active_anomalies.clear()
        return {"cleared": "all"}

    def generate_zone_reading(self, zone_id: str, timestamp: Optional[datetime] = None) -> Dict:
        """Generate current sensor readings for a zone."""
        if timestamp is None:
            timestamp = datetime.utcnow()

        cfg = IOT_SENSOR_CONFIG
        readings = {}

        for sensor in cfg:
            base = self._base_sensor_value(zone_id, sensor, timestamp)
            # Apply SCADA correlation first (cross-domain signal)
            base = self._apply_scada_correlation(zone_id, sensor, base)
            # Then apply explicit IoT anomaly injection
            value = self._apply_iot_anomaly(zone_id, sensor, base, timestamp)

            sensor_cfg = cfg[sensor]
            status = "NORMAL"
            if value >= sensor_cfg["critical_threshold"]:
                status = "CRITICAL"
            elif value >= sensor_cfg["warning_threshold"]:
                status = "WARNING"
            # For ventilation (lower is worse)
            if sensor == "ventilation_flow" and value <= sensor_cfg["warning_threshold"]:
                status = "WARNING"
            if sensor == "ventilation_flow" and value <= sensor_cfg["critical_threshold"]:
                status = "CRITICAL"

            readings[sensor] = {
                "value": round(value, 3),
                "unit": sensor_cfg["unit"],
                "status": status,
                "warning_threshold": sensor_cfg["warning_threshold"],
                "critical_threshold": sensor_cfg["critical_threshold"]
            }

        # [Innovation] Compound environmental risk detection within IoT
        compound_flags = self._detect_compound_environmental_risk(zone_id, readings)

        return {
            "facility_id": FACILITY_CONFIG["facility_id"],
            "zone_id": zone_id,
            "timestamp": timestamp.isoformat() + "Z",
            "sensors": readings,
            "compound_environmental_flags": compound_flags,
            "anomaly_active": zone_id in self.active_anomalies
        }

    def _detect_compound_environmental_risk(self, zone_id: str, readings: Dict) -> List[Dict]:
        """
        [Innovation] Multi-sensor compound detection within IoT agent.
        Each flag carries confidence based on deviation magnitude.
        These compound signals feed into the Master AI.
        """
        flags = []

        gas = readings.get("gas_concentration", {}).get("value", 0)
        smoke = readings.get("smoke_level", {}).get("value", 0)
        temp = readings.get("ambient_temperature", {}).get("value", 0)
        aqi = readings.get("air_quality_index", {}).get("value", 0)
        ventilation = readings.get("ventilation_flow", {}).get("value", 999)

        gas_cfg = IOT_SENSOR_CONFIG["gas_concentration"]
        smoke_cfg = IOT_SENSOR_CONFIG["smoke_level"]
        temp_cfg = IOT_SENSOR_CONFIG["ambient_temperature"]

        # FIRE_RISK: gas rising AND temperature above baseline
        if gas > gas_cfg["warning_threshold"] and temp > temp_cfg["warning_threshold"]:
            gas_dev = (gas - gas_cfg["baseline"]) / (gas_cfg["critical_threshold"] - gas_cfg["baseline"])
            temp_dev = (temp - temp_cfg["baseline"]) / (temp_cfg["critical_threshold"] - temp_cfg["baseline"])
            confidence = min(1.0, (gas_dev + temp_dev) / 2.0)
            flags.append({
                "flag": "FIRE_RISK",
                "confidence": round(confidence, 3),
                "contributing_sensors": ["gas_concentration", "ambient_temperature"],
                "description": f"Gas {gas:.1f}ppm + Temperature {temp:.1f}°C compound fire risk"
            })

        # COMBUSTION_RISK: smoke + AQI + temperature all rising
        if smoke > smoke_cfg["warning_threshold"] and aqi > 120 and temp > temp_cfg["warning_threshold"]:
            confidence = min(1.0, (smoke / smoke_cfg["critical_threshold"] + aqi / 200.0) / 2.0)
            flags.append({
                "flag": "FIRE_OR_COMBUSTION",
                "confidence": round(confidence, 3),
                "contributing_sensors": ["smoke_level", "air_quality_index", "ambient_temperature"],
                "description": f"Smoke {smoke:.1f}% + AQI {aqi:.0f} + Temperature {temp:.1f}°C combustion signature"
            })

        # ASPHYXIATION_RISK: high gas + low ventilation
        if gas > gas_cfg["warning_threshold"] and ventilation < IOT_SENSOR_CONFIG["ventilation_flow"]["warning_threshold"]:
            confidence = min(1.0, gas / gas_cfg["critical_threshold"])
            flags.append({
                "flag": "GAS_ACCUMULATION",
                "confidence": round(confidence, 3),
                "contributing_sensors": ["gas_concentration", "ventilation_flow"],
                "description": f"Gas {gas:.1f}ppm with ventilation {ventilation:.2f}m/s — accumulation risk"
            })

        return flags

    def generate_all_zones(self, timestamp: Optional[datetime] = None) -> List[Dict]:
        """Generate readings for all zones."""
        if timestamp is None:
            timestamp = datetime.utcnow()
        return [self.generate_zone_reading(zone_id, timestamp) for zone_id in self.zones]

    def get_zone_status_summary(self) -> List[Dict]:
        """Quick status summary for all zones."""
        readings = self.generate_all_zones()
        summaries = []
        for zone_reading in readings:
            worst_status = "NORMAL"
            for sensor_data in zone_reading["sensors"].values():
                if sensor_data["status"] == "CRITICAL":
                    worst_status = "CRITICAL"
                    break
                elif sensor_data["status"] == "WARNING":
                    worst_status = "WARNING"

            summaries.append({
                "zone_id": zone_reading["zone_id"],
                "status": worst_status,
                "compound_flags": len(zone_reading["compound_environmental_flags"]),
                "anomaly_active": zone_reading["anomaly_active"]
            })
        return summaries


if __name__ == "__main__":
    gen = IoTGenerator()
    print("=== IoT Generator Demo ===\n")
    readings = gen.generate_all_zones()
    for r in readings[:2]:
        print(json.dumps(r, indent=2))
        print()
    print(f"({len(readings)} zones total)")

    # Demo compound detection
    print("\n=== Testing Compound Detection ===")
    gen.inject_zone_anomaly("ZONE-02", ["gas_concentration"], "gradual_drift", 0.8, 30)
    gen.inject_zone_anomaly("ZONE-02", ["ambient_temperature"], "gradual_drift", 0.6, 30)
    zone02 = gen.generate_zone_reading("ZONE-02")
    print(f"ZONE-02 compound flags: {zone02['compound_environmental_flags']}")
