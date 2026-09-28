// TA/DA Weekly Report — triggers every 8th day from staff joining date
// Sends to accounts@vwholesale.in + hmehta@vwholesale.in
// Deploy: supabase functions deploy ta-da-report --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL   = Deno.env.get("SUPABASE_URL")!;
const SB_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND   = Deno.env.get("RESEND_API_KEY")!;
const sb       = createClient(SB_URL, SB_KEY);

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const body = req.method === "POST" ? await req.json().catch(()=>({})) : {};
  const forceStaffId = body.staff_id; // for manual trigger

  try {
    // Get all active field staff
    const { data: staffList } = await sb.from("staff")
      .select("id,name,designation,created_at,phone")
      .eq("department", "Field").eq("active", true);

    const today = new Date();
    const reports = [];

    for (const staff of (staffList||[])) {
      const joinDate = new Date(staff.created_at);
      const daysSinceJoin = Math.floor((today.getTime() - joinDate.getTime()) / (24*60*60*1000));
      
      // Check if today is the 8th day of a 7-day cycle (day 8, 15, 22, 29...)
      const isReportDay = (daysSinceJoin % 7 === 0) || forceStaffId === staff.id;
      if (!isReportDay && !body.force) continue;

      // Calculate cycle dates (last 7 days)
      const cycleEnd = new Date(today); cycleEnd.setDate(cycleEnd.getDate() - 1);
      const cycleStart = new Date(cycleEnd); cycleStart.setDate(cycleStart.getDate() - 6);
      
      const cycleStartStr = cycleStart.toISOString().split("T")[0];
      const cycleEndStr = cycleEnd.toISOString().split("T")[0];

      // Get attendance for this cycle
      const { data: attendance } = await sb.from("attendance")
        .select("date,punch_in,punch_out,km_travelled,fuel_reimbursement")
        .eq("staff_id", staff.id)
        .gte("date", cycleStartStr)
        .lte("date", cycleEndStr)
        .order("date", { ascending: true });

      const totalKm = (attendance||[]).reduce((s,a) => s + (a.km_travelled||0), 0);
      const grossFuel = totalKm * 2.5;
      const daysActive = (attendance||[]).filter(a=>a.punch_in).length;

      // Get previous cycle balance (carry forward)
      const { data: prevCycles } = await sb.from("ta_da_cycles")
        .select("net_payable,advance_paid")
        .eq("staff_id", staff.id)
        .eq("status", "pending")
        .order("cycle_start", { ascending: false })
        .limit(5);
      
      const totalPrevBalance = (prevCycles||[]).reduce((s,c) => s + parseFloat(c.net_payable||0), 0);
      const netPayable = grossFuel + totalPrevBalance; // positive = company owes staff, negative = staff owes company

      // Save cycle record
      const { data: cycle } = await sb.from("ta_da_cycles").insert({
        staff_id: staff.id,
        staff_name: staff.name,
        cycle_start: cycleStartStr,
        cycle_end: cycleEndStr,
        total_km: totalKm,
        fuel_rate_per_km: 2.5,
        gross_fuel: grossFuel,
        advance_paid: 0,
        net_payable: netPayable,
        status: "pending",
        notes: `Auto-generated weekly cycle. ${daysActive} days active, ${totalKm}km.`,
      }).select("id").single();

      // Build email
      const subject = `TA/DA Report — ${staff.name} | Cycle ${cycleStartStr} to ${cycleEndStr}`;
      
      const attendanceRows = (attendance||[]).map(a => {
        const km = a.km_travelled||0;
        const fuel = a.fuel_reimbursement||0;
        return `<tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:8px 12px;">${new Date(a.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</td>
          <td style="padding:8px 12px;">${a.punch_in?new Date(a.punch_in).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
          <td style="padding:8px 12px;">${a.punch_out?new Date(a.punch_out).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
          <td style="padding:8px 12px;text-align:right;">${km?km.toFixed(0)+' km':'—'}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:600;color:${fuel>0?'#22C55E':'#64748B'};">${fuel>0?'₹'+fuel.toFixed(0):'₹0'}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <div style="background:linear-gradient(135deg,#0F1923,#1A2634);border-radius:14px;padding:20px 24px;margin-bottom:20px;">
    <div style="color:#F5A623;font-weight:700;font-size:13px;">V WHOLESALE — TA/DA REPORT</div>
    <div style="color:#F0F4F8;font-size:20px;font-weight:800;margin-top:4px;">${staff.name}</div>
    <div style="color:#8FA3B8;font-size:12px;margin-top:2px;">${staff.designation} · Cycle: ${cycleStartStr} → ${cycleEndStr}</div>
  </div>

  <!-- Summary -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;font-weight:800;">${daysActive}</div>
      <div style="font-size:12px;color:#64748B;">Days Active</div>
    </div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;font-weight:800;">${totalKm.toFixed(0)} km</div>
      <div style="font-size:12px;color:#64748B;">Total Distance</div>
    </div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#22C55E;">₹${grossFuel.toFixed(0)}</div>
      <div style="font-size:12px;color:#64748B;">Fuel Earned</div>
    </div>
  </div>

  <!-- Carry forward balance -->
  ${totalPrevBalance !== 0 ? `
  <div style="background:${totalPrevBalance>0?'#FEF9EC':'#FEF2F2'};border:1px solid ${totalPrevBalance>0?'#F5A623':'#FECACA'};border-radius:10px;padding:14px;margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:${totalPrevBalance>0?'#B45309':'#B91C1C'};">
      ${totalPrevBalance>0?'↩ Balance carried forward (company owes staff)':'↩ Advance balance (staff owes company)'}
    </div>
    <div style="font-size:18px;font-weight:800;color:${totalPrevBalance>0?'#F5A623':'#EF4444'};">₹${Math.abs(totalPrevBalance).toFixed(0)}</div>
  </div>` : ''}

  <!-- Net payable -->
  <div style="background:${netPayable>=0?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};border:1px solid ${netPayable>=0?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'};border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;">
    <div style="font-size:12px;font-weight:700;color:#374151;">${netPayable>=0?'✅ PAY TO EMPLOYEE':'⚠️ ADVANCE ALREADY COVERS THIS CYCLE'}</div>
    <div style="font-size:32px;font-weight:800;color:${netPayable>=0?'#22C55E':'#EF4444'};">₹${Math.abs(netPayable).toFixed(0)}</div>
    <div style="font-size:12px;color:#64748B;">Net ${netPayable>=0?'payable to '+staff.name:'credit (carry to next cycle)'}</div>
  </div>

  <!-- Attendance table -->
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <div style="padding:12px 16px;font-weight:700;border-bottom:1px solid #E2E8F0;">Daily Attendance</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#F8FAFC;font-size:11px;color:#64748B;">
        <th style="padding:8px 12px;text-align:left;">DATE</th>
        <th style="padding:8px 12px;text-align:left;">IN</th>
        <th style="padding:8px 12px;text-align:left;">OUT</th>
        <th style="padding:8px 12px;text-align:right;">KM</th>
        <th style="padding:8px 12px;text-align:right;">FUEL</th>
      </tr></thead>
      <tbody>${attendanceRows||'<tr><td colspan="5" style="padding:16px;text-align:center;color:#94A3B8;">No attendance records</td></tr>'}</tbody>
      <tfoot><tr style="background:#F8FAFC;font-weight:700;">
        <td style="padding:10px 12px;" colspan="3">TOTAL</td>
        <td style="padding:10px 12px;text-align:right;">${totalKm.toFixed(0)} km</td>
        <td style="padding:10px 12px;text-align:right;color:#22C55E;">₹${grossFuel.toFixed(0)}</td>
      </tfoot>
    </table>
  </div>

  <div style="text-align:center;color:#94A3B8;font-size:11px;">
    V Wholesale · Auto-generated every 7 days · Ref: Cycle #${cycle?.id||'—'}<br>
    Please process payment and reply to confirm.
  </div>
</div>
</body></html>`;

      // Send email
      if (RESEND) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "V Wholesale HR <onboarding@resend.dev>",
            to: ["accounts@vwholesale.in", "hmehta@vwholesale.in"],
            subject,
            html,
          }),
        });

        // Mark as email sent
        if (cycle?.id) {
          await sb.from("ta_da_cycles").update({ status: "email_sent", email_sent_at: new Date().toISOString() }).eq("id", cycle.id);
        }
      }

      reports.push({ staff: staff.name, cycle: `${cycleStartStr} to ${cycleEndStr}`, km: totalKm, gross_fuel: grossFuel, net_payable: netPayable });
    }

    return new Response(JSON.stringify({ success: true, reports_sent: reports.length, reports }), {
      headers: { ...cors, "content-type": "application/json" },
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
