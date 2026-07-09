/* === app.js === */

let currentPage = 'dashboard';
const _pageCache = {}; // Simple in-memory cache keyed by page name
const _pageCacheTTL = {}; // TTL timestamps
const CACHE_TTL_MS = 30000; // 30 seconds cache per page

const ADMIN_ONLY_PAGES = new Set(['settings','hr','analytics','accounts','eod','gst',
  'dedup','vendors','promotions','catalogs','catalog_upload','catalog_review','brand_catalog',
  'category_manager','commissions','incentives','contractor_portal','contractor_kyc',
  'referrals','stock_valuation','vendor_payments','sales_targets','bulk_wa','broadcast',
  'marketing','autotest','daily_report','quick_approve','bulk_photos','service','kiosk','employeeapp']);

async function navigateTo(page, params) {
  // Redirect non-admin trying to access admin-only pages
  const _role = VW_AUTH.getRole();
  if (ADMIN_ONLY_PAGES.has(page) && _role !== 'admin') {
    if (confirm(`"${page}" is admin-only. Open Admin Portal?`)) window.open('./admin.html','_blank');
    return;
  }

  // Close more menu IMMEDIATELY — synchronous, no delay
  const menu = document.getElementById('more-menu');
  if (menu) menu.style.display = 'none';

  currentPage = page;

  // Show instant skeleton/spinner while loading
  const content = document.getElementById('app-content');
  if (content) {
    // If we have a recent cache, show it instantly, then refresh in background
    const cacheKey = page + (params ? JSON.stringify(params) : '');
    const cached = _pageCache[cacheKey];
    const cacheAge = Date.now() - (_pageCacheTTL[cacheKey] || 0);

    if (cached && cacheAge < CACHE_TTL_MS) {
      content.innerHTML = cached; // Instant — show cache immediately
      applyRolePermissions();
      if (_currentLang !== 'en') translatePageChrome(content);
      // Refresh in background silently after 500ms
      setTimeout(() => navigateToFresh(page, params, cacheKey), 500);
      return;
    }

    // No cache — show skeleton
    content.innerHTML = `<div style="padding:20px">
      <div class="skeleton-line" style="width:40%;height:22px;margin-bottom:20px"></div>
      <div class="skeleton-line" style="width:100%;height:80px;margin-bottom:10px;border-radius:14px"></div>
      <div class="skeleton-line" style="width:100%;height:60px;margin-bottom:10px;border-radius:14px"></div>
      <div class="skeleton-line" style="width:100%;height:60px;margin-bottom:10px;border-radius:14px"></div>
    </div>`;
  }

  await navigateToFresh(page, params, page + (params ? JSON.stringify(params) : ''));
}

function applyRolePermissions() {
  const role = VW_AUTH.getRole();
  const allowed = VW_AUTH.getAllowedPages();
  const nav = document.getElementById('bottom-nav');

  // Hide admin-only more-menu tiles from non-admin staff
  if (role !== 'admin') {
    document.querySelectorAll('.more-tile[data-admin-only],.more-tile[onclick*="admin.html"]').forEach(()=>{});
    document.querySelectorAll('[data-page]').forEach(el => {
      const page = el.dataset.page;
      if (page && ADMIN_ONLY_PAGES.has(page) && role !== 'admin') {
        el.style.display = 'none';
      }
    });
  }

  // GUEST — no profile, show minimal browse nav
  if (!role) {
    if (nav) nav.innerHTML = `
      <button class="nav-btn active" data-page="shop" onclick="navigateTo('shop')"><span class="nav-icon">🏠</span><span>Home</span></button>
      <button class="nav-btn" data-page="shop" onclick="navigateTo('shop')"><span class="nav-icon">🛒</span><span>Shop</span></button>
      <button class="nav-btn" data-page="offers" onclick="navigateTo('offers')"><span class="nav-icon">🎁</span><span>Offers</span></button>
      <button class="nav-btn" onclick="VW_AUTH.showAuthScreen()"><span class="nav-icon">👤</span><span>Login</span></button>`;
    return;
  }

  // Customer gets a different bottom nav
  if (role === 'customer') {
    if (nav) nav.innerHTML = `
      <button class="nav-btn" data-page="shop" onclick="navigateTo('shop')"><span class="nav-icon">🏠</span><span>Home</span></button>
      <button class="nav-btn" data-page="shop" onclick="navigateTo('shop')"><span class="nav-icon">🛒</span><span>Shop</span></button>
      <button class="nav-btn" data-page="offers" onclick="navigateTo('offers')"><span class="nav-icon">🎁</span><span>Offers</span></button>
      <button class="nav-btn" data-page="my_orders" onclick="navigateTo('my_orders')"><span class="nav-icon">📦</span><span>Orders</span></button>
      <button class="nav-btn" data-page="customer_profile" onclick="navigateTo('customer_profile')"><span class="nav-icon">👤</span><span>Profile</span></button>`;
    return;
  }

  // Contractor gets a contractor nav
  if (role === 'contractor') {
    if (nav) nav.innerHTML = `
      <button class="nav-btn" data-page="professional_home" onclick="navigateTo('professional_home')"><span class="nav-icon">🏠</span><span>Home</span></button>
      <button class="nav-btn" data-page="labor_requests" onclick="navigateTo('labor_requests')"><span class="nav-icon">🏗</span><span>Jobs</span></button>
      <button class="nav-btn" data-page="contractor_shop" onclick="navigateTo('contractor_shop')"><span class="nav-icon">🛍</span><span>Products</span></button>
      <button class="nav-btn" data-page="wallet" onclick="navigateTo('wallet')"><span class="nav-icon">👛</span><span>Wallet</span></button>
      <button class="nav-btn" data-page="contractor_profile" onclick="navigateTo('contractor_profile')"><span class="nav-icon">👷</span><span>Profile</span></button>`;
    return;
  }

  // Staff nav — existing logic
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    const page = btn.dataset.page;
    if (page === 'more') return;
    btn.style.display = allowed.includes(page) ? '' : 'none';
  });

  let moreVisibleCount = 0;
  document.querySelectorAll('.more-tile[data-page]').forEach(btn => {
    const page = btn.dataset.page;
    const show = allowed.includes(page);
    btn.style.display = show ? '' : 'none';
    if (show) moreVisibleCount++;
  });
  document.querySelectorAll('.more-btn[data-page]').forEach(btn => {
    const page = btn.dataset.page;
    const show = allowed.includes(page);
    btn.style.display = show ? '' : 'none';
    if (show) moreVisibleCount++;
  });
  const moreBtn = document.querySelector('.nav-btn[data-page="more"]');
  if (moreBtn) moreBtn.style.display = moreVisibleCount > 0 ? '' : 'none';

  document.querySelectorAll('.qa-btn[data-page]').forEach(btn => {
    btn.style.display = allowed.includes(btn.dataset.page) ? '' : 'none';
  });

  if (!allowed.includes(currentPage)) {
    navigateTo('dashboard');
  }
  // Sync header dropdown visibility to role
  updateHeaderDropdownRoles();
  // Update dynamic badges on quick action buttons
  updateQuickActionBadges();
}

async function updateQuickActionBadges() {
  try {
    // Sequential to avoid too many concurrent requests
    const products   = await VW_DB.all(VW_DB.STORES.products).catch(() => []);
    const invoices   = await VW_DB.all(VW_DB.STORES.invoices).catch(() => []);
    const workOrders = [];
    const leaves     = [];
    // Low stock + pending sourcing requests for inventory badge
    const lowStock = products.filter(p => (p.stock||0) <= (p.lowStockThreshold||5) && p.active !== false).length;
    let toSource = 0;
    try {
      const { count } = await VW_DB.client.from('tq_material_intents').select('id', {count:'exact',head:true}).eq('status','pending');
      toSource = count || 0;
    } catch(e) {}
    const invTotal = lowStock + toSource;
    const invBtn = document.querySelector('.qa-btn[data-page="inventory"] span:first-child');
    if (invBtn && invTotal > 0) invBtn.textContent = `📦`;
    if (invTotal > 0) addQABadge('inventory', invTotal);

    // Active work orders
    const activeWO = workOrders.filter(w => !['final_paid'].includes(w.stage)).length;
    const svcBtn = document.querySelector('.qa-btn[data-page="service"] span:first-child');
    if (svcBtn && activeWO > 0) svcBtn.textContent = `🔧`;

    // Pending payment verifications
    const pendingPay = invoices.filter(i => i.creditSale && !i.paymentVerified && i.approvalStatus === 'approved').length;
    const accBtn = document.querySelector('.qa-btn[data-page="accounts"] span:first-child');
    if (accBtn && pendingPay > 0) accBtn.textContent = `💳`;

    // Pending leaves
    const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
    const hrBtn = document.querySelector('.qa-btn[data-page="hr"] span:first-child');
    if (hrBtn && pendingLeaves > 0) hrBtn.textContent = `🧑‍💼`;

    if (activeWO > 0) addQABadge('service', activeWO);
    if (pendingPay > 0) addQABadge('accounts', pendingPay);
    if (pendingLeaves > 0) addQABadge('hr', pendingLeaves);
  } catch(e) { /* silent fail */ }
}

function addQABadge(page, count) {
  const btn = document.querySelector(`.qa-btn[data-page="${page}"]`);
  if (!btn) return;
  const existing = btn.querySelector('.qa-badge');
  if (existing) existing.remove();
  const badge = document.createElement('span');
  badge.className = 'qa-badge';
  badge.style.cssText = 'position:absolute;top:4px;right:4px;background:var(--red);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:8px;min-width:14px;text-align:center';
  badge.textContent = count > 9 ? '9+' : count;
  btn.style.position = 'relative';
  btn.appendChild(badge);
}
window.updateQuickActionBadges = updateQuickActionBadges;

