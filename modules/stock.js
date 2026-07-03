/* === inventory.js === */

const LOW_STOCK_THRESHOLD = 20;

async function renderInventory() {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const lowStock = products.filter(p => p.stock <= (p.lowStockThreshold || LOW_STOCK_THRESHOLD));
  const categories = [...new Set(products.map(p => p.category))];
  const totalValue = products.reduce((s, p) => s + (p.price * p.stock), 0);
  const pendingPhotoCount = (await VW_DB.all(VW_DB.STORES.photoSubmissions)).filter(p => p.status === 'pending').length;

  // Pending sourcing requests from tile quotations
  let sourcingCard = '';
  try {
    const { data: intents } = await VW_DB.client.from('tq_material_intents')
      .select('*').eq('status','pending').order('created_at',{ascending:false}).limit(50);
    if (intents?.length) {
      // Group by quote
      const byQuote = {};
      intents.forEach(i => {
        if (!byQuote[i.tq_no]) byQuote[i.tq_no] = { tq_no:i.tq_no, customer:i.customer_name, items:[] };
        byQuote[i.tq_no].items.push(i);
      });
      const stockStatusColor = { out_of_stock:'var(--red)', to_order:'#378ADD', low_stock:'var(--gold)' };
      const stockStatusLabel = { out_of_stock:'Out of Stock', to_order:'To Order', low_stock:'Low Stock' };
      sourcingCard = `
      <div class="card" style="margin-bottom:14px;border-color:rgba(55,138,221,0.4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0;font-size:14px">📋 To Source (${intents.length})</h3>
          <span style="font-size:11px;color:var(--text3)">${Object.keys(byQuote).length} quote${Object.keys(byQuote).length>1?'s':''}</span>
        </div>
        <p style="font-size:11px;color:var(--text3);margin-bottom:10px">Materials needed for confirmed tile quotations. Source these before delivery.</p>
        ${Object.values(byQuote).map(q=>`
        <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-size:12px;font-weight:700">${q.tq_no}</div>
              <div style="font-size:11px;color:var(--text3)">${q.customer}</div>
            </div>
            <span style="font-size:10px;background:rgba(55,138,221,0.15);color:#378ADD;padding:2px 7px;border-radius:8px;font-weight:700;align-self:flex-start">${q.items.length} item${q.items.length>1?'s':''}</span>
          </div>
          ${q.items.map(i=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--border2)">
            <div>
              <div style="font-size:12px;font-weight:600">${i.item_name}</div>
              <div style="font-size:10px;color:var(--text3)">${i.qty_needed} ${i.unit} needed · <span style="color:${stockStatusColor[i.stock_status]||'#378ADD'}">${stockStatusLabel[i.stock_status]||'To Order'}</span></div>
            </div>
            <button onclick="VW_INVENTORY.markMaterialSourced(${i.id})"
              style="background:var(--green);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">
              ✓ Sourced
            </button>
          </div>`).join('')}
        </div>`).join('')}
      </div>`;
    }
  } catch(e) {}

  return `
  <div class="module-header">
    <h2>Inventory</h2>
    <div class="stat-row">
      <div class="stat"><span class="stat-num">${products.length}</span><span class="stat-label">SKUs</span></div>
      <div class="stat"><span class="stat-num" style="color:var(--red)">${lowStock.length}</span><span class="stat-label">Low Stock</span></div>
      <div class="stat"><span class="stat-num" style="color:var(--gold)">₹${Math.round(totalValue/100000)}L</span><span class="stat-label">Stock Value</span></div>
    </div>
  </div>

  ${sourcingCard}

  <!-- Quick Category Shortcuts -->
  <div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px">
    <button onclick="navigateTo('tile_inventory')"
      style="flex-shrink:0;background:var(--header-bg);border:1px solid var(--gold-border);border-radius:12px;padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text);font-size:13px;font-weight:700">
      🔲 <span>Tile Stock</span>
      <span style="font-size:10px;background:var(--gold);color:#000;border-radius:4px;padding:1px 6px;font-weight:700">Dedicated</span>
    </button>
    <button onclick="filterCategoryNav('Tiles')"
      style="flex-shrink:0;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px 16px;cursor:pointer;font-size:13px;color:var(--text)">
      🔲 All Tiles
    </button>
    <button onclick="filterCategoryNav('Sanitary')"
      style="flex-shrink:0;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px 16px;cursor:pointer;font-size:13px;color:var(--text)">
      🚿 Sanitary
    </button>
    <button onclick="filterCategoryNav('Paints')"
      style="flex-shrink:0;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px 16px;cursor:pointer;font-size:13px;color:var(--text)">
      🎨 Paints
    </button>
    <button onclick="filterCategoryNav('Electricals')"
      style="flex-shrink:0;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px 16px;cursor:pointer;font-size:13px;color:var(--text)">
      ⚡ Electricals
    </button>
  </div>

  ${pendingPhotoCount ? `
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">📸 Photos Awaiting Approval <span class="badge">${pendingPhotoCount}</span></h3>
    </div>
    <div id="photo-approval-list">${await renderPendingPhotoApprovals()}</div>
  </div>` : ''}

  ${lowStock.length ? `
  <div class="alert-card">
    <div class="alert-title">⚠️ Low Stock Alert</div>
    ${lowStock.map(p => `
    <div class="followup-row">
      <div class="fu-info"><div class="fu-name">${p.name}</div><div class="fu-dept">${p.category} · ${p.stock} ${p.unit} left</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="VW_VENDOR.createPOForProduct(${p.id})">🛒 PO</button>
        <button class="btn-sm" onclick="showRestock(${p.id})">Restock</button>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Products</h3>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="downloadImportTemplate('products')">📄 Template</button>
        <button class="btn-sm" onclick="triggerExcelImport('products')">📥 Import Excel</button>
        <button class="btn-sm" onclick="showAddProduct()">+ Add</button>
      </div>
    </div>
    <div class="search-row">
      <input type="text" id="inv-search" placeholder="Search products..." oninput="searchInventory(this.value)" style="margin-bottom:10px">
      <button class="btn-sm" onclick="scanProductForInventory()">📷 Scan</button>
    </div>
    <div class="filter-row" id="inv-cat-filters">
      <button class="filter-btn active" onclick="invFilterCat('all',this)">All</button>
      ${categories.map(c => `<button class="filter-btn" onclick="invFilterCat('${c}',this)">${c}</button>`).join('')}
    </div>
    <div id="inv-product-list">
      ${renderProductList(products)}
    </div>
  </div>

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Purchase Orders</h3>
      <button class="btn-sm" onclick="showAddPO()">+ New PO</button>
    </div>
    <div id="po-list">${'<p class="empty-msg">Purchase Orders are now in the Vendors section</p>'}</div>
  </div>
  `;
}

function renderProductList(products, filter = 'all', search = '') {
  let list = products;
  if (filter !== 'all') list = list.filter(p => p.category === filter);
  if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode||'').toLowerCase().includes(search.toLowerCase()));
  if (!list.length) return '<p class="empty-msg">No products found</p>';
  return list.map(p => {
    const stockColor = p.stock <= (p.lowStockThreshold || LOW_STOCK_THRESHOLD) ? 'var(--red)' : p.stock <= 50 ? 'var(--gold)' : 'var(--green)';
    const stockPct = Math.min(100, Math.round(p.stock / 200 * 100));
    return `
    <div class="inv-row" onclick="openProduct(${p.id})">
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-meta">${p.category} · ₹${p.price.toLocaleString('en-IN')}/${p.unit}${p.rackNo?` · 📍 ${p.warehouseZone||''}${p.rackNo}/${p.shelfNo||''}`:''}</div>
        ${p.warrantyMonths>0?`<div style="font-size:11px;color:var(--blue);margin-top:2px">🛡 ${p.warrantyMonths}m warranty</div>`:''}
        <div class="stock-bar-bg"><div class="stock-bar" style="width:${stockPct}%;background:${stockColor}"></div></div>
      </div>
      <div class="inv-stock" style="color:${stockColor}">${p.stock}<span class="inv-unit">${p.unit}</span></div>
    </div>`;
  }).join('');
}

async function searchInventory(val) {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const af = document.querySelector('#inv-cat-filters .filter-btn.active')?.textContent || 'All';
  document.getElementById('inv-product-list').innerHTML = renderProductList(products, af === 'All' ? 'all' : af, val);
}

async function invFilterCat(cat, btn) {
  document.querySelectorAll('#inv-cat-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const products = await VW_DB.all(VW_DB.STORES.products);
  const search = document.getElementById('inv-search').value;
  document.getElementById('inv-product-list').innerHTML = renderProductList(products, cat, search);
}

function scanProductForInventory() {
  openQrScanner(async (code) => {
    const product = await findProductByScannedCode(code);
    if (!product) {
      const statusEl = document.getElementById('qr-scan-status');
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">No product matches that code</span>';
      return;
    }
    closeSheet();
    openProduct(product.id);
  }, { title: 'Scan Product', subtitle: 'Scan a product\'s QR label to open it.' });
}
window.scanProductForInventory = scanProductForInventory;

async function openProduct(id) {
  const p = await VW_DB.getById(VW_DB.STORES.products, id);
  pendingProductPhotos = JSON.parse(JSON.stringify(p.photos || []));
  // Load brand/model data for the Edit form's datalists — same reason
  // as Add Product: can't assume Quotations was opened in this session.
  if (!_inventoryBrandList.length) {
    const [prods, pend] = await Promise.all([VW_DB.all(VW_DB.STORES.products), VW_DB.all(VW_DB.STORES.pendingProducts)]);
    const bSet = new Set(); const mMap = {};
    [...prods,...pend].forEach(p => { if (!p.brand) return; bSet.add(p.brand); if (p.model) { mMap[p.brand] = mMap[p.brand]||new Set(); mMap[p.brand].add(p.model); } });
    _inventoryBrandList = [...bSet].sort();
    Object.entries(mMap).forEach(([b,s]) => { _inventoryModelsByBrand[b] = [...s].sort(); });
  }
  const sheet = document.getElementById('bottom-sheet');
  const _stockLoc = await getProductStockLocations(id);
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${p.name}</h3>
    <p style="font-size:13px;color:var(--text3);margin:4px 0 16px">${p.category} · ${p.barcode || 'No barcode'}</p>
    <div class="sheet-stats">
      <div class="sheet-stat"><span>${p.stock}</span><small>${p.unit}</small></div>
      <div class="sheet-stat"><span>₹${(p.vwp||p.price||0).toLocaleString('en-IN')}</span><small>VWP</small></div>
      <div class="sheet-stat"><span>₹${((p.vwp||p.price||0)*p.stock).toLocaleString('en-IN')}</span><small>Value</small></div>
    </div>
    ${(p.current_lot_no || p.current_shade_no) ? `
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:10px;font-size:11px">
      <div style="font-weight:700;color:var(--gold);margin-bottom:3px">📦 Current Stock Info</div>
      ${p.current_lot_no ? `<div>Lot: <strong>${p.current_lot_no}</strong></div>` : ''}
      ${p.current_shade_no ? `<div>Shade: <strong>${p.current_shade_no}</strong></div>` : ''}
      <div style="color:var(--text3);margin-top:3px;font-size:10px">⚠️ Customers must buy from same lot for shade consistency</div>
    </div>` : ''}
    <div class="form-group"><label>Update Stock</label>
      <div class="input-row" style="gap:8px;align-items:center">
        <select id="adj-type" style="width:auto;flex:0 0 auto"><option value="set">Set to</option><option value="add">＋ Add</option><option value="sub">－ Subtract</option></select>
        <input type="number" id="adj-stock" value="${p.stock}" min="0" style="flex:1">
        <span style="font-size:12px;color:var(--text3);white-space:nowrap">${p.unit||'units'}</span>
      </div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Brand</label><input type="text" id="adj-brand" value="${p.brand||''}" placeholder="e.g. Ashirvad" list="adj-brand-list"><datalist id="adj-brand-list">${_inventoryBrandList.map(b=>`<option value="${b}">`).join('')}</datalist></div>
      <div class="form-group" style="flex:1"><label>Model</label><input type="text" id="adj-model" value="${p.model||''}" placeholder="e.g. SDR 13.5" list="adj-model-list"><datalist id="adj-model-list">${(p.brand ? (_inventoryModelsByBrand[p.brand]||[]) : []).map(m=>`<option value="${m}">`).join('')}</datalist></div>
    </div>
    <div class="form-group"><label>Pricing Mode *</label>
      <select id="adj-pricing-mode" onchange="toggleProductPricingFields('adj')">
        <option value="net_gst">Net Price (already includes GST)</option>
        <option value="basic_gst">Basic Price + GST (added on top)</option>
        <option value="mrp_disc">MRP − Discount (final price, GST included)</option>
        <option value="mrp_disc_gst">MRP − Discount, then + GST</option>
      </select>
    </div>
    <div id="adj-pricing-fields"></div>
    <div id="adj-price-preview" style="font-size:12px;color:var(--text3);margin:4px 0 10px"></div>
    <div class="form-group"><label>Cost Price (₹, for margin/approval calculations)</label><input type="number" id="adj-cost" value="${p.costPrice||0}"></div>
    <div class="form-group"><label>Low Stock Alert Threshold (${p.unit})</label><input type="number" id="adj-threshold" value="${p.lowStockThreshold || 20}" min="0"></div>
    <div class="form-group"><label>Barcode / QR Code</label><input type="text" id="adj-barcode" value="${p.barcode||''}">
      <p style="font-size:11px;color:var(--text3);margin-top:3px">This is the value printed on the product's QR label — scanning it anywhere in the app looks up this exact text.</p></div>
    <div class="form-group"><label>HSN/SAC Code (for GST invoices)</label><input type="text" id="adj-hsn" value="${p.hsn||''}" placeholder="e.g. 69072100"></div>
    <div class="form-group">
      <label>📸 Product Photos</label>
      <p style="font-size:11px;color:var(--text3);margin-bottom:6px">Approved photos appear here. New photos go through Inventory approval first unless you're senior enough to self-approve.</p>
      <div id="product-photo-gallery">${renderProductPhotoGallery(p.photos || [])}</div>
      <button type="button" class="btn-sm" style="margin-top:6px" onclick="showSubmitProductPhoto(${id}, null, '${(p.name||'').replace(/'/g,"\\'")}')">+ Add Photo</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn-primary" onclick="updateProduct(${id})">Save Changes</button>
      <button class="btn-secondary" onclick="showRestock(${id})">📦 Restock</button>
      <button class="btn-secondary" onclick="VW_VENDOR.createPOForProduct(${id})">🛒 Raise PO</button>
      <button class="btn-secondary" onclick="VW_EXTRAS.renderStockHistory(${id})">📊 History</button>
      ${['admin','management','category_manager','purchase_manager'].includes(profile?.role) ? `
      <button class="btn-secondary" style="background:rgba(245,200,66,0.12);border-color:var(--gold-border);color:var(--gold)" onclick="openProductPricingTab(${id})">💰 Pricing</button>` : ''}
    </div>
    <div style="margin-top:14px;background:var(--bg2);border-radius:10px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700">📍 Stock by Location</span>
        <span style="font-size:12px;color:var(--text3)">Total: <strong style="color:var(--gold)">${_stockLoc.total}</strong> ${p.unit||''}</span>
      </div>
      ${_stockLoc.locations.length ? _stockLoc.locations.map(l=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border2)">
          <span style="font-size:12px">${l.warehouse_code||'—'} · ${l.rack_no||'—'}/${l.shelf_no||'—'}</span>
          <span style="font-size:12px;font-weight:700">${l.qty}</span>
        </div>`).join('') : '<div style="font-size:11px;color:var(--text3)">No location records yet — add stock to a zone/rack/shelf below.</div>'}
      <div style="font-size:10px;color:var(--text3);margin-top:6px">Dispatch picks lowest-qty location first.</div>
      <button type="button" class="btn-sm" style="margin-top:8px" onclick="VW_INVENTORY.addProductLocation(${id})">+ Add to location</button>
    </div>
    ${p.customFields && Object.keys(p.customFields).length ? `
    <div class="req-item-card" style="margin-top:10px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Additional Info (from import)</div>
      ${Object.entries(p.customFields).map(([k,v]) => `<div style="font-size:12px;padding:2px 0">${k}: ${v}</div>`).join('')}
    </div>` : ''}
    ${VW_AUTH.isAdmin() ? `<button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="confirmDeleteProduct(${id})">🗑 Delete Product</button>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  // Pre-select the stored pricing mode (defaulting to net_gst — "the
  // number in Price already includes GST" — for any product saved
  // before this feature existed, since that matches how price/gst were
  // actually being treated everywhere downstream until today's fix).
  const modeSelect = document.getElementById('adj-pricing-mode');
  modeSelect.value = p.pricingMode || 'net_gst';
  toggleProductPricingFields('adj', {
    pricingNetPrice: p.pricingNetPrice !== undefined && p.pricingNetPrice !== null ? p.pricingNetPrice : p.price,
    pricingBasicPrice: p.pricingBasicPrice,
    pricingMrp: p.pricingMrp,
    pricingDiscPct: p.pricingDiscPct,
    pricingGstSlab: p.pricingGstSlab || String(p.gst || 18)
  });
}

function renderProductPhotoGallery(photos, removeHandlerName = 'removeProductPhoto', tagHandlerName = 'updateProductPhotoTag') {
  if (!photos.length) return '<p class="empty-msg" style="margin:4px 0">No photos yet</p>';
  return `<div class="product-photo-grid">${photos.map((ph, i) => `
    <div class="product-photo-card">
      <img src="${ph.url}" onclick="window.open('${ph.url}','_blank')">
      <input type="text" value="${ph.tag||''}" placeholder="Tag (e.g. Front view)" oninput="${tagHandlerName}(${i},this.value)">
      <button class="remove-btn" onclick="${removeHandlerName}(${i})">✕</button>
    </div>`).join('')}</div>`;
}

let pendingProductPhotos = null; // tracks the product whose photo list is being edited in this sheet

// Separate from pendingProductPhotos above (which edits an EXISTING
// product's gallery) — these track photos captured while filling out the
// Add Product form, before the product has a real database ID yet. They
// upload to Storage immediately on selection (under a temporary
// session-only folder key) so the slow upload happens in the background
// while the person keeps filling out the rest of the form, rather than
// blocking on it at the very end.
let newProductPhotos = [];
let newProductPhotoTempKey = null;

async function handleNewProductPhotoSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('np-photo-status');
  if (statusEl) statusEl.textContent = 'Uploading...';

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const path = await VW_DB.uploadProductPhoto(dataUrl, newProductPhotoTempKey);
    const url = await VW_DB.getProductPhotoUrl(path);
    newProductPhotos.push({ path, url, tag: '' });
    document.getElementById('np-photo-gallery').innerHTML = renderProductPhotoGallery(newProductPhotos, 'removeNewProductPhoto', 'updateNewProductPhotoTag');
    if (statusEl) statusEl.textContent = '';
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">Upload failed — try again</span>';
  }
  input.value = ''; // allow selecting the same file again, and lets the input fire again for a second photo
}
window.handleNewProductPhotoSelected = handleNewProductPhotoSelected;

function removeNewProductPhoto(idx) {
  newProductPhotos.splice(idx, 1);
  document.getElementById('np-photo-gallery').innerHTML = renderProductPhotoGallery(newProductPhotos, 'removeNewProductPhoto', 'updateNewProductPhotoTag');
}
window.removeNewProductPhoto = removeNewProductPhoto;

function updateNewProductPhotoTag(idx, value) {
  if (newProductPhotos[idx]) newProductPhotos[idx].tag = value;
}
window.updateNewProductPhotoTag = updateNewProductPhotoTag;

function cleanupAbandonedNewProductPhotos() {
  if (!newProductPhotos.length) return;
  const orphaned = newProductPhotos;
  newProductPhotos = [];
  for (const photo of orphaned) {
    VW_DB.deleteProductPhoto(photo.path); // fire-and-forget — closeSheet() shouldn't be slowed down waiting on this
  }
}
window.cleanupAbandonedNewProductPhotos = cleanupAbandonedNewProductPhotos;

// Fetches brand/model data directly from Inventory products and pending
// products rather than depending on quoteBrandList being populated —
// that's only guaranteed if the Quotations form was opened in the same
// session, which can't be assumed when someone goes straight to Inventory.
async function populateInventoryBrandDatalist() {
  const brandDl = document.getElementById('np-brand-list');
  if (!brandDl) return;
  const [products, pending] = await Promise.all([
    VW_DB.all(VW_DB.STORES.products),
    VW_DB.all(VW_DB.STORES.pendingProducts)
  ]);
  const brandSet = new Set();
  const modelMap = {};
  const addEntry = (brand, model) => {
    if (!brand) return;
    brandSet.add(brand);
    if (model) { modelMap[brand] = modelMap[brand] || new Set(); modelMap[brand].add(model); }
  };
  products.forEach(p => addEntry(p.brand, p.model));
  pending.forEach(p => addEntry(p.brand, p.model));
  // Store locally for model datalist lookups without another DB fetch
  _inventoryBrandList = [...brandSet].sort();
  _inventoryModelsByBrand = {};
  Object.entries(modelMap).forEach(([b, set]) => { _inventoryModelsByBrand[b] = [...set].sort(); });
  brandDl.innerHTML = _inventoryBrandList.map(b => `<option value="${b}">`).join('');
}
window.populateInventoryBrandDatalist = populateInventoryBrandDatalist;

// Checks in real-time whether the current brand+model combination
// already exists as a real Inventory product — shown as an inline
// warning so staff can decide whether they're adding something genuinely
// new or accidentally duplicating an existing product.
let _inventoryProductsCache = null;
let _inventoryBrandList = [];
let _inventoryModelsByBrand = {};

function updateInventoryModelDatalist() {
  const brand = document.getElementById('np-brand')?.value.trim();
  const modelDl = document.getElementById('np-model-list');
  if (!modelDl) return;
  const models = brand ? (_inventoryModelsByBrand[brand] || []) : [];
  modelDl.innerHTML = models.map(m => `<option value="${m}">`).join('');
  checkNewProductDuplicate();
}
window.updateInventoryModelDatalist = updateInventoryModelDatalist;

async function checkNewProductDuplicate() {
  const brand = (document.getElementById('np-brand')?.value || '').trim().toLowerCase();
  const model = (document.getElementById('np-model')?.value || '').trim().toLowerCase();
  const warningEl = document.getElementById('np-duplicate-warning');
  if (!warningEl) return;

  // Update model datalist based on current brand value
  const modelDl = document.getElementById('np-model-list');
  if (modelDl && brand) {
    const brandKey = _inventoryBrandList.find(b => b.toLowerCase() === brand);
    const models = brandKey ? (_inventoryModelsByBrand[brandKey] || []) : [];
    modelDl.innerHTML = models.map(m => `<option value="${m}">`).join('');
  }

  if (!brand) { warningEl.style.display = 'none'; return; }

  if (!_inventoryProductsCache) {
    _inventoryProductsCache = await VW_DB.all(VW_DB.STORES.products);
  }

  const match = _inventoryProductsCache.find(p => {
    const pb = (p.brand||'').trim().toLowerCase();
    const pm = (p.model||'').trim().toLowerCase();
    if (pb !== brand) return false;
    if (!model && !pm) return true;
    return model && pm === model;
  });

  if (match) {
    warningEl.innerHTML = `⚠️ <strong>${match.brand}${match.model ? ' '+match.model : ''}</strong> already exists in Inventory (${match.category||'—'}, ₹${match.price?.toLocaleString('en-IN')||'—'}). <a href="#" onclick="event.preventDefault();closeSheet();openProduct(${match.id})" style="color:var(--gold);text-decoration:underline">Open existing product →</a>`;
    warningEl.style.display = '';
  } else {
    warningEl.style.display = 'none';
  }
}
window.checkNewProductDuplicate = checkNewProductDuplicate;

function updateProductPhotoTag(idx, value) {
  if (!pendingProductPhotos) return;
  pendingProductPhotos[idx].tag = value;
}
window.updateProductPhotoTag = updateProductPhotoTag;

async function removeProductPhoto(idx) {
  if (!pendingProductPhotos) return;
  pendingProductPhotos.splice(idx, 1);
  document.getElementById('product-photo-gallery').innerHTML = renderProductPhotoGallery(pendingProductPhotos);
}
window.removeProductPhoto = removeProductPhoto;

async function updateProduct(id) {
  const p = await VW_DB.getById(VW_DB.STORES.products, id);
  const adjType = document.getElementById('adj-type').value;
  const adjVal = parseFloat(document.getElementById('adj-stock').value);
  if (adjType === 'set') p.stock = adjVal;
  else if (adjType === 'add') p.stock += adjVal;
  else if (adjType === 'sub') p.stock = Math.max(0, p.stock - adjVal);
  p.brand = document.getElementById('adj-brand').value.trim();
  p.model = document.getElementById('adj-model').value.trim();

  const { finalPrice, gstPct } = computeProductPrice('adj');
  const pricingMode = document.getElementById('adj-pricing-mode').value;
  p.price = finalPrice;
  p.gst = gstPct;
  p.pricingMode = pricingMode;
  p.pricingNetPrice = pricingMode === 'net_gst' ? parseFloat(document.getElementById('adj-net-price')?.value) || 0 : null;
  p.pricingBasicPrice = pricingMode === 'basic_gst' ? parseFloat(document.getElementById('adj-basic-price')?.value) || 0 : null;
  p.pricingMrp = (pricingMode === 'mrp_disc' || pricingMode === 'mrp_disc_gst') ? parseFloat(document.getElementById('adj-mrp')?.value) || 0 : null;
  p.pricingDiscPct = (pricingMode === 'mrp_disc' || pricingMode === 'mrp_disc_gst') ? parseFloat(document.getElementById('adj-disc-pct')?.value) || 0 : null;
  p.pricingGstSlab = document.getElementById('adj-gst-slab')?.value || '18';

  p.costPrice = parseFloat(document.getElementById('adj-cost').value) || 0;
  p.lowStockThreshold = parseFloat(document.getElementById('adj-threshold').value) || 20;
  p.barcode = document.getElementById('adj-barcode').value;
  p.hsn = document.getElementById('adj-hsn').value.trim();
  if (pendingProductPhotos) p.photos = pendingProductPhotos;
  p.updatedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.products, p);
  showToast('Product updated', 'success');
  closeSheet();
  navigateTo('inventory');
}

async function showAddProduct() {
  const cats = await VW_CHECKIN.getDepartmentNames();
  const _catMap = await getCategories();
  const _firstSubs = (_catMap[cats[0]] || []);
  const _zones = ((await VW_DB.client.from('warehouse_locations').select('code,name').eq('is_active',true).order('sort_order')).data) || [];
  newProductPhotos = []; // reset on every fresh open, so an abandoned previous attempt's photos never leak in
  newProductPhotoTempKey = `new-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  _inventoryProductsCache = null; // reset so the duplicate check fetches fresh data next time it runs
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Add New Product</h3>
    <div class="form-group"><label>Product Name *</label><input type="text" id="np-name" placeholder="e.g. Premium Vitrified Tile 60x60"></div>
    <div class="form-group"><label>Category *</label>
      <div style="display:flex;gap:8px">
        <select id="np-cat" style="flex:1" onchange="VW_INVENTORY.onAddProductCatChange(this.value)">${cats.map(c=>`<option>${c}</option>`).join('')}</select>
        <button type="button" class="btn-secondary" style="white-space:nowrap;padding:0 12px" onclick="VW_INVENTORY.addInlineCategory()">+ New</button>
      </div></div>
    <div class="form-group"><label>Sub-Category</label>
      <div style="display:flex;gap:8px">
        <select id="np-subcat" style="flex:1">${_firstSubs.length ? _firstSubs.map(s=>`<option>${s}</option>`).join('') : '<option value="">— none —</option>'}</select>
        <button type="button" class="btn-secondary" style="white-space:nowrap;padding:0 12px" onclick="VW_INVENTORY.addInlineSubcategory()">+ New</button>
      </div></div>
    <!-- Tile-specific fields inject here when Tiles selected -->
    <div id="np-tile-fields"></div>
    <div class="input-row">
      <div class="form-group" style="flex:1">
        <label>Brand</label>
        <input type="text" id="np-brand" placeholder="e.g. Ashirvad" list="np-brand-list" oninput="updateInventoryModelDatalist()">
        <datalist id="np-brand-list"></datalist>
      </div>
      <div class="form-group" style="flex:1">
        <label>Model</label>
        <input type="text" id="np-model" placeholder="e.g. SDR 13.5" list="np-model-list" oninput="checkNewProductDuplicate()">
        <datalist id="np-model-list"></datalist>
      </div>
    </div>
    <div id="np-duplicate-warning" style="display:none;background:rgba(200,151,43,0.12);border:1px solid var(--gold);border-radius:8px;padding:8px 12px;font-size:12px;margin-bottom:8px;color:var(--gold)"></div>
    </div>
    <div class="form-group"><label>Barcode / QR Code</label><input type="text" id="np-barcode" placeholder="e.g. TL003"></div>
    <div class="form-group"><label>HSN/SAC Code (for GST invoices)</label><input type="text" id="np-hsn" placeholder="e.g. 69072100"></div>

    <div class="form-group"><label>Pricing Mode *</label>
      <select id="np-pricing-mode" onchange="toggleProductPricingFields()">
        <option value="net_gst">Net Price (already includes GST)</option>
        <option value="basic_gst">Basic Price + GST (added on top)</option>
        <option value="mrp_disc">MRP − Discount (final price, GST included)</option>
        <option value="mrp_disc_gst">MRP − Discount, then + GST</option>
      </select>
    </div>
    <div id="np-pricing-fields"></div>
    <div id="np-price-preview" style="font-size:12px;color:var(--text3);margin:4px 0 10px"></div>

    <div class="form-group"><label>Cost Price (₹, for margin/approval calculations)</label><input type="number" id="np-cost" placeholder="e.g. 65"></div>
    <div class="form-group"><label>Unit</label>
      <select id="np-unit"><option>sqft</option><option>pc</option><option>sheet</option><option>can</option><option>bag</option><option>mtr</option><option>box</option></select></div>
    <div class="form-group"><label>Opening Stock *</label><input type="number" id="np-stock" placeholder="e.g. 500"></div>
    <div class="form-group"><label>Low Stock Alert Threshold</label><input type="number" id="np-threshold" placeholder="e.g. 20 (default)" value="20"></div>

    <div class="form-group">
      <label>📸 Product Photos</label>
      <p style="font-size:11px;color:var(--text3);margin-bottom:6px">Optional, but recommended — goes through Inventory approval first unless you're senior enough to self-approve.</p>
      <div id="np-photo-gallery"></div>
      <input type="file" id="np-photo-input" accept="image/*" capture="environment" style="display:none" onchange="handleNewProductPhotoSelected(this)">
      <button type="button" class="btn-secondary full-width" onclick="document.getElementById('np-photo-input').click()">📷 Add Photo</button>
      <div id="np-photo-status" style="font-size:12px;margin-top:6px"></div>
    </div>

    <button class="btn-primary full-width" onclick="saveNewProduct()">Add Product</button>
    
    <!-- Warehouse Location -->
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px">📦 Warehouse Location</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px">
      <div class="form-group" style="margin:0"><label>Zone</label>
        <select id="np-zone" onchange="VW_INVENTORY.loadInvRacks(this.value)">
          <option value="">Select zone</option>
          ${_zones.map(z=>`<option value="${z.code}">${z.name}</option>`).join('')}
        </select></div>
      <div class="form-group" style="margin:0"><label>Rack No</label>
        <select id="np-rack" onchange="VW_INVENTORY.loadInvShelves(this.value)"><option value="">Zone first</option></select></div>
      <div class="form-group" style="margin:0"><label>Shelf No</label>
        <select id="np-shelf"><option value="">Rack first</option></select></div>
    </div>
    <div class="form-group" style="margin-bottom:6px"><label>Qty at this location</label>
      <input type="number" id="np-loc1qty" placeholder="Leave blank = all opening stock"></div>
    <button type="button" onclick="VW_INVENTORY.addManualRack()" style="background:none;border:1px dashed var(--border);border-radius:8px;padding:5px 10px;font-size:11px;color:var(--text2);cursor:pointer;margin-bottom:8px">+ Add rack manually</button>
    <button type="button" id="np-add-loc-btn" onclick="VW_INVENTORY.showSecondLocation()" style="display:block;background:none;border:1px dashed var(--gold-border);border-radius:8px;padding:7px 10px;font-size:12px;color:var(--gold);cursor:pointer;margin-bottom:10px;width:100%">+ Add second location (split stock)</button>

    <div id="np-loc2-block" style="display:none;border:1px solid var(--border2);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">SECOND LOCATION</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px">
        <div class="form-group" style="margin:0"><label>Zone</label>
          <select id="np-zone2" onchange="VW_INVENTORY.loadInvRacks(this.value,'2')">
            <option value="">Select zone</option>
            ${_zones.map(z=>`<option value="${z.code}">${z.name}</option>`).join('')}
          </select></div>
        <div class="form-group" style="margin:0"><label>Rack No</label>
          <select id="np-rack2" onchange="VW_INVENTORY.loadInvShelves(this.value,'2')"><option value="">Zone first</option></select></div>
        <div class="form-group" style="margin:0"><label>Shelf No</label>
          <select id="np-shelf2"><option value="">Rack first</option></select></div>
      </div>
      <div class="form-group" style="margin:0"><label>Qty at this location</label>
        <input type="number" id="np-loc2qty" placeholder="e.g. 100"></div>
      <p style="font-size:11px;color:var(--text3);margin:6px 0 0">Total on hand = sum of both locations. Adjust the quantities above to split the opening stock.</p>
    </div>
    
    <!-- Warranty -->
    <div class="form-group">
      <label>Warranty Period (months, 0 = no warranty)</label>
      <input type="number" id="np-warranty" value="0" min="0" max="120">
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  toggleProductPricingFields();
  populateInventoryBrandDatalist();
}

// Renders the right input fields for whichever pricing mode is selected,
// and keeps a live preview of the final GST-inclusive price so staff can
// see exactly what they're committing to before saving — this is the
// same confusion (not knowing whether a number includes tax) that
// caused real billing errors, so the preview matters more than cosmetics.
function toggleProductPricingFields(prefix = 'np', prefill = null) {
  const mode = document.getElementById(`${prefix}-pricing-mode`).value;
  const container = document.getElementById(`${prefix}-pricing-fields`);
  const gstSlabOptions = GST_SLABS.map(g => `<option value="${g.value}">${g.label}</option>`).join('');
  const pv = (key, fallback='') => prefill && prefill[key] !== undefined && prefill[key] !== null ? prefill[key] : fallback;

  if (mode === 'net_gst') {
    container.innerHTML = `
      <div class="form-group"><label>Net Price (₹, GST already included) *</label><input type="number" id="${prefix}-net-price" value="${pv('pricingNetPrice')}" placeholder="e.g. 316" oninput="updateProductPricePreview('${prefix}')"></div>
      <div class="form-group"><label>GST Slab (for the breakdown shown on invoices)</label>
        <select id="${prefix}-gst-slab" onchange="updateProductPricePreview('${prefix}')">${gstSlabOptions}</select></div>`;
  } else if (mode === 'basic_gst') {
    container.innerHTML = `
      <div class="form-group"><label>Basic Price (₹, before GST) *</label><input type="number" id="${prefix}-basic-price" value="${pv('pricingBasicPrice')}" placeholder="e.g. 267.80" oninput="updateProductPricePreview('${prefix}')"></div>
      <div class="form-group"><label>GST Slab *</label>
        <select id="${prefix}-gst-slab" onchange="updateProductPricePreview('${prefix}')">${gstSlabOptions}</select></div>`;
  } else if (mode === 'mrp_disc') {
    container.innerHTML = `
      <div class="form-group"><label>MRP (₹) *</label><input type="number" id="${prefix}-mrp" value="${pv('pricingMrp')}" placeholder="e.g. 400" oninput="updateProductPricePreview('${prefix}')"></div>
      <div class="form-group"><label>Discount %</label><input type="number" id="${prefix}-disc-pct" value="${pv('pricingDiscPct')}" placeholder="e.g. 21" oninput="updateProductPricePreview('${prefix}')"></div>
      <div class="form-group"><label>GST Slab (for the breakdown shown on invoices)</label>
        <select id="${prefix}-gst-slab" onchange="updateProductPricePreview('${prefix}')">${gstSlabOptions}</select></div>`;
  } else { // mrp_disc_gst
    container.innerHTML = `
      <div class="form-group"><label>MRP (₹) *</label><input type="number" id="${prefix}-mrp" value="${pv('pricingMrp')}" placeholder="e.g. 400" oninput="updateProductPricePreview('${prefix}')"></div>
      <div class="form-group"><label>Discount %</label><input type="number" id="${prefix}-disc-pct" value="${pv('pricingDiscPct')}" placeholder="e.g. 21" oninput="updateProductPricePreview('${prefix}')"></div>
      <div class="form-group"><label>GST Slab *</label>
        <select id="${prefix}-gst-slab" onchange="updateProductPricePreview('${prefix}')">${gstSlabOptions}</select></div>`;
  }
  const slabEl = document.getElementById(`${prefix}-gst-slab`);
  if (slabEl) slabEl.value = pv('pricingGstSlab', '18');
  updateProductPricePreview(prefix);
}
window.toggleProductPricingFields = toggleProductPricingFields;

function computeProductPrice(prefix = 'np') {
  const mode = document.getElementById(`${prefix}-pricing-mode`).value;
  const slabEl = document.getElementById(`${prefix}-gst-slab`);
  const slab = slabEl ? GST_SLABS.find(g => g.value === slabEl.value) : null;
  const gstPct = slab ? slab.pct : 18;
  let finalPrice = 0, basicPrice = 0;

  if (mode === 'net_gst') {
    // Net price already includes GST
    finalPrice = parseFloat(document.getElementById(`${prefix}-net-price`)?.value) || 0;
    basicPrice = finalPrice / (1 + gstPct/100);
  } else if (mode === 'basic_gst') {
    // Basic price excludes GST — add on top
    basicPrice = parseFloat(document.getElementById(`${prefix}-basic-price`)?.value) || 0;
    finalPrice = basicPrice * (1 + gstPct/100);
  } else if (mode === 'mrp_disc') {
    // MRP is GST-inclusive retail price — just apply discount, do NOT add GST again
    const mrp = parseFloat(document.getElementById(`${prefix}-mrp`)?.value) || 0;
    const discPct = parseFloat(document.getElementById(`${prefix}-disc-pct`)?.value) || 0;
    finalPrice = mrp * (1 - discPct/100);
    basicPrice = finalPrice / (1 + gstPct/100);
  } else { // mrp_disc_gst — base price excludes GST
    const mrp = parseFloat(document.getElementById(`${prefix}-mrp`)?.value) || 0;
    const discPct = parseFloat(document.getElementById(`${prefix}-disc-pct`)?.value) || 0;
    basicPrice = mrp * (1 - discPct/100);
    finalPrice = basicPrice * (1 + gstPct/100);
  }
  return { finalPrice, basicPrice, gstPct };
}
window.computeProductPrice = computeProductPrice;

function updateProductPricePreview(prefix = 'np') {
  const { finalPrice, basicPrice, gstPct } = computeProductPrice(prefix);
  const mode = document.getElementById(`${prefix}-pricing-mode`)?.value;
  const gstAmt = finalPrice - basicPrice;
  const previewEl = document.getElementById(`${prefix}-price-preview`);
  if (!previewEl) return;
  if (mode === 'mrp_disc') {
    previewEl.innerHTML = `Customer price: <strong>₹${finalPrice.toFixed(2)}</strong> <span style="color:var(--text3);font-size:12px">(MRP incl. GST — ₹${basicPrice.toFixed(2)} basic + ₹${gstAmt.toFixed(2)} GST @ ${gstPct}%)</span>`;
  } else {
    previewEl.innerHTML = `Final price: <strong>₹${finalPrice.toFixed(2)}</strong> <span style="color:var(--text3);font-size:12px">(Basic ₹${basicPrice.toFixed(2)} + GST ₹${gstAmt.toFixed(2)} @ ${gstPct}%)</span>`;
  }
}

async function loadInvRacks(zoneCode, suffix=''){
  const el=document.getElementById('np-rack'+suffix); if(!el) return;
  if(!zoneCode){ el.innerHTML='<option value="">Zone first</option>'; const sh=document.getElementById('np-shelf'+suffix); if(sh) sh.innerHTML='<option value="">Rack first</option>'; return; }
  const { data }=await VW_DB.client.from('rack_config').select('rack_no,shelf_nos').eq('warehouse_code',zoneCode).eq('is_active',true);
  const racks=(data||[]).sort((a,b)=>(parseInt(String(a.rack_no).replace(/\D/g,''))||0)-(parseInt(String(b.rack_no).replace(/\D/g,''))||0));
  el.innerHTML=`<option value="">Select rack</option>${racks.map(r=>`<option value="${r.rack_no}" data-shelves='${JSON.stringify(r.shelf_nos||[])}'>${r.rack_no}</option>`).join('')}`;
  const sh=document.getElementById('np-shelf'+suffix); if(sh) sh.innerHTML='<option value="">Rack first</option>';
}
function loadInvShelves(rackNo, suffix=''){
  const opt=document.getElementById('np-rack'+suffix)?.querySelector(`option[value="${rackNo}"]`);
  const shelves=opt?JSON.parse(opt.dataset.shelves||'[]'):[];
  const el=document.getElementById('np-shelf'+suffix);
  if(el) el.innerHTML=`<option value="">Select shelf</option>${shelves.map(s=>`<option value="${s}">${s}</option>`).join('')}`;
}
function showSecondLocation(){
  const b=document.getElementById('np-loc2-block'); if(b) b.style.display='block';
  const btn=document.getElementById('np-add-loc-btn'); if(btn) btn.style.display='none';
  const stockEl=document.getElementById('np-stock');
  const q1=document.getElementById('np-loc1qty');
  if(q1 && !q1.value && stockEl && stockEl.value) q1.value=stockEl.value;
}
async function addManualRack(){
  const zone=document.getElementById('np-zone')?.value;
  if(!zone){ showToast('Select a zone first','warn'); return; }
  const rackNo=(prompt('New rack number (e.g. R61 or COLD-1):')||'').trim();
  if(!rackNo) return;
  const { error }=await VW_DB.client.from('rack_config').insert({ warehouse_code:zone, rack_no:rackNo, shelf_nos:['A','B','C','D','E','UP','Down'], is_active:true });
  if(error){ showToast('Could not add rack','err'); return; }
  await loadInvRacks(zone);
  const el=document.getElementById('np-rack'); if(el) el.value=rackNo;
  loadInvShelves(rackNo);
  showToast(`Rack ${rackNo} added ✓`,'success');
}

// ===== MULTI-LOCATION STOCK (general products) =====
async function getProductStockLocations(productId){
  const { data } = await VW_DB.client.from('product_stock_locations').select('*').eq('product_id', productId).order('qty',{ascending:true});
  const locs = data || [];
  return { total: locs.reduce((s,l)=>s+(Number(l.qty)||0),0), locations: locs };
}
// Lowest-qty-first picking: clears the smallest pockets first (good for audit + consolidation)
function pickStockLowestFirst(locations, needed){
  const sorted = (locations||[]).filter(l=>Number(l.qty)>0).sort((a,b)=>Number(a.qty)-Number(b.qty));
  const plan=[]; let rem=Number(needed)||0;
  for(const l of sorted){ if(rem<=0)break; const take=Math.min(Number(l.qty), rem); plan.push({...l, take}); rem-=take; }
  return { plan, shortfall: Math.max(0, rem) };
}
async function addStockToLocation(productId, warehouse_code, rack_no, shelf_no, qty){
  const { data: ex } = await VW_DB.client.from('product_stock_locations').select('id,qty')
    .eq('product_id',productId).eq('warehouse_code',warehouse_code||'').eq('rack_no',rack_no||'').eq('shelf_no',shelf_no||'').limit(1);
  const existing = ex && ex[0];
  if (existing){
    await VW_DB.client.from('product_stock_locations').update({ qty:(Number(existing.qty)||0)+Number(qty), updated_at:new Date().toISOString() }).eq('id',existing.id);
  } else {
    await VW_DB.client.from('product_stock_locations').insert({ product_id:productId, warehouse_code:warehouse_code||'', rack_no:rack_no||'', shelf_no:shelf_no||'', qty:Number(qty) });
  }
}
async function deductStockLowestFirst(productId, qty){
  const { locations } = await getProductStockLocations(productId);
  const { plan, shortfall } = pickStockLowestFirst(locations, qty);
  for (const p of plan){
    const left = Number(p.qty) - p.take;
    if (left <= 0) await VW_DB.client.from('product_stock_locations').delete().eq('id',p.id);
    else await VW_DB.client.from('product_stock_locations').update({ qty:left, updated_at:new Date().toISOString() }).eq('id',p.id);
  }
  return { plan, shortfall };
}
window.VW_STOCK = { getLocations:getProductStockLocations, pickLowestFirst:pickStockLowestFirst, addToLocation:addStockToLocation, deductLowestFirst:deductStockLowestFirst };

async function addProductLocation(productId){
  const zones = ((await VW_DB.client.from('warehouse_locations').select('code,name').eq('is_active',true).order('sort_order')).data)||[];
  const sheet=document.getElementById('bottom-sheet');
  sheet.innerHTML=`
    <div class="sheet-handle"></div>
    <h3 style="margin-bottom:12px">Add Stock to Location</h3>
    <div class="form-group"><label>Zone</label><select id="pl-zone" onchange="VW_INVENTORY.plLoadRacks(this.value)"><option value="">Select zone</option>${zones.map(z=>`<option value="${z.code}">${z.name}</option>`).join('')}</select></div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Rack</label><select id="pl-rack" onchange="VW_INVENTORY.plLoadShelves(this.value)"><option value="">Zone first</option></select></div>
      <div class="form-group" style="flex:1"><label>Shelf</label><select id="pl-shelf"><option value="">Rack first</option></select></div>
    </div>
    <div class="form-group"><label>Quantity to add</label><input type="number" id="pl-qty" min="0" placeholder="0"></div>
    <button class="btn-primary full-width" onclick="VW_INVENTORY.savePL(${productId})">Add to Location</button>`;
  sheet.classList.add('open'); document.getElementById('sheet-overlay')?.classList.add('open');
}
async function plLoadRacks(zone){
  const el=document.getElementById('pl-rack'); if(!el)return;
  if(!zone){ el.innerHTML='<option value="">Zone first</option>'; return; }
  const { data }=await VW_DB.client.from('rack_config').select('rack_no,shelf_nos').eq('warehouse_code',zone).eq('is_active',true);
  const racks=(data||[]).sort((a,b)=>(parseInt(String(a.rack_no).replace(/\D/g,''))||0)-(parseInt(String(b.rack_no).replace(/\D/g,''))||0));
  el.innerHTML=`<option value="">Select rack</option>${racks.map(r=>`<option value="${r.rack_no}" data-shelves='${JSON.stringify(r.shelf_nos||[])}'>${r.rack_no}</option>`).join('')}`;
  const sh=document.getElementById('pl-shelf'); if(sh) sh.innerHTML='<option value="">Rack first</option>';
}
function plLoadShelves(rack){
  const opt=document.getElementById('pl-rack')?.querySelector(`option[value="${rack}"]`);
  const shelves=opt?JSON.parse(opt.dataset.shelves||'[]'):[];
  const el=document.getElementById('pl-shelf'); if(el) el.innerHTML=`<option value="">Select shelf</option>${shelves.map(s=>`<option value="${s}">${s}</option>`).join('')}`;
}
async function savePL(productId){
  const zone=document.getElementById('pl-zone')?.value, rack=document.getElementById('pl-rack')?.value||'', shelf=document.getElementById('pl-shelf')?.value||'';
  const qty=parseFloat(document.getElementById('pl-qty')?.value);
  if(!zone||isNaN(qty)||qty<=0){ showToast('Select a zone and quantity','warn'); return; }
  await addStockToLocation(productId, zone, rack, shelf, qty);
  showToast('Stock added to location ✓','success');
  closeSheet(); openProduct(productId);
}

async function saveNewProduct() {
  const name = document.getElementById('np-name').value.trim();
  const { finalPrice, gstPct } = computeProductPrice();
  const price = finalPrice;
  const stock = parseFloat(document.getElementById('np-stock').value);
  if (!name || !price || isNaN(stock)) return showToast('Fill all required fields', 'warn');
  const pricingMode = document.getElementById('np-pricing-mode').value;
  const newId = await VW_DB.put(VW_DB.STORES.products, {
    name, category: document.getElementById('np-cat').value,
    subcategory: document.getElementById('np-subcat')?.value || '',
    brand: document.getElementById('np-brand').value.trim(),
    model: document.getElementById('np-model').value.trim(),
    barcode: document.getElementById('np-barcode').value.trim() || `VW-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    hsn: document.getElementById('np-hsn').value.trim(),
    price, costPrice: parseFloat(document.getElementById('np-cost').value) || 0,
    unit: document.getElementById('np-unit').value,
    warehouseZone: document.getElementById('np-zone')?.value.trim() || '',
    rackNo: document.getElementById('np-rack')?.value.trim() || '',
    shelfNo: document.getElementById('np-shelf')?.value.trim() || '',
    warrantyMonths: parseInt(document.getElementById('np-warranty')?.value || 0),
    stock, lowStockThreshold: parseFloat(document.getElementById('np-threshold').value) || 20,
    gst: gstPct,
    // Stored so the exact pricing mode and raw inputs can be reloaded
    // later for editing (e.g. when a GST rate change needs a bulk
    // revisit) — without this, editing a product would only ever show
    // the flattened final price with no memory of how it was derived.
    pricingMode,
    pricingNetPrice: pricingMode === 'net_gst' ? parseFloat(document.getElementById('np-net-price')?.value) || 0 : null,
    pricingBasicPrice: pricingMode === 'basic_gst' ? parseFloat(document.getElementById('np-basic-price')?.value) || 0 : null,
    pricingMrp: (pricingMode === 'mrp_disc' || pricingMode === 'mrp_disc_gst') ? parseFloat(document.getElementById('np-mrp')?.value) || 0 : null,
    pricingDiscPct: (pricingMode === 'mrp_disc' || pricingMode === 'mrp_disc_gst') ? parseFloat(document.getElementById('np-disc-pct')?.value) || 0 : null,
    pricingGstSlab: document.getElementById('np-gst-slab')?.value || '18',
    createdAt: new Date().toISOString()
  });

  // Multi-location stock: record the opening quantity at its zone/rack/shelf so the
  // same product can later live in several locations (total = sum of all rows).
  // Stock locations (one or two). Per-location quantities are editable so
  // the opening stock can be split across two places; when split, the
  // product's on-hand total = the sum of the locations.
  const loc1Zone = document.getElementById('np-zone')?.value.trim() || '';
  const loc2Block = document.getElementById('np-loc2-block');
  const loc2On = loc2Block && loc2Block.style.display !== 'none';
  const loc2Zone = loc2On ? (document.getElementById('np-zone2')?.value.trim() || '') : '';
  const q2 = loc2Zone ? (parseFloat(document.getElementById('np-loc2qty')?.value) || 0) : 0;
  const q1raw = document.getElementById('np-loc1qty')?.value;
  const q1 = (q1raw !== '' && q1raw != null) ? (parseFloat(q1raw) || 0) : (loc2Zone ? Math.max(0, (stock||0) - q2) : stock);

  const locRows = [];
  if (loc1Zone && q1 > 0) locRows.push({ product_id:newId, warehouse_code:loc1Zone, rack_no:document.getElementById('np-rack')?.value.trim()||'', shelf_no:document.getElementById('np-shelf')?.value.trim()||'', qty:q1 });
  if (loc2Zone && q2 > 0) locRows.push({ product_id:newId, warehouse_code:loc2Zone, rack_no:document.getElementById('np-rack2')?.value.trim()||'', shelf_no:document.getElementById('np-shelf2')?.value.trim()||'', qty:q2 });
  if (locRows.length) await VW_DB.client.from('product_stock_locations').insert(locRows).catch(()=>{});

  // When split across two locations, the locations are authoritative — keep
  // the product's on-hand total in sync with their sum.
  const effectiveStock = loc2Zone ? (q1 + q2) : stock;
  if (loc2Zone && effectiveStock !== stock) {
    const prod = await VW_DB.getById(VW_DB.STORES.products, newId);
    if (prod) { prod.stock = effectiveStock; await VW_DB.put(VW_DB.STORES.products, prod); }
  }
  if (!isNaN(effectiveStock)) {
    await recordStockMovement({
      productId: newId, productName: name, delta: effectiveStock, kind: 'opening',
      reason: loc2Zone ? 'Opening stock (2 locations)' : 'Opening stock', locationCode: loc1Zone, stockBefore: 0, stockAfter: effectiveStock
    });
  }
  // Any photos captured during this same form are already uploaded to
  // Storage — now that the product has a real ID, formally submit each
  // one through the same approval queue every other photo goes through,
  // auto-approving and attaching them immediately if this person is
  // senior enough to self-approve.
  if (newProductPhotos.length) {
    const profile = VW_AUTH.getCurrentProfile();
    const isSenior = await currentUserIsInventorySenior();
    for (const photo of newProductPhotos) {
      const photoId = await VW_DB.put(VW_DB.STORES.photoSubmissions, {
        productId: newId, pendingProductId: null,
        storagePath: photo.path, submittedByName: profile ? profile.name : '', submittedByStaffId: profile ? profile.staffId : null,
        status: isSenior ? 'approved' : 'pending',
        reviewedByName: isSenior ? (profile ? profile.name+' (self, senior)' : '') : null,
        reviewedAt: isSenior ? new Date().toISOString() : null,
        createdAt: new Date().toISOString()
      });
      if (isSenior) await applyApprovedPhotoToProduct(photoId, newId, photo.path);
    }
  }

  showToast(newProductPhotos.length ? 'Product added with photo' : 'Product added', 'success');
  newProductPhotos = [];
  closeSheet();
  navigateTo('inventory');
}

async function showRestock(productId) {
  const p = await VW_DB.getById(VW_DB.STORES.products, productId);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Restock: ${p.name}</h3>
    <p style="font-size:13px;color:var(--text3);margin-bottom:16px">Current stock: ${p.stock} ${p.unit}</p>
    <div class="form-group"><label>Quantity to Add *</label><input type="number" id="rs-qty" placeholder="e.g. 500" min="1"></div>
    <div class="form-group"><label>Supplier Name *</label><input type="text" id="rs-supplier" placeholder="e.g. Kajaria Ceramics"></div>
    <div class="form-group"><label>Purchase Rate (₹/${p.unit}) *</label><input type="number" id="rs-rate" placeholder="e.g. 62"></div>
    <div class="form-group"><label>Invoice / Bill No *</label><input type="text" id="rs-bill" placeholder="e.g. SUPP-2024-001"></div>
    <div class="form-group"><label>Date</label><input type="date" id="rs-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <button class="btn-primary full-width" onclick="confirmRestock(${productId})">Confirm Restock</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// Records a stock movement to the user-wise audit log (who added/removed
// what, when, and how on-hand changed). Best-effort — never blocks the
// stock update itself if the log insert fails.
async function recordStockMovement(m) {
  try {
    const profile = VW_AUTH.getCurrentProfile();
    await VW_DB.client.from('stock_movements').insert({
      product_id: m.productId, product_name: m.productName || '',
      delta: m.delta, kind: m.kind || 'adjustment',
      reason: m.reason || '', ref: m.ref || '', location_code: m.locationCode || '',
      stock_before: m.stockBefore, stock_after: m.stockAfter,
      by_name: profile ? profile.name : '', by_staff_id: profile ? profile.staffId : null
    });
  } catch (_) {}
}
window.recordStockMovement = recordStockMovement;

// Clear confirmation popup after stock is added, so it's obvious the system
// recorded it (a quick toast was too easy to miss).
function showStockAddedConfirm({ name, unit, added, before, after, byName }) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:44px;margin-bottom:6px">✅</div>
      <h3 style="margin:0 0 4px">Stock Added</h3>
      <p class="sheet-meta" style="margin-bottom:14px">${name}</p>
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:14px;padding:14px;margin-bottom:12px">
        <div style="font-size:30px;font-weight:800;color:#22c55e">+${added} ${unit||''}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:6px">${before} → <strong>${after}</strong> ${unit||''} on hand</div>
      </div>
      ${byName ? `<div style="font-size:12px;color:var(--text3)">Added by ${byName} · ${new Date().toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
    </div>
    <button class="btn-primary full-width" style="margin-top:6px" onclick="closeSheet();navigateTo('inventory')">Done</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showStockAddedConfirm = showStockAddedConfirm;

async function confirmRestock(productId) {
  const qty = parseFloat(document.getElementById('rs-qty').value);
  const supplier = document.getElementById('rs-supplier').value.trim();
  const rate = parseFloat(document.getElementById('rs-rate').value);
  const billNo = document.getElementById('rs-bill').value.trim();
  if (!qty || qty <= 0) return showToast('Enter quantity', 'warn');
  if (!supplier) return showToast('Supplier name is required', 'warn');
  if (!rate || rate <= 0) return showToast('Enter the actual purchase rate — this feeds margin and cost reports', 'warn');
  if (!billNo) return showToast('Invoice / bill number is required', 'warn');

  const p = await VW_DB.getById(VW_DB.STORES.products, productId);
  const before = parseFloat(p.stock) || 0;
  p.stock = before + qty;
  p.lastRestocked = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.products, p);

  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.purchaseOrders, {
    productId, productName: p.name, qty,
    supplier, rate, billNo,
    date: document.getElementById('rs-date').value,
    addedByName: profile ? profile.name : '', addedByStaffId: profile ? profile.staffId : null,
    status: 'received', createdAt: new Date().toISOString()
  });

  await recordStockMovement({
    productId, productName: p.name, delta: qty, kind: 'restock',
    reason: `Restock from ${supplier}`, ref: billNo,
    stockBefore: before, stockAfter: p.stock
  });

  // Keep per-location rows in sync: add the restocked qty to the product's
  // primary location (its saved zone/rack/shelf) when it has one.
  if (p.warehouseZone) {
    try { await VW_STOCK.addToLocation(productId, p.warehouseZone, p.rackNo||'', p.shelfNo||'', qty); } catch(_) {}
  }

  closeSheet();
  showStockAddedConfirm({ name: p.name, unit: p.unit, added: qty, before, after: p.stock, byName: profile ? profile.name : '' });
}

async function showAddPO(preselectedProductId = null) {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Purchase Order</h3>
    <div class="form-group"><label>Product *</label>
      <select id="po-prod">${products.map(p=>`<option value="${p.id}" ${preselectedProductId && p.id===preselectedProductId?'selected':''}>${p.name} (${p.stock} ${p.unit})</option>`).join('')}</select></div>
    <div class="form-group"><label>Supplier *</label><input type="text" id="po-supplier" placeholder="Supplier name"></div>
    <div class="form-group"><label>Quantity *</label><input type="number" id="po-qty" placeholder="Units to order"></div>
    <div class="form-group"><label>Expected Rate (₹)</label><input type="number" id="po-rate" placeholder="Per unit cost"></div>
    <div class="form-group"><label>Expected Delivery</label><input type="date" id="po-delivery" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Notes</label><input type="text" id="po-notes" placeholder="Any special instructions"></div>
    <button class="btn-primary full-width" onclick="VW_VENDOR.showCreatePO(0)">Create PO</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// Purchase Order functions moved to vendor.js (VW_VENDOR module)
// The full PO flow with multi-product, vendor linking, and receipt is there.

async function confirmDeleteProduct(id) {
  if (!confirm('Delete this product permanently? Past invoices/quotations referencing it are unaffected. This cannot be undone.')) return;
  await VW_DB.del(VW_DB.STORES.products, id);
  showToast('Product deleted', 'info');
  closeSheet();
  navigateTo('inventory');
}
window.confirmDeleteProduct = confirmDeleteProduct;

// Category / Sub-Category inline add from the Add Product form. Writes to
// the same 'categories' map the rest of the app reads ({dept:[subcats]}),
// so a category created here shows up everywhere (quotes, tasks, etc.).
function onAddProductCatChange(cat) {
  try { VW_TILES.injectTileFields(cat); } catch(_) {}
  const sub = document.getElementById('np-subcat');
  if (sub) {
    const subs = (currentCategories || {})[cat] || [];
    sub.innerHTML = subs.length ? subs.map(s=>`<option>${s}</option>`).join('') : '<option value="">— none —</option>';
  }
}
async function addInlineCategory() {
  const name = (prompt('New category name:')||'').trim();
  if (!name) return;
  const cats = await getCategories();
  if (!cats[name]) { cats[name] = []; await VW_DB.setSetting('categories', cats); setCategoriesCache(cats); }
  const sel = document.getElementById('np-cat');
  if (sel) {
    if (!Array.from(sel.options).some(o=>o.value===name || o.textContent===name)) {
      const opt = document.createElement('option'); opt.textContent = name; sel.appendChild(opt);
    }
    sel.value = name;
  }
  onAddProductCatChange(name);
  showToast(`Category "${name}" added`, 'success');
}
async function addInlineSubcategory() {
  const cat = document.getElementById('np-cat')?.value;
  if (!cat) return showToast('Pick a category first', 'warn');
  const name = (prompt(`New sub-category under ${cat}:`)||'').trim();
  if (!name) return;
  const cats = await getCategories();
  cats[cat] = cats[cat] || [];
  if (!cats[cat].includes(name)) { cats[cat].push(name); await VW_DB.setSetting('categories', cats); setCategoriesCache(cats); }
  const sel = document.getElementById('np-subcat');
  if (sel) {
    if (!Array.from(sel.options).some(o=>o.value===name || o.textContent===name)) {
      const opt = document.createElement('option'); opt.textContent = name; sel.appendChild(opt);
    }
    sel.value = name;
  }
  showToast(`Sub-category "${name}" added`, 'success');
}

async function markMaterialSourced(intentId) {
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.client.from('tq_material_intents').update({
    status: 'sourced',
    sourced_at: new Date().toISOString(),
    sourced_by: profile?.name || '',
  }).eq('id', intentId);
  showToast('Marked as sourced ✓', 'success');
  navigateTo('inventory'); // refresh the page
}

window.VW_INVENTORY = { renderInventory, searchInventory, invFilterCat, openProduct, updateProduct, showAddProduct, saveNewProduct, showRestock, confirmRestock, showAddPO, showSubmitProductPhoto, scanProductForInventory, loadInvRacks, loadInvShelves, addManualRack, addProductLocation, plLoadRacks, plLoadShelves, savePL, onAddProductCatChange, addInlineCategory, addInlineSubcategory, showSecondLocation, markMaterialSourced, openProductPricingTab, saveProductPricing, approveProductPricing, rejectProductPricing };

// ===== PHOTO SUBMISSION & APPROVAL (works for existing Inventory products
// AND brand-new pending products not yet approved — same mechanism either
// way, just a different foreign key on the submission row) =====

// A person's own seniorityLevel within Inventory determines whether their
// own submission can skip the approval step — level 2+ counts as senior
// enough to self-approve; level 1 (regular staff) always needs someone
// else to review, regardless of department.
async function currentUserIsInventorySenior() {
  if (VW_AUTH.isAdmin()) return true;
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile || !profile.staffId) return false;
  const staff = await VW_DB.getById(VW_DB.STORES.staff, profile.staffId);
  return !!(staff && (staff.seniorityLevel || 1) >= 2 && (staff.team === 'inventory' || staff.team === 'management' || staff.team === 'store_manager'));
}
window.currentUserIsInventorySenior = currentUserIsInventorySenior;

// Opens a simple camera/file-picker sheet that can be reached from
// anywhere (Quotations adding a new brand, Inventory, Purchase, etc.)
// productId is for an EXISTING Inventory product; pendingProductId is for
// a brand-new one still awaiting its own separate approval. Exactly one
// of the two should be provided.
function showSubmitProductPhoto(productId, pendingProductId, displayName) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Add a Photo${displayName ? ' — '+displayName : ''}</h3>
    <p class="sheet-meta">Take a photo or choose one from your gallery. It'll be reviewed by Inventory before it shows up officially.</p>
    <input type="file" id="submit-photo-input" accept="image/*" capture="environment" onchange="handleSubmitProductPhoto(this, ${productId||'null'}, ${pendingProductId||'null'})">
    <div id="submit-photo-status" style="font-size:12px;margin-top:8px"></div>
    <button class="btn-secondary full-width" style="margin-top:10px" onclick="closeSheet();navigateTo('inventory')">Skip for now</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showSubmitProductPhoto = showSubmitProductPhoto;

async function handleSubmitProductPhoto(input, productId, pendingProductId) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('submit-photo-status');

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (statusEl) statusEl.textContent = 'Uploading...';
  try {
    const folderKey = productId ? `product-${productId}` : `pending-${pendingProductId}`;
    const path = await VW_DB.uploadProductPhoto(dataUrl, folderKey);
    const profile = VW_AUTH.getCurrentProfile();
    const isSenior = await currentUserIsInventorySenior();

    const photoId = await VW_DB.put(VW_DB.STORES.photoSubmissions, {
      productId: productId || null, pendingProductId: pendingProductId || null,
      storagePath: path, submittedByName: profile ? profile.name : '', submittedByStaffId: profile ? profile.staffId : null,
      status: isSenior ? 'approved' : 'pending',
      reviewedByName: isSenior ? (profile ? profile.name+' (self, senior)' : '') : null,
      reviewedAt: isSenior ? new Date().toISOString() : null,
      createdAt: new Date().toISOString()
    });

    // If approved immediately (senior self-submission), fold it straight
    // into the product's real photo gallery now rather than waiting.
    if (isSenior && productId) {
      await applyApprovedPhotoToProduct(photoId, productId, path);
    }

    if (statusEl) statusEl.innerHTML = isSenior
      ? '<span style="color:var(--green)">✓ Photo added</span>'
      : '<span style="color:var(--gold)">✓ Submitted — waiting on Inventory approval</span>';
    showToast(isSenior ? 'Photo added' : 'Photo submitted for approval', 'success');
  } catch (e) {
    console.error('Photo submission error:', e);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">Upload failed — try again</span>';
  }
  input.value = '';
}
window.handleSubmitProductPhoto = handleSubmitProductPhoto;

async function applyApprovedPhotoToProduct(photoId, productId, path) {
  const p = await VW_DB.getById(VW_DB.STORES.products, productId);
  if (!p) return;
  const url = await VW_DB.getProductPhotoUrl(path);
  const photos = p.photos || [];
  photos.push({ path, url, tag: '' });
  p.photos = photos;
  await VW_DB.put(VW_DB.STORES.products, p);
}

// ===== Inventory's review queue for pending photo submissions =====
async function renderPendingPhotoApprovals() {
  const photos = await VW_DB.all(VW_DB.STORES.photoSubmissions);
  const pending = photos.filter(p => p.status === 'pending');
  if (!pending.length) return '<p class="empty-msg">No photos waiting on approval</p>';

  const [products, pendingProducts] = await Promise.all([
    VW_DB.all(VW_DB.STORES.products),
    VW_DB.all(VW_DB.STORES.pendingProducts)
  ]);

  const cards = await Promise.all(pending.map(async ph => {
    const url = await VW_DB.getProductPhotoUrl(ph.storagePath);
    const target = ph.productId ? products.find(p=>p.id===ph.productId) : pendingProducts.find(p=>p.id===ph.pendingProductId);
    const name = target ? (target.name || [target.brand, target.model].filter(Boolean).join(' ')) : 'Unknown product';
    return `
    <div class="product-photo-card" style="margin-bottom:10px">
      <img src="${url}" alt="">
      <div style="font-size:13px;font-weight:600">${name}</div>
      <div style="font-size:11px;color:var(--text3)">Submitted by ${ph.submittedByName||'—'}</div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn-sm" onclick="approvePendingPhoto(${ph.id})">✓ Approve</button>
        <button class="btn-sm" style="color:var(--red)" onclick="rejectPendingPhoto(${ph.id})">✕ Reject</button>
      </div>
    </div>`;
  }));
  return cards.join('');
}
window.renderPendingPhotoApprovals = renderPendingPhotoApprovals;

async function approvePendingPhoto(photoId) {
  const ph = await VW_DB.getById(VW_DB.STORES.photoSubmissions, photoId);
  if (!ph) return;
  const profile = VW_AUTH.getCurrentProfile();
  ph.status = 'approved';
  ph.reviewedByName = profile ? profile.name : '';
  ph.reviewedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.photoSubmissions, ph);

  if (ph.productId) await applyApprovedPhotoToProduct(photoId, ph.productId, ph.storagePath);
  // For a pendingProductId (brand-new product not yet in Inventory), the
  // photo just stays approved-and-attached on this row; it gets carried
  // over to the real product's gallery once that pending product itself
  // is approved into Inventory (handled wherever that approval happens).

  showToast('Photo approved', 'success');
  navigateTo('inventory');
}
window.approvePendingPhoto = approvePendingPhoto;

async function rejectPendingPhoto(photoId) {
  const reason = prompt('Reason for rejecting this photo (optional):') || '';
  const ph = await VW_DB.getById(VW_DB.STORES.photoSubmissions, photoId);
  if (!ph) return;
  const profile = VW_AUTH.getCurrentProfile();
  ph.status = 'rejected';
  ph.rejectReason = reason;
  ph.reviewedByName = profile ? profile.name : '';
  ph.reviewedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.photoSubmissions, ph);
  showToast('Photo rejected', 'info');
  navigateTo('inventory');
}
window.rejectPendingPhoto = rejectPendingPhoto;



