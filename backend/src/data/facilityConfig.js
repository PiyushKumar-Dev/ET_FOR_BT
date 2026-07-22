/**
 * Facility config mirror for backend (Node.js-compatible JSON).
 * Mirrors data-generators/facility_config.py without Python dependency.
 */

const FACILITY_CONFIG = {
  facility_id: 'FAC-001',
  facility_name: 'Alpha Processing Facility',
  location: { lat: 19.0760, lng: 72.8777 },
  zones: [
    { zone_id: 'ZONE-01', name: 'Primary Processing Area', area_sqm: 2500, max_occupancy: 20,
      lat_lng_bounds: [[19.0750, 72.8760], [19.0770, 72.8790]] },
    { zone_id: 'ZONE-02', name: 'Secondary Processing Area', area_sqm: 1800, max_occupancy: 15,
      lat_lng_bounds: [[19.0770, 72.8790], [19.0785, 72.8820]] },
    { zone_id: 'ZONE-03', name: 'Utility Zone', area_sqm: 1200, max_occupancy: 10,
      lat_lng_bounds: [[19.0785, 72.8760], [19.0800, 72.8820]] },
    { zone_id: 'ZONE-04', name: 'Storage Area', area_sqm: 3000, max_occupancy: 8,
      lat_lng_bounds: [[19.0750, 72.8820], [19.0800, 72.8860]] },
    { zone_id: 'ZONE-05', name: 'Control Room', area_sqm: 400, max_occupancy: 5,
      lat_lng_bounds: [[19.0755, 72.8860], [19.0775, 72.8880]] },
    { zone_id: 'ZONE-06', name: 'Maintenance Workshop', area_sqm: 800, max_occupancy: 12,
      lat_lng_bounds: [[19.0775, 72.8860], [19.0800, 72.8880]] }
  ],
  assets: [] // Will be populated from agent data
};

// Generate 106 assets matching Python facility_config
const ASSET_TYPES_PER_ZONE = {
  'ZONE-01': [['ROTATING', 8], ['STATIC', 6], ['ELECTRICAL', 3], ['ENVIRONMENTAL', 2]],
  'ZONE-02': [['ROTATING', 6], ['STATIC', 8], ['ELECTRICAL', 2], ['ENVIRONMENTAL', 2]],
  'ZONE-03': [['ROTATING', 4], ['STATIC', 4], ['ELECTRICAL', 6], ['ENVIRONMENTAL', 3]],
  'ZONE-04': [['ROTATING', 2], ['STATIC', 10], ['ELECTRICAL', 2], ['ENVIRONMENTAL', 2]],
  'ZONE-05': [['ROTATING', 0], ['STATIC', 2], ['ELECTRICAL', 8], ['ENVIRONMENTAL', 2]],
  'ZONE-06': [['ROTATING', 5], ['STATIC', 3], ['ELECTRICAL', 3], ['ENVIRONMENTAL', 2]]
};

let counter = 1;
for (const [zone_id, typeCounts] of Object.entries(ASSET_TYPES_PER_ZONE)) {
  for (const [asset_type, count] of typeCounts) {
    for (let i = 0; i < count; i++) {
      const letter = String.fromCharCode(65 + Math.floor(counter / 10));
      const asset_id = `ASSET-${letter}${String(counter % 100).padStart(2, '0')}`;
      FACILITY_CONFIG.assets.push({
        asset_id,
        zone_id,
        asset_type,
        name: `${asset_type.charAt(0) + asset_type.slice(1).toLowerCase()} Unit ${String(counter).padStart(3, '0')}`
      });
      counter++;
    }
  }
}

module.exports = FACILITY_CONFIG;