var _navParams = null;
async function navigateToFresh(page, params, cacheKey) {
  // Track page view
  try { trackEvent('page_view', page, 'navigate'); } catch(e) {}

  _navParams = params || null;
  stopActiveScanner();
  const allowed = VW_AUTH.getAllowedPages();
  // Always allow dashboard for authenticated staff — profile may still be loading
  const isStaffPage = ['dashboard','checkin','billing','inventory','tile_quotes','quotations',
    'vendors','tasks','leads','settings','eod','people','operations'].includes(page);
  const profile = VW_AUTH.getCurrentProfile();
  if (!allowed.includes(page) && !(isStaffPage && profile)) {
    showToast("You don't have access to this section.", 'warn');
    if (currentPage !== page) return;
    page = 'shop';
  }
  currentPage = page;
  const content = document.getElementById('app-content');
  if (!content) return;

  // Toggle white background for shop/customer pages
  const shopPages = ['shop','offers','my_orders','customer_profile','mood_board','tile_visualizer','my_addresses','customer_returns','wallet'];
  if (shopPages.includes(page)) {
    content.classList.add('shop-mode');
    content.style.padding = '0';
    // Hide staff header — shop.js has its own header
    const _role = VW_AUTH?.getCurrentProfile?.()?.role || VW_AUTH?.getRole?.() || '';
    if (_role === 'customer' || _role === '') {
      document.getElementById('app-header')?.style.setProperty('display','none','important');
      document.body.classList.add('customer-mode');
    }
  } else {
    content.classList.remove('shop-mode');
    content.style.padding = '';
    // Header visibility is controlled by CSS staff-mode class only
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const moreMenu = document.getElementById('more-menu');
  if (moreMenu) moreMenu.style.display = 'none';

  try {
    let html = '';
    // Pages that should NOT be cached (real-time data)
    const noCachePages = ['dashboard','cart','dispatch','accounts','checkin','tasks'];

    if (page === 'dashboard') html = await renderDashboard();
    else if (page === 'checkin') html = await VW_CHECKIN.renderCheckin();
    else if (page === 'cart') html = await renderBillingPage();
    else if (page === 'crm') html = await VW_CRM.renderCRM();
    else if (page === 'inventory') html = await VW_INVENTORY.renderInventory();
    else if (page === 'hr') html = await VW_HR_PAYROLL.renderHRPage();
    else if (page === 'my_hr')     html = await VW_HR_SELF.renderMyHRPage();
    else if (page === 'my_leaves') { VW_HR_SELF.renderMyLeaves(); return; }
    else if (page === 'my_salary') { VW_HR_SELF.renderMySalary(); return; }
    else if (page === 'my_kpis')   { VW_HR_SELF.renderMyKPIs(); return; }
    else if (page === 'my_achievements') { VW_HR_SELF.renderMyAchievements(); return; }
    else if (page === 'my_advances') { VW_HR_SELF.renderMyAdvances(); return; }
    else if (page === 'my_documents') { VW_HR_SELF.renderMyDocuments(); return; }
    else if (page === 'my_profile') { VW_HR_SELF.renderMyProfile(); return; }
    else if (page === 'my_attendance') { VW_HR_SELF.renderMyAttendance(); return; }
    else if (page === 'analytics') html = await VW_ANALYTICS.renderAnalytics();
    else if (page === 'tasks') html = await VW_TASKS.renderMyTasks();
    else if (page === 'settings') html = await VW_SETTINGS.renderSettingsPage();
    else if (page === 'club') html = await renderContractorClub();
    else if (page === 'training') html = await VW_TRAINING.renderTraining();
    else if (page === 'feedback') html = await renderFeedbackPage();
    else if (page === 'accounts') html = await VW_ACCOUNTS.renderAccountsPage();
    else if (page === 'dispatch') html = await VW_DISPATCH.renderDispatchQueue();
    else if (page === 'promotions') html = await VW_FEATURES.renderPromotionsPage();
    else if (page === 'catalogs') html = await VW_FEATURES.renderCatalogsPage();
    else if (page === 'eod') html = await VW_FEATURES.renderEODPage();
    else if (page === 'referrals') html = await VW_FEATURES.renderReferralLedger();
    else if (page === 'commissions') html = await VW_COMMISSION.renderPage();
    else if (page === 'incentives') html = await VW_FEATURES.renderIncentivesPage();
    else if (page === 'returns') html = await VW_FEATURES.renderReturnsPage();
    else if (page === 'visualizer') html = await VW_VIS.renderVisualizerPage();
    else if (page === 'field') html = await VW_FIELD.renderFieldTeamPage();
    else if (page === 'gst') html = await VW_FEATURES.renderGSTPage();
    else if (page === 'wishlist') html = await VW_FEATURES.renderWishlistPage();
    else if (page === 'grn') html = await VW_GRN.renderGRNPage();
    else if (page === 'contractor_portal') html = await VW_CONTRACTOR.renderContractorPortalPage();
    else if (page === 'rewards') html = await renderRewardsStorePage();
    else if (page === 'labor') html = await renderLaborMarketplacePage();
    else if (page === 'tile_inventory') html = await VW_TILE_INV.renderTileInventoryPage();
    else if (page === 'tile_catalog') html = await VW_NON_INV.renderCatalogUploadPage();
    else if (page === 'brand_catalog') html = await VW_ADMIN.renderBrandCatalogPage();
    else if (page === 'category_manager') { await VW_ADMIN.renderCategoryManagerPage(); return; }
    else if (page === 'catalog_upload') { html = await VW_STOCK.renderCatalogUploadPage(); }
    else if (page === 'catalog_review') { html = await VW_STOCK.renderCatalogReviewPage(); }
    else if (page === 'shop') {
    // Block shop page on staff portal — redirect customers to shop.html
    const _role = VW_AUTH.getRole();
    if (_role === 'customer' || _role === 'contractor') {
      const _dest = _role === 'customer' ? './shop.html' : './professional.html';
      try { await sb.auth.signOut(); } catch(e) {}
      localStorage.clear();
      window.location.href = _dest;
      return;
    }
    html = await VW_SHOP.renderShopPage();
    // Load products after render
    setTimeout(() => VW_SHOP.loadShopProducts(null, ''), 100);
  }
  else if (page === 'orders') html = await VW_SHOP.renderOrdersDashboard();
  else if (page === 'checkout') html = await VW_SHOP.renderCheckoutPage();
  else if (page === 'bulk_photos') html = await VW_INVENTORY.renderBulkPhotoUploadPage();
  else if (page === 'follow_ups') html = await renderFollowUpDashboard();
  else if (page === 'quick_approve') html = await VW_TILES.renderQuickApprovalPage();
  else if (page === 'daily_report') html = await renderDailyReportPage();
  else if (page === 'stock_valuation') html = await renderStockValuationReport();
  else if (page === 'vendor_payments') html = await renderVendorPaymentsPage();
  else if (page === 'sales_targets') html = await renderSalesTargetsPage();
  else if (page === 'statement') html = await renderCustomerStatement(params?.id || null);
  else if (page === 'bulk_wa') html = await renderBulkWhatsApp();
  else if (page === 'staff_returns') html = await VW_SHOP.renderStaffReturnsPage();
  else if (page === 'mood_board') html = await VW_SHOP.renderTileMoodBoard();
  else if (page === 'broadcast') html = await renderBroadcastPage();
  else if (page === 'contractor_kyc') html = await VW_LABOR.renderContractorKYCReview();
  else if (page === 'sample_requests') html = await VW_SHOP.renderSampleRequestsDashboard();
  else if (page === 'offers') html = await VW_SHOP.renderOffersPage();
  else if (page === 'customer_returns') html = await VW_SHOP.renderCustomerReturnRequest();
  else if (page === 'customer_profile') html = await VW_SHOP.renderCustomerProfilePage();
  else if (page === 'professional_home') html = await VW_SHOP.renderProfessionalHome();
  else if (page === 'contractor_shop') html = await VW_SHOP.renderContractorShopPage();
  else if (page === 'contractor_profile') html = await VW_LABOR.renderContractorProfilePage();
  else if (page === 'tile_quotes') html = await VW_TILES.renderTileQuotesList();
  else if (page === 'tile_visualizer') html = typeof VW_VIS !== 'undefined' ? VW_VIS.renderVisualizerPage() : '<div class="module-header"><h2>Room Visualizer</h2></div><p class="empty-msg">Loading...</p>';
  else if (page === 'catalog') html = typeof VW_INVENTORY?.renderInventory === 'function' ? await VW_INVENTORY.renderInventory() : '<div class="module-header"><h2>Catalogue</h2></div>';
  else if (page === 'my_addresses') html = await VW_SHOP.renderMyAddressesPage();
  else if (page === 'track_order') html = await VW_SHOP.renderOrderTrackingPage(params?.id);
  else if (page === 'my_orders') html = await VW_SHOP.renderMyOrdersPage();
  else if (page === 'labor_requests') html = await VW_LABOR.renderLaborRequestList();
  else if (page === 'wallet') {
    const prof = VW_AUTH.getCurrentProfile();
    const custId = prof?.customer_id || prof?.id;
    html = await VW_WALLET.renderCustomerWallet(custId);
  }
  else if (page === 'wallet_topup') {
    // Cashier shortcut — top up a customer wallet by phone number
    html = `
    <div class="module-header"><h2>👛 Customer Wallet Top-Up</h2></div>
    <div class="card">
      <h3 class="card-title">Find Customer</h3>
      <div class="form-group">
        <label>Customer Phone Number</label>
        <input type="tel" id="wt-phone" placeholder="10-digit mobile" maxlength="10"
          style="font-size:18px;font-weight:700">
      </div>
      <button onclick="cashierFindWallet()" style="width:100%;padding:12px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
        🔍 Find Wallet
      </button>
      <div id="wt-result" style="margin-top:14px"></div>
    </div>`;
    // Inject cashierFindWallet safely
    const _wtScript = document.createElement('script');
    _wtScript.textContent = `
    async function cashierFindWallet() {
      const phone = document.getElementById('wt-phone')?.value?.trim();
      if (!phone || phone.length < 10) { showToast('Enter 10-digit phone', 'warn'); return; }
      const { data: cust } = await VW_DB.client.from('customers').select('id,name').eq('phone', phone).single().catch(()=>({data:null}));
      if (!cust) { document.getElementById('wt-result').innerHTML='<div style="color:var(--red);font-size:13px">Customer not found</div>'; return; }
      const wallet = await VW_WALLET.getOrCreateWallet(cust.id, cust.name, phone);
      document.getElementById('wt-result').innerHTML=
        '<div style="background:var(--bg2);border-radius:10px;padding:12px">' +
        '<div style="font-size:14px;font-weight:700">' + cust.name + '</div>' +
        '<div style="font-size:12px;color:var(--text3)">' + phone + '</div>' +
        '<div style="font-size:20px;font-weight:900;color:var(--gold);margin:8px 0">₹' + parseFloat(wallet?.balance||0).toLocaleString('en-IN') + ' balance</div>' +
        '<button onclick="VW_WALLET.showWalletTopup(' + wallet.id + ')" style="width:100%;padding:12px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:800;cursor:pointer">+ Add Money to Wallet</button>' +
        '</div>';
    }`;
    document.body.appendChild(_wtScript);
  }
    else if (page === 'quotations') html = await renderStandaloneQuotationPage();
    else if (page === 'dedup') html = await VW_FEATURES.renderDedupTool();
    else if (page === 'vendors') html = await VW_VENDOR.renderVendorsPage();
    else if (page === 'marketing') html = await VW_MARKETING.renderMarketingPage();
    else if (page === 'service') html = await VW_SERVICE.renderServicePage();
    else if (page === 'kiosk') html = await VW_EMPLOYEE.renderKioskMode();
    else if (page === 'employeeapp') html = await VW_EMPLOYEE.renderEmployeeDashboard();
    else if (page === 'contractor') html = await VW_EXTRAS.renderContractorPortal();
    else if (page === 'tiles') html = await VW_TILES.renderTilesQuotationPage();
    else if (page === 'granite') html = VW_TILES.renderGraniteQuotationPage();
    else if (page === 'autotest') html = await VW_AUTOTEST.renderAutoTestPage();
    else if (page === 'ledger') {
      const cid = _navParams?.customerId;
      if (cid) {
        html = await VW_LEDGER.renderCustomerLedger(cid);
      } else {
        const customers = await VW_DB.client.from('customers').select('id,name,phone,type').order('name').limit(200);
        const custs = customers.data || [];
        html = `
          <div class="module-header"><h2>📒 Customer Ledger</h2></div>
          <div class="card">
            <p style="font-size:13px;color:var(--text3);margin-bottom:10px">Search for a customer to view their full ledger</p>
            <input type="text" id="ledger-search" placeholder="Search by name or phone..." oninput="filterLedgerSearch(this.value)" style="margin-bottom:10px">
            <div id="ledger-customer-list">
              ${custs.slice(0,20).map(c => `
                <div class="cust-row" onclick="navigateTo('ledger',{customerId:${c.id}})">
                  <div class="staff-avatar">${(c.name||'?')[0].toUpperCase()}</div>
                  <div class="cust-info">
                    <div class="cust-name">${c.name}</div>
                    <div class="cust-meta">${c.phone||'—'} · ${c.type||'retail'}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>`;
        setTimeout(() => { window._ledgerAllCustomers = custs; }, 0);
      }
    }

    const finalHtml = html || '<p style="padding:2rem;color:#888">Nothing here yet.</p>';

    // Cache the result (skip for real-time pages)
    if (!noCachePages.includes(page) && cacheKey) {
      _pageCache[cacheKey] = finalHtml;
      _pageCacheTTL[cacheKey] = Date.now();
    }

    content.innerHTML = finalHtml;
    content.scrollTop = 0;
    applyRolePermissions();
    // Re-apply customer nav styling after applyRolePermissions rebuilds nav.innerHTML
    if (document.body.classList.contains('customer-mode')) {
      const _nav = document.getElementById('bottom-nav');
      if (_nav) {
        _nav.style.cssText = 'background:#fff!important;border-top:1px solid #E5E5E5!important;box-shadow:0 -2px 10px rgba(0,0,0,.06)!important;position:fixed;bottom:0;left:0;right:0;height:62px;display:flex;align-items:center;justify-content:space-around;z-index:100;padding-bottom:env(safe-area-inset-bottom)';
        _nav.querySelectorAll('.nav-btn').forEach(b => {
          b.style.color = b.classList.contains('active') ? '#16783A' : '#777';
        });
      }
    }
    if (_currentLang !== 'en') translatePageChrome(content);

  } catch(err) {
    console.error('Navigation error:', err);
    try { trackEvent('error', page, 'render_error', null, err.message); } catch(e) {}
    content.innerHTML = `<div style="padding:2rem;text-align:center">
      <div style="font-size:2rem;margin-bottom:1rem">⚠️</div>
      <div style="color:var(--gold);font-weight:600;margin-bottom:8px">Something went wrong loading this page</div>
      <div style="color:var(--text3);font-size:13px;margin-bottom:1.5rem">${err.message || 'Unknown error'}</div>
      <button onclick="navigateTo('${page}')" style="background:var(--gold);color:#000;border:none;border-radius:8px;padding:10px 24px;font-size:14px;cursor:pointer">Try Again</button>
    </div>`;
  }

  // Scroll to top
  document.getElementById('app-content')?.scrollTo(0, 0);
  content.scrollTo(0, 0);
  applyRolePermissions();
  if (document.body.classList.contains('customer-mode')) {
    const _nav = document.getElementById('bottom-nav');
    if (_nav) {
      _nav.style.cssText = 'background:#fff!important;border-top:1px solid #E5E5E5!important;box-shadow:0 -2px 10px rgba(0,0,0,.06)!important;position:fixed;bottom:0;left:0;right:0;height:62px;display:flex;align-items:center;justify-content:space-around;z-index:100;padding-bottom:env(safe-area-inset-bottom)';
      _nav.querySelectorAll('.nav-btn').forEach(b => {
        b.style.color = b.classList.contains('active') ? '#16783A' : '#777';
      });
    }
  }
}

let billingTab = 'bill';

// Entry point used ONLY by the bottom-nav "Billing" button — shows a
// choice popup first. Internal navigations into 'cart' (e.g. after
// closing a visit, or via goToCart with a specific customer already
// picked) go straight to navigateTo('cart') and skip this, since the
// popup only makes sense when someone is starting completely fresh.
function openBillingEntry() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Bill</h3>
    <p class="sheet-meta">Starting from an approved quotation, or a fresh invoice?</p>
    <div class="sheet-actions">
      <button class="btn-primary full-width" onclick="closeSheet();billingTab='bill';navigateTo('cart');setTimeout(()=>showPullFromQuotation(),50)">📋 Pull from Quotation</button>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet();billingTab='bill';activeCart={customerId:null,visitId:null,quotationId:null,items:[]};navigateTo('cart')">🛒 Create New Invoice</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.openBillingEntry = openBillingEntry;

async function renderBillingPage() {
  // Quotations moved to separate page — billing only shows new bill and invoices
  if (billingTab === 'quotations') billingTab = 'bill'; // redirect old quotation tabs
  const content = billingTab === 'invoices' ? await renderInvoicesTab()
    : await VW_CART.renderCart();
  return `
  <div class="module-header"><h2>Billing</h2></div>
  <div class="entry-type-grid" style="margin-bottom:14px">
    <button class="entry-type-btn ${billingTab==='bill'?'active':''}" onclick="switchBillingTab('bill')"><span class="et-icon">🛒</span>New Bill</button>
    <button class="entry-type-btn ${billingTab==='invoices'?'active':''}" onclick="switchBillingTab('invoices')"><span class="et-icon">🧾</span>Invoices</button>
    <button class="entry-type-btn" onclick="navigateTo('quotations')"><span class="et-icon">📋</span>Quotations</button>
  </div>
  ${content}
  `;
}

async function switchBillingTab(tab) {
  billingTab = tab;
  navigateTo('cart');
}
window.switchBillingTab = switchBillingTab;

async function filterDashboardInvoices(range, btn) {
  document.querySelectorAll('#inv-filter-today,#inv-filter-week,#inv-filter-all').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const now = new Date();
  const today = now.toDateString();
  const weekAgo = new Date(now - 7*24*60*60*1000);
  let filtered;
  if (range === 'today') filtered = invoices.filter(i => new Date(i.date).toDateString() === today);
  else if (range === 'week') filtered = invoices.filter(i => new Date(i.date) >= weekAgo);
  else filtered = invoices;
  filtered = [...filtered].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0, 20);
  const container = document.getElementById('dashboard-invoice-list');
  if (!container) return;
  if (!filtered.length) { container.innerHTML = '<p class="empty-msg">No invoices in this range</p>'; return; }
  container.innerHTML = filtered.map(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    const isPaid = inv.paymentVerified;
    const isPending = inv.approvalStatus === 'pending_approval';
    const dateStr = range === 'today'
      ? new Date(inv.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
      : new Date(inv.date).toLocaleDateString('en-IN');
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2);cursor:pointer" onclick="switchBillingTab('invoices');navigateTo('cart')">
      <div><div style="font-weight:600;font-size:13px">${inv.invoiceNo}</div>
      <div style="font-size:12px;color:var(--text3)">${cust?cust.name:'Walk-in'} · ${dateStr}</div></div>
      <div style="text-align:right"><div style="font-weight:700;font-size:13px">₹${(inv.total||0).toLocaleString('en-IN')}</div>
      <span style="font-size:11px;color:${isPending?'var(--gold)':isPaid?'#22c55e':'#378ADD'}">${isPending?'⏳ Pending':isPaid?'✓ Verified':'Active'}</span></div>
    </div>`;
  }).join('');
}
window.filterDashboardInvoices = filterDashboardInvoices;

function goToQuotations() {
  billingTab = 'quotations';
  navigateTo('cart');
}
window.goToQuotations = goToQuotations;

// Owners and Management should see the daily cash report, regardless of
// whether their login role is technically 'admin' — Admin role covers
// the app-permissions sense of "owner," while Management is a separate
// team designation on staff that can apply to non-admin logins too.
async function currentUserCanSeeDailyReport() {
  if (VW_AUTH.isAdmin()) return true;
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile || !profile.staffId) return false;
  const staff = await VW_DB.getById(VW_DB.STORES.staff, profile.staffId);
  return !!(staff && staff.team === 'management');
}
window.currentUserCanSeeDailyReport = currentUserCanSeeDailyReport;

function shareDailyReportWhatsApp() {
  const r = window._lastDailyReport;
  if (!r) return;
  const msg = `📊 V Wholesale — Today's Sales & Cash Report\n${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}\n\n` +
    `💵 Cash: ₹${Math.round(r.cash).toLocaleString('en-IN')}\n` +
    `🏦 Bank/UPI/Card: ₹${Math.round(r.bankUpi).toLocaleString('en-IN')}\n` +
    `📝 Credit Outstanding: ₹${Math.round(r.creditOutstanding).toLocaleString('en-IN')}\n` +
    `💰 Advances Collected: ₹${Math.round(r.advancesCollected).toLocaleString('en-IN')}\n\n` +
    `Total Billed Today: ₹${Math.round(r.totalBilled).toLocaleString('en-IN')}`;
  window.open(`https://wa.me/?text=${VW_NOTIFY.waEncode(msg)}`, '_blank');
}
window.shareDailyReportWhatsApp = shareDailyReportWhatsApp;

async function renderDashboard() {
  const profile = VW_AUTH.getCurrentProfile();
  const today = new Date().toISOString().split('T')[0];
  try {

  // Load sequentially to avoid ERR_INSUFFICIENT_RESOURCES from too many parallel requests
  const todayIST = today + 'T00:00:00+05:30'; // IST midnight for timestamptz columns
  // _safe wraps every query — Supabase client returns a thenable, not a Promise,
  // so .catch() cannot be chained directly; must await first then handle error here
  const _safe = async (q) => { try { return await q; } catch(e) { return { data: [] }; } };
  const invoicesRes   = await _safe(VW_DB.client.from('invoices').select('id,invoice_no,date,total,payment_method,credit_sale,approval_status,payment_verified,customer_name,amount_received,approval_reason').gte('date', todayIST).limit(100));
  const visitsRes     = await _safe(VW_DB.client.from('visits').select('id,customer_name,visitor_type,date,status,executive_name').gte('date', todayIST).limit(100));
  const tasksRes      = await _safe(VW_DB.client.from('tasks').select('id,title,status,assigned_to_name,due_date').in('status', ['pending','in_progress']).limit(30));
  const leadsRes      = await _safe(VW_DB.client.from('leads').select('id,name,stage,assigned_to_name').not('stage','in','("won","lost")').limit(30));
  const productsRes   = await _safe(VW_DB.client.from('products').select('id,name,category,stock,low_stock_threshold,unit').eq('is_active', true).limit(200));
  const apiUsageRes   = await _safe(VW_DB.client.from('api_usage_log').select('call_type,cost_usd,created_at,called_by').gte('created_at', todayIST).limit(200));

  const customers = [];
  const visits    = visitsRes.data || [];
  const invoices  = (invoicesRes.data || []).map(i => ({
    ...i,
    invoiceNo: i.invoice_no,
    paymentMethod: i.payment_method,
    creditSale: i.credit_sale,
    approvalStatus: i.approval_status,
    paymentVerified: i.payment_verified,
    customerName: i.customer_name,
    amountReceived: i.amount_received,
    approvalReason: i.approval_reason,
    escalationLog: [],
    closurePhoto: null,
  }));
  const tasks      = tasksRes.data || [];
  const quotations = [];
  const pendingQuotes = [];
  const leads      = (leadsRes.data || []).map(l => ({ ...l, assignedToName: l.assigned_to_name }));
  const feedback   = [];
  const products   = (productsRes.data || []).map(p => ({ ...p, lowStockThreshold: p.low_stock_threshold || 20 }));

  const todayInvoices = invoices; // already filtered to today
  const todayVisits = visits;
  const todayCustomers = todayVisits.filter(v => v.visitor_type === 'customer' || v.visitorType === 'customer');
  const todayVisitors = todayVisits.filter(v => v.visitor_type !== 'customer' && v.visitorType !== 'customer');
  const todayBilling = invoices.filter(i => i.approvalStatus === 'approved').reduce((s,i)=>s+(i.total||0),0);
  const todayPendingApproval = invoices.filter(i => i.approvalStatus === 'pending_approval').length;

  // Cashier / Accounts role gets a focused daily till summary instead of
  // the full admin dashboard — shows exactly what they need for handover.
  if (profile && profile.role === 'accounts') {
    const cash = todayInvoices.filter(i => (i.paymentMethod||'').toLowerCase() === 'cash' && !i.creditSale);
    const upi  = todayInvoices.filter(i => ['upi','qr scan'].includes((i.paymentMethod||'').toLowerCase()) && !i.creditSale);
    const card = todayInvoices.filter(i => ['card','credit card','debit card'].includes((i.paymentMethod||'').toLowerCase()) && !i.creditSale);
    const credit = todayInvoices.filter(i => i.creditSale);
    const pending = invoices.filter(i => !i.paymentVerified && i.approvalStatus !== 'pending_approval');
    const cashTotal = cash.reduce((s,i)=>s+(i.amountReceived||i.total||0),0);
    const upiTotal = upi.reduce((s,i)=>s+(i.amountReceived||i.total||0),0);
    const cardTotal = card.reduce((s,i)=>s+(i.amountReceived||i.total||0),0);
    const creditTotal = credit.reduce((s,i)=>s+(i.total||0),0);
    const grandTotal = cashTotal + upiTotal + cardTotal;
    return `
    <div class="module-header"><h2>Daily Till Summary</h2>
      <span style="font-size:12px;color:var(--text3)">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span>
    </div>
    <div class="snapshot-grid" style="margin-bottom:14px">
      <div class="snap-item"><div class="snap-val" style="color:var(--gold)">₹${Math.round(grandTotal).toLocaleString('en-IN')}</div><div class="snap-label">Total Collected</div></div>
      <div class="snap-item"><div class="snap-val">${todayInvoices.length}</div><div class="snap-label">Invoices Today</div></div>
      <div class="snap-item"><div class="snap-val" style="color:var(--red)">${pending.length}</div><div class="snap-label">Pending Verification</div></div>
    </div>
    <div class="card">
      <h3 class="card-title">Payment Breakdown</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg2);border-radius:8px">
          <span>💵 Cash (${cash.length} bills)</span><span style="font-weight:700">₹${Math.round(cashTotal).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg2);border-radius:8px">
          <span>📱 UPI/QR (${upi.length} bills)</span><span style="font-weight:700">₹${Math.round(upiTotal).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg2);border-radius:8px">
          <span>💳 Card (${card.length} bills)</span><span style="font-weight:700">₹${Math.round(cardTotal).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg2);border-radius:8px;opacity:0.7">
          <span>📝 Credit (${credit.length} bills — collect later)</span><span style="font-weight:700">₹${Math.round(creditTotal).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Today's Invoices</h3>
      ${!todayInvoices.length ? '<p class="empty-msg">No invoices yet today</p>' :
      todayInvoices.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(inv => {
        const cust = customers.find(c=>c.id===inv.customerId);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
          <div>
            <div style="font-size:13px;font-weight:600">${inv.invoiceNo}</div>
            <div style="font-size:12px;color:var(--text3)">${cust?cust.name:'Walk-in'} · ${inv.paymentMethod||'Credit'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">₹${(inv.total||0).toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:${inv.paymentVerified?'#22c55e':'var(--gold)'}">${inv.paymentVerified?'✓ Verified':'Needs Verification'}</div>
          </div>
        </div>`}).join('')}
    </div>
    <div style="padding:12px 0">
      <button class="btn-primary full-width" onclick="navigateTo('eod')">📊 End of Day Reconciliation</button>
    </div>`;
  }

  // ===== FIELD EXECUTIVE DASHBOARD =====
  // Executives (field team and in-store) get a focused view:
  // their leads, today's activity, quick actions for field work
  if (profile && profile.role === 'executive') {
    const myLeads = leads.filter(l => l.assignedTo === profile.id || l.assignedToName === profile.name);
    const myInvoices = invoices.filter(i =>
      i.createdByProfileId === profile.id ||
      i.salesExecutiveId === profile.id ||
      (i.salespersonCredits||[]).some(c => c.staffId === profile.id)
    );
    const monthStart2 = new Date(); monthStart2.setDate(1); monthStart2.setHours(0,0,0,0);
    const myMonthSales = myInvoices
      .filter(i => new Date(i.date) >= monthStart2 && i.approvalStatus === 'approved')
      .reduce((s,i) => s + (i.total||0), 0);
    const openLeads = myLeads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost');
    const followUps = myLeads.filter(l => l.followUpDate && new Date(l.followUpDate).toDateString() === today);
    const myTasks = tasks.filter(t => t.assignedToProfileId === profile.id && t.status !== 'resolved');

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <h2 style="margin:0">Good ${new Date().getHours()<12?'Morning':'Afternoon'}, ${(profile.name||'').split(' ')[0]}! 👋</h2>
        <p style="font-size:12px;color:var(--text3);margin:2px 0">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700;color:var(--gold)">₹${myMonthSales>=100000?Math.round(myMonthSales/100000)+'L':myMonthSales>=1000?Math.round(myMonthSales/1000)+'K':Math.round(myMonthSales).toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--text3)">My Month Sales</div>
      </div>
    </div>

    <!-- Quick Actions for Field Team -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <button class="btn-primary" style="padding:12px;font-size:13px" onclick="navigateTo('checkin')">🚶 New Check-in</button>
      <button class="btn-secondary" style="padding:12px;font-size:13px" onclick="VW_CRM.showAddLead(null)">➕ New Lead</button>
      <button class="btn-secondary" style="padding:12px;font-size:13px" onclick="navigateTo('cart')">🧾 New Invoice</button>
      <button class="btn-secondary" style="padding:12px;font-size:13px" onclick="navigateTo('catalogs')">📄 Share Catalog</button>
    </div>

    ${followUps.length ? `
    <div class="alert-card" style="margin-bottom:12px">
      <div class="alert-title">📅 ${followUps.length} Follow-up${followUps.length>1?'s':''} Due Today</div>
      ${followUps.map(l => {
        const cust = customers.find(c => c.id === l.customerId);
        return `<div class="cust-row" onclick="VW_CRM.openLead(${l.id})">
          <div class="staff-avatar" style="background:rgba(200,151,43,0.15);color:var(--gold)">📞</div>
          <div class="cust-info">
            <div class="cust-name">${cust?.name||l.customerName||'Customer'}</div>
            <div class="cust-meta">${l.department||'—'} · ${l.stage||'Lead'}</div>
          </div>
          ${cust?.phone ? `<a class="btn-call" href="https://wa.me/91${cust.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hi '+cust.name+', following up on your requirement. How can I help?')}" target="_blank" onclick="event.stopPropagation()">💬</a>` : ''}
        </div>`;
      }).join('')}
    </div>` : ''}

    ${myTasks.length ? `
    <div class="card" style="margin-bottom:12px">
      <h3 class="card-title">My Open Tasks <span class="badge">${myTasks.length}</span></h3>
      ${myTasks.slice(0,4).map(t => `
      <div class="task-card" onclick="VW_TASKS.openTaskDetail(${t.id})">
        <div class="task-card-header">
          <span class="task-dept">${t.department}</span>
          <span class="task-stage">${t.stage||'Lead'}</span>
        </div>
        <div class="task-desc">${t.description||'—'}</div>
        <div class="task-meta">${t.customerName||'—'}</div>
      </div>`).join('')}
      ${myTasks.length > 4 ? `<button class="btn-secondary full-width" style="margin-top:6px" onclick="navigateTo('tasks')">View all ${myTasks.length} tasks</button>` : ''}
    </div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div class="card-header-row">
        <h3 class="card-title">My Leads <span class="badge">${openLeads.length}</span></h3>
        <button class="btn-sm" onclick="navigateTo('crm')">View All</button>
      </div>
      ${!openLeads.length ? '<p class="empty-msg">No open leads — add your first lead above</p>' :
      openLeads.slice(0,5).map(l => {
        const cust = customers.find(c => c.id === l.customerId);
        const stageColors = {Lead:'#888',Visited:'#378ADD',Quoted:'#EF9F27',Negotiating:'#7F77DD',Won:'#22c55e',Lost:'#ef4444'};
        return `<div class="cust-row" onclick="VW_CRM.openLead(${l.id})">
          <div class="staff-avatar" style="background:rgba(55,138,221,0.15);color:#378ADD">${(cust?.name||l.customerName||'?')[0]}</div>
          <div class="cust-info">
            <div class="cust-name">${cust?.name||l.customerName||'Customer'}</div>
            <div class="cust-meta">${l.department} · ${l.followUpDate ? new Date(l.followUpDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : 'No follow-up set'}</div>
          </div>
          <span style="font-size:11px;color:${stageColors[l.stage]||'#888'};font-weight:600">${l.stage||'Lead'}</span>
        </div>`;
      }).join('')}
    </div>

    <!-- WhatsApp Greeting Templates -->
    <div class="card" style="margin-bottom:12px">
      <h3 class="card-title">Quick Greetings 💬</h3>
      <p style="font-size:12px;color:var(--text3);margin-bottom:10px">Select a customer then tap to send — opens WhatsApp directly</p>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn-secondary" onclick="showFieldGreeting('followup')" style="text-align:left;font-size:13px">👋 Follow-up — "How's your project going?"</button>
        <button class="btn-secondary" onclick="showFieldGreeting('thankyou')" style="text-align:left;font-size:13px">🙏 Thank You — After a meeting/visit</button>
        <button class="btn-secondary" onclick="showFieldGreeting('offer')" style="text-align:left;font-size:13px">🎁 Special Offer — Share a promotion</button>
        <button class="btn-secondary" onclick="showFieldGreeting('festive')" style="text-align:left;font-size:13px">🎉 Festive Greeting</button>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">My Recent Sales</h3>
      ${!myInvoices.length ? '<p class="empty-msg">No sales yet this month</p>' :
      myInvoices.slice(0,5).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(i => {
        const cust = customers.find(c => c.id === i.customerId);
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
          <div>
            <div style="font-size:13px;font-weight:600">${i.invoiceNo}</div>
            <div style="font-size:12px;color:var(--text3)">${cust?.name||'Walk-in'} · ${new Date(i.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">₹${(i.total||0).toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:${i.closurePhoto?'#22c55e':'var(--text3)'}">${i.closurePhoto?'📸 ✓':'📸 Needed'}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  // todayBilling already set above
  // todayPendingApproval already set above
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const { data: monthData } = await VW_DB.client.from('invoices')
    .select('total').eq('approval_status','approved')
    .gte('date', monthStart.toISOString()).limit(500);
  const monthBilling = (monthData||[]).reduce((s,i)=>s+(i.total||0),0);
  const wonLeads = leads.filter(l=>l.stage==='Won').length;
  const convRate = leads.length ? Math.round(wonLeads/leads.length*100) : 0;
  const avgRating = feedback.length ? (feedback.reduce((s,f)=>s+(f.rating||0),0)/feedback.length).toFixed(1) : '—';

  const deptCount = {};
  tasks.forEach(t => { if(t.department) deptCount[t.department] = (deptCount[t.department]||0)+1; });
  const topDept = Object.entries(deptCount).sort((a,b)=>b[1]-a[1]).slice(0,3);

  // Urgent escalations (Floor Manager / Store Manager / Management level, still unaccepted)
  let urgentBanner = '';
  if (profile && profile.role === 'admin') {
    const urgentLevels = ['floor_manager','store_manager','management'];
    const escalationContacts = await VW_DB.getSetting('escalationContacts', {});
    const contactKeyMap = { floor_manager:'floorManager', store_manager:'storeManager', management:'management' };

    // Warn if escalation contacts not set up — quotation approvals will get stuck
    const missingContacts = ['floorManager','storeManager','management'].filter(k => !escalationContacts[k]?.phone);
    if (missingContacts.length) {
      urgentBanner += `
      <div style="padding:12px;background:rgba(200,151,43,0.1);border:1px solid rgba(200,151,43,0.4);border-radius:10px;margin-bottom:10px">
        <div style="font-weight:600;font-size:13px;color:var(--gold);margin-bottom:4px">⚠️ Escalation Contacts Not Set Up</div>
        <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Quotation and invoice approvals will get stuck — nobody to notify at Floor Manager / Store Manager / Management levels.</p>
        <button class="btn-sm" style="background:var(--gold);color:#000" onclick="navigateTo('settings')">Go to Settings → Escalation Contacts</button>
      </div>`;
    }

    const urgentItems = [];
    visits.forEach(v => {
      if (v.status !== 'pending') return;
      const last = (v.escalationLog||[]).slice(-1)[0];
      if (last && last.status === 'pending' && urgentLevels.includes(last.level)) {
        urgentItems.push({ id: v.id, type: 'visit', name: v.customerName || 'Customer', level: last.level, since: last.notifiedAt, dept: '' });
      }
    });
    tasks.forEach(t => {
      if (t.status !== 'pending') return;
      const last = (t.escalationLog||[]).slice(-1)[0];
      if (last && last.status === 'pending' && urgentLevels.includes(last.level)) {
        urgentItems.push({ id: t.id, type: 'task', name: t.customerName || 'Customer', level: last.level, since: last.notifiedAt, dept: t.department || '' });
      }
    });
    if (urgentItems.length) {
      urgentBanner += `
      <div class="alert-card">
        <div class="alert-title">🚨 ${urgentItems.length} Needs Urgent Attention — tap to view &amp; resolve</div>
        ${urgentItems.map(it => {
          const waitMin = Math.max(1, Math.round((Date.now() - new Date(it.since).getTime())/60000));
          const levelLabel = VW_ESCALATION.LEVEL_LABELS[it.level] || it.level;
          const contact = escalationContacts[contactKeyMap[it.level]] || {};
          const msg = VW_NOTIFY.waEncode(`🚨 URGENT: ${it.name} has been waiting ${waitMin} min at V Wholesale with no response. Please attend immediately.`);
          const openFn = it.type === 'visit' ? `VW_CHECKIN.openVisitDetail(${it.id})` : `VW_TASKS.openTaskDetail(${it.id})`;
          return `<div class="cust-row" onclick="${openFn}">
            <div class="staff-avatar" style="background:rgba(239,68,68,0.15);color:var(--red)">🚨</div>
            <div class="cust-info"><div class="cust-name">${it.name}${it.dept?' &middot; '+it.dept:''}</div><div class="cust-meta">Waiting ${waitMin} min &middot; Escalated to ${levelLabel}${contact.name?' ('+contact.name+')':''}</div></div>
            ${contact.phone ? `<a class="btn-call" style="flex:0;padding:8px 12px;background:rgba(34,197,94,0.12);color:#22c55e;border-color:rgba(34,197,94,0.3)" href="https://wa.me/91${contact.phone}?text=${msg}" target="_blank" onclick="event.stopPropagation()">💬</a>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }
  }

  // Low-stock products (Admin only)
  const lowStock = (profile && profile.role === 'admin')
    ? products.filter(p => p.stock <= (p.lowStockThreshold || 20))
    : [];
  let lowStockBanner = '';
  // Stock hold alerts for SM/Management
  let holdAlertBanner = '';
  if (profile && ['admin','store_manager','management'].includes(profile.role)) {
    try { holdAlertBanner = await VW_TILES.renderHoldAlerts(); } catch(e) {}

    // Fetch pending TQs for management pipeline view
    try {
      const { data: pendingTQs } = await VW_DB.client
        .from('tile_quotations')
        .select('id,tq_no,customer_name,total_area_sqft,grand_total,quoted_price_per_sqft,created_by,created_at')
        .eq('approval_status','pending_approval')
        .order('created_at', { ascending: true })
        .limit(10);

      if (pendingTQs?.length) {
        const totalPipeline = pendingTQs.reduce((s,q) => s + parseFloat(q.grand_total||0), 0);
        holdAlertBanner = (holdAlertBanner||'') + `
        <div class="card" style="border-left:4px solid var(--gold);margin-bottom:12px">
          <div class="card-header-row">
            <h3 class="card-title">⏳ ${pendingTQs.length} TQ${pendingTQs.length>1?'s':''} Awaiting Approval</h3>
            <button class="btn-sm" style="background:var(--gold);color:#000;font-weight:700" onclick="navigateTo('quick_approve')">⚡ Quick Approve</button>
          </div>
          ${totalPipeline > 0 ? `<div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">Pipeline: ₹${totalPipeline.toLocaleString('en-IN')}</div>` : ''}
          ${pendingTQs.slice(0,3).map(q => `
          <div class="followup-row" onclick="VW_TILES.openTileQuote(${q.id})" style="cursor:pointer">
            <div class="fu-info">
              <div class="fu-name">${q.customer_name} · ${q.tq_no}</div>
              <div class="fu-dept">${parseFloat(q.total_area_sqft||0).toFixed(0)} sqft${q.grand_total?` · ₹${parseInt(q.grand_total).toLocaleString('en-IN')}`:q.quoted_price_per_sqft?` · ₹${q.quoted_price_per_sqft}/sqft`:' · Price TBD'}</div>
            </div>
            <button class="btn-sm" style="background:var(--gold);color:#000" onclick="event.stopPropagation();VW_TILES.openTileQuote(${q.id})">Approve →</button>
          </div>`).join('')}
          ${pendingTQs.length > 3 ? `<p style="font-size:12px;color:var(--text3);margin-top:4px">+${pendingTQs.length-3} more pending</p>` : ''}
        </div>`;
      }
    } catch(e) {}
  }
  if (profile && profile.role === 'admin') {
    if (lowStock.length) {
      lowStockBanner = `
      <div class="alert-card">
        <div class="alert-title">📦 ${lowStock.length} Item${lowStock.length>1?'s':''} Low on Stock</div>
        ${lowStock.slice(0,5).map(p => `
          <div class="followup-row">
            <div class="fu-info"><div class="fu-name">${p.name}</div><div class="fu-dept">${p.category} &middot; ${p.stock} ${p.unit} left</div></div>
            <div style="display:flex;gap:4px">
              <button class="btn-sm" onclick="VW_VENDOR.quickPOFromLowStock(${p.id})">📋 PO</button>
              <button class="btn-sm" onclick="navigateTo('inventory')">View</button>
            </div>
          </div>`).join('')}
        ${lowStock.length > 5 ? `<p style="font-size:12px;color:var(--text3);margin-top:4px">+${lowStock.length-5} more — see Inventory</p>` : ''}
      </div>`;
    }
  }

  // Quotations summary (status + department breakdown)
  let quotesCard = '';
  if (quotations.length) {
    const qCounts = { draft:0, sent:0, converted:0 };
    const qDeptCount = {};
    quotations.forEach(q => {
      qCounts[q.status] = (qCounts[q.status]||0)+1;
      (q.items||[]).forEach(it => { if (it.department) qDeptCount[it.department] = (qDeptCount[it.department]||0)+1; });
    });
    const topQDepts = Object.entries(qDeptCount).sort((a,b)=>b[1]-a[1]).slice(0,3);
    quotesCard = `
    <div class="card">
      <div class="card-header-row">
        <h3 class="card-title">Tile Quotations</h3>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" style="background:rgba(245,200,66,0.15);border:1px solid var(--gold-border);color:var(--gold)" onclick="VW_TILES.openQuickQuote()">⚡ Quick</button>
          <button class="btn-sm" onclick="navigateTo('tile_quotes')">View All</button>
        </div>
      </div>
      <div class="stat-row">
        <div class="stat"><span class="stat-num">${qCounts.draft||0}</span><span class="stat-label">Draft</span></div>
        <div class="stat"><span class="stat-num">${qCounts.sent||0}</span><span class="stat-label">Sent</span></div>
        <div class="stat"><span class="stat-num">${qCounts.converted||0}</span><span class="stat-label">Converted</span></div>
      </div>
      ${topQDepts.length ? `<p style="font-size:12px;color:var(--text3);margin-top:8px">Top categories: ${topQDepts.map(([d,c])=>`${d} (${c})`).join(', ')}</p>` : ''}
    </div>`;
  }

  // ===== APPROVAL CARDS (Credit Sales / Price Overrides / Quotations) =====
  // Three separate cards rather than one combined list, scoped to what
  // THIS viewer can actually act on right now (same logic as the detail
  // screens use) so nobody sees a pile of approvals that aren't theirs.
  const pendingInvoices = invoices.filter(i => i.approvalStatus === 'pending_approval');
  const creditPending = [];
  const overridePending = [];
  for (const inv of pendingInvoices) {
    if (!(await currentUserCanApproveInvoice(inv))) continue;
    if (inv.creditSale) creditPending.push(inv);
    else if (inv.approvalReason === 'price_override') overridePending.push(inv);
  }
  const quotePending = [];
  for (const q of quotations.filter(q => q.approvalStatus === 'pending_approval')) {
    if (await currentUserCanApprove(q)) quotePending.push(q);
  }

  const approvalCards = (creditPending.length || overridePending.length || quotePending.length) ? `
  <div class="approval-cards-row">
    ${creditPending.length ? `
    <div class="card approval-card" onclick="goToQuotations()" style="cursor:pointer">
      <h3 class="card-title">💳 Credit Sales <span class="badge">${creditPending.length}</span></h3>
      ${creditPending.slice(0,3).map(i => `<div style="font-size:12px;padding:3px 0">${i.invoiceNo} — ₹${i.total.toLocaleString('en-IN')}</div>`).join('')}
    </div>` : ''}
    ${overridePending.length ? `
    <div class="card approval-card" onclick="goToQuotations()" style="cursor:pointer">
      <h3 class="card-title">💰 Price Overrides <span class="badge">${overridePending.length}</span></h3>
      ${overridePending.slice(0,3).map(i => `<div style="font-size:12px;padding:3px 0">${i.invoiceNo} — ₹${i.total.toLocaleString('en-IN')}</div>`).join('')}
    </div>` : ''}
    ${quotePending.length ? `
    <div class="card approval-card" onclick="goToQuotations()" style="cursor:pointer">
      <h3 class="card-title">📄 Quotations <span class="badge">${quotePending.length}</span></h3>
      ${quotePending.slice(0,3).map(q => {
        const delayed = (q.approvalLog||[]).some(e => e.level==='tl' && (e.branches||[]).some(b => b.escalatedToManagement && b.status==='pending'));
        return `<div style="font-size:12px;padding:3px 0">${delayed?'⏰ ':''}${q.quoteNo||''} — ${q.customerName||''}${delayed?' <span style="color:var(--red)">(delayed)</span>':''}</div>`;
      }).join('')}
    </div>` : ''}
  </div>` : '';

  // ===== DAILY SALES / PAYMENTS / CASH REPORT =====
  const todayInvoicesList = invoices.filter(i => new Date(i.date).toDateString() === today && i.approvalStatus !== 'pending_approval');
  const dailyReport = {
    cash: 0, bankUpi: 0, creditOutstanding: 0, advancesCollected: 0, totalBilled: 0
  };
  for (const inv of todayInvoicesList) {
    dailyReport.totalBilled += inv.total || 0;
    if (inv.creditSale) {
      dailyReport.creditOutstanding += inv.balanceDue || inv.total || 0;
    } else {
      const method = (inv.paymentMethod || '').toLowerCase();
      if (method === 'cash') dailyReport.cash += inv.amountReceived || 0;
      else if (method) dailyReport.bankUpi += inv.amountReceived || 0; // QR Scan, Bank Transfer, Cheque, Card all bucket here
    }
    dailyReport.advancesCollected += inv.advanceAmount || 0;
  }
  // Advances collected directly on Quotations today (not yet converted to
  // an invoice) count separately, since that money is real and in-hand
  // even though no invoice exists yet.
  const todayQuoteAdvances = quotations.filter(q => q.advanceCollectedAt && new Date(q.advanceCollectedAt).toDateString() === today)
    .reduce((s,q) => s + (q.advanceAmount || 0), 0);
  dailyReport.advancesCollected += todayQuoteAdvances;

  const dailyReportCard = `
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">📊 Today's Sales &amp; Cash Report</h3>
      <button class="btn-sm" onclick="shareDailyReportWhatsApp()">💬 Share</button>
    </div>
    <div class="total-row"><span>💵 Cash</span><span>₹${Math.round(dailyReport.cash).toLocaleString('en-IN')}</span></div>
    <div class="total-row"><span>🏦 Bank / UPI / Card</span><span>₹${Math.round(dailyReport.bankUpi).toLocaleString('en-IN')}</span></div>
    <div class="total-row"><span>📝 Credit Outstanding</span><span style="color:var(--gold)">₹${Math.round(dailyReport.creditOutstanding).toLocaleString('en-IN')}</span></div>
    <div class="total-row"><span>💰 Advances Collected</span><span>₹${Math.round(dailyReport.advancesCollected).toLocaleString('en-IN')}</span></div>
    <div class="total-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-weight:700"><span>Total Billed Today</span><span>₹${Math.round(dailyReport.totalBilled).toLocaleString('en-IN')}</span></div>
  </div>`;
  window._lastDailyReport = dailyReport;
  const canSeeDailyReport = await currentUserCanSeeDailyReport();

  // ── API usage stats ──
  const _apiAll = (apiUsageRes?.data||[]);
  const _apiToday = _apiAll.filter(l=>l.created_at?.startsWith(today));
  const _usdInr = 84;
  const _uSum = logs => {
    const b={},t={}; let c=0;
    logs.forEach(l=>{ b[l.call_type]=(b[l.call_type]||0)+1; t[l.call_type]=(t[l.call_type]||0)+parseFloat(l.cost_usd||0); c+=parseFloat(l.cost_usd||0); });
    return {b,t,c};
  };
  const _uDay=_uSum(_apiToday), _uMon=_uSum(_apiAll);
  const _utl={ai_visualizer_describe:'✨ AI Describe',ai_visualizer_render:'🖼 AI Render',grn_scan:'📷 GRN Scan',catalog_ocr:'📋 Catalog OCR'};

  return `
  <!-- DASHBOARD HERO -->
  <div style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;color:var(--text3);font-weight:500">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-top:2px">Welcome back, ${profile?.name?.split(' ')[0] || 'Admin'} 👋</div>
      </div>
    </div>
  </div>

  ${urgentBanner}
  ${holdAlertBanner}
  ${approvalCards}

  <!-- KEY METRICS -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">Today's Billing</div>
      <div class="mc-value">₹${todayBilling >= 100000 ? (todayBilling/100000).toFixed(1)+'L' : todayBilling >= 1000 ? Math.round(todayBilling/1000)+'K' : Math.round(todayBilling)}</div>
      ${todayPendingApproval ? `<div class="mc-sub" style="color:var(--gold)">+${todayPendingApproval} pending</div>` : `<div class="mc-sub">${todayInvoicesList.length} invoice${todayInvoicesList.length!==1?'s':''}</div>`}
    </div>
    <div class="metric-card">
      <div class="mc-label">Month</div>
      <div class="mc-value">₹${monthBilling >= 100000 ? (monthBilling/100000).toFixed(1)+'L' : monthBilling >= 1000 ? Math.round(monthBilling/1000)+'K' : Math.round(monthBilling)}</div>
      <div class="mc-sub">this month</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Walk-ins</div>
      <div class="mc-value">${todayCustomers.length}</div>
      <div class="mc-sub">customers today</div>
    </div>
    <div class="metric-card ${lowStock.length > 0 ? 'danger' : ''}">
      <div class="mc-label">Low Stock</div>
      <div class="mc-value">${lowStock.length}</div>
      <div class="mc-sub">${lowStock.length > 0 ? 'need restocking' : 'all good'}</div>
    </div>
  </div>

  <!-- BIRTHDAY BANNER -->
  ${await (async () => {
    const bdays = await VW_EXTRAS.checkCustomerBirthdays();
    if (!bdays.length) return '';
    return `<div class="announce-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:14px;font-weight:700;color:var(--gold)">🎂 ${bdays.length} Birthday${bdays.length>1?'s':''} Today</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${bdays.map(c=>c.name).join(', ')}</div></div>
        <button class="btn-sm" style="background:var(--gold);color:#000;flex-shrink:0" onclick="sendCustomerBirthdayWishes()">Send Wishes</button>
      </div>
    </div>`;
  })()}

  <!-- QUICK ACTIONS — role filtered -->
  <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Quick Actions</div>
  <div class="quick-actions" style="margin-bottom:16px">
    <button class="qa-btn" onclick="navigateTo('checkin')"><span class="qa-icon">🚶</span><span>Check In</span></button>
    <button class="qa-btn" onclick="navigateTo('cart')"><span class="qa-icon">🧾</span><span>New Bill</span></button>
    <button class="qa-btn" onclick="showQuotationPicker()" style="background:var(--gold-muted);border-color:var(--gold-border)"><span class="qa-icon" style="color:var(--gold)">📋</span><span style="color:var(--gold);font-weight:700">Quotation</span></button>
    <button class="qa-btn" onclick="navigateTo('crm')"><span class="qa-icon">👥</span><span>CRM</span></button>
    <button class="qa-btn" onclick="navigateTo('inventory')"><span class="qa-icon">📦</span><span>Inventory</span></button>
    <button class="qa-btn" onclick="navigateTo('tiles')"><span class="qa-icon">⬜</span><span>Tile Quote</span></button>
    <button class="qa-btn" onclick="navigateTo('dispatch')"><span class="qa-icon">🚚</span><span>Dispatch</span></button>
    <button class="qa-btn" onclick="navigateTo('club')"><span class="qa-icon">🏆</span><span>CC Club</span></button>
    <button class="qa-btn" onclick="window.open('./admin.html','_blank')" style="background:linear-gradient(135deg,#1B4F8A,#2272B6);border-color:#2272B6"><span class="qa-icon">⚙️</span><span style="color:#fff;font-weight:800">Admin</span></button>
  </div>

  <!-- EXECUTIVE LEADERBOARD -->
  ${await VW_EXTRAS.renderExecutiveSalesCard(invoices, [], today)}

  <!-- LOW STOCK BANNER -->
  ${lowStockBanner}

  <!-- DAILY REPORT -->
  ${canSeeDailyReport ? dailyReportCard : ''}

  <!-- PENDING QUOTATIONS -->
  ${quotesCard}

  ${profile && profile.role === 'admin' ? `
  <div style="margin-bottom:14px;display:flex;gap:8px">
    <button class="btn-secondary" style="flex:1" onclick="sendDailySummary()">📤 Daily Summary WA</button>
    <button class="btn-secondary" style="flex:1" onclick="navigateTo('analytics')">📈 Analytics</button>
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Business Snapshot</h3>
    <div class="snapshot-grid">
      <div class="snap-item"><div class="snap-val">${customers.length}</div><div class="snap-label">Customers</div></div>
      <div class="snap-item"><div class="snap-val">${invoices.length}</div><div class="snap-label">Orders</div></div>
      <div class="snap-item"><div class="snap-val">${convRate}%</div><div class="snap-label">Conversion</div></div>
      <div class="snap-item"><div class="snap-val">${leads.filter(l=>l.stage!=='Won'&&l.stage!=='Lost').length}</div><div class="snap-label">Open Leads</div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Invoices</h3>
      <div style="display:flex;gap:6px">
        <button class="btn-sm active" id="inv-filter-today" onclick="filterDashboardInvoices('today',this)">Today</button>
        <button class="btn-sm" id="inv-filter-week" onclick="filterDashboardInvoices('week',this)">Week</button>
        <button class="btn-sm" id="inv-filter-all" onclick="filterDashboardInvoices('all',this)">All</button>
      </div>
    </div>
    <div id="dashboard-invoice-list">
    ${todayInvoices.length === 0 ? '<p class="empty-msg">No invoices today yet</p>' :
    [...todayInvoices].sort((a,b) => new Date(b.date)-new Date(a.date)).map(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      const isPaid = inv.paymentVerified;
      const isPending = inv.approvalStatus === 'pending_approval';
      return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2);cursor:pointer" onclick="switchBillingTab('invoices');navigateTo('cart')">
        <div>
          <div style="font-weight:600;font-size:13px">${inv.invoiceNo}</div>
          <div style="font-size:12px;color:var(--text3)">${cust ? cust.name : 'Walk-in'} · ${new Date(inv.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:13px">₹${(inv.total||0).toLocaleString('en-IN')}</div>
          <span style="font-size:11px;color:${isPending?'var(--gold)':isPaid?'#22c55e':'#378ADD'}">${isPending?'⏳ Pending':isPaid?'✓ Verified':'Active'}</span>
        </div>
      </div>`;
    }).join('')}
    </div>
  </div>

  ${topDept.length ? `
  <div class="card">
    <h3 class="card-title">Top Departments</h3>
    ${topDept.map(([dept,count],i)=>`
    <div class="dept-rank-row">
      <span class="dept-rank-no">${i+1}</span>
      <span class="dept-rank-name">${dept}</span>
      <div class="dept-rank-bar-bg"><div class="dept-rank-bar" style="width:${Math.round(count/topDept[0][1]*100)}%"></div></div>
      <span class="dept-rank-count">${count}</span>
    </div>`).join('')}
  </div>` : ''}

  ${VW_AUTH.isAdmin() ? `<div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 class="card-title" style="margin:0">🤖 AI Usage</h3>
      <div style="text-align:right">
        <div style="font-size:9px;color:var(--text3)">This month</div>
        <div style="font-size:14px;font-weight:800;color:var(--gold)">₹${Math.round(_uMon.c*_usdInr).toLocaleString('en-IN')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:10px;color:var(--text3)">Today</div>
        <div style="font-size:22px;font-weight:800;color:var(--gold)">${_apiToday.length}</div>
        <div style="font-size:10px;color:var(--text3)">calls · ₹${Math.round(_uDay.c*_usdInr)}</div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:10px;color:var(--text3)">Month</div>
        <div style="font-size:22px;font-weight:800;color:var(--gold)">${_apiAll.length}</div>
        <div style="font-size:10px;color:var(--text3)">calls · $${_uMon.c.toFixed(2)}</div>
      </div>
    </div>
    ${Object.keys(_utl).map(type => {
      const tc=_uDay.b[type]||0, mc=_uMon.b[type]||0;
      if(!tc&&!mc) return '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2)">
        <div style="font-size:12px;font-weight:600">${_utl[type]}</div>
        <div style="display:flex;gap:14px">
          <div style="text-align:center"><div style="font-size:9px;color:var(--text3)">Today</div><div style="font-size:12px;font-weight:700">${tc}</div></div>
          <div style="text-align:center"><div style="font-size:9px;color:var(--text3)">Month</div><div style="font-size:12px;font-weight:700;color:var(--gold)">${mc}</div></div>
        </div>
      </div>`;
    }).join('')}
    ${_apiAll.length===0?`<div style="text-align:center;padding:12px;color:var(--text3);font-size:12px">No AI calls yet — appears here once staff uses Visualizer, GRN scan, or Catalog OCR</div>`:''}
    <div style="font-size:10px;color:var(--text3);margin-top:8px;text-align:center">⚡ Quick Quote = ₹0 · $1 ≈ ₹${_usdInr}</div>
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Recent Activity</h3>
    <div id="recent-activity">${await renderRecentActivity(visits, customers)}</div>
  </div>
  `;
  } catch(e) {
    console.error('Dashboard load error:', e);
    return `<div style="padding:20px;text-align:center">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:8px">Dashboard could not load</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${e?.message||'Check connection and try again'}</div>
      <button onclick="navigateTo('dashboard')" style="padding:10px 20px;background:var(--gold);border:none;border-radius:8px;font-weight:700;cursor:pointer">↻ Retry</button>
    </div>`;
  }
}

async function loadDashboardData(today) {
  try {
    // Both invoices.date and visits.date are timestamptz — must use ISO string with time
    const todayStart = today + 'T00:00:00+05:30'; // IST midnight

    const invoicesRes = await VW_DB.client.from('invoices')
      .select('id,total,payment_method,credit_sale,approval_status,payment_verified,amount_received')
      .gte('date', todayStart).limit(100).catch(() => ({ data: [] }));
    const invoices = invoicesRes.data || [];
    const revenue = invoices.filter(i => i.approval_status === 'approved')
      .reduce((s,i) => s + (i.amount_received || i.total || 0), 0);

    const el = document.getElementById('dash-revenue');
    if (el) el.textContent = revenue > 0 ? '₹' + Math.round(revenue).toLocaleString('en-IN') : '₹0';

    const visitsRes = await VW_DB.client.from('visits')
      .select('id,visitor_type').gte('date', todayStart).limit(100).catch(() => ({ data: [] }));
    const visits = visitsRes.data || [];
    const visEl = document.getElementById('dash-visits');
    if (visEl) visEl.textContent = visits.length;
    const invEl = document.getElementById('dash-invoices');
    if (invEl) invEl.textContent = invoices.length;

    // Pending TQs for management
    const role = VW_AUTH.getRole?.();
    if (['admin','management','store_manager'].includes(role)) {
      const { data: pendingTQs } = await VW_DB.client.from('tile_quotations')
        .select('id,tq_no,customer_name,grand_total').eq('approval_status','pending_approval')
        .order('created_at').limit(10).catch(() => ({ data: [] }));

      const tqEl = document.getElementById('dash-pending-tqs');
      if (tqEl && pendingTQs?.length) {
        const pipeline = pendingTQs.reduce((s,q) => s + (q.grand_total || 0), 0);
        tqEl.innerHTML = `
        <div class="card" style="border-left:4px solid var(--gold);margin-bottom:12px">
          <div class="card-header-row">
            <h3 class="card-title">⏳ ${pendingTQs.length} TQ${pendingTQs.length>1?'s':''} Pending Approval</h3>
            <button class="btn-sm" style="background:var(--gold);color:#000;font-weight:700" onclick="navigateTo('quick_approve')">⚡ Quick Approve</button>
          </div>
          ${pipeline > 0 ? `<div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">Pipeline: ₹${Math.round(pipeline).toLocaleString('en-IN')}</div>` : ''}
          ${pendingTQs.slice(0,3).map(q => `
          <div class="followup-row" onclick="VW_TILES.openTileQuote(${q.id})" style="cursor:pointer">
            <div class="fu-info">
              <div class="fu-name">${q.customer_name} · ${q.tq_no}</div>
              <div class="fu-dept">${q.grand_total ? '₹'+parseInt(q.grand_total).toLocaleString('en-IN') : 'Price TBD'}</div>
            </div>
            <button class="btn-sm" style="background:var(--gold);color:#000" onclick="event.stopPropagation();navigateTo('quick_approve')">Approve →</button>
          </div>`).join('')}
        </div>`;
      }
    }

    // Tasks
    const tasksRes = await VW_DB.client.from('tasks')
      .select('id,title,status,assigned_to_name,due_date')
      .in('status',['pending','in_progress']).limit(10).catch(() => ({ data: [] }));
    const tasks = tasksRes.data || [];
    const taskEl = document.getElementById('dash-tasks');
    if (taskEl) {
      if (!tasks.length) {
        taskEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">✅ No pending tasks</div>';
      } else {
        taskEl.innerHTML = `
        <div style="font-size:12px;font-weight:700;margin-bottom:8px">📋 Pending Tasks (${tasks.length})</div>
        ${tasks.slice(0,5).map(t => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2);font-size:12px">
          <span>${t.title}</span>
          <span style="color:var(--text3)">${t.assigned_to_name||'Unassigned'}</span>
        </div>`).join('')}`;
      }
    }

    // Low stock — stock column is TEXT so filter in JS after fetch
    const stockRes = await VW_DB.client.from('products')
      .select('id,name,stock,low_stock_threshold,unit')
      .eq('is_active',true).limit(200).catch(() => ({ data: [] }));
    const lowStock = (stockRes.data || []).filter(p => (parseFloat(p.stock) || 0) <= (p.low_stock_threshold || 10)).slice(0, 5);
    const stockEl = document.getElementById('dash-low-stock');
    if (stockEl) {
      if (!lowStock.length) {
        stockEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">✅ Stock levels OK</div>';
      } else {
        stockEl.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px">⚠️ Low Stock (${lowStock.length})</div>
        ${lowStock.map(p => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border2);font-size:12px">
          <span>${p.name}</span>
          <span style="color:var(--red);font-weight:700">${p.stock} ${p.unit}</span>
        </div>`).join('')}`;
      }
    }

  } catch(e) {
    console.warn('Dashboard load error:', e);
  }
}

async function renderRecentActivity(visits, customers) {
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c);
  const recent = visits.slice(-8).reverse();
  if (!recent.length) return '<p class="empty-msg">No activity yet — start by checking in a customer</p>';

  const allTasks = await VW_DB.all(VW_DB.STORES.tasks);
  const deptsByVisit = {};
  allTasks.forEach(t => {
    if (!t.visitId || !t.department) return;
    deptsByVisit[t.visitId] = deptsByVisit[t.visitId] || new Set();
    deptsByVisit[t.visitId].add(t.department);
  });

  return recent.map(v => {
    const depts = deptsByVisit[v.id] ? [...deptsByVisit[v.id]].join(', ') : (v.visitorType || 'Visit');
    return `
    <div class="activity-row">
      <div class="activity-dot" style="background:${{active:'#C8972B',billed:'#22c55e',left:'#888'}[v.status]||'#888'}"></div>
      <div class="activity-info">
        <div class="activity-name">${custMap[v.customerId]?.name || v.customerName || 'Customer'}</div>
        <div class="activity-meta">${depts} · ${new Date(v.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div class="activity-status">${v.status}</div>
    </div>`;
  }).join('');
}

async function renderContractorClub() {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const members = customers.filter(c => c.type === 'contractor_club' || c.ccTier);
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);

  return `
  <div class="module-header">
    <h2>Contractor Club 🏅</h2>
    <div class="stat-row">
      <div class="stat"><span class="stat-num">${members.length}</span><span class="stat-label">Members</span></div>
      <div class="stat"><span class="stat-num">${members.filter(m=>m.ccTier==='Gold'||m.ccTier==='Platinum').length}</span><span class="stat-label">Gold+</span></div>
    </div>
  </div>
  <div class="tier-cards">
    <div class="tier-card silver"><div class="tier-name">Silver</div><div class="tier-benefit">2% first referral bonus</div><div class="tier-count">${members.filter(m=>!m.ccTier||m.ccTier==='Silver').length} members</div></div>
    <div class="tier-card gold"><div class="tier-name">Gold</div><div class="tier-benefit">0.5% lifetime loyalty</div><div class="tier-count">${members.filter(m=>m.ccTier==='Gold').length} members</div></div>
    <div class="tier-card platinum"><div class="tier-name">Platinum</div><div class="tier-benefit">Priority + MaaS access</div><div class="tier-count">${members.filter(m=>m.ccTier==='Platinum').length} members</div></div>
  </div>
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Members</h3>
      <button class="btn-sm" onclick="showAddCCMember()">+ Enroll</button>
    </div>
    <div id="cc-member-list">${await renderCCMembers(members, invoices)}</div>
  </div>
  <div class="card">
    <h3 class="card-title">Referral Bonus Calculator</h3>
    <div class="form-group"><label>Purchase Amount (₹)</label><input type="number" id="ref-amount" placeholder="e.g. 500000" oninput="calcReferral()"></div>
    <div class="form-group"><label>Referral Type</label>
      <select id="ref-type" onchange="calcReferral()">
        <option value="first">First Referral (2%)</option>
        <option value="lifetime">Lifetime Loyalty (0.5%)</option>
      </select>
    </div>
    <div id="ref-result" class="ref-result" style="display:none"></div>
  </div>
  `;
}

async function renderCCMembers(members, invoices) {
  if (!members.length) return '<p class="empty-msg">No Contractor Club members yet</p>';
  return members.map(m => {
    const mInvoices = invoices.filter(i=>i.customerId===m.id);
    const totalSpend = mInvoices.reduce((s,i)=>s+(i.total||0),0);
    const tier = m.ccTier || 'Silver';
    const tierColors = { Silver:'#888', Gold:'#C8972B', Platinum:'#7F77DD' };
    return `<div class="cc-member-row" onclick="openCustomer(${m.id})">
      <div class="cust-avatar" style="background:${tierColors[tier]}22;color:${tierColors[tier]}">${(m.name||'?')[0]}</div>
      <div class="cust-info"><div class="cust-name">${m.name}</div><div class="cust-meta">${m.phone} · ${mInvoices.length} orders · ₹${Math.round(totalSpend/1000)}K spent</div></div>
      <div class="tier-badge" style="color:${tierColors[tier]}">${tier}</div>
    </div>`;
  }).join('');
}

function calcReferral() {
  const amt = parseFloat(document.getElementById('ref-amount').value);
  const type = document.getElementById('ref-type').value;
  if (!amt) { document.getElementById('ref-result').style.display='none'; return; }
  const pct = type === 'first' ? 2 : 0.5;
  const bonus = Math.round(amt * pct / 100);
  const div = document.getElementById('ref-result');
  div.style.display = 'block';
  div.innerHTML = `<span class="ref-pct">${pct}% of ₹${amt.toLocaleString('en-IN')}</span><span class="ref-bonus">= ₹${bonus.toLocaleString('en-IN')} bonus</span>`;
}

function showAddCCMember() {
  VW_DB.all(VW_DB.STORES.customers).then(customers => {
    const sheet = document.getElementById('bottom-sheet');
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Enroll in Contractor Club</h3>
      <div class="form-group"><label>Customer</label>
        <select id="cc-cust-sel">${customers.map(c=>`<option value="${c.id}">${c.name} (${c.phone})</option>`).join('')}</select></div>
      <div class="form-group"><label>Tier</label>
        <select id="cc-tier-sel"><option value="Silver">Silver</option><option value="Gold">Gold</option><option value="Platinum">Platinum</option></select></div>
      <div class="form-group"><label>Referral Code (optional)</label><input type="text" id="cc-ref-code" placeholder="Who referred them?"></div>
      <button class="btn-primary full-width" onclick="enrollCCMember()">Enroll Member</button>`;
    sheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
  });
}

async function enrollCCMember() {
  const custId = parseInt(document.getElementById('cc-cust-sel').value);
  const tier = document.getElementById('cc-tier-sel').value;
  const customer = await VW_DB.getById(VW_DB.STORES.customers, custId);
  customer.ccTier = tier;
  customer.type = 'contractor_club';
  customer.ccEnrolledAt = new Date().toISOString();
  customer.ccRefCode = document.getElementById('cc-ref-code').value;
  await VW_DB.put(VW_DB.STORES.customers, customer);
  showToast(`${customer.name} enrolled as ${tier} member!`, 'success');
  closeSheet();
  navigateTo('club');
}

async function renderFeedbackPage() {
  const feedbacks = await VW_DB.all(VW_DB.STORES.feedback).catch(() => []);
  const visits    = await VW_DB.all(VW_DB.STORES.visits).catch(() => []);
  const customers = await VW_DB.all(VW_DB.STORES.customers).catch(() => []);
  const tasks     = await VW_DB.all(VW_DB.STORES.tasks).catch(() => []);
  const custMap = {}; customers.forEach(c=>custMap[c.id]=c);
  const avgRating = feedbacks.length ? (feedbacks.reduce((s,f)=>s+(f.rating||0),0)/feedbacks.length).toFixed(1) : '—';

  // Show ALL customer visits that haven't received feedback yet — not just today
  const visitedCustIds = new Set(feedbacks.map(f=>String(f.customerId)));
  const tasksByVisit = {};
  tasks.forEach(t => { (tasksByVisit[t.visitId] = tasksByVisit[t.visitId]||[]).push(t.department); });
  const deptNames = await VW_CHECKIN.getDepartmentNames();

  // All customer visits pending feedback, sorted newest first
  const pendingVisits = visits
    .filter(v => v.visitorType==='customer' && v.customerId && !visitedCustIds.has(String(v.customerId)))
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 100);

  const today = new Date().toDateString();
  const todayPending = pendingVisits.filter(v => new Date(v.date).toDateString() === today);
  const olderPending = pendingVisits.filter(v => new Date(v.date).toDateString() !== today);

  return `
  <div class="module-header">
    <h2>Feedback & Reviews</h2>
    <div class="stat-row">
      <div class="stat"><span class="stat-num">${feedbacks.length}</span><span class="stat-label">Total</span></div>
      <div class="stat"><span class="stat-num">${avgRating}${avgRating!=='—'?'★':''}</span><span class="stat-label">Avg Rating</span></div>
      <div class="stat"><span class="stat-num" style="color:var(--gold)">${pendingVisits.length}</span><span class="stat-label">Pending</span></div>
    </div>
  </div>
  <div class="card">
    <h3 class="card-title">Collect Feedback</h3>
    <div class="form-group">
      <label>Select Customer — All Pending (${pendingVisits.length})</label>
      <select id="fb-visit-sel" onchange="onFeedbackVisitChange()">
        <option value="">— Select customer —</option>
        ${todayPending.length ? `<optgroup label="Today (${todayPending.length})">
          ${todayPending.map(v=>{
            const depts = (tasksByVisit[v.id]||[]).join(', ');
            return `<option value="${v.id}_${v.customerId}" data-dept="${(tasksByVisit[v.id]||[])[0]||''}">${custMap[v.customerId]?.name||'?'}${depts?' · '+depts:''} · Today</option>`;
          }).join('')}
        </optgroup>` : ''}
        ${olderPending.length ? `<optgroup label="Earlier (${olderPending.length})">
          ${olderPending.map(v=>{
            const depts = (tasksByVisit[v.id]||[]).join(', ');
            const daysAgo = Math.floor((Date.now()-new Date(v.date))/(1000*60*60*24));
            return `<option value="${v.id}_${v.customerId}" data-dept="${(tasksByVisit[v.id]||[])[0]||''}">${custMap[v.customerId]?.name||'?'}${depts?' · '+depts:''} · ${daysAgo}d ago</option>`;
          }).join('')}
        </optgroup>` : ''}
      </select>
    </div>
    <div class="form-group"><label>Rating</label>
      <div class="star-row" id="star-row">
        ${[1,2,3,4,5].map(n=>`<button class="star-btn" data-val="${n}" onclick="setRating(${n})">☆</button>`).join('')}
      </div>
    </div>
    <div class="form-group"><label>What did they like?</label><input type="text" id="fb-positive" placeholder="e.g. Wide variety, helpful staff"></div>
    <div class="form-group"><label>Suggestions?</label><input type="text" id="fb-suggestion" placeholder="e.g. Need more colour options"></div>
    <div class="form-group"><label>Department</label>
      <select id="fb-dept">${deptNames.map(d=>`<option>${d}</option>`).join('')}</select>
    </div>
    <button class="btn-primary full-width" onclick="submitFeedback()">Submit Feedback</button>
  </div>
  <div class="card">
    <h3 class="card-title">Recent Reviews</h3>
    <div>${renderFeedbackList(feedbacks, custMap)}</div>
  </div>`;
}

function onFeedbackVisitChange() {
  const sel = document.getElementById('fb-visit-sel');
  const opt = sel.options[sel.selectedIndex];
  const dept = opt ? opt.dataset.dept : '';
  if (dept) document.getElementById('fb-dept').value = dept;
}

let selectedRating = 0;
function setRating(val) {
  selectedRating = val;
  document.querySelectorAll('.star-btn').forEach((b,i) => { b.textContent = i < val ? '★' : '☆'; b.style.color = i < val ? '#C8972B' : '#888'; });
}

async function submitFeedback() {
  if (!selectedRating) return showToast('Please select a rating', 'warn');
  const sel = document.getElementById('fb-visit-sel').value;
  const [visitId, customerId] = sel ? sel.split('_').map(Number) : [null, null];
  const customer = customerId ? await VW_DB.getById(VW_DB.STORES.customers, customerId) : null;
  await VW_DB.put(VW_DB.STORES.feedback, {
    visitId, customerId, rating: selectedRating,
    positive: document.getElementById('fb-positive').value,
    suggestion: document.getElementById('fb-suggestion').value,
    department: document.getElementById('fb-dept').value,
    date: new Date().toISOString()
  });
  if (customer) await VW_NOTIFY.notify('feedback', null, [customer.name], 'en', 'feedback');
  showToast('Feedback saved!', 'success');
  selectedRating = 0;
  navigateTo('feedback');
}

function renderFeedbackList(feedbacks, custMap) {
  if (!feedbacks.length) return '<p class="empty-msg">No feedback yet</p>';
  return feedbacks.slice(-20).reverse().map(f => `
    <div class="fb-row">
      <div class="fb-header">
        <span class="fb-stars">${'★'.repeat(f.rating||0)}${'☆'.repeat(5-(f.rating||0))}</span>
        <span class="fb-who">${custMap[f.customerId]?.name||'Customer'} · ${f.department||''}</span>
        <span class="fb-date">${new Date(f.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
      </div>
      ${f.positive ? `<div class="fb-text">👍 ${f.positive}</div>` : ''}
      ${f.suggestion ? `<div class="fb-text fb-suggest">💡 ${f.suggestion}</div>` : ''}
    </div>`).join('');
}

function closeMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (menu) menu.style.display = 'none';
}
window.closeMoreMenu = closeMoreMenu;

// Header ⋯ dropdown — toggle open/close
function toggleHeaderMore() {
  const menu = document.getElementById('hdr-more-menu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', function closeHdr(e) {
        if (!document.getElementById('hdr-more-wrap')?.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeHdr);
        }
      });
    }, 10);
  }
}
window.toggleHeaderMore = toggleHeaderMore;

// Called from applyRolePermissions — show/hide items in header dropdown per role
function updateHeaderDropdownRoles() {
  const role = VW_AUTH?.getRole?.();
  const allowed = VW_AUTH?.getAllowedPages?.() || [];

  // Hide staff header elements for customer/contractor
  const staffHeaderItems = ['hdr-eod-btn','hdr-settings-btn'];
  const isPublic = role === 'customer' || role === 'contractor';

  staffHeaderItems.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isPublic ? 'none' : (allowed.includes(id.replace('hdr-','').replace('-btn','')) ? '' : 'none');
  });

  // Update logo click for customers
  const logo = document.querySelector('.header-logo-block');
  if (logo) {
    if (role === 'customer') logo.setAttribute('onclick', "navigateTo('shop')");
    else if (role === 'contractor') logo.setAttribute('onclick', "navigateTo('professional_home')");
    else logo.setAttribute('onclick', "navigateTo('dashboard')");
  }

  const eodBtn = document.getElementById('hdr-eod-btn');
  const settBtn = document.getElementById('hdr-settings-btn');
  if (eodBtn) eodBtn.style.display = (!isPublic && allowed.includes('eod')) ? '' : 'none';
  if (settBtn) settBtn.style.display = (!isPublic && allowed.includes('settings')) ? '' : 'none';
}

function toggleMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  if (isOpen) {
    menu.style.display = 'none';
  } else {
    menu.style.display = 'block';
    // Highlight current active page tile
    menu.querySelectorAll('.more-tile[data-page]').forEach(btn => {
      btn.dataset.active = btn.dataset.page === currentPage ? 'true' : 'false';
    });
  }
}

// Close more menu when tapping outside it
document.addEventListener('click', (e) => {
  const menu = document.getElementById('more-menu');
  if (!menu || menu.style.display !== 'block') return;
  const moreBtn = document.querySelector('.nav-btn[data-page="more"]');
  if (!menu.contains(e.target) && !(moreBtn && moreBtn.contains(e.target))) {
    menu.style.display = 'none';
  }
}, true); // capture phase so it fires before tile onclick

async function refreshNotifBadge() {
  const count = await VW_NOTIFY.getUnreadNotificationCount();
  const role  = VW_AUTH.getRole?.();

  // For management/admin, also count pending TQs
  let extra = 0;
  if (role === 'admin' || role === 'management') {
    const { count: pendingTQs } = await VW_DB.client
      .from('tile_quotations')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending_approval')
      .catch(() => ({ count: 0 }));
    extra = pendingTQs || 0;
  }

  const total = (count || 0) + extra;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = total > 0 ? (total > 99 ? '99+' : total) : '';
    badge.style.display = total > 0 ? 'flex' : 'none';
    if (extra > 0) badge.style.background = 'var(--red)'; // red when TQs pending
    else badge.style.background = '';
  }
}
window.refreshNotifBadge = refreshNotifBadge;

// Loud notification alert using Web Audio API
function playNotificationAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.8, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    // Three ascending beeps — attention-grabbing
    playBeep(880, 0, 0.15);
    playBeep(1100, 0.2, 0.15);
    playBeep(1320, 0.4, 0.3);
  } catch(e) { /* Audio not available */ }
}
window.playNotificationAlert = playNotificationAlert;

// Loud mode toggle — stored in localStorage per staff member
function toggleLoudNotifMode() {
  window._loudNotifEnabled = !window._loudNotifEnabled;
  localStorage.setItem('vw_loud_notif', window._loudNotifEnabled ? '1' : '0');
  const btn = document.getElementById('loud-notif-btn');
  if (btn) {
    btn.textContent = window._loudNotifEnabled ? '🔔 Loud ON' : '🔕 Loud OFF';
    btn.style.color = window._loudNotifEnabled ? 'var(--gold)' : 'var(--text3)';
  }
  if (window._loudNotifEnabled) {
    playNotificationAlert(); // Demo sound
    showToast('Loud notifications ON — you will hear alerts', 'success');
  } else {
    showToast('Loud notifications OFF', 'warn');
  }
}
window.toggleLoudNotifMode = toggleLoudNotifMode;

// Init loud mode from saved preference
window._loudNotifEnabled = localStorage.getItem('vw_loud_notif') === '1';

async function showNotifPanel() {
  const sheet = document.getElementById('bottom-sheet');
  const notifs = await VW_NOTIFY.getMyPersistedNotifications();
  const profile = VW_AUTH.getCurrentProfile();

  const categoryLabels = { shortage: '📦 Stock Shortage', approval: '✅ Approval Needed', visitor: '🚪 Visitor', task: '📋 Task', commitment: '⏰ Delivery Commitment' };
  const grouped = {};
  notifs.forEach(n => { grouped[n.category] = grouped[n.category] || []; grouped[n.category].push(n); });

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">Notifications</h3>
      <div style="display:flex;gap:8px">
        <button id="loud-notif-btn" onclick="toggleLoudNotifMode()" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;color:${window._loudNotifEnabled?'var(--gold)':'var(--text3)'}">${window._loudNotifEnabled?'🔔 Loud ON':'🔕 Loud OFF'}</button>
        <button class="btn-sm" onclick="markAllNotificationsRead()">Mark all read</button>
      </div>
    </div>
    <div id="notif-list" class="notif-list">
      ${notifs.length ? Object.entries(grouped).map(([cat, items]) => `
        <div style="margin-bottom:14px">
          <div style="font-size:13px;font-weight:600;color:var(--text3);margin-bottom:6px">${categoryLabels[cat] || cat}</div>
          ${items.map(n => renderNotificationCard(n, profile)).join('')}
        </div>`).join('') : '<p class="empty-msg">No notifications right now</p>'}
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  await refreshNotifBadge();
}
window.showNotifPanel = showNotifPanel;

function renderNotificationCard(n, profile) {
  const isRead = (n.readBy||[]).includes(profile.id);
  const timeAgo = formatTimeAgo(n.createdAt);
  return `
  <div class="req-item-card" style="margin-bottom:6px;${isRead ? 'opacity:0.55' : ''}" onclick="markNotificationReadAndRefresh(${n.id})">
    <div style="font-weight:600;font-size:13px">${n.title}</div>
    <div style="font-size:12px;color:var(--text2);margin-top:2px">${n.body}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">${timeAgo}</div>
    ${(n.actions||[]).length ? `
    <div style="display:flex;gap:6px;margin-top:8px">
      ${n.actions.map(a => `<button class="btn-sm" onclick="event.stopPropagation();handleNotificationAction(${n.id},'${a.action}')">${a.label}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function formatTimeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
}

async function markNotificationReadAndRefresh(notifId) {
  await VW_NOTIFY.markNotificationRead(notifId);
  await refreshNotifBadge();
  showNotifPanel();
}
window.markNotificationReadAndRefresh = markNotificationReadAndRefresh;

async function markAllNotificationsRead() {
  const notifs = await VW_NOTIFY.getMyPersistedNotifications();
  for (const n of notifs) await VW_NOTIFY.markNotificationRead(n.id);
  await refreshNotifBadge();
  showNotifPanel();
}
window.markAllNotificationsRead = markAllNotificationsRead;

async function handleNotificationAction(notifId, action) {
  const n = await VW_DB.getById(VW_DB.STORES.persistedNotifications, notifId);
  if (!n) return;
  await VW_NOTIFY.markNotificationRead(notifId);

  if (action === 'create_po' && n.relatedTable === 'products') {
    closeSheet();
    navigateTo('inventory');
    setTimeout(() => VW_INVENTORY.showAddPO(n.relatedId), 100);
    return;
  }
  if (action === 'open_contractor_kyc') {
    closeSheet();
    await navigateTo('contractor_kyc');
    return;
  }
  if (action === 'open_returns') {
    closeSheet();
    await navigateTo('returns');
    return;
  }
  if (action === 'open_order') {
    closeSheet();
    await navigateTo('orders');
    return;
  }
  if (action === 'order_update') {
    closeSheet();
    await navigateTo('my_orders');
    return;
  }
  if (action === 'open_labor_request') {
    closeSheet();
    await navigateTo('labor_requests');
    if (n.relatedId) setTimeout(() => VW_LABOR.openLaborRequest(n.relatedId), 400);
    return;
  }
  if (action === 'open_labor_job') {
    closeSheet();
    await navigateTo('labor_requests');
    return;
  }
  if (action === 'pay_labor_log') {
    closeSheet();
    if (n.relatedId) await VW_LABOR.processLaborPayment(n.relatedId);
    return;
  }
  if (action === 'open_labor_bid') {
    closeSheet();
    await navigateTo('labor_requests');
    if (n.relatedId) setTimeout(() => VW_LABOR.openLaborRequest(n.relatedId), 400);
    return;
  }
  if (action === 'open_wallet') {
    closeSheet();
    await navigateTo('wallet');
    return;
  }
  if (action === 'open_po_approval') {
    closeSheet();
    await navigateTo('vendors');
    // Open the PO from Supabase id stored in notification
    if (n.relatedId) {
      const pos = await VW_DB.all(VW_DB.STORES.purchaseOrders);
      const po = pos.find(p => p.supabaseId === n.relatedId || p.id === n.relatedId);
      if (po) setTimeout(() => VW_VENDOR.openPO(po.id), 400);
    }
    return;
  }
  if (action === 'open_product_pricing') {
    closeSheet();
    if (n.relatedId) setTimeout(() => VW_INVENTORY.openProductPricingTab(n.relatedId), 300);
    return;
  }
  if (action === 'open_tq' && n.relatedTable === 'tile_quotations') {
    closeSheet();
    await navigateTo('tile_quotes');
    setTimeout(() => VW_TILES.openTileQuote(n.relatedId), 300);
    return;
  }
  if (action === 'view_quotation' && n.relatedTable === 'quotations') {
    closeSheet();
    navigateTo('cart');
    setTimeout(() => VW_QUOTATIONS.openQuotationDetail(n.relatedId), 100);
    return;
  }
  showNotifPanel();
}
window.handleNotificationAction = handleNotificationAction;

function closeSheet() {
  stopActiveScanner(); // any of the 60+ call sites for closeSheet() might be closing a sheet with a live camera running — always stop it here rather than hunting down each one
  cleanupAbandonedNewProductPhotos(); // same reasoning — if the Add Product sheet is closing with unsaved photos still sitting in newProductPhotos, they were never attached to anything and should be removed from storage rather than left orphaned
  document.getElementById('bottom-sheet').classList.remove('open');
  document.getElementById('sheet-overlay').classList.remove('open');
}

function openFeedback(customerId, visitId) { navigateTo('feedback'); }

// Hard refresh without losing login — Supabase keeps the session in
// browser storage, so a plain reload re-fetches everything fresh and
// lands you right back on the dashboard already logged in. This is for
// "I just made changes elsewhere and want this screen fully current"
// without resorting to closing and reopening the whole app.
function hardRefreshApp() {
  location.reload();
}
window.hardRefreshApp = hardRefreshApp;

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

async function init() {
  // Force clear old SW caches on every load (safe — SW will re-cache)
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => {
      if (!k.includes('v8')) caches.delete(k);
    })).catch(() => {});
  }

  // Handle Cashfree payment return
  const _cfUrlParams = new URLSearchParams(window.location.search);
  const cfOrder = _cfUrlParams.get('cf_order');
  if (cfOrder) {
    window.history.replaceState({}, '', window.location.pathname);
    window._pendingCFOrder = cfOrder;
  }

  // Global error boundary — catch unhandled promise rejections
  window.addEventListener('unhandledrejection', event => {
    const msg = event.reason?.message || String(event.reason || '');
    // Ignore known non-critical errors
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || 
        msg.includes('AbortError') || msg.includes('Load failed')) return;
    console.error('Unhandled rejection:', event.reason);
    if (typeof showToast === 'function') {
      showToast('Something went wrong — please try again', 'error');
    }
    event.preventDefault();
  });

  // Global JS error handler
  window.addEventListener('error', event => {
    if (event.message?.includes('Script error')) return;
    console.error('JS error:', event.error);
  });

  try {
    await VW_DB.initDB();
    // Load loyalty config into global so billing can use it immediately
    VW_DB.getSetting('loyalty_config', { pointValue: 1, earnRate: 1, maxRedeemPct: 10 })
      .then(cfg => { window._loyaltyConfig = cfg; });
  } catch(e) {
    console.error('DB init error:', e);
    document.getElementById('app-content').innerHTML = `<div style="padding:2rem;text-align:center">
      <div style="font-size:2rem;margin-bottom:1rem">&#9888;&#65039;</div>
      <div style="color:#C8972B;font-weight:600;margin-bottom:8px">Could not connect to the database</div>
      <div style="color:var(--text3);font-size:13px">${e.message || 'Check Supabase configuration in db.js'}</div>
    </div>`;
    return;
  }

  // Candidate onboarding links (?onboard=<offerId>) are a standalone,
  // no-login flow — short-circuit before any auth check, since the
  // candidate filling this out has no app account at all.
  const urlParams = new URLSearchParams(window.location.search);

  // KIOSK MODE — ?kiosk=1 bypasses login entirely
  if (urlParams.get('kiosk') === '1') {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_EMPLOYEE.renderKioskMode();
    return;
  }

  // SECURITY KIOSK — ?kiosk=security — simple 3-button entrance screen
  if (urlParams.get('kiosk') === 'security') {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_CHECKIN.renderSecurityKioskPage();
    // Override navigateTo on kiosk page — strip URL params and reload normally
    window._kioskMode = 'security';
    return;
  }

  // CONTRACTOR PUBLIC PORTAL — ?contractor=TOKEN
  const contractorToken = urlParams.get('contractor');
  if (contractorToken && contractorToken !== '1') {
    // Specific contractor portal token
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_CONTRACTOR.renderContractorPublicPortal(contractorToken);
    return;
  }
  // ?contractor=1 means contractor login — fall through to normal auth

  // CONTRACTOR SIGNUP — ?signup=contractor
  const signupParam = urlParams.get('signup');
  if (signupParam === 'contractor') {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_CONTRACTOR.renderContractorSignupPage();
    return;
  }

  // CUSTOMER PORTAL — ?customer=TOKEN
  const customerToken = urlParams.get('customer');
  if (customerToken) {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_CUSTOMER_PORTAL.renderCustomerPortal(customerToken);
    return;
  }

  // CUSTOMER SELF-REGISTER — ?register=customer
  const registerParam = urlParams.get('register');
  if (registerParam === 'customer') {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_CUSTOMER_PORTAL.renderCustomerRegisterPage();
    return;
  }

  // PRODUCT QR SCAN — ?product_qr=ID
  const productQR = urlParams.get('product_qr');
  if (productQR) {
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_TILE_INV.renderProductQRPage(productQR);
    return;
  }

  // If we arrived here with kiosk in URL but somehow got past — strip it
  if (urlParams.has('kiosk') || urlParams.has('delivery') || urlParams.has('track')) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  // DRIVER DELIVERY CONFIRMATION — ?delivery=GP/26-27/00001
  const deliveryPass = urlParams.get('delivery');
  if (deliveryPass) {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_DISPATCH.renderDriverDeliveryPageDetailed(decodeURIComponent(deliveryPass));
    return;
  }

  // CUSTOMER DELIVERY TRACKING — ?track=TOKEN public tracking page
  const trackToken = urlParams.get('track');
  if (trackToken) {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').innerHTML = await VW_DISPATCH.renderDeliveryTrackingPage(trackToken);
    return;
  }

  // CUSTOMER PORTAL — ?quote=XXXXX public quotation view, no login needed
  if (urlParams.get('quote')) {
    document.getElementById('app-nav')?.style.setProperty('display','none','important');
    document.getElementById('app-header')?.style.setProperty('display','none','important');
    document.getElementById('app-content').style.padding = '0';
    await VW_CUSTOMER_PORTAL.renderCustomerPortal();
    return;
  }
  const onboardOfferId = urlParams.get('onboard');
  if (onboardOfferId) {
    await VW_ONBOARDING.renderCandidateEntry(onboardOfferId);
    return;
  }

  const ready = await VW_AUTH.onAuthReady();
  if (!ready) return; // login / pending / rejected screen is showing

  try { await VW_NOTIFY.requestNotifPermission(); } catch(e) {}

  // Route to correct home based on role
  const _initRole = VW_AUTH.getRole?.();

  if (!_initRole || _initRole === 'customer') {
    await navigateTo('shop');
  } else if (_initRole === 'contractor') {
    await navigateTo('labor_requests');
  } else {
    await navigateTo('dashboard');
  }
  try { _initI18nObserver(); if (_currentLang !== 'en') setTimeout(() => translatePageChrome(document.body), 100); } catch(e) {}
  try { await refreshNotifBadge(); } catch(e) {}

  // Init data protection for non-admin staff
  try { initDataProtection(); } catch(e) {}

  // Delay heavy background tasks so initial page load is fast
  setTimeout(async () => {
    try { window._packingRules = await VW_DB.getSetting('packing_charge_rules', []); } catch(e) { window._packingRules = []; }
    try { await VW_ESCALATION.checkEscalations(); } catch(e) {}
  }, 5000); // 5 second delay

  // Realtime refresh — throttled
  setInterval(async () => {
    try { await VW_ESCALATION.checkEscalations(); } catch(e) {}
  }, 60000); // every 60s not 30s

  // Realtime subscriptions — staff only, not for guests/customers
  if (_initRole && !['customer','contractor'].includes(_initRole)) {
    let refreshTimer = null;
    const liveRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        if (currentPage === 'tile_quote_submitted') return;
        if (currentPage === 'tiles') return;
        if (currentPage === 'dashboard') navigateTo('dashboard');
        else if (currentPage === 'checkin') await refreshCheckinList();
        else if (currentPage === 'tasks') navigateTo('tasks');
      }, 2000); // longer debounce
    };
    try {
      VW_DB.subscribeTable(VW_DB.STORES.visits, liveRefresh);
      VW_DB.subscribeTable(VW_DB.STORES.tasks, liveRefresh);
    } catch(e) {}
  }
}