// Quick category filter from the shortcuts row
function filterCategoryNav(category) {
  // Navigate to inventory and filter by category
  navigateTo('inventory');
  setTimeout(() => {
    const filterBtn = document.querySelector(`#inv-cat-filter`);
    if (filterBtn) {
      filterBtn.value = category;
      filterBtn.dispatchEvent(new Event('change'));
    } else {
      // Try the filter buttons
      const btns = document.querySelectorAll('.filter-btn');
      btns.forEach(b => {
        if (b.textContent.trim() === category) b.click();
      });
    }
  }, 400);
}
window.filterCategoryNav = filterCategoryNav;


/* === tile_inventory.js === */

// =====================================================
// TILE INVENTORY MODULE v1
// - Dedicated tile add flow (separate from general inventory)
// - Multi-location stock (warehouse + rack + shelf)
// - AI design matcher (brand-scoped visual search)
// - Excel import (inactive until live photo + count)
// - QR code generation (V Wholesale branded)
// - Display stock handling
// - Full stock lifecycle: hold → invoice → return → restock
// =====================================================

// ===== AUDIT HELPER =====
async function auditLog(action, entityType, entityId, entityRef, oldVal, newVal, notes) {
  const p = VW_AUTH.getCurrentProfile();
  try {
    await VW_DB.client.from('audit_log').insert({
      user_name: p?.name||'unknown', user_role: p?.role||'unknown',
      action, entity_type: entityType, entity_id: entityId||null,
      entity_ref: entityRef||null, old_value: oldVal||null,
      new_value: newVal||null, notes: notes||null,
      device: navigator.userAgent.slice(0,100),
    });
  } catch(e) { console.log('Audit log error:', e.message); }
}
window.auditLog = auditLog;

