import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "";

const sb = createClient(SB_URL, SB_KEY);

serve(async (req) => {
  // Allow manual trigger via POST with optional date param
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const reportDate = body.date || new Date().toISOString().split("T")[0];
  const forceRun = body.force || false;

  try {
    const report = await buildAllReports(reportDate);
    await deliverReports(report);
    return new Response(JSON.stringify({ success: true, date: reportDate, reports_sent: report.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Report error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

// ── Gather all data for the day ──
async function gatherDayData(date: string) {
  const dayStart = `${date}T00:00:00+05:30`;
  const dayEnd = `${date}T23:59:59+05:30`;

  // All field staff
  const { data: staffList } = await sb.from("staff")
    .select("id,name,designation,role,reporting_to,phone,department,vertical")
    .eq("department", "Field").eq("active", true);

  // Today's visits per rep
  const { data: visits } = await sb.from("field_visits")
    .select("id,staff_id,executive_name,site_address,construction_stage,project_type,estimated_sqft,estimated_value,visit_quality_score,ai_requirements,ai_stage_detected,ai_estimated_value_min,ai_estimated_value_max,converted_invoice_id,conversion_value,city,competitor_products,created_at,is_followup,next_action_date")
    .gte("created_at", dayStart).lte("created_at", dayEnd);

  // Attendance (punch in/out, km, fuel)
  const { data: attendance } = await sb.from("attendance")
    .select("staff_id,punch_in,punch_out,km_travelled,fuel_reimbursement,check_in_lat,check_in_lng,odo_in_reading,odo_out_reading")
    .gte("date", dayStart).lte("date", dayEnd);

  // Assignments completed vs pending today
  const { data: assignments } = await sb.from("field_visit_assignments")
    .select("assigned_to_staff_id,status,priority,site_name,scheduled_date")
    .eq("scheduled_date", date);

  // Alerts triggered today
  const { data: alerts } = await sb.from("field_alerts")
    .select("staff_id,alert_type,triggered_at,resolved_at,context")
    .gte("triggered_at", dayStart).lte("triggered_at", dayEnd);

  // Incentive rules for targets
  const { data: rules } = await sb.from("field_incentive_rules").select("*");

  // Overdue follow-ups (visits with next_action_date <= today not yet followed up)
  const { data: overdue } = await sb.from("field_visits")
    .select("id,staff_id,executive_name,site_address,next_action_date,customer_name")
    .lte("next_action_date", date).is("is_followup", null)
    .not("next_action_date", "is", null).limit(50);

  return { staffList: staffList || [], visits: visits || [], attendance: attendance || [],
           assignments: assignments || [], alerts: alerts || [], rules: rules || [], overdue: overdue || [] };
}

// ── Build per-rep summary ──
function buildRepSummary(staffId: number, data: any) {
  const staff = data.staffList.find((s: any) => s.id === staffId);
  const repVisits = data.visits.filter((v: any) => v.staff_id === staffId);
  const att = data.attendance.find((a: any) => a.staff_id === staffId);
  const repAlerts = data.alerts.filter((a: any) => a.staff_id === staffId);
  const repAssignments = data.assignments.filter((a: any) => a.assigned_to_staff_id === staffId);
  const repOverdue = data.overdue.filter((v: any) => v.staff_id === staffId);
  const rule = data.rules.find((r: any) => r.designation === (staff?.designation || staff?.role)) || data.rules[0];

  const target = rule?.daily_visit_target || 15;
  const newVisits = repVisits.filter((v: any) => !v.is_followup).length;
  const followupVisits = repVisits.filter((v: any) => v.is_followup).length;
  const totalVisits = repVisits.length;
  const avgQuality = repVisits.length ? Math.round(repVisits.reduce((s: number, v: any) => s + (v.visit_quality_score || 0), 0) / repVisits.length) : 0;
  const km = att?.km_travelled || 0;
  const fuelDue = att?.fuel_reimbursement || (km * (rule?.fuel_rate_per_km || 2.5));
  const conversions = repVisits.filter((v: any) => v.converted_invoice_id).length;
  const billing = repVisits.reduce((s: number, v: any) => s + (v.conversion_value || 0), 0);
  const punchedIn = !!att?.punch_in;
  const punchedOut = !!att?.punch_out;

  // AI requirements across all visits today
  const allRequirements = repVisits.flatMap((v: any) => v.ai_requirements || []);
  const reqCount: Record<string, number> = {};
  allRequirements.forEach((r: string) => { reqCount[r] = (reqCount[r] || 0) + 1; });
  const topRequirements = Object.entries(reqCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r);

  const stages: Record<string, number> = {};
  repVisits.forEach((v: any) => { if (v.construction_stage) stages[v.construction_stage] = (stages[v.construction_stage] || 0) + 1; });

  const competitors = [...new Set(repVisits.flatMap((v: any) => v.competitor_products || []))];
  const estimatedPipeline = repVisits.reduce((s: number, v: any) => s + (v.estimated_value || 0), 0);

  const hitTarget = totalVisits >= target;
  const tier = hitTarget ? (totalVisits >= target * 1.2 ? "🥇 Gold" : "🥈 Silver") : "🥉 Bronze";

  return {
    staff, totalVisits, newVisits, followupVisits, target, hitTarget, tier,
    avgQuality, km, fuelDue, conversions, billing, punchedIn, punchedOut,
    topRequirements, stages, competitors, estimatedPipeline,
    alerts: repAlerts, assignments: repAssignments, overdue: repOverdue,
    highValueVisits: repVisits.filter((v: any) => (v.estimated_value || 0) > 500000)
      .sort((a: any, b: any) => (b.estimated_value || 0) - (a.estimated_value || 0)).slice(0, 3),
  };
}

// ── AI narrative summary ──
async function generateAISummary(summaries: any[], level: string, date: string): Promise<string> {
  const dataStr = JSON.stringify(summaries.map(s => ({
    name: s.staff?.name,
    designation: s.staff?.designation || s.staff?.role,
    visits: s.totalVisits,
    target: s.target,
    hitTarget: s.hitTarget,
    quality: s.avgQuality,
    km: s.km,
    billing: s.billing,
    pipeline: s.estimatedPipeline,
    requirements: s.topRequirements,
    competitors: s.competitors,
    alerts: s.alerts?.length,
    overdue: s.overdue?.length,
  })));

  const systemPrompt = level === "management"
    ? "You are a business intelligence AI for V Wholesale, a Vijayawada home building materials company. Write a concise, insightful management briefing about field team performance. Be direct, highlight risks and opportunities. 3-4 sentences max. Use numbers."
    : "You are a field team performance coach at V Wholesale. Write a brief, motivating performance note for a team leader about their team. 2-3 sentences. Practical and encouraging.";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 200,
      messages: [{ role: "user", content: `Date: ${date}\nField team data: ${dataStr}\n\nWrite the ${level} briefing.` }],
      system: systemPrompt,
    }),
  });
  const json = await resp.json();
  return json.content?.[0]?.text || "AI analysis unavailable today.";
}

// ── Format email HTML ──
function buildManagementEmail(summaries: any[], aiSummary: string, date: string): string {
  const totalVisits = summaries.reduce((s, r) => s + r.totalVisits, 0);
  const totalBilling = summaries.reduce((s, r) => s + r.billing, 0);
  const totalPipeline = summaries.reduce((s, r) => s + r.estimatedPipeline, 0);
  const totalFuel = summaries.reduce((s, r) => s + r.fuelDue, 0);
  const hitters = summaries.filter(r => r.hitTarget).length;
  const allRequirements = summaries.flatMap(r => r.topRequirements);
  const reqCount: Record<string, number> = {};
  allRequirements.forEach(r => { reqCount[r] = (reqCount[r] || 0) + 1; });
  const topProducts = Object.entries(reqCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const repRows = summaries.map(r => `
    <tr style="border-bottom:1px solid #E2E8F0;">
      <td style="padding:10px 8px;font-weight:600;">${r.staff?.name || "—"}</td>
      <td style="padding:10px 8px;font-size:12px;color:#64748B;">${r.staff?.designation || r.staff?.role || "—"}</td>
      <td style="padding:10px 8px;text-align:center;">
        <span style="font-weight:700;color:${r.hitTarget ? "#16a34a" : "#dc2626"};">${r.totalVisits}</span>
        <span style="color:#94A3B8;font-size:11px;">/${r.target}</span>
      </td>
      <td style="padding:10px 8px;text-align:center;color:${r.avgQuality >= 80 ? "#16a34a" : r.avgQuality >= 60 ? "#d97706" : "#dc2626"};font-weight:600;">${r.avgQuality}%</td>
      <td style="padding:10px 8px;text-align:center;">${r.km.toFixed(0)} km</td>
      <td style="padding:10px 8px;text-align:center;font-weight:600;">₹${(r.estimatedPipeline/100000).toFixed(1)}L</td>
      <td style="padding:10px 8px;text-align:center;">${r.tier}</td>
      <td style="padding:10px 8px;text-align:center;">${r.punchedIn ? (r.punchedOut ? "✓ Out" : "⏳ In") : "✗ Absent"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:700px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0F1923 0%,#1A2634 100%);border-radius:16px;padding:24px 28px;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
      <div style="background:#F5A623;color:#0F1923;font-weight:800;font-size:14px;padding:4px 10px;border-radius:6px;">VW FIELD</div>
      <div style="color:#8FA3B8;font-size:13px;">Daily Performance Report</div>
    </div>
    <div style="color:#F0F4F8;font-size:22px;font-weight:700;margin-top:8px;">
      ${new Date(date).toLocaleDateString("en-IN", {weekday:"long",day:"numeric",month:"long",year:"numeric"})}
    </div>
  </div>

  <!-- AI Briefing -->
  <div style="background:#FEF9EC;border:1px solid #F5A623;border-left:4px solid #F5A623;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#B45309;letter-spacing:.06em;margin-bottom:6px;">🤖 AI MANAGEMENT BRIEFING</div>
    <div style="font-size:14px;color:#1E293B;line-height:1.6;">${aiSummary}</div>
  </div>

  <!-- KPI Cards -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#0F1923;">${totalVisits}</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px;">Total Visits</div>
      <div style="font-size:11px;color:${hitters === summaries.length ? "#16a34a" : "#d97706"};margin-top:4px;">${hitters}/${summaries.length} hit target</div>
    </div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#F5A623;">₹${(totalPipeline/100000).toFixed(1)}L</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px;">Pipeline Value</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:4px;">from today's sites</div>
    </div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#16a34a;">₹${(totalBilling/100000).toFixed(1)}L</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px;">Converted Billing</div>
      <div style="font-size:11px;color:#64748B;margin-top:4px;">₹${totalFuel.toFixed(0)} fuel due</div>
    </div>
  </div>

  <!-- Rep Performance Table -->
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
    <div style="padding:14px 20px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#0F1923;">Team Performance</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">NAME</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748B;font-weight:600;">ROLE</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;">VISITS</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;">QUALITY</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;">KM</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;">PIPELINE</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;">TIER</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;">ATTENDANCE</th>
          </tr>
        </thead>
        <tbody>${repRows}</tbody>
      </table>
    </div>
  </div>

  <!-- Top Products Spotted -->
  ${topProducts.length ? `
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
    <div style="font-weight:700;color:#0F1923;margin-bottom:10px;">Top Requirements Spotted Today</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${topProducts.map(([r, c]) => `<div style="padding:4px 12px;border-radius:20px;background:#F0FFF4;border:1px solid #86EFAC;color:#166534;font-size:13px;font-weight:600;">${r} <span style="color:#94A3B8;">(${c})</span></div>`).join("")}
    </div>
  </div>` : ""}

  <!-- Footer -->
  <div style="text-align:center;color:#94A3B8;font-size:12px;padding:16px 0;">
    V Wholesale Field Intelligence · Auto-generated at 8:00 PM IST · ${date}<br>
    <a href="https://vwholesale.in/admin" style="color:#F5A623;">View full dashboard →</a>
  </div>
</div>
</body></html>`;
}

function buildTLEmail(tlSummary: any, repSummaries: any[], aiSummary: string, date: string): string {
  const repRows = repSummaries.map(r => `
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:700;font-size:15px;color:#0F1923;">${r.staff?.name}</div>
          <div style="font-size:12px;color:#64748B;">${r.staff?.designation || r.staff?.role}</div>
        </div>
        <div style="font-size:20px;">${r.tier.split(" ")[0]}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;text-align:center;">
        <div><div style="font-size:18px;font-weight:800;color:${r.hitTarget?"#16a34a":"#dc2626"};">${r.totalVisits}/${r.target}</div><div style="font-size:10px;color:#94A3B8;">Visits</div></div>
        <div><div style="font-size:18px;font-weight:800;color:#d97706;">${r.avgQuality}%</div><div style="font-size:10px;color:#94A3B8;">Quality</div></div>
        <div><div style="font-size:18px;font-weight:800;">${r.km.toFixed(0)}</div><div style="font-size:10px;color:#94A3B8;">km</div></div>
        <div><div style="font-size:18px;font-weight:800;color:#7C3AED;">₹${(r.estimatedPipeline/100000).toFixed(1)}L</div><div style="font-size:10px;color:#94A3B8;">Pipeline</div></div>
      </div>
      ${r.overdue.length ? `<div style="margin-top:8px;padding:6px 10px;background:#FEF2F2;border-radius:6px;font-size:12px;color:#B91C1C;">⚠️ ${r.overdue.length} overdue follow-up${r.overdue.length>1?"s":""}</div>` : ""}
      ${r.topRequirements.length ? `<div style="margin-top:8px;font-size:12px;color:#64748B;">Top needs: ${r.topRequirements.join(" · ")}</div>` : ""}
    </div>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px 16px;">
  <div style="background:linear-gradient(135deg,#0F1923,#1A2634);border-radius:14px;padding:20px 24px;margin-bottom:16px;">
    <div style="color:#F5A623;font-weight:700;font-size:13px;">VW FIELD · Team Report</div>
    <div style="color:#F0F4F8;font-size:18px;font-weight:700;margin-top:4px;">Hi ${tlSummary.staff?.name?.split(" ")[0]}, here's your team's day 👋</div>
    <div style="color:#8FA3B8;font-size:12px;margin-top:2px;">${new Date(date).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
  </div>
  <div style="background:#FEF9EC;border-left:4px solid #F5A623;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#1E293B;">${aiSummary}</div>
  ${repRows}
  <div style="text-align:center;color:#94A3B8;font-size:11px;margin-top:16px;">V Wholesale · Auto-report 8 PM IST · ${date}</div>
</div></body></html>`;
}

function buildRepEmail(summary: any, date: string): string {
  const assignmentsToday = summary.assignments.filter((a: any) => a.status !== "cancelled");
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:500px;margin:0 auto;padding:20px 16px;">
  <div style="background:linear-gradient(135deg,#0F1923,#1A2634);border-radius:14px;padding:20px 24px;margin-bottom:16px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">${summary.hitTarget ? "🎯" : "💪"}</div>
    <div style="color:#F5A623;font-weight:700;font-size:16px;">Your Day — ${new Date(date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div>
    <div style="color:#F0F4F8;font-size:24px;font-weight:800;margin-top:4px;">Hi ${summary.staff?.name?.split(" ")[0]}!</div>
  </div>

  <!-- Score card -->
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:12px;text-align:center;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <div style="font-size:40px;font-weight:800;color:${summary.hitTarget?"#16a34a":"#dc2626"};">${summary.totalVisits}</div>
        <div style="color:#64748B;font-size:13px;">visits today</div>
        <div style="color:#94A3B8;font-size:11px;">target: ${summary.target}</div>
      </div>
      <div>
        <div style="font-size:40px;font-weight:800;color:${summary.avgQuality>=80?"#16a34a":summary.avgQuality>=60?"#d97706":"#dc2626"};">${summary.avgQuality}%</div>
        <div style="color:#64748B;font-size:13px;">avg quality</div>
        <div style="color:#94A3B8;font-size:11px;">${summary.avgQuality>=80?"Excellent 🌟":summary.avgQuality>=60?"Good 👍":"Needs work 📈"}</div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;">${summary.km.toFixed(0)} km</div>
        <div style="color:#64748B;font-size:13px;">travelled</div>
        <div style="color:#94A3B8;font-size:11px;">₹${summary.fuelDue.toFixed(0)} fuel due</div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;color:#7C3AED;">₹${(summary.estimatedPipeline/100000).toFixed(1)}L</div>
        <div style="color:#64748B;font-size:13px;">pipeline built</div>
        <div style="color:#94A3B8;font-size:11px;">today's sites</div>
      </div>
    </div>
    <div style="margin-top:16px;padding:10px;background:${summary.hitTarget?"#F0FFF4":"#FFF7ED"};border-radius:8px;font-weight:700;color:${summary.hitTarget?"#16a34a":"#d97706"};">
      ${summary.tier} ${summary.hitTarget?"— Target achieved! 🎉":"— Keep pushing!"}
    </div>
  </div>

  ${summary.overdue.length ? `
  <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
    <div style="font-weight:700;color:#B91C1C;margin-bottom:6px;">⚠️ ${summary.overdue.length} Overdue Follow-up${summary.overdue.length>1?"s":""}</div>
    ${summary.overdue.slice(0,3).map((v: any) => `<div style="font-size:13px;color:#7F1D1D;margin-top:4px;">• ${v.site_address||v.customer_name||"Site"} — due ${v.next_action_date}</div>`).join("")}
  </div>` : ""}

  ${assignmentsToday.length ? `
  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
    <div style="font-weight:700;color:#1D4ED8;margin-bottom:6px;">📋 Tomorrow's Assignments (${assignmentsToday.filter((a:any)=>a.status==="pending").length} pending)</div>
    ${assignmentsToday.slice(0,3).map((a: any) => `<div style="font-size:13px;color:#1E3A8A;margin-top:4px;">• ${a.site_name||"Site visit"} — ${a.priority}</div>`).join("")}
  </div>` : ""}

  <div style="text-align:center;color:#94A3B8;font-size:11px;margin-top:16px;">V Wholesale Field · Auto-report · ${date}<br>Keep building. Every site counts. 💪</div>
</div></body></html>`;
}

// ── WhatsApp message (text, under 1600 chars) ──
function buildWAMessage(summary: any, level: string, date: string): string {
  const dateStr = new Date(date).toLocaleDateString("en-IN", {weekday:"short",day:"numeric",month:"short"});
  if (level === "management") {
    const total = summary.reduce((s: number, r: any) => s + r.totalVisits, 0);
    const pipeline = summary.reduce((s: number, r: any) => s + r.estimatedPipeline, 0);
    const hitters = summary.filter((r: any) => r.hitTarget).length;
    return `*V Wholesale Field Report — ${dateStr}*\n\n` +
      `📊 *Team Summary*\n` +
      `• Total visits: *${total}*\n` +
      `• Target hit: *${hitters}/${summary.length}* reps\n` +
      `• Pipeline: *₹${(pipeline/100000).toFixed(1)}L*\n\n` +
      `*Individual Performance:*\n` +
      summary.map((r: any) => `${r.hitTarget?"✅":"❌"} ${r.staff?.name}: ${r.totalVisits}/${r.target} visits | ${r.avgQuality}% quality | ${r.km.toFixed(0)}km`).join("\n") +
      `\n\n_View full report: vwholesale.in/admin_`;
  } else if (level === "tl") {
    return `*Your Team Report — ${dateStr}*\n\n` +
      summary.map((r: any) => `${r.hitTarget?"🎯":"📍"} *${r.staff?.name}*: ${r.totalVisits}/${r.target} visits | Quality ${r.avgQuality}% | ${r.km.toFixed(0)}km${r.overdue.length?"\n   ⚠️ "+r.overdue.length+" overdue follow-up":""}`) .join("\n\n");
  } else {
    const s = summary;
    return `*Your Field Report — ${dateStr}*\n\n` +
      `${s.hitTarget?"🎯 Target achieved!":"💪 Keep going!"}\n\n` +
      `• Visits: *${s.totalVisits}/${s.target}*\n` +
      `• Quality: *${s.avgQuality}%*\n` +
      `• Distance: *${s.km.toFixed(0)} km*\n` +
      `• Fuel due: *₹${s.fuelDue.toFixed(0)}*\n` +
      `• Pipeline: *₹${(s.estimatedPipeline/100000).toFixed(1)}L*\n` +
      `• Tier: ${s.tier}\n` +
      (s.overdue.length ? `\n⚠️ ${s.overdue.length} follow-up${s.overdue.length>1?"s":""} overdue` : "") +
      `\n\n_V Wholesale Field App_`;
  }
}

// ── Send email via Resend ──
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY || !to || !to.includes("@")) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "VW Field Reports <field@vwholesale.in>", to, subject, html }),
  });
}

// ── Send WhatsApp ──
async function sendWA(phone: string, message: string) {
  if (!WA_TOKEN || !WA_PHONE_ID || !phone) return;
  const cleaned = phone.replace(/\D/g, "");
  const waPhone = cleaned.startsWith("91") ? cleaned : "91" + cleaned;
  await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: waPhone,
      type: "text", text: { body: message },
    }),
  });
}

// ── Main: build + deliver all reports ──
async function buildAllReports(date: string) {
  const data = await gatherDayData(date);
  if (!data.staffList.length) return [];

  const allSummaries = data.staffList.map(s => buildRepSummary(s.id, data));

  // Build report packages per recipient
  const reports = [];

  // 1. Management report (Himansu) — everyone
  const mgmtAI = await generateAISummary(allSummaries, "management", date);
  reports.push({
    recipient: { name: "Himansu R Mehta", phone: "9038010175", email: "himansu@vwholesale.in" },
    level: "management",
    summaries: allSummaries,
    aiSummary: mgmtAI,
    email_html: buildManagementEmail(allSummaries, mgmtAI, date),
    wa_text: buildWAMessage(allSummaries, "management", date),
    subject: `Field Report ${date} — ${allSummaries.reduce((s,r)=>s+r.totalVisits,0)} visits | ₹${(allSummaries.reduce((s,r)=>s+r.estimatedPipeline,0)/100000).toFixed(1)}L pipeline`,
  });

  // 2. TL reports — each TL gets their team
  const tls = data.staffList.filter(s => {
    const r = (s.designation || s.role || "").toLowerCase();
    return r.includes("team leader") || r.includes("tl");
  });

  for (const tl of tls) {
    const directReports = data.staffList.filter(s => s.reporting_to === String(tl.id));
    if (!directReports.length) continue;
    const teamSummaries = directReports.map(s => buildRepSummary(s.id, data));
    const tlSummary = allSummaries.find(s => s.staff?.id === tl.id) || buildRepSummary(tl.id, data);
    const tlAI = await generateAISummary(teamSummaries, "tl", date);
    reports.push({
      recipient: { name: tl.name, phone: tl.phone, email: null },
      level: "tl",
      summaries: teamSummaries,
      aiSummary: tlAI,
      email_html: buildTLEmail(tlSummary, teamSummaries, tlAI, date),
      wa_text: buildWAMessage(teamSummaries, "tl", date),
      subject: `Your Team Report — ${date}`,
    });
  }

  // 3. Individual rep reports
  const reps = data.staffList.filter(s => {
    const r = (s.designation || s.role || "").toLowerCase();
    return r.includes("field exec") || r.includes("mapping");
  });
  for (const rep of reps) {
    const summary = allSummaries.find(s => s.staff?.id === rep.id) || buildRepSummary(rep.id, data);
    reports.push({
      recipient: { name: rep.name, phone: rep.phone, email: null },
      level: "rep",
      summaries: [summary],
      email_html: buildRepEmail(summary, date),
      wa_text: buildWAMessage(summary, "rep", date),
      subject: `Your Field Report — ${date}`,
    });
  }

  return reports;
}

async function deliverReports(reports: any[]) {
  for (const r of reports) {
    // Email
    if (r.recipient.email) await sendEmail(r.recipient.email, r.subject, r.email_html);
    // WhatsApp
    if (WA_TOKEN && r.recipient.phone) await sendWA(r.recipient.phone, r.wa_text);

    // Log to DB
    await sb.from("email_log").insert({
      recipient_name: r.recipient.name,
      recipient_email: r.recipient.email || null,
      subject: r.subject,
      status: "sent",
      type: "daily_field_report",
    }).catch(() => {});
  }
}
