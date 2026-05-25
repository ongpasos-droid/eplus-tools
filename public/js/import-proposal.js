/* ═══════════════════════════════════════════════════════════════
   Importar proyecto — Puerta B (audit) / Puerta C (reciclaje).
   El usuario sube un Form Part B Word EACEA + selecciona la
   convocatoria del catálogo. La app crea un proyecto importado y
   redirige al panel Diagnóstico.
   ═══════════════════════════════════════════════════════════════ */

const ImportProposal = (() => {
  let state = {
    step: 'select',          // 'select' | 'upload' | 'uploading' | 'done' | 'error' | 'paste'
    programs: [],            // catalog
    programId: null,
    programObj: null,
    projectName: '',
    file: null,
    result: null,
    error: null,
    pasteFields: {},         // for paste mode
  };

  function init() {
    state.step = 'select';
    state.programs = [];
    state.programId = null;
    state.file = null;
    state.result = null;
    state.error = null;
    render();
    loadPrograms();
  }

  async function loadPrograms() {
    try {
      const resp = await API.get('/admin/data/programs');
      state.programs = (resp.data || resp || []).filter(p => p.active !== 0);
      render();
    } catch (e) {
      // If user is not admin/scribe, this endpoint is forbidden — fallback:
      // present a free text entry so the user can paste a program code.
      try {
        const resp2 = await API.get('/convocatorias');
        state.programs = (resp2.data || resp2 || []).map(c => ({
          id: c.id, program_id: c.program_id, name: c.name
        }));
      } catch (e2) {
        state.error = 'No se pudo cargar el catálogo de convocatorias.';
      }
      render();
    }
  }

  async function doUpload() {
    if (!state.file) { state.error = 'Sube un Word Form Part B.'; render(); return; }
    if (!state.programId) { state.error = 'Selecciona una convocatoria.'; render(); return; }

    state.step = 'uploading';
    state.error = null;
    render();

    const fd = new FormData();
    fd.append('file', state.file);
    fd.append('programId', state.programId);
    if (state.projectName) fd.append('projectName', state.projectName);

    try {
      const resp = await fetch('/v1/diagnose/upload-proposal', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (window.API?.token || localStorage.getItem('token')) },
        body: fd,
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error?.message || 'Upload failed');
      state.result = data.data;
      state.step = 'done';
      render();
    } catch (e) {
      state.step = 'error';
      state.error = e.message || String(e);
      render();
    }
  }

  async function doPaste() {
    if (!state.programId) { state.error = 'Selecciona una convocatoria.'; render(); return; }
    const fields = state.pasteFields || {};
    const filled = Object.entries(fields).filter(([_, v]) => (v || '').trim().length >= 30);
    if (filled.length === 0) {
      state.error = 'Pega contenido en al menos una sección (mínimo 30 caracteres).';
      render();
      return;
    }

    state.step = 'uploading';
    state.error = null;
    render();

    try {
      const resp = await API.post('/diagnose/paste-proposal', {
        programId: state.programId,
        projectName: state.projectName,
        fields: Object.fromEntries(filled),
      });
      state.result = resp;
      state.step = 'done';
      render();
    } catch (e) {
      state.step = 'error';
      state.error = e.message || String(e);
      render();
    }
  }

  /* ── Renderers ──────────────────────────────────────────────── */

  function render() {
    const root = document.getElementById('import-proposal-content');
    if (!root) return;

    if (state.step === 'uploading') {
      root.innerHTML = `
        <div class="text-center py-16">
          <span class="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          <p class="mt-3 text-sm text-on-surface-variant">Procesando el Form Part B…</p>
        </div>`;
      return;
    }

    if (state.step === 'done' && state.result) {
      renderDone(root);
      return;
    }

    root.innerHTML = `
      <div class="flex items-center gap-3 mb-6">
        <div class="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-green-600 text-2xl">upload_file</span>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-on-surface">Importar proyecto</h1>
          <p class="text-sm text-on-surface-variant">Sube tu Form Part B (Word) y diagnostícalo contra los patrones EACEA.</p>
        </div>
      </div>

      ${state.error ? `<div class="bg-error/10 border border-error/30 rounded-xl p-4 mb-4 text-sm text-error">${esc(state.error)}</div>` : ''}

      <!-- Step 1: program selector -->
      <div class="bg-surface border border-outline-variant/30 rounded-2xl p-5 mb-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</div>
          <h3 class="font-bold text-on-surface">Selecciona la convocatoria</h3>
        </div>
        <select id="ip-program" class="w-full border border-outline-variant/40 rounded-lg px-3 py-2 text-sm bg-surface" onchange="ImportProposal.onProgramChange(this.value)">
          <option value="">— Cargando convocatorias… —</option>
        </select>
        <p class="text-xs text-on-surface-variant mt-2">El sistema atará tu proyecto a la convocatoria que selecciones. Solo verás las que ya están cargadas en Admin Data E+.</p>
      </div>

      <!-- Step 2: project name (optional) -->
      <div class="bg-surface border border-outline-variant/30 rounded-2xl p-5 mb-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</div>
          <h3 class="font-bold text-on-surface">Nombre del proyecto (opcional)</h3>
        </div>
        <input id="ip-name" type="text" placeholder="ej. RISE re-presentación 2026" value="${esc(state.projectName)}"
          class="w-full border border-outline-variant/40 rounded-lg px-3 py-2 text-sm bg-surface"
          oninput="ImportProposal.onNameChange(this.value)" />
      </div>

      <!-- Step 3: upload Word -->
      <div class="bg-surface border border-outline-variant/30 rounded-2xl p-5 mb-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</div>
          <h3 class="font-bold text-on-surface">Sube el Form Part B (.docx)</h3>
        </div>
        <div id="ip-drop" class="border-2 border-dashed border-outline-variant/40 rounded-xl p-8 text-center cursor-pointer hover:bg-surface-variant/30 transition-colors"
             ondragover="event.preventDefault(); this.classList.add('bg-primary/5')"
             ondragleave="this.classList.remove('bg-primary/5')"
             ondrop="ImportProposal.onDrop(event)"
             onclick="document.getElementById('ip-file-input').click()">
          <span class="material-symbols-outlined text-3xl text-on-surface-variant mb-2">cloud_upload</span>
          <p class="text-sm text-on-surface">${state.file ? `<strong>${esc(state.file.name)}</strong> (${(state.file.size/1024).toFixed(0)} KB)` : 'Arrastra tu .docx o haz clic para seleccionar'}</p>
          <p class="text-xs text-on-surface-variant mt-1">Solo plantilla oficial EACEA Form Part B. Tamaño máx: 50 MB.</p>
        </div>
        <input id="ip-file-input" type="file" accept=".docx" class="hidden" onchange="ImportProposal.onFileSelect(event)" />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button onclick="ImportProposal.upload()" class="flex-1 px-5 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 shadow-md disabled:opacity-50">
          <span class="material-symbols-outlined text-sm align-middle mr-1">arrow_forward</span>
          Subir y diagnosticar
        </button>
        <button onclick="ImportProposal.togglePaste()" class="px-5 py-3 bg-surface border border-outline-variant/40 rounded-xl text-sm font-medium hover:bg-surface-variant transition-colors">
          ¿No tienes el Word? Pegar texto
        </button>
      </div>
    `;

    // Populate program select
    const sel = document.getElementById('ip-program');
    if (sel && state.programs.length > 0) {
      sel.innerHTML = '<option value="">— Selecciona una convocatoria —</option>' +
        state.programs.map(p =>
          `<option value="${esc(p.id)}" ${state.programId === p.id ? 'selected' : ''}>${esc(p.name || p.program_id)}</option>`
        ).join('');
    }
  }

  function renderDone(root) {
    const r = state.result;
    const report = r.parserReport || {};
    const sections = report.sectionsCovered || [];

    root.innerHTML = `
      <div class="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mb-6">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
          <div class="flex-1">
            <h2 class="text-xl font-bold text-green-700">Proyecto importado</h2>
            <p class="text-sm text-on-surface mt-1">Se extrajeron <strong>${report.fieldsExtracted || 0}</strong> secciones del Form Part B (${report.totalChars ? Math.round(report.totalChars / 1000) + 'k chars' : 'tamaño desconocido'}).</p>
          </div>
        </div>
      </div>

      <h3 class="text-sm font-bold uppercase text-on-surface-variant mb-3">Cobertura por sección</h3>
      <div class="bg-surface border border-outline-variant/30 rounded-2xl p-4 mb-6">
        <table class="w-full text-xs">
          <thead class="text-on-surface-variant"><tr>
            <th class="text-left pb-2">Sección</th>
            <th class="text-left pb-2">Field ID</th>
            <th class="text-right pb-2">Chars</th>
          </tr></thead>
          <tbody>
            ${sections.map(s => `
              <tr class="border-t border-outline-variant/20">
                <td class="py-1.5">${esc(s.number || '—')} ${esc(s.title || '')}</td>
                <td class="py-1.5 font-mono text-[11px]">${esc(s.fieldId || '—')}</td>
                <td class="py-1.5 text-right">${s.chars || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${(report.errors || []).length > 0 ? `
        <div class="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
          <h4 class="text-sm font-bold text-orange-700 mb-2">Avisos del parser (${report.errors.length})</h4>
          <ul class="text-xs text-on-surface-variant space-y-1">
            ${report.errors.slice(0, 5).map(e => `<li>• ${esc(e)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="flex gap-3">
        <button onclick="ImportProposal.goDiagnose('${esc(r.projectId)}')" class="flex-1 px-5 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 shadow-md">
          <span class="material-symbols-outlined text-sm align-middle mr-1">monitoring</span>
          Ir al diagnóstico
        </button>
        <button onclick="ImportProposal.init()" class="px-5 py-3 bg-surface border border-outline-variant/40 rounded-xl text-sm font-medium">
          Importar otro
        </button>
      </div>
    `;
  }

  /* ── Public handlers ────────────────────────────────────────── */

  function onProgramChange(v) {
    state.programId = v || null;
    state.programObj = state.programs.find(p => p.id === v) || null;
  }
  function onNameChange(v) { state.projectName = v; }
  function onFileSelect(ev) {
    const f = ev.target.files?.[0];
    if (f) { state.file = f; render(); }
  }
  function onDrop(ev) {
    ev.preventDefault();
    const f = ev.dataTransfer.files?.[0];
    if (f && /\.docx$/i.test(f.name)) { state.file = f; render(); }
    else state.error = 'Solo se aceptan archivos .docx';
    render();
  }
  function goDiagnose(projectId) {
    // Set as active project and navigate
    if (typeof App !== 'undefined' && App.setActiveProject) {
      App.setActiveProject({ id: projectId, name: state.projectName || 'Imported' });
    }
    location.hash = 'diagnose';
  }
  function togglePaste() {
    // Future: switch to paste mode UI. For now, simple alert.
    alert('Modo "pegar texto" disponible próximamente. Por ahora usa Word.');
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return {
    init,
    upload: doUpload,
    paste: doPaste,
    onProgramChange,
    onNameChange,
    onFileSelect,
    onDrop,
    goDiagnose,
    togglePaste,
  };
})();
