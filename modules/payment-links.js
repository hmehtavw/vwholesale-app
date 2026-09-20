// ══════════════════════════════════════════════════════════
// VW PAYMENT LINKS — Generate & share Cashfree payment links
// ══════════════════════════════════════════════════════════
window.VW_PAYMENT_LINKS = (() => {

  const SB_FN = 'https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/cashfree-order';

  async function renderPage() {
    const { data: links } = await VW_DB.client
      .from('payment_links')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const total = (links || []).filter(l => l.status === 'paid').reduce((s, l) => s + (l.amount || 0), 0);
    const pending = (links || []).filter(l => l.status === 'active').reduce((s, l) => s + (l.amount || 0), 0);

    return `
      <div style="padding:20px;max-width:900px;margin:0 auto;">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div>
            <div style="font-size:20px;font-weight:800;">💳 Payment Links</div>
            <div style="font-size:13px;color:#64748B;margin-top:2px;">Generate & share Cashfree payment links via WhatsApp</div>
          </div>
          <button onclick="VW_PAYMENT_LINKS.openGenerateModal()"
            style="padding:10px 20px;border-radius:10px;background:#F5A623;border:none;color:#0F1923;font-weight:700;font-size:14px;cursor:pointer;">
            + Generate Link
          </button>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#64748B;font-weight:600;margin-bottom:4px;">TOTAL LINKS</div>
            <div style="font-size:28px;font-weight:800;">${links?.length || 0}</div>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#16a34a;font-weight:600;margin-bottom:4px;">COLLECTED</div>
            <div style="font-size:28px;font-weight:800;color:#16a34a;">₹${(total/1000).toFixed(0)}K</div>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#d97706;font-weight:600;margin-bottom:4px;">PENDING</div>
            <div style="font-size:28px;font-weight:800;color:#d97706;">₹${(pending/1000).toFixed(0)}K</div>
          </div>
        </div>

        <!-- Links table -->
        <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
                <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">CUSTOMER</th>
                <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">AMOUNT</th>
                <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">PURPOSE</th>
                <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">STATUS</th>
                <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">CREATED</th>
                <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${(links || []).length === 0
                ? `<tr><td colspan="6" style="padding:32px;text-align:center;color:#94A3B8;">No payment links yet. Click + Generate Link to create one.</td></tr>`
                : (links || []).map(l => {
                    const statusColor = { paid: '#16a34a', active: '#d97706', expired: '#94A3B8', cancelled: '#EF4444' }[l.status] || '#94A3B8';
                    const expiry = l.expires_at ? new Date(l.expires_at) : null;
                    const isExpired = expiry && expiry < new Date() && l.status === 'active';
                    return `
                    <tr style="border-bottom:1px solid #F1F5F9;">
                      <td style="padding:12px 16px;">
                        <div style="font-weight:600;font-size:14px;">${l.customer_name || '—'}</div>
                        <div style="font-size:12px;color:#64748B;">${l.customer_phone || ''}</div>
                      </td>
                      <td style="padding:12px 16px;font-weight:700;font-size:15px;">₹${(l.amount||0).toLocaleString('en-IN')}</td>
                      <td style="padding:12px 16px;font-size:13px;color:#64748B;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.description || '—'}</td>
                      <td style="padding:12px 16px;">
                        <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${statusColor}22;color:${statusColor};">
                          ${isExpired ? 'Expired' : l.status}
                        </span>
                      </td>
                      <td style="padding:12px 16px;font-size:12px;color:#64748B;">${new Date(l.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                      <td style="padding:12px 16px;">
                        <div style="display:flex;gap:6px;">
                          ${l.payment_url ? `
                            <button onclick="VW_PAYMENT_LINKS.resendWA('${l.payment_url}', '${(l.customer_name||'').replace(/'/g,"\\'")}', ${l.amount}, '${l.customer_phone||''}', '${(l.description||'').replace(/'/g,"\\'")}', '${l.link_id}')"
                              style="padding:5px 10px;border-radius:6px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.3);color:#25d366;font-size:12px;font-weight:600;cursor:pointer;">
                              📲 WA
                            </button>
                            <button onclick="navigator.clipboard.writeText('${l.payment_url}').then(()=>showToast('Link copied!'))"
                              style="padding:5px 10px;border-radius:6px;background:#F1F5F9;border:1px solid #E2E8F0;color:#64748B;font-size:12px;cursor:pointer;">
                              📋 Copy
                            </button>
                          ` : '—'}
                          ${l.status === 'active' ? `
                            <button onclick="VW_PAYMENT_LINKS.cancelLink('${l.link_id}')"
                              style="padding:5px 10px;border-radius:6px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#EF4444;font-size:12px;cursor:pointer;">
                              Cancel
                            </button>` : ''}
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>

      </div>

      <!-- Generate modal -->
      <div id="pl-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;margin:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div style="font-size:18px;font-weight:700;">Generate Payment Link</div>
            <button onclick="VW_PAYMENT_LINKS.closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748B;">✕</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Customer Name *</label>
              <input id="pl-name" type="text" placeholder="Full name"
                style="width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">WhatsApp Number *</label>
              <input id="pl-phone" type="tel" placeholder="10-digit number" maxlength="10"
                style="width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Email (optional)</label>
              <input id="pl-email" type="email" placeholder="customer@email.com"
                style="width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Amount (₹) *</label>
              <input id="pl-amount" type="number" placeholder="e.g. 50000" min="1"
                style="width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Purpose / Description *</label>
              <input id="pl-desc" type="text" placeholder="e.g. Tile quotation advance, Invoice #VW-001"
                style="width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Invoice ID (optional)</label>
              <input id="pl-invoice" type="number" placeholder="Link to invoice"
                style="width:100%;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>

            <div style="display:flex;gap:10px;margin-top:4px;">
              <button onclick="VW_PAYMENT_LINKS.closeModal()"
                style="flex:1;padding:12px;border-radius:10px;background:#F8FAFC;border:1px solid #E2E8F0;font-size:14px;cursor:pointer;font-weight:600;">
                Cancel
              </button>
              <button id="pl-generate-btn" onclick="VW_PAYMENT_LINKS.generate()"
                style="flex:2;padding:12px;border-radius:10px;background:#F5A623;border:none;color:#0F1923;font-size:14px;cursor:pointer;font-weight:700;">
                Generate & Share on WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Success modal -->
      <div id="pl-success-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;margin:16px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">✅</div>
          <div style="font-size:20px;font-weight:700;margin-bottom:6px;">Payment Link Created!</div>
          <div style="font-size:14px;color:#64748B;margin-bottom:20px;">Opening WhatsApp to share with customer…</div>
          <div id="pl-link-display" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;font-size:13px;word-break:break-all;color:#374151;margin-bottom:16px;text-align:left;"></div>
          <div style="display:flex;gap:10px;">
            <button onclick="VW_PAYMENT_LINKS.copyLink()" id="pl-copy-btn"
              style="flex:1;padding:10px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0;font-size:13px;cursor:pointer;font-weight:600;">
              📋 Copy Link
            </button>
            <button onclick="VW_PAYMENT_LINKS.closeSuccess()"
              style="flex:1;padding:10px;border-radius:8px;background:#F5A623;border:none;color:#0F1923;font-size:13px;cursor:pointer;font-weight:700;">
              Done
            </button>
          </div>
        </div>
      </div>
    `;
  }

  let lastLink = null;
  let lastWAText = null;

  async function generate() {
    const name = document.getElementById('pl-name')?.value.trim();
    const phone = document.getElementById('pl-phone')?.value.trim().replace(/\D/g,'');
    const email = document.getElementById('pl-email')?.value.trim();
    const amount = document.getElementById('pl-amount')?.value;
    const desc = document.getElementById('pl-desc')?.value.trim();
    const invoiceId = document.getElementById('pl-invoice')?.value;

    if (!name) { showToast('Enter customer name'); return; }
    if (phone.length !== 10) { showToast('Enter valid 10-digit phone'); return; }
    if (!amount || parseFloat(amount) < 1) { showToast('Enter valid amount'); return; }
    if (!desc) { showToast('Enter payment purpose'); return; }

    const btn = document.getElementById('pl-generate-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

    try {
      const res = await fetch(SB_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'payment_link',
          amount: parseFloat(amount),
          customer_name: name,
          customer_phone: phone,
          customer_email: email || undefined,
          description: desc,
          invoice_id: invoiceId ? parseInt(invoiceId) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.payment_url) throw new Error(data.error || 'Failed to generate link');

      lastLink = data.payment_url;
      lastWAText = data.whatsapp_text;

      closeModal();
      showSuccessModal(data.payment_url, data.whatsapp_text, name, phone);

    } catch(e) {
      showToast('Error: ' + e.message);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Generate & Share on WhatsApp'; }
  }

  function showSuccessModal(url, waText, name, phone) {
    const modal = document.getElementById('pl-success-modal');
    const display = document.getElementById('pl-link-display');
    if (display) display.textContent = url;
    if (modal) modal.style.display = 'flex';

    // Auto-open WhatsApp
    const cleaned = phone.replace(/\D/g,'');
    setTimeout(() => {
      window.open(`https://wa.me/91${cleaned}?text=${encodeURIComponent(waText)}`, '_blank');
    }, 500);
  }

  function copyLink() {
    if (!lastLink) return;
    navigator.clipboard.writeText(lastLink).then(() => {
      const btn = document.getElementById('pl-copy-btn');
      if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy Link'; }, 2000); }
    });
  }

  function resendWA(url, name, amount, phone, desc, linkId) {
    const waText = `Hello ${name || ''}! 👋\n\nHere is your payment link for V Wholesale:\n\n💰 Amount: ₹${parseFloat(amount).toLocaleString('en-IN')}\n📋 ${desc || 'V Wholesale Payment'}\n\n🔗 Pay here: ${url}\n\nPay via UPI, Card, or Net Banking.\n\nThank you! 🙏\n— V Wholesale`;
    const cleaned = phone.replace(/\D/g,'');
    window.open(`https://wa.me/91${cleaned}?text=${encodeURIComponent(waText)}`, '_blank');
  }

  async function cancelLink(linkId) {
    if (!confirm('Cancel this payment link?')) return;
    await VW_DB.client.from('payment_links').update({ status: 'cancelled' }).eq('link_id', linkId);
    showToast('Link cancelled');
    navigateTo('payment_links');
  }

  function openGenerateModal() {
    const modal = document.getElementById('pl-modal');
    if (modal) { modal.style.display = 'flex'; }
    ['pl-name','pl-phone','pl-email','pl-amount','pl-desc','pl-invoice'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }

  function closeModal() {
    const modal = document.getElementById('pl-modal');
    if (modal) modal.style.display = 'none';
  }

  function closeSuccess() {
    const modal = document.getElementById('pl-success-modal');
    if (modal) modal.style.display = 'none';
    navigateTo('payment_links'); // refresh
  }

  // Called from invoice detail — pre-fill amount and invoice
  async function generateFromInvoice(invoiceId, amount, customerName, customerPhone) {
    await navigateTo('payment_links');
    setTimeout(() => {
      openGenerateModal();
      const nameEl = document.getElementById('pl-name');
      const phoneEl = document.getElementById('pl-phone');
      const amountEl = document.getElementById('pl-amount');
      const invoiceEl = document.getElementById('pl-invoice');
      const descEl = document.getElementById('pl-desc');
      if (nameEl) nameEl.value = customerName || '';
      if (phoneEl) phoneEl.value = (customerPhone || '').replace(/\D/g,'').slice(-10);
      if (amountEl) amountEl.value = amount || '';
      if (invoiceEl) invoiceEl.value = invoiceId || '';
      if (descEl) descEl.value = `Invoice payment — V Wholesale`;
    }, 300);
  }

  return { renderPage, generate, generateFromInvoice, openGenerateModal, closeModal, closeSuccess, copyLink, resendWA, cancelLink };
})();
