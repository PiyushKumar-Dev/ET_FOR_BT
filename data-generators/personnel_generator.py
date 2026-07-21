"""
Personnel Simulator
Industrial Guardian AI — ET Hackathon 2026

Simulates 50+ personnel across zones with real-time location and PPE compliance.
"""

import random
import json
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from facility_config import FACILITY_CONFIG

ROLES = [
    "Process Operator", "Maintenance Technician", "Electrical Engineer",
    "Safety Officer", "Instrumentation Technician", "Shift Supervisor",
    "Quality Inspector", "Contract Worker", "Equipment Operator", "HSE Officer"
]

SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"]

class PersonnelGenerator:
    """Simulates personnel locations and PPE compliance."""

    def __init__(self):
        self.zones = [z["zone_id"] for z in FACILITY_CONFIG["zones"]]
        self.zone_max_occ = {z["zone_id"]: z["max_occupancy"] for z in FACILITY_CONFIG["zones"]}
        self.personnel: List[Dict] = []
        self._generate_personnel()
        random.seed(42)

    def _generate_personnel(self):
        """Generate 50+ synthetic personnel."""
        zones_cycle = self.zones * 10
        for i in range(1, 56):
            zone_id = zones_cycle[i % len(self.zones)]
            shift = SHIFTS[i % 3]
            role = ROLES[i % len(ROLES)]
            ppe_base = 0.85 if role in ["Safety Officer", "HSE Officer", "Shift Supervisor"] else 0.75

            self.personnel.append({
                "personnel_id": f"PER-{i:03d}",
                "name": f"Worker-{i:03d}",
                "role": role,
                "shift": shift,
                "zone_id": zone_id,
                "ppe_compliant": random.random() < ppe_base,
                "helmet": random.random() < ppe_base,
                "safety_vest": random.random() < ppe_base,
                "last_seen": datetime.utcnow().isoformat() + "Z",
                "facility_id": FACILITY_CONFIG["facility_id"],
                "active": shift == "MORNING"  # Morning shift is on duty
            })

    def update_locations(self, timestamp: Optional[datetime] = None) -> List[Dict]:
        """Simulate personnel movement between zones."""
        if timestamp is None:
            timestamp = datetime.utcnow()

        # Occasionally move a person to a different zone
        for person in self.personnel:
            if person["active"] and random.random() < 0.02:  # 2% chance per update
                new_zone = random.choice(self.zones)
                # Check zone capacity
                current_count = sum(1 for p in self.personnel if p["zone_id"] == new_zone and p["active"])
                max_occ = self.zone_max_occ.get(new_zone, 20)
                if current_count < max_occ:
                    person["zone_id"] = new_zone
            person["last_seen"] = timestamp.isoformat() + "Z"
            # Occasionally change PPE compliance
            if random.random() < 0.005:
                person["helmet"] = not person["helmet"]
                person["safety_vest"] = not person["safety_vest"]
                person["ppe_compliant"] = person["helmet"] and person["safety_vest"]

        return self.get_active_personnel()

    def get_active_personnel(self) -> List[Dict]:
        return [p for p in self.personnel if p["active"]]

    def get_personnel_by_zone(self, zone_id: str) -> List[Dict]:
        return [p for p in self.personnel if p["zone_id"] == zone_id and p["active"]]

    def get_zone_ppe_compliance(self, zone_id: str) -> Dict:
        zone_personnel = self.get_personnel_by_zone(zone_id)
        if not zone_personnel:
            return {"zone_id": zone_id, "total": 0, "compliant": 0, "compliance_rate": 1.0}
        compliant = sum(1 for p in zone_personnel if p["ppe_compliant"])
        return {
            "zone_id": zone_id,
            "total": len(zone_personnel),
            "compliant": compliant,
            "compliance_rate": round(compliant / len(zone_personnel), 3)
        }

    def get_facility_summary(self) -> Dict:
        active = self.get_active_personnel()
        by_zone = {}
        for zone_id in self.zones:
            zone_p = [p for p in active if p["zone_id"] == zone_id]
            by_zone[zone_id] = {
                "count": len(zone_p),
                "ppe_compliant": sum(1 for p in zone_p if p["ppe_compliant"]),
                "compliance_rate": round(sum(1 for p in zone_p if p["ppe_compliant"]) / max(1, len(zone_p)), 3)
            }
        return {
            "total_active": len(active),
            "by_zone": by_zone,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    def set_zone_ppe_non_compliant(self, zone_id: str, count: int = 2):
        """Force PPE non-compliance for demo scenarios."""
        zone_p = self.get_personnel_by_zone(zone_id)
        for i, person in enumerate(zone_p[:count]):
            person["ppe_compliant"] = False
            person["helmet"] = False

if __name__ == "__main__":
    gen = PersonnelGenerator()
    summary = gen.get_facility_summary()
    print("=== Personnel Generator Demo ===")
    print(json.dumps(summary, indent=2))
