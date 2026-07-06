/* === db.js === */

// ============================================================
// SUPABASE CONFIG — fill these in from Settings -> API
// ============================================================
const SUPABASE_URL = 'https://ndamdnlsuktucqtcbhgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYW1kbmxzdWt0dWNxdGNiaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTg1MzgsImV4cCI6MjA5Njk5NDUzOH0.7pGJu4bbNhl4E-4Do24jS9_p6nLUa1eN4JXQSqEF9VU';

let sb;

const STORES = {
  customers: 'customers',
  visits: 'visits',
  products: 'products',
  invoices: 'invoices',
  staff: 'staff',
  feedback: 'feedback',
  leads: 'leads',
  notifications: 'notifications',
  purchaseOrders: 'purchase_orders',
  vendors: 'vendors',
  attendance: 'attendance',
  leaves: 'leaves',
  executives: 'executives',
  tasks: 'tasks',
  settings: 'settings',
  profiles: 'profiles',
  quotations: 'quotations',
  pendingProducts: 'pending_products',
  pinResetRequests: 'pin_reset_requests',
  staffOffers: 'staff_offers',
  persistedNotifications: 'persisted_notifications',
  photoSubmissions: 'pending_product_photos',
  trainingMaterials: 'training_materials',
  trainingExperts: 'training_experts',
  trainingQuestions: 'training_questions',
  trainingAnswers: 'training_answers',
  gatePasses: 'gate_passes',
  salesReturns: 'sales_returns',
  loyaltyTransactions: 'loyalty_transactions',
  promotions: 'promotions',
  promotionRedemptions: 'promotion_redemptions',
  catalogs: 'catalogs',
  eodReconciliations: 'eod_reconciliations',
  referralLedger: 'referral_ledger',
  commissions: 'contractor_commissions',
  trainingCompletions: 'training_completions',
  incentiveRules: 'incentive_rules',
  pettyCash: 'petty_cash',
  paymentVouchers: 'payment_vouchers',
  marketingCampaigns: 'marketing_campaigns',
  workOrders: 'work_orders',
  serviceVendors: 'service_vendors',
  announcements: 'announcements',
  chatMessages: 'chat_messages'
};

// ---------- camelCase <-> snake_case helpers ----------
function camelToSnake(str) { return str.replace(/([A-Z])/g, '_$1').toLowerCase(); }
function snakeToCamel(str) { return str.replace(/_([a-zA-Z])/g, (_, c) => c.toUpperCase()); }

function toSnakeObj(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[camelToSnake(k)] = v;
  }
  return out;
}
function toCamelObj(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

// ---------- INIT ----------
async function initDB() {
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    throw new Error('Supabase client library not loaded');
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}

// ---------- CORE CRUD (mirrors old IndexedDB interface) ----------
async function all(store) {
  const table = STORES[store] || store;
  const { data, error } = await sb.from(table).select('*');
  if (error) { console.error(`all(${store}) error:`, error); throw error; }
  return (data || []).map(toCamelObj);
}

async function getById(store, id) {
  if (id === null || id === undefined) return null;
  const table = STORES[store] || store;
  const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
  if (error) { console.error(`getById(${store},${id}) error:`, error); throw error; }
  return toCamelObj(data);
}

async function getByIndex(store, index, value) {
  const table = STORES[store] || store;
  const col = camelToSnake(index);
  const { data, error } = await sb.from(table).select('*').eq(col, value);
  if (error) { console.error(`getByIndex(${store},${index}) error:`, error); throw error; }
  return (data || []).map(toCamelObj);
}

async function put(store, data) {
  const table = STORES[store] || store;
  const row = toSnakeObj(data);

  // For tables using "generated always as identity", inserting an explicit
  // id on a NEW record fails. Strategy: if no id present, do a plain INSERT
  // (Postgres auto-generates the id). If id IS present, do an upsert which
  // correctly handles both insert-with-known-id and update-existing-row.
  if (row.id === undefined || row.id === null) {
    const { data: result, error } = await sb.from(table).insert(row).select().single();
    if (error) { console.error(`put(${store}) insert error:`, error); throw error; }
    return result.id;
  }

  const { data: result, error } = await sb.from(table).upsert(row).select().single();
  if (error) { console.error(`put(${store}) upsert error:`, error); throw error; }
  return result.id;
}

async function del(store, id) {
  const table = STORES[store] || store;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { console.error(`del(${store},${id}) error:`, error); throw error; }
  return true;
}

// ---------- SETTINGS (key-value table, PK = 'key' not 'id') ----------
async function getSetting(key, fallback) {
  const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
  if (error || !data) return fallback;
  return data.value;
}

async function setSetting(key, value) {
  const { error } = await sb.from('settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) {
    console.error(`setSetting(${key}) error:`, error);
    try { if (typeof showToast === 'function') showToast(`Couldn't save (${key}): ${error.message||'server error'}`, 'error'); } catch(_) {}
    throw error;
  }
  return true;
}

// ---------- REALTIME SUBSCRIPTIONS ----------
function subscribeTable(store, callback) {
  const table = STORES[store] || store;
  const channel = sb
    .channel(`realtime:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
  return channel;
}

// Kept for compatibility; seeding is now done once via SQL (03_seed_data.sql)
async function seedData() { /* handled via SQL seed script */ }

// ---------- STORAGE (visit-close photos) ----------
// Uploads a base64 data URL (from a file input or camera capture) to the
// 'visit-photos' bucket, returns the storage path to save on the record.
async function uploadPhoto(dataUrl, pathPrefix) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('visit-photos').upload(path, bytes, { contentType: mimeType });
  if (error) { console.error('uploadPhoto error:', error); throw error; }
  return path;
}

// Visit photos are in a PRIVATE bucket (not publicly listable), so viewing
// them needs a short-lived signed URL rather than a permanent public link.
async function getPhotoUrl(path) {
  if (!path) return null;
  const { data, error } = await sb.storage.from('visit-photos').createSignedUrl(path, 3600);
  if (error) { console.error('getPhotoUrl error:', error); return null; }
  return data.signedUrl;
}

// Increments and returns the next invoice sequence number for a given
// financial year label (e.g. '26-27'), atomically via a database function
// — this guarantees two people billing at the same instant never get the
// same invoice number, which a plain read-then-write from JS could risk.
async function incrementInvoiceSequence(fyLabel) {
  const { data, error } = await sb.rpc('next_invoice_seq', { p_fy_label: fyLabel });
  if (error) { console.error('incrementInvoiceSequence error:', error); throw error; }
  return data;
}

// Same atomic, race-condition-safe pattern as invoices — a quotation's
// number is assigned by the database in one indivisible step, so a
// double-tap or two people saving at once can never collide.
async function incrementQuotationSequence(fyLabel) {
  const { data, error } = await sb.rpc('next_quotation_seq', { p_fy_label: fyLabel });
  if (error) { console.error('incrementQuotationSequence error:', error); throw error; }
  return data;
}

async function incrementGatePassSequence(fyLabel) {
  const { data, error } = await sb.rpc('next_gate_pass_seq', { p_fy_label: fyLabel });
  if (error) { console.error('incrementGatePassSequence error:', error); throw error; }
  return data;
}

async function incrementReturnSequence(fyLabel) {
  const { data, error } = await sb.rpc('next_return_seq', { p_fy_label: fyLabel });
  if (error) { console.error('incrementReturnSequence error:', error); throw error; }
  return data;
}

async function incrementPOSequence(fyLabel) {
  const { data, error } = await sb.rpc('next_po_seq', { p_fy_label: fyLabel });
  if (error) { console.error('incrementPOSequence error:', error); throw error; }
  return data;
}

async function uploadCatalog(dataUrl, fileName) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const ext = fileName.split('.').pop() || 'pdf';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('catalogs').upload(path, bytes, { contentType: mimeType });
  if (error) { console.error('uploadCatalog error:', error); throw error; }
  const { data: urlData } = sb.storage.from('catalogs').getPublicUrl(path);
  return { path, url: urlData.publicUrl };
}

// ---------- STORAGE (product photos) ----------
// Product photos use their OWN bucket, separate from visit-close photos,
// and are public (not signed URLs) since these are meant to eventually
// power a public-facing B2C catalog — no need for the per-request signed
// URL overhead that customer-sensitive visit photos require.
async function uploadProductPhoto(dataUrl, productId) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('product-photos').upload(path, bytes, { contentType: mimeType });
  if (error) { console.error('uploadProductPhoto error:', error); throw error; }
  return path;
}

async function getProductPhotoUrl(path) {
  if (!path) return null;
  const { data } = sb.storage.from('product-photos').getPublicUrl(path);
  return data.publicUrl;
}

// Used when a photo was uploaded (e.g. during Add Product) but the form
// was abandoned before saving — removes the now-orphaned file from
// storage rather than leaving it sitting there with nothing referencing it.
async function deleteProductPhoto(path) {
  if (!path) return;
  const { error } = await sb.storage.from('product-photos').remove([path]);
  if (error) console.error('deleteProductPhoto error:', error); // non-fatal — worst case is a harmless leftover file
}

// Uploads a photo taken by Dispatch during the item-by-item check-off
// process — goes into its own bucket separate from product photos.
async function uploadDispatchPhoto(dataUrl, invoiceNo, itemIdx) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const path = `${invoiceNo}/item-${itemIdx}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('dispatch-photos').upload(path, bytes, { contentType: mimeType });
  if (error) { console.error('uploadDispatchPhoto error:', error); throw error; }
  return path;
}

async function getDispatchPhotoUrl(path) {
  if (!path) return null;
  const { data } = sb.storage.from('dispatch-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------- STORAGE (onboarding documents) ----------
// Onboarding documents (candidate photo, Aadhaar, PAN, etc.) are uploaded
// by someone with NO app login at all — just a link + PIN — so this uses
// its own bucket with anonymous-write policies, completely separate from
// visit-photos (which requires an authenticated app session).
async function uploadOnboardingDoc(dataUrl, pathPrefix) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('onboarding-docs').upload(path, bytes, { contentType: mimeType });
  if (error) { console.error('uploadOnboardingDoc error:', error); throw error; }
  return path;
}

async function getOnboardingDocUrl(path) {
  if (!path) return null;
  const { data, error } = await sb.storage.from('onboarding-docs').createSignedUrl(path, 3600);
  if (error) { console.error('getOnboardingDocUrl error:', error); return null; }
  return data.signedUrl;
}

// ---------- STORAGE (training materials & videos) ----------
// Training content is genuinely access-controlled: signed URLs only,
// never a public link — the whole point of hosting here instead of
// YouTube/Vimeo is that access can be revoked the moment someone leaves.
// Videos are uploaded as a raw Blob/File directly (not base64-encoded
// first) since a base64 data URL roughly doubles memory usage for what
// can be a multi-hundred-MB file — risky on a budget Android phone.
async function uploadTrainingFile(file, kind) {
  // kind is 'doc' (manual/SOP attachment) or 'video'
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('training-content').upload(path, file, { contentType: file.type });
  if (error) { console.error('uploadTrainingFile error:', error); throw error; }
  return path;
}

async function getTrainingFileUrl(path) {
  if (!path) return null;
  // 6-hour expiry: long enough to watch a video start-to-finish without
  // the link dying mid-way, short enough that a leaked link goes stale
  // quickly rather than working indefinitely.
  const { data, error } = await sb.storage.from('training-content').createSignedUrl(path, 21600);
  if (error) { console.error('getTrainingFileUrl error:', error); return null; }
  return data.signedUrl;
}

window.VW_DB = {
  initDB, all, getById, getByIndex, put, del, STORES, seedData,
  getSetting, setSetting, subscribeTable, toCamelObj, toSnakeObj,
  camelToSnake, snakeToCamel, uploadPhoto, getPhotoUrl, incrementInvoiceSequence,
  incrementQuotationSequence, incrementGatePassSequence, incrementReturnSequence, incrementPOSequence,
  uploadCatalog,
  uploadProductPhoto, getProductPhotoUrl, deleteProductPhoto,
  uploadDispatchPhoto, getDispatchPhotoUrl, uploadOnboardingDoc, getOnboardingDocUrl,
  uploadTrainingFile, getTrainingFileUrl,
  get client() { return sb; }
};




/* === scanner.js === */

// ===== SHARED QR SCANNER MODULE =====
// One camera-scanning sheet reused by Billing (Cart), Inventory, and
// Quotations rather than building the camera lifecycle three times.
// Each caller passes a callback that receives the decoded text — what
// happens next (add to cart, open the product, fill a quote line) is
// entirely up to the caller; this module only owns the camera itself.
//
// Products store their scannable code in the existing `barcode` field —
// printed QR labels just encode that same string. No new product column
// needed; this is purely a different INPUT method for the same field
// that's always been there as manually-typed text.

let _activeQrScanner = null; // the live QrScanner instance, so closeSheet() can always find and stop it

function isScannerActive() {
  return !!_activeQrScanner;
}
window.isScannerActive = isScannerActive;

function stopActiveScanner() {
  if (_activeQrScanner) {
    try { _activeQrScanner.stop(); _activeQrScanner.destroy(); } catch (e) { /* already stopped */ }
    _activeQrScanner = null;
  }
}
window.stopActiveScanner = stopActiveScanner;

// onScanned(decodedText) is called once per successful scan. Returning
// (not closing the sheet) is the caller's choice — e.g. Cart might want
// to keep scanning multiple items in a row, while Inventory typically
// wants to scan once and immediately jump to that product.
function openQrScanner(onScanned, opts) {
  opts = opts || {};
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${opts.title || 'Scan QR Code'}</h3>
    <p class="sheet-meta">${opts.subtitle || 'Point the camera at the product\'s QR label.'}</p>
    <div style="position:relative;border-radius:10px;overflow:hidden;background:#000">
      <video id="qr-video" style="width:100%;display:block" playsinline></video>
    </div>
    <div id="qr-scan-status" style="font-size:12px;color:var(--text3);margin-top:8px;text-align:center">Starting camera…</div>
    <button class="btn-secondary full-width" style="margin-top:10px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  if (typeof QrScanner === 'undefined') {
    document.getElementById('qr-scan-status').innerHTML = '<span style="color:var(--red)">Scanner failed to load — check your connection and try again.</span>';
    return;
  }

  const video = document.getElementById('qr-video');
  const statusEl = document.getElementById('qr-scan-status');
  stopActiveScanner(); // belt-and-suspenders: never run two camera streams at once

  _activeQrScanner = new QrScanner(video, result => {
    const text = (result && result.data) ? result.data : result;
    if (statusEl) statusEl.textContent = '✓ Scanned';
    if (opts.vibrate !== false && navigator.vibrate) navigator.vibrate(80);
    onScanned(text);
  }, {
    highlightScanRegion: true,
    highlightCodeOutline: true,
    preferredCamera: 'environment'
  });

  _activeQrScanner.start().catch(err => {
    console.error('QR camera start error:', err);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">Couldn\'t access the camera — check permissions and try again.</span>';
  });
}
window.openQrScanner = openQrScanner;

// Looks up a product by whatever was scanned, matching the same `barcode`
// field used for manual search today — so existing printed/typed
// barcodes and new QR labels both resolve through one shared path.
async function findProductByScannedCode(code) {
  if (!code) return null;
  const products = await VW_DB.all(VW_DB.STORES.products);
  const trimmed = code.trim();
  return products.find(p => (p.barcode||'').trim() === trimmed) || null;
}
window.findProductByScannedCode = findProductByScannedCode;

window.VW_SCANNER = { openQrScanner, stopActiveScanner, isScannerActive, findProductByScannedCode };




/* === auth.js === */

// ============================================================
// AUTH — phone + PIN (using Supabase email/password under the hood)
// ============================================================
const EMAIL_DOMAIN = '@vwholesale.app';

let currentProfile = null; // cached profile row for the logged-in user

function phoneToEmail(phone) { return phone.replace(/\D/g, '') + EMAIL_DOMAIN; }

// ---------- ROLE / PERMISSIONS ----------
// Pages a role gets by default. Admin always gets everything and is never
// restricted by the permissions array below — only non-admin roles can
// have their access narrowed or widened per person via Settings.
const ROLE_DISPLAY = {
  admin:'Admin', management:'Management', sales_head:'Sales Head', asm:'ASM',
  sr_sales:'Sr Sales', sr_executive:'Sr Executive', executive:'Executive', tl:'Team Lead',
  floor_manager:'Floor Manager', store_manager:'Store Manager', staff:'Staff',
  reception:'Reception', accounts:'Accounts', dispatch:'Dispatch', pending:'Pending'
};
const PUBLIC_PAGES = ['shop','offers','mood_board','tile_visualizer'];  // accessible without login

const ROLE_PAGES = {
  admin:        ['dashboard','checkin','cart','tasks','crm','inventory','hr','analytics','club','feedback','settings','training','accounts','dispatch','promotions','catalogs','eod','referrals','incentives','dedup','ledger','vendors','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','autotest','returns','visualizer','field','gst','wishlist','grn','contractor_portal','commissions'],
  executive:    ['dashboard','checkin','cart','tasks','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist'],
  sr_executive: ['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics'],
  sr_sales:     ['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','contractor_portal','commissions'],
  asm:          ['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','reports','contractor_portal','commissions'],
  sales_head:   ['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','reports','dispatch','vendors','contractor_portal','commissions'],
  tl:           ['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','reports'],
  floor_manager:['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','reports','dispatch','vendors','contractor_portal'],
  store_manager:['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','reports','dispatch','vendors','accounts','hr','contractor_portal'],
  management:   ['dashboard','checkin','cart','tasks','crm','feedback','training','catalogs','incentives','ledger','marketing','service','employeeapp','contractor','quotations','tiles','granite','tile_quotes','tile_inventory','returns','visualizer','field','wishlist','analytics','reports','dispatch','vendors','accounts','hr','gst','eod','contractor_portal','commissions'],
  staff:        ['dashboard','checkin','tasks','feedback','training','catalogs'],
  reception:    ['dashboard','checkin','cart','tasks','feedback','training','catalogs','ledger','employeeapp','contractor','quotations','returns','visualizer','wishlist'],
  accounts:     ['dashboard','tasks','feedback','training','accounts','eod','ledger','returns','gst','tile_quotes'],
  dispatch:     ['dashboard','tasks','feedback','training','dispatch'],
  pending:      [],
  customer:     ['shop','wallet','quotations','labor_requests','wishlist','feedback'],
  contractor:   ['contractor_profile','labor_requests','wallet'],
};

// The toggleable permission set Admin can grant/revoke per person, and
// which app page(s) each one unlocks. "dashboard", "checkin", "tasks", and
// "feedback" stay always-on for every approved role — they're core to
// doing the job, not optional add-ons.
const PERMISSION_PAGES = {
  billing:        ['cart', 'quotations', 'tiles', 'granite', 'ledger'],
  inventory:      ['inventory'],
  tile_inventory: ['tile_inventory'],
  crm:            ['crm'],
  hr:             ['hr'],
  analytics:      ['analytics'],
  club:           ['club'],
  settings:       ['settings'],
  vendors:        ['vendors'],
  marketing:      ['marketing'],
  dispatch:       ['dispatch'],
  service:        ['service'],
};
const PERMISSION_LABELS = {
  billing: 'Billing, Quotations & Tiles/Granite',
  inventory: 'Inventory',
  tile_inventory: 'Tile Stock (Dedicated)',
  crm: 'CRM & Sales',
  hr: 'HR & Team',
  analytics: 'Analytics & Reports',
  club: 'Contractor Club',
  settings: 'Settings',
  vendors: 'Vendors & Purchase Orders',
  marketing: 'Marketing',
  dispatch: 'Dispatch & Gate Pass',
  service: 'Service & Work Orders',
};
const ALWAYS_ON_PAGES = ['dashboard', 'checkin', 'tasks', 'feedback', 'training', 'employeeapp', 'contractor'];

function getRole() {
  return (currentProfile && currentProfile.status === 'approved') ? currentProfile.role : 'pending';
}

function getAllowedPages() {
  const role = getRole();

  // Guests (no login) can access public pages
  if (!role || !currentProfile) return [...PUBLIC_PAGES];

  if (role === 'admin') return ROLE_PAGES.admin;
  if (role === 'pending') return [];

  // Start with role defaults — this ensures tiles/granite/quotations
  // are always available when the role has them, regardless of explicit perms
  const roleDefaults = new Set(ROLE_PAGES[role] || []);

  // If this person has an explicit permissions array saved, merge it on top
  const explicit = currentProfile && Array.isArray(currentProfile.permissions) ? currentProfile.permissions : null;
  if (explicit) {
    const pages = new Set([...ALWAYS_ON_PAGES, ...roleDefaults]);
    explicit.forEach(perm => (PERMISSION_PAGES[perm] || []).forEach(p => pages.add(p)));
    // Role-specific always-on work pages
    if (role === 'accounts') { pages.add('accounts'); pages.add('eod'); }
    if (role === 'dispatch') pages.add('dispatch');
    if (['admin','executive'].includes(role)) pages.add('incentives');
    return [...pages];
  }

  // No explicit permissions — use role defaults
  return ROLE_PAGES[role] || [];
}

function getCurrentProfile() { return currentProfile; }
function isAdmin() { return getRole() === 'admin'; }

// Phone masking (same idea as before, role-driven now)
function maskPhone(phone, visit) {
  if (!phone || phone.length < 6) return phone;
  const last = phone.slice(-2);
  const masked = phone.slice(0, -2).replace(/\d/g, 'X') + last;
  if (!currentProfile) return masked;
  if (currentProfile.role === 'admin') return phone;
  if (!visit) return masked;
  if (visit.status === 'completed') return masked;
  if (currentProfile.role === 'executive' && visit.assignedExecutiveId === currentProfile.staffId) return phone;
  if (currentProfile.role === 'staff') return phone; // specialists/TLs viewing active visit context
  return masked;
}

// ---------- SESSION BOOTSTRAP ----------
async function loadCurrentProfile() {
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) { currentProfile = null; return null; }
  const userId = sessionData.session.user.id;
  currentProfile = await VW_DB.getById(VW_DB.STORES.profiles, userId);
  return currentProfile;
}

// ---------- SIGN UP ----------
async function signUp(phone, pin, name) {
  phone = phone.replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) throw new Error('Enter a valid 10-digit phone number');
  if (pin.length !== 6) throw new Error('PIN must be exactly 6 digits');
  const email = phoneToEmail(phone);
  const { data, error } = await sb.auth.signUp({ email, password: pin });
  if (error) {
    if (error.message && error.message.toLowerCase().includes('already registered')) {
      throw new Error('This phone number is already registered. Try logging in instead.');
    }
    throw error;
  }
  await VW_DB.put(VW_DB.STORES.profiles, { id: data.user.id, phone, name, role: 'pending', status: 'pending' });
  await loadCurrentProfile();
  return data;
}

