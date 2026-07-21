/**
 * Database seed service — populates initial facility data.
 */
const { Zone, Asset } = require('../models/index');
const FACILITY_CONFIG = require('../data/facilityConfig');

async function seedDatabase() {
  const zoneCount = await Zone.countDocuments();
  if (zoneCount === 0) {
    const zones = FACILITY_CONFIG.zones.map(z => ({
      zone_id: z.zone_id,
      name: z.name,
      area_sqm: z.area_sqm,
      max_occupancy: z.max_occupancy,
      current_risk_score: 0,
      current_status: 'NORMAL',
      lat_lng_bounds: z.lat_lng_bounds,
      facility_id: 'FAC-001'
    }));
    await Zone.insertMany(zones, { ordered: false }).catch(() => {});
    console.log(`[Seed] Inserted ${zones.length} zones`);
  }

  const assetCount = await Asset.countDocuments();
  if (assetCount === 0) {
    const assets = FACILITY_CONFIG.assets.map(a => ({
      asset_id: a.asset_id,
      zone_id: a.zone_id,
      asset_type: a.asset_type,
      name: a.name,
      equipment_status: 'RUNNING',
      health_score: 85 + Math.floor(Math.random() * 15),
      risk_score: Math.floor(Math.random() * 30),
      last_maintenance: new Date('2024-06-01'),
      failure_history_count: Math.floor(Math.random() * 3),
      facility_id: 'FAC-001'
    }));
    await Asset.insertMany(assets, { ordered: false }).catch(() => {});
    console.log(`[Seed] Inserted ${assets.length} assets`);
  }
}

module.exports = { seedDatabase };