// Re-renders only the "Today's Activity" list on the Check-in page,
// leaving any in-progress check-in form untouched.
async function refreshCheckinList() {
  if (currentPage !== 'checkin') return;
  const list = document.getElementById('today-visits-list');
  if (!list) return;
  const todayVisits = await VW_CHECKIN.getTodayVisits();
  await VW_CHECKIN.applyActivityFilters();
  const countEl = document.getElementById('today-count');
  const activeEl = document.getElementById('active-count');
  if (countEl) countEl.textContent = todayVisits.length;
  if (activeEl) activeEl.textContent = todayVisits.filter(v=>v.status==='active'||v.status==='pending').length;
}

// Global function wires
window.navigateTo = navigateTo;
window.toggleMoreMenu = toggleMoreMenu;

// ===== FIELD EXECUTIVE GREETING TEMPLATES =====
async function showFieldGreeting(type) {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const profile = VW_AUTH.getCurrentProfile();
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';

  const templates = {
    followup: (name) => `Hi ${name}! 👋\n\nThis is ${profile?.name||'your V Wholesale executive'}. Just checking in on your project — how is it going? Do you need any materials or assistance from us?\n\nHappy to help at any time! 😊\n\n— ${profile?.name||''}, ${storeName}`,
    thankyou: (name) => `Dear ${name},\n\nThank you for your time today! It was great discussing your project requirements. We look forward to serving you.\n\nFor any queries, feel free to reach out to me directly.\n\nWarm regards,\n${profile?.name||''}\n${storeName} 🏠`,
    offer: (name) => `Hi ${name}! 🎁\n\nGreat news! We have a special offer running this week on selected products. Visit us or call to know more.\n\nWe'd love to see you at V Wholesale!\n\n— ${profile?.name||''}, ${storeName}`,
    festive: (name) => `Dear ${name},\n\nWishing you and your family a very Happy Festival! 🎉🪔\n\nThank you for your continued trust and support. It's our privilege to serve you.\n\nWith warm wishes,\n${profile?.name||''}\n${storeName} 🏠`
  };

  const greetingMap = Object.fromEntries(Object.entries(templates).map(([k,fn])=>[k, fn('__NAME__')]));
  const previewText = greetingMap[type]||'';
  window._greetingTemplates = templates;
  window._greetingType = type;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Send Greeting</h3>
    <div class="form-group">
      <label>Select Customer</label>
      <select id="greeting-customer" onchange="updateGreetingPreview('${type}',this)">
        <option value="">— Select customer —</option>
        ${customers.filter(c=>c.phone).map(c => `<option value="${c.id}" data-phone="${c.phone}" data-name="${c.name}">${c.name} · ${c.phone}</option>`).join('')}
      </select>
    </div>
    <div id="greeting-preview" style="padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;white-space:pre-wrap;margin-bottom:12px;min-height:80px;color:var(--text2)">Select a customer to preview</div>
    <button class="btn-wa full-width" onclick="sendFieldGreeting('${type}')">💬 Send via WhatsApp</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showFieldGreeting = showFieldGreeting;

function updateGreetingPreview(type, sel) {
  const opt = sel?.options[sel.selectedIndex];
  const name = opt?.dataset.name || 'Customer';
  const templates = window._greetingTemplates;
  const el = document.getElementById('greeting-preview');
  if (el && templates?.[type]) el.textContent = templates[type](name);
}
window.updateGreetingPreview = updateGreetingPreview;

function filterLedgerSearch(term) {
  const customers = window._ledgerAllCustomers || [];
  const t = term.toLowerCase();
  const filtered = t.length < 2 ? customers.slice(0,20)
    : customers.filter(c => (c.name||'').toLowerCase().includes(t) || (c.phone||'').includes(t));
  const list = document.getElementById('ledger-customer-list');
  if (!list) return;
  list.innerHTML = filtered.slice(0,30).map(c => `
    <div class="cust-row" onclick="navigateTo('ledger',{customerId:${c.id}})">
      <div class="staff-avatar">${(c.name||'?')[0].toUpperCase()}</div>
      <div class="cust-info">
        <div class="cust-name">${c.name}</div>
        <div class="cust-meta">${c.phone||'—'} · ${c.type||'retail'}</div>
      </div>
    </div>`).join('') || '<p class="empty-msg">No customers found</p>';
}
window.filterLedgerSearch = filterLedgerSearch;

async function sendFieldGreeting(type) {
  const sel = document.getElementById('greeting-customer');
  const opt = sel?.options[sel.selectedIndex];
  if (!opt?.value) { showToast('Select a customer first', 'warn'); return; }
  const name = opt.dataset.name||'Customer';
  const phone = opt.dataset.phone||'';
  if (!phone) { showToast('This customer has no phone number', 'warn'); return; }
  const templates = window._greetingTemplates;
  const msg = encodeURIComponent(templates[type](name));
  window.open(`https://wa.me/91${phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  closeSheet();
}
window.sendFieldGreeting = sendFieldGreeting;
window.closeSheet = closeSheet;
window.showToast = showToast;
window.openFeedback = openFeedback;
window.calcReferral = calcReferral;
window.setRating = setRating;
window.submitFeedback = submitFeedback;
window.onFeedbackVisitChange = onFeedbackVisitChange;
window.showAddCCMember = showAddCCMember;
window.enrollCCMember = enrollCCMember;
window.renderRecentActivity = renderRecentActivity;

window.openCustomer = (...a) => VW_CRM.openCustomer(...a);
window.openWhatsApp = (phone, name) => { const msg = VW_NOTIFY.waEncode(`Hello ${name}! Thank you for visiting V Wholesale, Vijayawada. 🏠`); window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank'); };
window.callPhone = (phone) => { if (phone) window.location.href = `tel:${phone}`; };

async function sendDailySummary() {
  const visits   = await VW_DB.all(VW_DB.STORES.visits).catch(() => []);
  const invoices = await VW_DB.all(VW_DB.STORES.invoices).catch(() => []);
  const tasks    = await VW_DB.all(VW_DB.STORES.tasks).catch(() => []);
  const feedback = await VW_DB.all(VW_DB.STORES.feedback).catch(() => []);
  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(i => new Date(i.date).toDateString() === today);
  const todayVisits = visits.filter(v => new Date(v.date).toDateString() === today);
  const todayCustomers = todayVisits.filter(v=>v.visitorType==='customer');
  const todayVisitors = todayVisits.filter(v=>v.visitorType!=='customer');
  const todayBilling = todayInvoices.filter(i => i.approvalStatus === 'approved').reduce((s,i)=>s+(i.total||0),0);
  const todayTasks = tasks.filter(t => new Date(t.createdAt).toDateString() === today);
  const deptCount = {};
  todayTasks.forEach(t => { if(t.department) deptCount[t.department]=(deptCount[t.department]||0)+1; });
  const topDept = Object.entries(deptCount).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const todayFeedback = feedback.filter(f => new Date(f.date).toDateString() === today);
  const avgRating = todayFeedback.length ? (todayFeedback.reduce((s,f)=>s+(f.rating||0),0)/todayFeedback.length).toFixed(1) : null;
  const dateStr = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  let msg = `📊 V Wholesale — Daily Summary\n${dateStr}\n\n`;
  msg += `👥 Customer Walk-ins: ${todayCustomers.length}\n`;
  msg += `🚪 Visitors: ${todayVisitors.length}\n`;
  msg += `💰 Today's Billing: ₹${todayBilling.toLocaleString('en-IN')}\n`;
  msg += `📋 New Requirements Logged: ${todayTasks.length}\n`;
  if (topDept.length) msg += `🏆 Top Departments: ${topDept.map(([d,c])=>`${d} (${c})`).join(', ')}\n`;
  if (avgRating) msg += `⭐ Avg Rating Today: ${avgRating} (${todayFeedback.length} review${todayFeedback.length>1?'s':''})\n`;

  const escalationContacts = await VW_DB.getSetting('escalationContacts', {});
  const phone = (escalationContacts.management && escalationContacts.management.phone) || '';
  const encoded = VW_NOTIFY.waEncode(msg);
  const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}
window.sendDailySummary = sendDailySummary;
window.showAddLead = (...a) => VW_CRM.showAddLead(...a);
window.saveLead = () => VW_CRM.saveLead();
window.updateLead = (id) => VW_CRM.updateLead(id);
window.openLead = (id) => VW_CRM.openLead(id);
window.showAddCustomer = () => VW_CRM.showAddCustomer();
window.saveNewCustomer = () => VW_CRM.saveNewCustomer();
window.searchCustomers = (v) => VW_CRM.searchCustomers(v);
window.hideAddCustomer = () => { const el = document.getElementById('add-customer-form'); if(el) el.style.display='none'; };

window.submitCheckin = () => VW_CHECKIN.submitCheckin();

window.addToCart = (id) => VW_CART.addToCart(id);
window.removeFromCart = (i) => VW_CART.removeFromCart(i);
window.updateQty = (i,v) => VW_CART.updateQty(i,v);
window.clearCart = () => VW_CART.clearCart();
window.generateInvoice = () => VW_CART.generateInvoice();
window.updateTotals = () => VW_CART.updateTotals();
window.searchProducts = (v) => VW_CART.searchProducts(v);
window.filterCat = (c,b) => VW_CART.filterCat(c,b);
window.printInvoice = (inv, cId) => VW_CART.printInvoice(inv, cId);
window.goToCart = (cId, vId) => { activeCart = { customerId: cId, visitId: vId, items: [] }; billingTab = 'bill'; navigateTo('cart'); };

async function repeatLastOrder(customerId) {
  const invoices = await VW_DB.getByIndex(VW_DB.STORES.invoices, 'customerId', customerId);
  if (!invoices.length) return showToast('No previous orders found', 'warn');
  const last = invoices.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const products = await VW_DB.all(VW_DB.STORES.products);

  const items = [];
  let matchedCount = 0;
  (last.items||[]).forEach(it => {
    const match = products.find(p => p.name === it.name);
    if (match) {
      items.push({ productId: match.id, name: match.name, price: match.price, qty: it.qty || 1, unit: match.unit, gst: match.gst || 18 });
      matchedCount++;
    } else {
      items.push({ productId: null, name: it.name, price: it.price || 0, qty: it.qty || 1, unit: '', gst: it.gst || 0 });
    }
  });

  activeCart = { customerId, visitId: null, items };
  billingTab = 'bill';
  closeSheet();
  await navigateTo('cart');
  showToast(`Repeated last order — ${matchedCount}/${items.length} items matched current inventory, review before billing`, 'info');
}
window.repeatLastOrder = repeatLastOrder;

// ---------- VOICE-TO-TEXT (Web Speech API) ----------
// Tap mic to start, tap again to stop. Appends transcribed text to the
// target textarea. Supports English and Telugu (toggle via long-press).
let voiceRecognition = null;
let voiceActiveBtn = null;
let voiceLang = 'en-IN';

function toggleVoiceInput(targetId, btn) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return showToast('Voice input not supported on this browser', 'warn');

  // If already recording, stop it
  if (voiceRecognition && voiceActiveBtn === btn) {
    voiceRecognition.stop();
    return;
  }
  // If a different field is recording, stop that first
  if (voiceRecognition) voiceRecognition.stop();

  const recognition = new SpeechRecognition();
  recognition.lang = voiceLang;
  recognition.continuous = false;
  recognition.interimResults = false;

  voiceRecognition = recognition;
  voiceActiveBtn = btn;
  btn.classList.add('mic-active');
  btn.textContent = '🔴';

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const ta = document.getElementById(targetId);
    if (ta) {
      ta.value = ta.value ? ta.value.trim() + ' ' + transcript : transcript;
    }
  };
  recognition.onerror = () => showToast('Could not hear you, try again', 'warn');
  recognition.onend = () => {
    btn.classList.remove('mic-active');
    btn.textContent = '🎤';
    voiceRecognition = null;
    voiceActiveBtn = null;
  };
  recognition.start();
}

