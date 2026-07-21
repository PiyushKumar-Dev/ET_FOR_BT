"""
Permit-to-Work Generator
Industrial Guardian AI — ET Hackathon 2026

Generates synthetic permit records with time-aware status and built-in conflict injection.
[Business Impact] Permits are central to real-world industrial safety compliance.
"""

import random
import json
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import uuid

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from facility_config import FACILITY_CONFIG, ASSETS

class PermitType:
    HOT_WORK = "HOT_WORK"
    ELECTRICAL_ISOLATION = "ELECTRICAL_ISOLATION"
    CONFINED_SPACE_ENTRY = "CONFINED_SPACE_ENTRY"
    GENERAL_MAINTENANCE = "GENERAL_MAINTENANCE"
    EMERGENCY_SHUTDOWN = "EMERGENCY_SHUTDOWN"

class PermitStatus:
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    PENDING = "PENDING"
    SUSPENDED = "SUSPENDED"
    CLOSED = "CLOSED"

# Risk levels per permit type
PERMIT_RISK = {
    PermitType.HOT_WORK: "HIGH",
    PermitType.ELECTRICAL_ISOLATION: "HIGH",
    PermitType.CONFINED_SPACE_ENTRY: "CRITICAL",
    PermitType.GENERAL_MAINTENANCE: "MEDIUM",
    PermitType.EMERGENCY_SHUTDOWN: "CRITICAL"
}

# Typical duration hours per permit type
PERMIT_DURATION = {
    PermitType.HOT_WORK: (2, 8),
    PermitType.ELECTRICAL_ISOLATION: (4, 12),
    PermitType.CONFINED_SPACE_ENTRY: (1, 4),
    PermitType.GENERAL_MAINTENANCE: (2, 16),
    PermitType.EMERGENCY_SHUTDOWN: (1, 6)
}

ISSUER_NAMES = [
    "Safety Officer Chen", "Engineer Patel", "Supervisor Rodriguez",
    "Inspector Müller", "Lead Engineer Park", "HSE Manager Singh",
    "Shift Supervisor Al-Rashid", "Maintenance Lead Okonkwo"
]

