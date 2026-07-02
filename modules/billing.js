/* === cart.js === */

let activeCart = { customerId: null, visitId: null, items: [], saleType: 'cash', quotationAdvance: 0 };

function clearCartCustomer() {
  activeCart.customerId = null;
  navigateTo('cart');
}
window.clearCartCustomer = clearCartCustomer;

async function renderCart(customerId = null, visitId = null) {
  if (customerId) { activeCart.customerId = customerId; activeCart.visitId = visitId; }
  const products = await VW_DB.all(VW_DB.STORES.products);
  const categories = [...new Set(products.map(p => p.category))];
  const customer = activeCart.customerId ? await VW_DB.getById(VW_DB.STORES.customers, activeCart.customerId) : null;
  const profile = VW_AUTH.getCurrentProfile();

  // For cashier: load all executives and staff to pick from
  // For executive: pre-populate with their own name
  const isExecRole = profile && ['executive','reception'].includes(profile.role);
  const isAdmin = VW_AUTH.isAdmin();
  let salesExecOptions = '';
  if (!isExecRole) {
    const [staff, execs] = await Promise.all([
      VW_DB.all(VW_DB.STORES.staff),
      VW_DB.all(VW_DB.STORES.executives)
    ]);
    const all = [
      ...execs.map(e => ({ id: 'exec-'+e.id, name: e.name, role: 'Executive' })),
      ...staff.filter(s => s.role === 'executive' || s.team === 'TL').map(s => ({ id: 'staff-'+s.id, name: s.name, role: s.team||'Staff' }))
    ];
    salesExecOptions = all.map(p => `<option value="${p.id}" data-name="${p.name}" data-role="${p.role}">${p.name} (${p.role})</option>`).join('');
  }

  return `
  <!-- Quick links row — Billing | Quotations | Tiles | Granite -->
  <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px;white-space:nowrap">
    <button class="entry-type-btn active"><span class="et-icon">🧾</span>New Bill</button>
    <button class="entry-type-btn" onclick="navigateTo('quotations')"><span class="et-icon">📄</span>Quotations</button>
    <button class="entry-type-btn" onclick="navigateTo('tiles')"><span class="et-icon">🏠</span>Tiles Quote</button>
    <button class="entry-type-btn" onclick="navigateTo('granite')"><span class="et-icon">🪨</span>Granite Quote</button>
  </div>

  ${customer ? `
    <div class="customer-pill" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <span>👤 ${customer.name} · ${customer.phone}</span>
      <button class="link-btn" onclick="clearCartCustomer()">change</button>
    </div>` : `
    <div class="card" style="margin-bottom:10px">
      <h3 class="card-title">Customer</h3>
      <div class="form-group">
        <label>Phone Number *</label>
        <input type="tel" id="inv-cust-phone" placeholder="Enter customer's phone number" maxlength="10" oninput="lookupCustomerByPhone(this.value,'invoice')">
        <div id="invoice-customer-lookup-status" style="font-size:12px;margin-top:4px"></div>
      </div>
      <div class="input-row">
        <div class="form-group" style="flex:1"><label>Customer Name *</label><input type="text" id="inv-cust-name"></div>
        <div class="form-group" style="flex:1"><label>Area</label><input type="text" id="inv-cust-area" placeholder="e.g. Bhavanipuram"></div>
      </div>
      <div class="form-group"><label>Address</label><input type="text" id="inv-cust-address"></div>
    </div>`}

  <div class="card">
    <h3 class="card-title">Add Products</h3>
    <div class="search-row">
      <input type="text" id="product-search" placeholder="Search by name or barcode..." oninput="searchProducts(this.value)">
      <button class="btn-sm" onclick="scanProductForCart()">📷 Scan</button>
    </div>
    <div class="filter-row" id="cat-filters">
      <button class="filter-btn active" onclick="filterCat('all',this)">All</button>
      ${categories.map(c => `<button class="filter-btn" onclick="filterCat('${c}',this)">${c}</button>`).join('')}
    </div>
    <div id="product-grid" class="product-grid">
      ${await renderProductGrid(products)}
    </div>
  </div>

  <div class="card" id="cart-card">
    <h3 class="card-title">Cart <span id="cart-count" class="badge">${activeCart.items.length}</span></h3>
    <div id="cart-items">
      ${renderCartItems()}
    </div>
    <div id="cart-billing-form" style="${activeCart.items.length ? '' : 'display:none'}">
    <div class="form-group">
      <label>Sale Type</label>
      <div class="entry-type-grid" style="margin-top:4px">
        <button class="entry-type-btn ${(activeCart.saleType||'cash')==='cash'?'active':''}" id="sale-type-cash-btn" onclick="setSaleType('cash')"><span class="et-icon">💵</span>Cash Sale</button>
        <button class="entry-type-btn ${activeCart.saleType==='credit'?'active':''}" id="sale-type-credit-btn" onclick="setSaleType('credit')"><span class="et-icon">📝</span>Credit Sale</button>
      </div>
    </div>
    <div class="cart-totals" id="cart-totals">
      ${renderTotals()}
    </div>
    <div class="form-group" style="margin-top:12px">
      <label>Discount (%)</label>
      <input type="number" id="discount-pct" value="0" min="0" max="100" step="1" onchange="updateTotals()">
    </div>
    <div class="form-group">
      <label>How will this leave the store?</label>
      <select id="fulfillment-method" onchange="updateFulfillmentMethodUI()">
        <option value="self_pickup">Self Pickup — customer collects it themselves</option>
        <option value="vw_delivery">V Wholesale Delivery — our own vehicle delivers it</option>
        <option value="self_transport">Self Transport — customer arranges their own transport</option>
      </select>
      <p style="font-size:11px;color:var(--text3);margin-top:3px">Dispatch can change this later if plans change.</p>
    </div>
    <div class="form-group" id="vehicle-number-group" style="display:none">
      <label>Vehicle Number</label>
      <input type="text" id="inv-vehicle-number" placeholder="e.g. AP16 AB 1234">
    </div>
    <div class="form-group">
      <label>Sales Executive <span style="font-size:11px;color:var(--text3)">Who handled this customer?</span></label>
      ${isExecRole ? `
        <input type="text" id="inv-sales-exec-name" value="${profile?.name||''}" readonly style="background:var(--bg2);color:var(--text2)">
        <input type="hidden" id="inv-sales-exec-id" value="${profile?.id||''}">
        <p style="font-size:11px;color:var(--text3);margin-top:2px">Auto-filled — you are the sales executive on this invoice</p>
      ` : `
        <select id="inv-sales-exec-select" onchange="updateSalesExecFromSelect(this)">
          <option value="">— Select sales executive —</option>
          ${salesExecOptions}
        </select>
        <input type="hidden" id="inv-sales-exec-id" value="">
        <input type="hidden" id="inv-sales-exec-name" value="">
      `}
    </div>
    <div id="payment-section">${renderPaymentSection()}</div>
    <div class="bill-actions">
      <button class="btn-secondary" onclick="clearCart()">🗑 Clear</button>
      <button class="btn-primary" onclick="generateInvoice()">🧾 Generate Invoice</button>
    </div>
    </div>
    ${activeCart.items.length ? '' : '<p class="empty-msg" id="cart-empty-msg">Cart is empty — add products above to begin billing</p>'}
  </div>
  `;
}

async function renderProductGrid(products, filter = 'all', search = '') {
  let filtered = products;
  if (filter !== 'all') filtered = filtered.filter(p => p.category === filter);
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())));
  if (!filtered.length) return '<p class="empty-msg">No products found</p>';
  return filtered.map(p => `
    <div class="product-card" onclick="addToCart(${p.id})">
      <div class="product-cat">${p.category}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">₹${p.price.toLocaleString('en-IN')} <span class="unit">/${p.unit}</span></div>
      <div class="product-stock ${p.stock < 10 ? 'low-stock' : ''}">Stock: ${p.stock} ${p.unit}</div>
    </div>
  `).join('');
}

async function searchProducts(val) {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const activeFilter = document.querySelector('.filter-btn.active')?.textContent || 'all';
  document.getElementById('product-grid').innerHTML = await renderProductGrid(products, activeFilter === 'All' ? 'all' : activeFilter, val);
}

async function filterCat(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const products = await VW_DB.all(VW_DB.STORES.products);
  const search = document.getElementById('product-search').value;
  document.getElementById('product-grid').innerHTML = await renderProductGrid(products, cat, search);
}

async function addToCart(productId) {
  const p = await VW_DB.getById(VW_DB.STORES.products, productId);
  const existing = activeCart.items.find(i => i.productId === productId);
  if (existing) { existing.qty += 1; }
  else { activeCart.items.push({ productId, name: p.name, price: p.price, qty: 1, unit: p.unit, gst: p.gst || 18, hsn: p.hsn || '' }); }
  refreshCart();
  showToast(`${p.name} added`, 'success');
}