function cycleVoiceLang(btn) {
  voiceLang = voiceLang === 'en-IN' ? 'te-IN' : 'en-IN';
  btn.textContent = voiceLang === 'te-IN' ? 'తె' : 'EN';
}
window.cycleVoiceLang = cycleVoiceLang;
window.toggleVoiceInput = toggleVoiceInput;

window.searchInventory = (v) => VW_INVENTORY.searchInventory(v);
window.invFilterCat = (c,b) => VW_INVENTORY.invFilterCat(c,b);
window.openProduct = (id) => VW_INVENTORY.openProduct(id);
window.updateProduct = (id) => VW_INVENTORY.updateProduct(id);
window.showAddProduct = () => VW_INVENTORY.showAddProduct();
window.saveNewProduct = () => VW_INVENTORY.saveNewProduct();
window.showRestock = (id) => VW_INVENTORY.showRestock(id);
window.confirmRestock = (id) => VW_INVENTORY.confirmRestock(id);
window.showAddPO = () => VW_INVENTORY.showAddPO();
window.savePO = (s) => VW_VENDOR.savePO(s);
window.openPO = (id) => VW_VENDOR.openPO(id);

window.markAtt = (id,s) => VW_HR.markAtt(id,s);
window.markAllPresent = () => VW_HR.markAllPresent();
window.showAddStaff = () => VW_HR.showAddStaff();
window.saveNewStaff = () => VW_HR.saveNewStaff();
window.openStaff = (id) => VW_HR.openStaff(id);
window.showApplyLeave = () => VW_HR.showApplyLeave();
window.submitLeave = () => VW_HR.submitLeave();
window.approveLeave = (id,s) => VW_HR.approveLeave(id,s);

