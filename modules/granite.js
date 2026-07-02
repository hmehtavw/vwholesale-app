/* === tiles_granite.js === */

// ============================================================
// V WHOLESALE — TILE QUOTATION SYSTEM v2
// Complete flow: Rooms → Tile Size → Spacer → Adhesive →
//   Beading → Brand/Stock (dead stock priority) → Grout →
//   Summary + T&C + Sanitary suggestions
// SEPARATE from main Quotations — standalone module
// ============================================================

// ───── ALL STANDARD TILE SIZES ─────────────────────────────
const TILE_SIZES = [
  // Small / mosaic
  { id:'s1',  mm:'100×100',  inch:'4×4',    ft:0.111, label:'100×100mm (4×4")',    type:['wall','dado'],                   adhesive:'cement_mix', minBoxBoxes:1 },
  { id:'s2',  mm:'150×150',  inch:'6×6',    ft:0.167, label:'150×150mm (6×6")',    type:['wall','dado'],                   adhesive:'cement_mix' },
  { id:'s3',  mm:'200×200',  inch:'8×8',    ft:0.222, label:'200×200mm (8×8")',    type:['wall','floor'],                  adhesive:'cement_mix' },
  { id:'s4',  mm:'200×300',  inch:'8×12"',  ft:0.222, label:'200×300mm (8×12")',   type:['wall','dado','kitchen'],         adhesive:'cement_mix' },
  // Standard wall
  { id:'s5',  mm:'250×375',  inch:'10×15"', ft:0.278, label:'250×375mm (10×15")',  type:['wall','bathroom'],               adhesive:'cement_mix' },
  { id:'s6',  mm:'300×300',  inch:'12×12"', ft:0.333, label:'300×300mm (12×12")',  type:['floor','wall','bathroom'],       adhesive:'cement_mix' },
  { id:'s7',  mm:'300×450',  inch:'12×18"', ft:0.333, label:'300×450mm (12×18")',  type:['wall','bathroom','kitchen'],     adhesive:'cement_mix' },
  { id:'s8',  mm:'300×600',  inch:'12×24"', ft:0.333, label:'300×600mm (12×24")',  type:['wall','bathroom'],               adhesive:'cement_mix' },
  // Medium
  { id:'s9',  mm:'400×400',  inch:'16×16"', ft:0.444, label:'400×400mm (16×16")',  type:['floor','parking'],               adhesive:'cement_mix' },
  { id:'s10', mm:'400×800',  inch:'16×32"', ft:0.444, label:'400×800mm (16×32")',  type:['wall','floor'],                  adhesive:'cement_mix' },
  { id:'s11', mm:'450×900',  inch:'18×36"', ft:0.5,   label:'450×900mm (18×36")', type:['wall','floor'],                  adhesive:'tile_adhesive' },
  // Large format
  { id:'s12', mm:'600×600',  inch:'2×2 ft', ft:0.667, label:'600×600mm (2×2 ft)', type:['floor','parking','elevation'],   adhesive:'tile_adhesive' },
  { id:'s13', mm:'600×900',  inch:'2×3 ft', ft:0.667, label:'600×900mm (2×3 ft)', type:['floor','wall','elevation'],      adhesive:'tile_adhesive' },
  { id:'s14', mm:'600×1200', inch:'2×4 ft', ft:0.667, label:'600×1200mm (2×4 ft)',type:['floor','wall','elevation'],      adhesive:'tile_adhesive_plus' },
  { id:'s15', mm:'800×800',  inch:'32×32"', ft:0.889, label:'800×800mm (32×32")', type:['floor','elevation'],             adhesive:'tile_adhesive' },
  { id:'s16', mm:'800×1600', inch:'32×64"', ft:0.889, label:'800×1600mm (32×64")',type:['floor','wall','elevation'],      adhesive:'tile_adhesive_plus' },
  // Slab format
  { id:'s17', mm:'1000×1000',inch:'40×40"', ft:1.111, label:'1000×1000mm (40×40")',type:['floor','elevation'],            adhesive:'epoxy_adhesive' },
  { id:'s18', mm:'1200×1200',inch:'4×4 ft', ft:1.333, label:'1200×1200mm (4×4 ft)',type:['floor','elevation'],            adhesive:'epoxy_adhesive' },
  { id:'s19', mm:'1200×1800',inch:'4×6 ft', ft:1.333, label:'1200×1800mm (4×6 ft)',type:['wall','elevation'],             adhesive:'epoxy_adhesive' },
  { id:'s20', mm:'1200×2400',inch:'4×8 ft', ft:1.333, label:'1200×2400mm (4×8 ft)',type:['wall','elevation'],             adhesive:'epoxy_adhesive' },
  // Large slab sizes (also active in tile_weight_config)
  { id:'s21', mm:'2400×800', inch:'8×2.5 ft',ft:1.667, label:'2400×800mm (Slab)',   type:['floor','elevation'],           adhesive:'epoxy_adhesive' },
  { id:'s22', mm:'3000×800', inch:'10×2.5 ft',ft:1.667,label:'3000×800mm (Slab)',   type:['floor','elevation'],           adhesive:'epoxy_adhesive' },
  { id:'s23', mm:'800×2400', inch:'2.5×8 ft',ft:1.667, label:'800×2400mm (Slab)',   type:['wall','elevation'],            adhesive:'epoxy_adhesive' },
];