// ===== MAIN TILE INVENTORY PAGE =====
async function renderTileInventoryPage() {
  const { data: products } = await VW_DB.client
    .from('products')
    .select('*, tile_stock_locations(*)')
    .eq('category','Tiles')
    .order('brand').order('name')
    .limit(200);
  const tiles = products || [];

  // Fetch warehouse locations for filter dropdown + manager panel
  const { data: warehouses } = await VW_DB.client
    .from('warehouse_locations').select('*').eq('is_active',true).order('sort_order');

  // Compute available stock per product
  const { data: holds } = await VW_DB.client.from('stock_holds').select('product_id,boxes_held').eq('status','active');
  const heldMap = {};
  (holds||[]).forEach(h => { heldMap[h.product_id] = (heldMap[h.product_id]||0) + (h.boxes_held||0); });

  const totalProducts = tiles.length;
  const lowStock = tiles.filter(p => {
    const total = (p.tile_stock_locations||[]).reduce((s,l)=>s+(l.qty_boxes||0),0);
    const held = heldMap[p.id]||0;
    return (total-held) <= 5;
  }).length;
  const displayItems = tiles.filter(p=>(p.tile_stock_locations||[]).some(l=>l.is_display)).length;

  return `
  <div class="module-header">
    <h2>🔲 Tile Inventory</h2>
    <div style="display:flex;gap:6px">
      <button class="btn-sm" onclick="VW_TILE_INV.showExcelImport()">📊 Import</button>
      <button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_TILE_INV.showAddTileForm()">+ Add Tile</button>
    </div>
  </div>

  <div class="metric-grid-4" style="margin-bottom:12px">
    <div class="metric-card gold"><div class="mc-label">Total SKUs</div><div class="mc-value">${totalProducts}</div></div>
    <div class="metric-card danger"><div class="mc-label">Low / No Stock</div><div class="mc-value">${lowStock}</div></div>
    <div class="metric-card"><div class="mc-label">Display Items</div><div class="mc-value">${displayItems}</div></div>
    <div class="metric-card"><div class="mc-label">Pending Photos</div><div class="mc-value">${tiles.filter(p=>!p.has_live_photo).length}</div></div>
  </div>

  <!-- SEARCH + FILTER — warehouse options loaded from DB -->
  <div style="display:flex;gap:8px;margin-bottom:10px">
    <input type="text" id="ti-search" placeholder="🔍 Brand, size, design..." oninput="VW_TILE_INV.filterTileInventory(this.value)" style="flex:1">
    <select id="ti-warehouse" onchange="VW_TILE_INV.filterTileInventory()" style="width:130px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:8px;font-size:12px;color:var(--text)">
      <option value="">All Locations</option>
      ${warehouses.map(w=>`<option value="${w.code}">${w.name}</option>`).join('')}
    </select>
  </div>

  <!-- WAREHOUSE MANAGER — admin/store_manager only -->
  ${(['admin','store_manager'].includes(VW_AUTH.getCurrentProfile()?.role||'')) ? `
  <div class="card" style="margin-bottom:12px;border-color:rgba(96,165,250,0.3)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 class="card-title" style="margin:0">🏭 Warehouse / Location Manager</h3>
      <button onclick="VW_TILE_INV.showAddWarehouseForm()" class="btn-sm" style="background:var(--gold);color:#000">+ Add</button>
    </div>
    <div id="wh-list">
    ${warehouses.map(w=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border2)" id="wh-row-${w.id}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${w.name}</div>
        <div style="font-size:10px;color:var(--text3)">${w.code}</div>
      </div>
      <button onclick="VW_TILE_INV.editWarehouse(${w.id},'${w.name.replace(/'/g,"\\'")}','${w.code}')"
        style="padding:3px 10px;border-radius:6px;font-size:11px;background:var(--bg3);border:1px solid var(--border);cursor:pointer;color:var(--text2)">✎</button>
      <button onclick="VW_TILE_INV.deleteWarehouse(${w.id},'${w.name.replace(/'/g,"\\'")}')"
        style="padding:3px 10px;border-radius:6px;font-size:11px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);cursor:pointer;color:var(--red)">✕</button>
    </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- TILE LIST -->
  <div id="tile-inv-list">
    ${_renderTileList(tiles, heldMap)}
  </div>`;
}

function _renderTileList(tiles, heldMap) {
  if (!tiles.length) return `
  <div style="text-align:center;padding:40px;color:var(--text3)">
    <div style="font-size:40px;margin-bottom:10px">🔲</div>
    <div style="font-size:14px">No tiles in inventory yet</div>
    <button class="btn-primary" style="margin-top:14px" onclick="VW_TILE_INV.showAddTileForm()">+ Add First Tile</button>
  </div>`;

  // Group by brand
  const byBrand = {};
  tiles.forEach(p => { const b=p.brand||'Other'; if(!byBrand[b]) byBrand[b]=[]; byBrand[b].push(p); });

  return Object.entries(byBrand).map(([brand, items]) => `
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;padding:0 2px">${brand} · ${items.length} SKUs</div>
    ${items.map(p => {
      const locs = p.tile_stock_locations || [];
      const totalBoxes = locs.reduce((s,l)=>s+(l.qty_boxes||0), 0);
      const displayBoxes = locs.filter(l=>l.is_display).reduce((s,l)=>s+(l.qty_boxes||0), 0);
      const sellableBoxes = totalBoxes - displayBoxes;
      const held = heldMap[p.id] || 0;
      const available = Math.max(0, sellableBoxes - held);
      const hasPhoto = p.has_live_photo;

      return `
      <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:6px;border:1px solid ${available<=0?'rgba(239,68,68,0.3)':available<=5?'rgba(245,200,66,0.3)':'var(--border)'}">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <!-- DESIGN IMAGE -->
          <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--bg3);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="VW_TILE_INV.openTileDetail(${p.id})">
            ${p.image_url||p.thumbnail_url ? `<img src="${p.image_url||p.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:24px">🔲</span>`}
          </div>
          <!-- INFO -->
          <div style="flex:1;min-width:0" onclick="VW_TILE_INV.openTileDetail(${p.id})" style="cursor:pointer">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${p.name||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${p.tile_size_label||p.tile_size_mm||'—'} · ${p.tile_finish||''}</div>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
              <span style="font-size:11px;background:${available>10?'rgba(34,197,94,0.1)':available>0?'rgba(245,200,66,0.1)':'rgba(239,68,68,0.1)'};color:${available>10?'var(--green)':available>0?'var(--gold)':'var(--red)'};padding:1px 6px;border-radius:4px;font-weight:600">
                ${available} avail
              </span>
              ${held>0?`<span style="font-size:11px;background:rgba(239,68,68,0.1);color:var(--red);padding:1px 6px;border-radius:4px">${held} held</span>`:''}
              ${displayBoxes>0?`<span style="font-size:11px;background:rgba(96,165,250,0.1);color:#60A5FA;padding:1px 6px;border-radius:4px">🖼 ${displayBoxes} display</span>`:''}
              ${!hasPhoto?`<span style="font-size:11px;background:rgba(245,200,66,0.1);color:var(--gold);padding:1px 6px;border-radius:4px">📷 Photo needed</span>`:''}
            </div>
          </div>
          <!-- ACTIONS -->
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
            <button onclick="VW_TILE_INV.showQR(${p.id},'${(p.name||'').replace(/'/g,"\\'")}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;color:var(--text2)">📱 QR</button>
            <button onclick="VW_TILE_INV.adjustStock(${p.id})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;color:var(--text2)">+ Stock</button>
          </div>
        </div>
        <!-- LOCATION BREAKDOWN -->
        ${locs.length > 0 ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          ${locs.map(l=>`
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);padding:1px 0">
            <span>${l.is_display?'🖼 Display':'📦'} ${l.warehouse_code||'—'} · ${l.rack_no||'—'}/${l.shelf_no||'—'}</span>
            <span style="color:var(--text2)">${l.qty_boxes||0} boxes${l.qty_pcs?` + ${l.qty_pcs}pcs`:''}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`).join('');
}

async function filterTileInventory(search) {
  const q = (search||document.getElementById('ti-search')?.value||'').toLowerCase();
  const warehouse = document.getElementById('ti-warehouse')?.value||'';

  let query = VW_DB.client.from('products').select('*, tile_stock_locations(*)').eq('category','Tiles');
  if (warehouse) query = query.eq('tile_stock_locations.warehouse_code', warehouse);
  const { data } = await query.order('brand').order('name').limit(200);
  const tiles = (data||[]).filter(p => !q ||
    (p.name||'').toLowerCase().includes(q) ||
    (p.brand||'').toLowerCase().includes(q) ||
    (p.tile_size_mm||'').toLowerCase().includes(q) ||
    (p.tile_finish||'').toLowerCase().includes(q)
  );

  const { data: holds } = await VW_DB.client.from('stock_holds').select('product_id,boxes_held').eq('status','active');
  const heldMap = {};
  (holds||[]).forEach(h => { heldMap[h.product_id] = (heldMap[h.product_id]||0) + (h.boxes_held||0); });

  const el = document.getElementById('tile-inv-list');
  if (el) el.innerHTML = _renderTileList(tiles, heldMap);
}

// ===== ADD TILE FORM =====
async function showAddTileForm(prefill) {
  const { data: warehouses } = await VW_DB.client.from('warehouse_locations').select('*').eq('is_active',true).order('sort_order');
  const wh = warehouses || [];

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">🔲 Add Tile Product</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="max-height:70vh;overflow-y:auto;padding-bottom:20px">

    <!-- STEP 1: BRAND + DESIGN MATCH -->
    <div class="form-group">
      <label>Brand *</label>
      <input type="text" id="at-brand" value="${prefill?.brand||''}" placeholder="e.g. TISAN, Kajaria, Somany"
        oninput="VW_TILE_INV.onBrandChange(this.value)">
    </div>
    <div class="form-group">
      <label>Size *</label>
      <select id="at-size">
        <option value="">Select size</option>
        ${window.TILE_SIZES ? window.TILE_SIZES.map(s=>`<option value="${s.mm}" ${prefill?.size===s.mm?'selected':''}>${s.label}</option>`).join('') : ''}
      </select>
    </div>
    <div class="form-group">
      <label>Product Name *</label>
      <input type="text" id="at-name" value="${prefill?.name||''}" placeholder="Design name / catalogue code">
    </div>
    <div class="form-group">
      <label>Finish</label>
      <select id="at-finish">
        ${['MATT','GLOSSY','SATIN','POLISHED','SUGAR','CARVING','METALLIC','STONE LOOK'].map(f=>`<option>${f}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="at-desc" placeholder="Notes about this tile..." style="height:60px"></textarea>
    </div>

    <!-- AI DESIGN MATCHER -->
    <div style="background:rgba(96,165,250,0.06);border:1px dashed rgba(96,165,250,0.4);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#60A5FA;margin-bottom:4px">🤖 AI Design Match Check</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">Upload a clear photo of the tile. AI will check if this design already exists in the <strong id="at-brand-label">selected brand</strong>'s catalog — prevents duplicates.</div>
      <button onclick="document.getElementById('at-design-pic').click()"
        style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;color:var(--text)">
        📷 Take / Upload Design Photo
      </button>
      <input type="file" id="at-design-pic" accept="image/*" style="display:none" onchange="VW_TILE_INV.matchDesign(this)">
      <div id="at-match-result" style="margin-top:8px"></div>
    </div>

    <!-- PRODUCT DESIGN PICS -->
    <div class="form-group">
      <label>Product Design Photos</label>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">High quality pics used for Visualizer. Camera or gallery.</div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('at-pics-live').click()" style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:7px;font-size:11px;cursor:pointer">📷 Live Photo</button>
        <button onclick="document.getElementById('at-pics-file').click()" style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:7px;font-size:11px;cursor:pointer">🖼 From Gallery</button>
      </div>
      <input type="file" id="at-pics-live" accept="image/*" capture="environment" multiple style="display:none" onchange="VW_TILE_INV.previewDesignPics(this)">
      <input type="file" id="at-pics-file" accept="image/*" multiple style="display:none" onchange="VW_TILE_INV.previewDesignPics(this)">
      <div id="at-pics-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
    </div>

    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Tiles/Box</label><input type="number" id="at-tpb" placeholder="4" min="1"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Sqft/Box</label><input type="number" id="at-spb" placeholder="16" step="0.1"></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Sale Price/Box (₹) *</label>
        <input type="number" id="at-price-box" placeholder="e.g. 780" step="1"
          oninput="const spb=parseFloat(document.getElementById('at-spb')?.value)||0;const pb=parseFloat(this.value)||0;if(spb>0)document.getElementById('at-price-sqft').value=Math.round(pb/spb*100)/100">
        <div style="font-size:10px;color:var(--text3);margin-top:2px">What you sell it at</div>
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Sale Price/Sqft (₹)</label>
        <input type="number" id="at-price-sqft" placeholder="Auto-calc" step="0.1" readonly style="background:var(--bg2)">
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Auto from price/box ÷ sqft</div>
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>MRP/Box (₹)</label>
        <input type="number" id="at-mrp" placeholder="850" step="1">
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Brand MRP (for reference)</div>
      </div>
    </div>

    <!-- WAREHOUSE LOCATION -->
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;margin-top:4px">📦 Storage Location</div>
    <div class="form-group">
      <label>Warehouse *</label>
      <select id="at-warehouse" onchange="VW_TILE_INV.loadRacks(this.value)">
        <option value="">Select warehouse</option>
        ${wh.map(w=>`<option value="${w.code}">${w.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Rack No</label>
        <select id="at-rack" onchange="VW_TILE_INV.loadShelves(this.value)">
          <option value="">Select warehouse first</option>
        </select>
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Shelf No</label>
        <select id="at-shelf"><option value="">Select rack first</option></select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Qty (Boxes) *</label><input type="number" id="at-qtybox" placeholder="0" min="0"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Additional (Pcs)</label><input type="number" id="at-qtypcs" placeholder="0" min="0"></div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <input type="checkbox" id="at-display" style="width:16px;height:16px">
      <label style="font-size:12px">This is a Display Sample (not for sale)</label>
    </div>

    <!-- SHELF PHOTO (LIVE ONLY) -->
    <div class="form-group">
      <label>📷 Shelf Photo (Live Camera) *</label>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Required to activate this stock. Take photo showing tiles on shelf with quantity visible.</div>
      <button onclick="document.getElementById('at-shelf-pic').click()" id="at-shelf-btn"
        style="width:100%;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;padding:10px;font-size:12px;cursor:pointer;color:var(--text3)">
        📷 Take Live Shelf Photo
      </button>
      <input type="file" id="at-shelf-pic" accept="image/*" capture="environment" style="display:none" onchange="VW_TILE_INV.previewShelfPic(this)">
      <div id="at-shelf-preview" style="margin-top:8px"></div>
    </div>

    <div id="at-duplicate-warning" style="display:none;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">⚠️ Similar Product Found</div>
      <div id="at-dup-detail" style="font-size:11px;color:var(--text2)"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button onclick="VW_TILE_INV.mergeWithExisting()" class="btn-sm" style="background:var(--green);color:#fff">Merge Stock</button>
        <button onclick="document.getElementById('at-duplicate-warning').style.display='none'" class="btn-sm">Create New</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;padding-top:4px">
      <button class="btn-secondary" style="flex:0.4" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:1" id="at-save-btn" onclick="VW_TILE_INV.saveTileProduct()">
        Save Tile Product
      </button>
    </div>
    </div>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function onBrandChange(val) {
  const lbl = document.getElementById('at-brand-label');
  if (lbl) lbl.textContent = val ? `"${val}"` : 'selected brand';
  window._atCurrentBrand = val;
}

async function loadRacks(warehouseCode) {
  if (!warehouseCode) return;
  const { data } = await VW_DB.client.from('rack_config').select('*').eq('warehouse_code', warehouseCode).eq('is_active',true);
  const racks = data || [];
  const el = document.getElementById('at-rack');
  if (el) el.innerHTML = `<option value="">Select rack</option>${racks.map(r=>`<option value="${r.rack_no}" data-shelves='${JSON.stringify(r.shelf_nos||[])}'>${r.rack_no}</option>`).join('')}`;
}

function loadShelves(rackNo) {
  const rackEl = document.getElementById('at-rack');
  const opt = rackEl?.querySelector(`option[value="${rackNo}"]`);
  const shelves = opt ? JSON.parse(opt.dataset.shelves||'[]') : [];
  const el = document.getElementById('at-shelf');
  if (el) el.innerHTML = `<option value="">Select shelf</option>${shelves.map(s=>`<option value="${s}">${s}</option>`).join('')}`;
}

// ===== AI DESIGN MATCHER (brand-scoped) =====
async function matchDesign(input) {
  const file = input.files?.[0];
  if (!file) return;
  const brand = document.getElementById('at-brand')?.value.trim();
  const result = document.getElementById('at-match-result');
  if (!result) return;
  if (!brand) { result.innerHTML = `<div style="font-size:11px;color:var(--gold)">⚠️ Enter brand name first — AI only searches within the same brand</div>`; return; }

  result.innerHTML = `<div style="font-size:11px;color:var(--text3)">⏳ Searching ${brand} catalog for matching designs...</div>`;

  const b64 = await new Promise(res=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image(); img.onload=()=>{
        const canvas=document.createElement('canvas');
        const max=1200; const ratio=Math.min(max/img.width,max/img.height,1);
        canvas.width=Math.round(img.width*ratio); canvas.height=Math.round(img.height*ratio);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        res(canvas.toDataURL('image/jpeg',0.9).split(',')[1]);
      };
      img.onerror=()=>res(e.target.result.split(',')[1]);
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Fetch all existing products for this brand
  const { data: brandProducts } = await VW_DB.client.from('products')
    .select('id,name,brand,tile_size_mm,tile_finish,image_url,description')
    .ilike('brand', `%${brand}%`).eq('category','Tiles').limit(100);

  const productList = (brandProducts||[]).map(p=>`ID:${p.id} | ${p.name} (${p.tile_size_mm}, ${p.tile_finish})`).join('\n');

  try {
    const res = await fetch(`${VW_DB.client.supabaseUrl}/functions/v1/room-visualizer`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${VW_DB.client.supabaseKey}`,'apikey':VW_DB.client.supabaseKey},
      body: JSON.stringify({
        mode:'design_match', imageBase64:b64,
        prompt:`You are analyzing a tile design photo to check if it matches any existing product in the ${brand} catalog.

Existing ${brand} products in database:
${productList||'(No existing products for this brand yet)'}

Look at the tile in the image carefully:
- Color, pattern, texture, surface finish
- Check if it matches any product above visually

Return ONLY JSON:
{
  "match_found": true/false,
  "matched_id": null or product_id_number,
  "matched_name": null or "product name",
  "confidence": "high/medium/low",
  "tile_description": "brief description of what you see",
  "color_family": "e.g. White, Grey, Beige, Black",
  "surface": "glossy/matt/satin/etc",
  "reason": "why you think it matches or not"
}`
      })
    });
    const data = await res.json();
    let parsed = null;
    try {
      const text = data.description||data.response||JSON.stringify(data);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch(e){}

    if (parsed?.match_found && parsed.matched_id) {
      window._atMatchedId = parsed.matched_id;
      window._atMatchedName = parsed.matched_name;
      const dupWarn = document.getElementById('at-duplicate-warning');
      const dupDetail = document.getElementById('at-dup-detail');
      if (dupWarn) dupWarn.style.display='block';
      if (dupDetail) dupDetail.innerHTML = `Matches: <strong>${parsed.matched_name}</strong> (${parsed.confidence} confidence)<br>${parsed.reason}`;
      result.innerHTML = `<div style="font-size:11px;color:var(--gold)">⚠️ Possible duplicate found (${parsed.confidence} match) — see warning above</div>`;
      // Auto-fill description with AI analysis
      const desc = document.getElementById('at-desc');
      if (desc && !desc.value) desc.value = parsed.tile_description||'';
    } else {
      result.innerHTML = `<div style="font-size:11px;color:var(--green)">✓ No match found in ${brand} catalog — this appears to be a new design<br><span style="color:var(--text3)">${parsed?.tile_description||''} · ${parsed?.color_family||''} · ${parsed?.surface||''}</span></div>`;
      const desc = document.getElementById('at-desc');
      if (desc && !desc.value && parsed) desc.value = [parsed.tile_description, parsed.color_family, parsed.surface].filter(Boolean).join(', ');
    }
  } catch(e) {
    result.innerHTML = `<div style="font-size:11px;color:var(--red)">Error: ${e.message}</div>`;
  }
}