class PermitGenerator:
    """Generates realistic permit-to-work records with conflict scenarios."""

    def __init__(self):
        self.permits: List[Dict] = []
        self.zones = [z["zone_id"] for z in FACILITY_CONFIG["zones"]]
        self.asset_ids = [a["asset_id"] for a in ASSETS]
        self._permit_counter = 1000
        random.seed(42)

        # Pre-generate a set of permits representing current day
        self._generate_base_permits()

    def _next_permit_id(self) -> str:
        pid = f"PTW-{self._permit_counter}"
        self._permit_counter += 1
        return pid

    def _get_zone_assets(self, zone_id: str) -> List[str]:
        return [a["asset_id"] for a in ASSETS if a["zone_id"] == zone_id]

    def _generate_conditions(self, permit_type: str) -> List[str]:
        """Standard conditions per permit type."""
        base_conditions = [
            "Area must be cordoned with safety tape",
            "Emergency equipment must be accessible",
            "Permit holder must brief all involved personnel"
        ]

        type_conditions = {
            PermitType.HOT_WORK: [
                "Fire watch personnel must be stationed",
                "Fire extinguisher must be within 5 meters",
                "Hot work to cease immediately if gas alarm activates",
                "All gas concentration readings must be < 10 ppm before work begins"
            ],
            PermitType.ELECTRICAL_ISOLATION: [
                "LOTO (Lockout-Tagout) procedure must be completed",
                "Isolation must be verified by two-person rule",
                "Arc flash PPE required (Category 2 minimum)"
            ],
            PermitType.CONFINED_SPACE_ENTRY: [
                "Atmospheric testing required before entry (O2, combustibles, toxics)",
                "Ventilation must be continuous during work",
                "Rescue team must be on standby",
                "Communication device required for entrant"
            ],
            PermitType.GENERAL_MAINTENANCE: [
                "Asset must be in MAINTENANCE state before work begins",
                "Isolation from energy sources must be confirmed"
            ],
            PermitType.EMERGENCY_SHUTDOWN: [
                "Control room must be notified before initiating",
                "Area evacuation must be completed",
                "Emergency response team on standby"
            ]
        }

        return base_conditions + type_conditions.get(permit_type, [])

    def create_permit(
        self,
        permit_type: str,
        zone_id: str,
        asset_ids: Optional[List[str]] = None,
        status: str = PermitStatus.ACTIVE,
        hours_offset: float = 0,  # Hours from now (negative = started in past)
        duration_hours: Optional[float] = None
    ) -> Dict:
        """Create a single permit record."""
        now = datetime.utcnow()
        issued_at = now + timedelta(hours=hours_offset)

        dur_min, dur_max = PERMIT_DURATION.get(permit_type, (4, 8))
        if duration_hours is None:
            duration_hours = random.uniform(dur_min, dur_max)

        valid_until = issued_at + timedelta(hours=duration_hours)

        # Auto-determine status
        if status == PermitStatus.ACTIVE:
            if now < issued_at:
                status = PermitStatus.PENDING
            elif now > valid_until:
                status = PermitStatus.EXPIRED

        if asset_ids is None:
            zone_assets = self._get_zone_assets(zone_id)
            num_assets = random.randint(1, min(3, len(zone_assets)))
            asset_ids = random.sample(zone_assets, num_assets) if zone_assets else []

        permit = {
            "permit_id": self._next_permit_id(),
            "type": permit_type,
            "zone_id": zone_id,
            "asset_ids": asset_ids,
            "issued_by": random.choice(ISSUER_NAMES),
            "valid_from": issued_at.isoformat() + "Z",
            "valid_until": valid_until.isoformat() + "Z",
            "status": status,
            "risk_level": PERMIT_RISK.get(permit_type, "MEDIUM"),
            "conditions": self._generate_conditions(permit_type),
            "work_description": self._work_description(permit_type, zone_id),
            "personnel_authorized": [f"Worker-{random.randint(100, 150):03d}" for _ in range(random.randint(1, 4))],
            "created_at": issued_at.isoformat() + "Z",
            "facility_id": FACILITY_CONFIG["facility_id"]
        }
        self.permits.append(permit)
        return permit

    def _work_description(self, permit_type: str, zone_id: str) -> str:
        descriptions = {
            PermitType.HOT_WORK: f"Welding and cutting operations in {zone_id} for pipeline modification",
            PermitType.ELECTRICAL_ISOLATION: f"Electrical isolation of switchgear panel in {zone_id} for breaker replacement",
            PermitType.CONFINED_SPACE_ENTRY: f"Internal inspection of vessel in {zone_id} — sediment removal",
            PermitType.GENERAL_MAINTENANCE: f"Scheduled preventive maintenance on rotating equipment in {zone_id}",
            PermitType.EMERGENCY_SHUTDOWN: f"Emergency shutdown and isolation of {zone_id} due to operational anomaly"
        }
        return descriptions.get(permit_type, f"Maintenance activity in {zone_id}")

    def _generate_base_permits(self):
        """Generate a realistic set of permits for the current day."""
        # Normal permits across zones (currently active)
        for zone_id in self.zones:
            # General maintenance (common, always running)
            self.create_permit(
                PermitType.GENERAL_MAINTENANCE,
                zone_id,
                hours_offset=-random.uniform(1, 3),
                duration_hours=random.uniform(6, 12)
            )

        # A few specialized permits
        self.create_permit(PermitType.HOT_WORK, "ZONE-01", hours_offset=-1, duration_hours=6)
        self.create_permit(PermitType.ELECTRICAL_ISOLATION, "ZONE-03", hours_offset=-2, duration_hours=8)
        self.create_permit(PermitType.CONFINED_SPACE_ENTRY, "ZONE-04", hours_offset=-0.5, duration_hours=3)

        # Pending permits (future)
        self.create_permit(PermitType.HOT_WORK, "ZONE-02", hours_offset=2, duration_hours=4, status=PermitStatus.PENDING)
        self.create_permit(PermitType.GENERAL_MAINTENANCE, "ZONE-06", hours_offset=1, duration_hours=8, status=PermitStatus.PENDING)

        # Some expired permits for history
        for _ in range(5):
            zone = random.choice(self.zones)
            ptype = random.choice([PermitType.HOT_WORK, PermitType.GENERAL_MAINTENANCE])
            self.create_permit(ptype, zone, hours_offset=-12, duration_hours=4, status=PermitStatus.EXPIRED)

    def inject_conflict_scenario(self, scenario: str, zone_id: str = "ZONE-02") -> Dict:
        """
        [Innovation] Inject a specific conflict scenario for demo purposes.
        These conflicts are intentionally created to trigger compound detection.
        """
        injected = []

        if scenario == "HOT_WORK_GAS_CONFLICT":
            # HOT_WORK permit active in same zone as rising gas concentration
            permit = self.create_permit(
                PermitType.HOT_WORK,
                zone_id,
                hours_offset=-0.5,
                duration_hours=6,
                status=PermitStatus.ACTIVE
            )
            injected.append(permit)

        elif scenario == "CONFINED_SPACE_VENTILATION":
            # CONFINED_SPACE permit with inadequate ventilation signal
            permit = self.create_permit(
                PermitType.CONFINED_SPACE_ENTRY,
                zone_id,
                hours_offset=-0.25,
                duration_hours=3,
                status=PermitStatus.ACTIVE
            )
            injected.append(permit)

        elif scenario == "SIMULTANEOUS_ISOLATION":
            # Two ELECTRICAL_ISOLATION permits on same zone
            for _ in range(2):
                permit = self.create_permit(
                    PermitType.ELECTRICAL_ISOLATION,
                    zone_id,
                    hours_offset=-random.uniform(0.1, 0.5),
                    duration_hours=8,
                    status=PermitStatus.ACTIVE
                )
                injected.append(permit)

        elif scenario == "MAINTENANCE_DURING_ANOMALY":
            permit = self.create_permit(
                PermitType.GENERAL_MAINTENANCE,
                zone_id,
                hours_offset=-0.5,
                duration_hours=6,
                status=PermitStatus.ACTIVE
            )
            injected.append(permit)

        return {"scenario": scenario, "injected_permits": injected}

    def get_active_permits(self) -> List[Dict]:
        now = datetime.utcnow()
        return [
            p for p in self.permits
            if p["status"] == PermitStatus.ACTIVE
            and datetime.fromisoformat(p["valid_from"].rstrip("Z")) <= now
            and datetime.fromisoformat(p["valid_until"].rstrip("Z")) >= now
        ]

    def get_permits_by_zone(self, zone_id: str) -> List[Dict]:
        return [p for p in self.permits if p["zone_id"] == zone_id]

    def get_all_permits(self) -> List[Dict]:
        return self.permits

    def clear_conflict_permits(self):
        """Remove injected conflict permits (keep base permits)."""
        self.permits = self.permits[:20]  # Keep first 20 (base set)
        return {"cleared": True}

    def suspend_permit(self, permit_id: str) -> Dict:
        for p in self.permits:
            if p["permit_id"] == permit_id:
                p["status"] = PermitStatus.SUSPENDED
                return {"suspended": permit_id}
        return {"error": f"Permit {permit_id} not found"}


if __name__ == "__main__":
    gen = PermitGenerator()
    active = gen.get_active_permits()
    print(f"=== Permit Generator Demo ===")
    print(f"Total permits: {len(gen.permits)}")
    print(f"Active permits: {len(active)}")
    print()
    for p in active[:3]:
        print(json.dumps(p, indent=2))
        print()

    # Demo conflict injection
    print("\n=== Injecting HOT_WORK_GAS_CONFLICT in ZONE-02 ===")
    result = gen.inject_conflict_scenario("HOT_WORK_GAS_CONFLICT", "ZONE-02")
    print(f"Injected: {result['injected_permits'][0]['permit_id']} in {result['injected_permits'][0]['zone_id']}")