// ───── ADHESIVE TYPES ──────────────────────────────────────
const ADHESIVE_TYPES = {
  cement_mix: {
    label: 'Cement + Sand Mix',
    ratio: '1:4 (1 part cement : 4 parts sand)',
    note: 'For tiles below 600mm. Mix on site.',
    coverage_sqft_per_50kg_cement: 120,
    sand_bags_per_cement_bag: 4,
  },
  tile_adhesive: {
    label: 'Ready-mix Tile Adhesive (C1 grade)',
    ratio: 'As per manufacturer instructions',
    note: 'Required for tiles ≥ 600mm. One bag covers ~35 sqft wall / 45 sqft floor.',
    coverage_wall_sqft: 35,
    coverage_floor_sqft: 45,
  },
  tile_adhesive_plus: {
    label: 'Heavy Duty Tile Adhesive (C2 grade)',
    ratio: 'As per manufacturer instructions',
    note: 'Required for large format (>600×1200mm) and vitrified. One bag covers ~30 sqft.',
    coverage_sqft: 30,
  },
  epoxy_adhesive: {
    label: 'Epoxy Tile Adhesive (R2 grade)',
    ratio: '1:1 resin:hardener mix',
    note: 'For slabs > 1000mm, wet areas, and natural stone. One kit covers ~20 sqft.',
    coverage_sqft: 20,
  },
};

// ─── BEADING: 3 materials, colour from inventory ────────────
// SS: premium, rust-proof, wet areas | Aluminium: budget, dry areas | PVC: economy, flexible
const BEADING_CATALOG = [
  { id:'ss_8',  name:'SS Corner Bead 8mm',          material:'SS',        size:8,  finish:'Silver', note:'Wet areas · Does not rust · Premium', rmsPerMeter:1 },
  { id:'ss_10', name:'SS Corner Bead 10mm',          material:'SS',        size:10, finish:'Silver', note:'Standard wall/floor choice · Durable',  rmsPerMeter:1 },
  { id:'ss_12', name:'SS Corner Bead 12mm',          material:'SS',        size:12, finish:'Silver', note:'Thick tiles ≥10mm · Elevation',          rmsPerMeter:1 },
  { id:'al_8',  name:'Aluminium Bead 8mm',           material:'Aluminium', size:8,  finish:'Silver', note:'Budget · Anodised · Dry areas',           rmsPerMeter:1 },
  { id:'al_10', name:'Aluminium Bead 10mm',          material:'Aluminium', size:10, finish:'Silver', note:'Living room/bedroom · Popular size',       rmsPerMeter:1 },
  { id:'al_12', name:'Aluminium Bead 12mm',          material:'Aluminium', size:12, finish:'Silver', note:'Large format tiles · Elevation frames',    rmsPerMeter:1 },
  { id:'pv_8',  name:'PVC Corner Bead 8mm',          material:'PVC',       size:8,  finish:'White',  note:'Economy · Flexible for curves',            rmsPerMeter:1 },
  { id:'pv_10', name:'PVC Corner Bead 10mm',         material:'PVC',       size:10, finish:'White',  note:'Most popular economy bead',                rmsPerMeter:1 },
  { id:'sn_al', name:'Stair Nosing Aluminium 40mm',  material:'Aluminium', size:40, finish:'Silver', note:'Stairs · Anti-skid · Safety',              rmsPerMeter:1 },
  { id:'sn_ss', name:'Stair Nosing SS 40mm',         material:'SS',        size:40, finish:'Silver', note:'Premium stairs · Outdoor/wet',             rmsPerMeter:1 },
];