function previewDesignPics(input) {
  const files = Array.from(input.files||[]);
  const preview = document.getElementById('at-pics-preview');
  if (!preview) return;
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border)';
      preview.appendChild(img);
    };
    reader.readAsDataURL(f);
  });
  window._atDesignFiles = [...(window._atDesignFiles||[]), ...files];
}

function previewShelfPic(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const el = document.getElementById('at-shelf-preview');
    if (el) el.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;border:1px solid var(--green)">
    <div style="font-size:11px;color:var(--green);margin-top:4px">✓ Live shelf photo captured — stock will be active</div>`;
    const btn = document.getElementById('at-save-btn');
    if (btn) btn.style.background = 'var(--green)';
  };
  reader.readAsDataURL(file);
  window._atShelfFile = file;
}

// ===== MERGE WITH EXISTING =====
async function mergeWithExisting() {
  const matchedId = window._atMatchedId;
  if (!matchedId) return;
  const boxes = parseInt(document.getElementById('at-qtybox')?.value||0);
  const pcs = parseInt(document.getElementById('at-qtypcs')?.value||0);
  const warehouse = document.getElementById('at-warehouse')?.value;
  const rack = document.getElementById('at-rack')?.value;
  const shelf = document.getElementById('at-shelf')?.value;
  if (!boxes||!warehouse||!rack) { showToast('Enter qty, warehouse and rack to merge','warn'); return; }

  // Add stock at this location for existing product
  const { data: existingLoc } = await VW_DB.client.from('tile_stock_locations')
    .select('*').eq('product_id', matchedId).eq('warehouse_code', warehouse).eq('rack_no', rack).eq('shelf_no', shelf).single().catch(()=>({data:null}));

  if (existingLoc) {
    await VW_DB.client.from('tile_stock_locations').update({
      qty_boxes: (existingLoc.qty_boxes||0) + boxes,
      qty_pcs: (existingLoc.qty_pcs||0) + pcs,
      updated_at: new Date().toISOString(),
    }).eq('id', existingLoc.id);
  } else {
    await VW_DB.client.from('tile_stock_locations').insert({
      product_id: matchedId, warehouse_code: warehouse, rack_no: rack, shelf_no: shelf,
      qty_boxes: boxes, qty_pcs: pcs,
    });
  }
  // Update total stock on products table
  const { data: allLocs } = await VW_DB.client.from('tile_stock_locations').select('qty_boxes').eq('product_id', matchedId);
  const totalBoxes = (allLocs||[]).reduce((s,l)=>s+(l.qty_boxes||0),0);
  await VW_DB.client.from('products').update({ stock: totalBoxes }).eq('id', matchedId);

  await auditLog('inventory_merge', 'product', matchedId, window._atMatchedName, null, {boxes, warehouse, rack, shelf}, 'Merged via AI design match');
  closeSheet();
  showToast(`Merged ${boxes} boxes into ${window._atMatchedName} ✓`,'success');
  navigateTo('tile_inventory');
}

// ===== SAVE NEW TILE =====
async function saveTileProduct() {
  const brand = document.getElementById('at-brand')?.value.trim();
  const name = document.getElementById('at-name')?.value.trim();
  const size = document.getElementById('at-size')?.value;
  const boxes = parseInt(document.getElementById('at-qtybox')?.value||0);
  const warehouse = document.getElementById('at-warehouse')?.value;
  const rack = document.getElementById('at-rack')?.value;

  if (!brand||!name||!size) { showToast('Brand, name and size are required','warn'); return; }
  if (!window._atShelfFile) { showToast('Live shelf photo is required to activate stock','warn'); return; }

  const profile = VW_AUTH.getCurrentProfile();
  const btn = document.getElementById('at-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='Saving...'; }

  // Generate QR code payload
  const qrPayload = `${window.location.origin}/vwholesale-app/?product_qr=${Date.now()}`;

  // Insert product
  const tileSize = (window.TILE_SIZES||[]).find(s=>s.mm===size);
  const { data: product, error } = await VW_DB.client.from('products').insert({
    name, brand, category:'Tiles',
    tile_size_mm: size,
    tile_size_label: tileSize?.label||size,
    tile_finish: document.getElementById('at-finish')?.value||'',
    description: document.getElementById('at-desc')?.value||'',
    tiles_per_box: parseInt(document.getElementById('at-tpb')?.value||4),
    coverage_per_box: parseFloat(document.getElementById('at-spb')?.value||0)||null,
    price: parseFloat(document.getElementById('at-price-box')?.value||0)||null,
    price_per_sqft: parseFloat(document.getElementById('at-price-sqft')?.value||0)||null,
    mrp: parseFloat(document.getElementById('at-mrp')?.value||0)||null,
    stock: boxes,
    has_live_photo: true,
    is_active: true,
    qr_code: qrPayload,
    qr_generated_at: new Date().toISOString(),
    purchase_date: new Date().toISOString().split('T')[0],
    added_by: profile?.name||'',
  }).select().single();

  if (error) {
    if (btn) { btn.disabled=false; btn.textContent='Save Tile Product'; }
    showToast('Error: '+error.message,'error'); return;
  }

  // Insert stock location
  if (warehouse && boxes > 0) {
    await VW_DB.client.from('tile_stock_locations').insert({
      product_id: product.id,
      warehouse_code: warehouse,
      rack_no: rack||'',
      shelf_no: document.getElementById('at-shelf')?.value||'',
      qty_boxes: boxes,
      qty_pcs: parseInt(document.getElementById('at-qtypcs')?.value||0),
      is_display: document.getElementById('at-display')?.checked||false,
      last_counted_at: new Date().toISOString(),
      last_counted_by: profile?.name||'',
      qr_code: qrPayload,
    });
  }

  await auditLog('inventory_add', 'product', product.id, `${brand} ${name}`, null, {boxes, warehouse, rack}, 'New tile added');
  closeSheet();
  showToast(`${brand} ${name} added ✓ — QR generated`,'success');
  navigateTo('tile_inventory');
}

// ===== STOCK ADJUST (add more stock to existing) =====
async function adjustStock(productId) {
  const { data: p } = await VW_DB.client.from('products').select('*').eq('id',productId).single();
  const { data: warehouses } = await VW_DB.client.from('warehouse_locations').select('*').eq('is_active',true).order('sort_order');
  const { data: locs } = await VW_DB.client.from('tile_stock_locations').select('*').eq('product_id',productId);
  if (!p) return;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin-bottom:4px">${p.brand} ${p.name}</h3>
    <div style="font-size:11px;color:var(--text3);margin-bottom:14px">${p.tile_size_mm||''} · ${p.tile_finish||''}</div>

    <div style="font-size:12px;font-weight:600;margin-bottom:8px">Current Stock by Location</div>
    ${(locs||[]).map(l=>`
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 8px;background:var(--bg2);border-radius:8px;margin-bottom:4px">
      <span>${l.warehouse_code} · ${l.rack_no||'—'}/${l.shelf_no||'—'}${l.is_display?' (Display)':''}</span>
      <span style="font-weight:600">${l.qty_boxes} boxes</span>
    </div>`).join('')}

    <div style="font-size:12px;font-weight:600;margin:12px 0 8px">Add More Stock</div>
    <div class="form-group"><label>Warehouse</label>
      <select id="adj-wh" onchange="VW_TILE_INV.loadRacksForAdj(this.value)">
        <option value="">Select</option>
        ${(warehouses||[]).map(w=>`<option value="${w.code}">${w.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Rack</label><select id="adj-rack"><option>Select WH first</option></select></div>
      <div class="form-group" style="margin:0;flex:1"><label>Shelf</label><select id="adj-shelf"><option>Select rack first</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Boxes to Add</label><input type="number" id="adj-boxes" placeholder="0" min="0"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Pcs to Add</label><input type="number" id="adj-pcs" placeholder="0" min="0"></div>
    </div>
    <div class="form-group"><label>📷 Shelf Photo (Live) *</label>
      <button onclick="document.getElementById('adj-pic').click()" style="width:100%;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;padding:8px;font-size:12px;cursor:pointer;color:var(--text3)">📷 Take Live Photo</button>
      <input type="file" id="adj-pic" accept="image/*" capture="environment" style="display:none" onchange="VW_TILE_INV.previewAdjPhoto(this)">
      <div id="adj-pic-preview" style="margin-top:6px"></div>
    </div>
    <button class="btn-primary full-width" onclick="VW_TILE_INV.saveStockAdjustment(${productId})">Add Stock</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function loadRacksForAdj(wh) {
  const { data } = await VW_DB.client.from('rack_config').select('*').eq('warehouse_code',wh).eq('is_active',true);
  const el = document.getElementById('adj-rack');
  if (el) el.innerHTML = `<option value="">Select</option>${(data||[]).map(r=>`<option value="${r.rack_no}" data-shelves='${JSON.stringify(r.shelf_nos||[])}'>${r.rack_no}</option>`).join('')}`;
  document.getElementById('adj-rack')?.addEventListener('change', function() {
    const opt = this.querySelector(`option[value="${this.value}"]`);
    const shelves = opt ? JSON.parse(opt.dataset.shelves||'[]') : [];
    const sel = document.getElementById('adj-shelf');
    if (sel) sel.innerHTML = `<option value="">Select</option>${shelves.map(s=>`<option value="${s}">${s}</option>`).join('')}`;
  });
}

function previewAdjPhoto(input) {
  const file = input.files?.[0]; if (!file) return;
  window._adjShelfFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const el = document.getElementById('adj-pic-preview');
    if (el) el.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--green)"><div style="font-size:11px;color:var(--green);margin-top:3px">✓ Live photo captured</div>`;
  };
  reader.readAsDataURL(file);
}

