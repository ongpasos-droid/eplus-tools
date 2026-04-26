/* ═══════════════════════════════════════════════════════════════
   Developer (Write) — Cascade proposal writer
   Phase 1: Context  |  Phase 12: Budget  |  Phase 15: Prep Studio
   Phase 2: Escribir (cascade)  |  Phase 4: Review
   ═══════════════════════════════════════════════════════════════ */

const Developer = (() => {

  let currentProject = null;
  let currentInstance = null;
  let templateJson = null;
  let fieldValues = {};
  let flatSections = [];
  let activeFieldId = null;
  let phase = 0; // 0=list, 1=context, 2=escribir(cascade), 4=review
  let contextData = null;
  let evalCriteria = [];
  let _saveTimer = null;
  let _typingTimer = null;
  let prepSubTab = 'consorcio'; // default sub-tab in Prep Studio
  let prepCache = {};          // cached data per sub-tab to avoid re-fetching

  // Cascade writing state
  let cascadeIndex = 0;
  let cascadeApproved = {};  // { fieldId: true }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(v) {
    if (!v) return '\u2014';
    const s = typeof v === 'string' ? v.slice(0, 10) : '';
    if (!s) return '\u2014';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  function wordCount(text) { return text ? text.trim().split(/\s+/).filter(Boolean).length : 0; }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    phase = 0;
    loadProjects();
  }

  /* ── Phase 0: Project list ─────────────────────────────────── */
  async function loadProjects() {
    const el = document.getElementById('developer-content');
    if (!el) return;
    el.innerHTML = '<p class="text-sm text-on-surface-variant py-8 text-center">Cargando proyectos...</p>';

    try {
      const result = await API.get('/intake/projects');
      const all = Array.isArray(result) ? result : (result.data || result);
      const projects = (all || []).filter(p => p.status === 'writing' || p.status === 'evaluating');

      if (!projects.length) {
        el.innerHTML = `
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <span class="material-symbols-outlined text-5xl text-outline-variant/40 mb-4">draft</span>
            <h3 class="font-headline text-lg font-bold text-primary mb-2">No tienes proyectos listos para escribir</h3>
            <p class="text-sm text-on-surface-variant mb-6 max-w-sm">Completa el diseno de un proyecto en Intake y pulsa "Comenzar a escribir" para verlo aqui.</p>
            <button type="button" onclick="location.hash='create'"
              class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-md transition-all">
              <span class="material-symbols-outlined text-lg">add</span> Disenar proyecto
            </button>
          </div>`;
        return;
      }

      el.innerHTML = `
        <h1 class="font-headline text-2xl font-extrabold text-primary mb-2">Escribir propuesta</h1>
        <p class="text-sm text-on-surface-variant mb-6">Selecciona un proyecto para redactar su propuesta.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${projects.map(p => `
          <div class="dev-card bg-white rounded-2xl border-2 border-outline-variant/20 hover:border-purple-400 p-5 cursor-pointer transition-all hover:shadow-lg group" data-id="${esc(p.id)}">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <span class="material-symbols-outlined text-purple-600 text-xl">description</span>
              </div>
              <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-200">${p.status === 'writing' ? 'Escribiendo' : 'Evaluando'}</span>
            </div>
            <h3 class="font-headline text-base font-bold text-on-surface mb-1 truncate group-hover:text-purple-700 transition-colors">${esc(p.name)}</h3>
            <p class="text-xs text-on-surface-variant mb-3">${esc(p.type || '')}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-on-surface-variant">${fmtDate(p.updated_at || p.created_at)}</span>
              <span class="inline-flex items-center gap-1 text-xs font-bold text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Escribir <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </span>
            </div>
          </div>
        `).join('')}
        </div>`;

      el.querySelectorAll('.dev-card').forEach(card => {
        card.addEventListener('click', () => openProject(card.dataset.id));
      });
    } catch (err) {
      console.error('Developer.loadProjects:', err);
      el.innerHTML = '<p class="text-sm text-error py-8 text-center">Error al cargar proyectos</p>';
    }
  }

  /* ── Open project → Phase 1 ────────────────────────────────── */
  async function openProject(projectId) {
    const el = document.getElementById('developer-content');
    el.innerHTML = '<div class="flex items-center justify-center py-16"><div class="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>';

    try {
      // Load context + instance + values in parallel
      const [ctx, instance] = await Promise.all([
        API.get('/developer/projects/' + projectId + '/context'),
        API.post('/developer/projects/' + projectId + '/instance', {}),
      ]);

      contextData = ctx;
      currentProject = ctx.project;
      currentInstance = instance;
      window.__projectNA = currentProject?.national_agency || null;
      window.__projectLang = currentProject?.proposal_lang || null;

      // Parse template. Pass the project's Work Packages so section 4.2 can
      // spawn one cascade step per WP (dynamic count based on Intake data)
      // instead of a single monolithic section.
      const projectWps = (ctx && Array.isArray(ctx.wps)) ? ctx.wps : [];
      if (instance.template_json) {
        templateJson = typeof instance.template_json === 'string' ? JSON.parse(instance.template_json) : instance.template_json;
        flatSections = flattenSections(templateJson, projectWps);
      }

      // Load persisted field values so refreshing the page doesn't lose work
      try {
        fieldValues = await API.get('/developer/instances/' + instance.id + '/values') || {};
      } catch (e) {
        console.error('Could not load saved field values:', e);
        fieldValues = {};
      }

      // Restore approval state (persisted in value_json.reviewed)
      cascadeApproved = {};
      for (const [fieldId, val] of Object.entries(fieldValues)) {
        if (val && val.json && val.json.reviewed) cascadeApproved[fieldId] = true;
      }
      cascadeIndex = 0;  // renderPhase2() auto-jumps to first non-approved section

      // Load eval criteria
      try { evalCriteria = await API.get('/developer/eval-criteria'); } catch (e) { evalCriteria = []; }

      renderGanttPhase();
    } catch (err) {
      console.error('Developer.openProject:', err);
      el.innerHTML = '<p class="text-sm text-error py-8 text-center">Error al abrir proyecto: ' + esc(err.message || err) + '</p>';
    }
  }

  /* ── Flatten template sections into linear list ────────────── */
  // `wps` is the array of Work Packages defined in Intake for this project.
  // When a subsection contains `work_package_template`, we spawn one cascade
  // step per WP instead of a single monolithic section.
  function flattenSections(tmpl, wps) {
    wps = wps || [];
    const flat = [];
    for (const sec of (tmpl.sections || [])) {
      // Collect all subsections — handle both direct subsections and subsections_groups
      const allSubs = [];
      if (sec.subsections) {
        for (const sub of sec.subsections) allSubs.push({ sub, parent: sec.title, parentNumber: sec.number });
      }
      if (sec.subsections_groups) {
        for (const group of sec.subsections_groups) {
          if (group.subsections) {
            for (const sub of group.subsections) allSubs.push({ sub, parent: sec.title + ' — ' + group.title, parentNumber: group.number });
          }
        }
      }
      for (const { sub, parent, parentNumber } of allSubs) {
        // Dynamic expansion for Work Package template subsections (sec_4_2).
        // Spawns one cascade step per WP defined in Intake.
        if (sub.work_package_template && wps.length) {
          wps.forEach((wp, idx) => {
            const label = (wp.code || ('WP' + (idx + 1))) + ' — ' + (wp.title || 'Work Package');
            flat.push({
              id: sub.id + '__wp_' + wp.id,
              fieldId: 's4_2_wp_' + wp.id,
              number: sub.number + '.' + (idx + 1),
              title: label,
              guidance: (sub.guidance || []).join('\n'),
              parent,
              parentNumber,
              wpMeta: {
                id: wp.id,
                project_id: wp.project_id || (currentProject && currentProject.id),
                code: wp.code,
                title: wp.title,
                order_index: wp.order_index,
                leader_id: wp.leader_id,
                category: wp.category,
              },
            });
          });
          continue;
        }
        for (const field of (sub.fields || [])) {
          if (field.type === 'textarea' || field.type === 'table') {
            flat.push({
              id: sub.id,
              fieldId: field.id,
              number: sub.number,
              title: sub.title,
              guidance: (sub.guidance || []).join('\n'),
              parent,
              parentNumber,
            });
          }
        }
      }
    }
    // Project Summary goes LAST: synthesizes content from all prior sections
    if (tmpl.project_summary) {
      flat.push({
        id: 'summary',
        fieldId: 'summary_text',
        number: '7',
        title: 'Project Summary',
        guidance: tmpl.project_summary.fields?.[0]?.guidance || '',
        parent: null,
      });
    }
    return flat;
  }

  /* ── Phase tabs ────────────────────────────────────────────── */
  const PHASE_TABS = [
    { id: 11, label: 'Cronograma',   icon: 'timeline' },
    { id: 'consorcio',    label: 'Consorcio',    icon: 'groups' },
    { id: 'relevancia',   label: 'Relevancia',   icon: 'lightbulb' },
    { id: 'actividades',  label: 'Actividades',  icon: 'task_alt' },
    { id: 'tareas',       label: 'Tareas',       icon: 'checklist' },
    { id: 'entregables',  label: 'Entregables',  icon: 'inventory_2' },
    { id: 2,  label: 'Escribir',     icon: 'edit_note' },
    { id: 4,  label: 'Revisar',      icon: 'fact_check' },
  ];

  function renderPhaseTabs(active) {
    return `
      <div class="flex items-center gap-1 mb-6 border-b border-outline-variant/30 pb-3 overflow-x-auto">
        <button onclick="Developer._back()" class="mr-2 text-on-surface-variant hover:text-primary transition-colors shrink-0" title="Volver a proyectos">
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <span class="font-headline text-sm font-bold text-primary mr-4 truncate max-w-[200px] shrink-0">${esc(currentProject?.name)}</span>
        ${PHASE_TABS.map(t => {
          const isPrep = typeof t.id === 'string';
          const onclick = isPrep ? `Developer._prepTab('${t.id}')` : `Developer._phase(${t.id})`;
          return `
          <button onclick="${onclick}" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${active === t.id ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-low'}">
            <span class="material-symbols-outlined text-sm">${t.icon}</span> ${t.label}
          </button>`;
        }).join('')}
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 1: Context Checklist
     ══════════════════════════════════════════════════════════════ */
  function renderPhase1() {
    phase = 1;
    const el = document.getElementById('developer-content');
    const ctx = contextData;
    const p = ctx.project;

    const checks = [
      { label: 'Datos del proyecto', detail: `${esc(p.name)} \u00B7 ${esc(p.type)} \u00B7 ${p.duration_months || 24} meses`, ok: !!p.name },
      { label: 'Consorcio', detail: `${ctx.partners.length} socios`, ok: ctx.partners.length >= 2 },
      { label: 'Work Packages', detail: `${ctx.wps.length} WPs, ${ctx.wps.reduce((s, w) => s + (w.activities?.length || 0), 0)} actividades`, ok: ctx.wps.length >= 2 },
      { label: 'Contexto (problema, enfoque)', detail: ctx.context ? `${wordCount(ctx.context.problem)} + ${wordCount(ctx.context.approach)} palabras` : 'Sin rellenar', ok: !!(ctx.context?.problem && ctx.context?.approach) },
      { label: 'Plantilla del formulario', detail: templateJson ? esc(templateJson.meta?.title?.substring(0, 60)) : 'No encontrada', ok: !!templateJson },
      { label: 'Criterios de evaluacion', detail: evalCriteria.length ? `${evalCriteria.length} secciones` : 'Opcional — se usaran los del formulario', ok: true },
    ];

    const canGenerate = !!(p.name && ctx.partners.length >= 2 && ctx.wps.length >= 1 && templateJson);

    el.innerHTML = renderPhaseTabs(1) + `
      <div class="max-w-3xl">
        <h2 class="font-headline text-xl font-bold mb-1">Contexto del proyecto</h2>
        <p class="text-sm text-on-surface-variant mb-6">Verifica que toda la informacion esta disponible antes de generar el borrador.</p>

        <div class="space-y-3 mb-8">
          ${checks.map(c => `
            <div class="flex items-center gap-4 p-4 rounded-xl border ${c.ok ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}">
              <span class="material-symbols-outlined text-xl ${c.ok ? 'text-green-600' : 'text-amber-500'}">${c.ok ? 'check_circle' : 'warning'}</span>
              <div class="flex-1">
                <div class="text-sm font-bold text-on-surface">${c.label}</div>
                <div class="text-xs text-on-surface-variant">${c.detail}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Partners list -->
        <div class="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5 mb-6">
          <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Consorcio</h3>
          ${ctx.partners.map((pt, i) => `
            <div class="flex items-center gap-2 py-1.5 text-sm ${i < ctx.partners.length - 1 ? 'border-b border-outline-variant/10' : ''}">
              <span class="w-5 h-5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-outline-variant/30'} text-white text-[9px] font-bold flex items-center justify-center">${i + 1}</span>
              <span class="font-medium">${esc(pt.name)}</span>
              <span class="text-on-surface-variant text-xs">${[pt.city, pt.country].filter(Boolean).join(', ')}</span>
              ${i === 0 ? '<span class="text-[9px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">Coord.</span>' : ''}
            </div>
          `).join('')}
        </div>

        <!-- WPs summary -->
        <div class="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5 mb-8">
          <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Work Packages</h3>
          ${ctx.wps.map((wp, i) => `
            <div class="flex items-center gap-2 py-1.5 text-sm ${i < ctx.wps.length - 1 ? 'border-b border-outline-variant/10' : ''}">
              <span class="w-6 h-6 rounded bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">${wp.code}</span>
              <span class="font-medium flex-1">${esc(wp.title)}</span>
              <span class="text-xs text-on-surface-variant">${wp.activities?.length || 0} act.</span>
            </div>
          `).join('')}
        </div>

        <div class="flex justify-center">
          <button onclick="Developer._prepTab('consorcio')" class="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-[#1b1464] text-[#fbff12] font-bold text-base shadow-[0_24px_48px_rgba(27,20,100,0.2)] hover:scale-[1.03] hover:shadow-[0_28px_56px_rgba(27,20,100,0.3)] active:scale-95 transition-all ${canGenerate ? '' : 'opacity-40 pointer-events-none'}">
            <span class="material-symbols-outlined text-2xl">groups</span> Consorcio
          </button>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 1.1: Gantt / Cronograma (standalone top-level tab)
     ══════════════════════════════════════════════════════════════ */
  async function renderGanttPhase() {
    phase = 11;
    const pid = currentProject.id;
    const el = document.getElementById('developer-content');

    el.innerHTML = renderPhaseTabs(11) + `
      <div class="max-w-5xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-[#1b1464]/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-xl text-[#1b1464]">timeline</span>
          </div>
          <div>
            <h2 class="font-headline text-lg font-bold">Cronograma del proyecto</h2>
            <p class="text-xs text-on-surface-variant">Timeline visual de WPs y actividades. Asigna inicio y fin (mes) a cada tarea.</p>
          </div>
        </div>
        <div id="writer-gantt-container" class="min-h-[200px]">
          <div class="flex items-center justify-center py-16 text-on-surface-variant">
            <span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Cargando cronograma...
          </div>
        </div>
      </div>`;

    // Init Calculator with project data and render Gantt
    if (typeof IntakeGantt !== 'undefined') {
      if (typeof Calculator !== 'undefined') {
        try {
          const projData = await API.get('/intake/projects/' + pid);
          const partnerList = await API.get('/intake/projects/' + pid + '/partners');
          console.log('[Writer Gantt] projData:', projData?.id, 'partners:', partnerList?.length);
          await Calculator.initFromIntake(projData, partnerList || []);
          const cs = Calculator.getCalcState();
          console.log('[Writer Gantt] after init — wps:', cs.wps?.length, 'total acts:', cs.wps?.reduce((s,w) => s + w.activities.length, 0));
        } catch (e) { console.error('[Writer Gantt] calc init failed:', e); }
      }
      IntakeGantt.render(document.getElementById('writer-gantt-container'), pid);
    } else {
      document.getElementById('writer-gantt-container').innerHTML = `
        <div class="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
          <span class="material-symbols-outlined text-4xl text-amber-400 mb-2">timeline</span>
          <h3 class="font-headline text-base font-bold text-amber-800 mb-1">Gantt no disponible</h3>
          <p class="text-sm text-amber-700">Define Work Packages y actividades en el Intake primero.</p>
        </div>`;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 1.2: Budget (standalone, same style as Prep Studio)
     ══════════════════════════════════════════════════════════════ */
  async function renderBudgetPhase() {
    phase = 12;
    const el = document.getElementById('developer-content');

    el.innerHTML = renderPhaseTabs(12) + `
      <div class="max-w-5xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-[#1b1464]/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-xl text-[#1b1464]">account_balance</span>
          </div>
          <div>
            <h2 class="font-headline text-lg font-bold">Presupuesto</h2>
            <p class="text-xs text-on-surface-variant">Presupuesto detallado del proyecto por beneficiario y paquete de trabajo</p>
          </div>
        </div>
        <div id="budget-phase-content">
          <div class="text-center py-8"><div class="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div><p class="text-sm text-on-surface-variant mt-2">Cargando presupuesto...</p></div>
        </div>
        <div class="flex justify-between items-center mt-8">
          <button onclick="Developer._phase(1)" class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-on-surface-variant border border-outline-variant hover:bg-surface-container-low transition-colors">
            <span class="material-symbols-outlined text-sm">arrow_back</span> Contexto
          </button>
          <button onclick="Developer._phase(15)" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm">
            Prep Studio <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>`;

    // Load budget into container
    const container = document.getElementById('budget-phase-content');
    await renderPrepPresupuesto(container);
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 1.5: Prep Studio — 5 Sub-tabs
     ══════════════════════════════════════════════════════════════ */
  /* PREP_TABS and renderPrepSubTabs removed — prep tabs now live in PHASE_TABS */

  async function renderPrepStudio(subTab) {
    phase = 15;
    if (subTab) prepSubTab = subTab;
    const el = document.getElementById('developer-content');

    el.innerHTML = renderPhaseTabs(prepSubTab) + `
      <div class="max-w-4xl">
        <div id="prep-tab-content"></div>
        <div id="prep-nav-buttons" class="flex justify-between items-center mt-8"></div>
      </div>`;

    await renderPrepTabContent(prepSubTab);
    renderPrepNavButtons(prepSubTab);
    // Auto-size all textareas to fit content
    document.querySelectorAll('#prep-tab-content textarea').forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }

  function renderPrepNavButtons(tab) {
    const nav = document.getElementById('prep-nav-buttons');
    if (!nav) return;
    // Use the global PHASE_TABS for linear navigation
    const idx = PHASE_TABS.findIndex(t => t.id === tab);
    const prev = idx > 0 ? PHASE_TABS[idx - 1] : null;
    const next = idx < PHASE_TABS.length - 1 ? PHASE_TABS[idx + 1] : null;

    function navBtn(t, direction) {
      const isPrep = typeof t.id === 'string';
      const onclick = isPrep ? `Developer._prepTab('${t.id}')` : `Developer._phase(${t.id})`;
      if (direction === 'prev') {
        return `<button onclick="${onclick}" class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-on-surface-variant border border-outline-variant hover:bg-surface-container-low transition-colors">
          <span class="material-symbols-outlined text-sm">arrow_back</span> ${t.label}
        </button>`;
      }
      return `<button onclick="${onclick}" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm">
          ${t.label} <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </button>`;
    }

    nav.innerHTML = (prev ? navBtn(prev, 'prev') : '<div></div>') + (next ? navBtn(next, 'next') : '<div></div>');
  }

  async function renderPrepTabContent(tab) {
    const el = document.getElementById('prep-tab-content');
    if (!el) return;
    el.innerHTML = '<div class="text-center py-8"><div class="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div><p class="text-sm text-on-surface-variant mt-2">Cargando...</p></div>';

    try {
      switch (tab) {
        case 'consorcio':    await renderPrepConsorcio(el); break;
        case 'relevancia':   await renderPrepRelevancia(el); break;
        case 'actividades':  await renderPrepActividades(el); break;
        case 'tareas':       await renderPrepTareas(el); break;
        case 'entregables':  await renderPrepEntregables(el); break;
        case 'cronograma':   await renderPrepCronograma(el); break;
      }
    } catch (err) {
      el.innerHTML = `<div class="text-center py-8 text-error"><span class="material-symbols-outlined text-3xl mb-2">error</span><p class="text-sm">Error cargando ${tab}: ${esc(err.message)}</p></div>`;
    }
  }

  /* ── Sub-tab: Consorcio ──────────────────────────────────────── */
  async function renderPrepConsorcio(el) {
    const pid = currentProject.id;
    const data = await API.get('/developer/projects/' + pid + '/prep/consorcio').catch(() => ({ partners: [] }));
    prepCache.consorcio = data;
    const partners = data.partners || [];
    const workerCategories = data.workerCategories || [];

    el.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h3 class="font-headline text-base font-bold">Consorcio y PIFs</h3>
            <p class="text-xs text-on-surface-variant">Vincula socios a organizaciones registradas y adapta sus perfiles al proyecto.</p>
          </div>
        </div>

        <div class="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
          <span class="material-symbols-outlined text-blue-600 text-xl mt-0.5">tips_and_updates</span>
          <div>
            <p class="text-sm font-semibold text-blue-900 mb-1">Consortium quality matters</p>
            <p class="text-xs text-blue-800">The quality of your proposal depends heavily on how well each partner's profile aligns with the project's objectives, thematic areas, and planned activities. Take time to review and refine each organisation's description and staff profiles — the AI will use this information to build a stronger, more coherent narrative throughout the entire proposal.</p>
          </div>
        </div>

        ${partners.length ? partners.map((p, i) => {
          const linked = !!p.organization_id;
          const org = p.organization || {};
          const variants = p.variants || [];
          const selectedVariant = p.selected_variant;
          const pifText = p.custom_text || (selectedVariant ? selectedVariant.adapted_text : org.description) || '';
          const euProjects = org.eu_projects || [];
          const selectedEuProjects = p.selected_eu_projects || [];
          const keyStaff = org.key_staff || [];
          const staffCustom = p.staff_custom || {};
          const extraStaff = p.extra_staff || [];

          return `
          <div class="bg-white rounded-2xl border border-outline-variant/20 p-5">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-full ${i === 0 ? 'bg-primary text-white' : 'bg-outline-variant/20 text-on-surface-variant'} text-xs font-bold flex items-center justify-center">${i + 1}</span>
              <div class="flex-1">
                <div class="text-sm font-bold">${esc(p.name)} ${i === 0 ? '<span class="text-[9px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-1">Coord.</span>' : ''}</div>
                <div class="text-xs text-on-surface-variant">${[p.city, p.country].filter(Boolean).join(', ')}</div>
              </div>
              ${linked
                ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg"><span class="material-symbols-outlined text-xs">link</span> ${esc(org.organization_name || 'Vinculada')}</span>`
                : `<button onclick="Developer._linkOrg('${p.id}')" class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"><span class="material-symbols-outlined text-xs">link_off</span> Vincular organizacion</button>`
              }
            </div>

            ${linked ? `
              <!-- PIF Variant selector as chips -->
              <div class="mb-3">
                <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1">PIF:</span>
                  <button onclick="Developer._selectVariant('${p.id}', '')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${!selectedVariant ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20'}">
                    <span class="material-symbols-outlined text-xs">description</span> Original
                  </button>
                  ${variants.map(v => `
                    <button onclick="Developer._selectVariant('${p.id}', '${v.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${selectedVariant?.id === v.id ? 'bg-[#1b1464] text-[#fbff12] shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20'}">
                      <span class="material-symbols-outlined text-xs">auto_awesome</span> ${esc(v.category_label || v.category)}
                    </button>
                  `).join('')}
                  <button onclick="Developer._generateVariant('${p.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 transition-all">
                    <span class="material-symbols-outlined text-xs">add</span> Nueva variante
                  </button>
                </div>
              </div>

              <!-- PIF text (editable) -->
              <div class="mb-4">
                <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  <span class="material-symbols-outlined text-xs align-middle mr-0.5">edit_note</span> Organization description (PIF)
                </label>
                <textarea id="prep-pif-text-${p.id}" class="w-full px-3 py-2 text-xs bg-surface-container-lowest border border-outline-variant/20 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-primary/15 min-h-[100px]" onblur="Developer._saveCustomText('${p.id}', this.value)" placeholder="Organization profile text..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${esc(pifText)}</textarea>
              </div>

              <!-- Key Staff profiles -->
              <details class="mb-4" open>
                <summary class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider cursor-pointer hover:text-primary mb-2">
                  <span class="material-symbols-outlined text-xs align-middle mr-0.5">badge</span> Key staff (${keyStaff.filter(s => p.staff_selected?.[s.id]).length + extraStaff.length} selected / ${keyStaff.length + extraStaff.length} total)
                </summary>
                <div class="space-y-2">
                  ${keyStaff.map(s => {
                    const isSelected = p.staff_selected?.[s.id] || false;
                    const projectRole = p.staff_project_role?.[s.id] || '';
                    const customSkills = staffCustom[s.id] !== undefined ? staffCustom[s.id] : null;
                    const displaySkills = customSkills !== null ? customSkills : (s.skills_summary || '');
                    return `
                    <div class="rounded-lg border p-3 transition-all ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-lowest border-outline-variant/10 opacity-60'}">
                      <div class="flex items-center gap-2 mb-1.5">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="Developer._toggleStaff('${p.id}','${s.id}',this.checked)" class="accent-primary">
                        <span class="material-symbols-outlined text-sm ${isSelected ? 'text-primary' : 'text-on-surface-variant'}">person</span>
                        <span class="text-xs font-bold">${esc(s.name)}</span>
                        ${s.role ? `<span class="text-[10px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">${esc(s.role)}</span>` : ''}
                        <select class="ml-auto text-[10px] bg-white border border-outline-variant/20 rounded px-1.5 py-0.5 focus:outline-none focus:border-primary ${isSelected ? '' : 'pointer-events-none opacity-40'}" onchange="Developer._setStaffRole('${p.id}','${s.id}',this.value)">
                          <option value="">-- Project role --</option>
                          ${workerCategories.map(c => `<option value="${esc(c)}" ${projectRole === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                        </select>
                      </div>
                      ${isSelected ? `<textarea class="w-full px-2 py-1.5 text-xs bg-white border border-outline-variant/15 rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-primary/15 min-h-[50px]" onblur="Developer._saveStaffSkills('${p.id}', '${s.id}', this.value)" placeholder="Skills and experience relevant to this project...">${esc(displaySkills)}</textarea>` : ''}
                    </div>`;
                  }).join('')}
                  ${extraStaff.map(s => `
                    <div class="bg-amber-50/50 rounded-lg border border-amber-200/30 p-3">
                      <div class="flex items-center gap-2 mb-1.5">
                        <span class="material-symbols-outlined text-sm text-amber-700">person_add</span>
                        <input type="text" value="${esc(s.name)}" placeholder="Name" class="text-xs font-bold bg-transparent border-b border-outline-variant/20 focus:outline-none focus:border-primary px-1 py-0.5 w-32" onblur="Developer._updateExtraStaff('${p.id}','${s.id}','name',this.value)">
                        <select class="text-[10px] bg-transparent border-b border-outline-variant/20 focus:outline-none focus:border-primary px-1 py-0.5" onchange="Developer._updateExtraStaff('${p.id}','${s.id}','role',this.value)">
                          <option value="">-- Role --</option>
                          ${workerCategories.map(c => `<option value="${esc(c)}" ${s.role === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                        </select>
                        <span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">PROJECT</span>
                        <button onclick="Developer._removeExtraStaff('${p.id}','${s.id}')" class="ml-auto w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors">
                          <span class="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                      <textarea class="w-full px-2 py-1.5 text-xs bg-white border border-outline-variant/15 rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-primary/15 min-h-[50px]" onblur="Developer._updateExtraStaff('${p.id}','${s.id}','skills_summary',this.value)" placeholder="Skills and experience...">${esc(s.skills_summary || '')}</textarea>
                    </div>
                  `).join('')}
                  <button onclick="Developer._addExtraStaff('${p.id}')" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 transition-colors mt-1">
                    <span class="material-symbols-outlined text-sm">person_add</span> Add staff for this project
                  </button>
                </div>
              </details>

              <!-- EU Projects selection -->
              ${euProjects.length ? `
              <details class="mb-3">
                <summary class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider cursor-pointer hover:text-primary mb-2">
                  <span class="material-symbols-outlined text-xs align-middle mr-0.5">folder_special</span> EU Projects — select relevant (${selectedEuProjects.length}/${euProjects.length})
                </summary>
                <div class="bg-surface-container-lowest rounded-lg border border-outline-variant/10 p-3 space-y-1.5">
                  ${euProjects.map(ep => {
                    const checked = selectedEuProjects.includes(ep.id);
                    return `
                    <label class="flex items-start gap-2 py-1 px-1 rounded hover:bg-surface-container-low cursor-pointer transition-colors">
                      <input type="checkbox" ${checked ? 'checked' : ''} onchange="Developer._toggleEuProject('${p.id}', '${ep.id}', this.checked)" class="mt-0.5 accent-primary">
                      <div class="flex-1 text-xs">
                        <span class="font-semibold">${esc(ep.title || ep.programme)}</span>
                        <span class="text-on-surface-variant"> (${ep.year || '?'}, ${esc(ep.role || '')})</span>
                      </div>
                    </label>`;
                  }).join('')}
                </div>
              </details>` : ''}

              <!-- Org details expandable (reference) -->
              <details class="mb-3">
                <summary class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider cursor-pointer hover:text-primary">
                  <span class="material-symbols-outlined text-xs align-middle mr-0.5">info</span> Original profile (read-only reference)
                </summary>
                <div class="mt-2 bg-surface-container-lowest rounded-xl p-4 space-y-3 text-xs">
                  ${org.description ? `<div><span class="font-bold text-on-surface-variant">Description:</span><p class="mt-0.5 text-on-surface">${esc(org.description).substring(0, 500)}${(org.description||'').length > 500 ? '...' : ''}</p></div>` : ''}
                  ${org.activities_experience ? `<div><span class="font-bold text-on-surface-variant">Experience:</span><p class="mt-0.5 text-on-surface">${esc(org.activities_experience).substring(0, 500)}${(org.activities_experience||'').length > 500 ? '...' : ''}</p></div>` : ''}
                  ${(org.stakeholders || []).length ? `<div><span class="font-bold text-on-surface-variant">Stakeholders:</span><ul class="mt-1 space-y-0.5">${org.stakeholders.map(sh => `<li>- ${esc(sh.entity_name)} (${esc(sh.relationship_type)})</li>`).join('')}</ul></div>` : ''}
                </div>
              </details>
            ` : `
              <div class="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
                <span class="material-symbols-outlined text-sm align-middle mr-1">info</span>
                Este socio fue creado manualmente. Vinculalo a una organizacion registrada para acceder al PIF completo (descripcion, personal, proyectos, stakeholders).
              </div>
            `}

            <!-- Interview questions for this tab -->
            <div id="prep-interview-consorcio-${p.id}"></div>
          </div>`;
        }).join('') : '<p class="text-sm text-on-surface-variant italic py-4">No hay socios en este proyecto. Anade socios en el Intake.</p>'}
      </div>`;
  }

  /* ── Sub-tab: Presupuesto ─────────────────────────────────────── */
  async function renderPrepPresupuesto(el) {
    const pid = currentProject.id;
    const data = await API.get('/developer/projects/' + pid + '/prep/presupuesto').catch(() => null);
    prepCache.presupuesto = data;

    if (!data || !data.budget) {
      // Auto-create budget from intake data
      el.innerHTML = '<p class="text-sm text-on-surface-variant py-8 text-center"><span class="spinner"></span> Generando presupuesto desde intake...</p>';
      try {
        const res = await API.post('/budget/from-intake/' + pid);
        const budgetId = res.id || res.data?.id;
        Budget.openInContainer(budgetId, el);
      } catch (e) {
        el.innerHTML = `
          <div class="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-amber-400 mb-2">account_balance</span>
            <h3 class="font-headline text-base font-bold text-amber-800 mb-1">Error generando presupuesto</h3>
            <p class="text-sm text-amber-700 mb-4">${esc(e.message || 'Error desconocido')}</p>
            <button id="prep-budget-retry" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-[#fbff12] bg-[#1b1464] hover:bg-[#1b1464]/80 transition-colors">
              <span class="material-symbols-outlined text-sm">refresh</span> Reintentar
            </button>
          </div>`;
        document.getElementById('prep-budget-retry')?.addEventListener('click', () => renderPrepPresupuesto(el));
      }
      return;
    }

    // Open the full budget editor embedded in this container
    Budget.openInContainer(data.budget.id, el);
  }

  /* ── Sub-tab: Relevancia ──────────────────────────────────────── */

  const FIELD_CFG = {
    problem:       { id: 'prep-rel-problem',  label: 'Problema / Necesidades', placeholder: 'Describe el problema o necesidad que aborda el proyecto...', minH: '80px' },
    target_groups: { id: 'prep-rel-targets',   label: 'Grupos objetivo',        placeholder: 'A quien beneficia el proyecto...',                         minH: '60px' },
    approach:      { id: 'prep-rel-approach',  label: 'Enfoque / Metodologia',  placeholder: 'Como abordareis el problema...',                           minH: '80px' },
  };

  function buildFieldHTML(fieldKey, value, chatStatus) {
    const cfg = FIELD_CFG[fieldKey];
    const hasDraft = (chatStatus[fieldKey] || 0) > 0;
    const hasText = !!(value && value.trim());
    return `
      <div class="bg-white rounded-2xl border border-outline-variant/20 p-5" data-ai-field="${fieldKey}">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-bold text-on-surface-variant">${cfg.label}</label>
          <div class="flex items-center gap-2">
            ${!hasDraft ? `<button onclick="Developer._genFieldDraft('${fieldKey}')" class="prep-gen-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors" id="prep-gen-${fieldKey}">
              <span class="material-symbols-outlined text-sm">auto_awesome</span> Generar borrador IA
            </button>` : `<button onclick="Developer._startImprove('${fieldKey}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors" id="prep-improve-${fieldKey}">
              <span class="material-symbols-outlined text-sm">psychology</span> Mejorar propuesta
            </button>`}
          </div>
        </div>
        <textarea id="${cfg.id}" class="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/20 rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/15" style="min-height:${cfg.minH}" placeholder="${cfg.placeholder}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${esc(value || '')}</textarea>

        <!-- Inline chat (hidden by default) -->
        <div id="prep-chat-${fieldKey}" class="hidden mt-3 border-t border-outline-variant/10 pt-3">
          <div id="prep-chat-msgs-${fieldKey}" class="space-y-2 mb-3"></div>
          <div id="prep-chat-input-area-${fieldKey}">
            <div class="flex gap-2 items-stretch">
              <div class="flex-1">
                <input id="prep-chat-input-${fieldKey}" class="w-full px-3 py-2 text-xs bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tu aporte (o escribe 'nada' para reescribir igualmente)..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Developer._sendFieldChat('${fieldKey}')}">
              </div>
              <button onclick="Developer._sendFieldChat('${fieldKey}')" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
                <span class="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function autoResizeField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function renderFieldChatBubble(fieldKey, role, text) {
    const container = document.getElementById('prep-chat-msgs-' + fieldKey);
    if (!container) return;
    const isUser = role === 'user';
    const bubble = document.createElement('div');
    bubble.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
    bubble.innerHTML = `
      <div class="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${isUser ? 'bg-primary text-white rounded-br-sm' : 'bg-surface-container border border-outline-variant/20 text-on-surface rounded-bl-sm'}">
        ${esc(text).replace(/\n/g, '<br>')}
      </div>`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  function showFieldTyping(fieldKey) {
    const container = document.getElementById('prep-chat-msgs-' + fieldKey);
    if (!container) return;
    const el = document.createElement('div');
    el.id = 'prep-chat-typing-' + fieldKey;
    el.className = 'flex justify-start';
    el.innerHTML = `<div class="px-3 py-2 rounded-xl text-xs bg-surface-container border border-outline-variant/20 rounded-bl-sm text-on-surface-variant animate-pulse">Pensando...</div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function removeFieldTyping(fieldKey) {
    document.getElementById('prep-chat-typing-' + fieldKey)?.remove();
  }

  async function generateFieldDraft(fieldKey) {
    const pid = currentProject.id;
    const btn = document.getElementById('prep-gen-' + fieldKey);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Generando...'; }

    showFieldTyping(fieldKey);

    try {
      const res = await API.post('/developer/projects/' + pid + '/prep/relevancia/generate-draft', { field_key: fieldKey });
      removeFieldTyping(fieldKey);
      const data = res.data || res;

      // Populate textarea if empty
      const ta = document.getElementById(FIELD_CFG[fieldKey].id);
      if (ta && !ta.value.trim() && data.draft) {
        ta.value = data.draft;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => autoResizeField(FIELD_CFG[fieldKey].id), 50);
      }

      // Replace "Generate" button with "Improve" button
      if (btn) {
        btn.outerHTML = `<button onclick="Developer._startImprove('${fieldKey}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors" id="prep-improve-${fieldKey}">
          <span class="material-symbols-outlined text-sm">psychology</span> Mejorar propuesta
        </button>`;
      }

      Toast.show('Borrador generado', 'ok');
    } catch (e) {
      removeFieldTyping(fieldKey);
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-sm">auto_awesome</span> Generar borrador IA'; }
      Toast.show('Error generando borrador: ' + e.message, 'err');
    }
  }

  async function startImprove(fieldKey) {
    const chatPanel = document.getElementById('prep-chat-' + fieldKey);
    if (chatPanel) chatPanel.classList.remove('hidden');

    showFieldTyping(fieldKey);
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/relevancia/chat', {
        field_key: fieldKey,
        message: '__START_IMPROVE__'
      });
      removeFieldTyping(fieldKey);
      const data = res.data || res;
      if (data.follow_up) {
        renderFieldChatBubble(fieldKey, 'assistant', data.follow_up);
      }
    } catch (e) {
      removeFieldTyping(fieldKey);
      renderFieldChatBubble(fieldKey, 'assistant', 'Error: ' + e.message);
    }
  }

  async function sendFieldChat(fieldKey) {
    const input = document.getElementById('prep-chat-input-' + fieldKey);
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    renderFieldChatBubble(fieldKey, 'user', msg);
    showFieldTyping(fieldKey);

    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/relevancia/chat', { field_key: fieldKey, message: msg });
      removeFieldTyping(fieldKey);
      const data = res.data || res;

      // Backend returned revised_text → conversation done, apply improvement
      if (data.revised_text) {
        const ta = document.getElementById(FIELD_CFG[fieldKey].id);
        if (ta) {
          ta.value = data.revised_text;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          setTimeout(() => autoResizeField(FIELD_CFG[fieldKey].id), 50);
          ta.classList.add('ring-2', 'ring-green-400/40');
          setTimeout(() => ta.classList.remove('ring-2', 'ring-green-400/40'), 2000);
        }
        renderFieldChatBubble(fieldKey, 'assistant', 'He mejorado el texto con tus aportaciones. Puedes seguir editandolo directamente.');
        const inputArea = document.getElementById('prep-chat-input-area-' + fieldKey);
        if (inputArea) inputArea.innerHTML = `<p class="text-xs text-green-600 font-semibold text-center py-2"><span class="material-symbols-outlined text-sm align-middle">check_circle</span> Mejora completada</p>`;
        const improveBtn = document.getElementById('prep-improve-' + fieldKey);
        if (improveBtn) {
          improveBtn.innerHTML = '<span class="material-symbols-outlined text-sm">psychology</span> Mejorar de nuevo';
          improveBtn.onclick = () => { resetFieldChat(fieldKey); Developer._startImprove(fieldKey); };
        }
        Toast.show('Texto mejorado', 'ok');
      }
      // Backend returned follow_up → conversation continues
      else if (data.follow_up) {
        renderFieldChatBubble(fieldKey, 'assistant', data.follow_up);
      }
    } catch (e) {
      removeFieldTyping(fieldKey);
      renderFieldChatBubble(fieldKey, 'assistant', 'Error: ' + e.message);
    }
  }

  function resetFieldChat(fieldKey, sendHandler) {
    const handler = sendHandler || `Developer._sendFieldChat('${fieldKey}')`;
    const msgs = document.getElementById('prep-chat-msgs-' + fieldKey);
    if (msgs) msgs.innerHTML = '';
    const inputArea = document.getElementById('prep-chat-input-area-' + fieldKey);
    if (inputArea) inputArea.innerHTML = `
      <div class="flex gap-2 items-stretch">
        <div class="flex-1">
          <input id="prep-chat-input-${fieldKey}" class="w-full px-3 py-2 text-xs bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tu aporte (o escribe 'nada' para reescribir igualmente)..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();${handler}}">
        </div>
        <button onclick="${handler}" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
          <span class="material-symbols-outlined text-sm">send</span>
        </button>
      </div>`;
    // Re-attach voice input
    setTimeout(() => {
      const inp = document.getElementById('prep-chat-input-' + fieldKey);
      if (inp && typeof VoiceInput !== 'undefined') VoiceInput.attach(inp);
    }, 50);
  }

  function toggleFieldChat(fieldKey) {
    const panel = document.getElementById('prep-chat-' + fieldKey);
    if (panel) panel.classList.toggle('hidden');
  }

  async function renderPrepRelevancia(el) {
    const pid = currentProject.id;
    const [relData, docs, interview] = await Promise.all([
      API.get('/developer/projects/' + pid + '/prep/relevancia').catch(() => ({ context: {}, chatStatus: {} })),
      API.get('/developer/projects/' + pid + '/research-docs').catch(() => []),
      API.get('/developer/projects/' + pid + '/interview').catch(() => []),
    ]);
    prepCache.relevancia = relData;
    const rd = relData.data || relData;
    const ctx = rd.context || {};
    const chatStatus = rd.chatStatus || {};
    const relInterview = interview.filter(q => q.tab === 'relevancia' || (!q.tab && ['origin_story', 'unique_approach', 'problem_data', 'eu_added_value', 'innovation'].includes(q.question_key)));

    el.innerHTML = `
      <div class="space-y-4">
        <h3 class="font-headline text-base font-bold">Relevancia e Investigacion</h3>
        <p class="text-xs text-on-surface-variant mb-2">Sube primero tus documentos de apoyo. Despues, la IA generara borradores basados en ellos y en los documentos de la convocatoria.</p>

        <!-- 1. Research Documents (FIRST — user uploads before generating drafts) -->
        <div class="bg-white rounded-2xl border border-outline-variant/20 p-5">
          <h4 class="font-headline text-sm font-bold text-primary mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">upload_file</span> 1. Documentos de investigacion
          </h4>
          <p class="text-xs text-on-surface-variant mb-3">Sube documentos que respalden tu propuesta. La IA los usara como evidencia al generar los borradores.</p>
          <div class="bg-primary/5 border border-primary/10 rounded-lg p-3 mb-3">
            <div class="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5">Que tipo de documentos subir</div>
            <div class="grid grid-cols-1 gap-1 text-[11px] text-on-surface-variant">
              <div class="flex items-start gap-1.5"><span class="text-primary font-bold">1.1</span> Informes sobre el problema, estadisticas (Eurostat, OECD, informes nacionales)</div>
              <div class="flex items-start gap-1.5"><span class="text-primary font-bold">1.2</span> Analisis de necesidades, encuestas, datos locales de los paises del consorcio</div>
              <div class="flex items-start gap-1.5"><span class="text-primary font-bold">1.3</span> Buenas practicas, proyectos similares, benchmarking, estado del arte</div>
              <div class="flex items-start gap-1.5"><span class="text-primary font-bold">3.x</span> Estrategias de difusion, estudios de impacto, planes de sostenibilidad</div>
            </div>
          </div>

          <div class="flex items-center gap-3 mb-3">
            <label class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#1b1464] text-[#fbff12] cursor-pointer hover:bg-[#1b1464]/90 transition-colors">
              <span class="material-symbols-outlined text-sm">add</span> Subir documento
              <input type="file" accept=".pdf,.docx,.txt" class="hidden" id="prep-doc-upload">
            </label>
            <span class="text-xs text-on-surface-variant">PDF, DOCX o TXT (max 30MB)</span>
          </div>

          <div id="prep-docs-list">
            ${(docs || []).length ? docs.map(d => `
              <div class="flex items-center gap-3 py-2 border-b border-outline-variant/10">
                <span class="material-symbols-outlined text-lg text-primary/50">description</span>
                <span class="text-sm font-medium flex-1">${esc(d.title || d.label)}</span>
                <span class="text-xs text-on-surface-variant">${d.file_type || ''} · ${((d.file_size_bytes || 0) / 1024).toFixed(0)}KB</span>
                <button onclick="Developer._deleteDoc(${d.document_id})" class="text-on-surface-variant/30 hover:text-error"><span class="material-symbols-outlined text-sm">delete</span></button>
              </div>
            `).join('') : '<p class="text-xs text-on-surface-variant/50 italic py-2">Ningun documento subido aun.</p>'}
          </div>
        </div>

        <!-- 2. AI-assisted fields (AFTER documents are uploaded) -->
        ${buildFieldHTML('problem', ctx.problem, chatStatus)}
        ${buildFieldHTML('target_groups', ctx.target_groups, chatStatus)}
        ${buildFieldHTML('approach', ctx.approach, chatStatus)}

      </div>`;

    // Bind events
    document.getElementById('prep-doc-upload')?.addEventListener('change', handleDocUpload);
    bindInterviewAutosave();
    bindRelContextAutosave();

    // Auto-resize textareas to fit existing content + attach voice input
    setTimeout(() => {
      ['prep-rel-problem', 'prep-rel-targets', 'prep-rel-approach'].forEach(id => {
        autoResizeField(id);
        const el = document.getElementById(id);
        if (el && typeof VoiceInput !== 'undefined') VoiceInput.attach(el);
      });
      // Attach voice to chat inputs
      ['problem', 'target_groups', 'approach'].forEach(fk => {
        const inp = document.getElementById('prep-chat-input-' + fk);
        if (inp && typeof VoiceInput !== 'undefined') VoiceInput.attach(inp);
      });
    }, 50);
  }

  function bindRelContextAutosave() {
    ['prep-rel-problem', 'prep-rel-targets', 'prep-rel-approach'].forEach(id => {
      const ta = document.getElementById(id);
      if (!ta) return;
      let timer;
      ta.addEventListener('input', () => {
        autoResizeField(id);
        clearTimeout(timer);
        timer = setTimeout(() => saveRelContext(), 2000);
      });
    });
  }

  async function saveRelContext() {
    const problem = document.getElementById('prep-rel-problem')?.value || '';
    const target_groups = document.getElementById('prep-rel-targets')?.value || '';
    const approach = document.getElementById('prep-rel-approach')?.value || '';
    try {
      await API.put('/developer/projects/' + currentProject.id + '/prep/relevancia/context', { problem, target_groups, approach });
      Toast.show('Contexto guardado', 'ok');
    } catch (e) { Toast.show('Error guardando: ' + e.message, 'err'); }
  }

  /* ── Sub-tab: Actividades ─────────────────────────────────────── */
  async function renderPrepActividades(el) {
    const pid = currentProject.id;
    const data = await API.get('/developer/projects/' + pid + '/prep/actividades').catch(() => ({ wps: [] }));
    prepCache.actividades = data;
    const wps = data.wps || [];

    el.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h3 class="font-headline text-base font-bold">Actividades y Work Packages</h3>
            <p class="text-xs text-on-surface-variant">Describe cada WP y sus actividades. Este contexto alimenta la IA al escribir la propuesta.</p>
          </div>
        </div>

        ${wps.length ? wps.map(wp => {
          const wpKey = 'wpsum_' + wp.id;
          const wpHasDraft = !!(wp.summary && wp.summary.trim());
          return `
          <details class="bg-white rounded-2xl border border-outline-variant/20" open>
            <summary class="p-5 cursor-pointer">
              <div class="inline-flex items-center gap-3">
                <span class="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">${esc(wp.code)}</span>
                <div>
                  <div class="text-sm font-bold">${esc(wp.title)}</div>
                  <div class="text-xs text-on-surface-variant">${(wp.activities || []).length} actividades · Lider: ${esc(wp.leader_name || 'Sin asignar')}</div>
                </div>
              </div>
            </summary>
            <div class="px-5 pb-5 space-y-3">
              <!-- WP Summary -->
              <div class="bg-primary/5 rounded-xl p-3 border border-primary/10">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-bold text-primary uppercase tracking-wider">Resumen del WP</label>
                  <button id="prep-wpbtn-${wp.id}" onclick="Developer.${wpHasDraft ? '_improveWpSummary' : '_genWpSummary'}('${wp.id}')" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <span class="material-symbols-outlined text-sm">${wpHasDraft ? 'psychology' : 'auto_awesome'}</span> ${wpHasDraft ? 'Mejorar propuesta' : 'Generar borrador IA'}
                  </button>
                </div>
                <textarea id="prep-wp-ta-${wp.id}" class="prep-wp-summary w-full px-3 py-2 text-xs bg-white border border-outline-variant/20 rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/15 min-h-[60px]"
                  data-wp-id="${wp.id}" placeholder="Describe brevemente el objetivo y enfoque de este Work Package..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${esc(wp.summary || '')}</textarea>
                <div id="prep-chat-${wpKey}" class="hidden mt-3 border-t border-primary/10 pt-3">
                  <div id="prep-chat-msgs-${wpKey}" class="space-y-2 mb-3"></div>
                  <div id="prep-chat-input-area-${wpKey}">
                    <div class="flex gap-2 items-stretch">
                      <div class="flex-1">
                        <input id="prep-chat-input-${wpKey}" class="w-full px-3 py-2 text-xs bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tu aporte (o escribe 'nada' para reescribir igualmente)..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Developer._sendWpSummaryChat('${wp.id}')}">
                      </div>
                      <button onclick="Developer._sendWpSummaryChat('${wp.id}')" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
                        <span class="material-symbols-outlined text-sm">send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Activities -->
              ${(wp.activities || []).map(act => {
                const actKey = 'actdesc_' + act.id;
                const actHasDraft = !!(act.description && act.description.trim());
                return `
                <div class="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/10">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-bold text-primary">${esc(act.label || act.type)}</span>
                    ${act.subtype ? `<span class="text-[10px] text-on-surface-variant bg-surface-container-low px-1.5 py-0.5 rounded">${esc(act.subtype)}</span>` : ''}
                    ${act.date_start ? `<span class="text-[10px] text-on-surface-variant">${fmtDate(act.date_start)} - ${fmtDate(act.date_end)}</span>` : ''}
                    <button id="prep-actbtn-${act.id}" onclick="Developer.${actHasDraft ? '_improveActivityDesc' : '_genActivityDesc'}('${act.id}')" class="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <span class="material-symbols-outlined text-sm">${actHasDraft ? 'psychology' : 'auto_awesome'}</span> ${actHasDraft ? 'Mejorar propuesta' : 'Generar borrador IA'}
                    </button>
                  </div>
                  <textarea id="prep-act-ta-${act.id}" class="prep-act-desc w-full px-3 py-2 text-xs bg-white border border-outline-variant/20 rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/15 min-h-[50px]"
                    data-act-id="${act.id}" placeholder="Describe esta actividad: objetivos, metodologia, resultados esperados..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${esc(act.description || '')}</textarea>
                  <div id="prep-chat-${actKey}" class="hidden mt-3 border-t border-outline-variant/10 pt-3">
                    <div id="prep-chat-msgs-${actKey}" class="space-y-2 mb-3"></div>
                    <div id="prep-chat-input-area-${actKey}">
                      <div class="flex gap-2 items-stretch">
                        <div class="flex-1">
                          <input id="prep-chat-input-${actKey}" class="w-full px-3 py-2 text-xs bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tu aporte (o escribe 'nada' para reescribir igualmente)..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Developer._sendActivityDescChat('${act.id}')}">
                        </div>
                        <button onclick="Developer._sendActivityDescChat('${act.id}')" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
                          <span class="material-symbols-outlined text-sm">send</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  ${(act.tasks || []).length ? `
                    <div class="mt-2 space-y-1">
                      ${act.tasks.map(t => `
                        <div class="flex items-start gap-1.5 text-[11px]">
                          <span class="material-symbols-outlined text-xs text-on-surface-variant mt-0.5">subdirectory_arrow_right</span>
                          <span class="font-medium">${esc(t.title)}</span>
                          ${t.deliverable ? `<span class="text-green-600 ml-auto">D: ${esc(t.deliverable)}</span>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>`;
              }).join('')}
            </div>
          </details>`;
        }).join('') : `
          <div class="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-amber-400 mb-2">task_alt</span>
            <h3 class="font-headline text-base font-bold text-amber-800 mb-1">Sin actividades</h3>
            <p class="text-sm text-amber-700">Define Work Packages y actividades en el Intake primero.</p>
          </div>
        `}
      </div>`;

    // Bind autosave for WP summaries
    el.querySelectorAll('.prep-wp-summary').forEach(ta => {
      let timer;
      ta.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            await API.put('/developer/wp/' + ta.dataset.wpId + '/summary', { summary: ta.value });
          } catch (e) { console.error('wp summary save:', e); }
        }, 1500);
      });
    });

    // Bind autosave for activity descriptions
    el.querySelectorAll('.prep-act-desc').forEach(ta => {
      let timer;
      ta.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            await API.put('/developer/activity/' + ta.dataset.actId + '/description', { description: ta.value });
          } catch (e) { console.error('activity desc save:', e); }
        }, 1500);
      });
    });

    // Attach voice input to all chat inputs in this tab
    setTimeout(() => {
      el.querySelectorAll('input[id^="prep-chat-input-"]').forEach(inp => {
        if (typeof VoiceInput !== 'undefined') VoiceInput.attach(inp);
      });
      el.querySelectorAll('.prep-wp-summary, .prep-act-desc').forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      });
    }, 50);
  }

  /* ── Activities AI flow ────────────────────────────────────────── */

  async function genWpSummary(wpId) {
    const btn = document.getElementById('prep-wpbtn-' + wpId);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Generando...'; }
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/wp/' + wpId + '/generate-summary', {});
      const data = res.data || res;
      const ta = document.getElementById('prep-wp-ta-' + wpId);
      if (ta && data.summary) {
        ta.value = data.summary;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.classList.add('ring-2', 'ring-green-400/40');
        setTimeout(() => ta.classList.remove('ring-2', 'ring-green-400/40'), 2000);
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">psychology</span> Mejorar propuesta';
        btn.setAttribute('onclick', `Developer._improveWpSummary('${wpId}')`);
      }
      Toast.show('Resumen generado', 'ok');
    } catch (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-sm">auto_awesome</span> Generar borrador IA'; }
      Toast.show('Error: ' + e.message, 'error');
    }
  }

  async function improveWpSummary(wpId) {
    const chatKey = 'wpsum_' + wpId;
    const panel = document.getElementById('prep-chat-' + chatKey);
    if (panel) panel.classList.remove('hidden');
    resetFieldChat(chatKey, `Developer._sendWpSummaryChat('${wpId}')`);
    showFieldTyping(chatKey);
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/wp/' + wpId + '/improve-summary', { message: '__START_IMPROVE__' });
      removeFieldTyping(chatKey);
      const data = res.data || res;
      if (data.follow_up) renderFieldChatBubble(chatKey, 'assistant', data.follow_up);
    } catch (e) {
      removeFieldTyping(chatKey);
      console.error('[chat error]', chatKey, e);
      renderFieldChatBubble(chatKey, 'assistant', 'Error: ' + (e?.message || e?.code || JSON.stringify(e)));
    }
  }

  async function sendWpSummaryChat(wpId) {
    const chatKey = 'wpsum_' + wpId;
    const input = document.getElementById('prep-chat-input-' + chatKey);
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    renderFieldChatBubble(chatKey, 'user', msg);
    showFieldTyping(chatKey);
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/wp/' + wpId + '/improve-summary', { message: msg });
      removeFieldTyping(chatKey);
      const data = res.data || res;
      if (data.revised_text) {
        const ta = document.getElementById('prep-wp-ta-' + wpId);
        if (ta) {
          ta.value = data.revised_text;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.classList.add('ring-2', 'ring-green-400/40');
          setTimeout(() => ta.classList.remove('ring-2', 'ring-green-400/40'), 2000);
        }
        renderFieldChatBubble(chatKey, 'assistant', 'He mejorado el texto. Puedes seguir editandolo directamente.');
        const inputArea = document.getElementById('prep-chat-input-area-' + chatKey);
        if (inputArea) inputArea.innerHTML = `<p class="text-xs text-green-600 font-semibold text-center py-2"><span class="material-symbols-outlined text-sm align-middle">check_circle</span> Mejora completada</p>`;
        Toast.show('Resumen mejorado', 'ok');
      } else if (data.follow_up) {
        renderFieldChatBubble(chatKey, 'assistant', data.follow_up);
      }
    } catch (e) {
      removeFieldTyping(chatKey);
      console.error('[chat error]', chatKey, e);
      renderFieldChatBubble(chatKey, 'assistant', 'Error: ' + (e?.message || e?.code || JSON.stringify(e)));
    }
  }

  async function genActivityDesc(actId) {
    const btn = document.getElementById('prep-actbtn-' + actId);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Generando...'; }
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/activity/' + actId + '/generate-description', {});
      const data = res.data || res;
      const ta = document.getElementById('prep-act-ta-' + actId);
      if (ta && data.description) {
        ta.value = data.description;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.classList.add('ring-2', 'ring-green-400/40');
        setTimeout(() => ta.classList.remove('ring-2', 'ring-green-400/40'), 2000);
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">psychology</span> Mejorar propuesta';
        btn.setAttribute('onclick', `Developer._improveActivityDesc('${actId}')`);
      }
      Toast.show('Descripción generada', 'ok');
    } catch (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-sm">auto_awesome</span> Generar borrador IA'; }
      Toast.show('Error: ' + e.message, 'error');
    }
  }

  async function improveActivityDesc(actId) {
    const chatKey = 'actdesc_' + actId;
    const panel = document.getElementById('prep-chat-' + chatKey);
    if (panel) panel.classList.remove('hidden');
    resetFieldChat(chatKey, `Developer._sendActivityDescChat('${actId}')`);
    showFieldTyping(chatKey);
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/activity/' + actId + '/improve-description', { message: '__START_IMPROVE__' });
      removeFieldTyping(chatKey);
      const data = res.data || res;
      if (data.follow_up) renderFieldChatBubble(chatKey, 'assistant', data.follow_up);
    } catch (e) {
      removeFieldTyping(chatKey);
      console.error('[chat error]', chatKey, e);
      renderFieldChatBubble(chatKey, 'assistant', 'Error: ' + (e?.message || e?.code || JSON.stringify(e)));
    }
  }

  async function sendActivityDescChat(actId) {
    const chatKey = 'actdesc_' + actId;
    const input = document.getElementById('prep-chat-input-' + chatKey);
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    renderFieldChatBubble(chatKey, 'user', msg);
    showFieldTyping(chatKey);
    try {
      const res = await API.post('/developer/projects/' + currentProject.id + '/prep/activity/' + actId + '/improve-description', { message: msg });
      removeFieldTyping(chatKey);
      const data = res.data || res;
      if (data.revised_text) {
        const ta = document.getElementById('prep-act-ta-' + actId);
        if (ta) {
          ta.value = data.revised_text;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.classList.add('ring-2', 'ring-green-400/40');
          setTimeout(() => ta.classList.remove('ring-2', 'ring-green-400/40'), 2000);
        }
        renderFieldChatBubble(chatKey, 'assistant', 'He mejorado el texto. Puedes seguir editandolo directamente.');
        const inputArea = document.getElementById('prep-chat-input-area-' + chatKey);
        if (inputArea) inputArea.innerHTML = `<p class="text-xs text-green-600 font-semibold text-center py-2"><span class="material-symbols-outlined text-sm align-middle">check_circle</span> Mejora completada</p>`;
        Toast.show('Descripción mejorada', 'ok');
      } else if (data.follow_up) {
        renderFieldChatBubble(chatKey, 'assistant', data.follow_up);
      }
    } catch (e) {
      removeFieldTyping(chatKey);
      console.error('[chat error]', chatKey, e);
      renderFieldChatBubble(chatKey, 'assistant', 'Error: ' + (e?.message || e?.code || JSON.stringify(e)));
    }
  }

  /* ── Sub-tab: Tareas ────────────────────────────────────────────── */
  async function renderPrepTareas(el) {
    const pid = currentProject.id;
    el.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-headline text-base font-bold">Tareas del proyecto</h3>
            <p class="text-xs text-on-surface-variant">Desglose de tareas, entregables y milestones por actividad.</p>
          </div>
        </div>
        <div id="prep-tasks-container"></div>
      </div>`;

    // Render tasks using IntakeTasks module
    if (typeof IntakeTasks !== 'undefined') {
      // Ensure Calculator is initialized with project data
      if (typeof Calculator !== 'undefined') {
        try {
          const projData = await API.get('/intake/projects/' + pid);
          const partnerList = await API.get('/intake/projects/' + pid + '/partners');
          await Calculator.initFromIntake(projData, partnerList || []);
        } catch (e) { console.error('tasks calc init:', e); }
      }
      IntakeTasks.render(document.getElementById('prep-tasks-container'), pid);
    } else {
      el.querySelector('#prep-tasks-container').innerHTML = `
        <div class="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
          <span class="material-symbols-outlined text-4xl text-amber-400 mb-2">checklist</span>
          <h3 class="font-headline text-base font-bold text-amber-800 mb-1">Tareas no disponibles</h3>
          <p class="text-sm text-amber-700">Define Work Packages y actividades en el Intake primero.</p>
        </div>`;
    }
  }

  /* ── Sub-tab: Entregables (Deliverables & Milestones) ────────── */

  const PREP_DEL_TYPES         = ['R','DEM','DEC','DATA','DMP','ETHICS','SECURITY','OTHER'];
  const PREP_DEL_DISSEM_LEVELS = ['PU','SEN','R-UE/EU-R','C-UE/EU-C','S-UE/EU-S'];

  async function renderPrepEntregables(el) {
    const pid = currentProject.id;
    el.innerHTML = `
      <div>
        <div class="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div class="flex-1 min-w-[280px]">
            <h3 class="font-headline text-base font-bold">Entregables y Milestones</h3>
            <p class="text-xs text-on-surface-variant">Cap de 15 entregables por proyecto (regla EACEA). Los milestones se generan automáticamente: 1 por entregable + lanzamiento (M1) y reporte final.</p>
          </div>
          <div id="prep-del-summary" class="text-right text-xs text-on-surface-variant"></div>
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <button id="prep-del-auto" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors">
            <span class="material-symbols-outlined text-sm">auto_awesome</span> Auto-distribuir desde actividades
          </button>
          <button id="prep-ms-auto" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-secondary/90 transition-colors">
            <span class="material-symbols-outlined text-sm">flag</span> Auto-generar milestones
          </button>
          <span class="text-[11px] text-on-surface-variant/60 ml-2">Estas acciones reemplazan los entregables/milestones actuales del proyecto.</span>
        </div>
        <div id="prep-del-content" class="space-y-6"></div>
      </div>`;

    document.getElementById('prep-del-auto').addEventListener('click', () => _prepDelAutoDistribute(pid));
    document.getElementById('prep-ms-auto').addEventListener('click', () => _prepMsAutoGenerate(pid));

    await _prepDelLoad(pid);
  }

  async function _prepDelLoad(pid) {
    const host = document.getElementById('prep-del-content');
    if (!host) return;
    host.innerHTML = '<p class="text-xs text-on-surface-variant/60 italic">Cargando…</p>';
    let summary, delivs, miles, partners;
    try {
      [summary, delivs, miles, partners] = await Promise.all([
        API.get(`/developer/projects/${pid}/deliverables/summary`),
        API.get(`/developer/projects/${pid}/deliverables`),
        API.get(`/developer/projects/${pid}/milestones`),
        _wpFetchPartners(pid).catch(() => []),
      ]);
    } catch (err) {
      host.innerHTML = `<p class="text-error text-xs">Error: ${esc(err.message || '')}</p>`;
      return;
    }
    const cap = summary.hard_cap || 15;
    const dCount = summary.deliverables_count || 0;
    const mCount = summary.milestones_count || 0;
    const overCap = dCount > cap;
    const summaryEl = document.getElementById('prep-del-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="font-bold text-base ${overCap ? 'text-error' : (dCount === cap ? 'text-amber-600' : 'text-primary')}">${dCount}/${cap} entregables</div>
        <div class="text-[11px]">${mCount} milestones</div>
        ${overCap ? '<div class="text-[10px] text-error font-bold mt-0.5">Por encima del cap recomendado</div>' : ''}`;
    }

    if (!delivs.length && !miles.length) {
      host.innerHTML = `
        <div class="bg-surface-container-low rounded-2xl border border-outline-variant/30 p-8 text-center">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">inventory_2</span>
          <h3 class="font-headline text-base font-bold mb-1">Aún no hay entregables</h3>
          <p class="text-sm text-on-surface-variant mb-4">Pulsa <strong>Auto-distribuir desde actividades</strong> para generar una propuesta a partir de las actividades del proyecto. Después puedes editar cada fila o reasignar a otro WP.</p>
        </div>`;
      return;
    }

    // Group by WP
    const byWp = {};
    const wpMeta = {};
    for (const d of delivs) {
      const k = d.work_package_id;
      (byWp[k] ||= { delivs: [], miles: [] }).delivs.push(d);
      wpMeta[k] = { code: d.wp_code, title: d.wp_title, order: d.wp_order_index };
    }
    for (const m of miles) {
      const k = m.work_package_id;
      (byWp[k] ||= { delivs: [], miles: [] }).miles.push(m);
      if (!wpMeta[k]) wpMeta[k] = { code: m.wp_code, title: m.wp_title, order: m.wp_order_index };
    }
    const wpIds = Object.keys(byWp).sort((a, b) => (wpMeta[a].order ?? 99) - (wpMeta[b].order ?? 99));

    const partnerSelect = (selectedId, name) => {
      const opts = ['<option value="">— sin asignar —</option>']
        .concat(partners.map(p => `<option value="${esc(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name || '')}</option>`)).join('');
      return `<select data-prep-partner="${name}" class="w-full px-1.5 py-1 text-[11px] border border-outline-variant/30 rounded">${opts}</select>`;
    };

    host.innerHTML = wpIds.map(wpId => {
      const blk = byWp[wpId];
      const meta = wpMeta[wpId];
      return `
      <div class="rounded-xl border border-outline-variant/30 bg-white p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">${esc(meta.code || '')}</span>
          <span class="font-semibold text-sm">${esc(meta.title || '')}</span>
          <span class="text-[11px] text-on-surface-variant ml-auto">${blk.delivs.length} entregables · ${blk.miles.length} milestones</span>
        </div>

        <h4 class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mt-2 mb-1">Deliverables</h4>
        ${blk.delivs.length ? `
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead class="bg-primary/5">
                <tr>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-16">Code</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-44">Título</th>
                  <th class="text-left p-1.5 border border-outline-variant/30">Descripción</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-20">Tipo</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-24">Disem.</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-16">Mes</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-32">Lead</th>
                  <th class="border border-outline-variant/30 w-8"></th>
                </tr>
              </thead>
              <tbody>
                ${blk.delivs.map(d => `
                  <tr data-prep-d-row="${esc(d.id)}" class="align-top">
                    <td class="p-1 border border-outline-variant/30 font-mono"><input data-prep-d="code" data-id="${esc(d.id)}" value="${esc(d.code || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30"><input data-prep-d="title" data-id="${esc(d.id)}" value="${esc(d.title || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30"><textarea data-no-voice="1" data-prep-d="description" data-id="${esc(d.id)}" rows="1" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded resize-none">${esc(d.description || '')}</textarea></td>
                    <td class="p-1 border border-outline-variant/30">
                      <select data-prep-d="type" data-id="${esc(d.id)}" class="w-full px-1 py-0.5 text-[11px] border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
                        <option value="">—</option>
                        ${PREP_DEL_TYPES.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                      </select>
                    </td>
                    <td class="p-1 border border-outline-variant/30">
                      <select data-prep-d="dissemination_level" data-id="${esc(d.id)}" class="w-full px-1 py-0.5 text-[11px] border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
                        <option value="">—</option>
                        ${PREP_DEL_DISSEM_LEVELS.map(l => `<option value="${l}" ${d.dissemination_level === l ? 'selected' : ''}>${l}</option>`).join('')}
                      </select>
                    </td>
                    <td class="p-1 border border-outline-variant/30"><input type="number" min="1" max="60" data-prep-d="due_month" data-id="${esc(d.id)}" value="${d.due_month || ''}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30">
                      <select data-prep-d="lead_partner_id" data-id="${esc(d.id)}" class="w-full px-1 py-0.5 text-[11px] border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
                        <option value="">—</option>
                        ${partners.map(p => `<option value="${esc(p.id)}" ${p.id === d.lead_partner_id ? 'selected' : ''}>${esc(p.name || '')}</option>`).join('')}
                      </select>
                    </td>
                    <td class="p-1 border border-outline-variant/30 text-center"><button data-prep-d-del="${esc(d.id)}" class="text-on-surface-variant hover:text-error" title="Eliminar"><span class="material-symbols-outlined text-sm">close</span></button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="text-[11px] italic text-on-surface-variant/60">Sin entregables en este WP.</p>'}

        <h4 class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mt-4 mb-1">Milestones</h4>
        ${blk.miles.length ? `
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead class="bg-secondary/5">
                <tr>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-16">Code</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-44">Título</th>
                  <th class="text-left p-1.5 border border-outline-variant/30">Descripción</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-16">Mes</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-40">Verificación</th>
                  <th class="text-left p-1.5 border border-outline-variant/30 w-24">Liga D</th>
                  <th class="border border-outline-variant/30 w-8"></th>
                </tr>
              </thead>
              <tbody>
                ${blk.miles.map(m => `
                  <tr class="align-top">
                    <td class="p-1 border border-outline-variant/30 font-mono"><input data-prep-m="code" data-id="${esc(m.id)}" value="${esc(m.code || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30"><input data-prep-m="title" data-id="${esc(m.id)}" value="${esc(m.title || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30"><textarea data-no-voice="1" data-prep-m="description" data-id="${esc(m.id)}" rows="1" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded resize-none">${esc(m.description || '')}</textarea></td>
                    <td class="p-1 border border-outline-variant/30"><input type="number" min="1" max="60" data-prep-m="due_month" data-id="${esc(m.id)}" value="${m.due_month || ''}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30"><input data-prep-m="verification" data-id="${esc(m.id)}" value="${esc(m.verification || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
                    <td class="p-1 border border-outline-variant/30 text-[11px] font-mono text-on-surface-variant">${esc(m.deliverable_code || '—')}</td>
                    <td class="p-1 border border-outline-variant/30 text-center"><button data-prep-m-del="${esc(m.id)}" class="text-on-surface-variant hover:text-error" title="Eliminar"><span class="material-symbols-outlined text-sm">close</span></button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="text-[11px] italic text-on-surface-variant/60">Sin milestones en este WP.</p>'}
      </div>`;
    }).join('');

    // Wire inline editing
    host.querySelectorAll('[data-prep-d]').forEach(el => {
      const handler = () => _prepSaveDeliverable(el.dataset.id, el.dataset.prepD, el.value);
      el.addEventListener('change', handler);
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.addEventListener('blur', handler);
    });
    host.querySelectorAll('[data-prep-m]').forEach(el => {
      const handler = () => _prepSaveMilestone(el.dataset.id, el.dataset.prepM, el.value);
      el.addEventListener('change', handler);
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.addEventListener('blur', handler);
    });
    host.querySelectorAll('[data-prep-d-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este entregable? El milestone asociado conservará su entrada pero perderá la liga.')) return;
      try { await API.del(`/developer/deliverables/${b.dataset.prepDDel}`); await _prepDelLoad(pid); }
      catch (err) { alert(err.message || 'Error'); }
    }));
    host.querySelectorAll('[data-prep-m-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este milestone?')) return;
      try { await API.del(`/developer/milestones/${b.dataset.prepMDel}`); await _prepDelLoad(pid); }
      catch (err) { alert(err.message || 'Error'); }
    }));
  }

  async function _prepSaveDeliverable(id, fld, value) {
    const v = (fld === 'due_month') ? (value === '' ? null : parseInt(value, 10) || null) : value;
    try { await API.patch(`/developer/deliverables/${id}`, { [fld]: v }); }
    catch (err) { console.error('save deliverable', fld, err); }
  }

  async function _prepSaveMilestone(id, fld, value) {
    const v = (fld === 'due_month') ? (value === '' ? null : parseInt(value, 10) || null) : value;
    try { await API.patch(`/developer/milestones/${id}`, { [fld]: v }); }
    catch (err) { console.error('save milestone', fld, err); }
  }

  async function _prepDelAutoDistribute(pid) {
    if (!confirm('Esto REEMPLAZA todos los entregables actuales por una distribución automática derivada de tus actividades (cap 15). Los milestones quedarán huérfanos hasta que pulses "Auto-generar milestones". ¿Continuar?')) return;
    try {
      const res = await API.post(`/developer/projects/${pid}/deliverables/auto-distribute`, {});
      const data = res?.data || res;
      const msg = `${data.created} entregables creados · ${data.total_activities} actividades` + (data.compressed ? ' (modo compresión)' : '');
      if (typeof Toast !== 'undefined' && Toast.show) Toast.show(msg, 'ok');
      await _prepDelLoad(pid);
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _prepMsAutoGenerate(pid) {
    if (!confirm('Esto REEMPLAZA todos los milestones actuales por: lanzamiento (M1) + 1 milestone por entregable + reporte final. ¿Continuar?')) return;
    try {
      const res = await API.post(`/developer/projects/${pid}/milestones/auto-generate`, {});
      const data = res?.data || res;
      if (typeof Toast !== 'undefined' && Toast.show) Toast.show(`${data.created} milestones creados`, 'ok');
      await _prepDelLoad(pid);
    } catch (err) { alert(err.message || 'Error'); }
  }

  /* ── Sub-tab: Cronograma ────────────────────────────────────────── */
  async function renderPrepCronograma(el) {
    const pid = currentProject.id;
    el.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-headline text-base font-bold">Cronograma del proyecto</h3>
            <p class="text-xs text-on-surface-variant">Timeline visual de WPs y actividades. Ajusta fechas arrastrando las barras.</p>
          </div>
        </div>
        <div id="prep-gantt-container"></div>
      </div>`;

    // Render the Gantt chart using the IntakeGantt module
    if (typeof IntakeGantt !== 'undefined') {
      // Ensure Calculator is initialized with project data for the Gantt
      if (typeof Calculator !== 'undefined') {
        try {
          const projData = await API.get('/intake/projects/' + pid);
          const partnerList = await API.get('/intake/projects/' + pid + '/partners');
          console.log('[Prep Gantt] projData:', projData?.id, 'partners:', partnerList?.length);
          await Calculator.initFromIntake(projData, partnerList || []);
        } catch (e) { console.error('[Prep Gantt] calc init failed:', e); }
      }
      IntakeGantt.render(document.getElementById('prep-gantt-container'), pid);
    } else {
      el.querySelector('#prep-gantt-container').innerHTML = `
        <div class="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
          <span class="material-symbols-outlined text-4xl text-amber-400 mb-2">timeline</span>
          <h3 class="font-headline text-base font-bold text-amber-800 mb-1">Gantt no disponible</h3>
          <p class="text-sm text-amber-700">Define Work Packages y actividades en el Intake primero.</p>
        </div>`;
    }
  }

  async function handleDocUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', file.name.replace(/\.[^.]+$/, ''));
    try {
      await fetch('/v1/developer/projects/' + currentProject.id + '/research-docs', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + API.getToken() }, body: fd
      }).then(r => r.json());
      Toast.show('Documento subido y vectorizando...', 'ok');
      renderPrepStudio(); // Refresh
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
    e.target.value = '';
  }

  function bindInterviewAutosave() {
    document.querySelectorAll('#prep-interview-list textarea').forEach(ta => {
      let timer;
      ta.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const key = ta.dataset.key;
          try {
            await API.put('/developer/projects/' + currentProject.id + '/interview/' + key, { answer: ta.value });
          } catch (e) { console.error('interview save:', e); }
        }, 1500);
      });
    });
  }

  async function genInterview() {
    const btn = document.getElementById('prep-gen-interview-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="animate-spin w-4 h-4 border-2 border-[#fbff12] border-t-transparent rounded-full"></span> Generando preguntas...'; }
    try {
      await API.post('/developer/projects/' + currentProject.id + '/interview/generate', {});
      renderPrepStudio();
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  async function deleteDoc(docId) {
    if (!confirm('Eliminar este documento?')) return;
    try {
      await API.del('/developer/projects/' + currentProject.id + '/research-docs/' + docId);
      renderPrepStudio();
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 2: Draft Generation
     ══════════════════════════════════════════════════════════════ */

  const TIPS = [
    'Los evaluadores disponen de menos de 1 hora por propuesta. Tu primer parrafo decide si siguen leyendo con interes.',
    'El criterio de Relevancia pesa un 30% de la puntuacion total. Conecta cada objetivo con las prioridades de la convocatoria.',
    'Las propuestas ganadoras mencionan a TODOS los socios por nombre al menos una vez en las secciones clave.',
    'Un buen analisis de necesidades se basa en datos concretos: estadisticas, estudios previos, informes oficiales.',
    'La innovacion no significa inventar algo nuevo: puede ser transferir una practica exitosa a un nuevo contexto o grupo.',
    'El valor anadido europeo es la clave: explica por que tu proyecto no podria funcionar a nivel nacional.',
    'Los evaluadores buscan coherencia: que el presupuesto refleje lo que describes en la narrativa.',
    'Un consorcio fuerte no es solo grande: cada socio debe tener un rol claro y justificado.',
    'La metodologia debe ser especifica: "workshops participativos" no basta, describe formato, duracion y participantes.',
    'El plan de gestion debe incluir mecanismos concretos: reuniones periodicas, herramientas de seguimiento, indicadores.',
    'La diseminacion no es solo redes sociales: incluye eventos multiplicadores, publicaciones, redes profesionales.',
    'La sostenibilidad es lo que pasa DESPUES del proyecto: como perviven los resultados sin financiacion EU.',
    'Los Work Packages deben tener interdependencias claras: el output de uno alimenta el siguiente.',
    'Las tablas de riesgos mas valoradas incluyen riesgos REALES, no genericos. Se especifico.',
    'El coste-eficiencia no es gastar poco: es demostrar que cada euro produce el maximo impacto posible.',
    'Los indicadores SMART (especificos, medibles, alcanzables, relevantes, temporales) son obligatorios para cada objetivo.',
    'Una buena propuesta referencia al menos 3-5 documentos oficiales de la UE relevantes para su tematica.',
    'El impacto a largo plazo debe ser ambicioso pero realista: que cambiara en 5 anos gracias a tu proyecto.',
    'Los evaluadores valoran especialmente la participacion de jovenes en el diseno y la toma de decisiones del proyecto.',
    'La coherencia entre el formulario Part B y el presupuesto Part A es uno de los puntos mas revisados.',
  ];

  let _tipTimer = null;

  async function renderPhase2() {
    phase = 2;
    const el = document.getElementById('developer-content');

    // Initialize cascade position: find first section without approved text
    if (!cascadeApproved[flatSections[cascadeIndex]?.fieldId]) {
      for (let i = 0; i < flatSections.length; i++) {
        if (!cascadeApproved[flatSections[i].fieldId]) { cascadeIndex = i; break; }
      }
    }
    activeFieldId = flatSections[cascadeIndex]?.fieldId;

    const total = flatSections.length;
    const approved = Object.keys(cascadeApproved).length;
    const pct = Math.round((approved / total) * 100);

    el.innerHTML = renderPhaseTabs(2) + `
      <!-- Progress bar -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-bold text-on-surface-variant">Seccion ${cascadeIndex + 1} de ${total}</span>
          <span class="text-xs text-primary font-mono">${approved} aprobadas &middot; ${pct}%</span>
        </div>
        <div class="h-2 rounded-full bg-outline-variant/15 overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style="width:${pct}%"></div>
        </div>
      </div>

      <div class="flex gap-0 -mx-4 items-start">
        <!-- Left: Section nav -->
        <div class="w-56 shrink-0 border-r border-outline-variant/20 px-3 py-2" id="dev-cascade-nav"></div>
        <!-- Center: Editor -->
        <div class="flex-1 min-w-0 px-6 py-2" id="dev-cascade-main"></div>
        <!-- Right: AI panel -->
        <div class="w-72 shrink-0 border-l border-outline-variant/20 px-4 py-2" id="dev-ai-panel"></div>
      </div>`;

    renderCascadeNav();
    renderCascadeSection();
    renderAIPanel();
  }

  function renderCascadeNav() {
    const nav = document.getElementById('dev-cascade-nav');
    if (!nav) return;

    let currentParent = null;
    let html = '';
    for (let i = 0; i < flatSections.length; i++) {
      const sec = flatSections[i];
      const isApproved = cascadeApproved[sec.fieldId];
      const isCurrent = i === cascadeIndex;
      const isPending = !isApproved && !isCurrent;
      const val = fieldValues[sec.fieldId];
      const hasText = val && val.text && val.text.trim().length > 10;

      if (sec.parent && sec.parent !== currentParent) {
        currentParent = sec.parent;
        html += `<div class="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60 mt-4 mb-1 px-2">${sec.parentNumber}. ${esc(sec.parent)}</div>`;
      }

      const dotClass = isApproved ? 'text-green-500' : isCurrent ? 'text-amber-500 animate-pulse' : hasText ? 'text-amber-400' : 'text-outline-variant/40';
      const icon = isApproved ? 'check_circle' : isCurrent ? 'edit_note' : hasText ? 'edit' : 'radio_button_unchecked';
      const stateClass = isCurrent
        ? 'bg-primary/10 text-primary font-bold'
        : isApproved
          ? 'hover:bg-surface-container-low text-on-surface-variant'
          : hasText
            ? 'hover:bg-surface-container-low text-on-surface-variant'
            : 'hover:bg-surface-container-low text-on-surface-variant/60';

      html += `
        <button onclick="Developer._cascadeGoTo(${i})" class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${stateClass}">
          <span class="material-symbols-outlined text-xs ${dotClass}">${icon}</span>
          <span class="truncate">${sec.number} ${esc(sec.title.substring(0, 28))}</span>
        </button>`;
    }
    nav.innerHTML = html;
  }

  let _cascadeGenerating = false;
  const _cascadeWriteBlank = {};  // fieldId → true means user opted to write manually even without existing text

  function isWpFormSection(sec) {
    return sec && typeof sec.fieldId === 'string' && /^s4_2_wp_/.test(sec.fieldId);
  }

  async function renderCascadeSection() {
    const main = document.getElementById('dev-cascade-main');
    if (!main) return;

    const sec = flatSections[cascadeIndex];
    if (!sec) { showCelebration(); return; }

    activeFieldId = sec.fieldId;

    // WP sections (4.2.X) use a structured form with 5 tables instead
    // of a free-text editor. Header / Objectives / Tasks / Milestones /
    // Deliverables / Budget — directly mirroring Application Form Part B.
    if (isWpFormSection(sec)) {
      return renderWpFormSection(sec);
    }

    const val = fieldValues[sec.fieldId];
    const text = val?.text || '';
    const hasText = text.trim().length > 10;
    const isApproved = cascadeApproved[sec.fieldId];

    if (_cascadeGenerating) {
      // Generation in progress — show animated loader
      main.innerHTML = `
        <div class="mb-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">${sec.parentNumber ? sec.parentNumber + '. ' + esc(sec.parent) : 'Summary'}</div>
          <h2 class="font-headline text-lg font-bold text-on-surface">${sec.number} ${esc(sec.title)}</h2>
        </div>
        <div class="flex flex-col items-center py-12">
          <div class="relative w-16 h-16 mb-4">
            <div class="absolute inset-0 rounded-full bg-[#1b1464]/10 animate-pulse"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="material-symbols-outlined text-3xl text-[#1b1464]" style="animation:writePencil 1.5s ease-in-out infinite">edit_note</span>
            </div>
          </div>
          <p class="text-sm font-bold text-[#1b1464] mb-1">Generando seccion...</p>
          <p class="text-xs text-on-surface-variant mb-4">La IA escribe con todo el contexto del proyecto</p>
          <div class="bg-[#1b1464] rounded-xl p-4 max-w-md shadow-lg">
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-sm text-[#fbff12] mt-0.5">lightbulb</span>
              <p class="text-xs text-[#fbff12]/90 leading-relaxed" id="dev-cascade-tip">${TIPS[Math.floor(Math.random() * TIPS.length)]}</p>
            </div>
          </div>
        </div>
        <style>
          @keyframes writePencil {
            0%, 100% { transform: rotate(-5deg) translateY(0); }
            25% { transform: rotate(5deg) translateY(-3px); }
            50% { transform: rotate(-3deg) translateY(1px); }
            75% { transform: rotate(4deg) translateY(-2px); }
          }
        </style>`;
      clearInterval(_tipTimer);
      let tipIdx = 0;
      _tipTimer = setInterval(() => {
        tipIdx = (tipIdx + 1) % TIPS.length;
        const tipEl = document.getElementById('dev-cascade-tip');
        if (tipEl) {
          tipEl.style.opacity = '0';
          setTimeout(() => { tipEl.textContent = TIPS[tipIdx]; tipEl.style.opacity = '1'; }, 300);
          tipEl.style.transition = 'opacity 0.3s';
        }
      }, 4000);
      return;
    }

    if (!hasText && !_cascadeWriteBlank[sec.fieldId]) {
      // Empty section — invite the coordinator to generate manually
      main.innerHTML = `
        <div class="mb-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">${sec.parentNumber ? sec.parentNumber + '. ' + esc(sec.parent) : 'Summary'}</div>
          <h2 class="font-headline text-lg font-bold text-on-surface">${sec.number} ${esc(sec.title)}</h2>
        </div>
        <details class="mb-4 group" open>
          <summary class="text-xs font-bold text-primary cursor-pointer flex items-center gap-1">
            <span class="material-symbols-outlined text-xs group-open:rotate-90 transition-transform">chevron_right</span> Guia del formulario
          </summary>
          <div class="mt-2 text-xs text-on-surface-variant leading-relaxed bg-primary/5 rounded-lg p-3 border border-primary/10">
            ${sec.guidance ? sec.guidance.split('\n').map(g => '<p class="mb-1">' + esc(g) + '</p>').join('') : '<p>Sin guia disponible.</p>'}
          </div>
        </details>
        <div class="flex flex-col items-center text-center py-10 px-6 rounded-2xl bg-primary/5 border border-primary/10">
          <span class="material-symbols-outlined text-4xl text-primary mb-3">auto_awesome</span>
          <h3 class="font-headline text-base font-bold text-on-surface mb-1">Esta sección está vacía</h3>
          <p class="text-xs text-on-surface-variant max-w-md mb-5">Cuando pulses "Generar con IA", redactaré una primera propuesta con todo el contexto del proyecto. Después podrás iterar pidiendo mejoras concretas.</p>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button onclick="Developer._cascadeGenerate()" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1b1464] shadow-lg hover:bg-[#1b1464]/90 transition-all">
              <span class="material-symbols-outlined text-lg text-[#fbff12]">auto_awesome</span>
              <span class="text-white">Generar con IA</span>
            </button>
            <button onclick="Developer._cascadeWriteBlank()" class="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-[#1b1464] bg-white border border-[#1b1464]/30 hover:bg-[#1b1464]/5 transition-colors">
              <span class="material-symbols-outlined text-sm">edit</span>
              <span>Escribir yo mismo</span>
            </button>
          </div>
        </div>`;
      return;
    }

    // Has text — show review editor
    const wc = wordCount(text);

    main.innerHTML = `
      <div class="mb-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">${sec.parentNumber ? sec.parentNumber + '. ' + esc(sec.parent) : 'Summary'}</div>
        <h2 class="font-headline text-lg font-bold text-on-surface">${sec.number} ${esc(sec.title)}</h2>
      </div>

      <details class="mb-4 group" ${!hasText ? 'open' : ''}>
        <summary class="text-xs font-bold text-primary cursor-pointer flex items-center gap-1">
          <span class="material-symbols-outlined text-xs group-open:rotate-90 transition-transform">chevron_right</span> Guia del formulario
        </summary>
        <div class="mt-2 text-xs text-on-surface-variant leading-relaxed bg-primary/5 rounded-lg p-3 border border-primary/10">
          ${sec.guidance ? sec.guidance.split('\n').map(g => '<p class="mb-1">' + esc(g) + '</p>').join('') : '<p>Sin guia disponible.</p>'}
        </div>
      </details>

      <textarea id="dev-textarea" class="w-full px-4 py-3 text-sm bg-white border border-outline-variant/30 rounded-xl resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 leading-relaxed font-[system-ui]" style="min-height:350px" placeholder="Escribe o genera esta seccion con IA...">${esc(text)}</textarea>

      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-on-surface-variant" id="dev-cascade-wc">${wc} palabras</span>
      </div>
      <div id="dev-iteration-tracker" class="mb-4"></div>

      <!-- Action buttons -->
      <div class="flex items-center gap-3">
        ${cascadeIndex < flatSections.length - 1 ? `
          <button onclick="Developer._cascadeApprove()" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1b1464] hover:bg-[#1b1464]/90 shadow-lg hover:shadow-xl transition-all">
            <span class="material-symbols-outlined text-lg">check</span> Aprobar y siguiente
          </button>
          <button onclick="Developer._cascadeSkip()" class="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low transition-colors">
            Saltar
          </button>
        ` : `
          <button onclick="Developer._cascadeApprove()" class="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl transition-all">
            <span class="material-symbols-outlined text-lg">celebration</span> Finalizar borrador
          </button>
        `}
        ${isApproved ? '<span class="text-xs text-green-600 font-bold flex items-center gap-1"><span class="material-symbols-outlined text-sm">check_circle</span> Aprobada</span>' : ''}
      </div>`;

    renderIterationTracker(sec);

    // Bind textarea autosave + word count + auto-grow
    const textarea = document.getElementById('dev-textarea');
    if (textarea) {
      autoGrow(textarea);
      textarea.addEventListener('input', () => {
        autoGrow(textarea);
        clearTimeout(_saveTimer);
        const wcEl = document.getElementById('dev-cascade-wc');
        if (wcEl) wcEl.textContent = wordCount(textarea.value) + ' palabras';
        _saveTimer = setTimeout(() => {
          const newText = textarea.value;
          if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
          fieldValues[sec.fieldId].text = newText;
          API.put('/developer/instances/' + currentInstance.id + '/field', {
            field_id: sec.fieldId, section_path: sec.id, text: newText
          }).catch(err => console.error('autosave field:', err));
        }, 1500);
      });
    }
  }

  // Grow a textarea to fit its content so there's no inner scrollbar.
  // Runs twice via rAF + a delayed fallback because scrollHeight can be
  // under-reported before the browser has laid out the element (first paint
  // after innerHTML assignment, or when the textarea is mid-transition).
  function autoGrow(ta) {
    if (!ta) return;
    const resize = () => {
      ta.style.height = 'auto';
      const needed = ta.scrollHeight;
      if (needed > 0) ta.style.height = (needed + 4) + 'px';
    };
    resize();
    requestAnimationFrame(() => {
      resize();
      // Safety net: if layout/font loading delayed measurement, resize once more.
      setTimeout(resize, 80);
    });
  }

  // Re-fit the active textarea when the window resizes (responsive widths
  // change wrap, which changes scrollHeight).
  if (!window._devAutoGrowBound) {
    window._devAutoGrowBound = true;
    window.addEventListener('resize', () => {
      const ta = document.getElementById('dev-textarea');
      if (ta) autoGrow(ta);
    });
  }

  async function cascadeApproveAndNext() {
    const sec = flatSections[cascadeIndex];
    if (!sec) return;

    // Flush pending autosave + mark reviewed. WP form sections have no
    // textarea — fall back to whatever text was last persisted (or empty)
    // so the approval still sticks across sessions.
    clearTimeout(_saveTimer);
    const textarea = document.getElementById('dev-textarea');
    const text = textarea ? textarea.value : (fieldValues[sec.fieldId]?.text || '');
    if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
    fieldValues[sec.fieldId].text = text;
    fieldValues[sec.fieldId].reviewed = true;
    if (!fieldValues[sec.fieldId].json) fieldValues[sec.fieldId].json = {};
    fieldValues[sec.fieldId].json.reviewed = true;
    try {
      await API.put('/developer/instances/' + currentInstance.id + '/field', {
        field_id: sec.fieldId, section_path: sec.id, text,
        json: fieldValues[sec.fieldId].json
      });
    } catch (e) { console.error('save before approve:', e); }

    cascadeApproved[sec.fieldId] = true;
    cascadeIndex++;

    if (cascadeIndex >= flatSections.length) {
      showCelebration();
    } else {
      renderPhase2();
    }
  }

  function cascadeSkip() {
    cascadeIndex++;
    if (cascadeIndex >= flatSections.length) {
      showCelebration();
    } else {
      renderPhase2();
    }
  }

  function cascadeGoTo(targetIndex) {
    if (targetIndex === cascadeIndex) return;
    cascadeIndex = targetIndex;
    activeFieldId = flatSections[cascadeIndex]?.fieldId;
    renderCascadeNav();
    renderCascadeSection();
    renderAIPanel();
  }

  // True if editing this section would invalidate downstream work
  // (i.e. there are later sections already approved).
  function hasApprovedDownstream(fieldId) {
    const idx = flatSections.findIndex(s => s.fieldId === fieldId);
    if (idx < 0) return false;
    for (let i = idx + 1; i < flatSections.length; i++) {
      if (cascadeApproved[flatSections[i].fieldId]) return true;
    }
    return false;
  }

  // First-time generation for an empty section (invoked from the empty-state button)
  async function cascadeGenerate() {
    const sec = flatSections[cascadeIndex];
    if (!sec || !currentInstance) return;
    _cascadeGenerating = true;
    renderCascadeSection();
    try {
      const result = await API.post('/developer/instances/' + currentInstance.id + '/generate', { sections: [sec.fieldId] });
      const text = result[sec.fieldId] || '';
      if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
      fieldValues[sec.fieldId].text = text;
      fieldValues[sec.fieldId].section = sec.id;
    } catch (err) {
      console.error('Generate error:', err);
      alert('Error al generar: ' + (err.message || err));
    }
    _cascadeGenerating = false;
    clearInterval(_tipTimer);
    renderCascadeSection();
    renderCascadeNav();
    renderAIPanel();
  }

  // User chose "escribir yo mismo" — show the empty editor without generating
  function cascadeWriteBlank() {
    const sec = flatSections[cascadeIndex];
    if (!sec) return;
    _cascadeWriteBlank[sec.fieldId] = true;
    renderCascadeSection();
    renderAIPanel();
  }

  // Regenerate current section from scratch. Invoked from the "Regenerar desde cero"
  // button inside the Improve modal — the user has already committed to the action.
  async function cascadeRegenerate() {
    const sec = flatSections[cascadeIndex];
    if (!sec) return;
    if (hasApprovedDownstream(sec.fieldId)) {
      if (!confirm('Si regeneras esta sección, las posteriores ya aprobadas podrían necesitar regenerarse para mantener coherencia. ¿Continuar?')) return false;
    }
    const textarea = document.getElementById('dev-textarea');
    if (textarea) textarea.value = 'Generando con IA...';
    try {
      const result = await API.post('/developer/instances/' + currentInstance.id + '/generate', { sections: [sec.fieldId] });
      const text = result[sec.fieldId] || '';
      if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
      fieldValues[sec.fieldId].text = text;
      if (textarea) { textarea.value = text; autoGrow(textarea); }
      const wcEl = document.getElementById('dev-cascade-wc');
      if (wcEl) wcEl.textContent = wordCount(text) + ' palabras';
      renderCascadeNav();
      return true;
    } catch (err) {
      if (textarea) textarea.value = 'Error al generar: ' + (err.message || err);
      return false;
    }
  }

  // Called from the Improve modal's "Regenerar desde cero" button.
  // Closes the modal and delegates to cascadeRegenerate (which handles the
  // downstream-approved confirm).
  async function regenerateFromModal() {
    const btn = document.getElementById('improve-regen-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div><span>Regenerando...</span>';
    }
    const ok = await cascadeRegenerate();
    if (ok) closeImproveModal();
    else if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-base">restart_alt</span><span>Regenerar desde cero</span>';
    }
  }

  function showCelebration() {
    const el = document.getElementById('developer-content');
    if (!el) return;
    clearInterval(_tipTimer);

    const totalWords = flatSections.reduce((s, sec) => s + (fieldValues[sec.fieldId]?.text?.split(/\s+/).length || 0), 0);
    const approved = Object.keys(cascadeApproved).length;

    el.innerHTML = renderPhaseTabs(2) + `
      <div class="flex flex-col items-center text-center py-12 max-w-lg mx-auto">
        <div class="relative w-24 h-24 mb-6">
          <div class="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-30"></div>
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
            <span class="material-symbols-outlined text-5xl text-white">celebration</span>
          </div>
        </div>

        <h2 class="font-headline text-2xl font-extrabold text-on-surface mb-2">Borrador completado</h2>
        <p class="text-base text-on-surface-variant mb-6 max-w-md">
          Tu propuesta tiene <strong>${totalWords.toLocaleString('es-ES')} palabras</strong> en <strong>${flatSections.length} secciones</strong>.
          ${approved} secciones aprobadas de ${flatSections.length}.
        </p>

        <div class="grid grid-cols-3 gap-4 mb-8 w-full max-w-sm">
          <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div class="font-headline text-xl font-extrabold text-green-600">${approved}</div>
            <div class="text-[9px] uppercase tracking-wider text-green-700 font-bold">Aprobadas</div>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div class="font-headline text-xl font-extrabold text-green-600">${totalWords.toLocaleString('es-ES')}</div>
            <div class="text-[9px] uppercase tracking-wider text-green-700 font-bold">Palabras</div>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div class="font-headline text-xl font-extrabold text-green-600">${Math.round(approved / flatSections.length * 100)}%</div>
            <div class="text-[9px] uppercase tracking-wider text-green-700 font-bold">Completo</div>
          </div>
        </div>

        <div class="flex gap-3">
          <button onclick="Developer._phase(4)" class="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-bold text-base shadow-lg hover:scale-[1.03] transition-all">
            <span class="material-symbols-outlined text-xl">fact_check</span> Revision final
          </button>
          <button onclick="Developer._cascadeRestart()" class="inline-flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-bold text-on-surface-variant border border-outline-variant hover:bg-surface-container-low transition-colors">
            <span class="material-symbols-outlined text-lg">replay</span> Seguir editando
          </button>
        </div>
      </div>`;
  }

  function cascadeRestart() {
    cascadeIndex = 0;
    renderPhase2();
  }

  /* ── Phase 3 removed — absorbed into Phase 2 cascade ─────── */

  function renderAIPanel() {
    const panel = document.getElementById('dev-ai-panel');
    if (!panel) return;

    const sec = flatSections.find(s => s.fieldId === activeFieldId);
    if (!sec) { panel.innerHTML = ''; panel.style.display = ''; return; }

    // WP form sections (4.2.X) work with structured tables — the generic
    // "Improve / Refine" buttons don't apply. Hide the panel entirely so the
    // tables get full horizontal width.
    if (isWpFormSection(sec)) {
      panel.style.display = 'none';
      panel.innerHTML = '';
      return;
    }
    panel.style.display = '';

    panel.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-3">Panel de IA</h3>

      <!-- Criteria block removed by design: redundant with form guidance + AI eval pipeline -->
      ${false ? `
        <div class="mb-4">
          <div class="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Criterios de evaluacion</div>
          ${relevantCriteria.map(q => `
            <div class="mb-2 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/10">
              <div class="text-xs font-medium text-on-surface mb-1">${esc(q.title)}</div>
              ${(q.criteria || []).slice(0, 2).map(c => `
                <div class="text-[10px] text-on-surface-variant leading-snug mb-0.5">\u2022 ${esc(c.label)}</div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      ` : `
      `}

      <!-- AI actions -->
      <div class="space-y-2">
        <button onclick="Developer._aiImproveCustom()" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left text-white bg-[#1b1464] hover:bg-[#1b1464]/90 shadow-sm transition-colors">
          <span class="material-symbols-outlined text-base text-[#fbff12]">auto_awesome</span>
          <div>
            <div class="text-white">Mejorar con IA</div>
            <div class="text-[10px] font-normal text-white/75">Dile que quieres cambiar (voz o texto)</div>
          </div>
        </button>
        <button onclick="Developer._aiEvaluateAndRefine()" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-sm transition-colors">
          <span class="material-symbols-outlined text-base text-[#fbff12]">trending_up</span>
          <div>
            <div class="text-white">Evaluar y refinar con IA</div>
            <div class="text-[10px] font-normal text-white/80">Diagnóstico + arreglo automático</div>
          </div>
        </button>
      </div>

      <!-- AI response area -->
      <div class="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10 min-h-[100px] text-xs text-on-surface-variant" id="dev-ai-response">
        <span class="text-on-surface-variant/40 italic">Las respuestas de la IA apareceran aqui.</span>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 4: Final Review
     ══════════════════════════════════════════════════════════════ */
  function renderPhase4() {
    phase = 4;
    const el = document.getElementById('developer-content');

    const stats = flatSections.map(sec => {
      const val = fieldValues[sec.fieldId];
      const text = val?.text || '';
      const wc = wordCount(text);
      const reviewed = val?.reviewed;
      return { ...sec, wc, reviewed, hasText: wc > 10 };
    });

    const totalSections = stats.length;
    const completed = stats.filter(s => s.hasText).length;
    const reviewed = stats.filter(s => s.reviewed).length;
    const totalWords = stats.reduce((s, x) => s + x.wc, 0);

    el.innerHTML = renderPhaseTabs(4) + `
      <div class="max-w-4xl">
        <h2 class="font-headline text-xl font-bold mb-1">Revision final</h2>
        <p class="text-sm text-on-surface-variant mb-6">Revisa el estado de cada seccion antes de enviar al evaluador.</p>

        <!-- Summary cards -->
        <div class="grid grid-cols-4 gap-3 mb-8">
          <div class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 text-center">
            <div class="font-headline text-2xl font-extrabold text-primary">${completed}/${totalSections}</div>
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Secciones escritas</div>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 text-center">
            <div class="font-headline text-2xl font-extrabold text-green-600">${reviewed}</div>
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Revisadas</div>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 text-center">
            <div class="font-headline text-2xl font-extrabold text-on-surface">${totalWords.toLocaleString('es-ES')}</div>
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Palabras</div>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 text-center">
            <div class="font-headline text-2xl font-extrabold ${completed === totalSections ? 'text-green-600' : 'text-amber-500'}">${Math.round(completed / totalSections * 100)}%</div>
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Completado</div>
          </div>
        </div>

        <!-- Section table -->
        <div class="bg-white rounded-xl border border-outline-variant/20 overflow-hidden mb-8">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-outline-variant/20 bg-surface-container-lowest">
                <th class="text-left px-4 py-2 text-xs font-bold uppercase text-on-surface-variant">#</th>
                <th class="text-left px-4 py-2 text-xs font-bold uppercase text-on-surface-variant">Seccion</th>
                <th class="text-center px-4 py-2 text-xs font-bold uppercase text-on-surface-variant">Palabras</th>
                <th class="text-center px-4 py-2 text-xs font-bold uppercase text-on-surface-variant">Estado</th>
                <th class="text-center px-4 py-2 text-xs font-bold uppercase text-on-surface-variant">Accion</th>
              </tr>
            </thead>
            <tbody>
              ${stats.map(s => `
                <tr class="border-b border-outline-variant/10 hover:bg-surface-container-lowest/50">
                  <td class="px-4 py-2 text-xs font-mono text-on-surface-variant">${s.number}</td>
                  <td class="px-4 py-2 font-medium">${esc(s.title)}</td>
                  <td class="px-4 py-2 text-center text-xs font-mono">${s.wc}</td>
                  <td class="px-4 py-2 text-center">
                    ${s.reviewed ? '<span class="text-green-600 text-xs font-bold">Revisada</span>'
                      : s.hasText ? '<span class="text-amber-500 text-xs font-bold">Generada</span>'
                      : '<span class="text-outline-variant text-xs">Vacia</span>'}
                  </td>
                  <td class="px-4 py-2 text-center">
                    <button onclick="Developer._selectSection('${s.fieldId}');Developer._phase(2)" class="text-xs text-primary font-bold hover:underline">Editar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button onclick="Developer._phase(2)" class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-on-surface-variant border border-outline-variant hover:bg-surface-container-low transition-colors">
            <span class="material-symbols-outlined text-sm">edit_note</span> Seguir editando
          </button>
          <button onclick="Developer._sendToEvaluator()" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg transition-all ${completed < totalSections ? 'opacity-50' : ''}">
            <span class="material-symbols-outlined text-sm">verified</span> Enviar al evaluador
          </button>
        </div>
      </div>`;
  }

  /* ── Actions ───────────────────────────────────────────────── */
  function selectSection(fieldId) {
    const idx = flatSections.findIndex(s => s.fieldId === fieldId);
    if (idx >= 0 && phase === 2) {
      cascadeGoTo(idx);
    } else {
      activeFieldId = fieldId;
    }
  }

  async function generateField(fieldId) {
    const textarea = document.getElementById('dev-textarea');
    if (textarea) textarea.value = 'Generando con IA...';
    try {
      const result = await API.post('/developer/instances/' + currentInstance.id + '/generate', { sections: [fieldId] });
      const text = result[fieldId] || '';
      if (!fieldValues[fieldId]) fieldValues[fieldId] = {};
      fieldValues[fieldId].text = text;
      if (textarea) { textarea.value = text; autoGrow(textarea); }
      if (phase === 2) renderCascadeNav();
    } catch (err) {
      if (textarea) textarea.value = 'Error al generar: ' + (err.message || err);
    }
  }

  function markReviewed(fieldId) {
    if (!fieldValues[fieldId]) fieldValues[fieldId] = {};
    fieldValues[fieldId].reviewed = !fieldValues[fieldId].reviewed;
    if (phase === 2) { renderCascadeSection(); renderCascadeNav(); }
  }

  function goPhase(p) {
    switch (p) {
      case 11: renderGanttPhase(); break;
      case 2: renderPhase2(); break;
      case 3: renderPhase2(); break; // Phase 3 absorbed into cascade
      case 4: renderPhase4(); break;
    }
  }

  function goPrepTab(tab) {
    prepSubTab = tab;
    renderPrepStudio(tab);
  }

  /* ── Consorcio actions ──────────────────────────────────────── */
  let _customTextTimer = {};
  async function saveCustomText(partnerId, text) {
    clearTimeout(_customTextTimer[partnerId]);
    _customTextTimer[partnerId] = setTimeout(async () => {
      try {
        await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/custom-text', { custom_text: text });
      } catch (err) { Toast.show('Error saving: ' + err.message, 'err'); }
    }, 500);
  }

  let _staffSkillsTimer = {};
  async function saveStaffSkills(partnerId, staffId, text) {
    const key = partnerId + '_' + staffId;
    clearTimeout(_staffSkillsTimer[key]);
    _staffSkillsTimer[key] = setTimeout(async () => {
      try {
        await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/staff-skills', { staff_id: staffId, custom_skills: text });
      } catch (err) { Toast.show('Error saving: ' + err.message, 'err'); }
    }, 500);
  }

  async function toggleStaff(partnerId, staffId, selected) {
    try {
      await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/toggle-staff', { staff_id: staffId, selected });
      renderPrepTabContent('consorcio');
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  async function setStaffRole(partnerId, staffId, projectRole) {
    try {
      await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/staff-role', { staff_id: staffId, project_role: projectRole });
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  async function toggleEuProject(partnerId, euProjectId, selected) {
    try {
      await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/toggle-eu-project', { eu_project_id: euProjectId, selected });
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  async function linkOrg(partnerId) {
    // First load all available organizations to show them
    try {
      // organizations endpoint returns { ok, rows, meta } not { ok, data }
      const raw = await fetch('/v1/organizations?limit=50', { headers: { 'Authorization': 'Bearer ' + API.getToken() } }).then(r => r.json());
      const orgs = raw.rows || [];
      if (!orgs.length) { Toast.show('No hay organizaciones en el directorio. Crea una primero en la seccion Organizaciones.', 'err'); return; }

      const list = orgs.map((o, i) => `${i + 1}. ${o.organization_name} (${o.city || ''}, ${o.country || ''})`).join('\n');
      const picked = prompt('Selecciona la organizacion a vincular:\n\n' + list + '\n\nEscribe el numero:');
      if (!picked) return;
      const choice = parseInt(picked) - 1;
      if (isNaN(choice) || choice < 0 || choice >= orgs.length) { Toast.show('Seleccion invalida', 'err'); return; }

      await API.put('/developer/projects/' + currentProject.id + '/partners/' + partnerId + '/link-org', { organization_id: orgs[choice].id });
      Toast.show('Organizacion vinculada: ' + orgs[choice].organization_name, 'ok');
      renderPrepTabContent('consorcio');
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  async function selectVariant(partnerId, variantId) {
    try {
      await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/select-variant', { variant_id: variantId || null });
      renderPrepTabContent('consorcio');
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  const PIF_CATEGORIES = [
    { value: 'entrepreneurship', label: 'Emprendimiento', icon: 'rocket_launch' },
    { value: 'environment', label: 'Medio Ambiente', icon: 'eco' },
    { value: 'employability', label: 'Empleabilidad', icon: 'work' },
    { value: 'youth_policy', label: 'Politicas Juveniles', icon: 'how_to_vote' },
    { value: 'digital', label: 'Digital', icon: 'computer' },
    { value: 'inclusion', label: 'Inclusion Social', icon: 'diversity_3' },
    { value: 'culture', label: 'Cultura y Patrimonio', icon: 'palette' },
    { value: 'sport', label: 'Deporte y Salud', icon: 'fitness_center' },
    { value: 'education', label: 'Educacion', icon: 'school' },
  ];

  function generateVariant(partnerId) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[90vw] overflow-hidden border border-outline-variant/30">
        <div class="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
          <div>
            <h3 class="font-headline text-base font-bold text-primary">Generar variante de PIF</h3>
            <p class="text-xs text-on-surface-variant mt-0.5">Selecciona la tematica para adaptar el perfil de la organizacion</p>
          </div>
          <button class="pif-modal-close w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="p-4 grid grid-cols-3 gap-2">
          ${PIF_CATEGORIES.map(c => `
            <button class="pif-cat-btn flex flex-col items-center gap-1.5 p-3 rounded-xl border border-outline-variant/20 hover:bg-primary/5 hover:border-primary/30 transition-all text-center" data-cat="${c.value}" data-label="${c.label}">
              <span class="material-symbols-outlined text-xl text-primary">${c.icon}</span>
              <span class="text-[11px] font-bold text-on-surface">${c.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="px-4 pb-4">
          <div class="flex items-center gap-2">
            <input type="text" placeholder="O escribe una tematica personalizada..." class="pif-custom-input flex-1 px-3 py-2 text-sm border border-outline-variant/20 rounded-lg bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/15">
            <button class="pif-custom-btn inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-[#1b1464] bg-[#1b1464]/10 hover:bg-[#1b1464]/20 transition-colors">
              <span class="material-symbols-outlined text-sm">add</span> Crear
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.pif-modal-close').addEventListener('click', closeModal);

    overlay.querySelectorAll('.pif-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal();
        doGenerateVariant(partnerId, btn.dataset.cat, btn.dataset.label);
      });
    });

    overlay.querySelector('.pif-custom-btn').addEventListener('click', () => {
      const val = overlay.querySelector('.pif-custom-input').value.trim();
      if (!val) return;
      closeModal();
      doGenerateVariant(partnerId, 'custom', val);
    });
    overlay.querySelector('.pif-custom-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (!val) return;
        closeModal();
        doGenerateVariant(partnerId, 'custom', val);
      }
    });
  }

  async function doGenerateVariant(partnerId, category, categoryLabel) {
    Toast.show('Generando variante de PIF: ' + categoryLabel + '...', 'ok');
    try {
      await API.post('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/generate-variant', { category, category_label: categoryLabel });
      Toast.show('Variante "' + categoryLabel + '" generada', 'ok');
      renderPrepTabContent('consorcio');
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  async function addExtraStaff(partnerId) {
    try {
      await API.post('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/extra-staff');
      renderPrepTabContent('consorcio');
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  let _extraStaffTimer = {};
  function updateExtraStaff(partnerId, staffId, field, value) {
    const key = partnerId + '_' + staffId + '_' + field;
    clearTimeout(_extraStaffTimer[key]);
    _extraStaffTimer[key] = setTimeout(async () => {
      try {
        await API.put('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/extra-staff/' + staffId, { field, value });
      } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
    }, 500);
  }

  async function removeExtraStaff(partnerId, staffId) {
    try {
      await API.del('/developer/projects/' + currentProject.id + '/prep/consorcio/' + partnerId + '/extra-staff/' + staffId);
      renderPrepTabContent('consorcio');
    } catch (err) { Toast.show('Error: ' + err.message, 'err'); }
  }

  function goBack() { phase = 0; init(); }

  async function sendToEvaluator() {
    if (!currentProject) return;
    try {
      await API.patch('/intake/projects/' + currentProject.id + '/launch', {});
      await API.patch('/developer/instances/' + currentInstance.id + '/status', { status: 'complete' });
      Toast.show('Propuesta enviada al evaluador', 'ok');
      location.hash = 'evaluator';
    } catch (err) {
      Toast.show('Error: ' + (err.message || err), 'err');
    }
  }

  async function aiImprove() {
    const el = document.getElementById('dev-ai-response');
    const sec = flatSections.find(s => s.fieldId === activeFieldId);
    const text = document.getElementById('dev-textarea')?.value || '';
    if (!text || !sec) { if (el) el.innerHTML = '<span class="text-amber-500">Escribe algo primero.</span>'; return; }
    if (el) el.innerHTML = '<div class="flex items-center gap-2 text-primary"><div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div> Evaluando...</div>';
    try {
      const result = await API.post('/developer/instances/' + currentInstance.id + '/evaluate', {
        text, section_title: sec.number + ' ' + sec.title, criteria: []
      });
      const d = result;
      const badge = { excellent: 'text-green-600 bg-green-50', good: 'text-blue-600 bg-blue-50', fair: 'text-amber-600 bg-amber-50', weak: 'text-red-600 bg-red-50' };
      el.innerHTML = `
        <div class="mb-2"><span class="text-xs font-bold uppercase px-2 py-0.5 rounded ${badge[d.overall] || ''}">${d.overall || '?'}</span> ${d.score_estimate ? '<span class="text-xs text-on-surface-variant ml-1">' + d.score_estimate + '/10</span>' : ''}</div>
        ${(d.strengths || []).map(s => '<div class="text-xs text-green-700 mb-0.5">+ ' + esc(s) + '</div>').join('')}
        ${(d.weaknesses || []).map(s => '<div class="text-xs text-red-600 mb-0.5">- ' + esc(s) + '</div>').join('')}
        ${(d.suggestions || []).map(s => '<div class="text-xs text-primary mb-0.5">\u2192 ' + esc(s) + '</div>').join('')}
      `;
    } catch (err) { if (el) el.innerHTML = '<span class="text-error text-xs">Error: ' + esc(err.message || err) + '</span>'; }
  }


  /* ── Evaluate and Refine with AI: 3-act flow with pause between phases ── */
  const _refineNarratorLines = {
    phase1: [
      'Leyendo tu texto y contrastando con los criterios EACEA…',
      'Puntuando relevancia, metodología, impacto y coherencia…',
      'Identificando qué suma puntos y qué los resta…',
    ],
    phase2: [
      'Leyendo tu consorcio y las contribuciones de cada partner…',
      'Consultando la convocatoria (fragmentos más relevantes para esta sección)…',
      'Cruzando con los research docs que subiste…',
      'Reescribiendo con datos concretos de tu proyecto…',
      'Preservando los párrafos que ya funcionaban…',
      'Inyectando la rúbrica EACEA en el nuevo texto…',
    ],
    phase3: [
      'Re-evaluando contra los mismos criterios…',
      'Midiendo el delta frente a la versión anterior…',
      'Confirmando que no se ha perdido ninguna fortaleza…',
    ],
  };
  let _refineState = null;

  function _refineSetNarrator(el, lines) {
    const host = el.querySelector('.refine-narrator');
    if (!host) return;
    let i = 0;
    host.textContent = lines[0];
    clearInterval(host._t);
    host._t = setInterval(() => {
      i = (i + 1) % lines.length;
      host.style.opacity = '0';
      setTimeout(() => { host.textContent = lines[i]; host.style.opacity = '1'; }, 250);
    }, 2600);
  }
  function _refineStopNarrator(el) {
    const host = el && el.querySelector ? el.querySelector('.refine-narrator') : null;
    if (host && host._t) { clearInterval(host._t); host._t = null; }
  }
  function _scoreColor(s) {
    if (s == null) return 'text-on-surface-variant';
    if (s >= 8.5) return 'text-green-600';
    if (s >= 7) return 'text-blue-600';
    if (s >= 5.5) return 'text-amber-600';
    return 'text-red-600';
  }
  function _badgeClass(overall) {
    return ({ excellent: 'text-green-700 bg-green-100', good: 'text-blue-700 bg-blue-100', fair: 'text-amber-700 bg-amber-100', weak: 'text-red-700 bg-red-100' })[overall] || 'text-on-surface-variant bg-surface-container';
  }
  function _animateNumber(el, from, to, duration) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      el.textContent = v.toFixed(1);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = Number.isInteger(to) ? String(to) : to.toFixed(1);
    }
    requestAnimationFrame(tick);
  }

  async function aiEvaluateAndRefine() {
    const sec = flatSections.find(s => s.fieldId === activeFieldId);
    const textarea = document.getElementById('dev-textarea');
    const el = document.getElementById('dev-ai-response');
    const text = textarea ? textarea.value : '';
    if (!sec || !currentInstance) return;
    if (!text.trim() || text.trim().length < 50) {
      if (el) el.innerHTML = '<span class="text-amber-500">Genera el texto primero — no se puede evaluar algo vacío.</span>';
      return;
    }

    // PHASE 1 — Evaluating
    el.innerHTML = `
      <div class="flex flex-col gap-3 p-3 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/10">
        <div class="flex items-center gap-3">
          <div class="relative w-10 h-10">
            <div class="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl text-primary">radar</span>
            </div>
          </div>
          <div class="flex-1">
            <div class="text-[10px] uppercase tracking-wider text-primary font-bold">Acto 1 de 3</div>
            <div class="text-xs font-bold text-on-surface">Evaluando contra los criterios EACEA</div>
          </div>
        </div>
        <div class="refine-narrator text-[10px] italic text-on-surface-variant/80 transition-opacity duration-200" style="min-height:16px"></div>
      </div>`;
    _refineSetNarrator(el, _refineNarratorLines.phase1);

    let phase1;
    try {
      phase1 = await API.post('/developer/instances/' + currentInstance.id + '/refine/evaluate', {
        field_id: sec.fieldId, text,
      });
    } catch (err) {
      _refineStopNarrator(el);
      el.innerHTML = '<span class="text-error text-xs">Error al evaluar: ' + esc(err.message || err) + '</span>';
      return;
    }
    _refineStopNarrator(el);
    _refineState = { sec, text, evaluation: phase1 };
    _renderRefineDiagnosis(el, phase1);
  }

  function _renderRefineDiagnosis(el, ev) {
    const score = ev.score_estimate != null ? ev.score_estimate : null;
    const scoreCls = _scoreColor(score);
    const overallBadge = _badgeClass(ev.overall);
    const strengths = ev.strengths || [];
    const weaknesses = ev.weaknesses || [];
    const suggestions = ev.suggestions || [];
    const willTarget = (ev.would_target_weaknesses || []).map(w => w.toLowerCase());
    const canRefine = !ev.skip_reason;

    el.innerHTML = `
      <div class="flex flex-col gap-3 p-3 rounded-xl bg-white border border-outline-variant/20 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div class="text-lg font-extrabold ${scoreCls} leading-none">${score != null ? score : '?'}</div>
            <div class="text-[8px] uppercase tracking-wider text-on-surface-variant/60">/ 10</div>
          </div>
          <div class="flex-1">
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant/60 font-bold">Diagnóstico</div>
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${overallBadge}">${ev.overall || '?'}</span>
          </div>
        </div>

        ${strengths.length ? `
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">Fortalezas a conservar</div>
            ${strengths.slice(0, 4).map(s => '<div class="text-[11px] text-on-surface-variant mb-0.5 flex gap-1"><span class="text-green-600 font-bold">+</span><span>' + esc(s) + '</span></div>').join('')}
          </div>
        ` : ''}

        ${weaknesses.length ? `
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1">Debilidades identificadas</div>
            ${weaknesses.slice(0, 5).map(w => {
              const isTargeted = willTarget.indexOf(w.toLowerCase()) !== -1;
              return '<div class="text-[11px] mb-0.5 flex gap-1 items-start ' + (isTargeted ? 'bg-amber-50 border border-amber-200 rounded px-1 py-0.5' : '') + '">'
                + (isTargeted ? '<span class="material-symbols-outlined text-[14px] text-amber-600" title="Se atacará si pulsas Refinar">bolt</span>' : '<span class="text-red-500 font-bold">-</span>')
                + '<span class="text-on-surface-variant">' + esc(w) + '</span></div>';
            }).join('')}
          </div>
        ` : ''}

        ${suggestions.length ? `
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Sugerencias del evaluador</div>
            ${suggestions.slice(0, 3).map(s => '<div class="text-[11px] text-on-surface-variant mb-0.5 flex gap-1"><span class="text-primary">&rarr;</span><span>' + esc(s) + '</span></div>').join('')}
          </div>
        ` : ''}

        ${ev.skip_reason ? `
          <div class="text-[11px] text-on-surface-variant p-2 rounded bg-amber-50 border border-amber-100">${esc(ev.skip_reason)}</div>
        ` : ''}

        <div class="flex items-center gap-2 mt-1">
          <button onclick="Developer._refineStop()" class="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low">
            Me quedo así
          </button>
          ${canRefine ? `
            <button onclick="Developer._refineGo()" class="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 flex items-center justify-center gap-1 shadow-sm">
              <span class="material-symbols-outlined text-sm text-[#fbff12]">bolt</span>
              <span>Refinar con IA</span>
            </button>
          ` : ''}
        </div>
      </div>`;
  }

  function refineStop() {
    _refineState = null;
    const el = document.getElementById('dev-ai-response');
    if (el) el.innerHTML = '<span class="text-on-surface-variant/40 italic text-xs">Diagnóstico descartado. Pulsa "Evaluar y refinar con IA" cuando quieras otro.</span>';
  }

  async function refineGo() {
    if (!_refineState) return;
    const { sec, text, evaluation } = _refineState;
    const el = document.getElementById('dev-ai-response');
    const textarea = document.getElementById('dev-textarea');
    if (!el || !textarea || !currentInstance) return;

    if (hasApprovedDownstream(sec.fieldId)) {
      if (!confirm('Si refinas esta sección, las posteriores ya aprobadas podrían necesitar regenerarse para mantener coherencia. ¿Continuar?')) return;
    }

    // PHASE 2 — Rewriting
    const targets = (evaluation.would_target_weaknesses || []).slice(0, 2);
    el.innerHTML = `
      <div class="flex flex-col gap-3 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
        <div class="flex items-center gap-3">
          <div class="relative w-10 h-10">
            <div class="absolute inset-0 rounded-full bg-emerald-300/40 animate-pulse"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl text-emerald-700" style="animation:writePencil 1.5s ease-in-out infinite">edit_note</span>
            </div>
          </div>
          <div class="flex-1">
            <div class="text-[10px] uppercase tracking-wider text-emerald-700 font-bold" id="refine-act-label">Acto 2 de 3</div>
            <div class="text-xs font-bold text-on-surface" id="refine-act-title">Reescribiendo con correcciones dirigidas</div>
          </div>
        </div>
        <div class="refine-narrator text-[10px] italic text-emerald-800/70 transition-opacity duration-200" style="min-height:16px"></div>
        <div class="text-[10px] text-on-surface-variant/60">Atacando: ${targets.map(w => '<span class="inline-block bg-white border border-emerald-200 rounded px-1.5 py-0.5 mr-1 my-0.5">' + esc(w.substring(0, 60)) + (w.length > 60 ? '&hellip;' : '') + '</span>').join('')}</div>
      </div>`;
    _refineSetNarrator(el, _refineNarratorLines.phase2);

    let result;
    try {
      result = await API.post('/developer/instances/' + currentInstance.id + '/refine/apply', {
        field_id: sec.fieldId, text, evaluation,
      });
    } catch (err) {
      _refineStopNarrator(el);
      el.innerHTML = '<span class="text-error text-xs">Error al refinar: ' + esc(err.message || err) + '</span>';
      return;
    }

    // PHASE 3 — Validating (brief theatrical pause for the re-evaluation)
    _refineSetNarrator(el, _refineNarratorLines.phase3);
    const actLabel = document.getElementById('refine-act-label');
    const actTitle = document.getElementById('refine-act-title');
    if (actLabel) actLabel.textContent = 'Acto 3 de 3';
    if (actTitle) actTitle.textContent = 'Validando la mejora';
    await new Promise(r => setTimeout(r, 1200));
    _refineStopNarrator(el);

    if (textarea && result.text && !result.reverted) {
      textarea.value = result.text;
      autoGrow(textarea);
      if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
      fieldValues[sec.fieldId].text = result.text;

      if (!fieldValues[sec.fieldId].json) fieldValues[sec.fieldId].json = {};
      const iters = fieldValues[sec.fieldId].json.iterations || [];
      iters.push({
        ts: Date.now(),
        source: 'refine',
        before_score: result.before && result.before.score_estimate != null ? result.before.score_estimate : null,
        after_score: result.after && result.after.score_estimate != null ? result.after.score_estimate : null,
        delta: result.delta != null ? result.delta : null,
        weaknesses_targeted: (result.weaknesses_targeted || []).slice(0, 2),
      });
      fieldValues[sec.fieldId].json.iterations = iters;

      await API.put('/developer/instances/' + currentInstance.id + '/field', {
        field_id: sec.fieldId, section_path: sec.id,
        text: result.text,
        json: fieldValues[sec.fieldId].json,
      });
      renderIterationTracker(sec);
    }

    _renderRefineResult(el, result);
    _refineState = null;
  }

  function _renderRefineResult(el, result) {
    const before = result.before || {};
    const after = result.after || {};
    const beforeScore = before.score_estimate != null ? before.score_estimate : null;
    const afterScore = after.score_estimate != null ? after.score_estimate : null;
    const delta = result.delta;

    if (result.reverted) {
      el.innerHTML = `
        <div class="flex flex-col gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-amber-700">undo</span>
            <div class="text-xs font-bold text-amber-900">Texto original restaurado</div>
          </div>
          <div class="text-[11px] text-amber-900/80">${esc(result.note || 'La refinación no mejoró el texto; se descarta.')}</div>
          <div class="flex items-center gap-2 text-[11px] font-mono">
            <span class="${_scoreColor(beforeScore)}">${beforeScore != null ? beforeScore : '?'}/10</span>
            <span class="material-symbols-outlined text-sm text-on-surface-variant/40">arrow_forward</span>
            <span class="${_scoreColor(afterScore)} line-through opacity-60">${afterScore != null ? afterScore : '?'}/10</span>
            ${delta != null ? '<span class="text-red-600 font-bold">' + delta.toFixed(1) + '</span>' : ''}
          </div>
        </div>`;
      return;
    }

    const deltaHtml = delta != null
      ? (delta > 0 ? '<span class="text-green-600 font-bold text-sm">+' + delta.toFixed(1) + '</span>'
        : delta < 0 ? '<span class="text-red-600 font-bold text-sm">' + delta.toFixed(1) + '</span>'
        : '<span class="text-on-surface-variant text-sm">&plusmn;0</span>')
      : '';

    el.innerHTML = `
      <div class="flex flex-col gap-3 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 shadow-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-emerald-600">task_alt</span>
          <div class="text-xs font-bold uppercase tracking-wider text-emerald-700">Refinado completado</div>
        </div>
        <div class="flex items-center justify-center gap-3 p-2 rounded-lg bg-white border border-outline-variant/10">
          <div class="flex flex-col items-center">
            <div class="text-[8px] uppercase tracking-wider text-on-surface-variant/60 font-bold">Antes</div>
            <div class="text-lg font-extrabold ${_scoreColor(beforeScore)}">${beforeScore != null ? beforeScore : '?'}</div>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant/40">arrow_forward</span>
          <div class="flex flex-col items-center">
            <div class="text-[8px] uppercase tracking-wider text-on-surface-variant/60 font-bold">Después</div>
            <div class="text-2xl font-extrabold ${_scoreColor(afterScore)}" id="refine-score-after">${beforeScore != null ? beforeScore : (afterScore != null ? afterScore : '?')}</div>
          </div>
          <div class="flex flex-col items-center">
            <div class="text-[8px] uppercase tracking-wider text-on-surface-variant/60 font-bold">Delta</div>
            ${deltaHtml}
          </div>
        </div>
        ${(result.weaknesses_targeted || []).length ? `
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Debilidades resueltas</div>
            ${result.weaknesses_targeted.map(w => '<div class="text-[11px] text-on-surface-variant mb-0.5 flex gap-1 items-start"><span class="material-symbols-outlined text-[14px] text-emerald-600 mt-0.5">check_circle</span><span>' + esc(w) + '</span></div>').join('')}
          </div>
        ` : ''}
        <button onclick="Developer._aiEvaluateAndRefine()" class="mt-1 px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 flex items-center justify-center gap-1">
          <span class="material-symbols-outlined text-sm">autorenew</span>
          <span>Volver a evaluar y refinar</span>
        </button>
      </div>`;

    if (beforeScore != null && afterScore != null && beforeScore !== afterScore) {
      const afterEl = document.getElementById('refine-score-after');
      if (afterEl) _animateNumber(afterEl, beforeScore, afterScore, 1000);
    }
  }

  /* ── Legacy one-shot refine (kept as dead code; the UI no longer calls it) ── */
  async function aiRefine() {
    const sec = flatSections.find(s => s.fieldId === activeFieldId);
    const textarea = document.getElementById('dev-textarea');
    const el = document.getElementById('dev-ai-response');
    const text = textarea ? textarea.value : '';
    if (!sec || !currentInstance) return;
    if (!text.trim() || text.trim().length < 50) {
      if (el) el.innerHTML = '<span class="text-amber-500">Genera el texto primero — no se puede refinar algo vacío.</span>';
      return;
    }
    if (hasApprovedDownstream(sec.fieldId)) {
      if (!confirm('Si refinas esta sección, las posteriores ya aprobadas podrían necesitar regenerarse para mantener coherencia. ¿Continuar?')) return;
    }
    if (el) el.innerHTML = '<div class="flex items-center gap-2 text-primary"><div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div> Refinando con IA...</div>';
    try {
      const result = await API.post('/developer/instances/' + currentInstance.id + '/refine', { field_id: sec.fieldId, text });
      if (textarea && result.text && !result.reverted) {
        textarea.value = result.text;
        autoGrow(textarea);
        if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
        fieldValues[sec.fieldId].text = result.text;
        if (!fieldValues[sec.fieldId].json) fieldValues[sec.fieldId].json = {};
        const iters = fieldValues[sec.fieldId].json.iterations || [];
        iters.push({
          ts: Date.now(), source: 'refine',
          before_score: result.before && result.before.score_estimate != null ? result.before.score_estimate : null,
          after_score: result.after && result.after.score_estimate != null ? result.after.score_estimate : null,
          delta: result.delta != null ? result.delta : null,
          weaknesses_targeted: (result.weaknesses_targeted || []).slice(0, 2),
        });
        fieldValues[sec.fieldId].json.iterations = iters;
        await API.put('/developer/instances/' + currentInstance.id + '/field', {
          field_id: sec.fieldId, section_path: sec.id, text: result.text, json: fieldValues[sec.fieldId].json,
        });
        renderIterationTracker(sec);
      }

      // Render the before/after result panel
      const before = result.before || {};
      const after = result.after || {};
      const deltaStr = result.delta != null
        ? (result.delta > 0 ? `<span class="text-green-600 font-bold">+${result.delta.toFixed(1)}</span>`
          : result.delta < 0 ? `<span class="text-red-600 font-bold">${result.delta.toFixed(1)}</span>`
          : `<span class="text-on-surface-variant">±0</span>`)
        : '';
      const badge = { excellent: 'text-green-600 bg-green-50', good: 'text-blue-600 bg-blue-50', fair: 'text-amber-600 bg-amber-50', weak: 'text-red-600 bg-red-50' };
      if (el) {
        if (result.note) {
          el.innerHTML = `<div class="text-xs text-on-surface">${esc(result.note)}</div>`;
        } else {
          el.innerHTML = `
            <div class="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">Resultado</div>
            <div class="flex items-center gap-2 mb-3">
              <span class="text-xs font-mono">${before.score_estimate ?? '?'}/10</span>
              <span class="material-symbols-outlined text-sm text-on-surface-variant/50">arrow_forward</span>
              <span class="text-sm font-bold font-mono">${after.score_estimate ?? '?'}/10</span>
              <span class="ml-1">${deltaStr}</span>
              <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${badge[after.overall] || ''}">${after.overall || '?'}</span>
            </div>
            ${(result.weaknesses_targeted || []).length ? `
              <div class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 mb-1">Debilidades atacadas</div>
              ${result.weaknesses_targeted.map(w => '<div class="text-xs text-on-surface-variant mb-0.5">→ ' + esc(w) + '</div>').join('')}
              <div class="mt-2 text-[10px] text-on-surface-variant/60 italic">Pulsa "Refinar con IA" otra vez para seguir subiendo.</div>
            ` : ''}`;
        }
      }
    } catch (err) {
      if (el) el.innerHTML = '<span class="text-error text-xs">Error al refinar: ' + esc(err.message || err) + '</span>';
    }
  }

  /* ── Iteration tracker (score history under the textarea) ── */
  function renderIterationTracker(sec) {
    const host = document.getElementById('dev-iteration-tracker');
    if (!host) return;
    const iters = fieldValues[sec.fieldId]?.json?.iterations || [];
    if (!iters.length) { host.innerHTML = ''; return; }
    const pills = iters.slice(-6).map((it, idx) => {
      const arrow = it.delta > 0 ? '<span class="material-symbols-outlined text-[10px] text-green-600">trending_up</span>'
        : it.delta < 0 ? '<span class="material-symbols-outlined text-[10px] text-red-500">trending_down</span>'
        : '<span class="material-symbols-outlined text-[10px] text-on-surface-variant/40">trending_flat</span>';
      const fromTo = (it.before_score ?? '?') + ' → ' + (it.after_score ?? '?');
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant/20 text-[10px] font-mono text-on-surface-variant" title="${esc((it.weaknesses_targeted || []).join(' · '))}">
        v${iters.length - Math.min(5, iters.length - 1 - idx)} ${fromTo} ${arrow}
      </span>`;
    }).join('');
    host.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mt-1">
        <span class="text-[10px] uppercase tracking-wider text-on-surface-variant/60 font-bold">Historial</span>
        ${pills}
      </div>`;
  }

  /* ── Writer Phase 3: full WP form (Application Form Part B 4.2) ──
     Replaces the free-text editor for WP cascade sections.
     5 cards: Header / Objectives / Tasks / Milestones / Deliverables / Budget.
     ────────────────────────────────────────────────────────────── */

  const WP_DELIVERABLE_TYPES = ['R', 'DEM', 'DEC', 'DATA', 'DMP', 'ETHICS', 'SECURITY', 'OTHER'];
  const WP_DISSEMINATION_LEVELS = ['PU', 'SEN', 'R-UE/EU-R', 'C-UE/EU-C', 'S-UE/EU-S'];
  const WP_TASK_ROLES = ['COO', 'BEN', 'AE', 'AP', 'OTHER'];

  // Cache project partners per project (rebuilt when section changes project)
  let _wpPartnersCache = { projectId: null, list: [] };

  async function _wpFetchPartners(projectId) {
    if (!projectId) return [];
    if (_wpPartnersCache.projectId === projectId) return _wpPartnersCache.list;
    try {
      const list = await API.get(`/developer/projects/${projectId}/partners`);
      _wpPartnersCache = { projectId, list: list || [] };
      return _wpPartnersCache.list;
    } catch (err) {
      console.warn('[wp-form] partners fetch failed:', err);
      return [];
    }
  }

  function _wpFmtEur(n) {
    const v = Math.round(Number(n || 0));
    if (!v) return '—';
    return v.toLocaleString('es-ES') + ' €';
  }

  async function renderWpFormSection(sec) {
    const main = document.getElementById('dev-cascade-main');
    if (!main) return;
    const m = sec?.fieldId?.match(/^s4_2_wp_(.+)$/);
    if (!m) return;
    const wpId = m[1];
    const projectId = currentProject?.id || sec.wpMeta?.project_id;
    const isApproved = cascadeApproved[sec.fieldId];
    const isLast = cascadeIndex >= flatSections.length - 1;

    main.innerHTML = `
      <div class="mb-4 flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">${sec.parentNumber ? sec.parentNumber + '. ' + esc(sec.parent) : ''}</div>
          <h2 class="font-headline text-lg font-bold text-on-surface">${sec.number} ${esc(sec.title)}</h2>
          <p class="text-xs text-on-surface-variant mt-1">Tabla del Application Form Part B — sección 4.2. Cada celda corresponde a una columna del formulario oficial.</p>
        </div>
        <button id="wp-ai-fill-btn" onclick="Developer._wpAiFill('${esc(wpId)}')" class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-lg hover:shadow-xl transition-all">
          <span class="material-symbols-outlined text-lg text-yellow-200">auto_awesome</span>
          Rellenar con IA
        </button>
      </div>

      <div id="wp-card-header" class="rounded-xl border border-outline-variant/30 bg-white p-4 mb-4">Cargando cabecera…</div>
      <div id="wp-card-tasks" class="rounded-xl border border-outline-variant/30 bg-white p-4 mb-4">Cargando tasks…</div>
      <div id="wp-card-deliverables" class="rounded-xl border border-outline-variant/30 bg-white p-4 mb-4">Cargando deliverables…</div>
      <div id="wp-card-milestones" class="rounded-xl border border-outline-variant/30 bg-white p-4 mb-4">Cargando milestones…</div>
      <div id="wp-card-budget" class="rounded-xl border border-outline-variant/30 bg-white p-4 mb-6">Cargando budget…</div>

      <div class="flex items-center gap-3">
        <button onclick="Developer._cascadeApprove()" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1b1464] hover:bg-[#1b1464]/90 shadow-lg hover:shadow-xl transition-all">
          <span class="material-symbols-outlined text-lg">check</span> ${isLast ? 'Finalizar borrador' : 'Aprobar y siguiente'}
        </button>
        ${!isLast ? '<button onclick="Developer._cascadeSkip()" class="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low transition-colors">Saltar</button>' : ''}
        ${isApproved ? '<span class="text-xs text-green-600 font-bold flex items-center gap-1"><span class="material-symbols-outlined text-sm">check_circle</span> Aprobada</span>' : ''}
      </div>`;

    // Fire partners fetch in parallel with the cards so a slow/failing
    // partners endpoint can't block the WP data from loading. Each card
    // awaits the same promise and renders its own data first; partner-
    // dependent dropdowns degrade to "—" when partners are still loading.
    const partnersPromise = _wpFetchPartners(projectId);
    const wpCode = sec.wpMeta?.code || '';
    await Promise.all([
      _wpRenderHeaderCard(wpId, partnersPromise),
      _wpRenderTasksCard(wpId, partnersPromise, wpCode),
      _wpRenderMilestonesCard(wpId, partnersPromise),
      _wpRenderDeliverablesCard(wpId, partnersPromise, wpCode),
      _wpRenderBudgetCard(wpId),
    ]);
  }

  /* ── Card 1: Header (Title, Duration MX-MX, Lead, Objectives) ── */

  async function _wpRenderHeaderCard(wpId, partnersOrPromise) {
    const host = document.getElementById('wp-card-header');
    if (!host) return;
    let h, partners;
    try {
      [h, partners] = await Promise.all([
        API.get(`/developer/wp/${wpId}/header`),
        Promise.resolve(partnersOrPromise),
      ]);
    } catch (err) { host.innerHTML = `<span class="text-error text-xs">Error cargando cabecera: ${esc(err.message || '')}</span>`; return; }
    partners = partners || [];

    const partnerOptions = ['<option value="">— sin asignar —</option>']
      .concat(partners.map(p => `<option value="${esc(p.id)}" ${p.id === h.leader_id ? 'selected' : ''}>${esc(p.name || p.legal_name || '(sin nombre)')} ${p.country ? '(' + esc(p.country) + ')' : ''}</option>`))
      .join('');

    host.innerHTML = `
      <h3 class="text-sm font-bold text-primary flex items-center gap-1.5 mb-3">
        <span class="material-symbols-outlined text-base">summarize</span> Cabecera del Work Package
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <label class="text-[11px] font-bold text-on-surface-variant md:col-span-3">
          <span class="block mb-1">Work Package Name <span class="text-on-surface-variant/60 font-normal">(${esc(h.code || '')})</span></span>
          <input data-wp-fld="title" value="${esc(h.title || '')}" class="w-full px-3 py-2 text-sm bg-white border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15">
        </label>
        <label class="text-[11px] font-bold text-on-surface-variant">
          <span class="block mb-1">Duration — desde mes</span>
          <input type="number" min="1" max="60" data-wp-fld="duration_from_month" value="${h.duration_from_month || ''}" class="w-full px-3 py-2 text-sm bg-white border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15">
        </label>
        <label class="text-[11px] font-bold text-on-surface-variant">
          <span class="block mb-1">Duration — hasta mes</span>
          <input type="number" min="1" max="60" data-wp-fld="duration_to_month" value="${h.duration_to_month || ''}" class="w-full px-3 py-2 text-sm bg-white border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15">
        </label>
        <label class="text-[11px] font-bold text-on-surface-variant">
          <span class="block mb-1">Lead Beneficiary</span>
          <select data-wp-fld="leader_id" class="w-full px-3 py-2 text-sm bg-white border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15">${partnerOptions}</select>
        </label>
      </div>
      <label class="text-[11px] font-bold text-on-surface-variant block">
        <span class="block mb-1">Objectives <span class="text-on-surface-variant/60 font-normal">(lista de bullets — uno por línea)</span></span>
        <textarea data-no-voice="1" data-wp-fld="objectives" rows="3" class="w-full px-3 py-2 text-sm bg-white border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/15" placeholder="• Objetivo 1&#10;• Objetivo 2">${esc(h.objectives || '')}</textarea>
      </label>`;

    host.querySelectorAll('[data-wp-fld]').forEach(el => {
      el.addEventListener('change', () => _wpSaveHeader(wpId, el));
      if (el.tagName === 'TEXTAREA') el.addEventListener('blur', () => _wpSaveHeader(wpId, el));
    });
  }

  async function _wpSaveHeader(wpId, el) {
    const fld = el.dataset.wpFld;
    let value = el.value;
    if (fld === 'duration_from_month' || fld === 'duration_to_month') {
      value = value.trim() === '' ? null : parseInt(value, 10) || null;
    }
    try {
      await API.put(`/developer/wp/${wpId}/header`, { [fld]: value });
    } catch (err) { console.error('save wp header', fld, err); }
  }

  /* ── Card 2: Tasks (Activities and division of work) ──────── */

  async function _wpRenderTasksCard(wpId, partnersOrPromise, wpCode) {
    const host = document.getElementById('wp-card-tasks');
    if (!host) return;
    let rows, partners;
    try {
      [rows, partners] = await Promise.all([
        API.get(`/developer/wp/${wpId}/tasks`),
        Promise.resolve(partnersOrPromise),
      ]);
    } catch (err) { host.innerHTML = `<span class="text-error text-xs">Error cargando tasks: ${esc(err.message || '')}</span>`; return; }
    partners = partners || [];

    const wpNum = (wpCode || '').replace(/\D/g, '') || '1';
    host.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-base">task_alt</span> Activities and division of work (Tasks)
        </h3>
        <div class="flex items-center gap-3">
          <button onclick="Developer._wpResyncTasks('${esc(wpId)}', '${esc(wpNum)}')" class="text-xs font-bold text-secondary inline-flex items-center gap-1 hover:underline" title="Reemplaza las tasks de este WP por las que vienen de la pestaña Tareas + actividades">
            <span class="material-symbols-outlined text-sm">sync</span> Sincronizar desde Tareas
          </button>
          <button onclick="Developer._wpAddTask('${esc(wpId)}', '${esc(wpNum)}')" class="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline">
            <span class="material-symbols-outlined text-sm">add</span> Añadir task
          </button>
        </div>
      </div>
      ${rows.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead class="bg-primary/5">
            <tr>
              <th class="text-left p-2 border border-outline-variant/30 w-16">Task No</th>
              <th class="text-left p-2 border border-outline-variant/30 w-48">Task Name</th>
              <th class="text-left p-2 border border-outline-variant/30">Description</th>
              <th class="text-left p-2 border border-outline-variant/30 w-56">Participants</th>
              <th class="text-left p-2 border border-outline-variant/30 w-40">In-kind / Subcontracting</th>
              <th class="border border-outline-variant/30 w-8"></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((t, i) => _wpTaskRow(t, partners, wpNum, i + 1)).join('')}
          </tbody>
        </table>
      </div>` : '<p class="text-xs italic text-on-surface-variant/60">Sin tasks. Pulsa "Añadir task" para empezar.</p>'}`;

    host.querySelectorAll('[data-task-fld]').forEach(el => {
      const handler = () => _wpSaveTask(el.dataset.taskId, el.dataset.taskFld, el.value, el);
      el.addEventListener('change', handler);
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.addEventListener('blur', handler);
    });
    host.querySelectorAll('[data-task-del]').forEach(b => b.addEventListener('click', () => _wpDelTask(b.dataset.taskDel, wpId, partners, wpCode)));
    host.querySelectorAll('[data-task-part-toggle]').forEach(cb => cb.addEventListener('change', () => _wpToggleParticipant(cb.dataset.taskPartToggle, cb.dataset.partnerId, cb.checked, wpId, partners, wpCode)));
    host.querySelectorAll('[data-task-part-role]').forEach(sel => sel.addEventListener('change', () => _wpSetParticipantRole(sel.dataset.taskPartRole, sel.dataset.partnerId, sel.value, wpId, partners, wpCode)));
  }

  function _wpTaskRow(t, partners, wpNum, autoIdx) {
    const code = t.code || `T${wpNum}.${autoIdx}`;
    const partsByPartner = Object.fromEntries((t.participants || []).map(p => [p.partner_id, p]));
    const partsHtml = partners.length
      ? `<details class="text-[11px]"><summary class="cursor-pointer text-primary font-semibold">${(t.participants || []).length} partner(s)</summary>
          <div class="mt-1 space-y-1">
            ${partners.map(p => {
              const cur = partsByPartner[p.id];
              const checked = cur ? 'checked' : '';
              const role = cur?.role || 'BEN';
              return `<div class="flex items-center gap-1">
                <input type="checkbox" data-task-part-toggle="${esc(t.id)}" data-partner-id="${esc(p.id)}" ${checked}>
                <span class="flex-1 truncate">${esc(p.name || '')}</span>
                <select data-task-part-role="${esc(t.id)}" data-partner-id="${esc(p.id)}" ${cur ? '' : 'disabled'} class="text-[10px] border border-outline-variant/30 rounded px-1 py-0.5 bg-white">
                  ${WP_TASK_ROLES.map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </div>`;
            }).join('')}
          </div>
        </details>`
      : '<span class="text-[10px] italic text-on-surface-variant/60">Añade partners al proyecto</span>';

    return `<tr class="align-top">
      <td class="p-1.5 border border-outline-variant/30 font-mono text-[11px] text-on-surface-variant">
        <input data-task-fld="code" data-task-id="${esc(t.id)}" value="${esc(code)}" class="w-full px-1 py-0.5 text-[11px] font-mono bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
      </td>
      <td class="p-1.5 border border-outline-variant/30">
        <input data-task-fld="title" data-task-id="${esc(t.id)}" value="${esc(t.title || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
      </td>
      <td class="p-1.5 border border-outline-variant/30">
        <textarea data-no-voice="1" data-task-fld="description" data-task-id="${esc(t.id)}" rows="2" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded resize-none">${esc(t.description || '')}</textarea>
      </td>
      <td class="p-1.5 border border-outline-variant/30">${partsHtml}</td>
      <td class="p-1.5 border border-outline-variant/30">
        <input data-task-fld="in_kind_subcontracting" data-task-id="${esc(t.id)}" value="${esc(t.in_kind_subcontracting || '')}" placeholder="No / Yes (qué)" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
      </td>
      <td class="p-1 border border-outline-variant/30 text-center">
        <button data-task-del="${esc(t.id)}" class="text-on-surface-variant hover:text-error" title="Eliminar"><span class="material-symbols-outlined text-sm">close</span></button>
      </td>
    </tr>`;
  }

  async function _wpSaveTask(taskId, fld, value, el) {
    try {
      await API.patch(`/developer/tasks/${taskId}`, { [fld]: value });
    } catch (err) {
      console.error('save task', fld, err);
      if (el) el.classList.add('ring-1', 'ring-error');
    }
  }

  async function _wpAddTask(wpId, wpNum) {
    try {
      // Derive next index from current rows count for the suggested code
      const existing = await API.get(`/developer/wp/${wpId}/tasks`);
      const next = (existing?.length || 0) + 1;
      await API.post(`/developer/wp/${wpId}/tasks`, { title: 'Nueva task', code: `T${wpNum}.${next}` });
      const partners = currentProject?.id ? await _wpFetchPartners(currentProject.id) : [];
      await _wpRenderTasksCard(wpId, partners, `WP${wpNum}`);
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _wpResyncTasks(wpId, wpNum) {
    if (!confirm('Esto reemplaza TODAS las tasks de este WP por las que vienen de la pestaña Tareas + actividades. Tus participantes y ediciones manuales en esta tabla se perderán. ¿Continuar?')) return;
    try {
      const res = await API.post(`/developer/wp/${wpId}/tasks/resync`, {});
      const partners = currentProject?.id ? await _wpFetchPartners(currentProject.id) : [];
      await _wpRenderTasksCard(wpId, partners, `WP${wpNum}`);
      const n = res?.data?.seeded ?? res?.seeded ?? 0;
      if (typeof Toast !== 'undefined' && Toast.show) Toast.show(`${n} task(s) sincronizadas`, 'ok');
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _wpDelTask(taskId, wpId, partners, wpCode) {
    if (!confirm('¿Eliminar esta task?')) return;
    try {
      await API.del(`/developer/tasks/${taskId}`);
      await _wpRenderTasksCard(wpId, partners, wpCode);
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _wpToggleParticipant(taskId, partnerId, checked, wpId, partners, wpCode) {
    try {
      if (checked) {
        await API.put(`/developer/tasks/${taskId}/participants/${partnerId}`, { role: 'BEN' });
      } else {
        await API.del(`/developer/tasks/${taskId}/participants/${partnerId}`);
      }
      await _wpRenderTasksCard(wpId, partners, wpCode);
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _wpSetParticipantRole(taskId, partnerId, role, wpId, partners, wpCode) {
    try {
      await API.put(`/developer/tasks/${taskId}/participants/${partnerId}`, { role });
    } catch (err) { console.error('set role', err); }
  }

  /* ── Card 3: Milestones ──────────────────────────────────── */

  async function _wpRenderMilestonesCard(wpId, partnersOrPromise) {
    const host = document.getElementById('wp-card-milestones');
    if (!host) return;
    let rows, partners;
    try {
      [rows, partners] = await Promise.all([
        API.get(`/developer/wp/${wpId}/milestones`),
        Promise.resolve(partnersOrPromise),
      ]);
    } catch (err) { host.innerHTML = `<span class="text-error text-xs">Error cargando milestones: ${esc(err.message || '')}</span>`; return; }
    partners = partners || [];

    host.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-base">flag</span> Milestones
        </h3>
        <button onclick="Developer._wpAddMs('${esc(wpId)}')" class="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline">
          <span class="material-symbols-outlined text-sm">add</span> Añadir milestone
        </button>
      </div>
      ${rows.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead class="bg-primary/5">
            <tr>
              <th class="text-left p-2 border border-outline-variant/30 w-16">No</th>
              <th class="text-left p-2 border border-outline-variant/30 w-48">Name</th>
              <th class="text-left p-2 border border-outline-variant/30 w-40">Lead Beneficiary</th>
              <th class="text-left p-2 border border-outline-variant/30">Description</th>
              <th class="text-left p-2 border border-outline-variant/30 w-20">Due (M)</th>
              <th class="text-left p-2 border border-outline-variant/30 w-40">Means of Verification</th>
              <th class="border border-outline-variant/30 w-8"></th>
            </tr>
          </thead>
          <tbody>${rows.map((m, i) => _wpMsRow(m, partners, i + 1)).join('')}</tbody>
        </table>
      </div>` : '<p class="text-xs italic text-on-surface-variant/60">Sin milestones. Pulsa "Añadir milestone" para empezar.</p>'}`;

    host.querySelectorAll('[data-ms-fld]').forEach(el => {
      const handler = () => _wpSaveMs(el.dataset.msId, el.dataset.msFld, el.value, el);
      el.addEventListener('change', handler);
      if (el.tagName !== 'SELECT') el.addEventListener('blur', handler);
    });
    host.querySelectorAll('[data-ms-del]').forEach(b => b.addEventListener('click', () => _wpDelMs(b.dataset.msDel, wpId, partners)));
  }

  function _wpMsRow(m, partners, autoIdx) {
    const code = m.code || `MS${autoIdx}`;
    const partnerOptions = ['<option value="">—</option>']
      .concat(partners.map(p => `<option value="${esc(p.id)}" ${p.id === m.lead_partner_id ? 'selected' : ''}>${esc(p.name || '')}</option>`))
      .join('');
    return `<tr class="align-top">
      <td class="p-1.5 border border-outline-variant/30 font-mono text-[11px]">
        <input data-ms-fld="code" data-ms-id="${esc(m.id)}" value="${esc(code)}" class="w-full px-1 py-0.5 font-mono text-[11px] bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">
      </td>
      <td class="p-1.5 border border-outline-variant/30"><input data-ms-fld="title" data-ms-id="${esc(m.id)}" value="${esc(m.title || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
      <td class="p-1.5 border border-outline-variant/30"><select data-ms-fld="lead_partner_id" data-ms-id="${esc(m.id)}" class="w-full px-1 py-0.5 text-[11px] bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">${partnerOptions}</select></td>
      <td class="p-1.5 border border-outline-variant/30"><textarea data-no-voice="1" data-ms-fld="description" data-ms-id="${esc(m.id)}" rows="2" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded resize-none">${esc(m.description || '')}</textarea></td>
      <td class="p-1.5 border border-outline-variant/30"><input type="number" min="1" max="60" data-ms-fld="due_month" data-ms-id="${esc(m.id)}" value="${m.due_month || ''}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
      <td class="p-1.5 border border-outline-variant/30"><input data-ms-fld="verification" data-ms-id="${esc(m.id)}" value="${esc(m.verification || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
      <td class="p-1 border border-outline-variant/30 text-center"><button data-ms-del="${esc(m.id)}" class="text-on-surface-variant hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button></td>
    </tr>`;
  }

  async function _wpSaveMs(id, fld, value, el) {
    let payload = value;
    if (fld === 'due_month') payload = value.trim() === '' ? null : parseInt(value, 10) || null;
    try { await API.patch(`/developer/milestones/${id}`, { [fld]: payload }); }
    catch (err) { console.error('save ms', err); if (el) el.classList.add('ring-1', 'ring-error'); }
  }

  async function _wpAddMs(wpId) {
    try {
      const existing = await API.get(`/developer/wp/${wpId}/milestones`);
      const next = (existing?.length || 0) + 1;
      await API.post(`/developer/wp/${wpId}/milestones`, { title: 'Nuevo milestone', code: `MS${next}` });
      const partners = currentProject?.id ? await _wpFetchPartners(currentProject.id) : [];
      await _wpRenderMilestonesCard(wpId, partners);
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _wpDelMs(id, wpId, partners) {
    if (!confirm('¿Eliminar este milestone?')) return;
    try {
      await API.del(`/developer/milestones/${id}`);
      await _wpRenderMilestonesCard(wpId, partners);
    } catch (err) { alert(err.message || 'Error'); }
  }

  /* ── Card 4: Deliverables ───────────────────────────────── */

  async function _wpRenderDeliverablesCard(wpId, partnersOrPromise, wpCode) {
    const host = document.getElementById('wp-card-deliverables');
    if (!host) return;
    let rows, partners;
    try {
      [rows, partners] = await Promise.all([
        API.get(`/developer/wp/${wpId}/deliverables`),
        Promise.resolve(partnersOrPromise),
      ]);
    } catch (err) { host.innerHTML = `<span class="text-error text-xs">Error cargando deliverables: ${esc(err.message || '')}</span>`; return; }
    partners = partners || [];

    const wpNum = (wpCode || '').replace(/\D/g, '') || '1';
    host.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-base">deployed_code</span> Deliverables
        </h3>
        <button onclick="Developer._wpAddDl('${esc(wpId)}', '${esc(wpNum)}')" class="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline">
          <span class="material-symbols-outlined text-sm">add</span> Añadir deliverable
        </button>
      </div>
      ${rows.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead class="bg-primary/5">
            <tr>
              <th class="text-left p-2 border border-outline-variant/30 w-20">No</th>
              <th class="text-left p-2 border border-outline-variant/30 w-48">Name</th>
              <th class="text-left p-2 border border-outline-variant/30 w-40">Lead Beneficiary</th>
              <th class="text-left p-2 border border-outline-variant/30 w-28">Type</th>
              <th class="text-left p-2 border border-outline-variant/30 w-32">Dissem.</th>
              <th class="text-left p-2 border border-outline-variant/30 w-20">Due (M)</th>
              <th class="text-left p-2 border border-outline-variant/30">Description</th>
              <th class="border border-outline-variant/30 w-8"></th>
            </tr>
          </thead>
          <tbody>${rows.map((d, i) => _wpDlRow(d, partners, wpNum, i + 1)).join('')}</tbody>
        </table>
      </div>` : '<p class="text-xs italic text-on-surface-variant/60">Sin deliverables. Pulsa "Añadir deliverable" para empezar.</p>'}`;

    host.querySelectorAll('[data-dl-fld]').forEach(el => {
      const handler = () => _wpSaveDl(el.dataset.dlId, el.dataset.dlFld, el.value, el);
      el.addEventListener('change', handler);
      if (el.tagName !== 'SELECT') el.addEventListener('blur', handler);
    });
    host.querySelectorAll('[data-dl-del]').forEach(b => b.addEventListener('click', () => _wpDelDl(b.dataset.dlDel, wpId, partners, wpCode)));
  }

  function _wpDlRow(d, partners, wpNum, autoIdx) {
    const code = d.code || `D${wpNum}.${autoIdx}`;
    const partnerOptions = ['<option value="">—</option>']
      .concat(partners.map(p => `<option value="${esc(p.id)}" ${p.id === d.lead_partner_id ? 'selected' : ''}>${esc(p.name || '')}</option>`))
      .join('');
    const typeOptions = ['<option value="">—</option>']
      .concat(WP_DELIVERABLE_TYPES.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`)).join('');
    const dissOptions = ['<option value="">—</option>']
      .concat(WP_DISSEMINATION_LEVELS.map(l => `<option value="${l}" ${d.dissemination_level === l ? 'selected' : ''}>${l}</option>`)).join('');
    return `<tr class="align-top">
      <td class="p-1.5 border border-outline-variant/30 font-mono text-[11px]"><input data-dl-fld="code" data-dl-id="${esc(d.id)}" value="${esc(code)}" class="w-full px-1 py-0.5 font-mono text-[11px] bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
      <td class="p-1.5 border border-outline-variant/30"><input data-dl-fld="title" data-dl-id="${esc(d.id)}" value="${esc(d.title || '')}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
      <td class="p-1.5 border border-outline-variant/30"><select data-dl-fld="lead_partner_id" data-dl-id="${esc(d.id)}" class="w-full px-1 py-0.5 text-[11px] bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">${partnerOptions}</select></td>
      <td class="p-1.5 border border-outline-variant/30"><select data-dl-fld="type" data-dl-id="${esc(d.id)}" class="w-full px-1 py-0.5 text-[11px] bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">${typeOptions}</select></td>
      <td class="p-1.5 border border-outline-variant/30"><select data-dl-fld="dissemination_level" data-dl-id="${esc(d.id)}" class="w-full px-1 py-0.5 text-[11px] bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded">${dissOptions}</select></td>
      <td class="p-1.5 border border-outline-variant/30"><input type="number" min="1" max="60" data-dl-fld="due_month" data-dl-id="${esc(d.id)}" value="${d.due_month || ''}" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded"></td>
      <td class="p-1.5 border border-outline-variant/30"><textarea data-no-voice="1" data-dl-fld="description" data-dl-id="${esc(d.id)}" rows="2" class="w-full px-1 py-0.5 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded resize-none">${esc(d.description || '')}</textarea></td>
      <td class="p-1 border border-outline-variant/30 text-center"><button data-dl-del="${esc(d.id)}" class="text-on-surface-variant hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button></td>
    </tr>`;
  }

  async function _wpSaveDl(id, fld, value, el) {
    let payload = value;
    if (fld === 'due_month') payload = value.trim() === '' ? null : parseInt(value, 10) || null;
    try { await API.patch(`/developer/deliverables/${id}`, { [fld]: payload }); }
    catch (err) { console.error('save dl', err); if (el) el.classList.add('ring-1', 'ring-error'); }
  }

  async function _wpAddDl(wpId, wpNum) {
    try {
      const existing = await API.get(`/developer/wp/${wpId}/deliverables`);
      const next = (existing?.length || 0) + 1;
      await API.post(`/developer/wp/${wpId}/deliverables`, { title: 'Nuevo deliverable', code: `D${wpNum}.${next}` });
      const partners = currentProject?.id ? await _wpFetchPartners(currentProject.id) : [];
      await _wpRenderDeliverablesCard(wpId, partners, `WP${wpNum}`);
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function _wpDelDl(id, wpId, partners, wpCode) {
    if (!confirm('¿Eliminar este deliverable?')) return;
    try {
      await API.del(`/developer/deliverables/${id}`);
      await _wpRenderDeliverablesCard(wpId, partners, wpCode);
    } catch (err) { alert(err.message || 'Error'); }
  }

  /* ── Master AI fill: synthesise objectives + 3 tables in one go ── */

  async function _wpAiFill(wpId) {
    if (!confirm('La IA generará Objectives, Tasks, Milestones y Deliverables a partir del contexto del proyecto.\n\nLas filas existentes en este WP se REEMPLAZARÁN. ¿Continuar?')) return;
    const btn = document.getElementById('wp-ai-fill-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">progress_activity</span> Generando…';
      btn.classList.add('opacity-70');
    }
    try {
      await API.post(`/developer/wp/${wpId}/ai-fill`, {});
      // Re-render all WP cards with fresh data
      const projectId = currentProject?.id;
      const partners = projectId ? await _wpFetchPartners(projectId) : [];
      const sec = flatSections[cascadeIndex];
      const wpCode = sec?.wpMeta?.code || '';
      await Promise.all([
        _wpRenderHeaderCard(wpId, partners),
        _wpRenderTasksCard(wpId, partners, wpCode),
        _wpRenderMilestonesCard(wpId, partners),
        _wpRenderDeliverablesCard(wpId, partners, wpCode),
      ]);
    } catch (err) {
      alert('Error al generar con IA: ' + (err.message || ''));
    } finally {
      const b = document.getElementById('wp-ai-fill-btn');
      if (b) {
        b.disabled = false;
        b.innerHTML = '<span class="material-symbols-outlined text-lg text-yellow-200">auto_awesome</span> Rellenar con IA';
        b.classList.remove('opacity-70');
      }
    }
  }

  /* ── Card 5: Estimated budget — Resources (read-only pivot) ── */

  async function _wpRenderBudgetCard(wpId) {
    const host = document.getElementById('wp-card-budget');
    if (!host) return;
    let data;
    try { data = await API.get(`/developer/wp/${wpId}/budget`); }
    catch (err) { host.innerHTML = `<span class="text-error text-xs">Error: ${esc(err.message || '')}</span>`; return; }

    if (!data || !data.matched) {
      host.innerHTML = `
        <h3 class="text-sm font-bold text-primary flex items-center gap-1.5 mb-2">
          <span class="material-symbols-outlined text-base">payments</span> Estimated budget — Resources
        </h3>
        <p class="text-xs italic text-on-surface-variant/70">No hay presupuesto del Calculator vinculado a este WP. Genera el presupuesto en la Calculator y sincronízalo con el proyecto para ver esta tabla.</p>`;
      return;
    }

    const totals = {
      a_personnel: 0, b_subcontracting: 0, c1a_travel: 0, c1b_accommodation: 0, c1c_subsistence: 0,
      c2_equipment: 0, c3_other: 0, d1_third_parties: 0, e_indirect: 0, total: 0,
    };
    for (const r of data.rows) {
      for (const k of Object.keys(totals)) totals[k] += Number(r[k] || 0);
    }

    host.innerHTML = `
      <h3 class="text-sm font-bold text-primary flex items-center gap-1.5 mb-2">
        <span class="material-symbols-outlined text-base">payments</span> Estimated budget — Resources
        <span class="text-[10px] font-normal text-on-surface-variant/70 ml-1">(solo lectura — calcula desde el módulo Calculator)</span>
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] border-collapse">
          <thead class="bg-primary/5">
            <tr>
              <th class="text-left p-1.5 border border-outline-variant/30">Participant</th>
              <th class="text-right p-1.5 border border-outline-variant/30">A. Personnel</th>
              <th class="text-right p-1.5 border border-outline-variant/30">B. Subcontract.</th>
              <th class="text-right p-1.5 border border-outline-variant/30">C.1a Travel</th>
              <th class="text-right p-1.5 border border-outline-variant/30">C.1b Accom.</th>
              <th class="text-right p-1.5 border border-outline-variant/30">C.1c Subsist.</th>
              <th class="text-right p-1.5 border border-outline-variant/30">C.2 Equip.</th>
              <th class="text-right p-1.5 border border-outline-variant/30">C.3 Other</th>
              <th class="text-right p-1.5 border border-outline-variant/30">D.1 Third</th>
              <th class="text-right p-1.5 border border-outline-variant/30">E. Indirect (${data.indirect_pct || 0}%)</th>
              <th class="text-right p-1.5 border border-outline-variant/30 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.rows.map(r => `<tr>
              <td class="p-1.5 border border-outline-variant/30">${esc(r.acronym || r.name || '')}${r.is_coordinator ? ' <span class="text-[9px] text-primary font-bold">(COO)</span>' : ''}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.a_personnel)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.b_subcontracting)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.c1a_travel)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.c1b_accommodation)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.c1c_subsistence)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.c2_equipment)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.c3_other)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.d1_third_parties)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(r.e_indirect)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono font-bold">${_wpFmtEur(r.total)}</td>
            </tr>`).join('')}
            <tr class="bg-primary/5 font-bold">
              <td class="p-1.5 border border-outline-variant/30">Total</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.a_personnel)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.b_subcontracting)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.c1a_travel)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.c1b_accommodation)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.c1c_subsistence)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.c2_equipment)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.c3_other)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.d1_third_parties)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.e_indirect)}</td>
              <td class="p-1.5 border border-outline-variant/30 text-right font-mono">${_wpFmtEur(totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  /* ── Mejorar con IA: ask user what to improve (voice + text) ── */
  function aiImproveCustom() {
    const sec = flatSections.find(s => s.fieldId === activeFieldId);
    const textarea = document.getElementById('dev-textarea');
    const el = document.getElementById('dev-ai-response');
    const text = textarea?.value || '';
    if (!sec) { if (el) el.innerHTML = '<span class="text-amber-500">Selecciona una sección.</span>'; return; }
    if (!text.trim()) { if (el) el.innerHTML = '<span class="text-amber-500">Genera o escribe el texto antes de mejorarlo.</span>'; return; }
    openImproveModal(sec);
  }

  function openImproveModal(sec) {
    closeImproveModal();
    const modal = document.createElement('div');
    modal.id = 'improve-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeImproveModal(); });
    modal.innerHTML = `
      <div class="bg-surface rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-outline-variant/20">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">auto_awesome</span>
              Mejorar con IA
            </h2>
            <p class="text-xs text-on-surface-variant mt-1">${esc(sec.number + ' ' + sec.title)}</p>
          </div>
          <button onclick="Developer._closeImproveModal()" class="text-on-surface-variant hover:text-on-surface p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <label class="block text-sm font-medium text-on-surface mb-2">¿Qué te ha gustado y qué deberías mejorar?</label>
        <p class="text-xs text-on-surface-variant/70 mb-2">Cuéntame qué partes del texto quieres conservar y qué partes quieres cambiar. Puedes escribir o usar el micrófono. Podemos iterar tantas veces como haga falta.</p>
        <p class="text-[11px] text-on-surface-variant/60 mb-2 italic">Ejemplos: "me gusta el primer párrafo, mejora el segundo con más datos del territorio", "conserva el tono pero acorta el final", "enfatiza más el valor europeo y menciona a nuestra entidad coordinadora".</p>
        <textarea id="improve-request" rows="4" class="w-full px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Qué te ha gustado y qué hay que mejorar..."></textarea>
        <div class="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <button onclick="Developer._closeImproveModal()" class="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-low">Cancelar</button>
          <div class="flex items-center gap-2 ml-auto">
            <button onclick="Developer._regenerateFromModal()" id="improve-regen-btn" class="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title="Genera desde cero sin usar tus instrucciones ni el texto actual">
              <span class="material-symbols-outlined text-base">restart_alt</span>
              <span>Regenerar desde cero</span>
            </button>
            <button onclick="Developer._submitImproveRequest()" id="improve-submit-btn" class="px-4 py-2 rounded-lg text-sm font-bold bg-[#1b1464] text-white hover:bg-[#1b1464]/90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow">
              <span class="material-symbols-outlined text-base text-[#fbff12]">auto_awesome</span>
              <span>Mejorar texto</span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // VoiceInput auto-attaches the mic button via MutationObserver
    setTimeout(() => {
      const ta = document.getElementById('improve-request');
      if (ta) {
        ta.focus();
        ta.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitImproveRequest(); }
          else if (e.key === 'Escape') closeImproveModal();
        });
      }
    }, 50);
  }

  function closeImproveModal() {
    document.getElementById('improve-modal')?.remove();
  }

  async function submitImproveRequest() {
    const sec = flatSections.find(s => s.fieldId === activeFieldId);
    const textarea = document.getElementById('dev-textarea');
    const reqTa = document.getElementById('improve-request');
    const btn = document.getElementById('improve-submit-btn');
    const respEl = document.getElementById('dev-ai-response');
    const text = textarea?.value || '';
    const userRequest = (reqTa?.value || '').trim();
    if (!userRequest) { reqTa?.focus(); reqTa?.classList.add('ring-2','ring-error/40'); return; }
    if (!sec || !text || !currentInstance) return;

    if (hasApprovedDownstream(sec.fieldId)) {
      if (!confirm('Si mejoras esta sección, las posteriores ya aprobadas podrían necesitar regenerarse para mantener coherencia. ¿Continuar?')) return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div><span>Mejorando...</span>';
    }
    if (respEl) respEl.innerHTML = '<div class="flex items-center gap-2 text-primary"><div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div> Mejorando con tu petición...</div>';

    try {
      const result = await API.post('/developer/instances/' + currentInstance.id + '/improve-custom', {
        field_id: sec.fieldId,
        text,
        user_request: userRequest
      });
      if (textarea && result.text) {
        textarea.value = result.text;
        autoGrow(textarea);
        if (!fieldValues[sec.fieldId]) fieldValues[sec.fieldId] = {};
        fieldValues[sec.fieldId].text = result.text;

        if (!fieldValues[sec.fieldId].json) fieldValues[sec.fieldId].json = {};
        const iters = fieldValues[sec.fieldId].json.iterations || [];
        iters.push({
          ts: Date.now(),
          source: 'improve-custom',
          user_request: userRequest.substring(0, 200),
        });
        fieldValues[sec.fieldId].json.iterations = iters;

        await API.put('/developer/instances/' + currentInstance.id + '/field', {
          field_id: sec.fieldId, section_path: sec.id,
          text: result.text,
          json: fieldValues[sec.fieldId].json,
        });
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        renderIterationTracker(sec);
      }
      if (respEl) respEl.innerHTML = '<span class="text-green-600 text-xs">Texto mejorado con tu petición: "' + esc(userRequest.substring(0, 120)) + (userRequest.length > 120 ? '…' : '') + '"</span>';
      closeImproveModal();
    } catch (err) {
      if (respEl) respEl.innerHTML = '<span class="text-error text-xs">Error: ' + esc(err.message || err) + '</span>';
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-base">auto_awesome</span><span>Mejorar texto</span>';
      }
    }
  }

  /* ── Public API ────────────────────────────────────────────── */
  return {
    init,
    _back: goBack,
    _genInterview: genInterview,
    _deleteDoc: deleteDoc,
    _phase: goPhase,
    _prepTab: goPrepTab,
    _linkOrg: linkOrg,
    _selectVariant: selectVariant,
    _generateVariant: generateVariant,
    _saveCustomText: saveCustomText,
    _saveStaffSkills: saveStaffSkills,
    _toggleStaff: toggleStaff,
    _setStaffRole: setStaffRole,
    _toggleEuProject: toggleEuProject,
    _addExtraStaff: addExtraStaff,
    _updateExtraStaff: updateExtraStaff,
    _removeExtraStaff: removeExtraStaff,
    _saveRelContext: saveRelContext,
    _genFieldDraft: generateFieldDraft,
    _startImprove: startImprove,
    _sendFieldChat: sendFieldChat,
    _toggleFieldChat: toggleFieldChat,
    _genWpSummary: genWpSummary,
    _improveWpSummary: improveWpSummary,
    _sendWpSummaryChat: sendWpSummaryChat,
    _genActivityDesc: genActivityDesc,
    _improveActivityDesc: improveActivityDesc,
    _sendActivityDescChat: sendActivityDescChat,
    _selectSection: selectSection,
    _generateField: generateField,
    _markReviewed: markReviewed,
    _aiImprove: aiImprove,
    _aiImproveCustom: aiImproveCustom,
    _aiRefine: aiRefine,
    _aiEvaluateAndRefine: aiEvaluateAndRefine,
    _refineStop: refineStop,
    _refineGo: refineGo,
    _closeImproveModal: closeImproveModal,
    _submitImproveRequest: submitImproveRequest,
    _regenerateFromModal: regenerateFromModal,
    _sendToEvaluator: sendToEvaluator,
    // Cascade
    _cascadeApprove: cascadeApproveAndNext,
    _cascadeSkip: cascadeSkip,
    _cascadeGoTo: cascadeGoTo,
    _cascadeRegenerate: cascadeRegenerate,
    _cascadeGenerate: cascadeGenerate,
    _cascadeWriteBlank: cascadeWriteBlank,
    _cascadeRestart: cascadeRestart,
    // WP form (Application Form Part B 4.2)
    _wpAddTask: _wpAddTask,
    _wpResyncTasks: _wpResyncTasks,
    _wpAddMs: _wpAddMs,
    _wpAddDl: _wpAddDl,
    _wpAiFill: _wpAiFill,
  };
})();