// ───── ROOM TYPE DEFINITIONS ────────────────────────────────
// measureType: floor_lw | wall_hw | bathroom | floor_lw_skirting
const ROOM_DEFS = {
  'Living Room':       { icon:'🛋', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Drawing Hall':      { icon:'🏛', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Dining Room':       { icon:'🍽', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Master Bedroom':    { icon:'🛏', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Bedroom':           { icon:'🛏', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Kids Room':         { icon:'🧒', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Kitchen':           { icon:'🍳', measureType:'bathroom', areaType:'both', note:'Floor (L×W) + Wall sections (H×W)' },
  'Bathroom':          { icon:'🚿', measureType:'bathroom', areaType:'both', note:'4 walls (H×W) + floor (L×W)' },
  'Toilet':            { icon:'🚽', measureType:'bathroom', areaType:'both', note:'4 walls + floor' },
  'Wash Area':         { icon:'🫧', measureType:'bathroom', areaType:'both', note:'Floor (L×W) + Wall sections (H×W)' },
  'Balcony':           { icon:'🌿', measureType:'bathroom', areaType:'both', note:'Floor (L×W) + Wall sections (H×W)' },
  'Parking':           { icon:'🚗', measureType:'floor_lw', areaType:'floor', note:'L × W' },
  'Pooja Room':        { icon:'🪔', measureType:'bathroom', areaType:'both', note:'Floor (L×W) + Wall sections (H×W)' },
  'Elevation / Exterior': { icon:'🏠', measureType:'wall_hw', areaType:'wall', note:'H × W (external facade)' },
  'Staircase':         { icon:'🪜', measureType:'staircase', areaType:'floor', note:'Step W × Depth × No. of steps' },
  'Terrace / Outdoor': { icon:'☀️', measureType:'floor_lw', areaType:'floor', note:'L × W' },
  'Corridor / Passage':{ icon:'🚶', measureType:'floor_lw_skirting', areaType:'floor', note:'L × W + optional skirting' },
  'Store Room':        { icon:'📦', measureType:'floor_lw', areaType:'floor', note:'L × W' },
  'Custom Area':       { icon:'➕', measureType:'custom', areaType:'floor', note:'Describe area + L × W' },
};

// ───── STATE ────────────────────────────────────────────────
let _tqState = {
    step: 0,
    customer: { name:'', phone:'', site:'', id:null },
    contractor: null,
    rooms: [],
    currentFlat: '',
    tileSelections: {},
    spacerSelections: {},
    adhesiveSelections: {},
    beading: [],
    groutSelections: {},
    quotedPrices: {},
    accessories: [],
    floorTraps: [],
    soffit: {enabled:false},
    delivery: {type:'self', distanceKm:0, floors:[], beyondFt:false, siteAddress:''},
    laborRequired: null,
    addons: {},
    wallDesigns: {},
    _inWallDesign: false,
    _designSlot: null,
    currentRoomIdx: 0,
  };

// Cached configs for the (synchronous) spacer/adhesive steps — loaded at quotation entry.
let _tqSizeCfg = { sizes: [] };
let _tqSpacerCfg = { pcs_per_packet:100, clip_pcs_per_packet:50, spacers_per_tile:4, min_size_mm:300 };

let _tqResumeData = null;