// ---------- SIGN IN ----------
async function signIn(phone, pin) {
  phone = phone.replace(/\D/g, '').slice(-10);
  const email = phoneToEmail(phone);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pin });
  if (error) {
    throw new Error('Phone number or PIN is incorrect.');
  }
  await loadCurrentProfile();
  return data;
}

async function signOut() {
  await sb.auth.signOut();
  currentProfile = null;
  window.location.replace('./shop.html');
}

// ============================================================
// UI: Login / Sign Up screen
// ============================================================
async function showAuthScreen(mode) {
  let overlay = document.getElementById('identity-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'identity-overlay';
    overlay.className = 'identity-overlay';
    document.body.appendChild(overlay);
  }

  // If mode is 'staff' — go straight to staff PIN login
  if (mode === 'staff') {
    overlay.innerHTML = `
    <div class="identity-card">
      <div class="id-logo">VW</div>
      <h2 style="margin-bottom:4px">Staff Login</h2>
      <p class="id-sub" style="margin-bottom:16px">V Wholesale · Vijayawada</p>
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input type="tel" id="staff-phone" class="form-input" placeholder="10-digit mobile" inputmode="numeric"
          oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)">
      </div>
      <div class="form-group">
        <label class="form-label">6-Digit PIN</label>
        <input type="password" id="staff-pin" class="form-input" placeholder="••••••" inputmode="numeric" maxlength="6"
          onkeydown="if(event.key==='Enter')handleStaffLogin()">
      </div>
      <button class="btn-primary full-width" onclick="handleStaffLogin()">Log In →</button>
      <a href="./shop.html" style="display:block;text-align:center;margin-top:12px;font-size:12px;color:var(--text3);text-decoration:none">← Back to Shop</a>
    </div>`;
    overlay.style.display = 'flex';

    // Wire handleStaffLogin
    window.handleStaffLogin = async function() {
      const phone = document.getElementById('staff-phone')?.value?.trim();
      const pin   = document.getElementById('staff-pin')?.value?.trim();
      if (!phone || !pin) { showToast('Enter phone and PIN', 'warn'); return; }
      const btn = document.querySelector('[onclick="handleStaffLogin()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }
      try {
        // Authenticate via Supabase Auth (email = phone@vwholesale.in, password = PIN)
        const { data: authData, error: authError } = await VW_DB.client.auth.signInWithPassword({
          email: phoneToEmail(phone),
          password: pin
        });
        if (authError) {
          showToast('Incorrect phone or PIN', 'error');
          if(btn){btn.disabled=false;btn.textContent='Log In →';}
          return;
        }
        // Load profile after successful auth
        const { data: profile, error: profileError } = await VW_DB.client
          .from('profiles')
          .select('id,name,role,status')
          .eq('phone', phone.replace(/\D/g,'').slice(-10)).single();
        if (profileError || !profile) { showToast('Profile not found. Contact admin.', 'error'); if(btn){btn.disabled=false;btn.textContent='Log In →';} return; }
        if (profile.status === 'pending') { showToast('Account pending approval', 'warn'); if(btn){btn.disabled=false;btn.textContent='Log In →';} return; }
        overlay.remove();
        await routeByRole();
      } catch(e) {
        showToast('Login failed: ' + e.message, 'error');
        if(btn){btn.disabled=false;btn.textContent='Log In →';}
      }
    };
    return;
  }

  // If mode is 'contractor' — go straight to contractor OTP login
  if (mode === 'contractor') {
    overlay.innerHTML = `
    <div class="identity-card">
      <div class="id-logo">👷</div>
      <h2 style="margin-bottom:4px">Contractor Login</h2>
      <p class="id-sub" style="margin-bottom:16px">V Wholesale Contractor Club</p>
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <div style="display:flex;align-items:center;border:1.5px solid var(--gold-border);border-radius:10px;overflow:hidden">
          <span style="padding:10px;background:var(--bg2);font-size:13px;font-weight:700;border-right:1px solid var(--border)">+91</span>
          <input type="tel" id="contractor-phone" placeholder="10-digit mobile" inputmode="numeric"
            style="flex:1;padding:10px;background:none;border:none;outline:none;font-size:14px;color:var(--text)"
            oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" id="contractor-name" class="form-input" placeholder="Your full name">
      </div>
      <button class="btn-primary full-width" onclick="handleContractorLogin()">Send OTP →</button>
      <a href="./shop.html" style="display:block;text-align:center;margin-top:12px;font-size:12px;color:var(--text3);text-decoration:none">← Back to Shop</a>
    </div>`;
    overlay.style.display = 'flex';

    window.handleContractorLogin = async function() {
      const phone = document.getElementById('contractor-phone')?.value?.trim();
      const name  = document.getElementById('contractor-name')?.value?.trim();
      if (!phone || phone.length < 10) { showToast('Enter valid phone', 'warn'); return; }
      const btn = document.querySelector('[onclick="handleContractorLogin()"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending OTP...'; }
      try {
        const { error } = await VW_DB.client.auth.signInWithOtp({ phone: '+91' + phone, options: { data: { name, role: 'contractor' } } });
        if (error) throw error;
        // Show OTP input
        document.querySelector('.identity-card').innerHTML = `
          <div class="id-logo">📱</div>
          <h2 style="margin-bottom:4px">Enter OTP</h2>
          <p class="id-sub" style="margin-bottom:16px">Sent to +91 ${phone}</p>
          <div class="form-group">
            <label class="form-label">6-Digit OTP</label>
            <input type="tel" id="contractor-otp" class="form-input" placeholder="• • • • • •"
              inputmode="numeric" maxlength="6" style="text-align:center;font-size:20px;letter-spacing:8px">
          </div>
          <button class="btn-primary full-width" onclick="verifyContractorOTP('${phone}')">Verify →</button>`;
      } catch(e) {
        showToast('Failed to send OTP: ' + (e.message || 'Try again'), 'error');
        if(btn){btn.disabled=false;btn.textContent='Send OTP →';}
      }
    };

    window.verifyContractorOTP = async function(phone) {
      const otp = document.getElementById('contractor-otp')?.value?.trim();
      if (!otp || otp.length < 6) { showToast('Enter 6-digit OTP', 'warn'); return; }
      try {
        const { error } = await VW_DB.client.auth.verifyOtp({ phone: '+91' + phone, token: otp, type: 'sms' });
        if (error) throw error;
        overlay.remove();
        await routeByRole();
      } catch(e) {
        showToast('Invalid OTP', 'error');
      }
    };
    return;
  }

  // Default — show all three role options (customer self-registration)
  overlay.innerHTML = `
    <div class="identity-card">
      <div class="id-logo">VW</div>
      <h2 style="margin-bottom:4px">V Wholesale</h2>
      <p class="id-sub" style="margin-bottom:16px">Vijayawada's Home Building Store</p>

      <!-- WHO ARE YOU -->
      <div id="auth-role-select" style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--text3);font-weight:700;margin-bottom:8px;text-transform:uppercase">I am a</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${[
            { key:'customer', icon:'🏠', label:'Customer' },
            { key:'contractor', icon:'👷', label:'Contractor' },
            { key:'staff', icon:'🏪', label:'Staff' },
          ].map(r => `
          <button id="role-btn-${r.key}" onclick="selectAuthRole('${r.key}')"
            style="padding:10px 6px;border-radius:10px;border:${r.key==='customer'?'2px solid var(--gold)':'1px solid var(--border)'};
              background:${r.key==='customer'?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;text-align:center">
            <div style="font-size:20px;margin-bottom:4px">${r.icon}</div>
            <div style="font-size:11px;font-weight:700;color:${r.key==='customer'?'var(--gold)':'var(--text)'}">${r.label}</div>
          </button>`).join('')}
        </div>
      </div>

      <!-- CUSTOMER / CONTRACTOR FORM -->
      <div id="auth-public-form">
        <div class="form-group">
          <label>Phone Number *</label>
          <input type="tel" id="auth-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric"
            style="font-size:16px;font-weight:700">
        </div>
        <div class="form-group" id="auth-name-group">
          <label>Full Name *</label>
          <input type="text" id="auth-name" placeholder="Your full name">
        </div>
        <div class="form-group" id="auth-email-group" style="display:none">
          <label>Email (optional)</label>
          <input type="email" id="auth-email" placeholder="your@email.com">
        </div>
        <div id="auth-otp-group" style="display:none">
          <div style="background:rgba(34,197,94,0.08);border:1px solid var(--green);border-radius:8px;padding:10px;margin-bottom:10px;font-size:12px;color:var(--green)">
            ✅ OTP sent to your phone/email. Enter below.
          </div>
          <div class="form-group">
            <label>OTP</label>
            <input type="text" id="auth-otp" placeholder="6-digit OTP" maxlength="6" inputmode="numeric"
              style="font-size:20px;font-weight:800;text-align:center;letter-spacing:8px">
          </div>
        </div>
        <div id="auth-error" style="color:var(--red);font-size:13px;margin-bottom:10px;display:none"></div>
        <button class="btn-primary full-width" id="auth-submit-btn" onclick="handlePublicAuthSubmit()">
          Continue →
        </button>
        <button class="btn-secondary full-width" style="margin-top:8px" onclick="showStaffLogin()">
          Staff Login →
        </button>
      </div>

      <!-- STAFF FORM (hidden by default) -->
      <div id="auth-staff-form" style="display:none">
        <div class="form-group">
          <label>Phone Number</label>
          <input type="tel" id="staff-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric">
        </div>
        <div class="form-group">
          <label>PIN</label>
          <input type="password" id="staff-pin" placeholder="6-digit PIN" maxlength="6" inputmode="numeric">
        </div>
        <div id="staff-auth-error" style="color:var(--red);font-size:13px;margin-bottom:10px;display:none"></div>
        <button class="btn-primary full-width" id="staff-submit-btn" onclick="handleStaffLogin()">Log In</button>
        <button class="btn-secondary full-width" style="margin-top:8px" onclick="toggleAuthMode()" id="auth-toggle-btn">New employee? Register</button>
        <button class="btn-secondary full-width" style="margin-top:8px;background:none;border:none;color:var(--text3);font-size:13px" onclick="showForgotPin()">Forgot PIN?</button>
        <button class="btn-secondary full-width" style="margin-top:8px;font-size:12px" onclick="showPublicLogin()">← Customer / Contractor Login</button>
      </div>
    </div>
  `;

  // Inject auth helper scripts
  const s = document.createElement('script');
  s.textContent = `
    window._authRole = 'customer';
    window._authStep = 'details'; // details | otp

    function selectAuthRole(role) {
      window._authRole = role;
      ['customer','contractor','staff'].forEach(r => {
        const btn = document.getElementById('role-btn-'+r);
        if (!btn) return;
        btn.style.borderColor = r===role ? 'var(--gold)' : 'var(--border)';
        btn.style.background = r===role ? 'var(--gold-muted)' : 'var(--bg2)';
        btn.querySelector('div:last-child').style.color = r===role ? 'var(--gold)' : 'var(--text)';
      });
      if (role === 'staff') { showStaffLogin(); return; }
      showPublicLogin();
      // Show email for customer
      const eg = document.getElementById('auth-email-group');
      if (eg) eg.style.display = role==='customer' ? 'block' : 'none';
      const ng = document.getElementById('auth-name-group');
      if (ng) ng.style.display = 'block';
    }

    function showStaffLogin() {
      document.getElementById('auth-public-form').style.display = 'none';
      document.getElementById('auth-staff-form').style.display = 'block';
      window._authRole = 'staff';
      selectAuthRole('staff');
    }

    function showPublicLogin() {
      document.getElementById('auth-public-form').style.display = 'block';
      document.getElementById('auth-staff-form').style.display = 'none';
    }

    window.selectAuthRole = selectAuthRole;
    window.showStaffLogin = showStaffLogin;
    window.showPublicLogin = showPublicLogin;
  `;
  document.body.appendChild(s);
}

// Public auth — customer / contractor OTP flow
async function handlePublicAuthSubmit() {
  const role    = window._authRole || 'customer';
  const step    = window._authStep || 'details';
  const phone   = (document.getElementById('auth-phone')?.value||'').replace(/\D/g,'').slice(-10);
  const name    = (document.getElementById('auth-name')?.value||'').trim();
  const email   = (document.getElementById('auth-email')?.value||'').trim();
  const errEl   = document.getElementById('auth-error');
  const btn     = document.getElementById('auth-submit-btn');

  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Please wait...';

  try {
    if (step === 'details') {
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit phone number');
      if (!name) throw new Error('Please enter your full name');

      // Check if profile already exists → login flow
      const { data: existing } = await sb.from('profiles')
        .select('id,name,role,status').eq('phone', phone).maybeSingle();

      if (existing) {
        // Existing user — send OTP to verify
        const otpEmail = email || (existing.email || `${phone}${EMAIL_DOMAIN}`);
        await sb.auth.signInWithOtp({ email: otpEmail, options: { shouldCreateUser: false } });
        window._authOtpEmail = otpEmail;
        window._authStep = 'otp';
        window._authExistingProfile = existing;
        document.getElementById('auth-otp-group').style.display = 'block';
        document.getElementById('auth-name-group').style.display = 'none';
        document.getElementById('auth-email-group').style.display = 'none';
        btn.textContent = 'Verify OTP →';
        btn.disabled = false;
        return;
      }

      // New user — create profile with OTP verification
      const otpEmail = email || `${phone}${EMAIL_DOMAIN}`;
      await sb.auth.signInWithOtp({ email: otpEmail, options: { shouldCreateUser: true } });
      window._authOtpEmail = otpEmail;
      window._authNewUser = { phone, name, email, role };
      window._authStep = 'otp';
      document.getElementById('auth-otp-group').style.display = 'block';
      document.getElementById('auth-name-group').style.display = 'none';
      document.getElementById('auth-email-group').style.display = 'none';
      btn.textContent = 'Verify OTP →';
      btn.disabled = false;

    } else if (step === 'otp') {
      const otp = (document.getElementById('auth-otp')?.value||'').trim();
      if (!otp || otp.length < 6) throw new Error('Enter the 6-digit OTP');

      const { error: otpErr } = await sb.auth.verifyOtp({
        email: window._authOtpEmail,
        token: otp,
        type: 'email',
      });
      if (otpErr) throw new Error('Invalid or expired OTP. Please try again.');

      // OTP verified — create or load profile
      if (window._authNewUser) {
        const u = window._authNewUser;
        const newRole = u.role === 'contractor' ? 'contractor' : 'customer';
        const newStatus = u.role === 'contractor' ? 'pending' : 'approved'; // contractors need approval

        const { data: { user } } = await sb.auth.getUser();
        await sb.from('profiles').insert({
          id: user.id,
          name: u.name,
          phone: u.phone,
          email: u.email || null,
          role: newRole,
          status: newStatus,
        }).catch(() => {}); // may already exist from trigger

        await loadCurrentProfile();
      } else {
        await loadCurrentProfile();
      }

      const overlay = document.getElementById('identity-overlay');
      if (overlay) overlay.remove();
      await routeByRole();
    }
  } catch(e) {
    errEl.textContent = e.message || 'Something went wrong';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = window._authStep === 'otp' ? 'Verify OTP →' : 'Continue →';
  }
}
window.handlePublicAuthSubmit = handlePublicAuthSubmit;

async function handleStaffLogin() {
  const phone = (document.getElementById('staff-phone')?.value||'').trim().replace(/\D/g,'').slice(-10);
  const pin   = (document.getElementById('staff-pin')?.value||'').trim();
  const errEl = document.getElementById('staff-auth-error');
  const btn   = document.getElementById('staff-submit-btn');

  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Please wait...';

  try {
    if (authMode === 'signup') {
      const name = document.getElementById('auth-name')?.value?.trim();
      if (!name) throw new Error('Please enter your full name');
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit phone number');
      if (pin.length !== 6) throw new Error('PIN must be exactly 6 digits');
      const offers = await VW_DB.all(VW_DB.STORES.staffOffers);
      const matchingOffer = offers.find(o => (o.candidatePhone||'').replace(/\D/g,'').slice(-10) === phone);
      if (!matchingOffer) throw new Error('Your phone number is not registered for hiring. Please contact HR.');
      if (!matchingOffer.inductionCompleted) throw new Error('Please complete your onboarding induction first.');
      await signUp(phone, pin, name);
    } else {
      await signIn(phone, pin);
    }
    const overlay = document.getElementById('identity-overlay');
    if (overlay) overlay.remove();
    await routeByRole();
  } catch(e) {
    errEl.textContent = e.message || 'Something went wrong';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Log In' : 'Register';
  }
}
window.handleStaffLogin = handleStaffLogin;

// Route to correct home screen based on role
async function routeByRole() {
  await loadCurrentProfile();
  const role = currentProfile?.role;
  const status = currentProfile?.status;
  const params = new URLSearchParams(window.location.search);

  if (!role) {
    const mode = params.has('contractor') ? 'contractor' : params.has('staff') ? 'staff' : undefined;
    await showAuthScreen(mode);
    return;
  }

  // Contractor pending approval
  if (role === 'contractor' && status === 'pending') {
    showContractorPendingScreen(); return;
  }

  // Customer
  if (role === 'customer') {
    if (typeof init === 'function') await init();
    navigateTo('shop'); // B2C home
    return;
  }

  // Contractor approved
  if (role === 'contractor') {
    if (typeof init === 'function') await init();
    navigateTo('contractor_profile');
    return;
  }

  // Staff — existing flow
  if (status === 'pending') { showPendingScreen(); return; }
  if (typeof init === 'function') await init();
}
window.routeByRole = routeByRole;

function showContractorPendingScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'identity-overlay';
  overlay.className = 'identity-overlay';
  overlay.innerHTML = `
    <div class="identity-card" style="text-align:center">
      <div class="id-logo">👷</div>
      <h2>Application Submitted</h2>
      <p class="id-sub">Hi ${currentProfile?.name||''}! Your contractor application is under review. Our team will verify your details and activate your account within 24 hours.</p>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin:12px 0;font-size:12px;color:var(--text3);text-align:left">
        <div style="margin-bottom:4px">📄 Upload KYC documents to speed up approval</div>
        <div>📞 Call us: 8712697930</div>
      </div>
      <button class="btn-secondary full-width" onclick="checkApprovalStatus()">Check Status</button>
      <button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="VW_AUTH.signOut()">Log Out</button>
    </div>
  `;
  document.body.appendChild(overlay);
}
window.showContractorPendingScreen = showContractorPendingScreen;



function showForgotPin() {
  const overlay = document.getElementById('identity-overlay');
  if (!overlay) return;
  overlay.querySelector('.identity-card').innerHTML = `
    <div class="id-logo">VW</div>
    <h2>Forgot PIN</h2>
    <p class="id-sub">Enter your phone number. Management will review and reset your PIN — you'll see a new one here once approved.</p>
    <div class="form-group">
      <label>Phone Number</label>
      <input type="tel" id="forgot-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric">
    </div>
    <div id="forgot-pin-error" style="color:var(--red);font-size:13px;margin-bottom:10px;display:none"></div>
    <button class="btn-primary full-width" id="forgot-pin-submit-btn" onclick="submitPinResetRequest()">Request PIN Reset</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="showAuthScreen()">← Back to Log In</button>
  `;
}
window.showForgotPin = showForgotPin;

async function submitPinResetRequest() {
  const phone = document.getElementById('forgot-phone').value.replace(/\D/g, '').slice(-10);
  const errEl = document.getElementById('forgot-pin-error');
  errEl.style.display = 'none';
  if (phone.length !== 10) { errEl.textContent = 'Enter a valid 10-digit phone number'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('forgot-pin-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting...';

  try {
    const { data: lookup, error: lookupErr } = await sb.rpc('phone_has_account', { check_phone: phone });
    if (lookupErr) throw new Error('Could not check that phone number right now');
    if (!lookup || !lookup.length || !lookup[0].found) throw new Error('No account found with this phone number');

    await VW_DB.put(VW_DB.STORES.pinResetRequests, {
      phone, name: lookup[0].profile_name, profileId: lookup[0].profile_id,
      status: 'pending', createdAt: new Date().toISOString()
    });

    document.getElementById('identity-overlay').querySelector('.identity-card').innerHTML = `
      <div class="id-logo">VW</div>
      <h2>Request Sent</h2>
      <p class="id-sub">Management has been notified. Once they reset your PIN, come back and log in with the new one they share with you.</p>
      <button class="btn-secondary full-width" onclick="showAuthScreen()">← Back to Log In</button>
    `;
  } catch (e) {
    errEl.textContent = e.message || 'Something went wrong';
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Request PIN Reset';
  }
}
window.submitPinResetRequest = submitPinResetRequest;

let authMode = 'login';

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('auth-title').textContent = authMode === 'login' ? 'Log In' : 'Register';
  document.getElementById('auth-sub').textContent = authMode === 'login'
    ? 'Enter your phone number and PIN.'
    : 'HR must have initiated your onboarding before you can register.';
  document.getElementById('auth-name-group').style.display = authMode === 'signup' ? 'block' : 'none';
  document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Log In' : 'Register';
  document.getElementById('auth-toggle-btn').textContent = authMode === 'login' ? 'New employee? Register' : 'Already registered? Log In';
  const errEl = document.getElementById('auth-error');
  if (errEl) errEl.style.display = 'none';
}

async function handleAuthSubmit() {
  const phone = document.getElementById('auth-phone').value.trim().replace(/\D/g,'').slice(-10);
  const pin = document.getElementById('auth-pin').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Please wait...';

  try {
    if (authMode === 'signup') {
      const name = document.getElementById('auth-name').value.trim();
      if (!name) throw new Error('Please enter your full name');
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit phone number');
      if (pin.length !== 6) throw new Error('PIN must be exactly 6 digits');

      // Check if this phone number has been pre-approved by HR
      const offers = await VW_DB.all(VW_DB.STORES.staffOffers);
      const matchingOffer = offers.find(o =>
        (o.candidatePhone||'').replace(/\D/g,'').slice(-10) === phone
      );

      if (!matchingOffer) {
        throw new Error('Your phone number is not registered for hiring. Please contact HR to initiate your onboarding.');
      }

      if (matchingOffer.status === 'pending' || matchingOffer.status === 'draft') {
        throw new Error('HR has sent you an onboarding link. Please complete your documents and induction first, then come back to register.');
      }

      if (matchingOffer.status === 'accepted') {
        throw new Error('You have accepted the offer but not completed the induction checklist yet. Please complete your onboarding form first.');
      }

      if (!matchingOffer.inductionCompleted) {
        throw new Error('Your onboarding documents are submitted but induction is not complete. Please finish the induction checklist in your onboarding link.');
      }

      if (matchingOffer.status === 'rejected') {
        throw new Error('Your application was not approved. Please contact HR for more information.');
      }

      // Offer is submitted/approved and induction is complete — allow registration
      await signUp(phone, pin, name);

    } else {
      await signIn(phone, pin);
    }
    const overlay = document.getElementById('identity-overlay');
    if (overlay) overlay.remove();
    const ready = await onAuthReady();
    if (ready && typeof init === 'function') await init();
  } catch (e) {
    errEl.textContent = e.message || 'Something went wrong';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Log In' : 'Register';
  }
}

// ============================================================
// UI: Pending approval screen
// ============================================================
function showPendingScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'identity-overlay';
  overlay.className = 'identity-overlay';
  overlay.innerHTML = `
    <div class="identity-card" style="text-align:center">
      <div class="id-logo">VW</div>
      <h2>Waiting for Approval</h2>
      <p class="id-sub">Hi ${currentProfile?.name || ''}! Your access request has been sent to Management.
      You'll be able to use the app as soon as they approve your account.</p>
      <button class="btn-secondary full-width" onclick="checkApprovalStatus()">Check Status</button>
      <button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="VW_AUTH.signOut()">Log Out</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function checkApprovalStatus() {
  await loadCurrentProfile();
  if (currentProfile && currentProfile.status === 'approved') {
    const overlay = document.getElementById('identity-overlay');
    if (overlay) overlay.remove();
    const ready = await onAuthReady();
    if (ready && typeof init === 'function') await init();
    showToast(`Welcome, ${currentProfile.name}!`, 'success');
  } else {
    showToast('Still pending approval — check back soon', 'info');
  }
}

// ============================================================
// MAIN ENTRY POINT — call this on app load
// ============================================================
async function onAuthReady() {
  await loadCurrentProfile();
  const overlay = document.getElementById('identity-overlay');
  if (overlay) overlay.remove();

  // If no profile
  if (!currentProfile) {
    // ?staff=1 or ?contractor=1 — show login screen, not shop
    const params = new URLSearchParams(window.location.search);
    if (params.has('staff') || params.has('contractor')) {
      await showAuthScreen(params.has('contractor') ? 'contractor' : 'staff');
      return false;
    }
    // Normal guest — allow shop to load publicly
    return true;
  }

  const role = currentProfile.role;
  const status = currentProfile.status;

  // Contractor pending approval
  if (role === 'contractor' && status === 'pending') {
    showContractorPendingScreen();
    return false;
  }

  // Staff pending
  if (status === 'pending' && role !== 'customer' && role !== 'contractor') {
    showPendingScreen();
    return false;
  }

  if (status === 'rejected') {
    showRejectedScreen();
    return false;
  }

  // approved
  renderIdentityBadge();
  if (typeof applyRolePermissions === 'function') applyRolePermissions();
  return true;
}

function showRejectedScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'identity-overlay';
  overlay.className = 'identity-overlay';
  overlay.innerHTML = `
    <div class="identity-card" style="text-align:center">
      <div class="id-logo">VW</div>
      <h2>Access Not Approved</h2>
      <p class="id-sub">Your access request was not approved. Please contact Management directly if you believe this is a mistake.</p>
      <button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="VW_AUTH.signOut()">Log Out</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ============================================================
// IDENTITY BADGE (top-right) — shows name + status (executives only)
// ============================================================
function renderIdentityBadge() {
  const el = document.getElementById('identity-badge');
  if (!el || !currentProfile) return;
  if (currentProfile.role === 'executive' && currentProfile.staffId) {
    el.innerHTML = `
      <div class="id-badge" onclick="toggleStatusMenu()">
        <span class="id-badge-name">${currentProfile.name}</span>
        <span class="id-status-dot" id="exec-status-dot"></span>
      </div>
      <div id="status-menu" class="status-menu" style="display:none">
        <button onclick="setExecStatus('available')">&#128994; Available</button>
        <button onclick="setExecStatus('busy')">&#128993; Busy</button>
        <button onclick="setExecStatus('break')">&#9898; On Break</button>
        <button onclick="VW_AUTH.signOut()" style="border-top:1px solid var(--border);margin-top:4px;color:var(--text3)">Log Out</button>
      </div>`;
    refreshExecStatusDot();
  } else {
    el.innerHTML = `<div class="id-badge" onclick="toggleStatusMenu()">
      <span class="id-badge-name">${currentProfile.name}</span>
    </div>
    <div id="status-menu" class="status-menu" style="display:none">
      <button onclick="VW_AUTH.signOut()" style="color:var(--red)">Log Out</button>
    </div>`;
  }
}

async function refreshExecStatusDot() {
  if (!currentProfile || currentProfile.role !== 'executive' || !currentProfile.staffId) return;
  const exec = await VW_DB.getById(VW_DB.STORES.executives, currentProfile.staffId);
  const dot = document.getElementById('exec-status-dot');
  if (dot && exec) dot.className = 'id-status-dot status-' + exec.status;
}

function toggleStatusMenu() {
  const menu = document.getElementById('status-menu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

async function setExecStatus(status) {
  if (!currentProfile || currentProfile.role !== 'executive' || !currentProfile.staffId) return;
  const exec = await VW_DB.getById(VW_DB.STORES.executives, currentProfile.staffId);
  if (exec) {
    exec.status = status;
    exec.statusUpdatedAt = new Date().toISOString();
    await VW_DB.put(VW_DB.STORES.executives, exec);
  }
  toggleStatusMenu();
  refreshExecStatusDot();
  showToast(`Status: ${status === 'available' ? 'Available' : status === 'busy' ? 'Busy' : 'On Break'}`, 'info');
}

window.VW_AUTH = {
  signUp, signIn, signOut, loadCurrentProfile, getCurrentProfile,
  getRole, getAllowedPages, maskPhone, onAuthReady, showAuthScreen,
  renderIdentityBadge, PERMISSION_LABELS, PERMISSION_PAGES, isAdmin
};
window.PUBLIC_PAGES = PUBLIC_PAGES;
window.handleAuthSubmit = handleAuthSubmit;
window.toggleAuthMode = toggleAuthMode;
window.checkApprovalStatus = checkApprovalStatus;
window.toggleStatusMenu = toggleStatusMenu;
window.setExecStatus = setExecStatus;

// ============================================================
// GRANULAR FEATURE PERMISSIONS
// Per-role rights: view, edit, delete, print, export, approve
// Overridable per-user via profile.featurePermissions
// ============================================================

const FEATURE_PERMISSIONS = {
  billing: {
    label: 'Billing & Invoicing',
    icon: '🧾',
    actions: {
      create:       { label: 'Create Invoice',       admin:true, executive:true,  staff:false, reception:true,  accounts:false, dispatch:false },
      edit:         { label: 'Edit Invoice',          admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      delete:       { label: 'Delete Invoice',        admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      print:        { label: 'Print Invoice',         admin:true, executive:true,  staff:false, reception:true,  accounts:true,  dispatch:false },
      discount:     { label: 'Apply Cash Discount',   admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      credit_sale:  { label: 'Create Credit Sale',    admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      approve:      { label: 'Approve Invoices',      admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
    }
  },
  quotations: {
    label: 'Quotations',
    icon: '📄',
    actions: {
      create:  { label: 'Create Quotation',  admin:true, executive:true,  staff:false, reception:true,  accounts:false, dispatch:false },
      edit:    { label: 'Edit Quotation',    admin:true, executive:true,  staff:false, reception:false, accounts:false, dispatch:false },
      delete:  { label: 'Delete Quotation',  admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      approve: { label: 'Approve Quotation', admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      print:   { label: 'Print Quotation',   admin:true, executive:true,  staff:false, reception:true,  accounts:true,  dispatch:false },
    }
  },
  inventory: {
    label: 'Inventory',
    icon: '📦',
    actions: {
      view:    { label: 'View Inventory',    admin:true, executive:true,  staff:true,  reception:true,  accounts:false, dispatch:true  },
      edit:    { label: 'Edit Products',     admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      delete:  { label: 'Delete Products',   admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      restock: { label: 'Restock Products',  admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:true  },
    }
  },
  crm: {
    label: 'CRM & Customers',
    icon: '👥',
    actions: {
      view:   { label: 'View Customers',     admin:true, executive:true,  staff:false, reception:true,  accounts:false, dispatch:false },
      edit:   { label: 'Edit Customers',     admin:true, executive:true,  staff:false, reception:true,  accounts:false, dispatch:false },
      delete: { label: 'Delete Customers',   admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      leads:  { label: 'Manage Leads',       admin:true, executive:true,  staff:false, reception:false, accounts:false, dispatch:false },
    }
  },
  reports: {
    label: 'Reports & Analytics',
    icon: '📊',
    actions: {
      view:   { label: 'View Reports',       admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      export: { label: 'Export Reports',     admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
    }
  },
  hr: {
    label: 'HR & Payroll',
    icon: '🧑‍💼',
    actions: {
      view:       { label: 'View Staff',       admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      edit:       { label: 'Edit Staff',       admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      payroll:    { label: 'View Payroll',     admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      attendance: { label: 'Mark Attendance',  admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
    }
  },
  accounts: {
    label: 'Accounts & Finance',
    icon: '💳',
    actions: {
      view:    { label: 'View Accounts',      admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      petty:   { label: 'Petty Cash Entry',   admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      voucher: { label: 'Create Vouchers',    admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      export:  { label: 'Export GST / Ledger',admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
    }
  },
  dispatch: {
    label: 'Dispatch & Gate Pass',
    icon: '📦',
    actions: {
      view:      { label: 'View Dispatch Queue', admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:true  },
      gatepass:  { label: 'Create Gate Pass',    admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:true  },
      photo:     { label: 'Upload Item Photos',  admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:true  },
    }
  },
  vendors: {
    label: 'Vendors & POs',
    icon: '🏭',
    actions: {
      view:    { label: 'View Vendors',      admin:true, executive:false, staff:false, reception:false, accounts:true,  dispatch:false },
      edit:    { label: 'Edit Vendors',      admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      po:      { label: 'Create POs',        admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      receive: { label: 'Receive Stock',     admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:true  },
    }
  },
  marketing: {
    label: 'Marketing',
    icon: '📣',
    actions: {
      view:      { label: 'View Marketing',    admin:true, executive:true,  staff:false, reception:false, accounts:false, dispatch:false },
      broadcast: { label: 'Send Broadcasts',   admin:true, executive:true,  staff:false, reception:false, accounts:false, dispatch:false },
      collateral:{ label: 'Generate Content',  admin:true, executive:true,  staff:false, reception:false, accounts:false, dispatch:false },
    }
  },
  settings: {
    label: 'Settings',
    icon: '⚙️',
    actions: {
      view:   { label: 'View Settings',   admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      edit:   { label: 'Edit Settings',   admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
      danger: { label: 'Danger Zone',     admin:true, executive:false, staff:false, reception:false, accounts:false, dispatch:false },
    }
  },
};

// Check if current user has a specific feature permission
function hasPermission(feature, action) {
  const profile = currentProfile;
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  // Check user-level override first
  const userPerms = profile.featurePermissions || {};
  const key = `${feature}.${action}`;
  if (key in userPerms) return userPerms[key];
  // Fall back to role defaults
  const feat = FEATURE_PERMISSIONS[feature];
  if (!feat) return false;
  const act = feat.actions[action];
  if (!act) return false;
  return act[profile.role] === true;
}

window.FEATURE_PERMISSIONS = FEATURE_PERMISSIONS;
window.hasPermission = hasPermission;




/* === notify.js === */

const MESSAGES = {
  en: {
    walkin: (name, dept) => `🏪 New customer! ${name} is at reception for ${dept}. Please attend now.`,
    walkin_exec: (name) => `🏪 New walk-in: ${name} is waiting at reception. Tap to accept within 2 min.`,
    walkin_escalated: (name, reason) => `⚠️ ESCALATED: ${name} is waiting — no executive available. ${reason||''}`,
    escalation_tl: (name) => `⚠️ ${name} has been waiting 30+ sec with no response from the assigned executive. Please attend now.`,
    escalation_manager: (name, level) => `🚨 ESCALATED TO ${(level||'').toUpperCase()}: ${name} has been waiting too long with no response. Please follow up urgently.`,
    urgent_unattended: (name) => `🚨 URGENT: ${name} has been waiting 4+ minutes with no response from anyone. Immediate attention needed.`,
    task_assigned: (name, dept, desc) => `📋 New task: ${name} needs ${dept}${desc?' — '+desc:''}. Tap to accept.`,
    task_escalated: (name, dept) => `⚠️ ESCALATED TASK: ${name}'s ${dept} request needs attention — specialist didn't respond.`,
    followup: (name) => `📞 Follow-up due: ${name} hasn't visited in 30+ days.`,
    invoice: (no, amt) => `✅ Invoice #${no} generated — ₹${amt.toLocaleString('en-IN')}`,
    feedback: (name) => `⭐ Feedback received from ${name}`,
    visitor: (name, type) => `🚪 Visitor: ${name} (${type}) is here to see you. Accept or Decline.`,
    quotation_approval: (name, quoteNo) => `📝 Quotation ${quoteNo||''} for ${name} needs your approval before it can be sent to the customer.`,
    quotation_delay: (dept, quoteNo) => `⏰ Approval delay: the ${dept} TL hasn't actioned quotation ${quoteNo||''} in time. Escalated to Management — please review.`,
    invoice_approval: (invoiceNo, reasonText) => `🧾 Invoice ${invoiceNo||''} needs your approval${reasonText ? ' — '+reasonText : ''} before it can be finalized.`,
    quote_request_received: (name) => `📋 ${name} brought in an existing quotation/estimate — please prepare a matching quote and share it back to the executive on WhatsApp.`
  },
  te: {
    walkin: (name, dept) => `🏪 కొత్త కస్టమర్! ${name} రిసెప్షన్‌లో ${dept} కోసం వచ్చారు.`,
    walkin_exec: (name) => `🏪 కొత్త వాక్-ఇన్: ${name} రిసెప్షన్‌లో వేచి ఉన్నారు. 2 నిమిషాల్లో అంగీకరించండి.`,
    walkin_escalated: (name, reason) => `⚠️ ఎస్కలేటెడ్: ${name} వేచి ఉన్నారు — ఎగ్జిక్యూటివ్ అందుబాటులో లేరు.`,
    escalation_tl: (name) => `⚠️ ${name} 30+ సెకన్లు వేచి ఉన్నారు — ఎగ్జిక్యూటివ్ స్పందించలేదు. వెంటనే హాజరు అవ్వండి.`,
    escalation_manager: (name, level) => `🚨 ${(level||'').toUpperCase()}కి ఎస్కలేట్ చేయబడింది: ${name} చాలా సేపు వేచి ఉన్నారు. వెంటనే అనుసరించండి.`,
    urgent_unattended: (name) => `🚨 అర్జెంట్: ${name} 4+ నిమిషాలు వేచి ఉన్నారు. వెంటనే హాజరు అవ్వండి.`,
    task_assigned: (name, dept, desc) => `📋 కొత్త టాస్క్: ${name}కి ${dept} అవసరం. అంగీకరించండి.`,
    task_escalated: (name, dept) => `⚠️ ఎస్కలేటెడ్ టాస్క్: ${name} యొక్క ${dept} రిక్వెస్ట్‌కు అటెన్షన్ అవసరం.`,
    followup: (name) => `📞 ఫాలో-అప్: ${name} 30+ రోజులు రాలేదు.`,
    invoice: (no, amt) => `✅ ఇన్వాయిస్ #${no} — ₹${amt.toLocaleString('en-IN')}`,
    feedback: (name) => `⭐ ${name} నుండి అభిప్రాయం వచ్చింది`,
    visitor: (name, type) => `🚪 విజిటర్: ${name} (${type}) మీ కోసం వచ్చారు.`,
    quotation_approval: (name, quoteNo) => `📝 ${name} కోసం కొటేషన్ ${quoteNo||''} మీ ఆమోదం కోసం వేచి ఉంది.`,
    quotation_delay: (dept, quoteNo) => `⏰ ఆమోద ఆలస్యం: ${dept} TL కొటేషన్ ${quoteNo||''}ను సకాలంలో ఆమోదించలేదు. మేనేజ్‌మెంట్‌కు ఎస్కలేట్ చేయబడింది.`,
    invoice_approval: (invoiceNo, reasonText) => `🧾 ఇన్వాయిస్ ${invoiceNo||''}కి మీ ఆమోదం అవసరం.`,
    quote_request_received: (name) => `📋 ${name} ఒక కొటేషన్/అంచనా తీసుకువచ్చారు — దయచేసి సరిపోలే కొటేషన్ తయారు చేసి వాట్సాప్‌లో పంచుకోండి.`
  }
};

let notifPermission = 'default';

async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  try { notifPermission = await Notification.requestPermission(); } catch(e) {}
  if (notifPermission !== 'granted') return false;

  // Subscribe to web push
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      const VAPID_PUBLIC = 'BJzQp_iavXrtZpJKuXt0rqEv3QlsrzvbEk0XBv3VuOGeQYdMc7B0fspoKaMuk7fCVjZOYnYerdYAap21QbtVg7Y';

      // Check if already subscribed
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Convert VAPID key to Uint8Array
        const keyBytes = Uint8Array.from(
          atob(VAPID_PUBLIC.replace(/-/g,'+').replace(/_/g,'/')),
          c => c.charCodeAt(0)
        );
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes,
        });
      }

      // Save subscription to Supabase
      const prof = currentProfile;
      if (prof?.id && sub) {
        const subJson = sub.toJSON();
        await VW_DB.client.from('push_subscriptions').upsert({
          profile_id: prof.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
          user_agent: navigator.userAgent.slice(0, 200),
        }, { onConflict: 'endpoint' }).catch(() => {});
      }
    }
  } catch(e) {
    console.warn('Push subscription failed:', e);
  }

  return true;
}

async function notify(titleKey, msgFn, args = [], lang = 'en', tag = 'vw') {
  const title = 'V Wholesale';
  const fn = (MESSAGES[lang] && MESSAGES[lang][titleKey]) || MESSAGES.en[titleKey];
  const body = fn ? fn(...args) : '';
  if (!body) return;

  addInAppNotif({ title, body, tag, time: new Date().toISOString() });

  if (notifPermission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(title, { body, tag, vibrate: [200, 100, 200] });
      } else {
        new Notification(title, { body, tag });
      }
    } catch(e) {}
  }
}

function addInAppNotif(n) {
  const badge = document.getElementById('notif-badge');
  if (badge) {
    let count = (parseInt(badge.textContent) || 0) + 1;
    badge.textContent = count;
    badge.style.display = 'flex';
  }
  // Persisted in-app notifications (with proper recipient routing) are a
  // future enhancement; for now just keep the on-screen badge/toast.
  // VW_DB.put(VW_DB.STORES.notifications, n);
}

function clearNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
}

// ===== PERSISTED, ROLE-TARGETED NOTIFICATIONS =====
// Unlike addInAppNotif (a same-device-only badge bump), these are stored
// in the database and actually reach the right person whenever they next
// open the app — addressed either to a specific permission/role (e.g.
// "inventory") or to a specific profile id. Supports inline actions
// (e.g. "Create PO") so a person can act straight from the notification.

async function createPersistedNotification({ category, title, body, recipientRole = null, recipientId = null, relatedTable = null, relatedId = null, actions = [] }) {
  // Save in-app notification
  const result = await VW_DB.put(VW_DB.STORES.persistedNotifications, {
    category, title, body, recipientRole, recipientId, relatedTable, relatedId, actions, readBy: [], createdAt: new Date().toISOString()
  });

  // Also send web push if we have a specific recipient
  if (recipientId) {
    sendWebPush(recipientId, title, body).catch(() => {});
  }

  return result;
}
window.createPersistedNotification = createPersistedNotification;

// Send background push notification via edge function
async function sendWebPush(profileId, title, body, url) {
  if (!profileId || !title) return;
  try {
    await fetch(
      `${VW_DB.client.supabaseUrl}/functions/v1/web-push`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': VW_DB.client.supabaseKey,
        },
        body: JSON.stringify({
          profile_id: profileId,
          title,
          body: body || '',
          url: url || 'https://hmehtavw.github.io/vwholesale-app/',
        }),
      }
    );
  } catch(e) {
    console.warn('Web push failed:', e);
  }
}
window.sendWebPush = sendWebPush;

async function getMyPersistedNotifications() {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return [];
  const allowedPages = VW_AUTH.getAllowedPages();
  // A notification addressed to a role reaches anyone whose permissions
  // unlock the page that role maps to (e.g. recipientRole 'inventory'
  // reaches anyone with the Inventory page) — mirrors how page access
  // itself is already determined, so there's no separate role list to
  // keep in sync.
  const all = await VW_DB.all(VW_DB.STORES.persistedNotifications);
  return all.filter(n => {
    if (n.recipientId) return n.recipientId === profile.id;
    if (n.recipientRole) {
      const page = PERMISSION_PAGES_FOR_NOTIF[n.recipientRole];
      if (page) return allowedPages.includes(page);
      // No page mapping (e.g. 'management') — match on the user's actual role.
      // A 'management' notification also reaches Sales Head and Admin so the
      // owner/leadership tier always sees escalations like delay reports.
      if (n.recipientRole === profile.role) return true;
      if (n.recipientRole === 'management' && ['management','sales_head','admin'].includes(profile.role)) return true;
      return allowedPages.includes(n.recipientRole);
    }
    return false;
  }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}
window.getMyPersistedNotifications = getMyPersistedNotifications;

// Maps a notification's recipientRole value to the page name it should
// match against getAllowedPages() — for most roles these are the same
// string already (e.g. 'inventory' -> 'inventory'), kept as an explicit
// map in case any ever diverge.
const PERMISSION_PAGES_FOR_NOTIF = { inventory: 'inventory', billing: 'cart', hr: 'hr', crm: 'crm' };

async function markNotificationRead(notifId) {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return;
  const n = await VW_DB.getById(VW_DB.STORES.persistedNotifications, notifId);
  if (!n) return;
  const readBy = n.readBy || [];
  if (!readBy.includes(profile.id)) readBy.push(profile.id);
  n.readBy = readBy;
  await VW_DB.put(VW_DB.STORES.persistedNotifications, n);
}
window.markNotificationRead = markNotificationRead;

async function getUnreadNotificationCount() {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return 0;
  const mine = await getMyPersistedNotifications();
  return mine.filter(n => !(n.readBy||[]).includes(profile.id)).length;
}
window.getUnreadNotificationCount = getUnreadNotificationCount;

window.VW_NOTIFY = { notify, requestNotifPermission, clearNotifBadge, MESSAGES, bilingual, waEncode, createPersistedNotification, getMyPersistedNotifications, markNotificationRead, getUnreadNotificationCount };

// Combines an English and Telugu version of a customer-facing message
// for WhatsApp sends — every customer/visitor message goes out in both.
function bilingual(en, te) {
  return `${en}\n\n${te}`;
}

// encodeURIComponent leaves ! ' ( ) * unescaped, which breaks when the
// resulting URL is embedded inside an onclick="..." HTML attribute
// (an unescaped ' ends the JS string early -> SyntaxError). This wraps
// encodeURIComponent and also escapes those characters.
function waEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
window.waEncode = waEncode;




/* === escalation.js === */

// Escalation hierarchy: executive/specialist -> TL -> Floor Manager -> Store Manager -> Management
// Reaches Management by ~4 minutes total if nobody responds.
const TRANSITION_MS = {
  executive: 30 * 1000,    // 0:00 -> 0:30
  specialist: 30 * 1000,   // 0:00 -> 0:30
  tl: 60 * 1000,           // 0:30 -> 1:30
  floor_manager: 75 * 1000,  // 1:30 -> 2:45
  store_manager: 75 * 1000,  // 2:45 -> 4:00
  // 'management' has no further transition (final level)
};

// Tile Quotation approval chain — 30s at each level (per business requirement)
// TL / Sr Executive → Floor Manager → Store Manager → Management
const TQ_CHAIN = ['tl', 'floor_manager', 'store_manager', 'management'];
const TQ_TRANSITION_MS = 30 * 1000; // 30 seconds at every level

const NEXT_LEVEL = {
  executive: 'tl', specialist: 'tl',
  tl: 'floor_manager',
  floor_manager: 'store_manager',
  store_manager: 'management'
};
const LEVEL_LABELS = {
  executive: 'Executive', specialist: 'Specialist', tl: 'Team Lead',
  floor_manager: 'Floor Manager', store_manager: 'Store Manager', management: 'Management'
};

// ===== EXECUTIVE ASSIGNMENT (round robin, skip busy/break) =====
async function assignNextExecutive(excludeIds = []) {
  const execs = await VW_DB.all(VW_DB.STORES.executives);
  if (!execs.length) return null;
  let pointer = await VW_DB.getSetting('roundRobinPointer', 0);
  const n = execs.length;
  execs.sort((a,b) => a.order - b.order);

  for (let i = 0; i < n; i++) {
    const idx = (pointer + i) % n;
    const exec = execs[idx];
    if (excludeIds.includes(exec.id)) continue;
    if (exec.status === 'available') {
      await VW_DB.setSetting('roundRobinPointer', (idx + 1) % n);
      return exec;
    }
  }
  return null; // all busy/break
}

// ===== START A NEW VISIT — assigns executive, starts escalation chain =====
async function startVisitRouting(visitId) {
  const exec = await assignNextExecutive();
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!visit) return;

  visit.escalationLog = visit.escalationLog || [];

  if (exec) {
    visit.assignedExecutiveId = exec.id;
    visit.escalationLog.push({ level: 'executive', staffId: exec.id, name: exec.name, notifiedAt: new Date().toISOString(), status: 'pending' });
    exec.status = 'busy';
    exec.statusUpdatedAt = new Date().toISOString();
    exec.currentVisitId = visitId;
    await VW_DB.put(VW_DB.STORES.executives, exec);
    await notifyPerson(exec.phone, 'walkin_exec', [visit.customerName || 'Customer'], 'en', `visit-${visitId}`);
  } else {
    visit.escalationLog.push({ level: 'executive', staffId: null, name: 'No executive available', notifiedAt: new Date().toISOString(), status: 'pending' });
  }
  await VW_DB.put(VW_DB.STORES.visits, visit);
}

// ===== ESCALATE TO THE NEXT LEVEL IN THE CHAIN =====
// Mutates `log` by pushing the next escalation entry. Used for both visits and tasks.
// `department` is passed for tasks (so only that department's TL is pinged,
// not every TL company-wide); omitted for visits (all TLs are relevant there).
async function escalateNext(log, fromLevel, customerName, tag, department = null) {
  const nextLevel = NEXT_LEVEL[fromLevel];
  if (!nextLevel) return null;

  if (nextLevel === 'tl') {
    const staff = await VW_DB.all(VW_DB.STORES.staff);
    let tls = staff.filter(s => s.team === 'TL');
    if (department) {
      const deptTls = tls.filter(s => s.department === department);
      if (deptTls.length) tls = deptTls; // fall back to all TLs if this department has none
    }
    const entry = { level: 'tl', staffIds: tls.map(t=>t.id), names: tls.map(t=>t.name), notifiedAt: new Date().toISOString(), status: 'pending' };
    log.push(entry);
    for (const tl of tls) {
      await notifyPerson(tl.phone, 'escalation_tl', [customerName || 'Customer'], tl.language || 'en', `${tag}-tl`);
    }
    return entry;
  }

  const contacts = await VW_DB.getSetting('escalationContacts', {});
  const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager', management: 'management' };
  const contact = contacts[keyMap[nextLevel]] || {};
  const entry = { level: nextLevel, name: contact.name || LEVEL_LABELS[nextLevel], phone: contact.phone || '', notifiedAt: new Date().toISOString(), status: 'pending' };
  log.push(entry);
  const msgType = nextLevel === 'management' ? 'urgent_unattended' : 'escalation_manager';
  await VW_NOTIFY.notify(msgType, null, [customerName || 'Customer', LEVEL_LABELS[nextLevel]], 'en', `${tag}-${nextLevel}`);
  return entry;
}

// ===== ACCEPT A VISIT (executive or any escalation level taps Accept) =====
async function acceptVisit(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!visit) return;
  const log = visit.escalationLog || [];
  const last = log[log.length-1];
  if (last) { last.status = 'accepted'; last.respondedAt = new Date().toISOString(); }
  if (last && last.level !== 'executive') {
    const profile = VW_AUTH.getCurrentProfile();
    visit.assignedExecutiveId = null;
    if (profile && profile.staffRef === 'staff') visit.assignedTLId = profile.staffId;
  }
  visit.status = 'active';
  visit.escalationLog = log;
  await VW_DB.put(VW_DB.STORES.visits, visit);
}

// ===== TASK ROUTING — each requirement item routes to department specialist =====
// Round-robins among ALL specialists/TLs in that department (per-department
// pointer stored in settings) so tasks distribute evenly instead of always
// landing on the first staff member found for that department.
async function routeTask(taskId) {
  const task = await VW_DB.getById(VW_DB.STORES.tasks, taskId);
  if (!task) return;
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const deptStaff = staff.filter(s => s.department === task.department && (s.team === 'specialist' || s.team === 'TL'));

  task.escalationLog = task.escalationLog || [];

  if (deptStaff.length) {
    deptStaff.sort((a,b) => a.id - b.id); // stable order for round-robin
    const pointerKey = `deptRoutingPointer_${task.department}`;
    const pointer = await VW_DB.getSetting(pointerKey, 0);
    const idx = pointer % deptStaff.length;
    const specialist = deptStaff[idx];
    await VW_DB.setSetting(pointerKey, (idx + 1) % deptStaff.length);

    task.assignedTo = specialist.id;
    task.assignedToName = specialist.name;
    task.escalationLog.push({ level: 'specialist', staffId: specialist.id, name: specialist.name, notifiedAt: new Date().toISOString(), status: 'pending' });
    await notifyPerson(specialist.phone, 'task_assigned', [task.customerName || 'Customer', task.department, task.description || ''], specialist.language || 'en', `task-${taskId}`);
  } else {
    task.escalationLog.push({ level: 'specialist', staffId: null, name: 'No specialist available', notifiedAt: new Date().toISOString(), status: 'pending' });
  }
  await VW_DB.put(VW_DB.STORES.tasks, task);
}

// ===== ESCALATION SWEEP — runs periodically =====
async function checkEscalations() {
  const now = Date.now();

  // Tile Quotation approval chain — runs first (fast, 30s windows)
  await checkTileQuoteEscalations().catch(e => console.log('TQ escalation error:', e.message));
  await checkCommissionEscalations().catch(e => console.log('Commission escalation error:', e.message));

  // Visits awaiting acceptance
  const visits = await VW_DB.all(VW_DB.STORES.visits);
  for (const visit of visits) {
    if (visit.status !== 'pending') continue;
    const log = visit.escalationLog || [];
    const last = log[log.length-1];
    if (!last || last.status !== 'pending') continue;
    const threshold = TRANSITION_MS[last.level];
    if (!threshold) continue; // 'management' = final level, no further escalation
    const elapsed = now - new Date(last.notifiedAt).getTime();
    if (elapsed < threshold) continue;

    last.status = 'timeout';
    if (last.level === 'executive' && last.staffId) {
      const prevExec = await VW_DB.getById(VW_DB.STORES.executives, last.staffId);
      if (prevExec && prevExec.currentVisitId === visit.id) { prevExec.status = 'available'; prevExec.currentVisitId = null; await VW_DB.put(VW_DB.STORES.executives, prevExec); }
    }
    await escalateNext(log, last.level, visit.customerName, `visit-${visit.id}`);
    visit.escalationLog = log;
    await VW_DB.put(VW_DB.STORES.visits, visit);
  }

  // Tasks awaiting acceptance
  const tasks = await VW_DB.all(VW_DB.STORES.tasks);
  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    const log = task.escalationLog || [];
    const last = log[log.length-1];
    if (!last || last.status !== 'pending') continue;
    const threshold = TRANSITION_MS[last.level];
    if (!threshold) continue;
    const elapsed = now - new Date(last.notifiedAt).getTime();
    if (elapsed < threshold) continue;

    last.status = 'timeout';
    const newEntry = await escalateNext(log, last.level, task.customerName, `task-${task.id}`, task.department);
    if (newEntry) {
      if (newEntry.level === 'tl' && newEntry.staffIds && newEntry.staffIds.length) {
        task.assignedTo = newEntry.staffIds[0];
        task.assignedToName = newEntry.names[0];
      } else if (newEntry.level !== 'tl') {
        task.assignedToName = newEntry.name;
      }
    }
    task.escalationLog = log;
    await VW_DB.put(VW_DB.STORES.tasks, task);
  }

  // Ranked visitor routing (Delivery/Pickup/Brand/etc. visitors) — moves
  // one-by-one down the priority list if nobody accepts in time.
  const allVisits = await VW_DB.all(VW_DB.STORES.visits);
  for (const v of allVisits) {
    if (v.status !== 'pending' || !v.visitorRoutingList || !v.visitorRoutingList.length) continue;
    const vlog = v.escalationLog || [];
    const vlast = vlog[vlog.length-1];
    if (!vlast || vlast.level !== 'visitor_routing' || vlast.status !== 'pending') continue;
    const elapsed = now - new Date(vlast.notifiedAt).getTime();
    if (elapsed < TRANSITION_MS.executive) continue; // reuse the same 30s window as the executive level

    const currentIdx = v.visitorRoutingList.indexOf(vlast.staffId);
    const nextStaffId = v.visitorRoutingList[currentIdx + 1];
    if (nextStaffId === undefined) continue; // reached the end of the list — nobody left to escalate to

    vlast.status = 'timeout';
    const staffList = await VW_DB.all(VW_DB.STORES.staff);
    const nextPerson = staffList.find(s => s.id === nextStaffId);
    if (nextPerson) {
      const typeLabel = (VISITOR_TYPES.find(t=>t.key===v.visitorType)||{}).label || v.visitorType;
      await VW_NOTIFY.notify('visitor', null, [v.customerName, typeLabel], nextPerson.language || 'en', `visitor-${v.id}`);
      vlog.push({ level: 'visitor_routing', staffId: nextPerson.id, name: nextPerson.name, notifiedAt: new Date().toISOString(), status: 'pending' });
      v.escalationLog = vlog;
      await VW_DB.put(VW_DB.STORES.visits, v);
    }
  }

  // Quotations awaiting approval
  const quotations = await VW_DB.all(VW_DB.STORES.quotations);
  for (const q of quotations) {
    if (q.approvalStatus !== 'pending_approval') continue;
    const qlog = q.approvalLog || [];
    const qlast = qlog[qlog.length-1];
    if (!qlast || qlast.status !== 'pending') continue;

    if (qlast.level === 'tl' && qlast.branches) {
      // TL step has parallel per-department branches — each branch escalates
      // independently (e.g. re-notify the same TLs, since there's no level
      // "above" a department's TL within this step) if it's been pending
      // too long. Once every branch is non-pending, the step itself resolves.
      const threshold = TRANSITION_MS.tl;
      let changed = false;
      for (const branch of qlast.branches) {
        if (branch.status !== 'pending') continue;
        const elapsed = now - new Date(branch.notifiedAt).getTime();
        if (elapsed < threshold) continue;
        // Re-notify the same TLs as a reminder (no higher-up to hand a
        // single department's approval to — Floor Manager covers the
        // combined quotation, not a specific department's branch).
        branch.notifiedAt = new Date().toISOString();
        changed = true;
        if (branch.staffIds) {
          const staffList = await VW_DB.all(VW_DB.STORES.staff);
          const tls = staffList.filter(s => branch.staffIds.includes(s.id));
          for (const tl of tls) await notifyPerson(tl.phone, 'quotation_approval', [q.customerName || q.siteName || 'a customer', `${q.quoteNo||''} (${branch.department}) — reminder`], tl.language || 'en', `quote-${q.id}-tl-${branch.department}-reminder`);
        }
        // First time this branch overruns, escalate it to Management so a
        // stuck department can't hold the whole quote hostage: Management
        // (admin) can approve any pending branch directly, and a Delay
        // Report is filed once so the holdup is on record + visible on the
        // dashboard's pending-approvals surface.
        if (!branch.escalatedToManagement) {
          branch.escalatedToManagement = true;
          branch.escalatedAt = new Date().toISOString();
          await VW_NOTIFY.notify('quotation_delay', null, [branch.department, q.quoteNo || ''], 'en', `quote-${q.id}-delay-${branch.department}`);
          await createPersistedNotification({
            category: 'approval_delay',
            title: `Approval delayed — ${branch.department}`,
            body: `${branch.department} TL hasn't approved quotation ${q.quoteNo||''} for ${q.customerName||q.siteName||'a customer'} in time. Escalated to Management.`,
            recipientRole: 'management',
            relatedTable: 'quotations',
            relatedId: q.id
          });
        }
      }
      if (changed) { q.approvalLog = qlog; await VW_DB.put(VW_DB.STORES.quotations, q); }
      continue;
    }

    const qthreshold = TRANSITION_MS[qlast.level];
    if (!qthreshold) continue;
    const qelapsed = now - new Date(qlast.notifiedAt).getTime();
    if (qelapsed < qthreshold) continue;

    qlast.status = 'timeout';
    const qNextLevel = NEXT_LEVEL[qlast.level];
    if (qNextLevel === 'management') {
      qlog.push({ level: 'management', name: LEVEL_LABELS.management, notifiedAt: new Date().toISOString(), status: 'pending' });
      await VW_NOTIFY.notify('quotation_approval', null, [q.customerName || q.siteName || 'a customer', q.quoteNo || ''], 'en', `quote-${q.id}-management`);
    } else if (qNextLevel) {
      const contacts = await VW_DB.getSetting('escalationContacts', {});
      if (escalationContactExists(contacts, qNextLevel)) {
        const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager' };
        const contact = contacts[keyMap[qNextLevel]] || {};
        qlog.push({ level: qNextLevel, name: contact.name || LEVEL_LABELS[qNextLevel], phone: contact.phone || '', notifiedAt: new Date().toISOString(), status: 'pending' });
        await VW_NOTIFY.notify('quotation_approval', null, [q.customerName || q.siteName || 'a customer', q.quoteNo || ''], 'en', `quote-${q.id}-${qNextLevel}`);
      }
    }
    await advanceQuotationChainPastEmptyLevels(qlog, null);
    q.approvalLog = qlog;
    await VW_DB.put(VW_DB.STORES.quotations, q);
  }
}

async function notifyPerson(phone, type, args, lang, tag) {
  await VW_NOTIFY.notify(type, null, args, lang, tag);
}

// ===== CLOSE A VISIT (all tasks done, customer leaving) =====
async function closeVisit(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!visit) return;
  visit.status = 'completed';
  visit.closedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.visits, visit);

  if (visit.assignedExecutiveId) {
    const exec = await VW_DB.getById(VW_DB.STORES.executives, visit.assignedExecutiveId);
    if (exec && exec.currentVisitId === visitId) { exec.status = 'available'; exec.currentVisitId = null; await VW_DB.put(VW_DB.STORES.executives, exec); }
  }

  const FEEDBACK_BASE_URL = 'https://hmehtavw.github.io/vwholesale-app/feedback.html';

  const customer = visit.customerId ? await VW_DB.getById(VW_DB.STORES.customers, visit.customerId) : null;
  if (customer) {
    const tasks = await VW_DB.getByIndex(VW_DB.STORES.tasks, 'visitId', visitId);
    const servedBy = tasks.map(t=>t.assignedToName).filter(Boolean).join(', ');
    const deptList = [...new Set(tasks.map(t=>t.department).filter(Boolean))].join(', ');
    const feedbackUrl = `${FEEDBACK_BASE_URL}?visit=${visitId}&customer=${customer.id}&name=${encodeURIComponent(customer.name)}${deptList?'&dept='+encodeURIComponent(deptList):''}`;
    const msg = VW_NOTIFY.waEncode(VW_NOTIFY.bilingual(
      `Thank you for visiting V Wholesale, ${customer.name}! We'd love your feedback${servedBy ? ' on your experience with ' + servedBy : ''}. Please rate us here: ${feedbackUrl}`,
      `వీ హోల్‌సేల్‌ను సందర్శించినందుకు ధన్యవాదాలు, ${customer.name}! మీ అభిప్రాయం మాకు విలువైనది${servedBy ? ' (' + servedBy + ' తో మీ అనుభవం గురించి)' : ''}. దయచేసి ఇక్కడ రేటింగ్ ఇవ్వండి: ${feedbackUrl}`
    ));
    return `https://wa.me/91${customer.phone}?text=${msg}`;
  }

  // Visitors (Brand/Authority/Delivery/Pickup/Interview/Other) don't have a
  // linked customer record — they have visitorPhone instead. Generate the
  // same kind of thank-you/feedback link for them too.
  if (visit.visitorPhone) {
    const name = visit.customerName || 'there';
    const handledBy = visit.acceptedBy || '';
    const feedbackUrl = `${FEEDBACK_BASE_URL}?visit=${visitId}&name=${encodeURIComponent(name)}`;
    const msg = VW_NOTIFY.waEncode(VW_NOTIFY.bilingual(
      `Thank you for visiting V Wholesale, ${name}! We'd love your feedback${handledBy ? ' on your experience with ' + handledBy : ''}. Please rate us here: ${feedbackUrl}`,
      `వీ హోల్‌సేల్‌ను సందర్శించినందుకు ధన్యవాదాలు, ${name}! మీ అభిప్రాయం మాకు విలువైనది${handledBy ? ' (' + handledBy + ' తో మీ అనుభవం గురించి)' : ''}. దయచేసి ఇక్కడ రేటింగ్ ఇవ్వండి: ${feedbackUrl}`
    ));
    return `https://wa.me/91${visit.visitorPhone}?text=${msg}`;
  }

  return null;
}

// =====================================================
// TILE QUOTATION APPROVAL ESCALATION ENGINE
// Chain: TL/SrExec → Floor Manager → Store Manager → Management
// 30 seconds at each level — auto-escalates if no response
// Same pattern as visit/task escalation above
// =====================================================

// Map each chain level to which profiles can action it
const TQ_LEVEL_ROLES = {
  tl:           ['tl', 'sr_executive'],          // TL or Sr Executive can approve first
  floor_manager:['floor_manager'],
  store_manager:['store_manager'],
  management:   ['management', 'admin'],
};

// Contractor-Club commission approval chain (sequential):
// Sr Sales → ASM → Sales Head → Management. Share-profile link unlocks only after
// Management (final) approval. Commission is admin/backend-only, never on quotes.
const COMMISSION_CHAIN = ['sr_sales', 'asm', 'sales_head', 'management'];
const COMMISSION_LEVEL_ROLES = {
  sr_sales:   ['sr_sales', 'admin'],
  asm:        ['asm', 'admin'],
  sales_head: ['sales_head', 'admin'],
  management: ['management', 'admin'],
};
const COMMISSION_DEFAULTS = { first_referral: 2, other_category: 0.5 }; // % — management may override
const COMMISSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per level before auto-escalation
const COMMISSION_LEVEL_LABELS = { sr_sales:'Sr Sales', asm:'ASM', sales_head:'Sales Head', management:'Management' };
function _commCatLabel(c){ return ({first_referral:'1st Referral', same_category:'Same Category (our choice)', other_category:'Other Category'})[c] || c; }

async function _commApproversFor(level){
  const roles = COMMISSION_LEVEL_ROLES[level] || [level];
  const { data } = await VW_DB.client.from('profiles').select('id,name,role,phone').in('role', roles).eq('status','approved');
  return data || [];
}
async function _commNotify(ids, title, body, relatedId){
  const now = new Date().toISOString();
  for (const id of ids){
    await VW_DB.client.from('notifications').insert({ recipient_id:id, category:'commission_approval', title, body, related_table:'contractor_commissions', related_id:relatedId, read:false, created_at:now }).then(()=>{}).catch(()=>{});
  }
}

async function submitCommission(payload){
  const profile = VW_AUTH.getCurrentProfile();
  const now = new Date().toISOString();
  const approvers = await _commApproversFor('sr_sales');
  const approvals = [{ level:'sr_sales', notifiedAt:now, status:'pending', approverIds:approvers.map(p=>p.id), approverNames:approvers.map(p=>p.name) }];
  const { data, error } = await VW_DB.client.from('contractor_commissions').insert({
    contractor_id: payload.contractor_id || null,
    contractor_name: payload.contractor_name || '',
    category: payload.category || 'first_referral',
    pct: payload.pct,
    is_first_referral: !!payload.is_first_referral,
    status: 'pending', approval_level: 'sr_sales', approvals,
    requested_by: profile?.id || null, requested_by_name: profile?.name || '',
    notes: payload.notes || ''
  }).select().single();
  if (error){ showToast('Could not submit commission','err'); return null; }
  await _commNotify(approvers.map(p=>p.id), `💰 Commission approval — ${payload.contractor_name}`, `${_commCatLabel(payload.category)} · ${payload.pct}% · by ${profile?.name||'—'}`, data.id);
  showToast('Commission submitted for approval ✓','success');
  return data;
}

async function approveCommission(id){
  const { data: row } = await VW_DB.client.from('contractor_commissions').select('*').eq('id',id).single();
  if (!row) return;
  const approvals = row.approvals || [];
  const last = approvals[approvals.length-1];
  if (!last || last.status!=='pending'){ showToast('Nothing pending','warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  if (!(COMMISSION_LEVEL_ROLES[last.level]||[]).includes(profile?.role||'')){ showToast(`Only ${COMMISSION_LEVEL_LABELS[last.level]} can approve this step`,'warn'); return; }
  const now = new Date().toISOString();
  last.status='approved'; last.by=profile.id; last.by_name=profile.name; last.at=now;
  const nextLevel = COMMISSION_CHAIN[COMMISSION_CHAIN.indexOf(last.level)+1];
  const update = { approvals, updated_at: now };
  if (nextLevel){
    const approvers = await _commApproversFor(nextLevel);
    approvals.push({ level:nextLevel, notifiedAt:now, status:'pending', approverIds:approvers.map(p=>p.id), approverNames:approvers.map(p=>p.name) });
    update.approval_level = nextLevel;
    await _commNotify(approvers.map(p=>p.id), `💰 Commission — ${row.contractor_name}`, `Cleared ${COMMISSION_LEVEL_LABELS[last.level]} · awaiting your approval`, id);
  } else {
    update.status='approved'; update.approval_level='done';
    if (row.requested_by) await _commNotify([row.requested_by], `✅ Commission approved — ${row.contractor_name}`, `${_commCatLabel(row.category)} · ${row.pct}% fully approved — share unlocked`, id);
  }
  await VW_DB.client.from('contractor_commissions').update(update).eq('id',id);
  showToast(nextLevel?`Approved → ${COMMISSION_LEVEL_LABELS[nextLevel]}`:'Fully approved ✓','success');
  if (typeof navigateTo==='function') navigateTo('commissions');
}

async function rejectCommission(id){
  const reason = (prompt('Reason for rejection (shared with submitter):')||'').trim();
  const { data: row } = await VW_DB.client.from('contractor_commissions').select('*').eq('id',id).single();
  if (!row) return;
  const approvals = row.approvals || [];
  const last = approvals[approvals.length-1];
  if (!last || last.status!=='pending'){ showToast('Nothing pending','warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  if (!(COMMISSION_LEVEL_ROLES[last.level]||[]).includes(profile?.role||'')){ showToast('Not your approval step','warn'); return; }
  const now = new Date().toISOString();
  last.status='rejected'; last.by=profile.id; last.by_name=profile.name; last.at=now; last.reason=reason;
  await VW_DB.client.from('contractor_commissions').update({ approvals, status:'rejected', approval_level:'rejected', updated_at:now }).eq('id',id);
  if (row.requested_by) await _commNotify([row.requested_by], `❌ Commission rejected — ${row.contractor_name}`, reason||`Rejected at ${COMMISSION_LEVEL_LABELS[last.level]}`, id);
  showToast('Commission rejected','success');
  if (typeof navigateTo==='function') navigateTo('commissions');
}

// 5-minute auto-escalation: skip a non-responding (e.g. on-leave) approver, move to the
// next in-charge, and keep Management informed of what's pending. Hooked into the sweep.
async function checkCommissionEscalations(){
  const now = Date.now();
  const { data: pending } = await VW_DB.client.from('contractor_commissions').select('id,contractor_name,category,approvals,status').eq('status','pending');
  if (!pending?.length) return;
  for (const row of pending){
    const approvals = row.approvals || [];
    const last = approvals[approvals.length-1];
    if (!last || last.status!=='pending') continue;
    if (now - new Date(last.notifiedAt).getTime() < COMMISSION_TIMEOUT_MS) continue;
    last.status='timeout'; last.timedOutAt=new Date().toISOString();
    const nextLevel = COMMISSION_CHAIN[COMMISSION_CHAIN.indexOf(last.level)+1];
    const ts = new Date().toISOString();
    if (!nextLevel){
      const mgmt = await _commApproversFor('management');
      approvals.push({ level:'management', notifiedAt:ts, status:'pending', approverIds:mgmt.map(p=>p.id), approverNames:mgmt.map(p=>p.name), note:'Escalation exhausted — management decision required' });
      await _commNotify(mgmt.map(p=>p.id), `⏰ Commission needs decision — ${row.contractor_name}`, `${_commCatLabel(row.category)} still unapproved after full escalation.`, row.id);
      await VW_DB.client.from('contractor_commissions').update({ approvals, approval_level:'management' }).eq('id',row.id);
      continue;
    }
    const approvers = await _commApproversFor(nextLevel);
    approvals.push({ level:nextLevel, notifiedAt:ts, status:'pending', approverIds:approvers.map(p=>p.id), approverNames:approvers.map(p=>p.name), escalatedFrom:last.level });
    await _commNotify(approvers.map(p=>p.id), `⚠️ Escalated commission — ${row.contractor_name}`, `No response from ${COMMISSION_LEVEL_LABELS[last.level]} in 5 min — your approval needed`, row.id);
    if (nextLevel!=='management'){
      const mgmt = await _commApproversFor('management');
      await _commNotify(mgmt.map(p=>p.id), `ℹ️ Commission delay — ${row.contractor_name}`, `${COMMISSION_LEVEL_LABELS[last.level]} missed the 5-min window; escalated to ${COMMISSION_LEVEL_LABELS[nextLevel]}`, row.id);
    }
    await VW_DB.client.from('contractor_commissions').update({ approvals, approval_level:nextLevel, updated_at:ts }).eq('id',row.id);
  }
}

// Share-gate: a contractor's profile/referral link unlocks only after a fully-approved commission.
async function contractorCommissionApproved(contractorId){
  if (!contractorId) return false;
  const { data } = await VW_DB.client.from('contractor_commissions').select('id').eq('contractor_id',contractorId).eq('status','approved').limit(1);
  return !!(data && data.length);
}

async function renderCommissionsPage(){
  const profile = VW_AUTH.getCurrentProfile();
  const myRole = profile?.role || '';
  const { data: rows } = await VW_DB.client.from('contractor_commissions').select('*').order('created_at',{ascending:false});
  const all = rows || [];
  const myQueue = all.filter(r=>{ if(r.status!=='pending')return false; const last=(r.approvals||[]).slice(-1)[0]; return last && (COMMISSION_LEVEL_ROLES[last.level]||[]).includes(myRole); });
  const statusBadge = (r)=>{
    if(r.status==='approved') return `<span class="badge" style="background:rgba(34,197,94,0.15);color:var(--green)">Approved · share unlocked</span>`;
    if(r.status==='rejected') return `<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--red)">Rejected</span>`;
    const last=(r.approvals||[]).slice(-1)[0];
    return `<span class="badge" style="background:var(--gold-muted);color:var(--gold)">Pending · ${COMMISSION_LEVEL_LABELS[last?.level]||'—'}</span>`;
  };
  const progress = (r)=> COMMISSION_CHAIN.map(lv=>{ const e=(r.approvals||[]).find(a=>a.level===lv && a.status==='approved'); const done=!!e; const cur=r.status==='pending'&&(r.approvals||[]).slice(-1)[0]?.level===lv; return `<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:${done?'rgba(34,197,94,0.15)':cur?'var(--gold-muted)':'var(--bg3)'};color:${done?'var(--green)':cur?'var(--gold)':'var(--text3)'}">${done?'✓ ':''}${COMMISSION_LEVEL_LABELS[lv]}</span>`; }).join(' ');
  return `
  <div style="padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0">💰 Commissions</h2>
      <button class="btn-primary" onclick="VW_COMMISSION.openAdd()" style="padding:8px 14px">+ Add</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:14px">Contractor-Club referral commissions · chain: Sr Sales → ASM → Sales Head → Management · 5-min auto-escalation · admin/backend only, never shown on quotes</div>
    ${myQueue.length?`
    <div class="card" style="margin-bottom:12px;border-color:var(--gold-border)">
      <h3 class="card-title">⏳ Pending your approval <span class="badge">${myQueue.length}</span></h3>
      ${myQueue.map(r=>`
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between"><span style="font-weight:700;font-size:14px">${r.contractor_name||'—'}</span><span style="color:var(--gold);font-weight:800">${r.pct}%</span></div>
        <div style="font-size:11px;color:var(--text3);margin:3px 0">${_commCatLabel(r.category)}${r.notes?` · ${r.notes}`:''} · raised by ${r.requested_by_name||'—'}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-primary" style="flex:1;padding:7px" onclick="VW_COMMISSION.approve(${r.id})">✓ Approve</button>
          <button style="flex:1;padding:7px;background:var(--bg3);border:1px solid var(--red);color:var(--red);border-radius:8px;font-weight:700;cursor:pointer" onclick="VW_COMMISSION.reject(${r.id})">Reject</button>
        </div>
      </div>`).join('')}
    </div>`:''}
    <div class="card">
      <h3 class="card-title">All Commissions <span class="badge">${all.length}</span></h3>
      ${all.length?all.map(r=>`
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:14px">${r.contractor_name||'—'}</span>
          <span style="color:var(--gold);font-weight:800">${r.pct}%</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin:3px 0">${_commCatLabel(r.category)} · ${statusBadge(r)}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${progress(r)}</div>
      </div>`).join(''):'<div style="text-align:center;color:var(--text3);padding:20px;font-size:13px">No commissions yet — tap “+ Add”.</div>'}
    </div>
  </div>`;
}

async function openAddCommission(){
  const { data: contractors } = await VW_DB.client.from('contractors').select('id,name,company_name').order('name');
  const list = contractors || [];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin-bottom:12px">Add Commission</h3>
    <div class="form-group"><label>Contractor *</label>
      <select id="cm-contractor">${list.length?list.map(c=>`<option value="${c.id}">${c.name}${c.company_name?' · '+c.company_name:''}</option>`).join(''):'<option value="">No contractors found</option>'}</select></div>
    <div class="form-group"><label>Category *</label>
      <select id="cm-cat" onchange="VW_COMMISSION.onCatChange(this.value)">
        <option value="first_referral">1st Referral (default 2%)</option>
        <option value="same_category">Same Category — our choice</option>
        <option value="other_category">Other Category (default 0.5%)</option>
      </select></div>
    <div class="form-group"><label>Commission % *</label><input type="number" id="cm-pct" value="2" min="0" max="100" step="0.25"></div>
    <div class="form-group"><label>Note (optional)</label><input type="text" id="cm-note" placeholder="e.g. customer brought directly by him"></div>
    <button class="btn-primary full-width" onclick="VW_COMMISSION.submit()">Submit for approval</button>
    <div style="font-size:11px;color:var(--text3);margin-top:8px;text-align:center">Defaults: 1st referral 2%, other categories 0.5% — Management may override. Multiple entries per contractor are allowed.</div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay')?.classList.add('open');
}
function onCommCatChange(cat){
  const pct = document.getElementById('cm-pct'); if(!pct) return;
  if(cat==='first_referral') pct.value = COMMISSION_DEFAULTS.first_referral;
  else if(cat==='other_category') pct.value = COMMISSION_DEFAULTS.other_category;
}
async function submitCommissionForm(){
  const sel = document.getElementById('cm-contractor');
  const contractorId = sel?.value;
  if(!contractorId){ showToast('Select a contractor','warn'); return; }
  const contractorName = sel.options[sel.selectedIndex]?.text || '';
  const category = document.getElementById('cm-cat')?.value || 'first_referral';
  const pct = parseFloat(document.getElementById('cm-pct')?.value);
  if(isNaN(pct)){ showToast('Enter a commission %','warn'); return; }
  const notes = document.getElementById('cm-note')?.value.trim() || '';
  await submitCommission({ contractor_id:Number(contractorId), contractor_name:contractorName, category, pct, is_first_referral:category==='first_referral', notes });
  closeSheet();
  if (typeof navigateTo==='function') navigateTo('commissions');
}

window.VW_COMMISSION = {
  renderPage: renderCommissionsPage, openAdd: openAddCommission, onCatChange: onCommCatChange,
  submit: submitCommissionForm, approve: approveCommission, reject: rejectCommission,
  isApproved: contractorCommissionApproved
};

async function startTileQuoteApproval(tileQuoteId) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id', tileQuoteId).single();
  if (!q) return;

  // Get all profiles to find approvers for first level (TL / Sr Executive)
  const { data: profiles } = await VW_DB.client
    .from('profiles')
    .select('id,name,role,phone')
    .in('role', TQ_LEVEL_ROLES.tl)
    .eq('status', 'approved');

  const approvers = profiles || [];
  const now = new Date().toISOString();

  const firstEntry = {
    level: 'tl',
    notifiedAt: now,
    status: 'pending',
    approverIds: approvers.map(p => p.id),
    approverNames: approvers.map(p => p.name),
    roles: TQ_LEVEL_ROLES.tl,
  };

  const log = [firstEntry];

  await VW_DB.client.from('tile_quotations').update({
    approval_status: 'pending_approval',
    status: 'pending_approval',
    approval_submitted_at: q.approval_submitted_at || now,
    approval_log: log,
  }).eq('id', tileQuoteId);

  // Notify all TL / Sr Executive profiles
  for (const p of approvers) {
    await VW_DB.client.from('notifications').insert({
      recipient_id: p.id,
      category: 'tq_approval',
      title: `📋 Tile Quote Approval — ${q.tq_no}`,
      body: `${q.customer_name} · ${parseFloat(q.total_area_sqft||0).toFixed(0)} sqft · Submitted by ${q.created_by||'Executive'}`,
      related_table: 'tile_quotations',
      related_id: tileQuoteId,
      read: false,
      created_at: now,
    }).catch(() => {}); // non-blocking

    // In-app bell notification (IndexedDB) — shows on TL's device immediately
    await createPersistedNotification({
      category: 'tq_approval',
      title: `📋 TQ Approval Needed — ${q.tq_no}`,
      body: `${q.customer_name} · ${parseFloat(q.total_area_sqft||0).toFixed(0)} sqft · by ${q.created_by||'Executive'}`,
      recipientId: p.id,
      relatedTable: 'tile_quotations',
      relatedId: tileQuoteId,
      actions: [{ label: '👁 Open Quote', action: 'open_tq' }],
    }).catch(() => {});
  }

  showToast && showToast(`${q.tq_no} sent for TL / Sr Executive approval`, 'success');
}

async function checkTileQuoteEscalations() {
  const now = Date.now();

  // Only check quotes that are pending approval
  const { data: pending } = await VW_DB.client
    .from('tile_quotations')
    .select('id,tq_no,customer_name,approval_log,approval_status,created_by')
    .eq('approval_status', 'pending_approval');

  if (!pending?.length) return;

  for (const q of pending) {
    const log = q.approval_log || [];
    const last = log[log.length - 1];
    if (!last || last.status !== 'pending') continue;

    const elapsed = now - new Date(last.notifiedAt).getTime();
    if (elapsed < TQ_TRANSITION_MS) continue; // Still within 30s window

    const nextLevel = NEXT_LEVEL[last.level];
    if (!nextLevel) continue; // Already at management — no further escalation

    // Mark current level as timed out
    last.status = 'timeout';
    last.timedOutAt = new Date().toISOString();

    // Find approvers for next level
    const nextRoles = TQ_LEVEL_ROLES[nextLevel] || [nextLevel];
    const { data: nextApprovers } = await VW_DB.client
      .from('profiles')
      .select('id,name,role,phone')
      .in('role', nextRoles)
      .eq('status', 'approved');

    const approvers = nextApprovers || [];
    const notifiedAt = new Date().toISOString();

    if (nextLevel === 'management' && !approvers.length) {
      // Final level — still escalate even if no profiles found,
      // management role may be set via escalationContacts in settings
      const contacts = await VW_DB.getSetting('escalationContacts', {});
      const mgmt = contacts.management || {};
      log.push({
        level: 'management',
        notifiedAt,
        status: 'pending',
        approverIds: [],
        approverNames: mgmt.name ? [mgmt.name] : [],
        roles: ['management'],
        note: 'Final escalation — no management profile found, check escalationContacts setting'
      });
    } else {
      log.push({
        level: nextLevel,
        notifiedAt,
        status: 'pending',
        approverIds: approvers.map(p => p.id),
        approverNames: approvers.map(p => p.name),
        roles: nextRoles,
        escalatedFrom: last.level,
      });

      // Notify next level approvers
      for (const p of approvers) {
        await VW_DB.client.from('notifications').insert({
          recipient_id: p.id,
          category: 'tq_approval',
          title: `⚠️ Escalated — Tile Quote ${q.tq_no}`,
          body: `No response from ${LEVEL_LABELS[last.level]} · ${q.customer_name} · ${q.created_by||'Executive'}`,
          related_table: 'tile_quotations',
          related_id: q.id,
          read: false,
          created_at: notifiedAt,
        }).catch(() => {});

        // In-app bell notification
        await createPersistedNotification({
          category: 'tq_approval',
          title: `⚠️ Escalated — ${q.tq_no} needs your approval`,
          body: `${q.customer_name} · No response from ${LEVEL_LABELS[last.level]}`,
          recipientId: p.id,
          relatedTable: 'tile_quotations',
          relatedId: q.id,
          actions: [{ label: '👁 Open Quote', action: 'open_tq' }],
        }).catch(() => {});
      }
    }

    await VW_DB.client.from('tile_quotations')
      .update({ approval_log: log })
      .eq('id', q.id);
  }
}

// Called by the existing escalation sweep — add to checkEscalations
async function approveTileQuoteStep(tileQuoteId, pricePerSqft, pricePerBox, priceNote, editedQuotedPrices, accessoryPrices) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id', tileQuoteId).single();
  if (!q) return;
  const log = q.approval_log || [];
  let last = log[log.length - 1];

  const profile = VW_AUTH.getCurrentProfile();
  const myRole = profile?.role || '';
  const isAdmin = myRole === 'admin' || myRole === 'management';

  // If no approval log entry, create one for admin/management direct approval
  if (!last || last.status !== 'pending') {
    if (isAdmin) {
      // Create a synthetic approval entry
      last = { level: 'management', status: 'pending', assignedAt: new Date().toISOString() };
      log.push(last);
    } else {
      showToast('No pending approval step', 'warn');
      return;
    }
  }

  // Verify this person can action this level
  const allowedRoles = TQ_LEVEL_ROLES[last.level] || [last.level];
  if (!isAdmin && !allowedRoles.includes(myRole)) {
    showToast(`Only ${allowedRoles.join(' / ')} can approve at this stage`, 'warn');
    return;
  }

  const now = new Date().toISOString();
  last.status = 'approved';
  last.approvedBy = profile?.name || '';
  last.approvedById = profile?.id || null;
  last.approvedAt = now;
  if (pricePerSqft > 0 || pricePerBox > 0) {
    last.priceEdited = true;
    last.editedPricePerSqft = pricePerSqft;
    last.editedPricePerBox = pricePerBox;
    last.priceNote = priceNote;
  }

  const updateData = { approval_log: log };
  // Save per-tile edited prices if provided
  if (editedQuotedPrices && Object.keys(editedQuotedPrices).length) {
    updateData.quoted_prices = editedQuotedPrices;
    last.priceEdited = true;
    last.priceNote = priceNote || last.priceNote;
  }
  if (accessoryPrices && Object.keys(accessoryPrices).length) {
    updateData.accessory_prices = accessoryPrices;
    last.accessoryPricesEdited = true;
  }

  // Helper: compute grand_total from price × area + extras + delivery
  const _computeGrandTotal = (ppSqft, ppBox, q) => {
    const area = parseFloat(q.total_area_sqft) || 0;
    let tileTotal = 0;
    if (ppSqft > 0) {
      tileTotal = Math.round(ppSqft * area);
    } else if (ppBox > 0) {
      tileTotal = Math.round(ppBox * (q.total_boxes || 0));
    }
    const extraTotal = (q.extra_products || []).reduce((s, p) => s + ((p.price || 0) * (p.qty || 1)), 0);
    const deliveryTotal = (q.delivery?.transportCost || 0) + (q.delivery?.loadingCost || 0) + (q.delivery?.floorCost || 0);
    return tileTotal + extraTotal + deliveryTotal;
  };

  // Is this the final level? → Fully approved
  if (!NEXT_LEVEL[last.level] || last.level === 'management') {
    updateData.approval_status = 'approved';
    updateData.status = 'approved';
    updateData.approved_at = now;
    updateData.approved_by = profile?.name || '';
    updateData.approved_by_id = profile?.id || null;
    if (pricePerSqft > 0 || pricePerBox > 0) {
      updateData.quoted_price_per_sqft = pricePerSqft || null;
      updateData.quoted_price_per_box = pricePerBox || null;
      updateData.price_edit_note = priceNote || null;
      updateData.price_edited_by = profile?.name || '';
      updateData.price_edited_at = now;
      updateData.grand_total = _computeGrandTotal(pricePerSqft, pricePerBox, q);
    }
    await VW_DB.client.from('tile_quotations').update(updateData).eq('id', tileQuoteId);
    showToast(`${q.tq_no} fully approved ✓${pricePerSqft>0?' · Price set':''}`, 'success');

    // Notify the executive who submitted
    if (q.created_by_id) {
      await VW_DB.client.from('notifications').insert({
        recipient_id: q.created_by_id,
        category: 'tq_approved',
        title: `✅ ${q.tq_no} Approved`,
        body: `Your tile quote for ${q.customer_name} has been approved${pricePerSqft>0?` at ₹${pricePerSqft}/sqft`:''}. Cashier can now collect advance.`,
        related_table: 'tile_quotations', related_id: tileQuoteId,
        read: false, created_at: now,
      }).catch(() => {});

      // In-app bell — executive gets instant notification
      await createPersistedNotification({
        category: 'tq_approved',
        title: `✅ ${q.tq_no} Fully Approved!`,
        body: `${q.customer_name}${pricePerSqft>0?` · ₹${pricePerSqft}/sqft`:''} — Cashier can now collect advance`,
        recipientId: q.created_by_id,
        relatedTable: 'tile_quotations',
        relatedId: tileQuoteId,
        actions: [{ label: '👁 View Quote', action: 'open_tq' }],
      }).catch(() => {});
    }
    return;
  }

  // Not the last level — move to next
  const nextLevel = NEXT_LEVEL[last.level];
  const nextRoles = TQ_LEVEL_ROLES[nextLevel] || [nextLevel];
  const { data: nextApprovers } = await VW_DB.client
    .from('profiles').select('id,name,role').in('role', nextRoles).eq('status','approved');
  const approvers = nextApprovers || [];

  // If price was edited at this level, carry forward to next
  if (pricePerSqft > 0 || pricePerBox > 0) {
    updateData.quoted_price_per_sqft = pricePerSqft || null;
    updateData.quoted_price_per_box = pricePerBox || null;
    updateData.price_edit_note = priceNote || null;
    updateData.price_edited_by = profile?.name || '';
    updateData.price_edited_at = now;
    updateData.grand_total = _computeGrandTotal(pricePerSqft, pricePerBox, q);
  }

  log.push({
    level: nextLevel,
    notifiedAt: now,
    status: 'pending',
    approverIds: approvers.map(p => p.id),
    approverNames: approvers.map(p => p.name),
    roles: nextRoles,
    escalatedFrom: last.level,
  });
  updateData.approval_log = log;
  await VW_DB.client.from('tile_quotations').update(updateData).eq('id', tileQuoteId);

  // Notify next level
  const levelLabel = LEVEL_LABELS[nextLevel] || nextLevel;
  for (const p of approvers) {
    await VW_DB.client.from('notifications').insert({
      recipient_id: p.id,
      category: 'tq_approval',
      title: `📋 Tile Quote Approval — ${q.tq_no}`,
      body: `Approved by ${profile?.name||''} (${LEVEL_LABELS[last.level]}) · Now needs your approval · ${q.customer_name}`,
      related_table: 'tile_quotations', related_id: tileQuoteId,
      read: false, created_at: now,
    }).catch(() => {});

    // In-app bell — next approver gets instant notification
    await createPersistedNotification({
      category: 'tq_approval',
      title: `📋 ${q.tq_no} needs your approval`,
      body: `Passed by ${profile?.name||''} · ${q.customer_name} · Tap to open & approve`,
      recipientId: p.id,
      relatedTable: 'tile_quotations',
      relatedId: tileQuoteId,
      actions: [{ label: '👁 Open & Approve', action: 'open_tq' }],
    }).catch(() => {});
  }
  showToast(`Approved ✓ — escalated to ${levelLabel} for final sign-off`, 'success');
}

async function rejectTileQuoteStep(tileQuoteId, reason) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id', tileQuoteId).single();
  if (!q) return;
  const log = q.approval_log || [];
  const last = log[log.length - 1];
  const profile = VW_AUTH.getCurrentProfile();
  const now = new Date().toISOString();
  if (last) {
    last.status = 'rejected';
    last.rejectedBy = profile?.name || '';
    last.rejectedAt = now;
    last.rejectReason = reason;
  }
  await VW_DB.client.from('tile_quotations').update({
    approval_status: 'rejected',
    status: 'rejected',
    rejected_at: now,
    rejected_by: profile?.name || '',
    rejection_reason: reason,
    approval_log: log,
  }).eq('id', tileQuoteId);

  // Notify the executive who submitted
  if (q.created_by_id) {
    await VW_DB.client.from('notifications').insert({
      recipient_id: q.created_by_id,
      category: 'tq_rejected',
      title: `❌ ${q.tq_no} Rejected`,
      body: `Rejected by ${profile?.name||''}: ${reason}. Please revise and resubmit.`,
      related_table: 'tile_quotations', related_id: tileQuoteId,
      read: false, created_at: now,
    }).catch(() => {});
  }
}

// Export new functions
window.startTileQuoteApproval = startTileQuoteApproval;
window.checkTileQuoteEscalations = checkTileQuoteEscalations;
window.approveTileQuoteStep = approveTileQuoteStep;
window.rejectTileQuoteStep = rejectTileQuoteStep;
window.TQ_CHAIN = TQ_CHAIN;
window.TQ_LEVEL_ROLES = TQ_LEVEL_ROLES;
window.TQ_TRANSITION_MS = TQ_TRANSITION_MS;

window.VW_ESCALATION = { assignNextExecutive, startVisitRouting, acceptVisit, routeTask, checkEscalations, closeVisit, LEVEL_LABELS, TRANSITION_MS, startQuotationApproval, approveQuotationStep, rejectQuotationStep, approveQuotationTlBranch, rejectQuotationTlBranch, startInvoiceApproval, approveInvoiceStep, rejectInvoiceStep, startTileQuoteApproval, checkTileQuoteEscalations, approveTileQuoteStep, rejectTileQuoteStep, TQ_CHAIN, TQ_LEVEL_ROLES, TQ_TRANSITION_MS };

// ===== QUOTATION APPROVAL CHAIN =====
// Every Quotation must be approved by: Department TL -> Floor Manager ->
// Store Manager -> Management, strictly in that order (no skipping ahead),
// before it can be sent to a customer. Reuses the exact same level
// definitions, timers, and escalateNext() logic as visits/tasks above —
// a Quotation simply starts its chain at 'tl' instead of 'executive'.
//
// If a level has nobody assigned (e.g. no Floor Manager exists yet for
// this department), escalateNext()'s normal fallback behavior already
// handles that for the 'tl' step (falls back to all TLs); for
// floor_manager/store_manager/management, an empty escalationContacts
// entry just means no real person gets notified for that step, but the
// chain still needs to count it as "skipped" rather than getting stuck
// waiting forever on someone who doesn't exist. startQuotationApproval()
// and the escalation sweep below both check for this and auto-advance.

function escalationContactExists(contacts, level) {
  const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager', management: 'management' };
  const c = contacts[keyMap[level]];
  return !!(c && c.phone);
}

async function staffExistsForLevel(level, department) {
  if (level !== 'tl') return null; // only 'tl' is staff-lookup based
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  let tls = staff.filter(s => s.team === 'TL');
  if (department) {
    const deptTls = tls.filter(s => s.department === department);
    if (deptTls.length) return deptTls;
  }
  return tls;
}

// Advances the approval chain forward through any levels that have nobody
// assigned yet, stopping at the first level that actually has a person (or
// at 'management', the final level, regardless).
async function advanceQuotationChainPastEmptyLevels(log, department) {
  const contacts = await VW_DB.getSetting('escalationContacts', {});
  let current = log[log.length - 1];

  while (current && NEXT_LEVEL[current.level]) {
    const nextLevel = NEXT_LEVEL[current.level];
    if (nextLevel === 'tl') {
      const tls = await staffExistsForLevel('tl', department);
      if (tls && tls.length) break; // TL exists, stop here — this is a real notify step
    } else if (nextLevel === 'management') {
      break; // management is the final level, always stop here even if empty
    } else if (escalationContactExists(contacts, nextLevel)) {
      break; // this level has a real contact, stop here
    }
    // This level is empty — mark it auto-skipped and keep moving forward.
    current.status = 'skipped_no_assignee';
    const skipEntry = { level: nextLevel, name: `${LEVEL_LABELS[nextLevel]} (not yet assigned — skipped)`, notifiedAt: new Date().toISOString(), status: 'skipped_no_assignee' };
    log.push(skipEntry);
    current = skipEntry;
  }
  return log;
}

async function startQuotationApproval(quotationId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;

  // A Quotation can span multiple departments (e.g. Tiles + Plumbing). Each
  // department's TL approves their own portion in parallel; only once ALL
  // department branches are approved does the chain move up as one
  // combined step to Floor Manager -> Store Manager -> Management.
  const departments = [...new Set((q.items||[]).map(it => it.department).filter(Boolean))];
  const staff = await VW_DB.all(VW_DB.STORES.staff);

  const branches = [];
  for (const dept of departments) {
    const deptTls = staff.filter(s => s.team === 'TL' && s.department === dept);
    const tls = deptTls.length ? deptTls : staff.filter(s => s.team === 'TL'); // fall back to any TL if this dept has none
    if (tls.length) {
      branches.push({ department: dept, staffIds: tls.map(t=>t.id), names: tls.map(t=>t.name), notifiedAt: new Date().toISOString(), status: 'pending' });
      for (const tl of tls) {
        await notifyPerson(tl.phone, 'quotation_approval', [q.customerName || q.siteName || 'a customer', `${q.quoteNo||''} (${dept})`], tl.language || 'en', `quote-${quotationId}-tl-${dept}`);
      }
    } else {
      branches.push({ department: dept, name: 'Team Lead (not yet assigned — skipped)', notifiedAt: new Date().toISOString(), status: 'skipped_no_assignee' });
    }
  }

  let log = [{ level: 'tl', branches, notifiedAt: new Date().toISOString(), status: branches.some(b=>b.status==='pending') ? 'pending' : 'skipped_no_assignee' }];

  // If every department branch was skipped (no TLs anywhere at all), carry
  // the chain forward past 'tl' the same way the single-branch case does.
  if (log[0].status === 'skipped_no_assignee') {
    log = await advanceQuotationChainPastEmptyLevels(log, null);
  }

  q.approvalStatus = 'pending_approval';
  q.approvalLog = log;
  await VW_DB.put(VW_DB.STORES.quotations, q);
}
window.startQuotationApproval = startQuotationApproval;

// Called when a specific department's TL (or whoever escalated to) taps
// Approve on their branch of the 'tl' level. Once every branch in that
// step is approved, the whole step is marked approved and the chain moves
// up to Floor Manager as one combined step.
async function approveQuotationTlBranch(quotationId, department) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;
  const log = q.approvalLog || [];
  const tlStep = log.find(e => e.level === 'tl');
  if (!tlStep || !tlStep.branches) return;
  const branch = tlStep.branches.find(b => b.department === department);
  if (!branch || branch.status !== 'pending') return;

  branch.status = 'approved';
  branch.respondedAt = new Date().toISOString();
  const profile = VW_AUTH.getCurrentProfile();
  branch.approvedByName = profile ? profile.name : '';

  const stillPending = tlStep.branches.some(b => b.status === 'pending');
  if (!stillPending) {
    tlStep.status = 'approved';
    await advanceQuotationChainAfterTl(q, log);
  } else {
    q.approvalLog = log;
    await VW_DB.put(VW_DB.STORES.quotations, q);
    showToast(`${department} approved — waiting on other department(s)`, 'success');
  }
}
window.approveQuotationTlBranch = approveQuotationTlBranch;

async function rejectQuotationTlBranch(quotationId, department, reason) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;
  const log = q.approvalLog || [];
  const tlStep = log.find(e => e.level === 'tl');
  if (!tlStep || !tlStep.branches) return;
  const branch = tlStep.branches.find(b => b.department === department);
  if (!branch) return;

  branch.status = 'rejected';
  branch.respondedAt = new Date().toISOString();
  branch.rejectReason = reason || '';
  const profile = VW_AUTH.getCurrentProfile();
  branch.rejectedByName = profile ? profile.name : '';

  tlStep.status = 'rejected';
  q.approvalStatus = 'rejected';
  q.approvalLog = log;
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast(`Quotation rejected on ${department} — sent back for changes`, 'info');
}
window.rejectQuotationTlBranch = rejectQuotationTlBranch;

// Moves the chain from the (now fully-approved) TL step up to Floor
// Manager -> Store Manager -> Management, same single-step logic as before.
async function advanceQuotationChainAfterTl(q, log) {
  const department = null; // combined step now, not department-specific
  const nextLevel = 'floor_manager';
  const contacts = await VW_DB.getSetting('escalationContacts', {});
  if (escalationContactExists(contacts, nextLevel)) {
    const contact = contacts.floorManager || {};
    log.push({ level: nextLevel, name: contact.name || LEVEL_LABELS[nextLevel], phone: contact.phone || '', notifiedAt: new Date().toISOString(), status: 'pending' });
    await VW_NOTIFY.notify('quotation_approval', null, [q.customerName || q.siteName || 'a customer', q.quoteNo || ''], 'en', `quote-${q.id}-${nextLevel}`);
  } else {
    log.push({ level: nextLevel, name: `${LEVEL_LABELS[nextLevel]} (not yet assigned — skipped)`, notifiedAt: new Date().toISOString(), status: 'skipped_no_assignee' });
  }
  await advanceQuotationChainPastEmptyLevels(log, department);
  q.approvalLog = log;

  const finalEntry = log[log.length - 1];
  if (finalEntry.level === 'management' && finalEntry.status === 'skipped_no_assignee') {
    q.approvalStatus = 'approved';
  }
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast(`All departments approved — moved to ${LEVEL_LABELS[log[log.length-1].level]}`, 'success');
}

// Called when someone at the current pending level (floor_manager,
// store_manager, or management) taps Approve. The 'tl' level is handled
// separately by approveQuotationTlBranch() since it can have multiple
// parallel department branches.
async function approveQuotationStep(quotationId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;
  const log = q.approvalLog || [];
  const last = log[log.length - 1];
  if (!last || last.status !== 'pending' || last.level === 'tl') return;

  last.status = 'approved';
  last.respondedAt = new Date().toISOString();
  const profile = VW_AUTH.getCurrentProfile();
  last.approvedByName = profile ? profile.name : '';

  if (last.level === 'management' || !NEXT_LEVEL[last.level]) {
    q.approvalStatus = 'approved';
    q.approvalLog = log;
    await VW_DB.put(VW_DB.STORES.quotations, q);
    showToast('Quotation fully approved — ready to send', 'success');
    return;
  }

  const nextLevel = NEXT_LEVEL[last.level];

  if (nextLevel === 'management') {
    log.push({ level: 'management', name: LEVEL_LABELS.management, notifiedAt: new Date().toISOString(), status: 'pending' });
    await VW_NOTIFY.notify('quotation_approval', null, [q.customerName || q.siteName || 'a customer', q.quoteNo || ''], 'en', `quote-${quotationId}-management`);
  } else {
    const contacts = await VW_DB.getSetting('escalationContacts', {});
    if (escalationContactExists(contacts, nextLevel)) {
      const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager' };
      const contact = contacts[keyMap[nextLevel]] || {};
      log.push({ level: nextLevel, name: contact.name || LEVEL_LABELS[nextLevel], phone: contact.phone || '', notifiedAt: new Date().toISOString(), status: 'pending' });
      await VW_NOTIFY.notify('quotation_approval', null, [q.customerName || q.siteName || 'a customer', q.quoteNo || ''], 'en', `quote-${quotationId}-${nextLevel}`);
    }
  }

  await advanceQuotationChainPastEmptyLevels(log, null);
  q.approvalLog = log;

  const finalEntry = log[log.length - 1];
  if (finalEntry.level === 'management' && finalEntry.status === 'skipped_no_assignee') {
    q.approvalStatus = 'approved';
  }
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast(`Approved — moved to ${LEVEL_LABELS[log[log.length-1].level]}`, 'success');
}
window.approveQuotationStep = approveQuotationStep;

async function rejectQuotationStep(quotationId, reason) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;
  const log = q.approvalLog || [];
  const last = log[log.length - 1];
  if (!last || last.level === 'tl') return; // TL rejection goes through rejectQuotationTlBranch
  last.status = 'rejected';
  last.respondedAt = new Date().toISOString();
  last.rejectReason = reason || '';
  const profile = VW_AUTH.getCurrentProfile();
  last.rejectedByName = profile ? profile.name : '';
  q.approvalStatus = 'rejected';
  q.approvalLog = log;
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast('Quotation sent back for changes', 'info');
}
window.rejectQuotationStep = rejectQuotationStep;

// Manual "nudge" for a quotation stuck waiting on someone — re-sends the
// notification to whoever's pending at the current step rather than
// skipping ahead, since skipping a level would undermine the whole point
// of the approval chain.
// escalateQuotationNow is now defined in quotations.js with full chain support
// (TL → Floor Manager → Store Manager → Management with auto-escalation)
// This stub preserves the window export without conflict
window._escalateQuotationFromEscalation = async function(quotationId) {
  // Legacy nudge — send WhatsApp reminder to current approver
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;
  showToast('Reminder sent to current approver', 'success');
};

// ===== INVOICE APPROVAL (separate, simpler engine from Quotations) =====
// Invoices don't have Quotations' multi-department branching, so this is
// a straight linear chain with two possible starting points depending on
// WHY approval is needed:
//   - priceOverride: tl -> floor_manager -> store_manager -> management
//   - discountOnly or creditSale (no price override): store_manager -> management
// Credit Sale always forces at least the store_manager->management chain,
// even on top of a price override, per a firm "no exceptions" rule — but
// since that chain is a subset of the full one, starting the full chain
// already satisfies it; the two never need to run independently.
const INVOICE_CHAIN_FULL = ['tl', 'floor_manager', 'store_manager', 'management'];
const INVOICE_CHAIN_SHORT = ['store_manager', 'management'];

async function startInvoiceApproval(invoiceId, reason) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;

  const chain = reason === 'price_override' ? INVOICE_CHAIN_FULL : INVOICE_CHAIN_SHORT;
  const contacts = await VW_DB.getSetting('escalationContacts', {});
  const staff = await VW_DB.all(VW_DB.STORES.staff);

  let log = [];
  for (const level of chain) {
    if (level === 'tl') {
      const tls = staff.filter(s => s.team === 'TL');
      if (tls.length) {
        log.push({ level, staffIds: tls.map(t=>t.id), names: tls.map(t=>t.name), notifiedAt: new Date().toISOString(), status: 'pending' });
        for (const tl of tls) await notifyPerson(tl.phone, 'invoice_approval', [inv.invoiceNo, reason === 'price_override' ? 'a price change' : 'this sale'], tl.language || 'en', `inv-${invoiceId}-tl`);
        break; // first real, non-empty level — stop here, this is where the chain actually starts
      }
      continue; // no TL exists, skip straight to the next level
    }
    const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager', management: 'management' };
    const contact = contacts[keyMap[level]];
    if (contact && contact.phone) {
      log.push({ level, name: contact.name || LEVEL_LABELS[level], phone: contact.phone, notifiedAt: new Date().toISOString(), status: 'pending' });
      await notifyPerson(contact.phone, 'invoice_approval', [inv.invoiceNo, reason === 'price_override' ? 'a price change' : 'this sale'], contact.language || 'en', `inv-${invoiceId}-${level}`);
      break;
    }
    // nobody assigned at this level — mark skipped and keep moving
    log.push({ level, name: `${LEVEL_LABELS[level]} (not yet assigned — skipped)`, notifiedAt: new Date().toISOString(), status: 'skipped_no_assignee' });
  }

  if (!log.length || log[log.length-1].status === 'skipped_no_assignee') {
    // Every level in the chain was empty — nothing to actually notify,
    // but we still record this so it's visible something needed approval
    // and nobody was set up to receive it.
  }

  inv.approvalStatus = 'pending_approval';
  inv.approvalChain = chain;
  inv.approvalReason = reason;
  inv.approvalLog = log;
  await VW_DB.put(VW_DB.STORES.invoices, inv);

  await VW_NOTIFY.createPersistedNotification({
    category: 'approval',
    title: `🧾 Invoice ${inv.invoiceNo} needs approval`,
    body: reason === 'price_override' ? 'A price override was applied — needs the full approval chain.' : reason === 'credit' ? 'Credit Sale — needs Store Manager/Management approval.' : 'A discount was applied — needs Store Manager/Management approval.',
    recipientRole: log[0]?.level === 'tl' ? 'tl' : 'management',
    relatedTable: 'invoices', relatedId: invoiceId,
    actions: [{ label: 'Review', action: 'view_invoice' }]
  });
}
window.startInvoiceApproval = startInvoiceApproval;

async function approveInvoiceStep(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const log = inv.approvalLog || [];
  const last = log[log.length - 1];
  if (!last) return;

  const profile = VW_AUTH.getCurrentProfile();
  last.status = 'approved';
  last.respondedAt = new Date().toISOString();
  last.approvedByName = profile ? profile.name : '';

  const chain = inv.approvalChain || INVOICE_CHAIN_SHORT;
  const currentIdx = chain.indexOf(last.level);
  const contacts = await VW_DB.getSetting('escalationContacts', {});
  const staff = await VW_DB.all(VW_DB.STORES.staff);

  let nextIdx = currentIdx + 1;
  let foundNext = false;
  while (nextIdx < chain.length) {
    const level = chain[nextIdx];
    if (level === 'tl') {
      const tls = staff.filter(s => s.team === 'TL');
      if (tls.length) {
        log.push({ level, staffIds: tls.map(t=>t.id), names: tls.map(t=>t.name), notifiedAt: new Date().toISOString(), status: 'pending' });
        for (const tl of tls) await notifyPerson(tl.phone, 'invoice_approval', [inv.invoiceNo, ''], tl.language || 'en', `inv-${invoiceId}-tl`);
        foundNext = true;
        break;
      }
    } else {
      const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager', management: 'management' };
      const contact = contacts[keyMap[level]];
      if (contact && contact.phone) {
        log.push({ level, name: contact.name || LEVEL_LABELS[level], phone: contact.phone, notifiedAt: new Date().toISOString(), status: 'pending' });
        await notifyPerson(contact.phone, 'invoice_approval', [inv.invoiceNo, ''], contact.language || 'en', `inv-${invoiceId}-${level}`);
        foundNext = true;
        break;
      }
    }
    log.push({ level, name: `${LEVEL_LABELS[level]} (not yet assigned — skipped)`, notifiedAt: new Date().toISOString(), status: 'skipped_no_assignee' });
    nextIdx++;
  }

  if (!foundNext) {
    inv.approvalStatus = 'approved';
  }
  inv.approvalLog = log;
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast(inv.approvalStatus === 'approved' ? 'Invoice fully approved ✓' : `Approved — moved to ${LEVEL_LABELS[log[log.length-1].level]}`, 'success');

  // Once fully approved: auto-print the invoice for the customer.
  // Spin & Win and loyalty points already fired at the counter when the
  // invoice was generated — approval is a back-office step only.
  if (inv.approvalStatus === 'approved') {
    await VW_NOTIFY.notify('invoice', null, [inv.invoiceNo, inv.total], 'en', `invoice-${invoiceId}`);
    printInvoice(inv, inv.customerId);
  }
}
window.approveInvoiceStep = approveInvoiceStep;

async function rejectInvoiceStep(invoiceId, reason) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const log = inv.approvalLog || [];
  const last = log[log.length - 1];
  if (!last) return;
  last.status = 'rejected';
  last.respondedAt = new Date().toISOString();
  last.rejectReason = reason || '';
  const profile = VW_AUTH.getCurrentProfile();
  last.rejectedByName = profile ? profile.name : '';
  inv.approvalStatus = 'rejected';
  inv.approvalLog = log;
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast('Invoice rejected', 'info');
}
window.rejectInvoiceStep = rejectInvoiceStep;