// Scanning during billing keeps the camera open across multiple items —
// a real order is rarely just one product — and only closes once the
// person taps Cancel or Done.
function scanProductForCart() {
  openQrScanner(async (code) => {
    const product = await findProductByScannedCode(code);
    if (!product) {
      showToast('No product matches that code', 'warn');
      return;
    }
    await addToCart(product.id);
    const statusEl = document.getElementById('qr-scan-status');
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✓ Added: ${product.name} — scan another or tap Cancel when done</span>`;
  }, { title: 'Scan to Add', subtitle: 'Scan as many items as you need — they\'ll be added one by one.' });
}
window.scanProductForCart = scanProductForCart;

async function showPullFromQuotation() {
  const quotes = await VW_DB.all(VW_DB.STORES.quotations);
  const eligible = quotes.filter(q => q.status !== 'converted');
  eligible.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Pull from Quotation</h3>
    <p class="sheet-meta">Loads the quotation's items into your cart — you can still add more or adjust quantities before billing.</p>
    <div class="visit-list">
      ${eligible.length ? eligible.map(q => {
        const isApproved = !q.approvalStatus || q.approvalStatus === 'approved';
        return `
        <div class="cust-row" onclick="${isApproved ? `pullQuotationIntoCart(${q.id})` : `escalateQuotationNow(${q.id})`}">
          <div class="cust-info">
            <div class="cust-name">${q.quoteNo || 'Q-'+q.id}${!isApproved ? ' <span style="color:var(--gold);font-size:11px">⏳ Pending Approval</span>' : ''}</div>
            <div class="cust-meta">${q.siteName||q.customerName||'—'} &middot; ₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}${!isApproved ? ' &middot; tap to send a reminder' : ''}</div>
          </div>
        </div>`;
      }).join('') : '<p class="empty-msg">No quotations ready to bill yet</p>'}
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showPullFromQuotation = showPullFromQuotation;

async function pullQuotationIntoCart(quotationId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  if (!q) return;
  const products = await VW_DB.all(VW_DB.STORES.products);

  for (const it of (q.items||[])) {
    // computeLine gives netPrice (may be base or inclusive depending on mode)
    const { netPrice, total } = computeLine(it);
    const match = products.find(p => p.brand === it.brand && p.model === it.model);
    
    // Cart prices are ALWAYS GST-inclusive — convert if item was base+GST mode
    let cartPrice = netPrice;
    if (it.mode === 'mrp_disc_gst') {
      // netPrice is base (GST exclusive) — add GST to get inclusive price
      const gstPct = parseFloat(it.gstPct || it.gstSlab || 18) || 18;
      cartPrice = netPrice * (1 + gstPct / 100);
    }
    // For direct price mode — price is already as entered (treat as inclusive)
    // For mrp_disc mode — netPrice = MRP*(1-disc%) = already GST inclusive
    
    activeCart.items.push({
      productId: match ? match.id : null,
      name: [it.brand, it.model, it.description].filter(Boolean).join(' — ') || 'Item',
      price: Math.round(cartPrice * 100) / 100,
      qty: parseFloat(it.qty)||1,
      unit: it.unit || 'pc',
      gst: parseFloat(it.gstPct || it.gstSlab || (match ? match.gst : 18)) || 18,
      hsn: match ? (match.hsn||'') : '',
      fromQuotation: true,
      quoteItemMode: it.mode
    });
  }
  if (q.customerId) activeCart.customerId = q.customerId;
  activeCart.quotationId = quotationId;
  activeCart.quotationAdvance = q.advanceAmount || 0;

  closeSheet();
  showToast(`Pulled ${(q.items||[]).length} item(s) from ${q.quoteNo||'quotation'}`, 'success');
  navigateTo('cart');
}
window.pullQuotationIntoCart = pullQuotationIntoCart;

function removeFromCart(idx) {
  activeCart.items.splice(idx, 1);
  refreshCart();
}

function updateQty(idx, val) {
  const qty = parseFloat(val);
  if (qty <= 0) return removeFromCart(idx);
  activeCart.items[idx].qty = qty;
  refreshCart();
}

function refreshCart() {
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) cartCountEl.textContent = activeCart.items.length;

  const cartItemsEl = document.getElementById('cart-items');
  if (cartItemsEl) cartItemsEl.innerHTML = renderCartItems();

  // Show/hide billing form and empty message based on cart state —
  // these elements always exist in the DOM now (not conditionally rendered)
  // so toggling display is enough, no re-render needed.
  const billingForm = document.getElementById('cart-billing-form');
  const emptyMsg = document.getElementById('cart-empty-msg');
  if (billingForm) billingForm.style.display = activeCart.items.length ? '' : 'none';
  if (emptyMsg) emptyMsg.style.display = activeCart.items.length ? 'none' : '';

  if (activeCart.items.length) {
    const totDiv = document.getElementById('cart-totals');
    if (totDiv) totDiv.innerHTML = renderTotals();
    updateTotals();
  }
}

function renderCartItems() {
  if (!activeCart.items.length) return '';
  return activeCart.items.map((item, i) => `
    <div class="cart-row">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">
          <input type="number" class="price-override-input" value="${item.price}" step="0.01" onchange="overrideCartItemPrice(${i}, this.value)" style="width:80px;display:inline-block">
          /${item.unit}
          ${item.priceOverridden ? `<span style="color:var(--gold);font-size:11px"> (was ₹${item.originalPrice})</span>` : ''}
        </div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateQty(${i}, ${item.qty - 1})">−</button>
        <input type="number" class="qty-input" value="${item.qty}" min="0.5" step="0.5" onchange="updateQty(${i}, this.value)">
        <button class="qty-btn" onclick="updateQty(${i}, ${item.qty + 1})">+</button>
        <button class="remove-btn" onclick="removeFromCart(${i})">✕</button>
      </div>
      <div class="cart-item-total">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
    </div>
  `).join('');
}

function overrideCartItemPrice(idx, newValue) {
  const item = activeCart.items[idx];
  const newPrice = parseFloat(newValue);
  if (isNaN(newPrice) || newPrice < 0) return refreshCart();
  if (!item.priceOverridden && newPrice !== item.price) {
    item.originalPrice = item.price;
    item.priceOverridden = true;
  }
  item.price = newPrice;
  refreshCart();
}
window.overrideCartItemPrice = overrideCartItemPrice;

function renderTotals() {
  const disc = parseFloat(document.getElementById('discount-pct')?.value || 0);
  const inclusiveSubtotal = activeCart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = inclusiveSubtotal * disc / 100;
  const packingCharges = computePackingCharges();
  const total = inclusiveSubtotal - discAmt + packingCharges;
  const gstAmt = activeCart.items.reduce((s, i) => {
    const itemTotal = i.price * i.qty;
    const itemBasic = itemTotal / (1 + (i.gst||0) / 100);
    return s + (itemTotal - itemBasic);
  }, 0) * (1 - disc / 100);
  const subtotal = total - gstAmt;
  return `
    <div class="total-row"><span>Subtotal</span><span>₹${Math.round(subtotal).toLocaleString('en-IN')}</span></div>
    ${disc ? `<div class="total-row discount"><span>Discount (${disc}%)</span><span>−₹${Math.round(discAmt).toLocaleString('en-IN')}</span></div>` : ''}
    ${packingCharges ? `<div class="total-row"><span>Packing/Loading/Transport</span><span>+₹${Math.round(packingCharges).toLocaleString('en-IN')}</span></div>` : ''}
    <div class="total-row"><span>GST (included)</span><span>₹${Math.round(gstAmt).toLocaleString('en-IN')}</span></div>
    <div class="total-row grand"><span>Total</span><span>₹${Math.round(total).toLocaleString('en-IN')}</span></div>
  `;
}

function updateTotals() {
  const totDiv = document.getElementById('cart-totals');
  if (totDiv) totDiv.innerHTML = renderTotals();
  updatePaymentTotals();
}

function clearCart() { activeCart.items = []; refreshCart(); }

// Indian financial year runs April-to-March. Returns e.g. "26-27" for any
// date between 1 Apr 2026 and 31 Mar 2027, matching your existing invoice
// number format (VW/26-27/00002).
function getFinancialYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, so March = 2, April = 3
  const startYear = month >= 3 ? year : year - 1;
  const shortStart = String(startYear).slice(-2);
  const shortEnd = String(startYear + 1).slice(-2);
  return `${shortStart}-${shortEnd}`;
}

async function getNextInvoiceNumber() {
  const fy = getFinancialYearLabel();
  try {
    const { data, error } = await VW_DB.client.rpc('get_next_invoice_seq', { p_fy: fy });
    if (error) throw error;
    return `VW-${fy}-${String(data).padStart(3, '0')}`;
  } catch(e) {
    // Fallback: use old method if RPC not available
    const nextSeq = await VW_DB.incrementInvoiceSequence(fy);
    return `VW-${fy}-${String(nextSeq).padStart(3, '0')}`;
  }
}
window.getFinancialYearLabel = getFinancialYearLabel;
window.getNextInvoiceNumber = getNextInvoiceNumber;

// Financial year auto-reset: on April 1 the FY label changes automatically
// since getFinancialYearLabel() is date-based — no manual reset needed.
// New sequences auto-start at 1 for new FY labels in Supabase.
function checkFYRollover() {
  const now = new Date();
  if (now.getMonth() === 3 && now.getDate() === 1) {
    // April 1 — clear any cached FY so fresh sequences are used
    localStorage.removeItem('vw_fy_cache');
    console.log('Financial year rolled over to', getFinancialYearLabel());
  }
}
checkFYRollover();

let invoiceGenerationInFlight = false; // guards against a double-tap firing two concurrent invoices

async function generateInvoice() {
  if (invoiceGenerationInFlight) return; // already processing this exact tap — ignore any extra ones until it finishes
  if (!activeCart.items.length) return showToast('Cart is empty', 'warn');
  invoiceGenerationInFlight = true;
  try {
    await generateInvoiceInner();
  } finally {
    invoiceGenerationInFlight = false;
  }
}
window.generateInvoice = generateInvoice;

async function generateInvoiceInner() {

  // If no customer is attached yet (fresh "Create New Invoice" with no
  // prior context), link or create one from whatever was typed in the
  // Customer section, the same way Quotations link by phone.
  if (!activeCart.customerId) {
    const phoneEl = document.getElementById('inv-cust-phone');
    const nameEl = document.getElementById('inv-cust-name');
    if (phoneEl && phoneEl.value.trim()) {
      const digits = phoneEl.value.replace(/\D/g,'').slice(-10);
      const customers = await VW_DB.all(VW_DB.STORES.customers);
      const match = customers.find(c => (c.phone||'').replace(/\D/g,'').slice(-10) === digits);
      if (match) {
        activeCart.customerId = match.id;
      } else if (digits.length === 10 && nameEl && nameEl.value.trim()) {
        activeCart.customerId = await VW_DB.put(VW_DB.STORES.customers, {
          name: nameEl.value.trim(), phone: phoneEl.value.trim(),
          address: document.getElementById('inv-cust-address')?.value.trim() || '',
          city: document.getElementById('inv-cust-area')?.value.trim() || '',
          type: 'retail', visitCount: 0, createdAt: new Date().toISOString()
        });
      }
    }
  }

  // A customer is required on every invoice — a sale with no name/phone
  // attached can't be followed up on, can't go on a statement, and
  // can't be linked to repeat-business reporting.
  if (!activeCart.customerId) {
    return showToast('Add a customer (name + valid phone) before generating the invoice', 'warn');
  }

  const disc = parseFloat(document.getElementById('discount-pct')?.value || 0);
  const inclusiveSubtotal = activeCart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = inclusiveSubtotal * disc / 100;
  const packingChargesAmt = computePackingCharges();
  const preDiscountTotal = inclusiveSubtotal - discAmt + packingChargesAmt;

  const saleType = activeCart.saleType || 'cash';
  const advanceAlready = activeCart.quotationAdvance || 0;
  let paymentMethod = null, amountReceived = 0, balanceDue = 0, creditDueDate = null;
  let paymentSplits = [], changeAmount = 0, cashDiscountAmt = 0;

  // These must be declared at function scope — used in both credit and cash paths
  const loyaltyPtsRedeemed = parseFloat(document.getElementById('loyalty-redeem-pts')?.value || 0);
  const loyaltyDiscAmt = Math.round(loyaltyPtsRedeemed * ((window._loyaltyConfig?.pointValue)||1));
  const ledgerDiscAmt = _appliedLedgerBalance || 0;
  const promoDiscAmt = _appliedPromoDiscount || 0;
  const promoCodeUsed = _appliedPromoCode || '';

  if (saleType === 'credit') {
    creditDueDate = document.getElementById('credit-due-date')?.value || null;
    cashDiscountAmt = 0;
  } else {
    cashDiscountAmt = parseFloat(document.getElementById('cash-discount-amt')?.value || 0);
  }

  // The actual invoice total = pre-discount total minus any cash discount.
  // Cash discount reduces the final amount the customer pays AND what
  // appears on the invoice — it's not a separate "collected less" amount,
  // it's a genuine reduction in the invoice value that Accounts must approve.
  const total = Math.round(preDiscountTotal - cashDiscountAmt);

  const gstAmt = activeCart.items.reduce((s, i) => {
    const itemTotal = i.price * i.qty;
    const itemBasic = itemTotal / (1 + (i.gst||0) / 100);
    return s + (itemTotal - itemBasic);
  }, 0) * (1 - disc / 100);
  const subtotal = total - gstAmt;

  if (saleType === 'credit') {
    creditDueDate = document.getElementById('credit-due-date')?.value || null;
    balanceDue = Math.round(total);
  } else {
    const payable = Math.max(0, total - advanceAlready - cashDiscountAmt - loyaltyDiscAmt - ledgerDiscAmt - promoDiscAmt);
    paymentMethod = document.getElementById('cash-payment-method')?.value || 'Cash';

    if (paymentMethod === 'Split') {
      paymentSplits = _splitRows.filter(r => r.amount > 0);
      amountReceived = paymentSplits.reduce((s, r) => s + r.amount, 0);
      balanceDue = Math.round(payable - amountReceived);
      if (balanceDue > 0) return showToast(`Split payment short by ₹${balanceDue.toLocaleString('en-IN')}`, 'warn');
      changeAmount = Math.max(0, amountReceived - payable);
    } else {
      amountReceived = parseFloat(document.getElementById('cash-amount-received')?.value || 0);
      balanceDue = Math.round(payable - amountReceived);
      changeAmount = Math.max(0, amountReceived - payable);
      if (balanceDue > 0) {
        return showToast(`Cash sale short by ₹${balanceDue.toLocaleString('en-IN')} — switch to Credit Sale if paying later`, 'warn');
      }
    }
    balanceDue = 0;
  }

  const invoiceNo = await getNextInvoiceNumber();
  const vehicleNumber = document.getElementById('inv-vehicle-number')?.value.trim() || '';
  const fulfillmentMethod = document.getElementById('fulfillment-method')?.value || 'self_pickup';

  // Three independent triggers decide whether this invoice needs approval
  // before it can be finalized/printed, and which chain it needs:
  //   - any item with an overridden price -> full chain (tl onward)
  //   - an overall discount % with no price override -> store_manager/management only
  //   - Credit Sale -> always store_manager/management, no exceptions,
  //     even layered on top of either of the above (the short chain is
  //     already a subset of the full one, so nothing extra is needed)
  const hasPriceOverride = activeCart.items.some(i => i.priceOverridden);
  const hasDiscount = disc > 0;
  const hasCashDiscount = cashDiscountAmt > 0;
  // Cash discount requires Accounts approval — it directly reduces the
  // amount collected vs the invoice total, so Accounts must sign off
  // that the shortfall is authorised before the invoice is finalised.
  const needsApproval = hasPriceOverride || hasDiscount || saleType === 'credit' || hasCashDiscount;
  const approvalReason = hasPriceOverride ? 'price_override' : saleType === 'credit' ? 'credit' : hasCashDiscount ? 'cash_discount' : 'discount';

  const invoiceCreator = VW_AUTH.getCurrentProfile();
  const salesExecName = document.getElementById('inv-sales-exec-name')?.value?.trim() || '';
  const salesExecIdRaw = document.getElementById('inv-sales-exec-id')?.value?.trim() || '';
  // Only store as salesExecutiveId if it looks like a real UUID (profiles.id format)
  // The exec-N composite keys used in the salesperson credits picker are NOT UUIDs
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salesExecIdRaw);
  const salesExecId = isUUID ? salesExecIdRaw : null;
  const invoice = {
    invoiceNo, customerId: activeCart.customerId, visitId: activeCart.visitId,
    createdByProfileId: invoiceCreator?.id || null,
    createdByName: invoiceCreator?.name || '',
    createdByRole: invoiceCreator?.role || '',
    salesExecutiveName: salesExecName || invoiceCreator?.name || '',
    salesExecutiveId: salesExecId || null,
    items: activeCart.items.map(i => ({ ...i, dispatchStatus: 'pending', dispatchPhoto: null, gatePassId: null })),
    subtotal: Math.round(subtotal), discountPct: disc,
    discountAmt: Math.round(discAmt), gstAmt: Math.round(gstAmt), total: Math.round(total),
    cashDiscountAmt: Math.round(cashDiscountAmt || 0),
    changeAmount: Math.round(changeAmount || 0),
    packingCharges: Math.round(computePackingCharges()),
    vehicleNumber, fulfillmentMethod, date: new Date().toISOString(), status: needsApproval ? 'pending_approval' : 'paid',
    creditSale: saleType === 'credit', creditDueDate,
    paymentMethod: saleType === 'credit' ? 'pending' : paymentMethod,
    paymentSplits: paymentSplits.length ? paymentSplits : [],
    amountReceived: saleType === 'credit' ? 0 : amountReceived,
    advanceAmount: advanceAlready,
    balanceDue: Math.max(0, balanceDue),
    approvalStatus: needsApproval ? 'pending_approval' : 'approved',
    paymentVerified: false
  };

  const invId = await VW_DB.put(VW_DB.STORES.invoices, invoice);

  if (activeCart.visitId) {
    const visit = await VW_DB.getById(VW_DB.STORES.visits, activeCart.visitId);
    if (visit) { visit.status = 'billed'; visit.invoiceId = invId; await VW_DB.put(VW_DB.STORES.visits, visit); }
  }

  if (activeCart.quotationId) {
    const q = await VW_DB.getById(VW_DB.STORES.quotations, activeCart.quotationId);
    if (q) { q.status = 'converted'; q.invoiceId = invId; q.invoiceNo = invoiceNo; await VW_DB.put(VW_DB.STORES.quotations, q); }
  }

  // Real stock deduction at the moment of billing — this was previously
  // missing entirely from the proper Billing flow (only Restock added
  // stock; nothing ever subtracted it on a sale), which meant Inventory
  // counts silently drifted from reality on every single invoice. Items
  // with no matched Inventory product (productId null, e.g. a brand-new
  // item never formally added) are skipped since there's no row to
  // deduct from.
  let _dispatchSnapshotChanged = false;
  for (let _i = 0; _i < activeCart.items.length; _i++) {
    const item = activeCart.items[_i];
    if (!item.productId) continue;
    const product = await VW_DB.getById(VW_DB.STORES.products, item.productId);
    if (!product) continue;
    product.stock = Math.max(0, (parseFloat(product.stock) || 0) - (parseFloat(item.qty) || 0));
    // If this item came from a quotation that had an advance collected
    // (a stock HOLD, not a real deduction), release that hold now —
    // the hold has done its job; the invoice itself is the real record
    // of the sale from here on.
    if (activeCart.quotationId && product.heldStock) {
      product.heldStock = Math.max(0, (parseFloat(product.heldStock) || 0) - (parseFloat(item.qty) || 0));
    }
    await VW_DB.put(VW_DB.STORES.products, product);
    // Keep the per-location rows in sync with the flat on-hand: snapshot the
    // lowest-first pick plan onto the invoice item first (so Dispatch still
    // shows where to pick after the sale), then deduct those locations and
    // log a user-attributed movement so the sale shows in Stock History.
    const _qtySold = parseFloat(item.qty) || 0;
    if (_qtySold > 0) {
      try {
        const { locations } = await getProductStockLocations(item.productId);
        if (locations.length && invoice.items[_i]) {
          const { plan } = pickStockLowestFirst(locations, _qtySold);
          invoice.items[_i].dispatchPick = plan.map(p => ({ warehouse_code:p.warehouse_code, rack_no:p.rack_no, shelf_no:p.shelf_no, take:p.take }));
          _dispatchSnapshotChanged = true;
        }
      } catch(_) {}
      try { await VW_STOCK.deductLowestFirst(item.productId, _qtySold); } catch(_) {}
      try {
        await recordStockMovement({
          productId: item.productId, productName: product.name, delta: -_qtySold, kind: 'sale',
          reason: `Sale — ${invoiceNo||''}`, ref: invoiceNo||'',
          stockBefore: (parseFloat(product.stock)||0) + _qtySold, stockAfter: parseFloat(product.stock)||0
        });
      } catch(_) {}
    }
  }
  if (_dispatchSnapshotChanged) { try { invoice.id = invId; await VW_DB.put(VW_DB.STORES.invoices, invoice); } catch(_) {} }

  activeCart.quotationId = null;
  activeCart.quotationAdvance = 0;
  activeCart.saleType = 'cash';
  _splitRows = [];
  // Reset applied discounts so they don't leak to the next customer
  _appliedLedgerBalance = 0;
  _appliedPromoDiscount = 0;
  _appliedPromoCode = '';
  clearCart();

  if (needsApproval) {
    await VW_ESCALATION.startInvoiceApproval(invId, approvalReason);
    if (activeCart.customerId) await VW_FEATURES.earnLoyaltyPoints(activeCart.customerId, invId, total);
    await VW_FEATURES.earnStaffPoints(total, invId);
    const spinActive = await VW_FEATURES.showSpinWheel(invId, total);
    const popupDelay = spinActive ? 4000 : 800;
    setTimeout(() => showInvoicePendingApprovalPopup(invoiceNo, approvalReason), popupDelay);
    return;
  }

  await VW_NOTIFY.notify('invoice', null, [invoiceNo, Math.round(total)], 'en', 'invoice');
  if (activeCart.customerId) await VW_FEATURES.earnLoyaltyPoints(activeCart.customerId, invId, total);
    await VW_FEATURES.earnStaffPoints(total, invId);
  // Record loyalty redemption if points were used
  if (loyaltyPtsRedeemed > 0 && activeCart.customerId) {
    await VW_DB.put(VW_DB.STORES.loyaltyTransactions, {
      customerId: activeCart.customerId,
      type: 'redeem',
      points: loyaltyPtsRedeemed,
      discountAmt: loyaltyDiscAmt,
      invoiceId: invId,
      invoiceNo,
      createdAt: new Date().toISOString()
    });
  }
  printInvoice(invoice, activeCart.customerId);
  setTimeout(() => VW_FEATURES.showSpinWheel(invId, total), 1500);
}

function showInvoicePendingApprovalPopup(invoiceNo, reason) {
  const reasonText = reason === 'price_override' ? 'a price override on one or more items'
    : reason === 'credit' ? 'it being a Credit Sale'
    : reason === 'cash_discount' ? 'a cash discount being applied'
    : 'the discount applied';
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="text-align:center;padding:10px 0">
      <div style="font-size:40px;margin-bottom:10px">⏳</div>
      <h3 style="margin:0 0 8px">Invoice ${invoiceNo} — Pending Approval</h3>
      <p style="font-size:13px;color:var(--text2);line-height:1.6">This invoice needs Accounts approval because of <strong>${reasonText}</strong>. It will print automatically once approved. Check Billing → Invoices for status.</p>
    </div>
    <button class="btn-primary full-width" style="margin-top:10px" onclick="closeSheet()">Got it</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showInvoicePendingApprovalPopup = showInvoicePendingApprovalPopup;

async function printInvoice(invoice, customerId, copyLabel = 'ORIGINAL — CUSTOMER COPY') {
  const customer = customerId ? await VW_DB.getById(VW_DB.STORES.customers, customerId) : null;
  const rows = invoice.items.map((i,idx) => `
    <tr>
      <td style="text-align:center">${idx+1}</td>
      <td>${i.name}</td>
      <td style="text-align:center">${i.hsn||''}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:center">${i.unit||''}</td>
      <td style="text-align:right">₹${i.price.toLocaleString('en-IN')}</td>
      <td style="text-align:right">₹${(i.price * i.qty).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  const totalQty = invoice.items.reduce((s,i) => s + (parseFloat(i.qty)||0), 0);
  const cgst = Math.round(invoice.gstAmt / 2);
  const sgst = invoice.gstAmt - cgst;
  // invoice.subtotal is already the post-discount taxable amount (the
  // discount was applied once, upstream, when subtotal/gstAmt were first
  // derived from the GST-inclusive item prices) — subtracting
  // discountAmt again here would double-count it. "Taxable Amount" and
  // "Sub Total" are intentionally the same figure on this invoice; the
  // separate row exists for clarity right next to the CGST/SGST lines.
  const taxableAmount = invoice.subtotal;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNo}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:850px;margin:0 auto;padding:24px;color:#111;font-size:13px;position:relative}
    .copy-marker{position:absolute;top:24px;right:24px;font-size:11px;font-weight:700;letter-spacing:0.5px;border:1.5px solid #111;padding:4px 10px;border-radius:4px}
    .topbar{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
    .brand{font-size:20px;font-weight:700;color:#1a1a1a}
    .brand-block{font-size:11.5px;color:#444;line-height:1.5;margin-top:4px}
    .doc-title{text-align:center;font-size:15px;font-weight:700;margin:12px 0;letter-spacing:0.5px}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #999;margin-bottom:0}
    .meta-grid > div{padding:6px 10px;border-bottom:1px solid #ccc;font-size:12px}
    .meta-grid > div:nth-child(odd){border-right:1px solid #ccc}
    .addr-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #999;border-top:none}
    .addr-block{padding:8px 10px;font-size:12px;line-height:1.5}
    .addr-block:first-child{border-right:1px solid #ccc}
    .addr-label{font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:4px;color:#555}
    table{width:100%;border-collapse:collapse;margin:0;border:1px solid #999;border-top:none}
    th{background:#f0f0f0;padding:7px;text-align:left;font-size:11.5px;border-bottom:1px solid #999;border-right:1px solid #ccc}
    th:last-child{border-right:none}
    td{padding:6px 7px;font-size:12px;border-bottom:1px solid #eee;border-right:1px solid #eee}
    td:last-child{border-right:none}
    .tax-footer{display:flex;border:1px solid #999;border-top:none}
    .tax-left{flex:1;padding:8px 10px;font-size:11.5px;border-right:1px solid #999}
    .tax-right{flex:0 0 220px}
    .tax-right-row{display:flex;justify-content:space-between;padding:4px 10px;font-size:12px;border-bottom:1px solid #eee}
    .tax-right-row.grand{font-weight:700;font-size:14px;border-top:1px solid #999;border-bottom:none}
    .bank-row{border:1px solid #999;border-top:none;padding:6px 10px;font-size:11.5px;background:#fafafa}
    .sign-row{display:flex;justify-content:space-between;margin-top:36px;font-size:12px}
    .sign-box{text-align:center;width:200px}
    .sign-line{margin-top:36px;border-top:1px solid #999;padding-top:4px}
    .print-btn{display:block;margin:0 0 16px;padding:10px 24px;background:#C8972B;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:14px}
    @media print{.print-btn{display:none}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
  <div class="copy-marker">${copyLabel.toUpperCase()}</div>

  <div class="topbar">
    <div>
      <div class="brand">Vassure Wholesale Pvt Ltd</div>
      <div class="brand-block">1-1-153, NH-65, Beside Padmaja Suzuki,<br>VD Puram, Bhavanipuram, NTR<br>Vijayawada, Andhra Pradesh - 520012, India</div>
      <div class="brand-block">Phone No: 8712697930 | Email: hello@vwholesale.in<br>PAN: AAJCV5725H | GSTIN: 37AAJCV5725H1ZZ | State code: 37<br>CIN: U47190AP2023PTC111968</div>
    </div>
  </div>
  <div class="doc-title">TAX INVOICE</div>

  <div class="meta-grid">
    <div><strong>Invoice No.</strong> : ${invoice.invoiceNo}</div>
    <div><strong>Invoice Date</strong> : ${new Date(invoice.date).toLocaleDateString('en-IN')}</div>
    <div><strong>Bill Type</strong> : ${invoice.paymentMethod === 'pending' ? 'Credit' : 'Cash/Paid'}</div>
    <div><strong>Place of Supply</strong> : Andhra Pradesh</div>
    ${invoice.salesExecutiveName ? `<div><strong>Sales Executive</strong> : ${invoice.salesExecutiveName}</div>` : ''}
    ${invoice.createdByName && invoice.createdByName !== invoice.salesExecutiveName ? `<div><strong>Billed By</strong> : ${invoice.createdByName}</div>` : ''}
  </div>
  <div class="addr-grid">
    <div class="addr-block">
      <div class="addr-label">Customer Name &amp; Billing Address</div>
      ${customer ? `${customer.name}<br>${customer.city||'Vijayawada'}, Andhra Pradesh<br>India<br>Phone: ${customer.phone}` : 'Walk-in Customer'}
    </div>
    <div class="addr-block">
      <div class="addr-label">Shipping Address</div>
      ${customer ? `${customer.name}<br>${customer.city||'Vijayawada'}, Andhra Pradesh<br>India<br>Phone: ${customer.phone}` : '—'}
    </div>
  </div>

  <table>
    <thead><tr><th>S No</th><th>Description</th><th style="text-align:center">HSN/SAC</th><th style="text-align:center">Qty</th><th style="text-align:center">UOM</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount (INR)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3"></td><td style="text-align:center;font-weight:700">${totalQty}</td><td colspan="2"></td><td style="text-align:right;font-weight:700">₹${invoice.subtotal.toLocaleString('en-IN')}</td></tr></tfoot>
  </table>

  <div class="tax-footer">
    <div class="tax-left">
      <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
    </div>
    <div class="tax-right">
      <div class="tax-right-row"><span>Sub Total</span><span>₹${invoice.subtotal.toLocaleString('en-IN')}</span></div>
      ${invoice.discountAmt ? `<div class="tax-right-row"><span>Discount (${invoice.discountPct}%)</span><span>−₹${invoice.discountAmt.toLocaleString('en-IN')}</span></div>` : ''}
      ${invoice.packingCharges ? `<div class="tax-right-row"><span>Packing/Loading/Transport</span><span>+₹${invoice.packingCharges.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="tax-right-row"><span>Taxable Amount</span><span>₹${taxableAmount.toLocaleString('en-IN')}</span></div>
      <div class="tax-right-row"><span>CGST</span><span>₹${cgst.toLocaleString('en-IN')}</span></div>
      <div class="tax-right-row"><span>SGST/UTGST</span><span>₹${sgst.toLocaleString('en-IN')}</span></div>
      ${invoice.cashDiscountAmt ? `<div class="tax-right-row" style="color:#22c55e"><span>Cash Discount</span><span>−₹${invoice.cashDiscountAmt.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="tax-right-row grand"><span>Bill Total</span><span>₹${invoice.total.toLocaleString('en-IN')}</span></div>
      ${invoice.changeAmount ? `<div class="tax-right-row" style="color:#378ADD"><span>Change Returned</span><span>₹${invoice.changeAmount.toLocaleString('en-IN')}</span></div>` : ''}
    </div>
  </div>

  <div class="bank-row"><strong>Bank Detail</strong> | AXIS BANK | 923020015726050 | Bhavanipuram Branch | UTIB0001900</div>

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line">Receiver's Signature</div></div>
    <div class="sign-box"><div class="sign-line">For Vassure Wholesale Pvt Ltd<br>Authorised Signatory</div></div>
  </div>
  </body></html>`);
  win.document.close();
}

// ---------- DISTRIBUTION COPIES (Security / Transport / Dispatch) ----------
// Reduced-information versions of the same invoice for internal handoff —
// none of these show prices, only what each role actually needs to do
// their part of getting the order out the door.
function printDeliveryCopy(invoice, customerId, kind, copyLabel) {
  VW_DB.getById(VW_DB.STORES.customers, customerId).then(customer => {
    const titles = { gatepass: 'SECURITY GATE PASS', transport: 'TRANSPORT / DELIVERY SLIP', dispatch: 'DISPATCH CHECKLIST', accounts: 'TAX INVOICE — ACCOUNTS COPY' };
    const title = titles[kind] || (copyLabel || 'COPY').toUpperCase();
    const rows = invoice.items.map((i,idx) => `
      <tr><td style="text-align:center">${idx+1}</td><td>${i.name}</td><td style="text-align:center">${i.qty} ${i.unit||''}</td></tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${title} - ${invoice.invoiceNo}</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#111;font-size:13px;position:relative}
      .copy-marker{position:absolute;top:24px;right:24px;font-size:11px;font-weight:700;letter-spacing:0.5px;border:1.5px solid #111;padding:4px 10px;border-radius:4px}
      .brand{font-size:18px;font-weight:700}
      .doc-title{text-align:center;font-size:15px;font-weight:700;margin:16px 0;padding:8px;background:#f0f0f0;letter-spacing:0.5px}
      .meta{font-size:12.5px;margin-bottom:16px;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{background:#f0f0f0;padding:8px;text-align:left;font-size:12px;border:1px solid #999}
      td{padding:7px 8px;font-size:12.5px;border:1px solid #ccc}
      .sign-row{display:flex;justify-content:space-between;margin-top:48px;font-size:12px}
      .sign-box{text-align:center;width:200px;border-top:1px solid #999;padding-top:4px}
      .print-btn{display:block;margin:0 0 16px;padding:10px 24px;background:#C8972B;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:14px}
      @media print{.print-btn{display:none}}
    </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨 Print</button>
    <div class="copy-marker">${(copyLabel || title).toUpperCase()}</div>
    <div class="brand">Vassure Wholesale Pvt Ltd</div>
    <div class="doc-title">${title}</div>
    <div class="meta">
      <strong>Invoice Ref:</strong> ${invoice.invoiceNo}<br>
      <strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString('en-IN')}<br>
      ${customer ? `<strong>Customer:</strong> ${customer.name} &middot; ${customer.phone}<br>` : ''}
      ${kind==='dispatch' && customer ? `<strong>Delivery Address:</strong> ${customer.address || customer.city || 'Vijayawada, Andhra Pradesh'}<br>` : ''}
      ${kind==='transport' ? `<strong>Vehicle No.:</strong> ${invoice.vehicleNumber || '_______________'} &nbsp;&nbsp; <strong>Driver:</strong> _______________<br>` : ''}
    </div>
    <table><thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qty</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sign-row">
      <div class="sign-box">${kind==='gatepass' ? 'Security Signature' : kind==='transport' ? "Driver's Signature" : 'Packed By'}</div>
      <div class="sign-box">${kind==='gatepass' ? 'Time Out' : kind==='transport' ? 'Received By (Customer)' : 'Checked By'}</div>
    </div>
    </body></html>`);
    win.document.close();
  });
}
window.printDeliveryCopy = printDeliveryCopy;
window.printInvoice = printInvoice;


function openInvoiceActions(idx) {
  const inv = (window._recentInvoicesCache||[])[idx];
  if (!inv) return;
  const sheet = document.getElementById('bottom-sheet');
  const isAdmin = VW_AUTH.isAdmin();
  const isPending = inv.approvalStatus === 'pending_approval';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${inv.invoiceNo}</h3>
    <p class="sheet-meta">₹${inv.total.toLocaleString('en-IN')} · ${new Date(inv.date).toLocaleDateString('en-IN')} · ${inv.approvalStatus||'approved'}</p>
    <div class="sheet-actions">
      <button class="btn-primary" onclick="printInvoice(${JSON.stringify(inv).replace(/"/g,'&quot;')}, ${inv.customerId})">🧾 Print / Customer Copy</button>
      ${inv.paymentVerified
        ? `<button class="btn-secondary" onclick="closeSheet();VW_DISPATCH.openDispatchDetail(${inv.id})">📦 Dispatch & Gate Pass</button>`
        : `<button class="btn-secondary" style="background:var(--gold);color:#000" onclick="closeSheet();VW_DISPATCH.openAccountsVerify(${inv.id})">💳 Accounts Verification</button>`}
      ${(isAdmin || isPending) ? `<button class="btn-secondary" onclick="editInvoiceItems(${inv.id})">✏️ Edit Invoice Items</button>` : ''}
      ${isAdmin ? `<button class="btn-secondary" style="color:var(--red)" onclick="confirmCancelInvoice(${inv.id})">🗑 Cancel Invoice</button>` : ''}
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.openInvoiceActions = openInvoiceActions;

async function editInvoiceItems(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  closeSheet();
  // Load into cart for editing
  activeCart.items = (inv.items||[]).map(it => ({
    productId: it.productId || null,
    name: it.name || it.description || 'Item',
    price: it.price || it.netPrice || 0,
    qty: it.qty || 1,
    unit: it.unit || 'pc',
    gst: it.gst || 18,
    hsn: it.hsn || ''
  }));
  activeCart.customerId = inv.customerId;
  activeCart.editingInvoiceId = invId; // flag that we're editing
  activeCart.saleType = inv.creditSale ? 'credit' : 'cash';
  navigateTo('cart');
  setTimeout(() => showToast(`Editing ${inv.invoiceNo} — change items then tap Generate Invoice`, 'warn'), 300);
}
window.editInvoiceItems = editInvoiceItems;

async function confirmCancelInvoice(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="color:var(--red)">Cancel Invoice</h3>
    <p style="font-size:14px;color:var(--text2)">Cancel <strong>${inv.invoiceNo}</strong> for ₹${Math.round(inv.total||0).toLocaleString('en-IN')}?</p>
    <p style="font-size:12px;color:var(--text3)">This cannot be undone. The invoice will be marked as cancelled and removed from billing totals.</p>
    <div class="form-group"><label>Reason for cancellation</label>
      <textarea id="cancel-reason" placeholder="Customer changed mind / Error in billing / etc." style="height:60px"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Keep Invoice</button>
      <button class="btn-primary" style="flex:1;background:var(--red)" onclick="cancelInvoiceConfirmed(${invId})">Cancel Invoice</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.confirmCancelInvoice = confirmCancelInvoice;

async function cancelInvoiceConfirmed(invId) {
  const reason = document.getElementById('cancel-reason')?.value.trim() || 'Cancelled';
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  await VW_DB.put(VW_DB.STORES.invoices, {
    ...inv,
    approvalStatus: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
    cancelledBy: VW_AUTH.getCurrentProfile()?.name || 'Admin'
  });
  closeSheet();
  showToast(`${inv.invoiceNo} cancelled`, 'success');
  navigateTo('cart');
}
window.cancelInvoiceConfirmed = cancelInvoiceConfirmed;

function setSaleType(type) {
  activeCart.saleType = type;
  document.getElementById('sale-type-cash-btn').classList.toggle('active', type==='cash');
  document.getElementById('sale-type-credit-btn').classList.toggle('active', type==='credit');
  document.getElementById('payment-section').innerHTML = renderPaymentSection();
  if (activeCart.customerId) {
    setTimeout(() => loadLoyaltyBalance(activeCart.customerId), 50);
    setTimeout(() => loadLedgerBalance(activeCart.customerId), 80);
  }
}
window.setSaleType = setSaleType;

// Vehicle number only makes sense when something's actually being driven
// out — Self Pickup means the customer carries it themselves, so the
// field is hidden rather than left sitting there unused and confusing.
function updateFulfillmentMethodUI() {
  const method = document.getElementById('fulfillment-method')?.value;
  const vehicleGroup = document.getElementById('vehicle-number-group');
  if (vehicleGroup) vehicleGroup.style.display = method === 'self_pickup' ? 'none' : '';
}
window.updateFulfillmentMethodUI = updateFulfillmentMethodUI;

function updateSalesExecFromSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('inv-sales-exec-id').value = opt.value || '';
  document.getElementById('inv-sales-exec-name').value = opt.dataset.name || '';
}
window.updateSalesExecFromSelect = updateSalesExecFromSelect;

// ===== LOYALTY POINTS REDEMPTION =====
async function loadLoyaltyBalance(customerId) {
  const el = document.getElementById('loyalty-redemption-section');
  if (!el || !customerId) return;
  const txns = await VW_DB.all(VW_DB.STORES.loyaltyTransactions);
  const custTxns = txns.filter(t => t.customerId === customerId);
  const balance = custTxns.reduce((s, t) => s + (t.type === 'earn' ? (t.points||0) : -(t.points||0)), 0);
  const settings = await VW_DB.getSetting('loyalty_config', { pointValue: 1 });
  const pointValue = settings.pointValue || 1; // ₹1 per point default
  const maxRedeemable = Math.min(balance, Math.floor(computeCartGrandTotal() * 0.1)); // max 10% of bill
  if (balance <= 0) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:6px 0">⭐ Loyalty: 0 points (₹0)</div>`;
    return;
  }
  el.innerHTML = `
    <div style="background:rgba(200,151,43,0.08);border:1px solid rgba(200,151,43,0.25);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:var(--gold)">⭐ ${balance.toLocaleString('en-IN')} points = ₹${(balance*pointValue).toLocaleString('en-IN')}</span>
        <span style="font-size:11px;color:var(--text3)">Max redeem: ₹${(maxRedeemable*pointValue).toLocaleString('en-IN')}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="loyalty-redeem-pts" value="0" min="0" max="${maxRedeemable}"
          style="flex:1" oninput="updatePaymentTotals()" placeholder="Points to redeem">
        <button class="btn-sm" style="background:var(--gold);color:#000" onclick="document.getElementById('loyalty-redeem-pts').value=${maxRedeemable};updatePaymentTotals()">Use Max</button>
      </div>
      <div id="loyalty-redeem-value" style="font-size:12px;color:#22c55e;margin-top:4px"></div>
    </div>`;
}
window.loadLoyaltyBalance = loadLoyaltyBalance;

// ===== CUSTOMER LEDGER BALANCE AT BILLING =====
async function loadLedgerBalance(customerId) {
  const el = document.getElementById('ledger-balance-section');
  if (!el || !customerId) return;
  try {
    const [invoices, returns] = await Promise.all([
      VW_DB.all(VW_DB.STORES.invoices),
      VW_DB.all(VW_DB.STORES.salesReturns)
    ]);
    const custInvoices = invoices.filter(i => i.customerId === customerId && i.approvalStatus === 'approved');
    const totalBilled = custInvoices.reduce((s,i) => s+(i.total||0), 0);
    const totalPaid = custInvoices.reduce((s,i) => s+(i.amountPaid||i.total||0), 0);
    const advances = custInvoices.reduce((s,i) => s+(i.excessPaid||0), 0);
    const custReturns = returns.filter(r => r.customerId === customerId);
    const returnCredit = custReturns.reduce((s,r) => s+(r.creditAmount||0), 0);
    const availableBalance = advances + returnCredit;
    if (availableBalance <= 0) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:600;color:#22c55e">💰 Customer Balance Available</div>
          <div style="font-size:11px;color:var(--text2)">
            ${advances>0?`Advance credit: ₹${advances.toLocaleString('en-IN')}`:''} 
            ${returnCredit>0?`Return credit: ₹${returnCredit.toLocaleString('en-IN')}`:''} 
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:#22c55e">₹${availableBalance.toLocaleString('en-IN')}</div>
          <button class="btn-sm" style="margin-top:4px;background:rgba(34,197,94,0.2);color:#22c55e;border-color:rgba(34,197,94,0.4)" onclick="applyLedgerBalance(${availableBalance})">Use Balance</button>
        </div>
      </div>`;
  } catch(e) { el.innerHTML = ''; }
}
window.loadLedgerBalance = loadLedgerBalance;

let _appliedLedgerBalance = 0;
function applyLedgerBalance(amount) {
  _appliedLedgerBalance = amount;
  const el = document.getElementById('ledger-balance-section');
  if (el) el.innerHTML = `
    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.4);border-radius:10px;padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600;color:#22c55e">✓ Balance applied: ₹${amount.toLocaleString('en-IN')}</span>
        <button class="btn-sm" style="color:var(--red)" onclick="_appliedLedgerBalance=0;loadLedgerBalance(activeCart.customerId);updatePaymentTotals()">Remove</button>
      </div>
    </div>`;
  updatePaymentTotals();
  showToast(`₹${amount.toLocaleString('en-IN')} customer balance applied`, 'success');
}
window.applyLedgerBalance = applyLedgerBalance;

// ===== PROMO CODE / GIFT VOUCHER =====
const PROMO_CODES = {}; // Loaded from settings
let _appliedPromoDiscount = 0;
let _appliedPromoCode = '';

async function applyPromoCode(code) {
  if (!code || code.length < 3) return;
  const promoEl = document.getElementById('promo-result');
  const promos = await VW_DB.getSetting('promo_codes', {});
  const promo = promos[code.toUpperCase()];
  if (!promo) {
    if (promoEl) promoEl.innerHTML = `<span style="color:var(--red)">❌ Invalid code</span>`;
    _appliedPromoDiscount = 0; _appliedPromoCode = '';
    updatePaymentTotals(); return;
  }
  if (promo.expiry && new Date(promo.expiry) < new Date()) {
    if (promoEl) promoEl.innerHTML = `<span style="color:var(--red)">❌ Code expired</span>`;
    return;
  }
  const total = computeCartGrandTotal();
  const discount = promo.type === 'pct' ? Math.round(total * promo.value / 100) : promo.value;
  _appliedPromoDiscount = discount;
  _appliedPromoCode = code.toUpperCase();
  if (promoEl) promoEl.innerHTML = `<span style="color:#22c55e">✓ ${promo.label||code.toUpperCase()} — ₹${discount.toLocaleString('en-IN')} off</span>`;
  updatePaymentTotals();
  showToast(`Promo applied: ₹${discount} off`, 'success');
}
window.applyPromoCode = applyPromoCode;

function renderPaymentSection() {
  const saleType = activeCart.saleType || 'cash';
  const total = computeCartGrandTotal();
  const advanceAlready = activeCart.quotationAdvance || 0;
  const remaining = Math.max(0, total - advanceAlready);

  if (saleType === 'credit') {
    return `
    <div class="form-group">
      <label>Payment Due Date</label>
      <input type="date" id="credit-due-date" value="${new Date(Date.now()+30*86400000).toISOString().split('T')[0]}">
    </div>
    <p style="font-size:12px;color:var(--gold)">📝 Credit Sale — needs Store Manager approval before finalizing.</p>`;
  }

  return `
  ${advanceAlready ? `<p style="font-size:12px;color:var(--text2);margin-bottom:8px">Advance collected: ₹${advanceAlready.toLocaleString('en-IN')}</p>` : ''}

  ${activeCart.customerId ? `<div id="loyalty-redemption-section" style="margin-bottom:10px"></div>` : ''}
  ${activeCart.customerId ? `<div id="ledger-balance-section" style="margin-bottom:10px"></div>` : ''}
  ${activeCart.customerId ? `<div id="promo-code-section" style="margin-bottom:10px">
    <div style="display:flex;gap:8px">
      <input type="text" id="promo-code-input" placeholder="Promo code / Gift voucher" style="flex:1;font-size:13px" oninput="applyPromoCode(this.value)">
      <button class="btn-sm" onclick="applyPromoCode(document.getElementById('promo-code-input')?.value)">Apply</button>
    </div>
    <div id="promo-result" style="font-size:12px;margin-top:4px"></div>
  </div>` : ''}

  <div class="form-group">
    <label>Cash Discount (₹) <span style="font-size:11px;color:var(--text3)">e.g. round off ₹30 on a ₹19,130 bill</span></label>
    <input type="number" id="cash-discount-amt" value="0" min="0" step="1" oninput="updatePaymentTotals()">
  </div>

  <div id="final-payable-display" style="font-size:15px;font-weight:700;color:var(--gold);padding:8px 0;margin-bottom:4px">
    Payable: ₹${remaining.toLocaleString('en-IN')}
  </div>

  <div class="form-group">
    <label>Payment Method</label>
    <select id="cash-payment-method" onchange="updatePaymentTotals()">
      <option value="Cash">Cash</option>
      <option value="UPI">UPI / QR Scan</option>
      <option value="Card">Card</option>
      <option value="Bank Transfer">Bank Transfer</option>
      <option value="Cheque">Cheque</option>
      <option value="Split">Split Payment (multiple methods)</option>
    </select>
  </div>

  <div id="split-payment-container" style="display:none">
    <div id="split-rows"></div>
    <button class="btn-sm" onclick="addSplitPaymentRow()" style="margin-bottom:8px">+ Add Method</button>
    <div id="split-total-display" style="font-size:12px;color:var(--text3)"></div>
  </div>

  <div id="single-payment-container">
    <div class="form-group">
      <label>Customer Pays (₹) <span style="font-size:11px;color:var(--text3)">enter actual cash handed over</span></label>
      <input type="number" id="cash-amount-received" value="${remaining.toFixed(0)}" oninput="updatePaymentTotals()">
    </div>
    <div id="cash-balance-preview" style="font-size:14px;font-weight:700;padding:8px;border-radius:8px;margin-top:4px"></div>
  </div>`;
}

let _splitRows = [];

function addSplitPaymentRow() {
  const idx = _splitRows.length;
  _splitRows.push({ method: 'Cash', amount: 0 });
  const container = document.getElementById('split-rows');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'input-row';
  div.style.cssText = 'gap:8px;margin-bottom:6px';
  div.id = `split-row-${idx}`;
  div.innerHTML = `
    <select onchange="_splitRows[${idx}].method=this.value;updatePaymentTotals()" style="flex:1">
      <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
    </select>
    <input type="number" placeholder="₹ Amount" style="flex:1" oninput="_splitRows[${idx}].amount=parseFloat(this.value)||0;updatePaymentTotals()">
    <button onclick="document.getElementById('split-row-${idx}').remove();_splitRows.splice(${idx},1);updatePaymentTotals()" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer">✕</button>`;
  container.appendChild(div);
}
window.addSplitPaymentRow = addSplitPaymentRow;

function updatePaymentTotals() {
  const total = computeCartGrandTotal();
  const advance = activeCart.quotationAdvance || 0;
  const cashDisc = parseFloat(document.getElementById('cash-discount-amt')?.value || 0);
  const loyaltyPts = parseFloat(document.getElementById('loyalty-redeem-pts')?.value || 0);
  const settings_lc = window._loyaltyConfig || { pointValue: 1 };
  const loyaltyDisc = Math.round(loyaltyPts * (settings_lc.pointValue || 1));
  const ledgerDisc = _appliedLedgerBalance || 0;
  const promoDisc = _appliedPromoDiscount || 0;
  const payable = Math.max(0, total - advance - cashDisc - loyaltyDisc - ledgerDisc - promoDisc);

  // Show loyalty redemption value
  const loyaltyEl = document.getElementById('loyalty-redeem-value');
  if (loyaltyEl && loyaltyPts > 0) loyaltyEl.textContent = `✓ Redeeming ${loyaltyPts} points = ₹${loyaltyDisc} off`;
  else if (loyaltyEl) loyaltyEl.textContent = '';

  // Update payable display
  const payDisp = document.getElementById('final-payable-display');
  if (payDisp) payDisp.innerHTML = `Payable: <span style="color:var(--gold)">₹${payable.toLocaleString('en-IN')}</span>${cashDisc > 0 ? ` <span style="font-size:12px;color:var(--text3)">(₹${cashDisc} discount)</span>` : ''}${loyaltyDisc > 0 ? ` <span style="font-size:12px;color:var(--gold)">(-₹${loyaltyDisc} loyalty)</span>` : ''}`;

  const method = document.getElementById('cash-payment-method')?.value;
  const splitContainer = document.getElementById('split-payment-container');
  const singleContainer = document.getElementById('single-payment-container');

  if (method === 'Split') {
    if (splitContainer) splitContainer.style.display = '';
    if (singleContainer) singleContainer.style.display = 'none';
    const splitTotal = _splitRows.reduce((s, r) => s + (r.amount || 0), 0);
    const splitDisp = document.getElementById('split-total-display');
    if (splitDisp) {
      const diff = splitTotal - payable;
      splitDisp.innerHTML = `Split total: ₹${splitTotal.toLocaleString('en-IN')} / ₹${payable.toLocaleString('en-IN')} payable ${Math.abs(diff) < 0.5 ? '<span style="color:var(--green)">✓ Balanced</span>' : diff > 0 ? `<span style="color:var(--gold)">Change: ₹${diff.toLocaleString('en-IN')}</span>` : `<span style="color:var(--red)">Short: ₹${Math.abs(diff).toLocaleString('en-IN')}</span>`}`;
    }
    return;
  }

  if (splitContainer) splitContainer.style.display = 'none';
  if (singleContainer) singleContainer.style.display = '';

  const received = parseFloat(document.getElementById('cash-amount-received')?.value || 0);
  const el = document.getElementById('cash-balance-preview');
  if (!el) return;

  const diff = received - payable;
  if (Math.abs(diff) < 0.5) {
    el.innerHTML = `✓ Exact payment received`;
    el.style.cssText = 'color:var(--green);font-size:14px;font-weight:700;padding:8px;border-radius:8px;background:rgba(34,197,94,0.08)';
  } else if (diff > 0) {
    // Customer paid more — show change due
    el.innerHTML = `💰 Return Change: <span style="color:var(--green)">₹${diff.toLocaleString('en-IN')}</span>`;
    el.style.cssText = 'color:var(--text1);font-size:15px;font-weight:700;padding:10px 12px;border-radius:8px;background:rgba(34,197,94,0.12);border:1px solid var(--green)';
  } else {
    // Customer paid less
    el.innerHTML = `⚠️ Short by ₹${Math.abs(diff).toLocaleString('en-IN')} — collect balance or switch to Credit Sale`;
    el.style.cssText = 'color:var(--red);font-size:13px;font-weight:600;padding:8px;border-radius:8px;background:rgba(239,68,68,0.08)';
  }
}
window.updatePaymentTotals = updatePaymentTotals;

function computeCartGrandTotal() {
  const disc = parseFloat(document.getElementById('discount-pct')?.value || 0);
  const inclusiveSubtotal = activeCart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = inclusiveSubtotal * disc / 100;
  const packingCharges = computePackingCharges();
  return inclusiveSubtotal - discAmt + packingCharges;
}

function computePackingCharges() {
  const rules = window._packingChargeRules || [];
  if (!rules.length) return 0;
  let total = 0;
  const seen = new Set(); // flat charges fire once per category
  for (const item of activeCart.items) {
    const rule = rules.find(r => r.category === item.category) || rules.find(r => r.category === 'All');
    if (!rule) continue;
    if (rule.type === 'per_unit') total += (rule.amount || 0) * item.qty;
    else if (rule.type === 'flat' && !seen.has(rule.category)) { total += rule.amount || 0; seen.add(rule.category); }
    else if (rule.type === 'pct') total += item.price * item.qty * (rule.amount || 0) / 100;
  }
  return total;
}
window.computePackingCharges = computePackingCharges;

async function approveInvoiceStepUI(invId) {
  await VW_ESCALATION.approveInvoiceStep(invId);
  closeSheet();
  navigateTo('cart');
}
window.approveInvoiceStepUI = approveInvoiceStepUI;

function promptRejectInvoice(invId) {
  const reason = prompt('Reason for rejecting this invoice (visible to the person who created it):');
  if (reason === null) return; // cancelled
  VW_ESCALATION.rejectInvoiceStep(invId, reason).then(() => { closeSheet(); navigateTo('cart'); });
}
window.promptRejectInvoice = promptRejectInvoice;

window.VW_CART = { renderCart, addToCart, removeFromCart, updateQty, clearCart, generateInvoice, updateTotals, searchProducts, filterCat, getNextInvoiceNumber, getFinancialYearLabel, printInvoice, printDeliveryCopy, renderInvoicesTab, scanProductForCart };
window.goToCart = (cId, vId) => { activeCart.customerId = cId; activeCart.visitId = vId; navigateTo('cart'); };

// ===== INVOICES TAB (full history, Reprint, Send, multi-copy print) =====
async function renderInvoicesTab(search = '') {
  const [invoices, customers] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.customers)
  ]);
  const custMap = {}; customers.forEach(c => custMap[c.id] = c);
  const profile = VW_AUTH.getCurrentProfile();

  // Role-based invoice visibility:
  // - Admin / Accounts / Dispatch → all invoices (need full visibility)
  // - Cashier (reception) → all invoices they created
  // - Executive → invoices where they are the creator OR the sales executive
  const isAdmin = VW_AUTH.isAdmin();
  const isReception = profile?.role === 'reception';
  const isExecutive = profile?.role === 'executive';

  let visibleInvoices = invoices;
  if (!isAdmin && profile) {
    if (isReception) {
      // Cashier sees all invoices they billed
      visibleInvoices = invoices.filter(inv => inv.createdByProfileId === profile.id);
    } else if (isExecutive) {
      // Executive sees invoices they created OR where they are the sales executive
      visibleInvoices = invoices.filter(inv =>
        inv.createdByProfileId === profile.id ||
        inv.salesExecutiveId === profile.id ||
        (inv.salespersonCredits||[]).some(c => c.staffId === profile.id)
      );
    }
  }

  window._allInvoicesCache = visibleInvoices;
  window._invoiceCustMapCache = custMap;

  const filtered = search
    ? visibleInvoices.filter(inv => {
        const cust = custMap[inv.customerId];
        const term = search.toLowerCase();
        return inv.invoiceNo.toLowerCase().includes(term)
          || (cust && (cust.name||'').toLowerCase().includes(term))
          || (cust && (cust.phone||'').includes(term));
      })
    : visibleInvoices;
  const sorted = [...filtered].sort((a,b) => new Date(b.date) - new Date(a.date));

  const tabLabel = isAdmin ? 'All Invoices'
    : isReception ? 'My Billed Invoices'
    : isExecutive ? 'My Sales Invoices'
    : 'Invoices';

  return `
  <div class="card">
    <h3 class="card-title">${tabLabel} <span class="badge">${sorted.length}</span></h3>
    <input type="text" id="invoice-search" placeholder="Search by invoice #, customer name or phone..." value="${search}" oninput="searchInvoicesTab(this.value)" style="margin-bottom:10px">
    <div id="invoices-tab-list">${renderInvoicesTabList(sorted, custMap)}</div>
  </div>`;
}

function renderInvoicesTabList(invoices, custMap) {
  if (!invoices.length) return '<p class="empty-msg">No invoices found</p>';
  const currentProfile = VW_AUTH.getCurrentProfile();
  return invoices.map(inv => {
    const cust = custMap[inv.customerId];
    const isPendingApproval = inv.approvalStatus === 'pending_approval';
    const isPaymentVerified = inv.paymentVerified;
    const isFullyDispatched = (inv.items||[]).length > 0 && (inv.items||[]).every(i => i.dispatchStatus === 'checked');
    // Show photo nudge to the cashier who created it OR the credited sales executive
    const isMyInvoice = currentProfile && (
      (inv.createdByProfileId && currentProfile.id === inv.createdByProfileId) ||
      (inv.salesExecutiveId && currentProfile.id === inv.salesExecutiveId)
    );
    const needsPhoto = isMyInvoice && !inv.closurePhoto && inv.approvalStatus === 'approved';
    return `
    <div class="task-card" onclick="openInvoiceFromTab(${inv.id})">
      <div class="task-card-header">
        <span class="task-dept">${inv.invoiceNo}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${needsPhoto ? `<span style="font-size:10px;background:rgba(200,151,43,0.2);color:var(--gold);padding:2px 6px;border-radius:8px">📸 Add Photo</span>` : ''}
          <span class="badge" style="background:${isPendingApproval?'var(--gold)':isFullyDispatched?'#22c55e':'#378ADD'}">
            ${isPendingApproval ? '⏳ Pending' : isFullyDispatched ? '✓ Dispatched' : isPaymentVerified ? '✓ Verified' : 'Active'}
          </span>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text3);margin:3px 0">${cust ? cust.name+' · ' : ''}${new Date(inv.date).toLocaleDateString('en-IN')}${inv.creditSale ? ' · <span style="color:var(--gold)">Credit</span>' : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <div style="font-weight:700;font-size:14px">₹${inv.total.toLocaleString('en-IN')}</div>
        <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
          <button class="btn-sm" onclick="printInvoice(${JSON.stringify(inv).replace(/"/g,'&quot;')},${inv.customerId||'null'})">🖨 Print</button>
          ${!isPendingApproval && !isPaymentVerified ? `<button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_DISPATCH.openAccountsVerify(${inv.id})">💳 Accounts</button>` : ''}
          ${isPaymentVerified && !isFullyDispatched ? `<button class="btn-sm" style="background:#378ADD;color:#fff" onclick="VW_DISPATCH.openDispatchDetail(${inv.id})">📦 Dispatch</button>` : ''}
          ${isFullyDispatched ? `<button class="btn-sm" style="background:#22c55e;color:#fff" onclick="VW_DISPATCH.openDispatchDetail(${inv.id})">✓ View</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function searchInvoicesTab(value) {
  const invoices = window._allInvoicesCache || [];
  const custMap = window._invoiceCustMapCache || {};
  const term = value.toLowerCase();
  const filtered = term ? invoices.filter(inv => {
    const cust = custMap[inv.customerId];
    return inv.invoiceNo.toLowerCase().includes(term) || (cust && (cust.name||'').toLowerCase().includes(term)) || (cust && (cust.phone||'').includes(term));
  }) : invoices;
  const sorted = [...filtered].sort((a,b) => new Date(b.date) - new Date(a.date));
  document.getElementById('invoices-tab-list').innerHTML = renderInvoicesTabList(sorted, custMap);
}
window.searchInvoicesTab = searchInvoicesTab;

async function currentUserCanApproveInvoice(inv) {
  if (!inv.approvalLog || !inv.approvalLog.length) return false;
  const last = inv.approvalLog[inv.approvalLog.length - 1];
  if (!last || last.status !== 'pending') return false;
  if (VW_AUTH.isAdmin()) return true;

  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return false;

  if (last.level === 'tl') {
    return (last.staffIds||[]).includes(profile.staffId) && profile.staffRef === 'staff';
  }
  const contacts = await VW_DB.getSetting('escalationContacts', {});
  const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager', management: 'management' };
  const contact = contacts[keyMap[last.level]] || {};
  return contact.phone && contact.phone.replace(/\D/g,'').slice(-10) === (profile.phone||'').replace(/\D/g,'').slice(-10);
}
window.currentUserCanApproveInvoice = currentUserCanApproveInvoice;

async function openInvoiceFromTab(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  const sheet = document.getElementById('bottom-sheet');
  const isPending = inv.approvalStatus === 'pending_approval';
  const isRejected = inv.approvalStatus === 'rejected';
  const canApprove = isPending && await currentUserCanApproveInvoice(inv);
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${inv.invoiceNo}</h3>
    <p class="sheet-meta">${customer ? customer.name+' · '+customer.phone+' · ' : ''}${new Date(inv.date).toLocaleDateString('en-IN')}</p>
    <div class="req-item-card" style="margin:10px 0">
      <div style="font-size:13px">Total: <strong>₹${inv.total.toLocaleString('en-IN')}</strong></div>
      ${inv.salesExecutiveName ? `<div style="font-size:12px;margin-top:4px">👤 Sales: <strong>${inv.salesExecutiveName}</strong></div>` : ''}
      ${inv.createdByName && inv.createdByName !== inv.salesExecutiveName ? `<div style="font-size:12px;color:var(--text3);margin-top:2px">💳 Billed by: ${inv.createdByName}</div>` : ''}
      ${inv.creditSale ? `<div style="font-size:12px;color:var(--gold);margin-top:4px">📝 Credit Sale</div>` : ''}
      ${inv.advanceAmount ? `<div style="font-size:12px;margin-top:2px">Advance: ₹${inv.advanceAmount.toLocaleString('en-IN')}</div>` : ''}
      ${inv.paymentMethod && inv.paymentMethod !== 'pending' ? `<div style="font-size:12px;margin-top:2px">Paid via ${inv.paymentMethod}</div>` : ''}
      ${inv.cashDiscountAmt ? `<div style="font-size:12px;color:var(--green);margin-top:2px">Cash discount: −₹${inv.cashDiscountAmt.toLocaleString('en-IN')}</div>` : ''}
      ${isPending ? `<div style="font-size:12px;color:var(--gold);margin-top:6px">⏳ Pending Approval — can't print or send yet</div>` : ''}
      ${isRejected ? `<div style="font-size:12px;color:var(--red);margin-top:6px">✕ Rejected — needs to be redone</div>` : ''}
    </div>
    ${canApprove ? `
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button class="btn-primary" onclick="approveInvoiceStepUI(${inv.id})">✓ Approve</button>
      <button class="btn-secondary" style="color:var(--red)" onclick="promptRejectInvoice(${inv.id})">✕ Reject</button>
    </div>` : ''}
    ${isPending || isRejected ? '' : `
    <button class="btn-primary full-width" onclick="showPrintCopyChecklist(${inv.id})">🖨 Reprint</button>
    <button class="btn-wa full-width" style="margin-top:8px" onclick="sendInvoiceToCustomer(${inv.id})">💬 Send to Customer</button>
    ${inv.dispatchedAt
      ? `<div style="font-size:12px;color:var(--green);margin-top:8px">✓ Dispatched ${new Date(inv.dispatchedAt).toLocaleString('en-IN')} by ${inv.dispatchedByName||'—'}</div>`
      : `<button class="btn-secondary full-width" style="margin-top:8px" onclick="startDispatchScan(${inv.id})">📦 Dispatch — Scan to Confirm</button>`}
    ${inv.closurePhoto ? `
      <div style="margin-top:12px">
        <p style="font-size:12px;color:var(--text3);margin-bottom:6px">📸 Happy Moment — ${inv.closurePhotoBy||'—'} · ${inv.closurePhotoAt ? new Date(inv.closurePhotoAt).toLocaleDateString('en-IN') : ''}</p>
        <img src="${inv.closurePhoto}" style="width:100%;border-radius:10px;border:2px solid var(--gold);max-height:220px;object-fit:cover">
      </div>` :
      (() => {
        const currentProfile = VW_AUTH.getCurrentProfile();
        // Either the cashier who created the invoice OR the credited sales executive
        // can add the closure photo — first one to add it closes the option
        const isCreator = currentProfile && inv.createdByProfileId && currentProfile.id === inv.createdByProfileId;
        const isSalesExec = currentProfile && inv.salesExecutiveId && currentProfile.id === inv.salesExecutiveId;
        const canAddPhoto = isCreator || isSalesExec || (VW_AUTH.isAdmin() && !inv.createdByProfileId);
        if (canAddPhoto) {
          return `<div style="margin-top:12px;padding:10px;background:rgba(200,151,43,0.08);border:1px solid rgba(200,151,43,0.3);border-radius:8px;text-align:center">
            <p style="font-size:12px;color:var(--gold);margin-bottom:8px">📸 No happy moment photo yet</p>
            <button class="btn-sm" style="background:var(--gold);color:#000;width:100%" onclick="VW_FEATURES.showClosurePhotoPrompt(${inv.id},'${inv.invoiceNo}','${customer?.name||'Customer'}')">📷 Add Happy Moment Photo</button>
          </div>`;
        }
        return '';
      })()}
    `}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.openInvoiceFromTab = openInvoiceFromTab;

// ===== DISPATCH: scan-to-confirm before goods leave =====
// Tracks how many units of each invoice line have been scanned so far in
// this dispatch session. Kept in memory only (window._dispatchProgress)
// since a dispatch session is a single continuous activity, not
// something that needs to survive a page reload mid-way.
function startDispatchScan(invId) {
  VW_DB.getById(VW_DB.STORES.invoices, invId).then(inv => {
    if (!inv) return;
    window._dispatchInvoice = inv;
    window._dispatchProgress = {}; // productId -> scanned count so far
    renderDispatchSheet();
  });
}
window.startDispatchScan = startDispatchScan;

function renderDispatchSheet(flashMessage) {
  const inv = window._dispatchInvoice;
  const progress = window._dispatchProgress || {};
  if (!inv) return;
  const allMatched = inv.items.every(it => (progress[it.productId]||0) >= it.qty);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Dispatch — ${inv.invoiceNo}</h3>
    <p class="sheet-meta">Scan each item as it's loaded. Quantities must match the invoice before this can be confirmed.</p>
    ${flashMessage ? `<div style="font-size:12px;padding:6px;border-radius:6px;margin-bottom:8px;background:${flashMessage.ok?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)'};color:${flashMessage.ok?'var(--green)':'var(--red)'}">${flashMessage.text}</div>` : ''}
    <div style="margin-bottom:10px">
      ${inv.items.map(it => {
        const got = progress[it.productId] || 0;
        const done = got >= it.qty;
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px">${it.name}</span>
          <span style="font-size:13px;font-weight:600;color:${done?'var(--green)':(got>0?'var(--gold)':'var(--text3)')}">${got} / ${it.qty} ${it.unit||''}${done?' ✓':''}</span>
        </div>`;
      }).join('')}
    </div>
    <button class="btn-primary full-width" onclick="scanForDispatch(${inv.id})">📷 Scan Item</button>
    ${allMatched ? `<button class="btn-primary full-width" style="margin-top:8px" onclick="confirmDispatch(${inv.id})">✓ Confirm Dispatch</button>` : ''}
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="openInvoiceFromTab(${inv.id})">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.renderDispatchSheet = renderDispatchSheet;

function scanForDispatch(invId) {
  const inv = window._dispatchInvoice;
  if (!inv || inv.id !== invId) return;
  openQrScanner(async (code) => {
    const product = await findProductByScannedCode(code);
    const progress = window._dispatchProgress || {};

    if (!product) {
      renderDispatchSheet({ ok: false, text: '⚠️ No product matches that code' });
      return;
    }
    const line = inv.items.find(it => it.productId === product.id);
    if (!line) {
      renderDispatchSheet({ ok: false, text: `⚠️ Discrepancy: ${product.name} is not on this invoice` });
      return;
    }
    const already = progress[product.id] || 0;
    if (already >= line.qty) {
      renderDispatchSheet({ ok: false, text: `⚠️ Discrepancy: already scanned the full quantity for ${product.name} (${line.qty} ${line.unit||''}) — scanning more would exceed what was billed` });
      return;
    }
    progress[product.id] = already + 1;
    window._dispatchProgress = progress;
    renderDispatchSheet({ ok: true, text: `✓ ${product.name} (${progress[product.id]}/${line.qty})` });
  }, { title: 'Dispatch Scan', subtitle: 'Scan the item being loaded.' });
}
window.scanForDispatch = scanForDispatch;

async function confirmDispatch(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  const profile = VW_AUTH.getCurrentProfile();
  inv.dispatchedAt = new Date().toISOString();
  inv.dispatchedByName = profile ? profile.name : '';
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  window._dispatchInvoice = null;
  window._dispatchProgress = null;
  showToast('Dispatch confirmed', 'success');
  closeSheet();
  navigateTo('cart');
}
window.confirmDispatch = confirmDispatch;

async function sendInvoiceToCustomer(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  if (!customer?.phone) { showToast('No customer phone number on this invoice', 'warn'); return; }
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';

  // Build full formatted invoice message
  const lines = (inv.items||[]).filter(i => !i.isFreeGift).map((item, idx) =>
    `${idx+1}. ${[item.brand, item.model, item.name].filter(Boolean).join(' ')} — ${item.qty} ${item.unit||'pc'} × ₹${(item.price||0).toLocaleString('en-IN')} = *₹${Math.round((item.price||0)*(item.qty||1)).toLocaleString('en-IN')}*`
  );
  const freeItems = (inv.items||[]).filter(i => i.isFreeGift);

  let msg = `🧾 *Invoice — ${inv.invoiceNo}*\n`;
  msg += `📅 ${new Date(inv.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}\n`;
  msg += `🏠 *${storeName}, Vijayawada*\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `*Bill To:* ${customer.name}\n`;
  if (customer.phone) msg += `📞 ${customer.phone}\n`;
  if (inv.vehicleNumber) msg += `🚗 Vehicle: ${inv.vehicleNumber}\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `*Items:*\n${lines.join('\n')}\n`;
  if (freeItems.length) msg += `🎁 Free Gift: ${freeItems.map(i=>i.name).join(', ')}\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;
  if (inv.subtotal && inv.gstAmt) {
    msg += `Subtotal: ₹${Math.round(inv.subtotal).toLocaleString('en-IN')}\n`;
    msg += `GST: ₹${Math.round(inv.gstAmt).toLocaleString('en-IN')}\n`;
  }
  if (inv.cashDiscountAmt) msg += `Discount: −₹${inv.cashDiscountAmt.toLocaleString('en-IN')}\n`;
  msg += `*TOTAL: ₹${Math.round(inv.total).toLocaleString('en-IN')}*\n`;
  msg += `Payment: ${inv.creditSale ? '💳 Credit Sale' : inv.paymentMethod||'Cash'}\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `Thank you for shopping with us! 🙏\nFor queries: wa.me/918712697930`;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>💬 Send Invoice to Customer</h3>
    <p class="sheet-meta">${customer.name} · ${customer.phone}</p>
    <div style="background:var(--bg2);border-radius:10px;padding:12px;font-size:12px;white-space:pre-wrap;max-height:260px;overflow-y:auto;margin-bottom:12px;line-height:1.6;color:var(--text2)">${msg.replace(/\*/g,'')}</div>
    <div style="display:flex;gap:8px">
      <button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/91${customer.phone.replace(/\D/g,'')}?text='+encodeURIComponent(${JSON.stringify(msg)}),'_blank');closeSheet()">
        💬 Send via WhatsApp
      </button>
      <button class="btn-secondary" onclick="printInvoice(${JSON.stringify(inv).replace(/"/g,'&quot;')},${inv.customerId||'null'});closeSheet()">
        🖨 Print PDF
      </button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.sendInvoiceToCustomer = sendInvoiceToCustomer;

// The print copy checklist — Original/Accounts always offered, Transport
// pre-ticked ONLY when this invoice actually has a vehicle number (no
// point printing a transport copy for a walk-in counter sale), Dispatch
// and Gate Pass always available but unticked by default.
const PRINT_COPY_TYPES = [
  { key: 'original', label: 'Original Copy (Customer)' },
  { key: 'accounts', label: 'Accounts Copy' },
  { key: 'transport', label: 'Transport Copy' },
  { key: 'dispatch', label: 'Dispatch Copy' },
  { key: 'gatepass', label: 'Security Gate Pass' }
];

async function showPrintCopyChecklist(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  const hasVehicle = !!(inv.vehicleNumber && inv.vehicleNumber.trim());
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Print Copies — ${inv.invoiceNo}</h3>
    ${!hasVehicle ? `<p class="sheet-meta">No vehicle number on this invoice — Transport Copy is available but not pre-selected.</p>` : ''}
    <div id="print-copy-checklist">
      ${PRINT_COPY_TYPES.map(t => `
        <label class="route-check-row">
          <input type="checkbox" id="copy-${t.key}" ${(t.key==='original'||t.key==='accounts') ? 'checked' : (t.key==='transport' && hasVehicle) ? 'checked' : ''}>
          <span>${t.label}</span>
        </label>`).join('')}
    </div>
    <button class="btn-primary full-width" style="margin-top:10px" onclick="confirmPrintSelectedCopies(${invId})">🖨 Print Selected</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showPrintCopyChecklist = showPrintCopyChecklist;

async function confirmPrintSelectedCopies(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  if (!inv) return;
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  const selected = PRINT_COPY_TYPES.filter(t => document.getElementById(`copy-${t.key}`)?.checked);
  if (!selected.length) return showToast('Select at least one copy to print', 'warn');

  for (const t of selected) {
    if (t.key === 'original') printInvoice(inv, inv.customerId);
    else printDeliveryCopy(inv, inv.customerId, t.key, t.label);
  }
  closeSheet();
}
window.confirmPrintSelectedCopies = confirmPrintSelectedCopies;




/* === quotations.js === */

const DEFAULT_QUOTE_TERMS = `TRANSPORT EXTRA
ADVANCE 50% PAYMENT AT THE TIME OF CONFIRMATION
BALANCE 50% PAYMENT BEFORE DELIVERY`;

// GST slabs as of the Sept 2025 "GST 2.0" reform are 0% (Exempted/NIL), 5%,
// 18%, and 40%. The 12% and 28% legacy slabs are kept here too since some
// existing products/invoices may still reference them.
// Customer Name + phone are what staff actually recognize someone by —
// Site Name (often blank, or just a job-site description) is only ever
// shown as a last resort when neither is available. Centralized here so
// every list/label across the app stays consistent rather than each
// place rolling its own fallback chain.
function quoteDisplayLabel(q) {
  if (q.customerName && q.contact) return `${q.customerName} · ${q.contact}`;
  if (q.customerName) return q.customerName;
  if (q.contact) return q.contact;
  return q.siteName || '—';
}

const GST_SLABS = [
  { value: 'exempted', pct: 0, label: 'Exempted (0%)' },
  { value: 'nil', pct: 0, label: 'NIL Rated (0%)' },
  { value: '5', pct: 5, label: '5%' },
  { value: '12', pct: 12, label: '12% (legacy)' },
  { value: '18', pct: 18, label: '18%' },
  { value: '28', pct: 28, label: '28% (legacy)' },
  { value: '40', pct: 40, label: '40%' }
];

let quoteItems = [];
let quoteEditingId = null;
let quoteHeaderDraft = { siteName:'', customerName:'', address:'', contact:'', area:'', deliveryAddress:'', otherContactName:'', otherContactNumber:'', customFields: [], terms: DEFAULT_QUOTE_TERMS };
let quoteBrandList = [];   // distinct brands seen in Inventory
let quoteModelsByBrand = {}; // brand -> [models]
let quoteStockByKey = {}; // "brand|model" -> live available stock (real Inventory only)
let quoteExpandedId = null; // id of the one item currently shown in full (others collapse to a summary row)
let isApproverEditingPending = false; // true when an approver (not the original maker) opened Edit on a pending_approval quotation
let quoteBeforeEditSnapshot = null; // deep copy of items/totals at the moment Edit was opened, used to build the audit diff
let _approverDeptFilter = null; // when a department TL opens a multi-department quote for approval, this holds THEIR department(s); the items list then shows only their lines (they approve only their category). null = show every line (maker, or FM/SM/Management seeing the merged quote).

async function loadQuoteBrandData() {
  const [products, pending] = await Promise.all([
    VW_DB.all(VW_DB.STORES.products),
    VW_DB.all(VW_DB.STORES.pendingProducts)
  ]);
  const brandSet = new Set();
  const modelMap = {};
  const addEntry = (brand, model) => {
    if (!brand) return;
    brandSet.add(brand);
    if (model) {
      modelMap[brand] = modelMap[brand] || new Set();
      modelMap[brand].add(model);
    }
  };
  products.forEach(p => addEntry(p.brand, p.model));
  // Pending (not-yet-approved) items still appear in the dropdown — they
  // just aren't real Inventory products until Inventory approves them.
  pending.forEach(p => addEntry(p.brand, p.model));
  quoteBrandList = [...brandSet].sort();
  quoteModelsByBrand = {};
  Object.entries(modelMap).forEach(([b, set]) => { quoteModelsByBrand[b] = [...set].sort(); });

  // Stock only comes from real Inventory products (pending ones have no
  // real stock yet by definition) minus anything currently on hold for a
  // paid quotation (Stage 3), keyed by brand+model.
  quoteStockByKey = {};
  products.forEach(p => {
    if (!p.brand) return;
    const key = `${p.brand}|${p.model||''}`;
    quoteStockByKey[key] = (quoteStockByKey[key] || 0) + (parseFloat(p.stock) || 0) - (parseFloat(p.heldStock) || 0);
  });
}

function renderQuoteStockIndicator(item) {
  if (!item.brand || !item.model) return ''; // nothing to look up yet
  const key = `${item.brand}|${item.model}`;
  if (!(key in quoteStockByKey)) return ''; // brand/model not in real Inventory yet (e.g. pending or freshly typed)

  const stock = quoteStockByKey[key];
  let color, label;
  if (stock > 0) { color = 'var(--green)'; label = `${stock} in stock`; }
  else if (stock === 0) { color = 'var(--red)'; label = 'Out of stock'; }
  else { color = '#7a0000'; label = `${stock} — oversold, procurement needed`; } // dark red, more severe than the standard red

  return `<div style="font-size:13px;font-weight:600;color:${color};margin:-6px 0 10px 2px">📦 ${label}</div>`;
}

function captureQuoteHeader() {
  const site = document.getElementById('q-site');
  if (!site) return;
  quoteHeaderDraft = {
    siteName: document.getElementById('q-site').value,
    customerName: document.getElementById('q-name').value,
    address: document.getElementById('q-address').value,
    contact: document.getElementById('q-contact').value,
    terms: document.getElementById('q-terms').value
  };
}

// ---------- PRICING ----------
// Every pricing mode below must produce a GST-INCLUSIVE netPrice — this
// is the one rule the whole app (Cart, Invoice, printed receipts) relies
// on downstream. Previously mrp_disc was exclusive while cost_margin
// (with addGst) and mrp_disc_gst were inclusive, with no record of which
// was which once the price left this screen — that mismatch is what
// caused GST to sometimes get added a second time at billing. GST is
// broken out separately wherever it needs to be shown/filed, but it is
// never added on top of a netPrice again anywhere else in the app.
function computeLine(item) {
  let netPrice = 0;
  const gstPct = parseFloat(item.gstPct) || 0;
  if (item.mode === 'cost_margin') {
    // Cost + margin gives GST-exclusive selling price, then GST added on top
    const sp = (parseFloat(item.costPrice)||0) * (1 + (parseFloat(item.marginPct)||0)/100);
    netPrice = item.addGst ? sp * (1 + gstPct/100) : sp;
  } else if (item.mode === 'direct') {
    // Directly typed price — taken as-is, GST-inclusive
    netPrice = parseFloat(item.directPrice) || 0;
  } else if (item.mode === 'mrp_disc_gst') {
    // MRP is GST-EXCLUSIVE base price — apply discount then add GST
    // Use case: manufacturer base price list, need to add GST on top
    const base = (parseFloat(item.mrp)||0) * (1 - (parseFloat(item.discPct)||0)/100);
    const slab = GST_SLABS.find(g => g.value === item.gstSlab);
    const slabPct = slab ? slab.pct : 0;
    netPrice = base * (1 + slabPct/100);
  } else {
    // mrp_disc (default) — MRP is GST-INCLUSIVE retail price
    // Customer price = MRP minus discount — GST is already baked in, do NOT add again
    netPrice = (parseFloat(item.mrp)||0) * (1 - (parseFloat(item.discPct)||0)/100);
  }
  const total = netPrice * (parseFloat(item.qty)||0);
  return { netPrice, total };
}

function quoteGrandTotal() {
  return quoteItems.reduce((s,it) => s + computeLine(it).total, 0);
}

// ---------- LIST VIEW ----------
async function renderQuotationsTab() {
  const quotes = await VW_DB.all(VW_DB.STORES.quotations);
  quotes.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  const counts = { draft:0, sent:0, converted:0 };
  quotes.forEach(q => { counts[q.status] = (counts[q.status]||0)+1; });

  const pendingApprovalForMe = [];
  for (const q of quotes) {
    if (q.approvalStatus === 'pending_approval' && await currentUserCanApprove(q)) pendingApprovalForMe.push(q);
  }

  const profile = VW_AUTH.getCurrentProfile();
  const isQuotationDeptMember = profile && (profile.isQuotationDept || (Array.isArray(profile.permissions) && profile.permissions.includes('billing')) || VW_AUTH.isAdmin());
  let quoteRequests = [];
  if (isQuotationDeptMember) {
    const visits = await VW_DB.all(VW_DB.STORES.visits);
    quoteRequests = visits.filter(v => v.quoteRequestStatus === 'pending');
  }

  return `
  ${quoteRequests.length ? `
  <div class="alert-card">
    <div class="alert-title">📋 ${quoteRequests.length} Quote Request${quoteRequests.length>1?'s':''} from Visits</div>
    ${quoteRequests.map(v => `
      <div class="cust-row" onclick="openVisitQuoteRequest(${v.id})">
        <div class="cust-info"><div class="cust-name">${v.customerName||'Customer'}</div><div class="cust-meta">${new Date(v.date||v.createdAt).toLocaleDateString('en-IN')}${v.existingQuoteOcr ? ' &middot; OCR ready' : ' &middot; Processing photo...'}</div></div>
      </div>`).join('')}
  </div>` : ''}
  ${pendingApprovalForMe.length ? `
  <div class="alert-card">
    <div class="alert-title">📝 ${pendingApprovalForMe.length} Quotation${pendingApprovalForMe.length>1?'s':''} Awaiting Your Approval</div>
    ${pendingApprovalForMe.map(q => `
      <div class="cust-row" onclick="openQuotationDetail(${q.id})">
        <div class="cust-info"><div class="cust-name">${q.quoteNo}</div><div class="cust-meta">${quoteDisplayLabel(q)} &middot; ₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</div></div>
      </div>`).join('')}
  </div>` : ''}
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Quotations</h3>
      <button class="btn-sm" onclick="showNewQuotationEntry()">+ New Quotation</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px">
      <button class="btn-sm" style="background:var(--gold-muted);border-color:var(--gold);color:var(--gold);white-space:nowrap" onclick="navigateTo('tiles')">🏠 Tiles Quote</button>
      <button class="btn-sm" style="background:var(--gold-muted);border-color:var(--gold);color:var(--gold);white-space:nowrap" onclick="navigateTo('granite')">🪨 Granite Quote</button>
    </div>
    <div class="stat-row" style="margin-bottom:10px">
      <div class="stat"><span class="stat-num">${counts.draft||0}</span><span class="stat-label">Draft</span></div>
      <div class="stat"><span class="stat-num">${counts.sent||0}</span><span class="stat-label">Sent</span></div>
      <div class="stat"><span class="stat-num">${counts.converted||0}</span><span class="stat-label">Converted</span></div>
    </div>
    <input type="text" id="quote-search" placeholder="🔍 Search by customer / site name" oninput="filterQuotationsList()" style="margin-bottom:10px">
    <div id="quotations-list">${renderQuotationsList(quotes)}</div>
  </div>
  `;
}

function renderQuotationsList(quotes) {
  if (!quotes.length) return '<p class="empty-msg">No quotations yet — tap "+ New Quotation"</p>';
  const statusColors = { draft:'#888', sent:'#378ADD', converted:'#22c55e' };
  const statusLabels = { draft:'Draft', sent:'Sent', converted:'Converted to Bill' };
  const approvalColors = { pending_approval: 'var(--gold)', approved: '#22c55e', rejected: 'var(--red)' };
  const approvalLabels = { pending_approval: 'Awaiting Approval', approved: 'Approved', rejected: 'Rejected — Edit Needed' };

  // Group by customer
  const grouped = {};
  quotes.forEach(q => {
    const key = q.customerName || 'Walk-in / Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(q);
  });

  return Object.entries(grouped).map(([custName, custQuotes]) => `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;padding:0 2px">
        👤 ${custName} <span style="font-weight:400">(${custQuotes.length})</span>
      </div>
      ${custQuotes.map(q => {
        const badgeColor = q.status === 'converted' ? statusColors.converted : q.approvalStatus ? approvalColors[q.approvalStatus] : statusColors[q.status];
        const badgeLabel = q.status === 'converted' ? statusLabels.converted : q.approvalStatus ? (approvalLabels[q.approvalStatus] || q.approvalStatus) : (statusLabels[q.status]||q.status);
        const isConverted = q.status === 'converted';
        const isApproved = q.approvalStatus === 'approved';
        return `
        <div class="task-card" onclick="openQuotationDetail(${q.id})">
          <div class="task-card-header">
            <span class="task-dept">${q.quoteNo || 'Q-'+q.id} &middot; ${quoteDisplayLabel(q)}</span>
            <span class="task-stage" style="color:${badgeColor||'#888'}">${badgeLabel}</span>
          </div>
          <div class="task-desc">${(q.items||[]).length} item${(q.items||[]).length!==1?'s':''} &middot; ${new Date(q.date||q.createdAt).toLocaleDateString('en-IN')}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <div class="task-meta">₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</div>
            <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
              ${!isConverted ? `<button class="btn-sm" onclick="editQuotation(${q.id})">✏️ Edit</button>` : ''}
              <button class="btn-sm" onclick="printQuotation(${q.id})">🖨 Print</button>
              ${isApproved && !isConverted ? `<button class="btn-sm" style="background:var(--gold);color:#000" onclick="closeSheet();pullQuotationIntoCart(${q.id})">🧾 Bill</button>` : ''}
              ${!isConverted && !isApproved ? `<button class="btn-sm" onclick="saveQuotation('sent')" style="background:#25D366;color:#fff">📤 Send</button>` : ''}
              ${isConverted ? `<button class="btn-sm" onclick="VW_DISPATCH.openDispatchDetail(${q.invoiceId})" style="background:#378ADD;color:#fff">📦 Track</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

async function filterQuotationsList() {
  const search = (document.getElementById('quote-search')?.value || '').toLowerCase().trim();
  const quotes = await VW_DB.all(VW_DB.STORES.quotations);
  quotes.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  const filtered = search ? quotes.filter(q =>
    (q.siteName||'').toLowerCase().includes(search) ||
    (q.customerName||'').toLowerCase().includes(search) ||
    (q.quoteNo||'').toLowerCase().includes(search)
  ) : quotes;
  document.getElementById('quotations-list').innerHTML = renderQuotationsList(filtered);
}

// ---------- NEW / EDIT FORM ----------
function showNewQuotationEntry() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Quotation</h3>
    <p class="sheet-meta">Got a list from the customer, or starting from scratch?</p>
    <div class="sheet-actions">
      <button class="btn-primary full-width" onclick="closeSheet();quoteOcrPhotos=[];triggerQuoteOcrUpload('camera')">📷 Take Photo of List</button>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet();quoteOcrPhotos=[];triggerQuoteOcrUpload('file')">📁 Upload Document/Photo</button>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet();newQuotation()">✏️ Create Manually</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showNewQuotationEntry = showNewQuotationEntry;

async function newQuotation() {
  quoteEditingId = null;
  quoteItems = [];
  quoteExpandedId = null;
  isApproverEditingPending = false;
  _approverDeptFilter = null;
  quoteHeaderDraft = { siteName:'', customerName:'', address:'', contact:'', area:'', deliveryAddress:'', otherContactName:'', otherContactNumber:'', customFields: [], terms: DEFAULT_QUOTE_TERMS };
  await getCategories();
  await loadQuoteBrandData();
  showQuoteForm();
}

// ===== OCR-TO-QUOTATION (handwritten/printed customer list) =====
let quoteOcrPhotos = []; // array of { dataUrl, base64, mediaType }

function triggerQuoteOcrUpload(mode) {
  quoteOcrPhotos = quoteOcrPhotos || [];
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (mode === 'camera') {
    // capture + multiple together are unreliable on many mobile browsers
    // (several silently fall back to the file picker instead of opening
    // the camera) — so camera mode takes exactly one photo per launch.
    // "+ Add Another Page" re-triggers this for additional shots.
    input.capture = 'environment';
  } else {
    input.multiple = true;
  }
  input.onchange = (e) => handleQuoteOcrFiles([...e.target.files]);
  input.click();
}
window.triggerQuoteOcrUpload = triggerQuoteOcrUpload;

async function handleQuoteOcrFiles(files) {
  if (!files.length) return;
  for (const file of files) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const [header, base64] = dataUrl.split(',');
    const mediaType = (header.match(/data:(.*?);base64/)||[])[1] || 'image/jpeg';
    quoteOcrPhotos.push({ dataUrl, base64, mediaType });
  }
  showQuoteOcrPreviewAndConfirm();
}

function showQuoteOcrPreviewAndConfirm() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Reading the List...</h3>
    <p class="sheet-meta">${quoteOcrPhotos.length} photo(s) ready. Add more pages if the list continues, or scan now.</p>
    <div class="photo-preview-row">
      ${quoteOcrPhotos.map((p,i) => `<div class="photo-thumb"><img src="${p.dataUrl}"><button onclick="removeQuoteOcrPhoto(${i})">✕</button></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-secondary full-width" onclick="triggerQuoteOcrUpload('camera')">📷 + Page</button>
      <button class="btn-secondary full-width" onclick="triggerQuoteOcrUpload('file')">📁 + Page</button>
    </div>
    <button class="btn-primary full-width" style="margin-top:8px" onclick="runQuoteItemsOcr()">🔍 Scan This List</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function removeQuoteOcrPhoto(idx) {
  quoteOcrPhotos.splice(idx, 1);
  if (!quoteOcrPhotos.length) { closeSheet(); return; }
  showQuoteOcrPreviewAndConfirm();
}
window.removeQuoteOcrPhoto = removeQuoteOcrPhoto;

async function runQuoteItemsOcr() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `<div class="sheet-handle"></div><h3>Reading the list...</h3><p class="sheet-meta">This can take a few moments for handwritten or multi-page lists.</p><div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-quote-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ images: quoteOcrPhotos.map(p => ({ base64: p.base64, mediaType: p.mediaType })) })
    });
    const result = await res.json();
    if (!res.ok) {
      showToast(result.error || 'OCR failed — try creating the quotation manually', 'warn');
      closeSheet();
      return;
    }
    await buildQuoteFromOcrResult(result.data);
  } catch (e) {
    console.error('Quote OCR error:', e);
    showToast('Something went wrong reading the list — try manual entry instead', 'warn');
    closeSheet();
  }
}
window.runQuoteItemsOcr = runQuoteItemsOcr;

async function buildQuoteFromOcrResult(ocrData) {
  await getCategories();
  await loadQuoteBrandData();
  const products = await VW_DB.all(VW_DB.STORES.products);
  const depts = Object.keys(currentCategories || DEFAULT_CATEGORIES);

  // Load learned items for smart matching
  let learned = [];
  try {
    const { data } = await VW_DB.client.from('ocr_learned_items').select('*').order('match_count', { ascending: false }).limit(300);
    learned = data || [];
  } catch(e) { /* table may not exist yet */ }

  quoteEditingId = null;
  quoteExpandedId = null;
  quoteItems = (ocrData.items||[]).map(it => {
    const rawText = (it.rawText || it.description || '').toLowerCase().trim();
    // Smart match: check learned items first
    const learnedMatch = learned.find(l => {
      const lt = (l.raw_text||'').toLowerCase().trim();
      return lt && rawText && (lt === rawText || rawText.includes(lt) || lt.includes(rawText));
    });
    // Catalog match by brand
    const match = it.brand ? products.find(p => p.brand && p.brand.toLowerCase() === it.brand.toLowerCase()) : null;
    // Fuzzy product name match
    const nameMatch = !match && rawText.length > 4 ? products.find(p =>
      p.name.toLowerCase().includes(rawText.slice(0,8)) || rawText.includes(p.name.toLowerCase().slice(0,8))
    ) : null;
    const bestMatch = match || nameMatch;
    const isSmartMatch = !!learnedMatch;
    if (isSmartMatch) {
      // Update match count asynchronously
      VW_DB.client.from('ocr_learned_items')
        .update({ match_count: (learnedMatch.match_count||1)+1, last_used_at: new Date().toISOString() })
        .eq('id', learnedMatch.id).then(()=>{});
    }
    return {
      id: Date.now()+Math.random(),
      brand: it.brand || (learnedMatch?.matched_brand) || (bestMatch?.brand) || '',
      model: bestMatch ? bestMatch.model : (learnedMatch?.matched_model) || '',
      productCode: '',
      description: it.description || it.rawText || '',
      department: (bestMatch ? bestMatch.category : depts[0]) || '',
      qty: it.qty || 1, unit: it.unit || (learnedMatch?.matched_unit) || 'pc',
      mode: 'mrp_disc',
      mrp: bestMatch ? bestMatch.price : (learnedMatch?.matched_price) || '',
      discPct: 0,
      costPrice: '', marginPct: '', addGst: false,
      gstPct: bestMatch ? (bestMatch.gst||18) : 18,
      gstSlab: String(bestMatch ? (bestMatch.gst||18) : 18),
      directPrice: '',
      brandMode: bestMatch ? 'select' : (it.brand ? 'new' : 'new'),
      modelMode: bestMatch ? 'select' : 'new',
      ocrConfidence: isSmartMatch ? 'high' : (it.confidence || 'medium'),
      ocrRawText: it.rawText || '',
      smartMatched: isSmartMatch,
    };
  });

  quoteHeaderDraft = {
    siteName: '', customerName: ocrData.customerName || '', address: '', contact: ocrData.customerPhone || '',
    area: '', deliveryAddress: '', otherContactName: '', otherContactNumber: '', customFields: [], terms: DEFAULT_QUOTE_TERMS
  };

  closeSheet();
  showQuoteForm();

  const lowConfCount = quoteItems.filter(it => it.ocrConfidence === 'low').length;
  if (lowConfCount) {
    showToast(`${lowConfCount} item(s) need a closer look — highlighted in the list below`, 'warn');
  } else {
    showToast(`Read ${quoteItems.length} item(s) from the list — please review before sending`, 'success');
  }
  if (ocrData.unclearNotes) {
    setTimeout(() => showToast(ocrData.unclearNotes, 'info'), 3500);
  }
}

async function editQuotation(id) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, id);
  if (q && q.status === 'converted') {
    return showToast("This quotation has already been converted to an invoice and can't be edited anymore", 'warn');
  }
  quoteEditingId = id;
  quoteItems = JSON.parse(JSON.stringify(q.items || []));
  quoteExpandedId = null;
  quoteHeaderDraft = { siteName: q.siteName||'', customerName: q.customerName||'', address: q.address||'', contact: q.contact||'', area: q.area||'', deliveryAddress: q.deliveryAddress||'', otherContactName: q.otherContactName||'', otherContactNumber: q.otherContactNumber||'', customFields: JSON.parse(JSON.stringify(q.customFields || [])), terms: q.terms || DEFAULT_QUOTE_TERMS };
  await getCategories();
  await loadQuoteBrandData();

  // If this quotation is currently awaiting approval AND the person
  // opening Edit is the approver whose turn it currently is (not the
  // original Quotation Maker just tweaking their own draft), treat this
  // as an approver edit: they can change items/rates and approve directly
  // from here, without restarting the approval chain or going through the
  // normal draft/send flow.
  const profile = VW_AUTH.getCurrentProfile();
  const isOriginalMaker = profile && q.createdByName === profile.name;
  isApproverEditingPending = q.approvalStatus === 'pending_approval' && !isOriginalMaker && await currentUserCanApprove(q);
  quoteBeforeEditSnapshot = isApproverEditingPending ? JSON.parse(JSON.stringify(q.items || [])) : null;

  // If the approver is a department TL on a multi-department quote, restrict
  // the items list to THEIR department(s) only — each category's TL reviews
  // and re-prices just their own lines. Floor Manager / Store Manager /
  // Management (and the original maker) see the full merged quote, so the
  // filter stays null for them.
  _approverDeptFilter = null;
  if (isApproverEditingPending) {
    const myBranches = await getMyPendingTlBranches(q);
    if (myBranches.length) _approverDeptFilter = [...new Set(myBranches.map(b => b.department).filter(Boolean))];
  }

  showQuoteForm(q);
}

function renderQuoteCustomFields(fields) {
  if (!fields.length) return '';
  return fields.map((f,i) => `
    <div class="input-row" style="margin-top:6px">
      <div class="form-group" style="flex:1"><input type="text" placeholder="Field name (e.g. GST Number)" value="${f.label||''}" oninput="updateQuoteCustomField(${i},'label',this.value)"></div>
      <div class="form-group" style="flex:1.4"><input type="text" placeholder="Value" value="${f.value||''}" oninput="updateQuoteCustomField(${i},'value',this.value)"></div>
      <button class="remove-btn" style="align-self:center" onclick="removeQuoteCustomField(${i})">✕</button>
    </div>`).join('');
}

function addQuoteCustomField() {
  quoteHeaderDraft.customFields = quoteHeaderDraft.customFields || [];
  quoteHeaderDraft.customFields.push({ label: '', value: '' });
  document.getElementById('quote-custom-fields-list').innerHTML = renderQuoteCustomFields(quoteHeaderDraft.customFields);
}
window.addQuoteCustomField = addQuoteCustomField;

function updateQuoteCustomField(idx, field, value) {
  quoteHeaderDraft.customFields[idx][field] = value;
}
window.updateQuoteCustomField = updateQuoteCustomField;

function removeQuoteCustomField(idx) {
  quoteHeaderDraft.customFields.splice(idx, 1);
  document.getElementById('quote-custom-fields-list').innerHTML = renderQuoteCustomFields(quoteHeaderDraft.customFields);
}
window.removeQuoteCustomField = removeQuoteCustomField;

function showQuoteForm(q = null) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0">${q || quoteEditingId ? 'Edit Quotation' : 'New Quotation'}</h3>
      <div style="display:flex;gap:8px">
        <button class="btn-sm" onclick="saveQuotation('draft');closeSheet()" title="Save & Close">💾 Save & Close</button>
        <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer;padding:0 4px;line-height:1" title="Close without saving">✕</button>
      </div>
    </div>
    <div class="form-group">
      <label>Phone Number *</label>
      <input type="tel" id="q-contact" value="${quoteHeaderDraft.contact}" placeholder="Enter customer's phone number" maxlength="10" oninput="lookupCustomerByPhone(this.value,'quote')">
      <div id="quote-customer-lookup-status" style="font-size:12px;margin-top:4px"></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Customer Name *</label><input type="text" id="q-name" value="${quoteHeaderDraft.customerName}"></div>
      <div class="form-group" style="flex:1"><label>Site Name</label><input type="text" id="q-site" value="${quoteHeaderDraft.siteName}"></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Address</label><input type="text" id="q-address" value="${quoteHeaderDraft.address}"></div>
      <div class="form-group" style="flex:1"><label>Area</label><input type="text" id="q-area" value="${quoteHeaderDraft.area||''}" placeholder="e.g. Bhavanipuram"></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Delivery Address (if different)</label><input type="text" id="q-delivery-address" value="${quoteHeaderDraft.deliveryAddress||''}" placeholder="Leave blank if same as Address"></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Other Contact Name</label><input type="text" id="q-other-contact-name" value="${quoteHeaderDraft.otherContactName||''}" placeholder="e.g. site supervisor"></div>
      <div class="form-group" style="flex:1"><label>Other Contact Number</label><input type="tel" id="q-other-contact-number" value="${quoteHeaderDraft.otherContactNumber||''}"></div>
    </div>

    <div class="form-group">
      <div id="quote-custom-fields-list">${renderQuoteCustomFields(quoteHeaderDraft.customFields || [])}</div>
      <button class="btn-sm" style="margin-top:6px" onclick="addQuoteCustomField()">+ Add Field</button>
    </div>

    <div class="card-header-row" style="margin-top:6px">
      <h3 class="card-title">Items <span class="badge" id="qitem-count">${quoteItems.length}</span></h3>
    </div>
    <div id="quote-items-list"></div>
    ${(Array.isArray(_approverDeptFilter) && _approverDeptFilter.length) ? '' : `
    <div class="add-item-row" style="margin:6px 0">
      <button class="btn-sm" onclick="addQuoteItemFromInventory()">🔍 From Inventory</button>
      <button class="btn-sm" onclick="addQuoteItem()">✏️ Custom Item</button>
    </div>`}
    <div class="qtotal-row"><span id="quote-grand-total-label">Grand Total</span><span id="quote-grand-total">₹0</span></div>

    <div class="form-group"><label>Terms &amp; Conditions</label>
      <textarea id="q-terms" rows="3" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:10px;color:var(--text);font-family:inherit;font-size:13px">${quoteHeaderDraft.terms}</textarea>
    </div>

    <div style="display:flex;gap:8px;margin-top:10px">
      ${isApproverEditingPending ? `
        <button class="btn-primary full-width" onclick="saveApproverEditAndApprove()">✓ ${(Array.isArray(_approverDeptFilter)&&_approverDeptFilter.length)?'Approve '+_approverDeptFilter.join(', ')+' Lines':'Save Edits &amp; Approve'}</button>
      ` : `
        <button class="btn-primary full-width" onclick="saveQuotation('draft')">💾 Save Draft</button>
        <button class="btn-wa full-width" onclick="saveQuotation('sent')">📤 Submit for Approval</button>
      `}
    </div>
    ${quoteEditingId ? `<button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="deleteQuotation(${quoteEditingId})">🗑 Delete Quotation</button>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  renderQuoteItems();
}

function addQuoteItem() {
  const depts = Object.keys(currentCategories || DEFAULT_CATEGORIES);
  const newItem = {
    id: Date.now()+Math.random(), brand:'', model:'', productCode:'', description:'',
    department: depts[0] || '', qty: 1, mode:'mrp_disc', mrp:'', discPct:'',
    costPrice:'', marginPct:'', addGst:false, gstPct: 18, gstSlab: '18', directPrice:'',
    brandMode: quoteBrandList.length ? 'select' : 'new', modelMode: 'new'
  };
  quoteItems.push(newItem);
  quoteExpandedId = newItem.id;
  renderQuoteItems();
}

function duplicateQuoteItem(id) {
  const original = quoteItems.find(it => it.id === id);
  if (!original) return;
  const copy = { ...original, id: Date.now()+Math.random() };
  const idx = quoteItems.findIndex(it => it.id === id);
  quoteItems.splice(idx + 1, 0, copy);
  quoteExpandedId = copy.id;
  renderQuoteItems();
  showToast('Item duplicated — edit what\'s different', 'success');
}
window.duplicateQuoteItem = duplicateQuoteItem;

async function addQuoteItemFromInventory() {
  captureQuoteHeader();
  const products = await VW_DB.all(VW_DB.STORES.products);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Add from Inventory</h3>
    <div class="search-row">
      <input type="text" id="qinv-search" placeholder="🔍 Search products..." oninput="filterQuoteInventory()" style="margin-bottom:10px">
      <button class="btn-sm" onclick="scanForQuoteInventory()">📷 Scan</button>
    </div>
    <div id="qinv-list" class="visit-list">${renderQuoteInventoryList(products)}</div>
    <button class="btn-secondary full-width" style="margin-top:10px" onclick="showQuoteForm()">← Back</button>
  `;
  // Stash products for filtering
  window._qInvProducts = products;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function renderQuoteInventoryList(products) {
  if (!products.length) return '<p class="empty-msg">No products found</p>';
  return products.slice(0,50).map(p => `
    <div class="cust-row" onclick="pickInventoryItem(${p.id})">
      <div class="cust-info"><div class="cust-name">${p.name}</div><div class="cust-meta">${p.category} &middot; ₹${p.price} ${p.unit ? '/'+p.unit : ''} &middot; Stock: ${p.stock}</div></div>
    </div>`).join('');
}

function filterQuoteInventory() {
  const search = (document.getElementById('qinv-search')?.value || '').toLowerCase().trim();
  const products = window._qInvProducts || [];
  const filtered = search ? products.filter(p => (p.name||'').toLowerCase().includes(search) || (p.barcode||'').toLowerCase().includes(search)) : products;
  document.getElementById('qinv-list').innerHTML = renderQuoteInventoryList(filtered);
}

function scanForQuoteInventory() {
  openQrScanner(async (code) => {
    const product = await findProductByScannedCode(code);
    if (!product) {
      const statusEl = document.getElementById('qr-scan-status');
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">No product matches that code</span>';
      return;
    }
    // pickInventoryItem only needs window._qInvProducts (already stashed
    // when this sheet opened) and adds straight into the quote form —
    // it doesn't depend on the inventory-list sheet still being visible.
    closeSheet();
    pickInventoryItem(product.id);
  }, { title: 'Scan to Add', subtitle: 'Scan a product\'s QR label to add it to this quotation.' });
}
window.scanForQuoteInventory = scanForQuoteInventory;

function pickInventoryItem(productId) {
  const p = (window._qInvProducts||[]).find(x => x.id === productId);
  if (!p) return;
  const newItem = {
    id: Date.now()+Math.random(), brand: p.brand||'', model: p.model||'', productCode: p.barcode||'', description: p.name,
    department: p.category || '', qty: 1, mode:'mrp_disc', mrp: p.price, discPct: 0,
    costPrice:'', marginPct:'', addGst:false, gstPct: p.gst || 18, gstSlab: String(p.gst || 18), directPrice:'',
    brandMode: 'select', modelMode: 'select'
  };
  quoteItems.push(newItem);
  quoteExpandedId = newItem.id;
  // Close picker immediately so user sees the quote form right away
  closeSheet();
  // Small delay so close animation runs, then re-open with quote form
  setTimeout(() => showQuoteForm(), 80);
}

function expandQuoteItem(id) {
  quoteExpandedId = id;
  renderQuoteItems();
}
window.expandQuoteItem = expandQuoteItem;

function removeQuoteItem(id) {
  quoteItems = quoteItems.filter(it => it.id !== id);
  if (quoteExpandedId === id) quoteExpandedId = quoteItems.length ? quoteItems[quoteItems.length-1].id : null;
  renderQuoteItems();
}

function updateQuoteItem(id, field, value) {
  const item = quoteItems.find(it => it.id === id);
  if (!item) return;
  if (field === 'addGst') item[field] = value === true || value === 'true';
  else item[field] = value;
  // Re-render the whole list only when the field is a <select> choice that
  // changes which inputs should show (brand picked from dropdown, mode
  // switch, etc.) — never while the person is actively typing in a text
  // field, since re-rendering mid-keystroke destroys focus.
  if (field === 'brandSelected') {
    item.brand = value;
    item.model = '';
    item.modelMode = (quoteModelsByBrand[value]||[]).length ? 'select' : 'new';
    renderQuoteItems();
    return;
  }
  if (field === 'modelSelected') {
    item.model = value;
    renderQuoteItems();
    return;
  }
  if (field === 'mode' || field === 'addGst' || field === 'brandMode' || field === 'modelMode' || field === 'modelSelected') renderQuoteItems();
  else updateQuoteTotalsOnly();
}

function updateQuoteTotalsOnly() {
  quoteItems.forEach(it => {
    const { netPrice, total } = computeLine(it);
    const npEl = document.getElementById(`qnp-${it.id}`);
    const totEl = document.getElementById(`qtot-${it.id}`);
    if (npEl) npEl.textContent = '₹'+netPrice.toFixed(2);
    if (totEl) totEl.textContent = '₹'+total.toFixed(2);
  });
  // While a department TL is reviewing, the total reflects only their lines.
  const filtering = Array.isArray(_approverDeptFilter) && _approverDeptFilter.length;
  const sumItems = filtering ? quoteItems.filter(it => _approverDeptFilter.includes(it.department)) : quoteItems;
  const shown = sumItems.reduce((s,it) => s + computeLine(it).total, 0);
  const gt = document.getElementById('quote-grand-total');
  if (gt) gt.textContent = '₹'+shown.toLocaleString('en-IN', {maximumFractionDigits:0});
  const gtLabel = document.getElementById('quote-grand-total-label');
  if (gtLabel) gtLabel.textContent = filtering ? 'Your Section Subtotal' : 'Grand Total';
}

function renderQuoteItems() {
  // When a department TL is approving, show only their category's lines.
  const filtering = Array.isArray(_approverDeptFilter) && _approverDeptFilter.length;
  const visibleItems = filtering ? quoteItems.filter(it => _approverDeptFilter.includes(it.department)) : quoteItems;
  const countEl = document.getElementById('qitem-count');
  if (countEl) countEl.textContent = visibleItems.length;
  const list = document.getElementById('quote-items-list');
  if (!list) return;
  if (!visibleItems.length) { list.innerHTML = '<p class="empty-msg">No items yet — add from inventory or as a custom item</p>'; updateQuoteTotalsOnly(); return; }

  const cats = currentCategories || DEFAULT_CATEGORIES;
  const depts = Object.keys(cats);

  const deptBanner = filtering ? `
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:var(--text)">
      🏷️ You're reviewing only <strong>${_approverDeptFilter.join(', ')}</strong>. Re-price or adjust the discount on these lines, then approve. Other departments are reviewed by their own TLs and merged automatically.
    </div>` : '';

  // Only one item is shown fully expanded at a time — the rest collapse to
  // a compact summary row so a long item list doesn't bury the form you're
  // actively working on. Tap a collapsed row to expand it.
  list.innerHTML = deptBanner + visibleItems.map((item, i) => {
    const { netPrice, total } = computeLine(item);
    const isExpanded = quoteExpandedId === item.id || visibleItems.length === 1;

    if (!isExpanded) {
      const label = [item.brand, item.model, item.description].filter(Boolean).join(' · ') || `Item ${i+1}`;
      const confStyle = item.ocrConfidence === 'low' ? 'border-left:3px solid var(--red)' : item.ocrConfidence === 'medium' ? 'border-left:3px solid var(--gold)' : '';
      return `
      <div class="req-item-card req-item-collapsed" style="${confStyle}" onclick="expandQuoteItem(${item.id})">
        <span class="req-item-no">Item ${i+1}</span>
        <span class="req-item-summary">${item.ocrConfidence === 'low' ? '⚠️ ' : ''}${label} — Qty ${item.qty} · ₹${total.toFixed(2)}</span>
        <button class="icon-btn" onclick="event.stopPropagation();duplicateQuoteItem(${item.id})" title="Duplicate">⧉</button>
        <button class="remove-btn" onclick="event.stopPropagation();removeQuoteItem(${item.id})">✕</button>
      </div>`;
    }

    const confStyle = item.ocrConfidence === 'low' ? 'border-left:3px solid var(--red)' : item.ocrConfidence === 'medium' ? 'border-left:3px solid var(--gold)' : '';
    return `
    <div class="req-item-card" style="${confStyle}">
      <div class="req-item-header">
        <span class="req-item-no">Item ${i+1}</span>
        <div style="display:flex;gap:6px">
          <button class="icon-btn" onclick="duplicateQuoteItem(${item.id})" title="Duplicate this item">⧉ Copy</button>
          <button class="remove-btn" onclick="removeQuoteItem(${item.id})">✕</button>
        </div>
      </div>
      ${item.ocrRawText ? `
      <div style="font-size:11px;padding:6px 8px;margin-bottom:8px;border-radius:6px;background:var(--bg3);color:${item.ocrConfidence==='low'?'var(--red)':'var(--text2)'}">
        ${item.ocrConfidence === 'low' ? '⚠️ Could not read this clearly — please check against the original: ' : '📷 As scanned: '}<em>"${item.ocrRawText}"</em>
      </div>` : ''}
      <div class="input-row">
        <div class="form-group" style="flex:1">
          <label>Brand</label>
          ${item.brandMode === 'new' || (!quoteBrandList.length) ? `
            <input type="text" placeholder="Type new brand name" value="${item.brand}" oninput="updateQuoteItem(${item.id},'brand',this.value)">
            ${quoteBrandList.length ? `<button type="button" class="link-btn" onclick="updateQuoteItem(${item.id},'brandMode','select')">← pick from existing brands instead</button>` : ''}
          ` : `
            <select onchange="this.value==='__new__' ? updateQuoteItem(${item.id},'brandMode','new') : updateQuoteItem(${item.id},'brandSelected',this.value)">
              <option value="">— select existing brand —</option>
              ${quoteBrandList.map(b=>`<option ${b===item.brand?'selected':''}>${b}</option>`).join('')}
            </select>
            <button type="button" class="link-btn" onclick="updateQuoteItem(${item.id},'brandMode','new')">+ This brand isn't in the list — type it</button>
          `}
        </div>
        <div class="form-group" style="flex:1">
          <label>Model</label>
          ${item.modelMode === 'new' || !(quoteModelsByBrand[item.brand]||[]).length ? `
            <input type="text" placeholder="e.g. SDR 13.5" value="${item.model}" oninput="updateQuoteItem(${item.id},'model',this.value)">
            ${(quoteModelsByBrand[item.brand]||[]).length ? `<button type="button" class="link-btn" onclick="updateQuoteItem(${item.id},'modelMode','select')">← choose from list</button>` : ''}
          ` : `
            <select onchange="this.value==='__new__' ? updateQuoteItem(${item.id},'modelMode','new') : updateQuoteItem(${item.id},'modelSelected',this.value)">
              <option value="">— select —</option>
              ${(quoteModelsByBrand[item.brand]||[]).map(m=>`<option ${m===item.model?'selected':''}>${m}</option>`).join('')}
              <option value="__new__">+ Type new model…</option>
            </select>
          `}
        </div>
      </div>
      ${renderQuoteStockIndicator(item)}
      <div class="input-row">
        <div class="form-group" style="flex:1"><label>Product Code</label><input type="text" value="${item.productCode}" oninput="updateQuoteItem(${item.id},'productCode',this.value)"></div>
        <div class="form-group" style="flex:1"><label>Category</label>
          <select onchange="updateQuoteItem(${item.id},'department',this.value)">
            ${depts.map(d=>`<option ${d===item.department?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Description</label><input type="text" id="qdesc-${item.id}" value="${(item.description||'').replace(/"/g,'&quot;')}" placeholder="Paste or type description..." oninput="updateQuoteItem(${item.id},'description',this.value)" onpaste="setTimeout(()=>{const el=document.getElementById('qdesc-${item.id}');if(el)updateQuoteItem(${item.id},'description',el.value)},20)"></div>

      <div class="input-row">
        <div class="form-group" style="flex:1"><label>Qty</label><input type="number" value="${item.qty}" min="0" oninput="updateQuoteItem(${item.id},'qty',this.value)"></div>
        <div class="form-group" style="flex:1.5"><label>Pricing Mode</label>
          <select onchange="updateQuoteItem(${item.id},'mode',this.value)">
            <option value="mrp_disc" ${item.mode==='mrp_disc'?'selected':''}>MRP &minus; Discount (GST inclusive)</option>
            <option value="mrp_disc_gst" ${item.mode==='mrp_disc_gst'?'selected':''}>Base Price &minus; Discount + GST</option>
            <option value="cost_margin" ${item.mode==='cost_margin'?'selected':''}>Cost + Margin</option>
            <option value="direct" ${item.mode==='direct'?'selected':''}>Direct Price</option>
          </select>
        </div>
      </div>

      ${item.mode === 'mrp_disc' ? `
      <div class="input-row">
        <div class="form-group" style="flex:1"><label>MRP ₹ <span style="font-size:10px;color:var(--text3)">(GST inclusive)</span></label><input type="number" value="${item.mrp}" oninput="updateQuoteItem(${item.id},'mrp',this.value)"></div>
        <div class="form-group" style="flex:1"><label>Discount %</label><input type="number" value="${item.discPct}" oninput="updateQuoteItem(${item.id},'discPct',this.value)"></div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:-6px;margin-bottom:6px">Formula: MRP × (1 − Disc%) = Customer Price</div>` : ''}

      ${item.mode === 'mrp_disc_gst' ? `
      <div class="input-row">
        <div class="form-group" style="flex:1"><label>Base Price ₹ <span style="font-size:10px;color:var(--text3)">(excl. GST)</span></label><input type="number" value="${item.mrp}" oninput="updateQuoteItem(${item.id},'mrp',this.value)"></div>
        <div class="form-group" style="flex:1"><label>Discount %</label><input type="number" value="${item.discPct}" oninput="updateQuoteItem(${item.id},'discPct',this.value)"></div>
      </div>
      <div class="form-group"><label>GST Slab <span style="font-size:10px;color:var(--text3)">(added on top)</span></label>
        <select onchange="updateQuoteItem(${item.id},'gstSlab',this.value)">
          ${GST_SLABS.map(g => `<option value="${g.value}" ${item.gstSlab===g.value?'selected':''}>${g.label}</option>`).join('')}
        </select>
      </div>` : ''}

      ${item.mode === 'cost_margin' ? `
      <div class="input-row">
        <div class="form-group" style="flex:1"><label>Cost Price (₹)</label><input type="number" value="${item.costPrice}" oninput="updateQuoteItem(${item.id},'costPrice',this.value)"></div>
        <div class="form-group" style="flex:1"><label>Margin %</label><input type="number" value="${item.marginPct}" oninput="updateQuoteItem(${item.id},'marginPct',this.value)"></div>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;flex-direction:row">
        <label style="margin:0"><input type="checkbox" ${item.addGst?'checked':''} onchange="updateQuoteItem(${item.id},'addGst',this.checked)" style="width:16px;height:16px;accent-color:var(--gold)"> Add GST on top</label>
        ${item.addGst ? `<input type="number" value="${item.gstPct}" oninput="updateQuoteItem(${item.id},'gstPct',this.value)" style="width:70px" placeholder="GST %">` : ''}
      </div>` : ''}

      ${item.mode === 'direct' ? `
      <div class="form-group"><label>Final Price (₹, per unit)</label><input type="number" value="${item.directPrice}" oninput="updateQuoteItem(${item.id},'directPrice',this.value)"></div>` : ''}

      <div class="qline-totals">
        <span>Net Price: <strong id="qnp-${item.id}">₹${netPrice.toFixed(2)}</strong></span>
        <span>Total: <strong id="qtot-${item.id}">₹${total.toFixed(2)}</strong></span>
      </div>
    </div>`;
  }).join('');

  updateQuoteTotalsOnly();
}

// Detects brand/model/description combos typed into this quotation that
// don't exist yet in Inventory or in a prior pending submission, and saves
// them as pending_products so they (a) show up in future Quotation
// dropdowns immediately, and (b) appear in Settings > Pending Products for
// the Inventory team to review and approve into real Inventory products.
async function flagNewBrandModelsForReview() {
  const newOnes = quoteItems.filter(it => it.brand && it.brandMode !== 'select');
  if (!newOnes.length) return;

  const [products, pending] = await Promise.all([
    VW_DB.all(VW_DB.STORES.products),
    VW_DB.all(VW_DB.STORES.pendingProducts)
  ]);
  const known = new Set();
  products.forEach(p => known.add(`${(p.brand||'').toLowerCase()}|${(p.model||'').toLowerCase()}`));
  pending.forEach(p => known.add(`${(p.brand||'').toLowerCase()}|${(p.model||'').toLowerCase()}`));

  const profile = VW_AUTH.getCurrentProfile();
  const newlyCreated = [];
  for (const it of newOnes) {
    const key = `${it.brand.toLowerCase()}|${(it.model||'').toLowerCase()}`;
    if (known.has(key)) continue;
    known.add(key); // avoid saving the same new combo twice within this loop
    const { netPrice } = computeLine(it);
    const newId = await VW_DB.put(VW_DB.STORES.pendingProducts, {
      brand: it.brand, model: it.model || null, description: it.description || null,
      category: it.department || null, lastPrice: netPrice || 0, gst: it.gstPct || 18,
      status: 'pending', createdByName: profile ? profile.name : '', createdByRole: profile ? profile.role : '', createdAt: new Date().toISOString()
    });
    newlyCreated.push({ id: newId, label: [it.brand, it.model].filter(Boolean).join(' ') });
  }
  // Stashed for the confirmation popup to optionally offer a quick photo
  // capture step right after — not forced, since interrupting the save
  // flow itself would be jarring.
  window._lastQuoteNewPendingProducts = newlyCreated;
}

// Notifies Inventory whenever a quotation includes an item that's out of
// stock or already oversold (negative), so they can procure ahead of an
// actual sale rather than discovering the shortage only at billing time.
async function flagStockShortagesForReview(quoteNo, customerName) {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const stockByKey = {};
  products.forEach(p => {
    if (!p.brand) return;
    const key = `${p.brand}|${p.model||''}`;
    stockByKey[key] = (stockByKey[key] || 0) + (parseFloat(p.stock) || 0) - (parseFloat(p.heldStock) || 0);
  });

  for (const it of quoteItems) {
    if (!it.brand || !it.model) continue;
    const key = `${it.brand}|${it.model}`;
    if (!(key in stockByKey)) continue;
    const stock = stockByKey[key];
    if (stock > 0) continue; // healthy stock, nothing to flag

    const product = products.find(p => p.brand === it.brand && p.model === it.model);
    const severity = stock < 0 ? 'oversold' : 'out of stock';
    await VW_NOTIFY.createPersistedNotification({
      category: 'shortage',
      title: `${severity === 'oversold' ? '🔴 Oversold' : '⚠️ Out of stock'}: ${it.brand} ${it.model}`,
      body: `Quoted to ${customerName||'a customer'} in ${quoteNo||'a quotation'} — current stock is ${stock}${it.qty ? `, ${it.qty} requested` : ''}. Please procure soon.`,
      recipientRole: 'inventory',
      relatedTable: 'products', relatedId: product ? product.id : null,
      actions: product ? [{ label: '📦 Create PO', action: 'create_po' }] : []
    });
  }
}

// ---------- SAVE / DELETE ----------
function buildEditAuditSummary(before, after) {
  const changes = [];
  const beforeById = {}; before.forEach(it => beforeById[it.id] = it);
  const afterIds = new Set(after.map(it => it.id));

  for (const it of after) {
    const prev = beforeById[it.id];
    if (!prev) {
      changes.push(`Added "${[it.brand,it.model,it.description].filter(Boolean).join(' ')||'item'}"`);
      continue;
    }
    const prevLine = computeLine(prev), newLine = computeLine(it);
    if (Math.round(prevLine.netPrice) !== Math.round(newLine.netPrice)) {
      changes.push(`Changed rate on "${[it.brand,it.model].filter(Boolean).join(' ')||'item'}" from ₹${prevLine.netPrice.toFixed(2)} to ₹${newLine.netPrice.toFixed(2)}`);
    }
    if (parseFloat(prev.qty) !== parseFloat(it.qty)) {
      changes.push(`Changed qty on "${[it.brand,it.model].filter(Boolean).join(' ')||'item'}" from ${prev.qty} to ${it.qty}`);
    }
  }
  for (const it of before) {
    if (!afterIds.has(it.id)) {
      changes.push(`Removed "${[it.brand,it.model,it.description].filter(Boolean).join(' ')||'item'}"`);
    }
  }
  return changes.length ? changes.join('; ') : 'No item changes (header/terms only)';
}

async function saveApproverEditAndApprove() {
  if (!quoteItems.length) return showToast('Add at least one item', 'warn');

  // A department TL only reviews their own lines, so validation (and the
  // "expand the offending item" jump) must target just those — they can't
  // fix another department's blank fields.
  const _filtering = Array.isArray(_approverDeptFilter) && _approverDeptFilter.length;
  const _checkItems = _filtering ? quoteItems.filter(it => _approverDeptFilter.includes(it.department)) : quoteItems;
  const missingBrand = _checkItems.find(it => !it.brand);
  if (missingBrand) {
    quoteExpandedId = missingBrand.id;
    renderQuoteItems();
    return showToast('One item has no brand selected — pick from the list or type a new one', 'warn');
  }

  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteEditingId);
  if (!q) return;

  const grandTotal = quoteGrandTotal();
  const newItems = quoteItems.map(it => ({ ...it, ...computeLine(it) }));
  const profile = VW_AUTH.getCurrentProfile();
  const changesSummary = buildEditAuditSummary(quoteBeforeEditSnapshot || [], newItems);
  await flagNewBrandModelsForReview();
  await flagStockShortagesForReview(q.quoteNo, q.customerName);

  q.siteName = document.getElementById('q-site').value;
  q.customerName = document.getElementById('q-name').value;
  q.address = document.getElementById('q-address').value;
  q.contact = document.getElementById('q-contact').value;
  q.area = document.getElementById('q-area').value;
  q.deliveryAddress = document.getElementById('q-delivery-address').value;
  q.otherContactName = document.getElementById('q-other-contact-name').value;
  q.otherContactNumber = document.getElementById('q-other-contact-number').value;
  q.customFields = quoteHeaderDraft.customFields || [];
  q.items = newItems;
  q.terms = document.getElementById('q-terms').value;
  q.grandTotal = grandTotal;

  const auditLog = q.editAuditLog || [];
  auditLog.push({ editedByName: profile ? profile.name : '', editedAt: new Date().toISOString(), changesSummary });
  q.editAuditLog = auditLog;

  await VW_DB.put(VW_DB.STORES.quotations, q);

  // Now approve the current step with the edited version in place. This
  // reuses the same approve functions the normal Approve button calls —
  // it does NOT restart the chain, just moves it forward from here.
  const last = q.approvalLog[q.approvalLog.length - 1];
  if (last.level === 'tl' && last.branches) {
    const myBranches = await getMyPendingTlBranches(q);
    for (const branch of myBranches) {
      await VW_ESCALATION.approveQuotationTlBranch(q.id, branch.department);
    }
  } else {
    await VW_ESCALATION.approveQuotationStep(q.id);
  }

  showToast('Edits saved and approved', 'success');
  isApproverEditingPending = false;
  quoteBeforeEditSnapshot = null;
  _approverDeptFilter = null;
  closeSheet();
  navigateTo('cart');
}
window.saveApproverEditAndApprove = saveApproverEditAndApprove;

let quotationSaveInFlight = false; // guards against a double-tap creating two separate quotation records

async function saveQuotation(status) {
  if (quotationSaveInFlight) return; // already saving from a previous tap — ignore any extra ones until it finishes
  quotationSaveInFlight = true;
  try {
    await saveQuotationInner(status);
  } finally {
    quotationSaveInFlight = false;
  }
}
async function saveQuotationInner(status) {
  if (!quoteItems.length) return showToast('Add at least one item', 'warn');

  const custName = document.getElementById('q-name').value.trim();
  const custContact = document.getElementById('q-contact').value.trim();
  if (!custName || !custContact) return showToast('Customer name and contact number are required', 'warn');
  if (custContact.replace(/\D/g,'').length < 10) return showToast('Enter a valid 10-digit contact number', 'warn');

  const missingBrand = quoteItems.find(it => !it.brand);
  if (missingBrand) {
    quoteExpandedId = missingBrand.id;
    renderQuoteItems();
    return showToast('One item has no brand selected — pick from the list or type a new one', 'warn');
  }

  const grandTotal = quoteGrandTotal();
  const contact = document.getElementById('q-contact').value;
  const custNameForRecord = document.getElementById('q-name').value.trim();

  // Link this quotation to an existing customer by phone, or create a
  // new customer record if none exists — Invoice already did this;
  // Quotation previously only ever looked up, never created, which meant
  // a brand-new customer's first Quotation left no trace in Customers at
  // all, and any later Invoice had nothing to match against.
  let customerId = null;
  if (contact) {
    const digits = contact.replace(/\D/g,'').slice(-10);
    if (digits.length === 10) {
      const customers = await VW_DB.all(VW_DB.STORES.customers);
      const match = customers.find(c => (c.phone||'').replace(/\D/g,'').slice(-10) === digits);
      if (match) {
        customerId = match.id;
      } else if (custNameForRecord) {
        customerId = await VW_DB.put(VW_DB.STORES.customers, {
          name: custNameForRecord, phone: contact.trim(),
          address: document.getElementById('q-address').value.trim() || '',
          city: document.getElementById('q-area')?.value.trim() || '',
          type: 'retail', visitCount: 0, createdAt: new Date().toISOString()
        });
      }
    }
  }

  await flagNewBrandModelsForReview();

  const record = {
    customerId,
    siteName: document.getElementById('q-site').value,
    customerName: document.getElementById('q-name').value,
    address: document.getElementById('q-address').value,
    contact: document.getElementById('q-contact').value,
    area: document.getElementById('q-area').value,
    deliveryAddress: document.getElementById('q-delivery-address').value,
    otherContactName: document.getElementById('q-other-contact-name').value,
    otherContactNumber: document.getElementById('q-other-contact-number').value,
    customFields: quoteHeaderDraft.customFields || [],
    items: quoteItems.map(it => ({ ...it, ...computeLine(it) })),
    terms: document.getElementById('q-terms').value,
    grandTotal,
    status,
    date: new Date().toISOString().split('T')[0]
  };
  if (quoteEditingId) {
    record.id = quoteEditingId;
  } else {
    const profile = VW_AUTH.getCurrentProfile();
    // Real sequential number now, atomically assigned by the database —
    // same Q/26-27/00001 style as invoices, replacing the old
    // Date.now()-based code that could (and did) produce two
    // different-looking "duplicate" quotations from one double-tap.
    const fy = getFinancialYearLabel();
    const nextSeq = await VW_DB.incrementQuotationSequence(fy);
    record.quoteNo = `Q/${fy}/${String(nextSeq).padStart(5, '0')}`;
    record.createdByName = profile ? profile.name : '';
    record.createdAt = new Date().toISOString();
  }
  const id = await VW_DB.put(VW_DB.STORES.quotations, record);
  await flagStockShortagesForReview(record.quoteNo || ('Q-'+id), record.customerName);

  if (status === 'sent') {
    // Every Quotation must be approved before it actually reaches the
    // customer. "Submit for Approval" sends it into the approval chain —
    // the actual WhatsApp send only happens once every required level
    // (TL, Floor Manager, Store Manager, Management) has approved it.
    await VW_ESCALATION.startQuotationApproval(quoteEditingId || id);
    closeSheet();
    navigateTo('cart');
    showQuoteSubmittedConfirmation();
    return;
  } else {
    showToast('Quotation saved as draft', 'success');
  }

  closeSheet();
  navigateTo('cart');
}

function showQuoteSubmittedConfirmation() {
  const newPending = window._lastQuoteNewPendingProducts || [];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="text-align:center;padding:10px 0">
      <div style="font-size:40px;margin-bottom:10px">⏳</div>
      <h3 style="margin:0 0 8px">Submitted for Approval</h3>
      <p style="font-size:13px;color:var(--text2);line-height:1.6">This quotation is now waiting on the approval chain (Team Lead → Floor Manager → Store Manager → Management, as applicable). Once every required level approves it, you'll be able to share it with the customer directly via WhatsApp — you don't need to do anything else right now.</p>
    </div>
    ${newPending.length ? `
    <div class="req-item-card" style="margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">📸 Got a photo of ${newPending.length > 1 ? 'these new items' : newPending[0].label}?</div>
      <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Helps Inventory identify it faster when reviewing.</p>
      ${newPending.map(np => `<button class="btn-sm" style="margin:2px" onclick="VW_INVENTORY.showSubmitProductPhoto(null, ${np.id}, '${np.label.replace(/'/g,"\\'")}')">Add photo — ${np.label}</button>`).join('')}
    </div>` : ''}
    <button class="btn-primary full-width" style="margin-top:10px" onclick="closeSheet()">Got it</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function renderQuoteAdvanceSection(q) {
  if (q.status === 'converted') return ''; // advance info is shown on the resulting invoice instead once converted

  if (q.advanceAmount > 0) {
    const balance = (q.grandTotal||0) - q.advanceAmount;
    const holdAgeDays = q.holdStartedAt ? Math.floor((Date.now() - new Date(q.holdStartedAt).getTime()) / 86400000) : 0;
    const holdWarning = holdAgeDays >= 90 && !q.holdReleased && !q.holdOverrideApprovedBy;
    return `
    <div class="req-item-card" style="margin-top:10px">
      <div style="font-weight:600;font-size:13px;color:var(--green)">✓ Advance Collected: ₹${q.advanceAmount.toLocaleString('en-IN')}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">via ${q.advanceMethod||'—'} on ${new Date(q.advanceCollectedAt).toLocaleDateString('en-IN')} by ${q.advanceCollectedByName||'—'}</div>
      <div style="font-size:13px;font-weight:600;margin-top:6px">Balance Due: ₹${balance.toLocaleString('en-IN')}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">📦 Stock held since ${new Date(q.holdStartedAt).toLocaleDateString('en-IN')} (${holdAgeDays} days)</div>
      ${holdWarning ? `
      <div style="font-size:12px;color:var(--red);margin-top:8px;padding:6px;background:rgba(239,68,68,0.1);border-radius:6px">
        ⚠️ This hold has passed 90 days. It will stay held until either an invoice is generated or Management reviews and approves releasing it.
        ${VW_AUTH.getRole()==='admin' ? `<button class="btn-sm" style="margin-top:6px" onclick="approveHoldRelease(${q.id})">Release Hold (Management)</button>` : ''}
      </div>` : ''}
      ${(q.deliveryCommitments||[]).length ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600">📦 Delivery Commitments</div>
        ${q.deliveryCommitmentNote ? `<p style="font-size:11px;color:var(--text3);margin:4px 0">${q.deliveryCommitmentNote}</p>` : ''}
        ${q.deliveryCommitments.map((c,idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0">
            <span>${c.brand} ${c.model} — by ${new Date(c.deadline).toLocaleDateString('en-IN')}${c.closed ? ' <span style="color:var(--green)">✓ Delivered</span>' : ''}</span>
            ${!c.closed ? `<button class="btn-sm" onclick="closeDeliveryCommitment(${q.id},${idx})">Mark Delivered</button>` : ''}
          </div>`).join('')}
      </div>` : ''}
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="shareAdvanceReceipt(${q.id})">📄 Share Receipt</button>
    </div>`;
  }

  if (q.approvalStatus !== 'approved') return ''; // can't collect advance before pricing is locked in via approval
  return `<button class="btn-secondary full-width" style="margin-top:8px" onclick="showCollectAdvance(${q.id})">💰 Collect Advance</button>`;
}

async function closeDeliveryCommitment(quoteId, idx) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q || !q.deliveryCommitments || !q.deliveryCommitments[idx]) return;
  q.deliveryCommitments[idx].closed = true;
  q.deliveryCommitments[idx].closedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast('Marked as delivered', 'success');
  openQuotationDetail(quoteId);
}
window.closeDeliveryCommitment = closeDeliveryCommitment;

async function showCollectAdvance(quoteId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q) return;
  const products = await VW_DB.all(VW_DB.STORES.products);
  const stockByKey = {};
  products.forEach(p => {
    if (!p.brand) return;
    const key = `${p.brand}|${p.model||''}`;
    stockByKey[key] = (stockByKey[key] || 0) + (parseFloat(p.stock) || 0) - (parseFloat(p.heldStock) || 0);
  });

  // Only items that are genuinely out of stock or already oversold need a
  // delivery commitment — a quotation for something already sitting on
  // the shelf doesn't need a "we'll get it to you by" promise.
  const shortageItems = (q.items||[]).filter(it => {
    if (!it.brand || !it.model) return false;
    const key = `${it.brand}|${it.model}`;
    return (key in stockByKey) && stockByKey[key] <= 0;
  });

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Collect Advance</h3>
    <p class="sheet-meta">This will hold the quoted stock for this customer until the invoice is generated.</p>
    <div class="form-group"><label>Advance Amount (₹) *</label><input type="number" id="adv-amount" placeholder="0.00"></div>
    <div class="form-group"><label>Payment Method *</label>
      <select id="adv-method">
        <option>Cash</option><option>QR Scan</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option>
      </select>
    </div>
    ${shortageItems.length ? `
    <div class="req-item-card" style="margin:10px 0">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">📦 Out-of-stock items needing a delivery commitment</div>
      ${shortageItems.map((it,idx) => `
        <div style="margin-bottom:8px">
          <div style="font-size:12px">${it.brand} ${it.model}</div>
          <input type="date" id="commit-deadline-${idx}" data-brand="${it.brand}" data-model="${it.model}" style="margin-top:3px">
        </div>`).join('')}
      <div class="form-group" style="margin-top:6px"><label>Note shown to customer</label>
        <textarea id="commit-wording" rows="2" style="width:100%">We'll deliver the above item(s) within the committed timeframe once your advance is received.</textarea>
      </div>
    </div>` : ''}
    <button class="btn-primary full-width" style="margin-top:8px" onclick="confirmCollectAdvance(${quoteId})">Confirm Advance &amp; Hold Stock</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showCollectAdvance = showCollectAdvance;

async function confirmCollectAdvance(quoteId) {
  const amount = parseFloat(document.getElementById('adv-amount').value);
  const method = document.getElementById('adv-method').value;
  if (!amount || amount <= 0) return showToast('Enter a valid advance amount', 'warn');

  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q) return;
  if (amount > (q.grandTotal||0)) return showToast('Advance cannot exceed the quotation total', 'warn');

  const profile = VW_AUTH.getCurrentProfile();
  q.advanceAmount = amount;
  q.advanceMethod = method;
  q.advanceCollectedByName = profile ? profile.name : '';
  q.advanceCollectedAt = new Date().toISOString();
  q.holdStartedAt = new Date().toISOString();
  q.holdReleased = false;

  // Capture delivery commitments for any out-of-stock items shown on this
  // form — each gets its own deadline so it can be tracked and closed
  // independently, and a customer-facing note (editable wording) shared
  // on both the quotation and the receipt.
  const commitments = [];
  let idx = 0;
  while (true) {
    const dateEl = document.getElementById(`commit-deadline-${idx}`);
    if (!dateEl) break;
    if (dateEl.value) {
      commitments.push({
        brand: dateEl.dataset.brand, model: dateEl.dataset.model,
        deadline: dateEl.value, closed: false, lastNotifiedAt: null,
        createdAt: new Date().toISOString()
      });
    }
    idx++;
  }
  const wordingEl = document.getElementById('commit-wording');
  if (commitments.length) {
    q.deliveryCommitments = commitments;
    q.deliveryCommitmentNote = wordingEl ? wordingEl.value.trim() : '';
  }

  await VW_DB.put(VW_DB.STORES.quotations, q);

  // Put a hold on stock for every item with a known Inventory match, by
  // the quoted quantity — this is what actually makes it unavailable to
  // other customers, distinct from a plain quotation which never touches
  // real stock numbers.
  const products = await VW_DB.all(VW_DB.STORES.products);
  for (const it of (q.items||[])) {
    if (!it.brand || !it.model) continue;
    const product = products.find(p => p.brand === it.brand && p.model === it.model);
    if (!product) continue;
    product.heldStock = (parseFloat(product.heldStock) || 0) + (parseFloat(it.qty) || 0);
    await VW_DB.put(VW_DB.STORES.products, product);
  }

  showToast('Advance recorded — stock is now held for this customer', 'success');
  openQuotationDetail(quoteId);
}
window.confirmCollectAdvance = confirmCollectAdvance;

async function shareAdvanceReceipt(quoteId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q) return;
  const balance = (q.grandTotal||0) - q.advanceAmount;
  const commitmentLines = (q.deliveryCommitments||[]).length
    ? `\n\n${q.deliveryCommitmentNote || 'Delivery commitment:'}\n` + q.deliveryCommitments.map(c => `- ${c.brand} ${c.model} by ${new Date(c.deadline).toLocaleDateString('en-IN')}`).join('\n')
    : '';
  const msg = `🧾 Advance Receipt — V Wholesale\n\n` +
    `Quotation: ${q.quoteNo||''}\n` +
    `Customer: ${q.customerName||''}\n` +
    `Advance Received: ₹${q.advanceAmount.toLocaleString('en-IN')} (${q.advanceMethod})\n` +
    `Date: ${new Date(q.advanceCollectedAt).toLocaleDateString('en-IN')}\n` +
    `Quotation Total: ₹${(q.grandTotal||0).toLocaleString('en-IN')}\n` +
    `Balance Due: ₹${balance.toLocaleString('en-IN')}${commitmentLines}\n\n` +
    `Thank you for your advance payment. The balance is payable at the time of delivery/invoice.`;
  const phone = (q.contact||'').replace(/\D/g,'');
  window.open(`https://wa.me/91${phone}?text=${VW_NOTIFY.waEncode(msg)}`, '_blank');
}
window.shareAdvanceReceipt = shareAdvanceReceipt;

// Releases a stock hold that's crossed the 90-day mark — restricted to
// Admin/Management, since releasing committed customer stock without
// review could mean selling something to someone else that a paying
// customer already has a claim on.
async function approveHoldRelease(quoteId) {
  if (!confirm('Release this stock hold? The held quantity will become available to other customers again.')) return;
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q) return;
  const profile = VW_AUTH.getCurrentProfile();

  const products = await VW_DB.all(VW_DB.STORES.products);
  for (const it of (q.items||[])) {
    if (!it.brand || !it.model) continue;
    const product = products.find(p => p.brand === it.brand && p.model === it.model);
    if (!product) continue;
    product.heldStock = Math.max(0, (parseFloat(product.heldStock) || 0) - (parseFloat(it.qty) || 0));
    await VW_DB.put(VW_DB.STORES.products, product);
  }

  q.holdReleased = true;
  q.holdOverrideApprovedBy = profile ? profile.name : '';
  q.holdOverrideApprovedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast('Hold released', 'success');
  openQuotationDetail(quoteId);
}
window.approveHoldRelease = approveHoldRelease;

function renderApprovalStatus(q) {
  if (!q.approvalLog || !q.approvalLog.length) {
    return q.status === 'draft' ? '<p style="font-size:12px;color:var(--text3);margin:6px 0">Not submitted for approval yet</p>' : '';
  }
  const statusColors = { pending: 'var(--gold)', approved: 'var(--green)', timeout: 'var(--red)', rejected: 'var(--red)', skipped_no_assignee: 'var(--text3)' };
  const steps = q.approvalLog.map(entry => {
    const label = VW_ESCALATION.LEVEL_LABELS[entry.level] || entry.level;

    if (entry.level === 'tl' && entry.branches) {
      const branchLines = entry.branches.map(b => {
        let statusText = '';
        if (b.status === 'pending') statusText = 'Awaiting response';
        else if (b.status === 'approved') statusText = `Approved by ${b.approvedByName || (b.names||[]).join(', ')}`;
        else if (b.status === 'rejected') statusText = `Rejected${b.rejectReason ? ': '+b.rejectReason : ''}`;
        else if (b.status === 'skipped_no_assignee') statusText = 'Skipped (nobody assigned yet)';
        return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0 3px 14px"><span>${b.department}${b.names ? ' ('+b.names.join(', ')+')' : ''}</span><span style="color:${statusColors[b.status]||'var(--text3)'}">${statusText}</span></div>`;
      }).join('');
      return `<div style="font-size:12px;padding:4px 0;font-weight:600">${label} (by department)</div>${branchLines}`;
    }

    const who = entry.names ? entry.names.join(', ') : (entry.name || '');
    let statusText = '';
    if (entry.status === 'pending') statusText = 'Awaiting response';
    else if (entry.status === 'approved') statusText = `Approved by ${entry.approvedByName || who}`;
    else if (entry.status === 'rejected') statusText = `Rejected${entry.rejectReason ? ': '+entry.rejectReason : ''}`;
    else if (entry.status === 'timeout') statusText = 'No response — escalated';
    else if (entry.status === 'skipped_no_assignee') statusText = 'Skipped (nobody assigned yet)';
    return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span>${label} ${who && entry.status!=='skipped_no_assignee' ? '('+who+')' : ''}</span><span style="color:${statusColors[entry.status]||'var(--text3)'}">${statusText}</span></div>`;
  }).join('');
  const overallLabel = q.approvalStatus === 'approved' ? '✓ Fully Approved' : q.approvalStatus === 'rejected' ? '✕ Rejected — needs edits' : '⏳ Approval in progress';
  const overallColor = q.approvalStatus === 'approved' ? 'var(--green)' : q.approvalStatus === 'rejected' ? 'var(--red)' : 'var(--gold)';
  const editLog = (q.editAuditLog||[]).map(e => `<div style="font-size:11px;color:var(--text3);padding:3px 0">✏️ ${e.editedByName} edited: ${e.changesSummary} <span style="opacity:0.7">(${new Date(e.editedAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})})</span></div>`).join('');
  return `<div class="req-item-card" style="margin:8px 0">
    <div style="font-weight:600;font-size:13px;color:${overallColor};margin-bottom:6px">${overallLabel}</div>
    ${steps}
    ${editLog ? `<div style="margin-top:8px;border-top:1px solid var(--border2);padding-top:6px">${editLog}</div>` : ''}
  </div>`;
}

// Checks whether the currently logged-in person is the one who should act
// on the current pending approval step — i.e. they're a TL of the relevant
// department (for the 'tl' step, checked per-branch), or their phone
// matches the Floor Manager / Store Manager / Management escalation
// contact, or they're Admin (who can act at any level/branch).
async function currentUserCanApprove(q) {
  if (!q.approvalLog || !q.approvalLog.length) return false;
  const last = q.approvalLog[q.approvalLog.length - 1];
  if (!last) return false;
  if (VW_AUTH.isAdmin()) {
    if (last.level === 'tl' && last.branches) return last.branches.some(b => b.status === 'pending');
    return last.status === 'pending';
  }

  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return false;

  // Role seniority within the approval chain. A manager-level user can edit-and-approve at the
  // current pending stage (and any lower stage), so the same editing stays available all the way
  // through to management approval — not only at the TL stage.
  const RANK = { tl:1, floor_manager:2, store_manager:3, management:4 };
  const myRank = RANK[profile.role] || 0;

  if (last.level === 'tl' && last.branches) {
    // The assigned TL/staff for the department...
    if (last.branches.some(b => b.status === 'pending' && (b.staffIds||[]).includes(profile.staffId) && profile.staffRef === 'staff')) return true;
    // ...or any manager-level user (Floor Manager and above) may also act on a pending TL stage.
    return myRank >= RANK.floor_manager && last.branches.some(b => b.status === 'pending');
  }
  if (last.status !== 'pending') return false;

  // A manager whose role is at or above this stage can edit + approve here.
  if (myRank >= (RANK[last.level] || 99)) return true;

  // Fallback: explicit escalation-contact phone match (original behaviour, for non-manager roles
  // configured as a level's contact).
  const contacts = await VW_DB.getSetting('escalationContacts', {});
  const keyMap = { floor_manager: 'floorManager', store_manager: 'storeManager', management: 'management' };
  const contact = contacts[keyMap[last.level]] || {};
  return contact.phone && contact.phone.replace(/\D/g,'').slice(-10) === (profile.phone||'').replace(/\D/g,'').slice(-10);
}

// Returns the list of department branches the current user can act on
// right now (for the TL step only) — empty array if the pending step
// isn't 'tl' or there's nothing for this person to approve.
async function getMyPendingTlBranches(q) {
  if (!q.approvalLog || !q.approvalLog.length) return [];
  const last = q.approvalLog[q.approvalLog.length - 1];
  if (!last || last.level !== 'tl' || !last.branches) return [];
  if (VW_AUTH.isAdmin()) return last.branches.filter(b => b.status === 'pending');
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return [];
  return last.branches.filter(b => b.status === 'pending' && (b.staffIds||[]).includes(profile.staffId) && profile.staffRef === 'staff');
}

function promptRejectQuotationBranch(id, department) {
  const reason = prompt(`Reason for rejecting the ${department} portion (optional, shown to the Quotation Maker):`);
  if (reason === null) return;
  VW_ESCALATION.rejectQuotationTlBranch(id, department, reason).then(() => { closeSheet(); navigateTo('cart'); });
}
window.promptRejectQuotationBranch = promptRejectQuotationBranch;

function promptRejectQuotation(id) {
  const reason = prompt('Reason for rejecting (optional, shown to the Quotation Maker):');
  if (reason === null) return; // cancelled
  VW_ESCALATION.rejectQuotationStep(id, reason).then(() => { closeSheet(); navigateTo('cart'); });
}
window.promptRejectQuotation = promptRejectQuotation;

async function openVisitQuoteRequest(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!visit) return;
  const photoUrl = await VW_DB.getPhotoUrl(visit.existingQuotePhoto);
  const ocr = visit.existingQuoteOcr;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Quote Request — ${visit.customerName||'Customer'}</h3>
    <p class="sheet-meta">From visit on ${new Date(visit.date||visit.createdAt).toLocaleDateString('en-IN')}</p>
    ${photoUrl ? `<img src="${photoUrl}" style="width:100%;border-radius:10px;margin:10px 0;max-height:300px;object-fit:contain;background:#000">` : '<p class="empty-msg">Photo unavailable</p>'}
    ${ocr ? `
      <div class="req-item-card">
        <div style="font-weight:600;font-size:13px;margin-bottom:6px">Extracted by OCR — review before creating the quote</div>
        ${ocr.customerName ? `<div style="font-size:12px;margin-bottom:4px"><strong>Name on quote:</strong> ${ocr.customerName}</div>` : ''}
        ${(ocr.items||[]).map(it => `<div style="font-size:12px;padding:4px 0;border-top:1px solid var(--border2)">${[it.brand,it.model,it.description].filter(Boolean).join(' · ')} — Qty ${it.qty} @ ₹${it.price}</div>`).join('')}
        ${ocr.totalAmount ? `<div style="font-size:13px;font-weight:600;margin-top:6px">Total: ₹${ocr.totalAmount.toLocaleString('en-IN')}</div>` : ''}
        ${ocr.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:6px">Note: ${ocr.notes}</div>` : ''}
      </div>
    ` : `<p style="font-size:12px;color:var(--text3);text-align:center;margin:10px 0">⏳ Still processing the photo — check back shortly, or create the quote manually from what you see above.</p>`}
    <div style="display:flex;gap:8px;margin-top:10px">
      ${ocr ? `<button class="btn-primary" onclick="createQuotationFromOcr(${visitId})">+ Create Quotation from This</button>` : ''}
      <button class="btn-secondary" onclick="markQuoteRequestDone(${visitId})">✓ Mark Handled</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.openVisitQuoteRequest = openVisitQuoteRequest;

async function createQuotationFromOcr(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!visit || !visit.existingQuoteOcr) return;
  const ocr = visit.existingQuoteOcr;

  quoteEditingId = null;
  quoteExpandedId = null;
  await getCategories();
  await loadQuoteBrandData();
  quoteItems = (ocr.items||[]).map(it => ({
    id: Date.now()+Math.random(), brand: it.brand||'', model: it.model||'', productCode:'', description: it.description||'',
    department: Object.keys(currentCategories || DEFAULT_CATEGORIES)[0] || '', qty: it.qty || 1,
    mode: 'direct', mrp:'', discPct:'', costPrice:'', marginPct:'', addGst:false, gstPct: 18,
    directPrice: it.price || 0, brandMode: 'new', modelMode: 'new'
  }));
  quoteHeaderDraft = {
    siteName: '', customerName: ocr.customerName || visit.customerName || '',
    address: '', contact: visit.visitorPhone || '', terms: DEFAULT_QUOTE_TERMS
  };
  await markQuoteRequestDone(visitId, false);
  showQuoteForm();
}
window.createQuotationFromOcr = createQuotationFromOcr;

async function markQuoteRequestDone(visitId, navigate = true) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (visit) {
    visit.quoteRequestStatus = 'quoted';
    await VW_DB.put(VW_DB.STORES.visits, visit);
  }
  if (navigate) { closeSheet(); navigateTo('cart'); }
}
window.markQuoteRequestDone = markQuoteRequestDone;

async function deleteQuotation(id) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, id);
  if (q && q.status === 'converted') {
    return showToast("This quotation has already been converted to an invoice and can't be deleted", 'warn');
  }
  await VW_DB.del(VW_DB.STORES.quotations, id);
  showToast('Quotation deleted', 'info');
  closeSheet();
  navigateTo('cart');
}

// ===== CATEGORY-WISE APPROVAL helpers =====
// Group a quotation's line items by department (category), preserving the
// original index so edits can be written back to the right item.
function quoteCategoryGroups(q) {
  const groups = {};
  (q.items||[]).forEach((it, idx) => {
    const dept = it.department || 'General';
    if (!groups[dept]) groups[dept] = { department: dept, items: [], subtotal: 0 };
    const total = (it.total!=null ? it.total : computeLine(it).total);
    groups[dept].items.push({ it, idx });
    groups[dept].subtotal += total;
  });
  return Object.values(groups);
}

// Renders the items section of the approval detail, grouped by category.
// A TL acting on their branch(es) sees ONLY their category — with editable
// price + discount and an Approve/Reject per category. Everyone else
// (Floor/Store/Management/Admin/viewer) sees the full MERGED quote, grouped
// by category with per-category subtotals.
function renderQuoteApprovalItems(q, myTlBranches) {
  const groups = quoteCategoryGroups(q);
  const myDepts = (myTlBranches||[]).map(b => b.department);
  const actingAsTl = myDepts.length > 0;
  const fmt = n => '₹'+Math.round(n).toLocaleString('en-IN');
  const esc = s => String(s).replace(/'/g,"\\'");

  if (actingAsTl) {
    const mine = groups.filter(g => myDepts.includes(g.department));
    const otherDepts = groups.filter(g => !myDepts.includes(g.department)).map(g=>g.department);
    let html = mine.map(g => {
      const rows = g.items.map(({it, idx}) => {
        const unit = computeLine(it).netPrice;
        const pricePrefill = ((it.mode==='mrp_disc'||it.mode==='mrp_disc_gst') && parseFloat(it.mrp)) ? parseFloat(it.mrp) : unit;
        const discPrefill = parseFloat(it.discPct)||0;
        return `
        <div style="padding:8px 0;border-top:1px solid var(--border2)">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px">${[it.brand,it.model,it.description].filter(Boolean).join(' · ')||'Item'}</div>
          <div style="display:flex;gap:10px;align-items:center;font-size:12px;flex-wrap:wrap">
            <span style="color:var(--text3)">Qty ${it.qty}</span>
            <label style="color:var(--text3)">Price ₹<input type="number" inputmode="decimal" id="qce-${q.id}-${idx}-price" value="${Math.round(pricePrefill*100)/100}" style="width:88px;padding:4px;border:1px solid var(--border2);border-radius:6px;background:var(--bg2);color:var(--text)"></label>
            <label style="color:var(--text3)">Disc %<input type="number" inputmode="decimal" id="qce-${q.id}-${idx}-disc" value="${discPrefill}" style="width:62px;padding:4px;border:1px solid var(--border2);border-radius:6px;background:var(--bg2);color:var(--text)"></label>
          </div>
        </div>`;
      }).join('');
      return `
      <div class="req-item-card" style="margin:8px 0;border:1px solid var(--gold-border)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700;font-size:13px;color:var(--gold)">${g.department} — your items</div>
          <div style="font-size:12px;color:var(--text2)">Subtotal ${fmt(g.subtotal)}</div>
        </div>
        ${rows}
        <button class="btn-secondary btn-sm" style="margin-top:10px" onclick="saveQuotationCategoryEdits(${q.id},'${esc(g.department)}')">💾 Save Price Changes</button>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-primary" onclick="approveQuotationTlBranch(${q.id},'${esc(g.department)}');closeSheet();navigateTo('cart')">✓ Approve ${g.department}</button>
          <button class="btn-secondary" style="color:var(--red)" onclick="promptRejectQuotationBranch(${q.id},'${esc(g.department)}')">✕ Reject</button>
        </div>
      </div>`;
    }).join('');
    if (otherDepts.length) {
      html += `<p style="font-size:11px;color:var(--text3);text-align:center;margin:6px 0">Other categories handled by their Team Leads: ${otherDepts.join(', ')}</p>`;
    }
    return html;
  }

  // Manager / viewer — full merged quote, grouped by category with subtotals
  return groups.map(g => `
    <div class="req-item-card" style="margin:8px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
        <div style="font-weight:700;font-size:13px;color:var(--text)">${g.department}</div>
        <div style="font-size:12px;color:var(--text2)">${fmt(g.subtotal)}</div>
      </div>
      ${g.items.map(({it}) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border2);font-size:12px">
          <span>${[it.brand,it.model,it.description].filter(Boolean).join(' · ')||'Item'} <span style="color:var(--text3)">· Qty ${it.qty}</span></span>
          <span style="font-weight:600">${fmt(it.total!=null?it.total:computeLine(it).total)}</span>
        </div>`).join('')}
    </div>`).join('');
}

// TL saves price/discount changes for their category only. Normalises each
// edited line to GST-inclusive MRP-minus-discount so the customer-facing
// price is exactly what the TL set, recomputes the grand total, and logs an
// audit entry. Does NOT approve — the TL taps Approve separately.
async function saveQuotationCategoryEdits(quoteId, department) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q) return;
  const profile = VW_AUTH.getCurrentProfile();
  let changed = 0;
  (q.items||[]).forEach((it, idx) => {
    if ((it.department||'General') !== department) return;
    const priceEl = document.getElementById(`qce-${quoteId}-${idx}-price`);
    if (!priceEl) return;
    const discEl = document.getElementById(`qce-${quoteId}-${idx}-disc`);
    const price = Math.max(0, parseFloat(priceEl.value)||0);
    const disc = Math.min(100, Math.max(0, parseFloat(discEl && discEl.value)||0));
    const before = computeLine(it).netPrice;
    it.mode = 'mrp_disc';   // GST-inclusive MRP minus discount
    it.mrp = price;
    it.discPct = disc;
    const { netPrice, total } = computeLine(it);
    it.netPrice = netPrice;
    it.total = total;
    if (Math.abs(netPrice - before) > 0.001) changed++;
  });
  q.grandTotal = (q.items||[]).reduce((s,it)=>s+computeLine(it).total,0);
  const auditLog = q.editAuditLog || [];
  auditLog.push({ editedByName: profile ? profile.name : '', editedAt: new Date().toISOString(), changesSummary: `${department} prices updated (${changed} item${changed===1?'':'s'})` });
  q.editAuditLog = auditLog;
  await VW_DB.put(VW_DB.STORES.quotations, q);
  showToast(`${department} prices saved`, 'success');
  openQuotationDetail(quoteId);
}
window.saveQuotationCategoryEdits = saveQuotationCategoryEdits;

// ---------- DETAIL VIEW ----------
async function openQuotationDetail(id) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, id);
  const sheet = document.getElementById('bottom-sheet');
  const statusLabels = { draft:'Draft', sent:'Sent to Customer', converted:'Converted to Bill' };
  const canActOnApproval = await currentUserCanApprove(q);
  const myTlBranches = await getMyPendingTlBranches(q);
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${q.quoteNo || 'Q-'+q.id}</h3>
    <p class="sheet-meta">${quoteDisplayLabel(q)} &middot; ${statusLabels[q.status]||q.status}</p>
    ${renderApprovalStatus(q)}
    <div style="margin:10px 0">
      ${renderQuoteApprovalItems(q, myTlBranches)}
    </div>
    <div class="qtotal-row"><span>Grand Total</span><span>₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</span></div>
    ${(canActOnApproval && !myTlBranches.length) ? `
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-primary" onclick="approveQuotationStep(${q.id});closeSheet();navigateTo('cart')">✓ Approve</button>
      <button class="btn-secondary" style="color:var(--red)" onclick="promptRejectQuotation(${q.id})">✕ Reject</button>
    </div>` : ''}
    <div style="display:flex;gap:8px;margin-top:10px">
      ${q.status !== 'converted' ? `<button class="btn-secondary" onclick="editQuotation(${q.id})">${(canActOnApproval || myTlBranches.length) ? '✏️ Edit & Approve' : '✏️ Edit'}</button>` : ''}
      <button class="btn-secondary" onclick="printQuotation(${q.id})">🖨 Print</button>
      ${q.approvalStatus === 'approved' && q.status !== 'converted' ? `<button class="btn-wa" onclick="sendQuotationWhatsApp(${q.id})">💬 Send</button>` : ''}
      <button class="btn-sm" onclick="shareQuotationLink(${JSON.stringify(q).replace(/"/g,'&quot;')})">🔗 Share</button>
    </div>
      ${q.approvalStatus === 'approved' && q.status !== 'converted' ? `<button class="btn-secondary full-width" style="margin-top:6px" onclick="VW_EXTRAS.convertQuotationToWorkOrder(${q.id})">🔧 Convert to Work Order</button>` : ''}
    ${renderQuoteAdvanceSection(q)}
    ${q.status === 'converted' ? `<div onclick="${q.invoiceId ? `closeSheet();openInvoiceFromTab(${q.invoiceId})` : ''}" style="${q.invoiceId ? 'cursor:pointer' : ''};font-size:12px;color:var(--green);margin-top:8px;text-align:center;padding:6px;border-radius:8px;${q.invoiceId ? 'background:rgba(34,197,94,0.08)' : ''}">✓ Converted to Bill${q.invoiceNo ? ` — Invoice ${q.invoiceNo}${q.invoiceId ? ' (tap to view)' : ''}` : ''}<br><span style="color:var(--text3)">This quotation is locked and can no longer be edited or deleted.</span></div>`
      : q.approvalStatus === 'approved' ? `<button class="btn-primary full-width" style="margin-top:8px" onclick="closeSheet();pullQuotationIntoCart(${q.id})">🛒 Bill This Quotation</button>`
      : `<div class="req-item-card" style="margin-top:8px;text-align:center">
           <div style="font-size:12px;color:var(--gold)">⏳ Pending Approval — can't convert to a bill yet</div>
           ${VW_AUTH.isAdmin() ? `<button class="btn-sm" style="margin-top:6px" onclick="escalateQuotationNow(${q.id})">Escalate for faster approval</button>` : ''}
         </div>`}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function sendQuotationWhatsApp(id, preloaded = null) {
  const q = preloaded || await VW_DB.getById(VW_DB.STORES.quotations, id);
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';
  const quoteNo = q.quoteNo || 'Q-' + q.id;
  const total = Math.round(q.grandTotal || 0).toLocaleString('en-IN');

  // Build the portal link — customer opens this for a clean printable view
  const portalLink = `${window.location.origin}/vwholesale-app/quote.html?quote=${encodeURIComponent(quoteNo)}`;

  // Short clean message with link — not all the items
  const msg = `Dear ${q.customerName||'Customer'}, 🙏\n\nYour quotation from *${storeName}, Vijayawada* is ready.\n\n📋 *${quoteNo}* — ₹${total}\n${q.siteName ? `🏠 Site: ${q.siteName}\n` : ''}\n🔗 *View & Download:*\n${portalLink}\n\nThis link shows all items, pricing, and is printable.\nValid for 7 days.\n\nFor any changes, call us: 8712697930\n— Team ${storeName}`;

  const phone = (q.contact||'').replace(/\D/g,'');
  const encoded = VW_NOTIFY.waEncode(msg);
  const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}

async function printQuotation(id) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, id);
  const rows = (q.items||[]).map((it,i) => {
    const { netPrice, total } = it.netPrice !== undefined ? it : computeLine(it);
    return `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td>${[it.brand,it.model].filter(Boolean).join(' ')}</td>
      <td>${it.description||''}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">₹${netPrice.toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
      <td style="text-align:right">₹${total.toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Quotation ${q.quoteNo||'Q-'+q.id}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#111}
    .header{display:flex;justify-content:space-between;border-bottom:2px solid #C8972B;padding-bottom:16px;margin-bottom:20px}
    .brand{font-size:22px;font-weight:700;color:#C8972B}
    .brand-sub{font-size:12px;color:var(--text3);margin-top:4px}
    .meta-row{display:flex;justify-content:space-between;font-size:13px;color:#444;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;margin:16px 0}
    th{background:#f5f5f5;padding:8px;text-align:left;font-size:13px;border-bottom:1px solid #ddd}
    td{padding:8px;font-size:13px;border-bottom:1px solid #eee}
    .totals{margin-left:auto;width:280px}
    .tot-grand{font-weight:700;font-size:16px;border-top:2px solid #C8972B;padding-top:8px;margin-top:4px;display:flex;justify-content:space-between}
    .terms{margin-top:24px;font-size:12px;color:var(--text3);white-space:pre-line;border-top:1px solid #eee;padding-top:12px}
    .footer{margin-top:32px;text-align:center;font-size:12px;color:#888}
    .print-btn{display:block;margin:20px auto;padding:10px 24px;background:#C8972B;color:#000;border:none;border-radius:8px;font-size:14px;cursor:pointer}
    @media print{.print-btn{display:none}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>
  <div class="header">
    <div><div class="brand">V Wholesale</div><div class="brand-sub">Vassure Wholesale Pvt Ltd · Vijayawada, AP</div><div class="brand-sub">Phone: 8712697930 · hello@vwholesale.in</div></div>
    <div style="text-align:right"><div style="font-weight:700">QUOTATION</div><div style="font-size:13px;color:#666">#${q.quoteNo||'Q-'+q.id}</div><div style="font-size:13px;color:#666">${new Date(q.date||q.createdAt).toLocaleDateString('en-IN')}</div></div>
  </div>
  <div class="meta-row">
    <div>
      ${q.siteName ? `<div><strong>Site:</strong> ${q.siteName}</div>` : ''}
      ${q.customerName ? `<div><strong>Customer:</strong> ${q.customerName}</div>` : ''}
      ${q.area ? `<div><strong>Area:</strong> ${q.area}</div>` : ''}
      ${q.otherContactName || q.otherContactNumber ? `<div><strong>Other Contact:</strong> ${[q.otherContactName, q.otherContactNumber].filter(Boolean).join(' · ')}</div>` : ''}
    </div>
    <div style="text-align:right">
      ${q.address ? `<div><strong>Address:</strong> ${q.address}</div>` : ''}
      ${q.deliveryAddress ? `<div><strong>Delivery Address:</strong> ${q.deliveryAddress}</div>` : ''}
      ${q.contact ? `<div><strong>Phone:</strong> ${q.contact}</div>` : ''}
      ${(q.customFields||[]).filter(f=>f.label&&f.value).map(f => `<div><strong>${f.label}:</strong> ${f.value}</div>`).join('')}
    </div>
  </div>
  <table>
    <tr><th>#</th><th>Brand/Model</th><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr>
    ${rows}
  </table>
  <div class="totals"><div class="tot-grand"><span>Grand Total</span><span>₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</span></div></div>
  <div class="terms">${(q.terms || DEFAULT_QUOTE_TERMS).replace(/</g,'&lt;')}</div>
  <div class="footer">Generated by V Wholesale Customer OS</div>
  </body></html>`);
  win.document.close();
}
window.printQuotation = printQuotation;

window.VW_QUOTATIONS = {
  renderQuotationsTab, newQuotation, editQuotation, openQuotationDetail,
  saveQuotation, deleteQuotation, sendQuotationWhatsApp
};
window.newQuotation = newQuotation;
window.editQuotation = editQuotation;
window.openQuotationDetail = openQuotationDetail;
window.saveQuotation = saveQuotation;
window.deleteQuotation = deleteQuotation;
window.sendQuotationWhatsApp = sendQuotationWhatsApp;
window.addQuoteItem = addQuoteItem;
window.addQuoteItemFromInventory = addQuoteItemFromInventory;
window.filterQuoteInventory = filterQuoteInventory;
window.pickInventoryItem = pickInventoryItem;
window.removeQuoteItem = removeQuoteItem;
window.updateQuoteItem = updateQuoteItem;
window.showQuoteForm = showQuoteForm;
window.filterQuotationsList = filterQuotationsList;

// ===== QUOTATION APPROVAL ESCALATION CHAIN =====
// TL (2h) → Floor Manager (4h) → Store Manager (8h) → Management
const ESCALATION_LEVELS = ['tl', 'floor_manager', 'store_manager', 'management'];
const ESCALATION_HOURS = { tl: 2, floor_manager: 4, store_manager: 8, management: 24 };
const ESCALATION_LABELS = {
  tl: 'Team Lead', floor_manager: 'Floor Manager',
  store_manager: 'Store Manager', management: 'Management'
};

async function escalateQuotationNow(quoteId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quoteId);
  if (!q) return;
  const currentIdx = ESCALATION_LEVELS.indexOf(q.escalationLevel || 'tl');
  if (currentIdx >= ESCALATION_LEVELS.length - 1) {
    showToast('Already escalated to Management', 'warn'); return;
  }
  const nextLevel = ESCALATION_LEVELS[currentIdx + 1];
  const log = q.escalationLog || [];
  log.push({
    from: q.escalationLevel || 'tl',
    to: nextLevel,
    escalatedAt: new Date().toISOString(),
    escalatedBy: VW_AUTH.getCurrentProfile()?.name || 'System',
    reason: 'Manual escalation'
  });
  await VW_DB.put(VW_DB.STORES.quotations, {
    ...q,
    escalationLevel: nextLevel,
    escalationNotifiedAt: new Date().toISOString(),
    escalationLog: log
  });
  showToast(`Escalated to ${ESCALATION_LABELS[nextLevel]} ✓`, 'success');
  // Send WhatsApp notification
  const contacts = await VW_DB.getSetting('escalation_contacts', {});
  const phone = contacts[nextLevel];
  if (phone) {
    const msg = `*V Wholesale — Quotation Approval Needed*\n\nQuote: ${q.quoteNo}\nCustomer: ${q.customerName}\nValue: ₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}\nEscalated to: ${ESCALATION_LABELS[nextLevel]}\n\nPlease approve at ${window.location.origin}`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }
  if (typeof openQuotationDetail === 'function') openQuotationDetail(quoteId);
}

async function checkQuotationEscalations() {
  if (!VW_AUTH.isAdmin()) return;
  const now = new Date();
  const hour = now.getHours();
  const cfg = await VW_DB.getSetting('escalation_config', {
    tlMinutes:60, fmMinutes:180, smMinutes:360,
    businessHoursStart:9, businessHoursEnd:21
  });
  // Pause outside business hours (9am–9pm)
  if (hour < cfg.businessHoursStart || hour >= cfg.businessHoursEnd) return;

  const quotes = await VW_DB.all(VW_DB.STORES.quotations);
  const pending = quotes.filter(q =>
    q.approvalStatus === 'pending_approval' &&
    q.autoEscalate !== false && q.submittedAt
  );

  // Load today's attendance to check who's on break/off duty
  const today = now.toISOString().split('T')[0];
  const allAtt = await VW_DB.all(VW_DB.STORES.attendance);
  const todayAtt = allAtt.filter(a => a.date === today);
  const allStaff = await VW_DB.all(VW_DB.STORES.staff);

  function isStaffAvailable(designation) {
    const staff = allStaff.filter(s => s.designation === designation && s.active !== false);
    return staff.some(s => {
      const att = todayAtt.find(a => a.staffId === s.id);
      return att?.punchIn && !att?.currentlyOnBreak && !att?.punchOut;
    });
  }

  const minutesAllowed = {
    tl: cfg.tlMinutes || 60,
    floor_manager: cfg.fmMinutes || 180,
    store_manager: cfg.smMinutes || 360,
  };

  for (const q of pending) {
    const level = q.escalationLevel || 'tl';
    const minsAllowed = minutesAllowed[level];
    if (!minsAllowed) continue; // management — no further auto-escalation
    const notifiedAt = new Date(q.escalationNotifiedAt || q.submittedAt);
    const minsElapsed = (now - notifiedAt) / 60000;

    // Also skip immediately if current level staff is on break/off duty
    const designationMap = { tl:'TL', floor_manager:'floor_manager', store_manager:'store_manager' };
    const available = isStaffAvailable(designationMap[level]);
    const shouldEscalate = !available || minsElapsed >= minsAllowed;

    if (shouldEscalate) {
      const idx = ESCALATION_LEVELS.indexOf(level);
      if (idx < ESCALATION_LEVELS.length - 1) {
        const nextLevel = ESCALATION_LEVELS[idx + 1];
        const log = q.escalationLog || [];
        log.push({
          from: level, to: nextLevel,
          escalatedAt: now.toISOString(),
          escalatedBy: 'System (auto)',
          reason: !available ? `${ESCALATION_LABELS[level]} on break/off duty` : `No response after ${Math.round(minsElapsed)}min`,
        });
        await VW_DB.put(VW_DB.STORES.quotations, {
          ...q, escalationLevel: nextLevel,
          escalationNotifiedAt: now.toISOString(),
          escalationLog: log
        });

        // WhatsApp notification to next level
        const nextDesig = { tl:'TL', floor_manager:'floor_manager', store_manager:'store_manager' }[nextLevel];
        if (nextDesig) {
          const nextStaff = allStaff.filter(s => s.designation === nextDesig && s.active !== false && s.phone);
          for (const staff of nextStaff) {
            const msg = `*V Wholesale — Quotation Needs Approval*\n\nQuote: ${q.quoteNo}\nCustomer: ${q.customerName||'—'}\nValue: ₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}\nEscalated to: ${ESCALATION_LABELS[nextLevel]}\nReason: ${log[log.length-1].reason}`;
            window.open?.(`https://wa.me/91${staff.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
          }
        } else if (nextLevel === 'management') {
          const mgmtPhone = cfg.managementPhone;
          if (mgmtPhone) {
            const msg = `*V Wholesale — URGENT Quotation Approval*\n\nQuote: ${q.quoteNo}\nNo response from TL/FM/SM\nCustomer: ${q.customerName||'—'}\nValue: ₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}`;
            window.open?.(`https://wa.me/91${mgmtPhone}?text=${encodeURIComponent(msg)}`, '_blank');
          }
        }
      }
    }
  }
}

// Run escalation check every 30 minutes
setInterval(checkQuotationEscalations, 30 * 60 * 1000);

function renderEscalationTimeline(q) {
  if (!q.escalationLog?.length && q.approvalStatus !== 'pending_approval') return '';
  const level = q.escalationLevel || 'tl';
  const levelIdx = ESCALATION_LEVELS.indexOf(level);
  return `
  <div style="margin-top:14px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Approval Escalation</div>
    <div class="escalation-timeline">
      ${ESCALATION_LEVELS.map((lvl, i) => {
        const isPast = i < levelIdx;
        const isCurrent = i === levelIdx;
        const logEntry = (q.escalationLog||[]).find(e => e.to === lvl);
        return `
        <div class="esc-row" style="opacity:${isPast||isCurrent?1:0.35}">
          <div style="width:28px;height:28px;border-radius:50%;background:${isPast?'var(--green)':isCurrent?'var(--gold)':'var(--bg3)'};color:${isPast||isCurrent?'#000':'var(--text3)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${isPast?'✓':i+1}</div>
          <div class="esc-info" style="flex:1">
            <div class="esc-name" style="color:${isCurrent?'var(--gold)':isPast?'var(--green)':'var(--text3)'}">${ESCALATION_LABELS[lvl]}</div>
            ${logEntry?`<div class="esc-time">${logEntry.reason} · ${new Date(logEntry.escalatedAt).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</div>`:''}
            ${isCurrent&&q.escalationNotifiedAt?`<div class="esc-time">Notified ${new Date(q.escalationNotifiedAt).toLocaleTimeString('en-IN',{timeStyle:'short'})}</div>`:''}
          </div>
          ${isCurrent&&VW_AUTH.isAdmin()?`<button class="btn-sm" onclick="escalateQuotationNow(${q.id})">Skip →</button>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

window.escalateQuotationNow = escalateQuotationNow;
window.checkQuotationEscalations = checkQuotationEscalations;
window.renderEscalationTimeline = renderEscalationTimeline;

// ===== OCR SMART LEARNING — save items when quotation is finalized =====
async function learnFromQuotationItems(items) {
  if (!items?.length) return;
  try {
    for (const item of items) {
      const rawText = (item.ocrRawText || item.description || '').trim().toLowerCase();
      if (!rawText || rawText.length < 3) continue;
      // Check if already learned
      const { data: existing } = await VW_DB.client
        .from('ocr_learned_items')
        .select('id, match_count')
        .eq('raw_text', rawText)
        .single();
      if (existing) {
        await VW_DB.client.from('ocr_learned_items')
          .update({ match_count: (existing.match_count||1)+1, last_used_at: new Date().toISOString(),
            matched_product_name: item.description || rawText,
            matched_brand: item.brand || null,
            matched_model: item.model || null,
            matched_price: item.mrp || item.directPrice || null,
            matched_unit: item.unit || null })
          .eq('id', existing.id);
      } else {
        await VW_DB.client.from('ocr_learned_items').insert({
          raw_text: rawText,
          matched_product_name: item.description || rawText,
          matched_brand: item.brand || null,
          matched_model: item.model || null,
          matched_price: item.mrp || item.directPrice || null,
          matched_unit: item.unit || null,
          match_count: 1
        });
      }
    }
  } catch(e) { /* silently fail */ }
}
window.learnFromQuotationItems = learnFromQuotationItems;




