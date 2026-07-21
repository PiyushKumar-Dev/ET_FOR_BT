"""
Shared Facility Configuration
Industrial Guardian AI — ET Hackathon 2026

Defines facility topology: zones, assets, sensor profiles, thresholds.
Industry-agnostic: no mention of specific industries.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any
import numpy as np

# [Innovation] Facility topology — industry-agnostic, supports multi-facility
FACILITY_CONFIG = {
    "facility_id": "FAC-001",
    "facility_name": "Alpha Processing Facility",
    "location": {"lat": 19.0760, "lng": 72.8777},  # Base coords for map
    "zones": [
        {
            "zone_id": "ZONE-01",
            "name": "Primary Processing Area",
            "area_sqm": 2500,
            "max_occupancy": 20,
            "coords": [  # Relative polygon coords for Leaflet overlay
                [0, 0], [0, 250], [200, 250], [200, 0]
            ],
            "lat_lng_bounds": [[19.0750, 72.8760], [19.0770, 72.8790]]
        },
        {
            "zone_id": "ZONE-02",
            "name": "Secondary Processing Area",
            "area_sqm": 1800,
            "max_occupancy": 15,
            "coords": [[200, 0], [200, 250], [380, 250], [380, 0]],
            "lat_lng_bounds": [[19.0770, 72.8790], [19.0785, 72.8820]]
        },
        {
            "zone_id": "ZONE-03",
            "name": "Utility Zone",
            "area_sqm": 1200,
            "max_occupancy": 10,
            "coords": [[0, 250], [0, 420], [380, 420], [380, 250]],
            "lat_lng_bounds": [[19.0785, 72.8760], [19.0800, 72.8820]]
        },
        {
            "zone_id": "ZONE-04",
            "name": "Storage Area",
            "area_sqm": 3000,
            "max_occupancy": 8,
            "coords": [[380, 0], [380, 420], [600, 420], [600, 0]],
            "lat_lng_bounds": [[19.0750, 72.8820], [19.0800, 72.8860]]
        },
        {
            "zone_id": "ZONE-05",
            "name": "Control Room",
            "area_sqm": 400,
            "max_occupancy": 5,
            "coords": [[600, 0], [600, 200], [750, 200], [750, 0]],
            "lat_lng_bounds": [[19.0755, 72.8860], [19.0775, 72.8880]]
        },
        {
            "zone_id": "ZONE-06",
            "name": "Maintenance Workshop",
            "area_sqm": 800,
            "max_occupancy": 12,
            "coords": [[600, 200], [600, 420], [750, 420], [750, 200]],
            "lat_lng_bounds": [[19.0775, 72.8860], [19.0800, 72.8880]]
        }
    ]
}

# [Scalability] Asset types define baseline profiles — easily extensible
ASSET_TYPES = {
    "ROTATING": {
        "description": "Rotating machinery (pumps, compressors, fans)",
        "parameters": {
            "temperature": {"baseline": 65.0, "normal_range": (45, 85), "critical": 110.0, "unit": "°C"},
            "pressure": {"baseline": 8.5, "normal_range": (6.0, 11.0), "critical": 14.0, "unit": "bar"},
            "vibration": {"baseline": 2.1, "normal_range": (0.5, 4.0), "critical": 8.0, "unit": "mm/s"},
            "rpm": {"baseline": 1480.0, "normal_range": (1400, 1560), "critical": 1650.0, "unit": "RPM"},
            "current": {"baseline": 45.0, "normal_range": (30, 60), "critical": 80.0, "unit": "A"},
            "voltage": {"baseline": 415.0, "normal_range": (380, 440), "critical": 460.0, "unit": "V"},
        }
    },
    "STATIC": {
        "description": "Static equipment (vessels, heat exchangers, tanks)",
        "parameters": {
            "temperature": {"baseline": 78.0, "normal_range": (50, 100), "critical": 135.0, "unit": "°C"},
            "pressure": {"baseline": 45.0, "normal_range": (30, 65), "critical": 90.0, "unit": "bar"},
            "vibration": {"baseline": 0.3, "normal_range": (0.0, 1.0), "critical": 3.0, "unit": "mm/s"},
            "level": {"baseline": 60.0, "normal_range": (20, 85), "critical": 95.0, "unit": "%"},
            "flow": {"baseline": 120.0, "normal_range": (80, 160), "critical": 200.0, "unit": "m³/h"},
        }
    },
    "ELECTRICAL": {
        "description": "Electrical systems (switchgear, transformers, panels)",
        "parameters": {
            "temperature": {"baseline": 40.0, "normal_range": (20, 55), "critical": 80.0, "unit": "°C"},
            "current": {"baseline": 180.0, "normal_range": (120, 240), "critical": 300.0, "unit": "A"},
            "voltage": {"baseline": 11000.0, "normal_range": (10500, 11500), "critical": 12000.0, "unit": "V"},
            "power_factor": {"baseline": 0.92, "normal_range": (0.85, 1.0), "critical": 0.70, "unit": "pf"},
            "insulation_resistance": {"baseline": 500.0, "normal_range": (100, 1000), "critical": 50.0, "unit": "MΩ"},
        }
    },
    "ENVIRONMENTAL": {
        "description": "Environmental monitoring stations",
        "parameters": {
            "temperature": {"baseline": 28.0, "normal_range": (15, 40), "critical": 55.0, "unit": "°C"},
            "humidity": {"baseline": 55.0, "normal_range": (30, 75), "critical": 90.0, "unit": "%RH"},
            "air_quality_index": {"baseline": 45.0, "normal_range": (0, 100), "critical": 200.0, "unit": "AQI"},
        }
    }
}

# [Technical Excellence] Asset catalog — 100+ assets across 6 zones
def generate_asset_catalog():
    """Generate deterministic asset catalog."""
    assets = []
    asset_counter = 1

    zone_asset_map = {
        "ZONE-01": [
            ("ROTATING", 10), ("STATIC", 7), ("ELECTRICAL", 3), ("ENVIRONMENTAL", 2)
        ],
        "ZONE-02": [
            ("ROTATING", 7), ("STATIC", 9), ("ELECTRICAL", 2), ("ENVIRONMENTAL", 2)
        ],
        "ZONE-03": [
            ("ROTATING", 5), ("STATIC", 5), ("ELECTRICAL", 6), ("ENVIRONMENTAL", 3)
        ],
        "ZONE-04": [
            ("ROTATING", 2), ("STATIC", 10), ("ELECTRICAL", 2), ("ENVIRONMENTAL", 2)
        ],
        "ZONE-05": [
            ("ROTATING", 0), ("STATIC", 2), ("ELECTRICAL", 8), ("ENVIRONMENTAL", 2)
        ],
        "ZONE-06": [
            ("ROTATING", 5), ("STATIC", 3), ("ELECTRICAL", 3), ("ENVIRONMENTAL", 2)
        ]
    }

    # Downstream dependency map — for correlated anomaly propagation
    downstream_map = {}

    for zone_id, type_counts in zone_asset_map.items():
        zone_assets = []
        for asset_type, count in type_counts:
            for _ in range(count):
                asset_id = f"ASSET-{chr(65 + (asset_counter // 10))}{asset_counter % 100:02d}"
                asset = {
                    "asset_id": asset_id,
                    "zone_id": zone_id,
                    "asset_type": asset_type,
                    "name": f"{asset_type.title()} Unit {asset_counter:03d}",
                    "install_date": "2019-01-01",  # Simplified
                    "last_maintenance": "2024-06-01",
                    "failure_history_count": max(0, (asset_counter % 5) - 2),
                    "parameters": ASSET_TYPES[asset_type]["parameters"]
                }
                assets.append(asset)
                zone_assets.append(asset_id)
                asset_counter += 1

        # Wire up downstream dependencies within zone
        for i in range(len(zone_assets) - 1):
            downstream_map[zone_assets[i]] = zone_assets[i + 1]

    return assets, downstream_map


ASSETS, DOWNSTREAM_MAP = generate_asset_catalog()
ASSET_LOOKUP = {a["asset_id"]: a for a in ASSETS}

# IoT Sensor configuration per zone
IOT_SENSOR_CONFIG = {
    "gas_concentration": {
        "unit": "ppm",
        "normal_range": (0, 5),
        "warning_threshold": 10.0,
        "critical_threshold": 25.0,
        "sensor_drift_rate": 0.001,
        "baseline": 2.0
    },
    "smoke_level": {
        "unit": "%",
        "normal_range": (0, 10),
        "warning_threshold": 15.0,
        "critical_threshold": 35.0,
        "sensor_drift_rate": 0.0005,
        "baseline": 3.0
    },
    "humidity": {
        "unit": "%RH",
        "normal_range": (30, 75),
        "warning_threshold": 80.0,
        "critical_threshold": 90.0,
        "sensor_drift_rate": 0.0002,
        "baseline": 55.0
    },
    "ambient_temperature": {
        "unit": "°C",
        "normal_range": (15, 40),
        "warning_threshold": 45.0,
        "critical_threshold": 60.0,
        "sensor_drift_rate": 0.001,
        "baseline": 28.0
    },
    "air_quality_index": {
        "unit": "AQI",
        "normal_range": (0, 100),
        "warning_threshold": 150.0,
        "critical_threshold": 200.0,
        "sensor_drift_rate": 0.002,
        "baseline": 45.0
    },
    "noise_level_db": {
        "unit": "dB",
        "normal_range": (50, 80),
        "warning_threshold": 85.0,
        "critical_threshold": 100.0,
        "sensor_drift_rate": 0.001,
        "baseline": 65.0
    },
    "ventilation_flow": {
        "unit": "m/s",
        "normal_range": (0.3, 2.0),
        "warning_threshold": 0.3,
        "critical_threshold": 0.1,
        "sensor_drift_rate": 0.0005,
        "baseline": 1.2
    }
}
