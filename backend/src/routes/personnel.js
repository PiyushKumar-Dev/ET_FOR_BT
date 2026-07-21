const express = require('express');
const router = express.Router();

// Synthetic personnel data (populated by IoT/Vision agent context)
const PERSONNEL = [];
for (let i = 1; i <= 55; i++) {
  const zones = ['ZONE-01','ZONE-02','ZONE-03','ZONE-04','ZONE-05','ZONE-06'];
  const roles = ['Process Operator','Maintenance Technician','Electrical Engineer','Safety Officer','Contractor'];
  PERSONNEL.push({
    personnel_id: `PER-${String(i).padStart(3,'0')}`,
    name: `Worker-${String(i).padStart(3,'0')}`,
    role: roles[i % roles.length],
    zone_id: zones[i % zones.length],
    shift: ['MORNING','AFTERNOON','NIGHT'][i % 3],
    ppe_compliant: Math.random() > 0.15,
    active: i % 3 !== 2  // Night shift not active
  });
}

router.get('/active', (req, res) => {
  const { zone_id } = req.query;
  let active = PERSONNEL.filter(p => p.active);
  if (zone_id) active = active.filter(p => p.zone_id === zone_id);
  res.json({ personnel: active, count: active.length, timestamp: new Date().toISOString() });
});

module.exports = router;