document.addEventListener('DOMContentLoaded', async () => { await init(); buildSidebar(); });

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/vwholesale-app/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

// ===== MULTI-LANGUAGE SUPPORT =====
// Telugu and Hindi translations for key UI strings
const TRANSLATIONS = {
  en: {
    home: 'Home', checkin: 'Check-in', billing: 'Billing', tasks: 'Tasks', more: 'More',
    newInvoice: 'New Invoice', customers: 'Customers', inventory: 'Inventory',
    todayBilling: "Today's Billing", walkIns: "Today's Walk-ins",
    search: 'Search...', save: 'Save', cancel: 'Cancel', close: 'Close',
    submit: 'Submit for Approval', draft: 'Save Draft',
    welcome: 'Welcome back', goodMorning: 'Good Morning', goodEvening: 'Good Evening',
  },
  te: {
    home: 'హోమ్', checkin: 'చెక్-ఇన్', billing: 'బిల్లింగ్', tasks: 'టాస్క్‌లు', more: 'మరిన్ని',
    newInvoice: 'కొత్త ఇన్వాయిస్', customers: 'కస్టమర్లు', inventory: 'స్టాక్',
    todayBilling: 'ఈరోజు బిల్లింగ్', walkIns: 'ఈరోజు వచ్చినవారు',
    search: 'వెతకండి...', save: 'సేవ్ చేయి', cancel: 'రద్దు చేయి', close: 'మూసివేయి',
    submit: 'అనుమతికి పంపు', draft: 'డ్రాఫ్ట్ సేవ్',
    welcome: 'స్వాగతం', goodMorning: 'శుభోదయం', goodEvening: 'శుభ సాయంత్రం',
  },
  hi: {
    home: 'होम', checkin: 'चेक-इन', billing: 'बिलिंग', tasks: 'काम', more: 'और',
    newInvoice: 'नया इनवॉइस', customers: 'ग्राहक', inventory: 'स्टॉक',
    todayBilling: 'आज की बिलिंग', walkIns: 'आज के ग्राहक',
    search: 'खोजें...', save: 'सेव करें', cancel: 'रद्द करें', close: 'बंद करें',
    submit: 'अनुमोदन के लिए भेजें', draft: 'ड्राफ्ट सेव',
    welcome: 'वापस स्वागत है', goodMorning: 'शुभ प्रभात', goodEvening: 'शुभ संध्या',
  },
  bn: {
    home: 'হোম', checkin: 'চেক-ইন', billing: 'বিলিং', tasks: 'কাজ', more: 'আরও',
    newInvoice: 'নতুন ইনভয়েস', customers: 'গ্রাহক', inventory: 'স্টক',
    todayBilling: 'আজকের বিলিং', walkIns: 'আজকের ওয়াক-ইন',
    search: 'খুঁজুন...', save: 'সেভ করুন', cancel: 'বাতিল করুন', close: 'বন্ধ করুন',
    submit: 'অনুমোদনের জন্য পাঠান', draft: 'ড্রাফট সেভ',
    welcome: 'ফিরে স্বাগতম', goodMorning: 'শুভ সকাল', goodEvening: 'শুভ সন্ধ্যা',
  },
  or: {
    home: 'ହୋମ', checkin: 'ଚେକ-ଇନ', billing: 'ବିଲିଂ', tasks: 'କାମ', more: 'ଆଉ',
    newInvoice: 'ନୂଆ ଇନ୍‌ଭଏସ', customers: 'ଗ୍ରାହକ', inventory: 'ଷ୍ଟକ',
    todayBilling: 'ଆଜିର ବିଲିଂ', walkIns: 'ଆଜିର ୱାକ-ଇନ',
    search: 'ଖୋଜନ୍ତୁ...', save: 'ସେଭ', cancel: 'ବାତିଲ', close: 'ବନ୍ଦ',
    submit: 'ଅନୁମୋଦନ ପଠାନ୍ତୁ', draft: 'ଡ୍ରାଫ୍ଟ ସେଭ',
    welcome: 'ସ୍ୱାଗତ', goodMorning: 'ଶୁଭ ସକାଳ', goodEvening: 'ଶୁଭ ସନ୍ଧ୍ୟା',
  },
};

let _currentLang = localStorage.getItem('vw_lang') || 'en';

function t(key) {
  return TRANSLATIONS[_currentLang]?.[key] || TRANSLATIONS.en[key] || key;
}

function setLanguage(lang) {
  _currentLang = lang;
  localStorage.setItem('vw_lang', lang);
  const labels = { home: 'Home', checkin: 'Check-in', cart: 'Billing', tasks: 'Tasks', more: 'More' };
  Object.entries(labels).forEach(([page, fallback]) => {
    const btn = document.querySelector(`.nav-btn[data-page="${page}"] .nav-label`);
    if (btn) btn.textContent = t(page==='cart'?'billing':page) || fallback;
  });
  const langNames = {en:'English',te:'Telugu',hi:'Hindi',bn:'Bengali',or:'Odia'};
  showToast(`Language: ${langNames[lang]||lang}`, 'success');
  _initI18nObserver();
  // Re-render the current page so localized labels apply immediately (otherwise the
  // change is invisible and the button feels broken), then translate the chrome.
  try { if (typeof navigateTo==='function') navigateTo(window.currentPage || 'dashboard'); } catch(_) {}
  setTimeout(() => translatePageChrome(document.body), 80);
}

window.TRANSLATIONS = TRANSLATIONS;