async function saveStockAdjustment(productId) {
  if (!window._adjShelfFile) { showToast('Live shelf photo required','warn'); return; }
  const boxes = parseInt(document.getElementById('adj-boxes')?.value||0);
  const pcs = parseInt(document.getElementById('adj-pcs')?.value||0);
  const wh = document.getElementById('adj-wh')?.value;
  const rack = document.getElementById('adj-rack')?.value;
  const shelf = document.getElementById('adj-shelf')?.value;
  if (!boxes && !pcs) { showToast('Enter quantity','warn'); return; }
  if (!wh || !rack) { showToast('Select warehouse and rack','warn'); return; }

  const { data: existing } = await VW_DB.client.from('tile_stock_locations')
    .select('*').eq('product_id',productId).eq('warehouse_code',wh).eq('rack_no',rack).eq('shelf_no',shelf||'')
    .single().catch(()=>({data:null}));

  if (existing) {
    await VW_DB.client.from('tile_stock_locations').update({
      qty_boxes:(existing.qty_boxes||0)+boxes, qty_pcs:(existing.qty_pcs||0)+pcs,
      last_counted_at:new Date().toISOString(), last_counted_by:VW_AUTH.getCurrentProfile()?.name||'',
    }).eq('id',existing.id);
  } else {
    await VW_DB.client.from('tile_stock_locations').insert({
      product_id:productId, warehouse_code:wh, rack_no:rack, shelf_no:shelf||'',
      qty_boxes:boxes, qty_pcs:pcs, last_counted_at:new Date().toISOString(),
      last_counted_by:VW_AUTH.getCurrentProfile()?.name||'',
    });
  }

  // Update product total stock
  const { data: allLocs } = await VW_DB.client.from('tile_stock_locations').select('qty_boxes').eq('product_id',productId);
  const total = (allLocs||[]).reduce((s,l)=>s+(l.qty_boxes||0),0);
  await VW_DB.client.from('products').update({ stock:total, has_live_photo:true }).eq('id',productId);

  await auditLog('stock_adjust', 'product', productId, null, null, {boxes, wh, rack}, 'Manual stock addition');
  window._adjShelfFile = null;
  closeSheet();
  showToast(`+${boxes} boxes added to stock ✓`,'success');
  navigateTo('tile_inventory');
}

