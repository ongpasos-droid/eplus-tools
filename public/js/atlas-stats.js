/* ═══════════════════════════════════════════════════════════════
   Atlas Stats — Mapa Europa + dashboard del Partner Engine
   ═══════════════════════════════════════════════════════════════
   - 4 KPI cards (total, países, contactables, tier premium)
   - Mapa coroplético Europa con D3 + topojson (world-atlas 110m)
   - Donut de tiers (ApexCharts)
   - 4 bars: países, categorías, CMS, idiomas
   - Click país → set filtro y navega al Partner Engine
   ═══════════════════════════════════════════════════════════════ */

const AtlasStats = (() => {
  let initDone = false;
  let cached = null;
  let charts = [];

  /* ── Mapping ISO numeric (world-atlas id) → ISO 2-letter ────── */
  const NUMERIC_TO_ISO2 = {
    '792':'TR','276':'DE','724':'ES','380':'IT','616':'PL','250':'FR','300':'EL','826':'UK',
    '642':'RO','203':'CZ','056':'BE','040':'AT','620':'PT','348':'HU','528':'NL','372':'IE',
    '752':'SE','100':'BG','191':'HR','208':'DK','246':'FI','703':'SK','440':'LT','705':'SI',
    '428':'LV','233':'EE','442':'LU','196':'CY','470':'MT','352':'IS','578':'NO','438':'LI',
    '756':'CH','807':'MK','688':'RS','008':'AL','070':'BA','499':'ME','804':'UA','112':'BY',
    '498':'MD','643':'RU','643':'RU','268':'GE','051':'AM','031':'AZ',
  };
  // The world-atlas json has ids as strings without leading zeros sometimes ("8" vs "008").
  // Build an alias-friendly lookup.
  function isoFromNumeric(id) {
    if (id == null) return null;
    const s = String(id).padStart(3, '0');
    if (NUMERIC_TO_ISO2[s]) return NUMERIC_TO_ISO2[s];
    // also try without padding
    return NUMERIC_TO_ISO2[String(id)] || null;
  }

  async function init() {
    destroyCharts();
    if (!cached) await loadData();
    renderKpis();
    renderTierDonut();
    renderBars();
    renderMap();   // requiere d3 + topojson cargados
  }

  /* ── Data fetch (en paralelo) ─────────────────────────────── */
  async function loadData() {
    const safe = (p) => p.catch(() => null);
    const [g, c, cat, cms, lang, tier] = await Promise.all([
      safe(API.get('/entities/stats/global')),
      safe(API.get('/entities/stats/by-country')),
      safe(API.get('/entities/stats/by-category')),
      safe(API.get('/entities/stats/by-cms')),
      safe(API.get('/entities/stats/by-language')),
      safe(API.get('/entities/stats/tiers')),
    ]);
    cached = {
      global:    g?.value || {},
      countries: c?.value || [],
      categories: cat?.value || [],
      cms:       cms?.value || [],
      languages: lang?.value || [],
      tiers:     tier?.value || [],
    };
  }

  /* ── KPI cards ────────────────────────────────────────────── */
  function renderKpis() {
    const g = cached.global;
    const tierPremium = cached.tiers.find(t => t.tier === 'premium')?.count || 0;
    const totalRowEl = document.getElementById('stats-total-hero');
    if (totalRowEl && g.total_alive) totalRowEl.textContent = formatNumber(g.total_alive);

    const cards = [
      kpi('Entidades vivas', g.total_alive, 'public', 'primary',
        'En la base de datos enriquecida.'),
      kpi('Con email contacto', g.with_email, 'mail', 'lavender',
        Math.round((g.with_email/g.total_alive)*100) + '% del total.'),
      kpi('Países cubiertos', g.countries, 'flag', 'yellow',
        'Toda la UE + países asociados.'),
      kpi('Premium tier', tierPremium, 'workspace_premium', 'primary',
        'Top 9% por completitud.'),
    ];
    document.getElementById('stats-kpis').innerHTML = cards.join('');
  }
  function kpi(label, value, icon, variant, sub) {
    const variants = {
      primary:  'bg-primary text-white',
      lavender: 'bg-accent-warm text-primary',
      yellow:   'bg-secondary-fixed text-primary',
      neutral:  'bg-white border border-outline-variant/30 text-primary',
    };
    const cls = variants[variant] || variants.neutral;
    return `
      <div class="${cls} rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden">
        <div class="flex items-start justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">${esc(label)}</span>
          <span class="material-symbols-outlined text-[20px] opacity-70">${icon}</span>
        </div>
        <div class="font-headline text-3xl font-extrabold leading-none">${formatNumber(value || 0)}</div>
        <div class="text-[11px] opacity-80">${esc(sub || '')}</div>
      </div>
    `;
  }

  /* ── Tier donut (ApexCharts) ──────────────────────────────── */
  function renderTierDonut() {
    if (typeof ApexCharts === 'undefined') return setTimeout(renderTierDonut, 200);
    const el = document.getElementById('stats-tier-donut');
    if (!el) return;
    const order = ['premium','good','acceptable','minimal'];
    const labels = { premium:'Premium', good:'Buena', acceptable:'Aceptable', minimal:'Mínima' };
    const colors = { premium:'#c7afdf', good:'#fbff12', acceptable:'#cccccc', minimal:'#f8f8f8' };
    const series = [], names = [], cols = [];
    for (const k of order) {
      const r = cached.tiers.find(x => x.tier === k);
      if (r) { series.push(r.count); names.push(labels[k]); cols.push(colors[k]); }
    }
    const chart = new ApexCharts(el, {
      chart: { type: 'donut', height: 260, fontFamily: 'Poppins' },
      series, labels: names, colors: cols,
      legend: { position: 'bottom', fontSize: '12px', fontWeight: 600, labels: { colors: '#1b1464' } },
      stroke: { width: 2, colors: ['#fff'] },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              total: {
                show: true, label: 'Total', color: '#474551', fontSize: '11px', fontWeight: 600,
                formatter: () => formatNumber(series.reduce((a,b) => a+b, 0)),
              },
              value: { color: '#1b1464', fontSize: '20px', fontWeight: 800 },
            }
          }
        }
      },
      tooltip: { y: { formatter: (v) => formatNumber(v) + ' entidades' } },
    });
    chart.render();
    charts.push(chart);
  }

  /* ── Bar charts (4) ───────────────────────────────────────── */
  function renderBars() {
    if (typeof ApexCharts === 'undefined') return setTimeout(renderBars, 200);
    bar('stats-bar-countries', cached.countries.slice(0, 15), 'country_code', 'count', '#fbff12', '#1b1464');
    bar('stats-bar-categories', cached.categories.slice(0, 12), 'category', 'count', '#c7afdf', '#1b1464');
    bar('stats-bar-cms',       cached.cms.slice(0, 12),       'cms', 'count', '#fbff12', '#1b1464');
    bar('stats-bar-languages', cached.languages.slice(0, 12), 'lang', 'count', '#c7afdf', '#1b1464');
  }
  function bar(elId, data, labelKey, valueKey, fill, text) {
    const el = document.getElementById(elId);
    if (!el || !data?.length) {
      if (el) el.innerHTML = '<div class="text-xs text-on-surface-variant text-center py-8">Sin datos</div>';
      return;
    }
    const labels = data.map(d => (d[labelKey] || '').toString().toUpperCase());
    const values = data.map(d => d[valueKey] || 0);
    const chart = new ApexCharts(el, {
      chart: { type: 'bar', height: Math.max(260, data.length * 26), fontFamily: 'Poppins', toolbar: { show: false } },
      series: [{ name: 'Entidades', data: values }],
      xaxis: { categories: labels, labels: { style: { fontWeight: 600 } } },
      colors: [fill],
      plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '70%', dataLabels: { position: 'top' } } },
      dataLabels: { enabled: true, offsetX: 30, style: { fontWeight: 700, colors: [text] }, formatter: (v) => formatNumber(v) },
      grid: { borderColor: '#eeeeee' },
      tooltip: { y: { formatter: (v) => formatNumber(v) } },
    });
    chart.render();
    charts.push(chart);
  }

  /* ── Mapa Europa (D3 + topojson) ──────────────────────────── */
  let mapDrawn = false;
  async function renderMap() {
    if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
      return setTimeout(renderMap, 250);
    }
    const container = document.getElementById('stats-map-container');
    if (!container) return;
    container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-xs text-on-surface-variant"><div class="spinner text-primary"></div></div>';

    let topo;
    try {
      topo = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    } catch {
      container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-xs text-error">No se pudo cargar el mapa</div>';
      return;
    }

    container.innerHTML = '';
    const w = container.clientWidth;
    const h = container.clientHeight;
    const svg = d3.select(container)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .attr('viewBox', `0 0 ${w} ${h}`);

    const all = topojson.feature(topo, topo.objects.countries);
    // Filter to European-ish countries (by lat/lng centroid bbox)
    const inEurope = (f) => {
      const c = d3.geoCentroid(f);
      return c[0] > -25 && c[0] < 50 && c[1] > 33 && c[1] < 73;
    };
    const europe = { type: 'FeatureCollection', features: all.features.filter(inEurope) };

    const projection = d3.geoMercator().fitSize([w, h], europe);
    const path = d3.geoPath(projection);

    // map by ISO2 → count
    const countByIso = Object.fromEntries(
      cached.countries.map(d => [String(d.country_code).toUpperCase(), d.count])
    );
    const max = d3.max(cached.countries, d => d.count) || 1;
    // Yellow → primary scale (Ana style)
    const colorScale = d3.scaleLinear()
      .domain([0, max * 0.05, max * 0.3, max])
      .range(['#f8f8f8', '#fbff12', '#e7eb00', '#1b1464'])
      .clamp(true);

    const tooltip = d3.select(container)
      .append('div')
      .attr('class', 'map-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', '#1b1464')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '8px')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('opacity', '0')
      .style('transition', 'opacity .15s')
      .style('white-space', 'nowrap');

    svg.append('g')
      .selectAll('path')
      .data(europe.features)
      .join('path')
        .attr('d', path)
        .attr('fill', d => {
          const iso = isoFromNumeric(d.id);
          const n = iso ? (countByIso[iso] || 0) : 0;
          return colorScale(n);
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .style('cursor', d => isoFromNumeric(d.id) ? 'pointer' : 'default')
        .on('mousemove', function (event, d) {
          const iso = isoFromNumeric(d.id);
          const n = iso ? (countByIso[iso] || 0) : 0;
          const name = d.properties?.name || iso || '?';
          d3.select(this).attr('stroke', '#1b1464').attr('stroke-width', 1.5).raise();
          tooltip
            .style('opacity', '1')
            .html(`<strong>${name}</strong><br>${formatNumber(n)} entidades${iso ? ` · ${iso}` : ''}`);
          const rect = container.getBoundingClientRect();
          tooltip
            .style('left', (event.clientX - rect.left + 12) + 'px')
            .style('top',  (event.clientY - rect.top + 12) + 'px');
        })
        .on('mouseleave', function () {
          d3.select(this).attr('stroke', '#fff').attr('stroke-width', 0.5);
          tooltip.style('opacity', '0');
        })
        .on('click', (event, d) => {
          const iso = isoFromNumeric(d.id);
          if (!iso) return;
          if (!countByIso[iso]) return;
          // Set entities state and navigate
          try {
            const state = JSON.parse(sessionStorage.getItem('entitiesState') || '{}');
            state.country = iso;
            state.page = 1;
            sessionStorage.setItem('entitiesState', JSON.stringify(state));
          } catch {}
          if (typeof App !== 'undefined') App.navigate('organizations');
          if (typeof Toast !== 'undefined') Toast.show(`Filtrado por ${iso}`, 'ok');
        });

    mapDrawn = true;
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function destroyCharts() {
    charts.forEach(c => { try { c.destroy(); } catch {} });
    charts = [];
    mapDrawn = false;
  }
  function esc(v) { if (v == null) return ''; const d = document.createElement('div'); d.textContent = String(v); return d.innerHTML; }
  function formatNumber(n) { if (n == null) return ''; return Number(n).toLocaleString('es-ES'); }

  return { init };
})();