// ===== POST-RENDER UI TRANSLATION (phrase layer) =====
// The screens are authored in English. Rather than wrap thousands of strings,
// we translate the rendered DOM in place: for the active non-English language,
// any text node / placeholder whose trimmed value EXACTLY matches a known UI
// phrase is swapped for its translation. Exact whole-string match only, so
// dynamic data (names, numbers, ₹ amounts) is never touched. Telugu + Hindi
// are filled; other languages fall back to English where a phrase is missing.
const PHRASE_I18N = {
  // Navigation & chrome
  'Home':{te:'హోమ్',hi:'होम'},'Check-in':{te:'చెక్-ఇన్',hi:'चेक-इन'},'Billing':{te:'బిల్లింగ్',hi:'बिलिंग'},
  'Tasks':{te:'టాస్క్‌లు',hi:'काम'},'More':{te:'మరిన్ని',hi:'और'},'Dashboard':{te:'డాష్‌బోర్డ్',hi:'डैशबोर्ड'},
  'Inventory':{te:'స్టాక్',hi:'स्टॉक'},'Customers':{te:'కస్టమర్లు',hi:'ग्राहक'},'Quotations':{te:'కొటేషన్లు',hi:'कोटेशन'},
  'Settings':{te:'సెట్టింగ్‌లు',hi:'सेटिंग्स'},'Reports':{te:'రిపోర్టులు',hi:'रिपोर्ट'},'Analytics':{te:'విశ్లేషణ',hi:'विश्लेषण'},
  'Vendors':{te:'వెండర్లు',hi:'विक्रेता'},'Dispatch':{te:'డిస్పాచ్',hi:'डिस्पैच'},'Catalogs':{te:'క్యాటలాగ్‌లు',hi:'कैटलॉग'},
  'Returns':{te:'రిటర్న్‌లు',hi:'वापसी'},'Notifications':{te:'నోటిఫికేషన్లు',hi:'सूचनाएं'},'Purchase':{te:'కొనుగోలు',hi:'खरीद'},
  // Common actions
  'Save':{te:'సేవ్ చేయి',hi:'सेव करें'},'Cancel':{te:'రద్దు చేయి',hi:'रद्द करें'},'Close':{te:'మూసివేయి',hi:'बंद करें'},
  'Delete':{te:'తొలగించు',hi:'हटाएं'},'Edit':{te:'మార్చు',hi:'बदलें'},'Submit':{te:'సమర్పించు',hi:'जमा करें'},
  'Confirm':{te:'నిర్ధారించు',hi:'पुष्टि करें'},'Approve':{te:'ఆమోదించు',hi:'मंजूर करें'},'Reject':{te:'తిరస్కరించు',hi:'अस्वीकार करें'},
  'Print':{te:'ప్రింట్',hi:'प्रिंट'},'Share':{te:'షేర్ చేయి',hi:'शेयर करें'},'Send':{te:'పంపు',hi:'भेजें'},
  'Back':{te:'వెనుకకు',hi:'वापस'},'Next':{te:'తదుపరి',hi:'अगला'},'Done':{te:'పూర్తయింది',hi:'पूर्ण'},
  'Update':{te:'అప్‌డేట్',hi:'अपडेट'},'Continue':{te:'కొనసాగించు',hi:'जारी रखें'},'Try Again':{te:'మళ్లీ ప్రయత్నించు',hi:'पुनः प्रयास करें'},
  'Save Changes':{te:'మార్పులు సేవ్ చేయి',hi:'बदलाव सेव करें'},'Add Item':{te:'ఐటెమ్ జోడించు',hi:'आइटम जोड़ें'},
  'Add Product':{te:'ప్రొడక్ట్ జోడించు',hi:'उत्पाद जोड़ें'},'Add New Product':{te:'కొత్త ప్రొడక్ట్ జోడించు',hi:'नया उत्पाद जोड़ें'},
  'Add Customer':{te:'కస్టమర్ జోడించు',hi:'ग्राहक जोड़ें'},'Add Vendor':{te:'వెండర్ జోడించు',hi:'विक्रेता जोड़ें'},
  'New Quotation':{te:'కొత్త కొటేషన్',hi:'नया कोटेशन'},'New Invoice':{te:'కొత్త ఇన్వాయిస్',hi:'नया इनवॉइस'},
  'Restock':{te:'రీస్టాక్',hi:'रीस्टॉक'},'Raise PO':{te:'PO సృష్టించు',hi:'PO बनाएं'},'Skip for now':{te:'ప్రస్తుతానికి దాటవేయి',hi:'अभी छोड़ें'},
  // Statuses
  'Pending':{te:'పెండింగ్',hi:'लंबित'},'Approved':{te:'ఆమోదించబడింది',hi:'मंजूर'},'Rejected':{te:'తిరస్కరించబడింది',hi:'अस्वीकृत'},
  'Draft':{te:'డ్రాఫ్ట్',hi:'ड्राफ्ट'},'Paid':{te:'చెల్లించబడింది',hi:'भुगतान हुआ'},'Sent':{te:'పంపబడింది',hi:'भेजा गया'},
  'Pending Approval':{te:'ఆమోదం పెండింగ్',hi:'मंजूरी लंबित'},'Low Stock':{te:'తక్కువ స్టాక్',hi:'कम स्टॉक'},
  'In Stock':{te:'స్టాక్‌లో ఉంది',hi:'स्टॉक में'},'Out of Stock':{te:'స్టాక్ లేదు',hi:'स्टॉक खत्म'},
  'Active':{te:'యాక్టివ్',hi:'सक्रिय'},'Completed':{te:'పూర్తయింది',hi:'पूर्ण'},'Cancelled':{te:'రద్దు చేయబడింది',hi:'रद्द'},
  // Common labels
  'Name':{te:'పేరు',hi:'नाम'},'Phone':{te:'ఫోన్',hi:'फोन'},'Address':{te:'చిరునామా',hi:'पता'},'Amount':{te:'మొత్తం',hi:'राशि'},
  'Quantity':{te:'పరిమాణం',hi:'मात्रा'},'Price':{te:'ధర',hi:'मूल्य'},'Rate':{te:'రేటు',hi:'दर'},'Total':{te:'మొత్తం',hi:'कुल'},
  'Grand Total':{te:'మొత్తం కూడిక',hi:'कुल योग'},'Subtotal':{te:'సబ్‌టోటల్',hi:'उप-योग'},'Discount':{te:'తగ్గింపు',hi:'छूट'},
  'Date':{te:'తేదీ',hi:'तारीख'},'Notes':{te:'గమనికలు',hi:'टिप्पणी'},'Category':{te:'వర్గం',hi:'श्रेणी'},
  'Sub-Category':{te:'ఉప-వర్గం',hi:'उप-श्रेणी'},'Brand':{te:'బ్రాండ్',hi:'ब्रांड'},'Model':{te:'మోడల్',hi:'मॉडल'},
  'Stock':{te:'స్టాక్',hi:'स्टॉक'},'Customer':{te:'కస్టమర్',hi:'ग्राहक'},'Vendor':{te:'వెండర్',hi:'विक्रेता'},
  'Supplier':{te:'సప్లయర్',hi:'आपूर्तिकर्ता'},'Unit':{te:'యూనిట్',hi:'इकाई'},'Status':{te:'స్థితి',hi:'स्थिति'},
  'Category *':{te:'వర్గం *',hi:'श्रेणी *'},'Product Name *':{te:'ప్రొడక్ట్ పేరు *',hi:'उत्पाद नाम *'},
  'Opening Stock *':{te:'ప్రారంభ స్టాక్ *',hi:'प्रारंभिक स्टॉक *'},'Qty at this location':{te:'ఈ లొకేషన్‌లో పరిమాణం',hi:'इस स्थान पर मात्रा'},
  'Today':{te:'ఈరోజు',hi:'आज'},'This Week':{te:'ఈ వారం',hi:'इस सप्ताह'},'This Month':{te:'ఈ నెల',hi:'इस महीने'},
  // Dashboard
  'Welcome back':{te:'తిరిగి స్వాగతం',hi:'वापसी पर स्वागत है'},'Good Morning':{te:'శుభోదయం',hi:'शुभ प्रभात'},
  'Good Evening':{te:'శుభ సాయంత్రం',hi:'शुभ संध्या'},"Today's Billing":{te:'ఈరోజు బిల్లింగ్',hi:'आज की बिलिंग'},
  "Today's Walk-ins":{te:'ఈరోజు వచ్చినవారు',hi:'आज के ग्राहक'},'Quick Actions':{te:'త్వరిత చర్యలు',hi:'त्वरित क्रियाएं'},
  'Pending Approvals':{te:'ఆమోదం పెండింగ్‌లు',hi:'लंबित मंजूरी'},
  // Billing / cart
  'New Bill':{te:'కొత్త బిల్లు',hi:'नया बिल'},'Cart':{te:'కార్ట్',hi:'कार्ट'},'Checkout':{te:'చెకౌట్',hi:'चेकआउट'},
  'Payment':{te:'చెల్లింపు',hi:'भुगतान'},'Cash':{te:'నగదు',hi:'नकद'},'Credit':{te:'క్రెడిట్',hi:'उधार'},
  'Balance':{te:'బ్యాలెన్స్',hi:'शेष'},'Balance Due':{te:'చెల్లించవలసిన బ్యాలెన్స్',hi:'बकाया शेष'},'Bill':{te:'బిల్లు',hi:'बिल'},
  'Invoice':{te:'ఇన్వాయిస్',hi:'इनवॉइस'},'Walk-in':{te:'వాక్-ఇన్',hi:'वॉक-इन'},'Remove':{te:'తీసివేయి',hi:'हटाएं'},
  'Customer Name':{te:'కస్టమర్ పేరు',hi:'ग्राहक का नाम'},'Customer Name *':{te:'కస్టమర్ పేరు *',hi:'ग्राहक का नाम *'},
  'Add to Cart':{te:'కార్ట్‌కు జోడించు',hi:'कार्ट में जोड़ें'},'Amount Received':{te:'అందిన మొత్తం',hi:'प्राप्त राशि'},
  // Inventory / product form
  'Barcode / QR Code':{te:'బార్‌కోడ్ / QR కోడ్',hi:'बारकोड / QR कोड'},'Cost Price':{te:'ఖరీదు ధర',hi:'लागत मूल्य'},
  'Selling Price':{te:'అమ్మకం ధర',hi:'विक्रय मूल्य'},'Pricing Mode *':{te:'ధర విధానం *',hi:'मूल्य विधि *'},
  'Low Stock Alert Threshold':{te:'తక్కువ స్టాక్ హెచ్చరిక పరిమితి',hi:'कम स्टॉक चेतावनी सीमा'},
  'Warehouse Location':{te:'గిడ్డంగి స్థానం',hi:'गोदाम स्थान'},'Zone':{te:'జోన్',hi:'क्षेत्र'},'Rack No':{te:'రాక్ నం',hi:'रैक नं'},
  'Shelf No':{te:'షెల్ఫ్ నం',hi:'शेल्फ नं'},'Stock Added':{te:'స్టాక్ జోడించబడింది',hi:'स्टॉक जोड़ा गया'},
  'Quantity to Add *':{te:'జోడించవలసిన పరిమాణం *',hi:'जोड़ने की मात्रा *'},'Supplier Name *':{te:'సప్లయర్ పేరు *',hi:'आपूर्तिकर्ता का नाम *'},
  'Confirm Restock':{te:'రీస్టాక్ నిర్ధారించు',hi:'रीस्टॉक पुष्टि करें'},'Current stock':{te:'ప్రస్తుత స్టాక్',hi:'वर्तमान स्टॉक'},
  '+ New':{te:'+ కొత్తది',hi:'+ नया'},'+ Add Photo':{te:'+ ఫోటో జోడించు',hi:'+ फोटो जोड़ें'},
  // Quotations
  'Create Quotation':{te:'కొటేషన్ సృష్టించు',hi:'कोटेशन बनाएं'},'Items':{te:'ఐటెమ్‌లు',hi:'आइटम'},'Terms':{te:'నిబంధనలు',hi:'शर्तें'},
  'Site Name':{te:'సైట్ పేరు',hi:'साइट का नाम'},'Take Photo of List':{te:'జాబితా ఫోటో తీయండి',hi:'सूची की फोटो लें'},
  'Upload Document/Photo':{te:'డాక్యుమెంట్/ఫోటో అప్‌లోడ్',hi:'दस्तावेज़/फोटो अपलोड करें'},'Create Manually':{te:'మాన్యువల్‌గా సృష్టించు',hi:'मैन्युअल बनाएं'},
  'Edit & Approve':{te:'మార్చి ఆమోదించు',hi:'बदलें और मंजूर करें'},'Bill This Quotation':{te:'ఈ కొటేషన్ బిల్ చేయి',hi:'इस कोटेशन का बिल बनाएं'},
  // Generic
  'Yes':{te:'అవును',hi:'हां'},'No':{te:'కాదు',hi:'नहीं'},'All':{te:'అన్నీ',hi:'सभी'},'None':{te:'ఏదీ లేదు',hi:'कोई नहीं'},
  'Optional':{te:'ఐచ్ఛికం',hi:'वैकल्पिक'},'Loading...':{te:'లోడ్ అవుతోంది...',hi:'लोड हो रहा है...'},
  'Filter':{te:'ఫిల్టర్',hi:'फ़िल्टर'},'View':{te:'చూడు',hi:'देखें'},'Details':{te:'వివరాలు',hi:'विवरण'},
  'Profile':{te:'ప్రొఫైల్',hi:'प्रोफ़ाइल'},'Logout':{te:'లాగౌట్',hi:'लॉगआउट'},'Language':{te:'భాష',hi:'भाषा'},
  'Approve & Update Stock':{te:'ఆమోదించి స్టాక్ అప్‌డేట్',hi:'मंजूर करें और स्टॉक अपडेट करें'},
  'Warranty':{te:'వారంటీ',hi:'वारंटी'},
  // CRM
  'Add Lead':{te:'లీడ్ జోడించు',hi:'लीड जोड़ें'},'Leads':{te:'లీడ్‌లు',hi:'लीड'},'Follow-up':{te:'ఫాలో-అప్',hi:'फॉलो-अप'},
  'Follow-ups':{te:'ఫాలో-అప్‌లు',hi:'फॉलो-अप'},'New Customer':{te:'కొత్త కస్టమర్',hi:'नया ग्राहक'},'Visit':{te:'సందర్శన',hi:'विज़िट'},
  'Visits':{te:'సందర్శనలు',hi:'विज़िट'},'Won':{te:'గెలిచింది',hi:'जीता'},'Lost':{te:'కోల్పోయింది',hi:'खोया'},
  'Contact':{te:'సంప్రదించండి',hi:'संपर्क'},'Call':{te:'కాల్ చేయి',hi:'कॉल करें'},'WhatsApp':{te:'వాట్సాప్',hi:'व्हाट्सएप'},
  // HR / attendance
  'Attendance':{te:'హాజరు',hi:'उपस्थिति'},'Present':{te:'హాజరు',hi:'उपस्थित'},'Absent':{te:'గైర్హాజరు',hi:'अनुपस्थित'},
  'Leave':{te:'సెలవు',hi:'छुट्टी'},'Leaves':{te:'సెలవులు',hi:'छुट्टियां'},'Apply Leave':{te:'సెలవు దరఖాస్తు',hi:'छुट्टी आवेदन'},
  'Payroll':{te:'పేరోల్',hi:'पेरोल'},'Salary':{te:'జీతం',hi:'वेतन'},'Staff':{te:'సిబ్బంది',hi:'स्टाफ'},
  'Check In':{te:'చెక్ ఇన్',hi:'चेक इन'},'Check Out':{te:'చెక్ అవుట్',hi:'चेक आउट'},'Half Day':{te:'అర్ధ రోజు',hi:'आधा दिन'},
  'Advance':{te:'అడ్వాన్స్',hi:'अग्रिम'},'Bonus':{te:'బోనస్',hi:'बोनस'},'Deduction':{te:'మినహాయింపు',hi:'कटौती'},
  // Accounts / dispatch
  'Accounts':{te:'ఖాతాలు',hi:'खाते'},'Verify Payment':{te:'చెల్లింపు ధృవీకరించు',hi:'भुगतान सत्यापित करें'},
  'Payment Verified':{te:'చెల్లింపు ధృవీకరించబడింది',hi:'भुगतान सत्यापित'},'Outstanding':{te:'బకాయి',hi:'बकाया'},
  'Confirm Dispatch':{te:'డిస్పాచ్ నిర్ధారించు',hi:'डिस्पैच पुष्टि करें'},'Gate Pass':{te:'గేట్ పాస్',hi:'गेट पास'},
  'Out for delivery':{te:'డెలివరీకి బయలుదేరింది',hi:'डिलीवरी के लिए निकला'},'Delivered':{te:'డెలివరీ అయింది',hi:'पहुंचा दिया'},
  'Self Pickup':{te:'స్వయంగా తీసుకోవడం',hi:'स्वयं पिकअप'},
  // Common messages
  'Saved':{te:'సేవ్ అయింది',hi:'सेव हो गया'},'Saved successfully':{te:'విజయవంతంగా సేవ్ అయింది',hi:'सफलतापूर्वक सेव हुआ'},
  'Updated':{te:'అప్‌డేట్ అయింది',hi:'अपडेट हो गया'},'Deleted':{te:'తొలగించబడింది',hi:'हटा दिया गया'},
  'No results':{te:'ఫలితాలు లేవు',hi:'कोई परिणाम नहीं'},'No items yet':{te:'ఇంకా ఐటెమ్‌లు లేవు',hi:'अभी कोई आइटम नहीं'},
  'Required':{te:'తప్పనిసరి',hi:'आवश्यक'},'Search':{te:'వెతుకు',hi:'खोजें'}
};

// Bengali (bn) + Odia (or) for every phrase above, merged in so the te/hi map
// stays readable. `const` blocks reassignment, not mutation of nested entries.
const _PHRASE_BN_OR = {
  'Home':{bn:'হোম',or:'ହୋମ'},'Check-in':{bn:'চেক-ইন',or:'ଚେକ୍-ଇନ୍'},'Billing':{bn:'বিলিং',or:'ବିଲିଂ'},
  'Tasks':{bn:'কাজ',or:'କାମ'},'More':{bn:'আরও',or:'ଅଧିକ'},'Dashboard':{bn:'ড্যাশবোর্ড',or:'ଡ୍ୟାସବୋର୍ଡ'},
  'Inventory':{bn:'স্টক',or:'ଷ୍ଟକ୍'},'Customers':{bn:'গ্রাহক',or:'ଗ୍ରାହକ'},'Quotations':{bn:'কোটেশন',or:'କୋଟେସନ୍'},
  'Settings':{bn:'সেটিংস',or:'ସେଟିଂସ୍'},'Reports':{bn:'রিপোর্ট',or:'ରିପୋର୍ଟ'},'Analytics':{bn:'বিশ্লেষণ',or:'ବିଶ୍ଳେଷଣ'},
  'Vendors':{bn:'বিক্রেতা',or:'ବିକ୍ରେତା'},'Dispatch':{bn:'ডিসপ্যাচ',or:'ଡିସପ୍ୟାଚ୍'},'Catalogs':{bn:'ক্যাটালগ',or:'କ୍ୟାଟାଲଗ୍'},
  'Returns':{bn:'ফেরত',or:'ଫେରସ୍ତ'},'Notifications':{bn:'বিজ্ঞপ্তি',or:'ବିଜ୍ଞପ୍ତି'},'Purchase':{bn:'ক্রয়',or:'କ୍ରୟ'},
  'Save':{bn:'সেভ করুন',or:'ସେଭ୍ କରନ୍ତୁ'},'Cancel':{bn:'বাতিল',or:'ବାତିଲ୍'},'Close':{bn:'বন্ধ করুন',or:'ବନ୍ଦ କରନ୍ତୁ'},
  'Delete':{bn:'মুছুন',or:'ବିଲୋପ କରନ୍ତୁ'},'Edit':{bn:'সম্পাদনা',or:'ସମ୍ପାଦନା'},'Submit':{bn:'জমা দিন',or:'ଦାଖଲ କରନ୍ତୁ'},
  'Confirm':{bn:'নিশ্চিত করুন',or:'ନିଶ୍ଚିତ କରନ୍ତୁ'},'Approve':{bn:'অনুমোদন',or:'ଅନୁମୋଦନ'},'Reject':{bn:'প্রত্যাখ্যান',or:'ପ୍ରତ୍ୟାଖ୍ୟାନ'},
  'Print':{bn:'প্রিন্ট',or:'ପ୍ରିଣ୍ଟ'},'Share':{bn:'শেয়ার',or:'ସେୟାର'},'Send':{bn:'পাঠান',or:'ପଠାନ୍ତୁ'},
  'Back':{bn:'পিছনে',or:'ପଛକୁ'},'Next':{bn:'পরবর্তী',or:'ପରବର୍ତ୍ତୀ'},'Done':{bn:'সম্পন্ন',or:'ସମ୍ପୂର୍ଣ୍ଣ'},
  'Update':{bn:'আপডেট',or:'ଅପଡେଟ୍'},'Continue':{bn:'চালিয়ে যান',or:'ଜାରି ରଖନ୍ତୁ'},'Try Again':{bn:'আবার চেষ্টা করুন',or:'ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ'},
  'Save Changes':{bn:'পরিবর্তন সেভ করুন',or:'ପରିବର୍ତ୍ତନ ସେଭ୍ କରନ୍ତୁ'},'Add Item':{bn:'আইটেম যোগ করুন',or:'ଆଇଟମ୍ ଯୋଗ କରନ୍ତୁ'},
  'Add Product':{bn:'পণ্য যোগ করুন',or:'ଉତ୍ପାଦ ଯୋଗ କରନ୍ତୁ'},'Add New Product':{bn:'নতুন পণ্য যোগ করুন',or:'ନୂଆ ଉତ୍ପାଦ ଯୋଗ କରନ୍ତୁ'},
  'Add Customer':{bn:'গ্রাহক যোগ করুন',or:'ଗ୍ରାହକ ଯୋଗ କରନ୍ତୁ'},'Add Vendor':{bn:'বিক্রেতা যোগ করুন',or:'ବିକ୍ରେତା ଯୋଗ କରନ୍ତୁ'},
  'New Quotation':{bn:'নতুন কোটেশন',or:'ନୂଆ କୋଟେସନ୍'},'New Invoice':{bn:'নতুন ইনভয়েস',or:'ନୂଆ ଇନଭଏସ୍'},
  'Restock':{bn:'রিস্টক',or:'ରିଷ୍ଟକ୍'},'Raise PO':{bn:'PO তৈরি করুন',or:'PO ତିଆରି କରନ୍ତୁ'},'Skip for now':{bn:'আপাতত এড়িয়ে যান',or:'ବର୍ତ୍ତମାନ ଛାଡ଼ନ୍ତୁ'},
  'Pending':{bn:'মুলতুবি',or:'ବିଚାରାଧୀନ'},'Approved':{bn:'অনুমোদিত',or:'ଅନୁମୋଦିତ'},'Rejected':{bn:'প্রত্যাখ্যাত',or:'ପ୍ରତ୍ୟାଖ୍ୟାତ'},
  'Draft':{bn:'খসড়া',or:'ଡ୍ରାଫ୍ଟ'},'Paid':{bn:'পরিশোধিত',or:'ପରିଶୋଧିତ'},'Sent':{bn:'পাঠানো হয়েছে',or:'ପଠାଯାଇଛି'},
  'Pending Approval':{bn:'অনুমোদন মুলতুবি',or:'ଅନୁମୋଦନ ବିଚାରାଧୀନ'},'Low Stock':{bn:'কম স্টক',or:'କମ୍ ଷ୍ଟକ୍'},
  'In Stock':{bn:'স্টকে আছে',or:'ଷ୍ଟକ୍‌ରେ ଅଛି'},'Out of Stock':{bn:'স্টক শেষ',or:'ଷ୍ଟକ୍ ସରିଛି'},
  'Active':{bn:'সক্রিয়',or:'ସକ୍ରିୟ'},'Completed':{bn:'সম্পন্ন',or:'ସମ୍ପୂର୍ଣ୍ଣ'},'Cancelled':{bn:'বাতিল',or:'ବାତିଲ୍'},
  'Name':{bn:'নাম',or:'ନାମ'},'Phone':{bn:'ফোন',or:'ଫୋନ୍'},'Address':{bn:'ঠিকানা',or:'ଠିକଣା'},'Amount':{bn:'পরিমাণ',or:'ରାଶି'},
  'Quantity':{bn:'পরিমাণ',or:'ପରିମାଣ'},'Price':{bn:'দাম',or:'ମୂଲ୍ୟ'},'Rate':{bn:'রেট',or:'ଦର'},'Total':{bn:'মোট',or:'ମୋଟ'},
  'Grand Total':{bn:'সর্বমোট',or:'ସର୍ବମୋଟ'},'Subtotal':{bn:'উপমোট',or:'ଉପ-ମୋଟ'},'Discount':{bn:'ছাড়',or:'ରିହାତି'},
  'Date':{bn:'তারিখ',or:'ତାରିଖ'},'Notes':{bn:'নোট',or:'ଟିପ୍ପଣୀ'},'Category':{bn:'বিভাগ',or:'ବର୍ଗ'},
  'Sub-Category':{bn:'উপ-বিভাগ',or:'ଉପ-ବର୍ଗ'},'Brand':{bn:'ব্র্যান্ড',or:'ବ୍ରାଣ୍ଡ'},'Model':{bn:'মডেল',or:'ମଡେଲ୍'},
  'Stock':{bn:'স্টক',or:'ଷ୍ଟକ୍'},'Customer':{bn:'গ্রাহক',or:'ଗ୍ରାହକ'},'Vendor':{bn:'বিক্রেতা',or:'ବିକ୍ରେତା'},
  'Supplier':{bn:'সরবরাহকারী',or:'ଯୋଗାଣକାରୀ'},'Unit':{bn:'একক',or:'ୟୁନିଟ୍'},'Status':{bn:'অবস্থা',or:'ସ୍ଥିତି'},
  'Category *':{bn:'বিভাগ *',or:'ବର୍ଗ *'},'Product Name *':{bn:'পণ্যের নাম *',or:'ଉତ୍ପାଦ ନାମ *'},
  'Opening Stock *':{bn:'প্রারম্ভিক স্টক *',or:'ପ୍ରାରମ୍ଭିକ ଷ୍ଟକ୍ *'},'Qty at this location':{bn:'এই স্থানে পরিমাণ',or:'ଏହି ସ୍ଥାନରେ ପରିମାଣ'},
  'Today':{bn:'আজ',or:'ଆଜି'},'This Week':{bn:'এই সপ্তাহ',or:'ଏହି ସପ୍ତାହ'},'This Month':{bn:'এই মাস',or:'ଏହି ମାସ'},
  'Welcome back':{bn:'আবার স্বাগতম',or:'ପୁଣି ସ୍ୱାଗତ'},'Good Morning':{bn:'শুভ সকাল',or:'ଶୁଭ ସକାଳ'},
  'Good Evening':{bn:'শুভ সন্ধ্যা',or:'ଶୁଭ ସନ୍ଧ୍ୟା'},'Quick Actions':{bn:'দ্রুত কাজ',or:'ଶୀଘ୍ର କାର୍ଯ୍ୟ'},
  'Pending Approvals':{bn:'মুলতুবি অনুমোদন',or:'ବିଚାରାଧୀନ ଅନୁମୋଦନ'},
  'New Bill':{bn:'নতুন বিল',or:'ନୂଆ ବିଲ୍'},'Cart':{bn:'কার্ট',or:'କାର୍ଟ'},'Checkout':{bn:'চেকআউট',or:'ଚେକଆଉଟ୍'},
  'Payment':{bn:'পেমেন্ট',or:'ଦେୟ'},'Cash':{bn:'নগদ',or:'ନଗଦ'},'Credit':{bn:'ধার',or:'ଉଧାର'},
  'Balance':{bn:'ব্যালেন্স',or:'ବାକି'},'Balance Due':{bn:'বকেয়া ব্যালেন্স',or:'ବକେୟା ରାଶି'},'Bill':{bn:'বিল',or:'ବିଲ୍'},
  'Invoice':{bn:'ইনভয়েস',or:'ଇନଭଏସ୍'},'Walk-in':{bn:'ওয়াক-ইন',or:'ୱାକ୍-ଇନ୍'},'Remove':{bn:'সরান',or:'ହଟାନ୍ତୁ'},
  'Customer Name':{bn:'গ্রাহকের নাম',or:'ଗ୍ରାହକ ନାମ'},'Customer Name *':{bn:'গ্রাহকের নাম *',or:'ଗ୍ରାହକ ନାମ *'},
  'Add to Cart':{bn:'কার্টে যোগ করুন',or:'କାର୍ଟରେ ଯୋଗ କରନ୍ତୁ'},'Amount Received':{bn:'প্রাপ্ত পরিমাণ',or:'ପ୍ରାପ୍ତ ରାଶି'},
  'Barcode / QR Code':{bn:'বারকোড / QR কোড',or:'ବାରକୋଡ୍ / QR କୋଡ୍'},'Cost Price':{bn:'ক্রয়মূল্য',or:'କ୍ରୟ ମୂଲ୍ୟ'},
  'Selling Price':{bn:'বিক্রয়মূল্য',or:'ବିକ୍ରୟ ମୂଲ୍ୟ'},'Pricing Mode *':{bn:'মূল্য পদ্ধতি *',or:'ମୂଲ୍ୟ ପଦ୍ଧତି *'},
  'Low Stock Alert Threshold':{bn:'কম স্টক সতর্কতা সীমা',or:'କମ୍ ଷ୍ଟକ୍ ସତର୍କତା ସୀମା'},'Warehouse Location':{bn:'গুদাম অবস্থান',or:'ଗୋଦାମ ସ୍ଥାନ'},
  'Zone':{bn:'জোন',or:'ଜୋନ୍'},'Rack No':{bn:'র‍্যাক নং',or:'ରାକ୍ ନଂ'},'Shelf No':{bn:'শেলফ নং',or:'ସେଲଫ୍ ନଂ'},
  'Stock Added':{bn:'স্টক যোগ হয়েছে',or:'ଷ୍ଟକ୍ ଯୋଗ ହେଲା'},'Quantity to Add *':{bn:'যোগ করার পরিমাণ *',or:'ଯୋଗ କରିବା ପରିମାଣ *'},
  'Supplier Name *':{bn:'সরবরাহকারীর নাম *',or:'ଯୋଗାଣକାରୀ ନାମ *'},'Confirm Restock':{bn:'রিস্টক নিশ্চিত করুন',or:'ରିଷ୍ଟକ୍ ନିଶ୍ଚିତ କରନ୍ତୁ'},
  'Current stock':{bn:'বর্তমান স্টক',or:'ବର୍ତ୍ତମାନ ଷ୍ଟକ୍'},'+ New':{bn:'+ নতুন',or:'+ ନୂଆ'},'+ Add Photo':{bn:'+ ফটো যোগ করুন',or:'+ ଫଟୋ ଯୋଗ କରନ୍ତୁ'},
  'Create Quotation':{bn:'কোটেশন তৈরি করুন',or:'କୋଟେସନ୍ ତିଆରି କରନ୍ତୁ'},'Items':{bn:'আইটেম',or:'ଆଇଟମ୍'},'Terms':{bn:'শর্তাবলী',or:'ସର୍ତ୍ତାବଳୀ'},
  'Site Name':{bn:'সাইটের নাম',or:'ସାଇଟ୍ ନାମ'},'Take Photo of List':{bn:'তালিকার ফটো তুলুন',or:'ତାଲିକାର ଫଟୋ ନିଅନ୍ତୁ'},
  'Upload Document/Photo':{bn:'ডকুমেন্ট/ফটো আপলোড করুন',or:'ଡକ୍ୟୁମେଣ୍ଟ/ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ'},'Create Manually':{bn:'ম্যানুয়ালি তৈরি করুন',or:'ମାନୁଆଲ୍ ଭାବେ ତିଆରି କରନ୍ତୁ'},
  'Edit & Approve':{bn:'সম্পাদনা ও অনুমোদন',or:'ସମ୍ପାଦନା ଓ ଅନୁମୋଦନ'},'Bill This Quotation':{bn:'এই কোটেশনের বিল করুন',or:'ଏହି କୋଟେସନ୍ ବିଲ୍ କରନ୍ତୁ'},
  'Yes':{bn:'হ্যাঁ',or:'ହଁ'},'No':{bn:'না',or:'ନା'},'All':{bn:'সব',or:'ସବୁ'},'None':{bn:'কোনোটি নয়',or:'କିଛି ନାହିଁ'},
  'Optional':{bn:'ঐচ্ছিক',or:'ବୈକଳ୍ପିକ'},'Loading...':{bn:'লোড হচ্ছে...',or:'ଲୋଡ୍ ହେଉଛି...'},
  'Filter':{bn:'ফিল্টার',or:'ଫିଲ୍ଟର'},'View':{bn:'দেখুন',or:'ଦେଖନ୍ତୁ'},'Details':{bn:'বিস্তারিত',or:'ବିବରଣୀ'},
  'Profile':{bn:'প্রোফাইল',or:'ପ୍ରୋଫାଇଲ୍'},'Logout':{bn:'লগআউট',or:'ଲଗଆଉଟ୍'},'Language':{bn:'ভাষা',or:'ଭାଷା'},
  'Approve & Update Stock':{bn:'অনুমোদন ও স্টক আপডেট',or:'ଅନୁମୋଦନ ଓ ଷ୍ଟକ୍ ଅପଡେଟ୍'},'Warranty':{bn:'ওয়ারেন্টি',or:'ୱାରେଣ୍ଟି'},
  'Add Lead':{bn:'লিড যোগ করুন',or:'ଲିଡ୍ ଯୋଗ କରନ୍ତୁ'},'Leads':{bn:'লিড',or:'ଲିଡ୍'},'Follow-up':{bn:'ফলো-আপ',or:'ଫଲୋ-ଅପ୍'},
  'Follow-ups':{bn:'ফলো-আপ',or:'ଫଲୋ-ଅପ୍'},'New Customer':{bn:'নতুন গ্রাহক',or:'ନୂଆ ଗ୍ରାହକ'},'Visit':{bn:'ভিজিট',or:'ପରିଦର୍ଶନ'},
  'Visits':{bn:'ভিজিট',or:'ପରିଦର୍ଶନ'},'Won':{bn:'জিতেছে',or:'ଜିତିଲା'},'Lost':{bn:'হেরেছে',or:'ହାରିଲା'},
  'Contact':{bn:'যোগাযোগ',or:'ଯୋଗାଯୋଗ'},'Call':{bn:'কল করুন',or:'କଲ୍ କରନ୍ତୁ'},'WhatsApp':{bn:'হোয়াটসঅ্যাপ',or:'ହ୍ୱାଟସ୍ଆପ୍'},
  'Attendance':{bn:'উপস্থিতি',or:'ଉପସ୍ଥିତି'},'Present':{bn:'উপস্থিত',or:'ଉପସ୍ଥିତ'},'Absent':{bn:'অনুপস্থিত',or:'ଅନୁପସ୍ଥିତ'},
  'Leave':{bn:'ছুটি',or:'ଛୁଟି'},'Leaves':{bn:'ছুটি',or:'ଛୁଟି'},'Apply Leave':{bn:'ছুটির আবেদন',or:'ଛୁଟି ଆବେଦନ'},
  'Payroll':{bn:'পেরোল',or:'ପେରୋଲ୍'},'Salary':{bn:'বেতন',or:'ଦରମା'},'Staff':{bn:'কর্মী',or:'କର୍ମଚାରୀ'},
  'Check In':{bn:'চেক ইন',or:'ଚେକ୍ ଇନ୍'},'Check Out':{bn:'চেক আউট',or:'ଚେକ୍ ଆଉଟ୍'},'Half Day':{bn:'অর্ধ দিবস',or:'ଅଧା ଦିନ'},
  'Advance':{bn:'অগ্রিম',or:'ଅଗ୍ରୀମ'},'Bonus':{bn:'বোনাস',or:'ବୋନସ୍'},'Deduction':{bn:'কর্তন',or:'କଟତି'},
  'Accounts':{bn:'হিসাব',or:'ଆକାଉଣ୍ଟ'},'Verify Payment':{bn:'পেমেন্ট যাচাই করুন',or:'ଦେୟ ଯାଞ୍ଚ କରନ୍ତୁ'},
  'Payment Verified':{bn:'পেমেন্ট যাচাই হয়েছে',or:'ଦେୟ ଯାଞ୍ଚ ହେଲା'},'Outstanding':{bn:'বকেয়া',or:'ବକେୟା'},
  'Confirm Dispatch':{bn:'ডিসপ্যাচ নিশ্চিত করুন',or:'ଡିସପ୍ୟାଚ୍ ନିଶ୍ଚିତ କରନ୍ତୁ'},'Gate Pass':{bn:'গেট পাস',or:'ଗେଟ୍ ପାସ୍'},
  'Out for delivery':{bn:'ডেলিভারির জন্য রওনা',or:'ଡେଲିଭରୀ ପାଇଁ ବାହାରିଲା'},'Delivered':{bn:'ডেলিভারি হয়েছে',or:'ପହଞ୍ଚାଇ ଦିଆଗଲା'},
  'Self Pickup':{bn:'নিজে সংগ্রহ',or:'ନିଜେ ନେବା'},
  'Saved':{bn:'সেভ হয়েছে',or:'ସେଭ୍ ହେଲା'},'Saved successfully':{bn:'সফলভাবে সেভ হয়েছে',or:'ସଫଳତାର ସହ ସେଭ୍ ହେଲା'},
  'Updated':{bn:'আপডেট হয়েছে',or:'ଅପଡେଟ୍ ହେଲା'},'Deleted':{bn:'মুছে ফেলা হয়েছে',or:'ବିଲୋପ ହେଲା'},
  'No results':{bn:'কোনো ফলাফল নেই',or:'କୌଣସି ଫଳାଫଳ ନାହିଁ'},'No items yet':{bn:'এখনও কোনো আইটেম নেই',or:'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଆଇଟମ୍ ନାହିଁ'},
  'Required':{bn:'আবশ্যক',or:'ଆବଶ୍ୟକ'},'Search':{bn:'অনুসন্ধান',or:'ଖୋଜନ୍ତୁ'},
  "Today's Billing":{bn:'আজকের বিলিং',or:'ଆଜିର ବିଲିଂ'},"Today's Walk-ins":{bn:'আজকের গ্রাহক',or:'ଆଜିର ଗ୍ରାହକ'}
};
Object.keys(_PHRASE_BN_OR).forEach(k => { if (PHRASE_I18N[k]) Object.assign(PHRASE_I18N[k], _PHRASE_BN_OR[k]); });