// ===== TILE DETAIL PAGE =====
async function openTileDetail(productId) {
  const { data: p } = await VW_DB.client.from('products').select('*').eq('id',productId).single();
  const { data: locs } = await VW_DB.client.from('tile_stock_locations').select('*').eq('product_id',productId);
  const { data: holds } = await VW_DB.client.from('stock_holds').select('*').eq('product_id',productId).eq('status','active');
  if (!p) return;

  const totalBoxes = (locs||[]).filter(l=>!l.is_display).reduce((s,l)=>s+(l.qty_boxes||0),0);
  const displayBoxes = (locs||[]).filter(l=>l.is_display).reduce((s,l)=>s+(l.qty_boxes||0),0);
  const heldBoxes = (holds||[]).reduce((s,h)=>s+(h.boxes_held||0),0);
  const available = Math.max(0, totalBoxes - heldBoxes);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:15px;font-weight:700">${p.brand} — ${p.name}</div>
        <div style="font-size:12px;color:var(--text3)">${p.tile_size_label||p.tile_size_mm||''} · ${p.tile_finish||''}</div>
      </div>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <!-- STOCK SUMMARY -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      ${[['Total',totalBoxes,'var(--text)'],['Available',available,'var(--green)'],['On Hold',heldBoxes,'var(--red)'],['Display',displayBoxes,'#60A5FA']].map(([l,v,c])=>`
      <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
        <div style="font-size:10px;color:var(--text3)">${l}</div>
      </div>`).join('')}
    </div>
    <!-- LOCATIONS -->
    <div style="font-size:12px;font-weight:600;margin-bottom:8px">Stock Locations</div>
    ${(locs||[]).map(l=>`
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;font-weight:600">${l.is_display?'🖼 Display — ':''}${l.warehouse_code||'—'}</div>
        <div style="font-size:11px;color:var(--text3)">Rack ${l.rack_no||'—'} · Shelf ${l.shelf_no||'—'}</div>
        ${l.last_counted_by?`<div style="font-size:10px;color:var(--text3)">Last count: ${l.last_counted_by} · ${l.last_counted_at?new Date(l.last_counted_at).toLocaleDateString('en-IN'):''}</div>`:''}
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700;color:var(--text)">${l.qty_boxes||0} boxes</div>
        ${l.qty_pcs?`<div style="font-size:11px;color:var(--text3)">+${l.qty_pcs} pcs</div>`:''}
      </div>
    </div>`).join('')}
    <!-- HOLDS -->
    ${(holds||[]).length ? `
    <div style="font-size:12px;font-weight:600;margin-bottom:6px;margin-top:10px">Active Holds</div>
    ${(holds||[]).map(h=>`
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px">
      ${h.customer_name} · ${h.boxes_held} boxes · Exp: ${h.hold_expires_at?new Date(h.hold_expires_at).toLocaleDateString('en-IN'):'—'}
    </div>`).join('')}` : ''}
    <!-- ACTIONS -->
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet();VW_TILE_INV.adjustStock(${productId})">+ Add Stock</button>
      <button class="btn-primary" style="flex:1" onclick="closeSheet();VW_TILE_INV.showQR(${productId},'${(p.name||'').replace(/'/g,"\\'")}')">📱 QR Code</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// ===== QR CODE GENERATOR =====
async function showQR(productId, productName) {
  const { data: p } = await VW_DB.client.from('products').select('*,tile_stock_locations(*)').eq('id',productId).single();
  if (!p) return;

  const qrData = p.qr_code || `${window.location.origin}/vwholesale-app/?product_qr=${productId}`;
  const totalBoxes = (p.tile_stock_locations||[]).filter(l=>!l.is_display).reduce((s,l)=>s+(l.qty_boxes||0),0);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">${p.brand} — ${p.name}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${p.tile_size_label||''} · ${p.tile_finish||''}</div>
      <!-- QR CODE (using Google Charts API) -->
      <div style="background:#fff;padding:16px;border-radius:16px;display:inline-block;margin-bottom:12px">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}"
          width="200" height="200" style="display:block">
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">Scan to see live stock & request quotation</div>
      <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:14px;font-size:12px">
        <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Stock Available</span><span style="font-weight:700;color:var(--green)">${totalBoxes} boxes</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0"><span>MRP</span><span style="font-weight:700">₹${(p.mrp||0).toLocaleString('en-IN')}/box</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Coverage</span><span>${p.coverage_per_box||'—'} sqft/box</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" style="flex:1" onclick="VW_TILE_INV.printQR(${productId},'${(p.name||'').replace(/'/g,"\\'")}','${encodeURIComponent(qrData)}')">🖨 Print Label</button>
        <button class="btn-primary" style="flex:1" onclick="navigator.share?navigator.share({title:'${p.brand} ${p.name}',url:'${qrData}'}):navigator.clipboard.writeText('${qrData}').then(()=>showToast('Link copied','success'))">📤 Share</button>
      </div>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function printQR(productId, productName, qrEncoded) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR Label</title>
  <style>body{font-family:Arial;text-align:center;padding:20px} .label{border:2px solid #C8972B;border-radius:12px;padding:16px;display:inline-block;max-width:240px} h3{color:#C8972B;margin:0 0 8px;font-size:14px} @media print{body{padding:0}}</style>
  </head><body>
  <div class="label">
    <h3>V Wholesale</h3>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrEncoded}" width="180" height="180">
    <div style="font-size:13px;font-weight:700;margin-top:8px">${productName}</div>
    <div style="font-size:10px;color:#888;margin-top:4px">Scan for live stock & price</div>
    <div style="font-size:10px;color:#888">V Wholesale · 8712697930</div>
  </div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600); }
}

// ===== PUBLIC QR SCAN PAGE (?product_qr=ID) =====
async function renderProductQRPage(productId) {
  const { data: p } = await VW_DB.client.from('products').select('*,tile_stock_locations(*)').eq('id',productId).single();
  if (!p) return '<div style="padding:40px;text-align:center;color:#888">Product not found</div>';

  const locs = (p.tile_stock_locations||[]).filter(l=>!l.is_display);
  const isStaff = VW_AUTH.getCurrentProfile() !== null;
  // Public visitors can't read warehouse stock-location rows (RLS), so the embed is empty for
  // them — fall back to the product's stock count (anon-readable) so the QR page shows real
  // availability instead of always 0. Staff still see the precise per-location sum.
  const totalBoxes = isStaff ? locs.reduce((s,l)=>s+(l.qty_boxes||0),0) : (p.stock||0);

  return `
  <div style="min-height:100vh;padding:20px;max-width:420px;margin:0 auto">
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #C8972B;margin-bottom:16px">
      <div style="font-size:18px;font-weight:800;color:#C8972B;font-family:sans-serif">V Wholesale</div>
      <div style="font-size:11px;color:#888">Vijayawada · 8712697930</div>
    </div>
    ${p.image_url?`<img src="${p.image_url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:14px">`:
    `<div style="width:100%;height:140px;background:var(--bg2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:14px">🔲</div>`}
    <div style="font-size:18px;font-weight:700;margin-bottom:4px">${p.name}</div>
    <div style="font-size:14px;color:var(--text2);margin-bottom:12px">${p.brand} · ${p.tile_size_label||p.tile_size_mm||''} · ${p.tile_finish||''}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${totalBoxes>10?'var(--green)':totalBoxes>0?'var(--gold)':'var(--red)'}">${totalBoxes}</div>
        <div style="font-size:11px;color:var(--text3)">Boxes Available</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--text)">${p.mrp?'₹'+(p.mrp).toLocaleString('en-IN'):'—'}</div>
        <div style="font-size:11px;color:var(--text3)">Price/Box</div>
      </div>
    </div>
    ${p.coverage_per_box?`<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Coverage: ${p.coverage_per_box} sqft/box · ${p.tiles_per_box||'—'} tiles/box</div>`:''}
    ${isStaff ? `
    <!-- STAFF VIEW: show all locations -->
    <div style="font-size:12px;font-weight:600;margin-bottom:8px">📦 Stock Locations</div>
    ${locs.map(l=>`<div style="font-size:11px;color:var(--text2);padding:4px 0">${l.warehouse_code} · ${l.rack_no||'—'}/${l.shelf_no||'—'} — ${l.qty_boxes} boxes</div>`).join('')}
    ` : `
    <!-- CUSTOMER VIEW -->
    <button onclick="window.open('https://wa.me/918712697930?text='+encodeURIComponent('I want to enquire about: ${p.brand} ${p.name} (${p.tile_size_label||p.tile_size_mm||''})\\n\\nPlease send me price and availability.'),'_blank')"
      style="width:100%;background:#25D366;color:#fff;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">
      💬 Ask about this tile on WhatsApp
    </button>
    <button onclick="VW_TILE_INV.addToWishlistFromQR(${p.id})"
      style="width:100%;background:var(--gold-muted);border:2px solid var(--gold-border);border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;color:var(--gold)">
      ❤️ Add to My Wishlist
    </button>`}
  </div>`;
}

async function addToWishlistFromQR(productId) {
  // Prompt for phone to link to customer account
  const phone = prompt('Enter your phone number to save to wishlist:');
  if (!phone || phone.length < 10) return;
  const { data: cust } = await VW_DB.client.from('customers').select('id,name').ilike('phone','%'+phone.replace(/\D/g,'')+'%').single().catch(()=>({data:null}));
  if (!cust) { showToast('Phone not found — ask executive to add you first','warn'); return; }
  await VW_DB.client.from('wishlists').upsert({ customer_id:cust.id, product_id:productId, created_at:new Date().toISOString() });
  showToast(`Added to wishlist for ${cust.name} ✓`,'success');
}

// ===== EXCEL IMPORT =====
async function showExcelImport() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">📊 Import Tiles from Excel</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.3);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--text2)">
      <strong>Note:</strong> Imported rows are INACTIVE until each product has a live photo and stock count. You can upload photos product-by-product after import.
    </div>
    <div class="form-group"><label>Brand *</label><input type="text" id="xi-brand" placeholder="Brand name for all products in this sheet"></div>
    <div class="form-group">
      <label>Download Template first</label>
      <button onclick="VW_TILE_INV.downloadTileImportTemplate()" class="btn-sm" style="width:100%">⬇️ Download Excel Template</button>
    </div>
    <div class="form-group">
      <label>Upload Filled Excel (.xlsx or .csv)</label>
      <input type="file" id="xi-file" accept=".xlsx,.xls,.csv" onchange="VW_TILE_INV.previewExcelImport(this)">
    </div>
    <div id="xi-preview" style="margin-top:10px"></div>
    <button class="btn-primary full-width" id="xi-import-btn" onclick="VW_TILE_INV.processExcelImport()" style="display:none;margin-top:10px">
      Import Products (Inactive — add photos to activate)
    </button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function downloadTileImportTemplate() {
  const headers = ['Brand','Product Name','Size (mm)','Finish','Description','Tiles Per Box','Sqft Per Box','MRP Per Box','Warehouse','Rack No','Shelf No','Qty Boxes','Qty Pcs','Is Display (Y/N)'];
  const sample = ['TISAN','Pearl White 600x600','600×600','MATT','White marble look',4,16,1200,'VJA_Store','A1','S1',50,0,'N'];
  const csv = [headers.join(','), sample.join(',')].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'V_Wholesale_Tile_Import_Template.csv';
  a.click();
}

