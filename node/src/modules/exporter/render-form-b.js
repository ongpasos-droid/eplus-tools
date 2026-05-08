/**
 * Renders an EACEA Application Form Part B (BB / LSII) as a .docx buffer
 * by feeding the official template (docs/templates/form_part_b_eacea_template.docx)
 * to docxtemplater.
 *
 * Phase 1 fills:
 *   · cover-page metadata (title, acronym, coordinator)
 *   · 16 narrative "Insert text" anchors mapped to Writer fields
 *
 * Phase 2 fills the dynamic-row tables:
 *   · 2.1.3 Staff
 *   · 2.1.5 Risks
 *   · 4.2 Work Packages (with nested Tasks, Milestones, Deliverables)
 *   · 4.2 Staff effort per WP
 *   · 4.2 Events meetings and mobility
 *   · 4.2 Timetable Gantt (24-month grid)
 *   · Annex List of previous projects
 *
 * Tables we don't have data for (Subcontracting, Staff effort per participant,
 * Estimated budget per WP) are left as the template's empty rows — they're
 * "n/a for prefixed Lump Sum Grants" anyway.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', '..', 'docs', 'templates', 'form_part_b_eacea_template.docx');

let cachedTemplateBuffer = null;
function loadTemplate() {
  if (!cachedTemplateBuffer) cachedTemplateBuffer = fs.readFileSync(TEMPLATE_PATH);
  return cachedTemplateBuffer;
}

// ── Plain-text normalization for narrative fields ──────────────────────────

function normalizeWriterText(text) {
  if (!text) return '';
  let s = String(text).replace(/\r\n/g, '\n');
  s = s
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, m => m.replace(/\s+$/, ' '));
  return s.trim();
}

// ── Data shaping helpers ───────────────────────────────────────────────────

function leaderName(ctx, leaderId) {
  if (!leaderId) return '';
  const p = ctx.partnerById[leaderId];
  return p ? (p.legal_name || p.name || '') : '';
}

function partnerCode(ctx, partnerId) {
  if (!partnerId) return '';
  const idx = ctx.partners.findIndex(p => p.id === partnerId);
  return idx >= 0 ? `P${idx + 1}` : '';
}

const blank = v => (v == null ? '' : String(v));

function buildStaff(ctx) {
  return (ctx.selectedStaff || []).map(s => ({
    staff_name_function: blank(s.full_name),
    staff_organisation: blank(s.partner_legal_name || s.partner_name),
    staff_role_tasks: blank(s.project_role || s.directory_role),
    staff_profile: blank(s.custom_skills && s.custom_skills.trim() ? s.custom_skills : s.directory_bio),
  }));
}

function buildRisks(ctx) {
  const wpCode = {};
  for (const w of (ctx.wps || [])) wpCode[w.id] = w.code || '';
  return (ctx.risks || []).map(r => ({
    risk_no: blank(r.risk_no),
    risk_description: [
      r.description || '',
      (r.impact || r.likelihood) ? `(Impact: ${r.impact || '—'}, Likelihood: ${r.likelihood || '—'})` : '',
    ].filter(Boolean).join(' '),
    risk_wp_code: r.wp_id ? blank(wpCode[r.wp_id]) : 'cross-cutting',
    risk_mitigation: blank(r.mitigation),
  }));
}

function buildWPs(ctx) {
  return (ctx.wps || []).map((wp, idx) => {
    const wpNum = idx + 1;
    const dur = `M${wp.duration_from_month || 1} - M${wp.duration_to_month || ctx.project.duration_months || '?'}`;
    return {
      wp_number: wpNum,
      wp_title: blank(wp.title || wp.code),
      wp_duration: dur,
      wp_lead: leaderName(ctx, wp.leader_id),
      wp_objectives: normalizeWriterText(wp.objectives || wp.summary || ''),
      tasks: (wp.tasks || []).map(t => ({
        task_no: blank(t.code),
        task_name: blank(t.title),
        task_description: blank(t.description),
        task_participant_name: leaderName(ctx, wp.leader_id),
        task_participant_role: 'COO',
        task_in_kind: blank(t.in_kind_subcontracting),
      })),
      milestones: (wp.milestones || []).map(m => ({
        ms_no: blank(m.code),
        ms_name: blank(m.title),
        ms_wp_no: wpNum,
        ms_lead: leaderName(ctx, m.lead_partner_id || wp.leader_id),
        ms_description: blank(m.description),
        ms_due: m.due_month != null ? `M${m.due_month}` : '',
        ms_verification: blank(m.verification),
      })),
      deliverables: (wp.deliverables || []).map(d => ({
        del_no: blank(d.code),
        del_name: blank(d.title),
        del_wp_no: wpNum,
        del_lead: leaderName(ctx, d.lead_partner_id || wp.leader_id),
        del_type: blank(d.type),
        del_dissemination: blank(d.dissemination_level),
        del_due: d.due_month != null ? `M${d.due_month}` : '',
        del_description: blank(d.description),
      })),
    };
  });
}

function buildWpsEffort(ctx) {
  return (ctx.wps || []).map((wp, idx) => ({
    eff_wp_no: idx + 1,
    eff_wp_title: blank(wp.title || wp.code),
    eff_lead_no: wp.leader_id ? (ctx.partners.findIndex(p => p.id === wp.leader_id) + 1 || '') : '',
    eff_lead_short: leaderName(ctx, wp.leader_id),
    eff_start: wp.duration_from_month != null ? `M${wp.duration_from_month}` : '',
    eff_end: wp.duration_to_month != null ? `M${wp.duration_to_month}` : '',
    eff_pm: '', // person-months not tracked at WP level in the DB
  }));
}

function buildEvents(ctx) {
  const re = /(meeting|mobility|workshop|conference|event|training)/i;
  const events = (ctx.activities || []).filter(a => re.test(`${a.type || ''} ${a.subtype || ''} ${a.label || ''}`));
  return events.map((a, i) => {
    const wp = (ctx.wps || []).find(w => w.id === a.wp_id);
    const wpNum = wp ? (ctx.wps.indexOf(wp) + 1) : '?';
    return {
      event_no: `E${wpNum}.${i + 1}`,
      event_participant: wp ? leaderName(ctx, wp.leader_id) : '',
      event_description: blank(a.description),
      event_name: blank(a.label),
      event_type: blank(a.subtype || a.type),
      event_area: '',
      event_location: a.online ? 'Online' : '',
      event_attendees: a.gantt_start_month != null ? `M${a.gantt_start_month} – M${a.gantt_end_month}` : '',
    };
  });
}

function buildGantt(ctx) {
  const months = 24; // template grid is 24 months (small projects)
  return (ctx.activities || []).map(a => {
    const wp = (ctx.wps || []).find(w => w.id === a.wp_id);
    const wpCode = wp ? wp.code : '?';
    const row = { gantt_activity: `${wpCode} · ${a.label || ''}`.trim() };
    const start = a.gantt_start_month || 0;
    const end = a.gantt_end_month || 0;
    for (let m = 1; m <= months; m++) {
      row[`gantt_m${m}`] = (start <= m && m <= end) ? '■' : '';
    }
    return row;
  });
}

function buildEuProjects(ctx) {
  return (ctx.euProjects || []).map(p => ({
    ep_participant: blank(p.partner_name),
    ep_reference: [p.reference_no, p.title].filter(Boolean).join(' — '),
    ep_period: blank(p.year),
    ep_role: blank(p.role),
    ep_amount: '',
    ep_website: '',
  }));
}

// ── Map ctx → flat placeholder object ──────────────────────────────────────

function buildPlaceholders(ctx) {
  const { project, partners, program, writer } = ctx;
  const coordinator = partners.find(p => p.role === 'applicant') || partners[0] || null;

  return {
    // Header watermark "Call: [identifier] — [name]"
    call_identifier: project.type || '',
    call_name: (program && program.name) || project.type || '',

    // Cover
    project_title: project.full_name || project.name || '',
    project_acronym: project.name || '',
    coordinator_name: coordinator ? (coordinator.legal_name || coordinator.name || '') : '',
    coordinator_org: coordinator ? (coordinator.legal_name || coordinator.name || '') : '',

    // 16 narrative sections
    s1_1_text: normalizeWriterText(writer.s1_1_text),
    s1_2_text: normalizeWriterText(writer.s1_2_text),
    s1_3_text: normalizeWriterText(writer.s1_3_text),
    s2_1_1_text: normalizeWriterText(writer.s2_1_1_text),
    s2_1_2_text: normalizeWriterText(writer.s2_1_2_text),
    s2_1_3_outside_text: normalizeWriterText(writer.s2_1_3_staff_table),
    s2_1_4_text: normalizeWriterText(writer.s2_1_4_text),
    s2_2_1_text: normalizeWriterText(writer.s2_2_1_text),
    s2_2_2_text: normalizeWriterText(writer.s2_2_2_text),
    s3_1_text: normalizeWriterText(writer.s3_1_text),
    s3_2_text: normalizeWriterText(writer.s3_2_text),
    s3_3_text: normalizeWriterText(writer.s3_3_text),
    s4_1_text: normalizeWriterText(writer.s4_1_text),
    subcontracting_other_text: '',
    s5_1_text: normalizeWriterText(writer.s5_1_text),
    s6_2_justification: normalizeWriterText(writer.s6_2_justification),

    // Phase 2 dynamic tables
    staff: buildStaff(ctx),
    risks: buildRisks(ctx),
    wps: buildWPs(ctx),
    wps_effort: buildWpsEffort(ctx),
    events: buildEvents(ctx),
    tasks_gantt: buildGantt(ctx),
    euProjects: buildEuProjects(ctx),
  };
}

// ── Public entry point ────────────────────────────────────────────────────

async function renderFormBDocx(ctx) {
  const buf = loadTemplate();
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(buildPlaceholders(ctx));
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { renderFormBDocx };