function _i18nLookup(text){
  if (_currentLang === 'en' || text == null) return null;
  const key = String(text).trim();
  if (!key) return null;
  const entry = PHRASE_I18N[key];
  const val = entry && entry[_currentLang];
  if (!val) return null;
  return String(text).replace(key, val); // preserve surrounding whitespace
}

// Translate matching UI phrases inside a rendered subtree, in place.
function translatePageChrome(root){
  try {
    if (_currentLang === 'en') return;
    root = root || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const p = node.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.nodeName;
        if (tag==='SCRIPT'||tag==='STYLE'||tag==='TEXTAREA'||tag==='OPTION') return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes){ const tr = _i18nLookup(node.nodeValue); if (tr != null && tr !== node.nodeValue) node.nodeValue = tr; }
    root.querySelectorAll && root.querySelectorAll('[placeholder]').forEach(el => { const tr = _i18nLookup(el.getAttribute('placeholder')); if (tr != null) el.setAttribute('placeholder', tr); });
  } catch(_) {}
}
window.translatePageChrome = translatePageChrome;

// Translate bottom-sheet forms as they open, without editing every sheet.
let _i18nObserverSet = false;
function _initI18nObserver(){
  if (_i18nObserverSet) return;
  const sheet = document.getElementById('bottom-sheet');
  if (!sheet || typeof MutationObserver === 'undefined') return;
  _i18nObserverSet = true;
  let _t = null;
  new MutationObserver(() => {
    if (_currentLang === 'en') return;
    clearTimeout(_t); _t = setTimeout(() => translatePageChrome(sheet), 30);
  }).observe(sheet, { childList:true, subtree:true });
}
window._initI18nObserver = _initI18nObserver;
window.t = t;
window.setLanguage = setLanguage;

// =====================================================
// USER JOURNEY / BEHAVIOUR TRACKING
// Records every page view, action, error per user
// =====================================================
const _trackSession = Math.random().toString(36).slice(2,10);
let _trackBuffer = [];
let _trackFlushTimer = null;

function trackEvent(type, page, action, details, errorMessage) {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return; // Don't track unauthenticated
  _trackBuffer.push({
    user_id: profile.id,
    user_name: profile.name,
    user_role: profile.role,
    event_type: type,
    page: page || window._currentPage || 'unknown',
    action: action || null,
    details: details || null,
    error_message: errorMessage || null,
    session_id: _trackSession,
    device_info: navigator.userAgent?.slice(0,100) || null,
    created_at: new Date().toISOString()
  });
  // Flush every 10 events or 30 seconds
  if (_trackBuffer.length >= 10) flushTrackingEvents();
  else {
    clearTimeout(_trackFlushTimer);
    _trackFlushTimer = setTimeout(flushTrackingEvents, 30000);
  }
}
window.trackEvent = trackEvent;

async function flushTrackingEvents() {
  if (!_trackBuffer.length) return;
  const events = [..._trackBuffer];
  _trackBuffer = [];
  try {
    await VW_DB.client.from('user_events').insert(events);
  } catch(e) { /* Silent fail — tracking should never break the app */ }
}

// Track page navigation
const _origNavigateTo = window.navigateTo;
window.navigateTo = function(page, params) {
  trackEvent('page_view', page, 'navigate', { from: window._currentPage });
  window._currentPage = page;
  return _origNavigateTo(page, params);
};

// Track JS errors globally
window.addEventListener('error', (e) => {
  trackEvent('error', window._currentPage, 'js_error', null, `${e.message} @ ${e.filename}:${e.lineno}`);
});

// Track unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  trackEvent('error', window._currentPage, 'promise_rejection', null, String(e.reason).slice(0,200));
});

// =====================================================
// CUSTOMER DATA PROTECTION
// Prevent staff from copying customer phone numbers
// to personal contacts / screenshots
// =====================================================

function initDataProtection() {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile || profile.role === 'admin') return; // Admin can see all

  // Override tel: links to go through app instead of native dialer
  // (prevents number being saved from call history)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="tel:"]');
    if (link) {
      // Allow call but don't let phone save the number
      // Track the call event
      trackEvent('action', window._currentPage, 'call_customer', { phone: 'masked' });
    }
  }, true);

  // Disable right-click and long-press on phone numbers
  document.addEventListener('contextmenu', (e) => {
    const el = e.target;
    if (el.closest('[data-sensitive]') || el.tagName === 'A') {
      e.preventDefault();
    }
  });

  // Prevent text selection on sensitive data for non-admin
  if (profile.role === 'staff' || profile.role === 'dispatch') {
    const style = document.createElement('style');
    style.textContent = '[data-sensitive] { -webkit-user-select: none; user-select: none; }';
    document.head.appendChild(style);
  }
}

window.initDataProtection = initDataProtection;

// ===== MASKED CALLING =====
// Instead of revealing customer number, open WhatsApp or show masked info
// For actual call masking — needs Exotel/Knowlarity API integration
// This UI layer shows a "Call Customer" button that tracks intent
async function callCustomerMasked(customerId, customerName) {
  const profile = VW_AUTH.getCurrentProfile();
  trackEvent('action', window._currentPage, 'call_intent', { customerId, staffName: profile?.name });

  // Show options sheet
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📞 Call ${customerName}</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Choose how to reach this customer:
    </p>
    <button class="btn-primary full-width" style="margin-bottom:8px" onclick="VW_CRM.callCustomerDirect(${customerId});closeSheet()">
      📞 Call via Your Phone
    </button>
    <button class="btn-wa full-width" style="margin-bottom:8px" onclick="VW_CRM.waCustomer(${customerId});closeSheet()">
      💬 WhatsApp Message
    </button>
    <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-top:8px">
      <div style="font-size:12px;font-weight:600;color:var(--gold);margin-bottom:4px">🔒 Masked Calling (Coming Soon)</div>
      <div style="font-size:12px;color:var(--text2)">Calls through a V Wholesale number — customer only sees business number, not your personal SIM. Requires Exotel/Knowlarity integration. Ask Himansu to enable.</div>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.callCustomerMasked = callCustomerMasked;

// Direct call / WhatsApp from the masked-calling sheet. These resolve the
// customer's number on demand and hand off to the phone's dialer / WhatsApp.
async function callCustomerDirect(customerId) {
  const cust = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  const num = (cust?.phone || '').toString().replace(/\D/g,'');
  if (!num) { showToast('No phone number on file', 'warn'); return; }
  try { trackEvent('action', window._currentPage, 'call_direct', { customerId }); } catch(_) {}
  window.location.href = `tel:${num}`;
}
async function waCustomer(customerId) {
  const cust = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  let num = (cust?.whatsapp || cust?.phone || '').toString().replace(/\D/g,'');
  if (!num) { showToast('No WhatsApp number on file', 'warn'); return; }
  if (num.length === 10) num = '91' + num;
  try { trackEvent('action', window._currentPage, 'wa_customer', { customerId }); } catch(_) {}
  window.open(`https://wa.me/${num}`, '_blank');
}
VW_CRM.callCustomerDirect = callCustomerDirect;
VW_CRM.waCustomer = waCustomer;
window.callCustomerDirect = callCustomerDirect;
window.waCustomer = waCustomer;

// =====================================================
// QUOTATION PICKER — Dashboard "Quotation" button
// Opens a picker: General | Tiles | Granite
// =====================================================
function showQuotationPicker() {
  const profile = VW_AUTH.getCurrentProfile();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="margin:0">📋 New Quotation</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:16px">What type of quotation do you want to create?</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div style="background:var(--bg2);border:2px solid var(--border);border-radius:16px;padding:16px 12px;display:flex;flex-direction:column;gap:8px">
        <div style="font-size:32px;text-align:center">🔲</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);text-align:center">Tiles</div>
        <button onclick="closeSheet();VW_TILES.openQuickQuote()"
          style="background:rgba(230,181,60,0.12);border:1.5px solid var(--gold-border);border-radius:10px;padding:8px;cursor:pointer;text-align:center;width:100%">
          <div style="font-size:13px;font-weight:700;color:var(--gold)">⚡ Quick Quote</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">60 sec · tap rooms</div>
        </button>
        <button onclick="closeSheet();navigateTo('tiles')"
          style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px;cursor:pointer;text-align:center;width:100%">
          <div style="font-size:12px;font-weight:700;color:var(--text)">📋 Full Wizard</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">8 steps · all options</div>
        </button>
      </div>
      <button onclick="closeSheet();navigateTo('granite')"
        style="background:var(--bg2);border:2px solid var(--border);border-radius:16px;padding:20px 12px;cursor:pointer;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">🪨</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">Granite</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">W×H inches → SFT calculation</div>
      </button>
    </div>
    <button onclick="closeSheet();showNewQuotationEntry()"
      style="width:100%;background:var(--gold-muted);border:2px solid var(--gold-border);border-radius:16px;padding:16px;cursor:pointer;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px">📄</div>
      <div style="text-align:left">
        <div style="font-size:14px;font-weight:700;color:var(--gold)">General Quotation</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">Products from inventory, multiple items, approval workflow</div>
      </div>
    </button>

    <div style="margin-top:16px;padding:12px;background:var(--bg2);border-radius:10px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:4px">View All Quotations</div>
      <button onclick="closeSheet();navigateTo('quotations')" style="font-size:13px;color:var(--gold);background:none;border:none;cursor:pointer;padding:0">
        📋 Open Quotation History →
      </button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showQuotationPicker = showQuotationPicker;

// =====================================================
// STANDALONE QUOTATION PAGE (separate from billing)
// Shows all quotation types with filters
// No invoice creation options here
// =====================================================
async function renderStandaloneQuotationPage() {
  const profile = VW_AUTH.getCurrentProfile();
  _saPeriod = 'all'; // reset filter state on a fresh page open (buttons render with "All" active)
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0];

  // Fetch from Supabase
  let { data: quotes } = await VW_DB.client
    .from('quotations')
    .select('id,quote_no,customer_name,grand_total,status,approval_status,created_at,created_by_name,created_by_role,converted_by_name,converted_at,quote_type,invoice_no')
    .order('created_at', { ascending: false })
    .limit(200);
  // Fallback to IndexedDB
  if (!quotes?.length) quotes = await VW_DB.all(VW_DB.STORES.quotations);
  quotes = quotes || [];

  // Merge tile quotations — they live in a separate table but belong in the same history view
  try {
    const { data: tqs } = await VW_DB.client
      .from('tile_quotations')
      .select('id,tq_no,customer_name,total_area_sqft,total_boxes,approval_status,status,created_by,created_at,grand_total')
      .order('created_at', { ascending: false }).limit(100);
    (tqs||[]).forEach(tq => quotes.push({
      id: tq.id, quote_no: tq.tq_no, customer_name: tq.customer_name,
      grand_total: tq.grand_total || null,
      status: tq.approval_status || tq.status || 'draft',
      approval_status: tq.approval_status,
      created_at: tq.created_at, created_by_name: tq.created_by,
      quote_type: 'tiles', _isTQ: true,
      total_area_sqft: tq.total_area_sqft, total_boxes: tq.total_boxes,
    }));
    quotes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  } catch(e) {}

  const total = quotes.length;
  const todayQ = quotes.filter(q=>new Date(q.created_at||q.createdAt).toDateString()===new Date().toDateString()).length;
  const converted = quotes.filter(q=>q.status==='converted').length;
  const pending = quotes.filter(q=>q.approval_status==='pending_approval'||q.approvalStatus==='pending_approval').length;

  return `
  <div class="module-header">
    <h2>📋 Quotations</h2>
    <button class="btn-sm" style="background:var(--gold);color:#000" onclick="showQuotationPicker()">+ New</button>
  </div>

  <!-- METRICS -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold" onclick="filterStandaloneQuotes('all')" style="cursor:pointer">
      <div class="mc-label">All</div><div class="mc-value">${total}</div></div>
    <div class="metric-card" onclick="filterStandaloneQuotes('today')" style="cursor:pointer">
      <div class="mc-label">Today</div><div class="mc-value">${todayQ}</div></div>
    <div class="metric-card success" onclick="filterStandaloneQuotes('converted')" style="cursor:pointer">
      <div class="mc-label">Converted</div><div class="mc-value">${converted}</div></div>
    <div class="metric-card ${pending?'danger':''}" onclick="filterStandaloneQuotes('pending')" style="cursor:pointer">
      <div class="mc-label">Pending</div><div class="mc-value">${pending}</div></div>
  </div>

  <!-- FILTERS -->
  <div class="card" style="margin-bottom:10px;padding:12px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button id="qf-all" class="entry-type-btn active" onclick="filterStandaloneQuotes('all',this)">All</button>
      <button id="qf-today" class="entry-type-btn" onclick="filterStandaloneQuotes('today',this)">Today</button>
      <button id="qf-week" class="entry-type-btn" onclick="filterStandaloneQuotes('week',this)">This Week</button>
      <button id="qf-custom" class="entry-type-btn" onclick="filterStandaloneQuotes('custom',this)">Custom Date</button>
    </div>
    <div id="qf-custom-dates" style="display:none;gap:8px;margin-bottom:10px">
      <input type="date" id="qf-from" value="${weekAgo}" style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px;color:var(--text);font-size:12px">
      <input type="date" id="qf-to" value="${today}" style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px;color:var(--text);font-size:12px">
      <button class="btn-sm" onclick="filterStandaloneQuotes('custom')">Apply</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="entry-type-btn active" id="qt-all" onclick="filterStandaloneType('all',this)">All Types</button>
      <button class="entry-type-btn" id="qt-general" onclick="filterStandaloneType('general',this)">📄 General</button>
      <button class="entry-type-btn" id="qt-tiles" onclick="filterStandaloneType('tiles',this)">🔲 Tiles</button>
      <button class="entry-type-btn" id="qt-granite" onclick="filterStandaloneType('granite',this)">🪨 Granite</button>
    </div>
    <input type="text" id="qf-search" placeholder="🔍 Search customer, quote no..." oninput="searchStandaloneQuotes(this.value)" style="margin-top:8px">
  </div>

  <!-- QUOTES LIST -->
  <div id="standalone-quotes-list">
    ${_renderStandaloneQuotesList(quotes)}
  </div>`;
}