async function previewExcelImport(input) {
  const file = input.files?.[0];
  if (!file) return;
  const preview = document.getElementById('xi-preview');
  const importBtn = document.getElementById('xi-import-btn');

  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    const lines = text.split('\n').filter(l=>l.trim());
    const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
    const rows = lines.slice(1).map(l=>l.split(',').map(c=>c.trim().replace(/"/g,'')));
    window._xiRows = rows.map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
    if (preview) preview.innerHTML = `
      <div style="font-size:12px;font-weight:600;margin-bottom:6px">Preview — ${rows.length} products</div>
      ${rows.slice(0,5).map(r=>`<div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">${r[1]||'—'} · ${r[2]||'—'} · ${r[3]||'—'} · ${r[11]||'0'} boxes</div>`).join('')}
      ${rows.length>5?`<div style="font-size:11px;color:var(--text3);margin-top:4px">+${rows.length-5} more rows</div>`:''}`;
    if (importBtn) importBtn.style.display='block';
  } else {
    if (preview) preview.innerHTML='<div style="font-size:12px;color:var(--text3)">📁 File selected — click Import to process</div>';
    if (importBtn) importBtn.style.display='block';
    window._xiFile = file;
  }
}

async function processExcelImport() {
  const brand = document.getElementById('xi-brand')?.value.trim();
  if (!brand) { showToast('Enter brand name first','warn'); return; }
  const rows = window._xiRows || [];
  if (!rows.length) { showToast('No data to import','warn'); return; }

  const profile = VW_AUTH.getCurrentProfile();
  let imported = 0;
  for (const r of rows) {
    try {
      await VW_DB.client.from('products').insert({
        brand: r['Brand']||brand,
        name: r['Product Name']||'Unknown',
        category: 'Tiles',
        tile_size_mm: r['Size (mm)']||'',
        tile_finish: r['Finish']||'',
        description: r['Description']||'',
        tiles_per_box: parseInt(r['Tiles Per Box'])||4,
        coverage_per_box: parseFloat(r['Sqft Per Box'])||null,
        mrp: parseFloat(r['MRP Per Box'])||null,
        stock: 0,
        is_active: false,         // inactive until photo added
        has_live_photo: false,
        added_by: profile?.name||'import',
      });
      imported++;
    } catch(e) { console.log('Import row error:', e.message); }
  }
  await auditLog('excel_import', 'product', null, brand, null, {rows:rows.length, imported}, 'Excel import');
  closeSheet();
  showToast(`${imported} products imported (inactive) — add photos to activate`,'success');
  navigateTo('tile_inventory');
}

// ── WAREHOUSE MANAGEMENT ────────────────────────────────────────────────────

async function showAddWarehouseForm(prefillId, prefillName, prefillCode) {
  const sheet = document.getElementById('bottom-sheet');
  const isEdit = !!prefillId;
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 14px">${isEdit?'✎ Edit':'+ Add'} Warehouse / Location</h3>
    <div class="form-group">
      <label>Location Name *</label>
      <input type="text" id="wh-name" value="${prefillName||''}" placeholder="e.g. VJA Store — Main Floor">
    </div>
    <div class="form-group">
      <label>Code * <span style="font-size:10px;color:var(--text3)">(short, no spaces — used internally)</span></label>
      <input type="text" id="wh-code" value="${prefillCode||''}" placeholder="e.g. VJA_MAIN" ${isEdit?'readonly style="opacity:0.6"':''}>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:1;background:var(--gold);color:#000" onclick="VW_TILE_INV.saveWarehouse(${prefillId||'null'})">💾 Save</button>
    </div>`;
  document.getElementById('bottom-sheet').classList.add('open');
  setTimeout(()=>document.getElementById('wh-name')?.focus(), 80);
}

async function saveWarehouse(id) {
  const name = document.getElementById('wh-name')?.value.trim();
  const code = document.getElementById('wh-code')?.value.trim().toUpperCase().replace(/\s+/g,'_');
  if (!name || !code) return showToast('Name and code required','warn');
  if (id) {
    await VW_DB.client.from('warehouse_locations').update({ name }).eq('id', id);
    showToast('Updated ✓','success');
  } else {
    const maxSort = 100; // will append at end
    await VW_DB.client.from('warehouse_locations').insert({ name, code, sort_order: maxSort, is_active: true });
    showToast('Added ✓','success');
  }
  closeSheet();
  navigateTo('tile_inventory');
}

function editWarehouse(id, name, code) {
  showAddWarehouseForm(id, name, code);
}

async function deleteWarehouse(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone. Stock already assigned to this location will be orphaned.`)) return;
  await VW_DB.client.from('warehouse_locations').update({ is_active: false }).eq('id', id);
  const row = document.getElementById(`wh-row-${id}`);
  if (row) row.remove();
  showToast(`"${name}" removed`,'success');
}

window.VW_TILE_INV = {
  renderTileInventoryPage, filterTileInventory,
  showAddTileForm, onBrandChange, loadRacks, loadShelves,
  matchDesign, previewDesignPics, previewShelfPic,
  mergeWithExisting, saveTileProduct,
  adjustStock, loadRacksForAdj, previewAdjPhoto, saveStockAdjustment,
  openTileDetail, showQR, printQR, renderProductQRPage, addToWishlistFromQR,
  showExcelImport, downloadTileImportTemplate, previewExcelImport, processExcelImport,
  showAddWarehouseForm, saveWarehouse, editWarehouse, deleteWarehouse,
};




/* === non_inventory.js === */
// ══════════════════════════════════════════════════════════════════════════════
// NON-INVENTORY TILES — Catalog upload, AI extraction, verification, quotation
// ══════════════════════════════════════════════════════════════════════════════

const FINISH_OPTIONS = ['Glossy','Matt','Sugar','Carving','Rustic','Lappato','Satin','Polished','Natural'];
const COLOUR_FAMILIES = ['White','Ivory/Cream','Beige','Light Grey','Grey','Dark Grey','Charcoal/Black','Brown','Wood Look','Marble Look','Stone Look','Terracotta','Blue','Green','Other'];
const SURFACE_OPTIONS = [{v:'floor',l:'Floor'},{v:'wall',l:'Wall'},{v:'both',l:'Both'}];

// ─── CATALOG MANAGEMENT PAGE ──────────────────────────────────────────────────
async function renderCatalogUploadPage() {
  const profile = VW_AUTH.getCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  const { data: uploads } = await VW_DB.client
    .from('catalog_uploads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Stats
  const { data: stats } = await VW_DB.client
    .from('non_inventory_tiles')
    .select('status');
  const total = stats?.length || 0;
  const approved = stats?.filter(s=>s.status==='approved').length || 0;
  const draft = stats?.filter(s=>s.status==='draft').length || 0;

  return `
  <div class="module-header">
    <h2>📚 Tile Catalogs</h2>
    ${isAdmin ? `<button class="btn-primary" onclick="VW_NON_INV.showUploadSheet()">+ Upload Catalog</button>` : ''}
  </div>

  <!-- Stats -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">Total Designs</div>
      <div class="mc-value">${total}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Approved</div>
      <div class="mc-value" style="color:var(--green)">${approved}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Pending Review</div>
      <div class="mc-value" style="color:var(--gold)">${draft}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Catalogs Uploaded</div>
      <div class="mc-value">${uploads?.length||0}</div>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto">
    <button class="entry-type-btn active" id="cat-tab-browse" onclick="VW_NON_INV.switchNonInvTab('browse',this)">🔍 Browse Designs</button>
    <button class="entry-type-btn" id="cat-tab-pending" onclick="VW_NON_INV.switchNonInvTab('pending',this)">⏳ Pending Review${draft>0?` <span style="background:var(--gold);color:#000;border-radius:10px;padding:1px 6px;font-size:10px">${draft}</span>`:''}</button>
    <button class="entry-type-btn" id="cat-tab-uploads" onclick="VW_NON_INV.switchNonInvTab('uploads',this)">📤 Uploads</button>
  </div>

  <div id="catalog-tab-content">
    ${await _renderCatalogBrowse()}
  </div>`;
}

async function switchNonInvTab(tab, btn) {
  document.querySelectorAll('[id^="cat-tab-"]').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('catalog-tab-content');
  if (!el) return;
  el.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner"></div></div>';
  if (tab === 'browse')  el.innerHTML = await _renderCatalogBrowse();
  if (tab === 'pending') el.innerHTML = await _renderPendingVerification();
  if (tab === 'uploads') el.innerHTML = await _renderCatalogUploads();
}

// ─── BROWSE DESIGNS (approved non-inventory) ──────────────────────────────────
async function _renderCatalogBrowse(filter={}) {
  let query = VW_DB.client.from('non_inventory_tiles')
    .select('*')
    .eq('status','approved')
    .order('brand')
    .limit(60);

  if (filter.brand) query = query.eq('brand', filter.brand);
  if (filter.size)  query = query.eq('size_mm', filter.size);
  if (filter.surface) query = query.eq('surface_type', filter.surface);

  const { data: tiles } = await query;
  const brands = [...new Set((tiles||[]).map(t=>t.brand))].sort();

  return `
  <!-- Filters -->
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <input type="text" id="cat-search" placeholder="Search design, brand, size..."
      style="flex:1;min-width:150px;font-size:13px"
      oninput="VW_NON_INV.searchCatalog(this.value)">
    <select onchange="VW_NON_INV._filterCatalog('surface',this.value)"
      style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">
      <option value="">All surfaces</option>
      <option value="floor">Floor</option>
      <option value="wall">Wall</option>
    </select>
  </div>

  <!-- Brand groups -->
  ${brands.length === 0 ? `
  <div class="empty-state">
    <div style="font-size:40px;margin-bottom:10px">📚</div>
    <p>No approved designs yet. Upload a catalog to get started.</p>
  </div>` : brands.map(brand => {
    const brandTiles = (tiles||[]).filter(t=>t.brand===brand);
    return `
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;
        padding-bottom:6px;border-bottom:2px solid var(--gold-border)">
        ${brand} <span style="font-size:11px;font-weight:400;color:var(--text3)">${brandTiles.length} designs</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        ${brandTiles.map(t => _renderTileCard(t)).join('')}
      </div>
    </div>`;
  }).join('')}`;
}

function _renderTileCard(t, showAddToQuote=true) {
  return `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer"
    onclick="VW_NON_INV.openNonInvDetail('${t.id}')">
    <!-- Image -->
    <div style="height:120px;background:var(--bg3);position:relative;overflow:hidden">
      ${t.image_url
        ? `<img src="${t.image_url}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display='none'">`
        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">🔲</div>`}
      <div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);border-radius:5px;padding:2px 6px;font-size:10px;color:#fff">
        ${t.size_mm}mm
      </div>
      <div style="position:absolute;bottom:6px;left:6px;background:rgba(245,200,66,0.9);border-radius:5px;padding:2px 6px;font-size:9px;font-weight:700;color:#000">
        📦 On Request
      </div>
    </div>
    <!-- Info -->
    <div style="padding:8px">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${t.design_name||'Unnamed'}</div>
      <div style="font-size:10px;color:var(--text3)">${t.series||''} ${t.finish?'· '+t.finish:''}</div>
      <div style="font-size:10px;color:var(--text3)">${t.colour_family||''} ${t.surface_type?'· '+t.surface_type:''}</div>
      ${showAddToQuote ? `
      <button onclick="event.stopPropagation();VW_NON_INV.addToActiveQuote('${t.id}')"
        style="margin-top:6px;width:100%;padding:5px;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:7px;font-size:11px;font-weight:700;color:var(--gold);cursor:pointer">
        + Add to Quote
      </button>` : ''}
    </div>
  </div>`;
}

async function searchCatalog(q) {
  if (!q || q.length < 2) {
    const el = document.getElementById('catalog-tab-content');
    if (el) el.innerHTML = await _renderCatalogBrowse();
    return;
  }
  const { data } = await VW_DB.client.from('non_inventory_tiles')
    .select('*')
    .eq('status','approved')
    .or(`design_name.ilike.%${q}%,brand.ilike.%${q}%,series.ilike.%${q}%,colour_family.ilike.%${q}%`)
    .limit(40);
  const el = document.getElementById('catalog-tab-content');
  if (el) el.innerHTML = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text3)">${(data||[]).length} results for "${q}"</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
      ${(data||[]).map(t=>_renderTileCard(t)).join('')}
    </div>`;
}

// ─── PENDING VERIFICATION ─────────────────────────────────────────────────────
async function _renderPendingVerification() {
  const { data: drafts } = await VW_DB.client
    .from('non_inventory_tiles')
    .select('*, catalog_uploads(brand, file_name)')
    .eq('status','draft')
    .order('created_at', { ascending: false });

  if (!drafts?.length) return `<div class="empty-state"><p>No pending items — all verified ✅</p></div>`;

  // Group by catalog
  const byCatalog = {};
  drafts.forEach(t => {
    const key = t.catalog_id || 'manual';
    const label = t.catalog_uploads?.file_name || 'Manual Entry';
    if (!byCatalog[key]) byCatalog[key] = { label, tiles:[] };
    byCatalog[key].tiles.push(t);
  });

  return `
  <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:12px;color:var(--text3)">${drafts.length} designs awaiting review</div>
    <button onclick="VW_NON_INV.bulkApproveVisible()" class="btn-sm" style="background:var(--gold);color:#000">
      ✅ Approve All Visible
    </button>
  </div>
  ${Object.entries(byCatalog).map(([key, group]) => `
  <div style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">
      📤 ${group.label} · ${group.tiles.length} designs
    </div>
    ${group.tiles.map(t => `
    <div id="draft-${t.id}" style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
      <div style="display:flex;gap:10px">
        <!-- Thumbnail -->
        <div style="width:80px;height:80px;background:var(--bg3);border-radius:8px;flex-shrink:0;overflow:hidden">
          ${t.image_url
            ? `<img src="${t.image_url}" style="width:100%;height:100%;object-fit:cover">`
            : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">🔲</div>`}
        </div>
        <!-- Extracted fields (editable inline) -->
        <div style="flex:1;min-width:0">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
            <div>
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Brand</div>
              <input type="text" value="${t.brand||''}" id="f-brand-${t.id}"
                style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Size (mm)</div>
              <input type="text" value="${t.size_mm||''}" id="f-size-${t.id}"
                style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Design Name</div>
              <input type="text" value="${t.design_name||''}" id="f-name-${t.id}"
                style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Series</div>
              <input type="text" value="${t.series||''}" id="f-series-${t.id}"
                style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:12px;color:var(--text)">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
            <div>
              <div style="font-size:9px;color:var(--text3);margin-bottom:2px">Finish</div>
              <select id="f-finish-${t.id}"
                style="width:100%;padding:4px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--text)">
                ${FINISH_OPTIONS.map(f=>`<option ${t.finish===f?'selected':''}>${f}</option>`).join('')}
              </select>
            </div>
            <div>
              <div style="font-size:9px;color:var(--text3);margin-bottom:2px">Colour</div>
              <select id="f-colour-${t.id}"
                style="width:100%;padding:4px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--text)">
                ${COLOUR_FAMILIES.map(c=>`<option ${t.colour_family===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <div style="font-size:9px;color:var(--text3);margin-bottom:2px">Surface</div>
              <select id="f-surface-${t.id}"
                style="width:100%;padding:4px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--text)">
                ${SURFACE_OPTIONS.map(s=>`<option value="${s.v}" ${t.surface_type===s.v?'selected':''}>${s.l}</option>`).join('')}
              </select>
            </div>
          </div>
          <!-- Actions -->
          <div style="display:flex;gap:6px">
            <button onclick="VW_NON_INV.approveDraft('${t.id}')"
              style="flex:2;padding:6px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.4);border-radius:7px;font-size:12px;font-weight:700;color:var(--green);cursor:pointer">
              ✅ Approve
            </button>
            <button onclick="VW_NON_INV.rejectDraft('${t.id}')"
              style="flex:1;padding:6px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;font-size:12px;color:var(--red);cursor:pointer">
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>`).join('')}`;
}

async function approveDraft(id) {
  const updates = {
    brand:        document.getElementById(`f-brand-${id}`)?.value?.trim(),
    design_name:  document.getElementById(`f-name-${id}`)?.value?.trim(),
    series:       document.getElementById(`f-series-${id}`)?.value?.trim(),
    size_mm:      document.getElementById(`f-size-${id}`)?.value?.trim(),
    finish:       document.getElementById(`f-finish-${id}`)?.value,
    colour_family:document.getElementById(`f-colour-${id}`)?.value,
    surface_type: document.getElementById(`f-surface-${id}`)?.value,
    status: 'approved',
    verified_at: new Date().toISOString(),
  };
  if (!updates.brand || !updates.design_name) { showToast('Brand and Design Name are required','warn'); return; }
  const { error } = await VW_DB.client.from('non_inventory_tiles').update(updates).eq('id', id);
  if (error) { showToast('Error approving: ' + error.message, 'error'); return; }
  const row = document.getElementById(`draft-${id}`);
  if (row) {
    row.style.background = 'rgba(34,197,94,0.06)';
    row.style.border = '1px solid rgba(34,197,94,0.3)';
    row.innerHTML = `<div style="padding:8px;font-size:12px;color:var(--green)">✅ Approved — ${updates.design_name} (${updates.size_mm}mm)</div>`;
  }
  showToast(`${updates.design_name} approved ✓`, 'success');
}

async function rejectDraft(id) {
  if (!confirm('Delete this draft tile?')) return;
  await VW_DB.client.from('non_inventory_tiles').delete().eq('id', id);
  const row = document.getElementById(`draft-${id}`);
  if (row) row.remove();
  showToast('Deleted', 'info');
}

async function bulkApproveVisible() {
  const buttons = document.querySelectorAll('[id^="draft-"] button[onclick*="approveDraft"]');
  let count = 0;
  for (const btn of buttons) {
    const id = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
    if (id) { await approveDraft(id); count++; }
  }
  showToast(`${count} designs approved ✓`, 'success');
}

// ─── CATALOG UPLOADS LIST ─────────────────────────────────────────────────────
async function _renderCatalogUploads() {
  const { data: uploads } = await VW_DB.client
    .from('catalog_uploads')
    .select('*')
    .order('created_at', { ascending: false });

  return `
  <button class="btn-primary" style="margin-bottom:12px" onclick="VW_NON_INV.showUploadSheet()">
    + Upload New Catalog
  </button>
  ${(uploads||[]).length === 0 ? '<div class="empty-state"><p>No catalogs uploaded yet</p></div>' :
  (uploads||[]).map(u => `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:13px;font-weight:700">${u.brand}</div>
        <div style="font-size:11px;color:var(--text3)">${u.file_name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${u.tiles_extracted||0} extracted · ${u.tiles_approved||0} approved
        </div>
      </div>
      <span style="font-size:11px;padding:3px 8px;border-radius:6px;
        background:${u.status==='completed'?'rgba(34,197,94,0.1)':u.status==='processing'?'rgba(245,200,66,0.1)':'var(--bg3)'};
        color:${u.status==='completed'?'var(--green)':u.status==='processing'?'var(--gold)':'var(--text3)'}">
        ${u.status}
      </span>
    </div>
  </div>`).join('')}`;
}

// ─── UPLOAD SHEET ─────────────────────────────────────────────────────────────
function showUploadSheet() {
  const sheet = document.getElementById('bottom-sheet');
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">📤 Upload Catalog</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group">
      <label>Brand Name *</label>
      <input type="text" id="up-brand" placeholder="e.g. Kajaria, RAK, Somany, TISAN">
    </div>
    <div class="form-group">
      <label>Catalog File (PDF or Images) *</label>
      <input type="file" id="up-file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple style="padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;width:100%;color:var(--text);font-size:13px">
      <div style="font-size:11px;color:var(--text3);margin-top:4px">
        PDF (multi-page catalog) or multiple image files
      </div>
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <input type="text" id="up-notes" placeholder="e.g. FY2025 catalog, premium range only">
    </div>
    <div id="up-status" style="display:none;padding:10px;background:var(--bg2);border-radius:8px;font-size:12px;margin-bottom:10px"></div>
    <button class="btn-primary full-width" onclick="VW_NON_INV.processCatalogUpload()">
      🤖 Upload & Extract with AI
    </button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay')?.classList.add('open');
}

async function processCatalogUpload() {
  const brand = document.getElementById('up-brand')?.value?.trim();
  const files = document.getElementById('up-file')?.files;
  const notes = document.getElementById('up-notes')?.value?.trim();
  const statusEl = document.getElementById('up-status');

  if (!brand) { showToast('Enter brand name', 'warn'); return; }
  if (!files?.length) { showToast('Select at least one file', 'warn'); return; }

  const btn = document.querySelector('#bottom-sheet .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing...'; }
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Creating catalog record...'; }

  try {
    // Create catalog upload record
    const { data: catalog, error: catErr } = await VW_DB.client
      .from('catalog_uploads')
      .insert({ brand, file_name: files[0].name, file_type: files[0].type, status: 'processing', notes })
      .select().single();
    if (catErr) throw catErr;

    if (statusEl) statusEl.textContent = `Processing ${files.length} file(s) with AI...`;

    let totalExtracted = 0;

    // Process each file
    for (let i=0; i<files.length; i++) {
      const file = files[i];
      if (statusEl) statusEl.textContent = `Extracting from file ${i+1}/${files.length}: ${file.name}...`;

      const extracted = await _extractTilesFromFile(file, brand, catalog.id);
      totalExtracted += extracted;

      if (statusEl) statusEl.textContent = `File ${i+1}/${files.length}: Found ${extracted} designs`;
    }

    // Update catalog record
    await VW_DB.client.from('catalog_uploads').update({
      status: 'extracted',
      tiles_extracted: totalExtracted,
    }).eq('id', catalog.id);

    if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✅ Done! ${totalExtracted} designs extracted and ready for review.</span>`;
    showToast(`${totalExtracted} designs extracted → go to Pending Review`, 'success');
    if (btn) { btn.textContent = 'Close'; btn.disabled = false; btn.onclick = closeSheet; }

  } catch(e) {
    console.error('Upload error:', e);
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    if (btn) { btn.disabled = false; btn.textContent = 'Try Again'; }
    showToast('Upload failed: ' + e.message, 'error');
  }
}

async function _extractTilesFromFile(file, brand, catalogId) {
  // Convert file to base64 for Claude API
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mediaType = file.type || 'image/jpeg';
  const isPDF = mediaType === 'application/pdf';

  // Save the source file to the catalogs bucket so each design shows an image
  let imageUrl = null;
  try {
    const ext = (file.name.split('.').pop() || (isPDF ? 'pdf' : 'jpg')).toLowerCase();
    const path = `tile-designs/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error: upErr } = await sb.storage.from('catalogs').upload(path, file, { contentType: mediaType, upsert: false });
    if (!upErr) {
      const { data: urlData } = sb.storage.from('catalogs').getPublicUrl(path);
      imageUrl = urlData?.publicUrl || null;
    } else { console.warn('catalog image upload error:', upErr.message); }
  } catch(e) { console.warn('catalog image upload failed:', e); }

  // Call Claude API with vision to extract tile designs
  const prompt = `You are analyzing a tile catalog page. Extract ALL tile designs visible.

For each tile design found, provide:
- design_name: the design/pattern name (e.g. "Carrara White", "Wood Ash")
- sku_code: product code if visible (e.g. "KVF-601")
- series: collection/series name if visible
- size_mm: tile size in format "600×600" or "300×450" (use × not x)
- finish: one of Glossy/Matt/Sugar/Carving/Rustic/Lappato/Satin/Polished/Natural
- colour_family: one of White/Ivory-Cream/Beige/Light Grey/Grey/Dark Grey/Charcoal-Black/Brown/Wood Look/Marble Look/Stone Look/Terracotta/Blue/Green/Other
- surface_type: floor/wall/both

Return ONLY a JSON array. No explanation. No markdown.
Example: [{"design_name":"Carrara White","sku_code":"KVF-601","series":"Marble Marvel","size_mm":"600×600","finish":"Glossy","colour_family":"White","surface_type":"floor"}]

If you cannot determine a field, use null. Extract every tile you can see.`;

  // Route through the tile-catalog-ocr edge function (server-side AI proxy).
  // The browser cannot call the AI API directly — no key, and blocked by CORS.
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/tile-catalog-ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ base64, mediaType, isPDF, prompt })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Extraction service failed');
  // Edge function returns {data:[...]} (parsed) or {text:"..."} (raw)
  const text = Array.isArray(data.data) ? JSON.stringify(data.data) : (data.text || '[]');

  let tiles = [];
  try {
    const clean = text.replace(/```json\n?|```/g, '').trim();
    tiles = JSON.parse(clean);
  } catch(e) {
    console.error('Parse error:', e, 'Raw:', text.slice(0,200));
    tiles = [];
  }

  // Save extracted tiles to DB
  if (tiles.length > 0) {
    const rows = tiles.map(t => ({
      brand,
      catalog_id: catalogId,
      design_name: t.design_name || 'Unknown Design',
      sku_code:    t.sku_code || null,
      series:      t.series || null,
      size_mm:     t.size_mm || '600×600',
      finish:      t.finish || null,
      colour_family: t.colour_family || null,
      surface_type: t.surface_type || 'both',
      image_url:        isPDF ? null : imageUrl,
      catalog_page_url: imageUrl,
      status: 'draft',
      extracted_by: 'ai',
    }));

    const { error } = await VW_DB.client.from('non_inventory_tiles').insert(rows);
    if (error) console.error('DB insert error:', error);
  }
  _logApiUsage('catalog_ocr', { success:true, meta:{ tiles_extracted:tiles.length } });
  return tiles.length;
}

// ─── TILE DETAIL SHEET ────────────────────────────────────────────────────────
async function openNonInvDetail(id) {
  const { data: t } = await VW_DB.client.from('non_inventory_tiles').select('*').eq('id',id).single();
  if (!t) return;
  const sheet = document.getElementById('bottom-sheet');
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">${t.design_name}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    ${t.image_url ? `<img src="${t.image_url}" style="width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:12px">` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      ${[
        ['Brand', t.brand],
        ['Size', t.size_mm+'mm'],
        ['Series', t.series||'—'],
        ['SKU', t.sku_code||'—'],
        ['Finish', t.finish||'—'],
        ['Colour', t.colour_family||'—'],
        ['Surface', t.surface_type||'—'],
        ['Lead Time', (t.lead_time_days||18)+' days'],
      ].map(([k,v])=>`
      <div style="background:var(--bg2);border-radius:8px;padding:8px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase">${k}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${v}</div>
      </div>`).join('')}
    </div>
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--text2)">
      📦 Available on Request · Estimated delivery: ${t.lead_time_days||18} days from order confirmation
    </div>
    <button class="btn-primary full-width" onclick="VW_NON_INV.addToActiveQuote('${t.id}');closeSheet()">
      + Add to Active Quotation
    </button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_NON_INV.addCatalogTileToInventory('${t.id}')">
      📦 Add to Inventory
    </button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay')?.classList.add('open');
}

// ─── ADD TO ACTIVE QUOTE ──────────────────────────────────────────────────────
async function addToActiveQuote(tileId) {
  // Check if there's an active tile quotation in progress
  if (!window._tqState || !window._tqState.rooms?.length) {
    showToast('Start a tile quotation first, then add from catalog', 'warn');
    return;
  }
  const { data: t } = await VW_DB.client.from('non_inventory_tiles').select('*').eq('id',tileId).single();
  if (!t) return;

  // Convert non-inventory tile to the format expected by _tqState.tileSelections
  const syntheticProduct = {
    id: 'ni_' + t.id,
    name: `${t.brand} ${t.design_name}`,
    brand: t.brand,
    tile_size_mm: t.size_mm,
    tile_finish: t.finish,
    colour_family: t.colour_family,
    surface_type: t.surface_type,
    is_non_inventory: true,
    non_inventory_id: t.id,
    lead_time_days: t.lead_time_days || 18,
    image_url: t.image_url,
    price: 0, // manual pricing
    coverage_per_box: null, // calculated from size
  };

  // Set as selected product for all pending slots
  window._tqState.selectedProduct = syntheticProduct;
  window._tqState._isNonInventory = true;

  showToast(`${t.brand} ${t.design_name} added to quotation`, 'success');
  // Navigate back to quotation if on catalog page
  if (window.currentPage === 'catalogs') navigateTo('tiles');
}

// ─── FETCH FOR QUOTATION (stock + non-inventory) ──────────────────────────────
async function fetchTilesForQuotation(sizeMm, surfaceType) {
  // Fetch from actual inventory
  const { data: stockTiles } = await VW_DB.client
    .from('products')
    .select('*')
    .eq('tile_size_mm', sizeMm)
    .gt('stock_quantity', 0)
    .order('brand');

  // Fetch from non-inventory (approved, matching size)
  let niQuery = VW_DB.client
    .from('non_inventory_tiles')
    .select('*')
    .eq('status','approved')
    .eq('size_mm', sizeMm);
  if (surfaceType && surfaceType !== 'both') {
    niQuery = niQuery.or(`surface_type.eq.${surfaceType},surface_type.eq.both`);
  }
  const { data: niTiles } = await niQuery.order('brand');

  return {
    inStock: stockTiles || [],
    onRequest: (niTiles || []).map(t => ({
      ...t,
      id: 'ni_' + t.id,
      name: `${t.brand} ${t.design_name}`,
      is_non_inventory: true,
      lead_time_days: t.lead_time_days || 18,
    }))
  };
}

// ─── ADD CATALOG TILE TO MAIN INVENTORY ──────────────────────────────────────
// Takes an extracted catalog tile and creates a proper inventory product entry.
// Staff can set the price and stock qty — the design/spec fields come from catalog.
async function addCatalogTileToInventory(tileId) {
  const { data: t } = await VW_DB.client.from('non_inventory_tiles').select('*').eq('id', tileId).single();
  if (!t) { showToast('Tile not found', 'warn'); return; }

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin-bottom:14px">📦 Add to Inventory</h3>
    <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px">
      <div style="font-weight:700;font-size:13px">${t.brand||''} ${t.design_name||''}</div>
      <div style="color:var(--text3);margin-top:3px">${t.size_mm||''} · ${t.finish||''} · ${t.colour_family||''}</div>
      ${t.sku_code?`<div style="color:var(--text3)">SKU: ${t.sku_code}</div>`:''}
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Selling Price / sqft (₹) *</label><input type="number" id="cti-price" placeholder="e.g. 85" min="1" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Opening Stock (boxes)</label><input type="number" id="cti-stock" value="0" min="0" step="1"></div>
    </div>
    <div class="form-group"><label>Low Stock Alert (boxes)</label><input type="number" id="cti-threshold" value="5" min="0" step="1"></div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:2" onclick="VW_NON_INV._confirmAddToInventory(${tileId})">📦 Add to Inventory</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay')?.classList.add('open');
}

async function _confirmAddToInventory(tileId) {
  const price = parseFloat(document.getElementById('cti-price')?.value||0);
  if (!price) { showToast('Enter selling price', 'warn'); return; }
  const stock = parseInt(document.getElementById('cti-stock')?.value||0);
  const threshold = parseInt(document.getElementById('cti-threshold')?.value||5);

  const { data: t } = await VW_DB.client.from('non_inventory_tiles').select('*').eq('id', tileId).single();
  if (!t) return;

  // Derive sqft per box from size
  const [mmL, mmW] = (t.size_mm||'600×600').split(/[×x]/).map(Number);
  const sqftPerTile = mmL && mmW ? tileSqftPerTile(mmL, mmW) : 4;
  const tilesPerBox = sqftPerTile < 1.5 ? 10 : sqftPerTile < 2.5 ? 6 : sqftPerTile < 5 ? 4 : 2;
  const coveragePerBox = +(sqftPerTile * tilesPerBox).toFixed(2);
  const boxPrice = +(price * coveragePerBox).toFixed(0);

  const newProduct = {
    name: `${t.brand||''} ${t.design_name||''}`.trim(),
    category: 'Tiles',
    brand: t.brand || '',
    model: t.sku_code || t.series || '',
    tile_size_mm: t.size_mm || '600×600',
    tile_finish: t.finish || '',
    colour_family: t.colour_family || '',
    surface_type: t.surface_type || 'both',
    price: boxPrice,
    price_per_sqft: price,
    coverage_per_box: coveragePerBox,
    tiles_per_box: tilesPerBox,
    stock: stock,
    lowStockThreshold: threshold,
    image_url: t.image_url || '',
    is_active: true,
    source: 'catalog_import',
    catalog_tile_id: tileId,
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await VW_DB.client.from('products').insert(newProduct).select('id').single();
  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  // Mark the catalog tile as imported
  await VW_DB.client.from('non_inventory_tiles').update({ status:'imported', inventory_product_id:data.id }).eq('id', tileId);

  closeSheet();
  showToast(`${newProduct.name} added to Inventory (ID ${data.id}) ✓`, 'success');
  navigateTo('inventory');
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
window.VW_NON_INV = {
  renderCatalogUploadPage,
  switchNonInvTab,
  searchCatalog,
  _filterCatalog: async (field, val) => {
    const el = document.getElementById('catalog-tab-content');
    if (el) el.innerHTML = await _renderCatalogBrowse({ [field]: val });
  },
  showUploadSheet,
  processCatalogUpload,
  openNonInvDetail,
  addToActiveQuote,
  addCatalogTileToInventory,
  _confirmAddToInventory,
  approveDraft,
  rejectDraft,
};

async function openProductPricingTab(id) {
  const { data: p } = await VW_DB.client.from('products').select('*').eq('id', id).single();
  if (!p) { showToast('Product not found', 'warn'); return; }

  const role = profile?.role;
  const canSeeCost  = ['admin','management','category_manager','purchase_manager'].includes(role);
  const canEditTiers = ['admin','management','category_manager'].includes(role);

  // Compute landed cost from stored build-up
  function calcLanded(basic, transport, transportType, insurance, insuranceType, other, otherType) {
    const t = transportType==='percent' ? (basic||0)*(transport||0)/100 : (transport||0);
    const i = insuranceType==='percent' ? (basic||0)*(insurance||0)/100 : (insurance||0);
    const o = otherType==='percent'     ? (basic||0)*(other||0)/100     : (other||0);
    return (basic||0) + t + i + o;
  }

  const landed = p.landed_cost || calcLanded(p.cost_basic, p.cost_transport, p.cost_transport_type, p.cost_insurance, p.cost_insurance_type, p.cost_other, p.cost_other_type);

  document.getElementById('bottom-sheet').innerHTML = `
  <div class="sheet-handle"></div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <button onclick="openProduct(${id})" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text3)">←</button>
    <h3 style="margin:0;flex:1">💰 Pricing — ${p.name}</h3>
  </div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:14px">${p.category} · ${p.brand||''} · ${p.unit||'unit'}</div>

  ${canSeeCost ? `
  <!-- COST BUILD-UP -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--text2)">📦 Cost Build-Up (Purchase Team)</div>

    <div style="margin-bottom:8px">
      <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Basic Price (₹ from supplier)</label>
      <input type="number" id="pt-basic" value="${p.cost_basic||''}" placeholder="e.g. 850" step="0.01"
        style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--bg3);box-sizing:border-box"
        oninput="updateLandedPreview()">
    </div>

    ${[
      ['Transport', 'transport'],
      ['Insurance', 'insurance'],
      ['Other Charges', 'other'],
    ].map(([label, key]) => `
    <div style="display:grid;grid-template-columns:1fr auto 80px;gap:6px;align-items:center;margin-bottom:8px">
      <div>
        <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">${label}</label>
        <input type="number" id="pt-${key}" value="${p['cost_'+key]||''}" placeholder="0" step="0.01"
          style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--bg3);box-sizing:border-box"
          oninput="updateLandedPreview()">
      </div>
      <div style="padding-top:16px;font-size:11px;color:var(--text3)">as</div>
      <div>
        <label style="font-size:10px;color:transparent;display:block;margin-bottom:3px">.</label>
        <select id="pt-${key}-type" onchange="updateLandedPreview()"
          style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--bg3);font-size:12px">
          <option value="fixed" ${(p['cost_'+key+'_type']||'fixed')==='fixed'?'selected':''}>₹ Fixed</option>
          <option value="percent" ${p['cost_'+key+'_type']==='percent'?'selected':''}>% of Basic</option>
        </select>
      </div>
    </div>`).join('')}

    <div id="pt-landed-preview" style="background:var(--bg3);border-radius:8px;padding:8px;margin-top:4px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:700;color:var(--text2)">Landed Cost</span>
      <span id="pt-landed-val" style="font-size:15px;font-weight:800;color:var(--gold)">₹${landed>0?landed.toLocaleString('en-IN'):'—'}</span>
    </div>
  </div>` : ''}

  <!-- SELLING PRICES -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--text2)">🏷️ Selling Prices</div>

    ${[
      ['MRP', 'mrp', 'Market Retail Price — printed on product', false],
      ['VWP (V Wholesale Price)', 'vwp', 'What exec shows customer — default selling price', canEditTiers],
      ['Tier 1', 'tier1_price', 'TL can approve this discount', canEditTiers],
      ['Tier 2', 'tier2_price', 'Floor Manager can approve', canEditTiers],
      ['Tier 3', 'tier3_price', 'Store Manager can approve', canEditTiers],
      ['Tier 4', 'tier4_price', 'Management only — maximum discount', canEditTiers],
    ].map(([label, field, hint, editable]) => {
      const val = p[field] || '';
      const mrp = p.mrp || 0;
      const vwp = p.vwp || 0;
      const priceVal = p[field] || 0;
      const margin = landed > 0 && priceVal > 0 ? ((priceVal - landed)/landed*100).toFixed(1) : null;
      const discVsMrp = mrp > 0 && priceVal > 0 && field !== 'mrp' ? ((mrp - priceVal)/mrp*100).toFixed(1) : null;
      return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <label style="font-size:11px;font-weight:700;color:${field==='vwp'?'var(--gold)':'var(--text2)'}">${label}</label>
          <div style="font-size:10px;color:var(--text3)">${margin?`${margin}% margin`:''}${discVsMrp?` · ${discVsMrp}% off MRP`:''}</div>
        </div>
        <input type="number" id="pt-${field}" value="${val}" placeholder="₹" step="0.01" ${!editable && !['admin','management'].includes(role)?'disabled':''}
          style="width:100%;padding:8px;border:${field==='vwp'?'1.5px solid var(--gold-border)':'1px solid var(--border)'};border-radius:7px;background:var(--bg3);color:${field==='vwp'?'var(--gold)':'var(--text)'};font-size:${field==='vwp'?14:13}px;font-weight:${field==='vwp'?700:400};box-sizing:border-box;${!editable && !['admin','management'].includes(role)?'opacity:0.5':''};"
          oninput="updateMarginPreview('${field}','${landed||0}','${mrp||0}')">
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${hint}</div>
      </div>`;
    }).join('')}

    <div id="pt-margin-warning" style="display:none;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px;margin-top:8px;font-size:11px;color:var(--red)">
      ⚠️ VWP margin is below 15% — Management approval required before this price goes live.
    </div>
  </div>

  <div style="display:flex;gap:8px">
    <button onclick="saveProductPricing(${id})" style="flex:2;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:800;cursor:pointer">
      💾 Save Pricing
    </button>
    <button onclick="openProduct(${id})" style="flex:1;padding:13px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">
      Cancel
    </button>
  </div>
  ${p.pricing_needs_approval && ['admin','management'].includes(profile?.role) ? `
  <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;margin-top:10px">
    <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ Awaiting Management Approval</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">VWP margin is ${p.margin_vwp?.toFixed(1)||'?'}% — below 15% threshold. As Management, you can approve this pricing or reject it.</div>
    <div style="display:flex;gap:8px">
      <button onclick="approveProductPricing(${id})" style="flex:1;padding:10px;border-radius:8px;background:rgba(34,197,94,0.1);border:2px solid var(--green);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">
        ✅ Approve Pricing
      </button>
      <button onclick="rejectProductPricing(${id})" style="flex:1;padding:10px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.4);color:var(--red);font-size:12px;font-weight:700;cursor:pointer">
        ❌ Reject
      </button>
    </div>
  </div>` : ''}`;

  // Inject live calc scripts
  const s = document.createElement('script');
  s.textContent = `
    function updateLandedPreview() {
      const basic = parseFloat(document.getElementById('pt-basic')?.value)||0;
      function getCharge(id) {
        const v = parseFloat(document.getElementById('pt-'+id)?.value)||0;
        const t = document.getElementById('pt-'+id+'-type')?.value;
        return t==='percent' ? basic*v/100 : v;
      }
      const landed = basic + getCharge('transport') + getCharge('insurance') + getCharge('other');
      const el = document.getElementById('pt-landed-val');
      if (el) el.textContent = landed>0 ? '₹'+Math.round(landed).toLocaleString('en-IN') : '—';
      // Update VWP margin
      const vwp = parseFloat(document.getElementById('pt-vwp')?.value)||0;
      if (vwp>0 && landed>0) {
        const margin = ((vwp-landed)/landed*100);
        const warn = document.getElementById('pt-margin-warning');
        if (warn) warn.style.display = margin<15 ? 'block' : 'none';
      }
    }
    function updateMarginPreview(field, landed, mrp) {
      landed = parseFloat(landed)||0;
      mrp = parseFloat(mrp)||0;
      const val = parseFloat(document.getElementById('pt-'+field)?.value)||0;
      if (field==='vwp' && landed>0 && val>0) {
        const margin = ((val-landed)/landed*100);
        const warn = document.getElementById('pt-margin-warning');
        if (warn) warn.style.display = margin<15 ? 'block' : 'none';
      }
    }
    updateLandedPreview();
  `;
  document.body.appendChild(s);
}

async function approveProductPricing(id) {
  const prof = VW_AUTH.getCurrentProfile();
  const { error } = await VW_DB.client.from('products').update({
    pricing_needs_approval: false,
    pricing_approved_by: prof?.id || null,
    pricing_approved_at: new Date().toISOString(),
    pricing_note: `Approved by ${prof?.name||'Management'} on ${new Date().toLocaleDateString('en-IN')}`,
  }).eq('id', id);
  if (error) { showToast('Error: '+error.message, 'error'); return; }
  showToast('Pricing approved ✅ — VWP is now live', 'success');
  openProduct(id);
}

async function rejectProductPricing(id) {
  const reason = prompt('Reason for rejecting this pricing?');
  if (!reason) return;
  const prof = VW_AUTH.getCurrentProfile();
  await VW_DB.client.from('products').update({
    pricing_needs_approval: false,
    pricing_note: `Rejected by ${prof?.name||'Management'}: ${reason}`,
    // Reset VWP to null so it can't be shown until re-set with valid margin
    vwp: null,
  }).eq('id', id);
  showToast('Pricing rejected — Category Manager will be notified', 'warn');
  // Notify Category Manager
  try {
    const { data: cms } = await VW_DB.client.from('profiles')
      .select('id').in('role',['category_manager','admin']).eq('status','approved');
    for (const cm of cms||[]) {
      await createPersistedNotification({
        category: 'pricing_rejected',
        title: `❌ Pricing Rejected for Product #${id}`,
        body: `${prof?.name||'Management'}: "${reason}" — Please revise VWP to achieve >15% margin`,
        recipientId: cm.id,
        relatedTable: 'products',
        relatedId: id,
        actions: [{ label: '✏️ Revise Pricing', action: 'open_product_pricing' }],
      }).catch(()=>{});
    }
  } catch(_) {}
  openProduct(id);
}
  const getVal = (eid) => { const el = document.getElementById(eid); return el && !el.disabled ? (parseFloat(el.value)||null) : undefined; };
  const getStr = (eid) => { const el = document.getElementById(eid); return el ? el.value : undefined; };

  const basic     = getVal('pt-basic');
  const transport = getVal('pt-transport');
  const tType     = getStr('pt-transport-type');
  const insurance = getVal('pt-insurance');
  const iType     = getStr('pt-insurance-type');
  const other     = getVal('pt-other');
  const oType     = getStr('pt-other-type');

  // Compute landed cost
  const t = tType==='percent' ? (basic||0)*(transport||0)/100 : (transport||0);
  const ins = iType==='percent' ? (basic||0)*(insurance||0)/100 : (insurance||0);
  const o = oType==='percent' ? (basic||0)*(other||0)/100 : (other||0);
  const landed = basic!=null ? (basic||0)+t+ins+o : null;

  const update = {};
  if (basic!=null)     { update.cost_basic=basic; update.cost_transport=transport; update.cost_transport_type=tType; update.cost_insurance=insurance; update.cost_insurance_type=iType; update.cost_other=other; update.cost_other_type=oType; }
  if (landed!=null && landed>0) update.landed_cost = landed;

  ['mrp','vwp','tier1_price','tier2_price','tier3_price','tier4_price'].forEach(f => {
    const v = getVal('pt-'+f);
    if (v !== undefined) update[f] = v;
  });

  // VWP becomes the main price for all non-pricing-tab usage
  if (update.vwp) update.price = update.vwp;

  const { error } = await VW_DB.client.from('products').update(update).eq('id', id);
  if (error) { showToast('Error saving pricing: '+error.message, 'error'); return; }

  // Check if pricing_needs_approval was set by trigger
  const { data: updated } = await VW_DB.client.from('products').select('pricing_needs_approval,margin_vwp').eq('id',id).single();
  if (updated?.pricing_needs_approval) {
    showToast('⚠️ Margin below 15% — Management approval required', 'warn');
    // Notify management via in-app notification
    await createPersistedNotification({
      category: 'pricing_approval',
      title: `💰 Pricing Approval Needed`,
      body: `${profile?.name||'Category Manager'} set VWP margin to ${updated.margin_vwp}% on product #${id} — below 15% threshold`,
      relatedTable: 'products',
      relatedId: id,
      actions: [{ label: '👁 Review Pricing', action: 'open_product_pricing' }],
    }).catch(()=>{});
  } else {
    showToast('Pricing saved ✅', 'success');
  }
  openProduct(id);
}