function _renderStandaloneQuotesList(quotes) {
  if (!quotes.length) return `<div class="card" style="text-align:center;padding:32px;color:var(--text3)">
    <div style="font-size:40px;margin-bottom:10px">📋</div>
    <div style="font-size:14px">No quotations found</div>
    <button class="btn-primary" style="margin-top:14px" onclick="showQuotationPicker()">Create First Quotation</button>
  </div>`;

  const typeIcon = { tiles:'🔲', granite:'🪨', general:'📄' };
  const statusColor = { converted:'var(--green)', pending:'var(--text)', approved:'var(--blue)', draft:'var(--text3)' };

  return quotes.map(q => {
    const status = q.status || q.approval_status || 'draft';
    const isConverted = q.status === 'converted' || status === 'converted';
    const quoteType = q.quote_type || 'general';
    const createdBy = q.created_by_name || q.createdByName || '—';
    const convertedBy = q.converted_by_name || q.convertedByName || '';
    const createdAt = new Date(q.created_at||q.createdAt);

    // TQ-specific status labels and colours
    const tqStatusLabel = { draft:'📝 Draft', pending_approval:'⏳ Pending', approved:'✅ Approved',
      rejected:'❌ Rejected', advance_collected:'💰 Advance', converted:'🧾 Invoiced' };
    const tqStatusColor = { draft:'var(--text3)', pending_approval:'var(--gold)',
      approved:'var(--green)', rejected:'var(--red)', advance_collected:'#378ADD', converted:'var(--green)' };

    const statusDisplay = q._isTQ
      ? (tqStatusLabel[status] || status)
      : status;
    const dotColor = q._isTQ
      ? (tqStatusColor[status] || 'var(--text3)')
      : (statusColor[status] || 'var(--text3)');

    return `
    <div onclick="openStandaloneQuote(${q.id},'${quoteType}',${q._isTQ?'true':'false'})"
      style="background:var(--bg2);border:1px solid ${isConverted?'rgba(34,197,94,0.3)':status==='pending_approval'&&q._isTQ?'rgba(245,200,66,0.25)':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:8px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:16px">${typeIcon[quoteType]||'📄'}</span>
            <span style="font-size:13px;font-weight:700;color:var(--text)">${q.quote_no||q.quoteNo||'Draft'}</span>
            ${isConverted?`<span style="font-size:10px;background:rgba(34,197,94,0.12);color:var(--green);padding:2px 6px;border-radius:4px;font-weight:600">✓ BILL RAISED</span>`:''}
          </div>
          <div style="font-size:12px;color:var(--text2)">${q.customer_name||q.customerName||'—'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            By: ${createdBy}${q.created_by_role||q.createdByRole?` (${q.created_by_role||q.createdByRole})`:''} ·
            ${createdAt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
          </div>
          ${q._isTQ&&q.total_area_sqft?`<div style="font-size:11px;color:var(--text3);margin-top:2px">📐 ${parseFloat(q.total_area_sqft).toFixed(1)} sqft${q.total_boxes?` · ${q.total_boxes} boxes`:''}</div>`:''}
          ${isConverted&&convertedBy?`<div style="font-size:10px;color:var(--green);margin-top:2px">Converted by: ${convertedBy}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${q.grand_total||q.grandTotal?`<div style="font-size:14px;font-weight:700;color:var(--gold)">₹${(q.grand_total||q.grandTotal).toLocaleString('en-IN')}</div>`:''}
          <div style="font-size:11px;color:${dotColor}">● ${statusDisplay}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

let _saPeriod = 'all';
function filterStandaloneQuotes(period, btn) {
  _saPeriod = period;
  if (btn) {
    document.querySelectorAll('#qf-all,#qf-today,#qf-week,#qf-custom').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  const customDates = document.getElementById('qf-custom-dates');
  if (customDates) customDates.style.display = period==='custom' ? 'flex' : 'none';
  // Clicking the "Custom Date" tab (btn present) just reveals the date inputs;
  // the actual filter runs when "Apply" calls this again with no btn.
  if (period === 'custom' && btn) return;
  _applyStandaloneFilter();
}

function filterStandaloneType(type, btn) {
  if (btn) {
    document.querySelectorAll('#qt-all,#qt-general,#qt-tiles,#qt-granite').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  _applyStandaloneFilter();
}

function searchStandaloneQuotes(val) { _applyStandaloneFilter(val); }

async function _applyStandaloneFilter(searchVal) {
  const period = _saPeriod;
  const type = document.querySelector('#qt-tiles.active') ? 'tiles' :
               document.querySelector('#qt-granite.active') ? 'granite' :
               document.querySelector('#qt-general.active') ? 'general' : 'all';
  const search = (searchVal || document.getElementById('qf-search')?.value || '').toLowerCase();
  const from = document.getElementById('qf-from')?.value;
  const to = document.getElementById('qf-to')?.value;

  let { data: quotes } = await VW_DB.client
    .from('quotations').select('*').order('created_at',{ascending:false}).limit(200);
  if (!quotes?.length) quotes = await VW_DB.all(VW_DB.STORES.quotations);
  quotes = quotes || [];

  // Merge tile quotations (unless user explicitly filtered to General)
  if (type !== 'general') {
    try {
      const { data: tqs } = await VW_DB.client
        .from('tile_quotations')
        .select('id,tq_no,customer_name,total_area_sqft,total_boxes,approval_status,status,created_by,created_at,grand_total')
        .order('created_at', { ascending: false }).limit(100);
      (tqs||[]).forEach(tq => quotes.push({
        id: tq.id, quote_no: tq.tq_no, customer_name: tq.customer_name,
        grand_total: tq.grand_total || null,
        status: tq.approval_status || tq.status || 'draft',
        approval_status: tq.approval_status,
        created_at: tq.created_at, created_by_name: tq.created_by,
        quote_type: 'tiles', _isTQ: true,
        total_area_sqft: tq.total_area_sqft, total_boxes: tq.total_boxes,
      }));
      quotes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    } catch(e) {}
  }

  // Period filter
  const now = new Date(); const todayStr = now.toDateString();
  const weekAgo = new Date(now-7*24*60*60*1000);
  if (period === 'today') quotes = quotes.filter(q=>new Date(q.created_at||q.createdAt).toDateString()===todayStr);
  else if (period === 'week') quotes = quotes.filter(q=>new Date(q.created_at||q.createdAt)>=weekAgo);
  else if (period === 'converted') quotes = quotes.filter(q=>q.status==='converted');
  else if (period === 'pending') quotes = quotes.filter(q=>q.approval_status==='pending_approval'||q.approvalStatus==='pending_approval');
  else if (period === 'custom' && from && to) {
    const f = new Date(from), t = new Date(to+'T23:59:59');
    quotes = quotes.filter(q=>{ const d=new Date(q.created_at||q.createdAt); return d>=f&&d<=t; });
  }

  // Type filter
  if (type !== 'all') quotes = quotes.filter(q=>(q.quote_type||q.quoteType||'general')===type);

  // Search
  if (search) quotes = quotes.filter(q=>{
    const name=(q.customer_name||q.customerName||'').toLowerCase();
    const no=(q.quote_no||q.quoteNo||'').toLowerCase();
    return name.includes(search)||no.includes(search);
  });

  const el = document.getElementById('standalone-quotes-list');
  if (el) el.innerHTML = _renderStandaloneQuotesList(quotes);
}

async function openStandaloneQuote(id, type, isTQ) {
  if (type === 'tiles') {
    if (isTQ && id && typeof VW_TILES?.openTileQuote === 'function') {
      // Existing tile quote — open its detail sheet
      await VW_TILES.openTileQuote(id);
    } else {
      // No id (new) — open the wizard
      navigateTo('tiles');
    }
    return;
  }
  if (type === 'granite') {
    await navigateTo('granite');
    return;
  }
  // General quotation — open detail sheet
  if (typeof openQuotationDetail === 'function') openQuotationDetail(id);
}
window.openStandaloneQuote = openStandaloneQuote;
window.filterStandaloneQuotes = filterStandaloneQuotes;
window.filterStandaloneType = filterStandaloneType;
window.searchStandaloneQuotes = searchStandaloneQuotes;
window.renderStandaloneQuotationPage = renderStandaloneQuotationPage;

// =====================================================
// REWARDS STORE PAGE (accessible from More menu)
// Accessible to staff, contractors, and customers via points
// =====================================================
async function renderRewardsStorePage() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: rewards } = await VW_DB.client.from('rewards_catalog')
    .select('*').eq('is_active', true).order('category').order('points_required');
  const items = rewards || [];

  // Get staff loyalty balance
  let myPoints = 0;
  try {
    const { data: pts } = await VW_DB.client.from('loyalty_points')
      .select('points').eq('staff_id', profile?.staffId||0).single();
    myPoints = pts?.points || 0;
  } catch(e) {}

  const { data: myRedemptions } = await VW_DB.client.from('rewards_redemptions')
    .select('*').eq('redeemer_type','staff').eq('redeemer_id', profile?.id||0)
    .order('created_at',{ascending:false}).limit(5);

  const categories = [...new Set(items.map(r=>r.category))];
  const catIcons = { tool:'🔧', voucher:'🎫', gift:'🎁', discount:'💰', training:'🎓' };

  return `
  <div class="module-header">
    <h2>🎁 Rewards Store</h2>
    ${VW_AUTH.isAdmin() ? `<div style="display:flex;gap:6px">
      <button class="btn-sm" onclick="showRewardsSettings()">⚙️ Earn rate</button>
      <button class="btn-sm" onclick="showAddReward()">+ Add Reward</button>
    </div>` : ''}
  </div>

  <!-- BALANCE CARD -->
  <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:16px;padding:16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:13px;font-weight:600;color:var(--text)">Your Points Balance</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">Earned on the bills you finalize</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:800;color:var(--gold)">${myPoints}</div>
      <div style="font-size:10px;color:var(--text3)">pts</div>
    </div>
  </div>

  <!-- CATEGORIES -->
  ${categories.map(cat => {
    const catItems = items.filter(r=>r.category===cat);
    return `
    <div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">${catIcons[cat]||'📦'} ${cat?.charAt(0).toUpperCase()+cat?.slice(1)||'Items'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${catItems.map(r => {
          const canAfford = myPoints >= r.points_required;
          const hasStock = r.stock_qty === -1 || r.stock_qty > 0;
          const _rwName = (r.name||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
          return `
          <div style="background:var(--bg2);border-radius:12px;padding:12px;border:1px solid ${canAfford&&hasStock?'var(--gold-border)':'var(--border)'};position:relative">
            ${VW_AUTH.isAdmin() ? `<button onclick="deactivateReward(${r.id},'${_rwName}')" title="Remove reward" style="position:absolute;top:6px;right:6px;background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer">✕</button>` : ''}
            <div style="font-size:24px;margin-bottom:6px">${catIcons[r.category]||'🎁'}</div>
            <div style="font-size:12px;font-weight:700;margin-bottom:3px;line-height:1.3">${r.name}</div>
            ${r.description?`<div style="font-size:10px;color:var(--text3);margin-bottom:6px">${r.description}</div>`:''}
            <div style="font-size:13px;font-weight:700;color:${canAfford?'var(--gold)':'var(--text3)'}">⭐ ${r.points_required} pts</div>
            ${r.cash_price&&r.discount_pct?`<div style="font-size:10px;color:var(--green)">or ₹${Math.round(r.cash_price*(1-r.discount_pct/100))} <s style="color:var(--text3)">₹${r.cash_price}</s></div>`:''}
            ${!hasStock?`<div style="font-size:10px;color:var(--red);margin-top:3px">Out of stock</div>`:''}
            <button onclick="redeemStaffReward(${r.id},'${r.name}',${r.points_required})"
              ${(!canAfford||!hasStock)?'disabled':''}
              style="width:100%;margin-top:8px;padding:7px;border-radius:8px;border:none;background:${canAfford&&hasStock?'var(--gold)':'var(--bg3)'};color:${canAfford&&hasStock?'#000':'var(--text3)'};font-size:11px;font-weight:600;cursor:${canAfford&&hasStock?'pointer':'not-allowed'}">
              ${!hasStock?'Unavailable':canAfford?'Redeem':'Need '+(r.points_required-myPoints)+' more pts'}
            </button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('')}

  ${items.length === 0 ? `
  <div style="text-align:center;padding:40px;color:var(--text3)">
    <div style="font-size:40px;margin-bottom:12px">🎁</div>
    <div style="font-size:14px;font-weight:600">No rewards in the catalog yet</div>
    <div style="font-size:12px;margin-top:6px">${VW_AUTH.isAdmin() ? 'Tap “+ Add Reward” above to add the first item' : 'Check back soon — rewards are on the way'}</div>
  </div>` : ''}

  ${(myRedemptions||[]).length ? `
  <div class="card" style="margin-top:16px">
    <h3 class="card-title">My Redemptions</h3>
    ${(myRedemptions||[]).map(r=>`
    <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px">
      <div><div style="font-weight:600">${r.reward_name||'—'}</div><div style="color:var(--text3)">${new Date(r.created_at).toLocaleDateString('en-IN')}</div></div>
      <span style="color:${r.status==='delivered'?'var(--green)':r.status==='cancelled'?'var(--red)':'var(--gold)'}">● ${r.status}</span>
    </div>`).join('')}
  </div>` : ''}`;
}

async function redeemStaffReward(rewardId, rewardName, pointsCost) {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return;
  const staffId = profile.staffId;
  // Confirm the staff member actually has the points (defensive — the button is
  // also disabled when they can't afford it).
  let balance = 0;
  try {
    const { data: pts } = await VW_DB.client.from('loyalty_points').select('points').eq('staff_id', staffId||0).single();
    balance = pts?.points || 0;
  } catch(_) {}
  if (balance < pointsCost) { showToast(`Not enough points — you have ${balance}, need ${pointsCost}`, 'warn'); return; }
  if (!confirm(`Redeem "${rewardName}" for ${pointsCost} points?`)) return;
  const { error } = await VW_DB.client.from('rewards_redemptions').insert({
    redeemer_type: 'staff', redeemer_id: profile.id||0, redeemer_name: profile.name||'',
    reward_id: rewardId, reward_name: rewardName, points_used: pointsCost,
  });
  if (error) { showToast('Error: '+error.message,'error'); return; }
  // Deduct the spent points from the staff ledger.
  try { await _adjustStaffPoints(staffId, -pointsCost); } catch(_) {}
  // Decrement catalog stock when this reward is finite (-1 = unlimited).
  try {
    const { data: r } = await VW_DB.client.from('rewards_catalog').select('stock_qty').eq('id', rewardId).single();
    if (r && r.stock_qty != null && r.stock_qty > 0) {
      await VW_DB.client.from('rewards_catalog').update({ stock_qty: r.stock_qty - 1 }).eq('id', rewardId);
    }
  } catch(_) {}
  showToast(`${rewardName} redeemed ✓ — Admin will arrange delivery`, 'success');
  navigateTo('rewards');
}
window.redeemStaffReward = redeemStaffReward;

// Admin: set how many points staff earn per ₹1,000 they bill (0 = earning off).
async function showRewardsSettings() {
  if (!VW_AUTH.isAdmin()) { showToast('Admin only', 'warn'); return; }
  const rate = parseFloat(await VW_DB.getSetting('staff_points_per_rs', 0)) || 0;
  const per1000 = Math.round(rate * 1000);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">⚙️ Staff Points Earning</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Staff earn points on the bills they finalize. Set the rate that fits your rewards budget — set <strong>0</strong> to turn earning off.</p>
    <div class="form-group"><label>Points per ₹1,000 billed</label>
      <input type="number" id="rw-rate" min="0" step="1" value="${per1000}" placeholder="e.g. 10">
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:14px">Example: at 10 pts per ₹1,000, a ₹50,000 bill earns the biller 500 points.</div>
    <button class="btn-primary full-width" onclick="saveRewardsRate()">Save Rate</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showRewardsSettings = showRewardsSettings;

async function saveRewardsRate() {
  if (!VW_AUTH.isAdmin()) return;
  const per1000 = parseFloat(document.getElementById('rw-rate')?.value||0) || 0;
  await VW_DB.setSetting('staff_points_per_rs', per1000/1000);
  showToast(per1000 > 0 ? `Staff now earn ${per1000} pts per ₹1,000 billed` : 'Staff point earning turned off', 'success');
  closeSheet();
  navigateTo('rewards');
}
window.saveRewardsRate = saveRewardsRate;

// Admin: add a reward to the catalog (replaces the old "add via Supabase" gap).
function showAddReward() {
  if (!VW_AUTH.isAdmin()) { showToast('Only Admin can add rewards', 'warn'); return; }
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">🎁 Add Reward</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>Reward Name *</label><input type="text" id="rw-name" placeholder="e.g. Bosch Cordless Drill"></div>
    <div class="form-group"><label>Description</label><input type="text" id="rw-desc" placeholder="e.g. 12V, 2 batteries"></div>
    <div class="form-group"><label>Category</label>
      <select id="rw-cat">
        <option value="tool">🔧 Tool</option><option value="voucher">🎫 Voucher</option>
        <option value="gift">🎁 Gift</option><option value="discount">💰 Discount</option><option value="training">🎓 Training</option>
      </select>
    </div>
    <div style="display:flex;gap:8px">
      <div class="form-group" style="flex:1"><label>Points Required *</label><input type="number" id="rw-points" min="1" placeholder="e.g. 5000"></div>
      <div class="form-group" style="flex:1"><label>Stock Qty</label><input type="number" id="rw-stock" value="-1" placeholder="-1 = unlimited"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="form-group" style="flex:1"><label>Cash Price ₹ (optional)</label><input type="number" id="rw-cash" min="0" placeholder="for cash-or-points"></div>
      <div class="form-group" style="flex:1"><label>Discount % (optional)</label><input type="number" id="rw-disc" min="0" max="100"></div>
    </div>
    <div class="form-group"><label>Vendor / Source (optional)</label><input type="text" id="rw-vendor" placeholder="e.g. Bosch Distributor"></div>
    <button class="btn-primary full-width" onclick="saveReward()">Save Reward</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showAddReward = showAddReward;

async function saveReward() {
  if (!VW_AUTH.isAdmin()) return;
  const name = document.getElementById('rw-name')?.value.trim();
  const points = parseInt(document.getElementById('rw-points')?.value||0);
  if (!name) { showToast('Reward name is required', 'warn'); return; }
  if (!points || points <= 0) { showToast('Enter the points required', 'warn'); return; }
  const stockRaw = document.getElementById('rw-stock')?.value;
  const cash = parseFloat(document.getElementById('rw-cash')?.value||0);
  const disc = parseFloat(document.getElementById('rw-disc')?.value||0);
  const { error } = await VW_DB.client.from('rewards_catalog').insert({
    name,
    description: document.getElementById('rw-desc')?.value.trim()||'',
    category: document.getElementById('rw-cat')?.value||'gift',
    points_required: points,
    stock_qty: (stockRaw===''||stockRaw==null) ? -1 : parseInt(stockRaw),
    cash_price: cash || null,
    discount_pct: disc || null,
    vendor_name: document.getElementById('rw-vendor')?.value.trim()||'',
    is_active: true
  });
  if (error) { showToast('Error: '+error.message, 'error'); return; }
  showToast(`${name} added to rewards ✓`, 'success');
  closeSheet();
  navigateTo('rewards');
}
window.saveReward = saveReward;

async function deactivateReward(rewardId, rewardName) {
  if (!VW_AUTH.isAdmin()) return;
  if (!confirm(`Remove "${rewardName}" from the rewards store?`)) return;
  const { error } = await VW_DB.client.from('rewards_catalog').update({ is_active: false }).eq('id', rewardId);
  if (error) { showToast('Error: '+error.message, 'error'); return; }
  showToast(`${rewardName} removed`, 'info');
  navigateTo('rewards');
}
window.deactivateReward = deactivateReward;

// =====================================================
// LABOR MARKETPLACE PAGE (admin view of all requirements + bids)
// =====================================================
async function renderLaborMarketplacePage() {
  const { data: requirements } = await VW_DB.client.from('labor_requirements')
    .select('*').order('created_at',{ascending:false}).limit(50);
  const reqs = requirements || [];
  const open = reqs.filter(r=>r.status==='open'||r.status==='bidding').length;
  const awarded = reqs.filter(r=>r.status==='awarded'||r.status==='in_progress').length;

  return `
  <div class="module-header">
    <h2>🔨 Labor Marketplace</h2>
    <button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_CONTRACTOR.postLaborRequirement()">+ Post Work</button>
  </div>

  <div class="metric-grid-4" style="margin-bottom:12px">
    <div class="metric-card gold"><div class="mc-label">Open</div><div class="mc-value">${open}</div></div>
    <div class="metric-card success"><div class="mc-label">Awarded</div><div class="mc-value">${awarded}</div></div>
    <div class="metric-card"><div class="mc-label">Total</div><div class="mc-value">${reqs.length}</div></div>
  </div>

  <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px;color:var(--text2)">
    ✅ <strong>V Wholesale Marketplace:</strong> All tile procurement for labor work must be from V Wholesale. Contractors using our materials get work leads; customers get vetted contractors.
  </div>

  ${reqs.length===0 ? `
  <div style="text-align:center;padding:32px;color:var(--text3)">
    <div style="font-size:40px;margin-bottom:10px">🔨</div>
    <div style="font-size:14px">No requirements posted yet</div>
    <div style="font-size:12px;margin-top:6px">Post a customer's tile work requirement to get contractor bids</div>
    <button class="btn-primary" style="margin-top:14px" onclick="VW_CONTRACTOR.postLaborRequirement()">+ Post First Requirement</button>
  </div>` :
  reqs.map(r=>`
  <div style="background:var(--bg2);border-radius:14px;padding:14px;margin-bottom:8px;border:1px solid ${r.status==='open'?'rgba(245,200,66,0.3)':r.status==='awarded'?'rgba(34,197,94,0.3)':'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:700">${r.req_no||'—'}</div>
        <div style="font-size:12px;color:var(--text2)">${r.customer_name||'—'} ${r.customer_phone?`· ${r.customer_phone}`:''}</div>
        <div style="font-size:11px;color:var(--text3)">📍 ${r.site_address||'—'} · ${r.total_area_sqft||'?'} sqft</div>
        <div style="font-size:11px;color:var(--text3)">${r.work_type?.replace(/_/g,' ')||'Tile work'} · Start: ${r.start_date||'Flexible'}</div>
        ${r.budget_min||r.budget_max?`<div style="font-size:11px;color:var(--gold)">Budget: ₹${r.budget_min||'?'} – ₹${r.budget_max||'?'}</div>`:''}
      </div>
      <span style="font-size:11px;background:${r.status==='open'?'rgba(245,200,66,0.12)':r.status==='awarded'?'rgba(34,197,94,0.12)':'var(--bg3)'};color:${r.status==='open'?'var(--gold)':r.status==='awarded'?'var(--green)':'var(--text3)'};padding:3px 8px;border-radius:6px;white-space:nowrap">
        ${r.status}
      </span>
    </div>
    <button onclick="viewLaborBids(${r.id})"
      style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px;font-size:12px;color:var(--text);cursor:pointer">
      View Bids
    </button>
  </div>`).join('')}`;
}

async function viewLaborBids(reqId) {
  const { data: bids } = await VW_DB.client.from('contractor_bids')
    .select('*').eq('requirement_id', reqId).order('is_featured',{ascending:false}).order('created_at',{ascending:false});
  const list = bids || [];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">Bids Received (${list.length})</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    ${list.length===0?`<div style="text-align:center;padding:24px;color:var(--text3)">No bids yet</div>`:''}
    ${list.map(b=>`
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid ${b.is_featured?'var(--gold-border)':'var(--border)'}">
      ${b.is_featured?'<div style="font-size:10px;color:var(--gold);margin-bottom:4px">⭐ FEATURED BID</div>':''}
      <div style="display:flex;justify-content:space-between">
        <div>
          <div style="font-size:13px;font-weight:700">${b.contractor_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">₹${b.rate_per_sqft||0}/sqft · Total: ₹${(b.bid_amount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:var(--text3)">${b.timeline_days} days${b.includes_waterproofing?' · Incl. WP':''}${b.includes_adhesive?' · Incl. Adhesive':''}</div>
          ${b.description?`<div style="font-size:11px;color:var(--text2);margin-top:4px">${b.description}</div>`:''}
        </div>
        <span style="color:${b.status==='awarded'?'var(--green)':'var(--gold)'}">${b.status}</span>
      </div>
      ${b.status!=='awarded'?`
      <button onclick="awardContractorBid(${b.id},${reqId})"
        style="width:100%;margin-top:8px;background:var(--green);color:#fff;border:none;border-radius:8px;padding:7px;font-size:12px;font-weight:600;cursor:pointer">
        ✓ Award This Bid
      </button>` : ''}
    </div>`).join('')}`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function awardContractorBid(bidId, reqId) {
  await VW_DB.client.from('contractor_bids').update({ status:'awarded' }).eq('id', bidId);
  await VW_DB.client.from('contractor_bids').update({ status:'rejected' }).eq('requirement_id', reqId).neq('id', bidId);
  const { data: bid } = await VW_DB.client.from('contractor_bids').select('contractor_id,contractor_name').eq('id',bidId).single();
  if (bid) await VW_DB.client.from('labor_requirements').update({ status:'awarded', awarded_contractor_id:bid.contractor_id, awarded_bid_id:bidId }).eq('id', reqId);
  closeSheet();
  showToast(`Bid awarded to ${bid?.contractor_name||'contractor'} ✓`, 'success');
  navigateTo('labor');
}
window.viewLaborBids = viewLaborBids;
window.awardContractorBid = awardContractorBid;
window.renderRewardsStorePage = renderRewardsStorePage;
window.renderLaborMarketplacePage = renderLaborMarketplacePage;

// ═══ STAFF SIDEBAR ═══
const SIDEBAR_NAV = [
  { section: 'Main' },
  { page: 'dashboard',     icon: '📊', label: 'Dashboard',    always: true },
  { page: 'checkin',       icon: '🚶', label: 'Check-in',     always: true },
  { page: 'tasks',         icon: '📋', label: 'Tasks',        always: true },
  { section: 'Sales' },
  { page: 'cart',          icon: '🧾', label: 'Billing',      perm: 'billing' },
  { page: 'tiles',         icon: '⬜', label: 'Tile Quote',   perm: 'billing' },
  { page: 'quotations',    icon: '📄', label: 'Quotations',   perm: 'billing' },
  { page: 'granite',       icon: '🪨', label: 'Granite',      perm: 'billing' },
  { page: 'crm',           icon: '👥', label: 'CRM',          perm: 'crm' },
  { page: 'follow_ups',    icon: '📞', label: 'Follow Ups',   perm: 'crm' },
  { section: 'Inventory' },
  { page: 'inventory',     icon: '📦', label: 'Inventory',    perm: 'inventory' },
  { page: 'tile_inventory',icon: '🔲', label: 'Tile Stock',   perm: 'tile_inventory' },
  { page: 'grn',           icon: '🧾', label: 'GRN',          perm: 'inventory' },
  { page: 'dispatch',      icon: '🚚', label: 'Dispatch',     perm: 'dispatch' },
  { page: 'returns',       icon: '↩️', label: 'Returns',      perm: 'billing' },
  { section: 'B2B & Club' },
  { page: 'club',          icon: '🏆', label: 'Contractor Club', perm: 'club' },
  { page: 'labor',         icon: '🔨', label: 'Labor Jobs',   perm: 'club' },
  { page: 'ledger',        icon: '📒', label: 'Ledger',       perm: 'billing' },
  { section: 'Tools' },
  { page: 'visualizer',   icon: '🎨', label: 'Visualizer',   perm: 'billing' },
  { page: 'wishlist',     icon: '❤️', label: 'Wishlists',    always: true },
  { page: 'training',     icon: '🎓', label: 'Training',     always: true },
  { page: 'feedback',     icon: '⭐', label: 'Feedback',     always: true },
  { section: 'My HR' },
  { page: 'my_hr',        icon: '👤', label: 'My HR Portal',  always: true },
  { page: 'my_leaves',    icon: '🏖', label: 'My Leaves',     always: true },
  { page: 'my_salary',    icon: '💰', label: 'My Salary',     always: true },
];

function buildSidebar() {
  const role = VW_AUTH.getRole();
  if (!role || ['customer','contractor','pending'].includes(role)) return;

  const profile = VW_AUTH.getCurrentProfile();
  const allowed = new Set(VW_AUTH.getAllowedPages());

  const nameEl = document.getElementById('sb-user-name');
  const roleEl = document.getElementById('sb-user-role');
  if (nameEl) nameEl.textContent = profile?.name || 'Staff';
  if (roleEl) roleEl.textContent = (profile?.role || role).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  const timeEl = document.getElementById('st-time');
  if (timeEl) {
    const tick = () => { timeEl.textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); };
    tick(); setInterval(tick, 30000);
  }

  const nav = document.getElementById('sb-nav');
  if (!nav) return;

  let html = '';
  for (const item of SIDEBAR_NAV) {
    if (item.section) { html += `<div class="sb-section-lbl">${item.section}</div>`; continue; }
    const hasAccess = item.always || role === 'admin' || allowed.has(item.page) ||
      (item.perm && allowed.has(item.perm));
    if (!hasAccess) continue;
    html += `<button class="sb-nav-item" data-sb-page="${item.page}" onclick="sbNavigate('${item.page}')">
      <span class="sb-nav-icon">${item.icon}</span><span>${item.label}</span>
    </button>`;
  }

  if (role === 'admin') {
    html += `<div class="sb-section-lbl">Management</div>
    <button class="sb-nav-item" onclick="window.open('./admin.html','_blank')">
      <span class="sb-nav-icon">⚙️</span><span>Admin Portal</span>
    </button>`;
  }
  nav.innerHTML = html;
}

function sbNavigate(page) {
  navigateTo(page);
  document.querySelectorAll('.sb-nav-item').forEach(b => b.classList.toggle('active', b.dataset.sbPage === page));
  const titleEl = document.getElementById('st-page-title');
  const item = SIDEBAR_NAV.find(i => i.page === page);
  if (titleEl && item) titleEl.textContent = item.label;
  if (window.innerWidth < 769) closeSidebar();
}
window.sbNavigate = sbNavigate;

function toggleSidebar() {
  document.getElementById('staff-sidebar')?.classList.toggle('open');
  document.getElementById('sb-overlay')?.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('staff-sidebar')?.classList.remove('open');
  document.getElementById('sb-overlay')?.classList.remove('show');
}
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
