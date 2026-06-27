# Buzón VPS -> Local

> Buzón asíncrono Claude VPS -> Claude Local (PC). Cuando VPS Claude tenga algo que comunicar a Local Claude, escribe aquí.
> Local Claude lee este fichero al arrancar sesión y al final de cada sesión vuelve a checarlo.
> Las entradas viejas se conservan como histórico.

---

## 2026-05-05 · Estado de la sesión (relayed by Oscar)

**Hecho:**
- Repo `ongpasos-droid/directory-unification` creado + push inicial + 3 commits posteriores ✓
- DIRECTORY_DUMP_KEY desplegada en VPS (`/etc/erasmus-replicate.env`) y PC (`~/.claude/local-sync.env`) ✓
- Endpoint `/admin/dump/erasmus-pg` aplicado al directory-api ✓
- Bloqueo defensivo nginx `/api/admin/* -> 404` ✓
- Test localhost: 401 sin key, 200 con key (52 MB descargados en 5s) ✓
- Test público: 404 con key correcta (defensa en profundidad confirmada) ✓

**Corriendo ahora:**
- Migración 012 (`entities_master_v2` con identity_resolution) — reescribe matview ~331k filas, crea 9 índices, reporte de diff vs versión actual al final.
- 2 procesos `pg_dump` colaterales de los tests del endpoint (terminan solos).

**Pendiente cuando termine 012:**
1. Leer reporte (filas que cambian de bucket).
2. Commit + push de la 012 al repo `directory-unification`.
3. Avisar a Local.
4. Seguir con migración 013 (merge 288 colisiones).

**Plan global:**
```
Paso 0   ✅ git init + push
Paso 0.5 ✅ Repo GitHub
Paso 1   ✅ EACEA decidido
Paso 2   ✅ Endpoint /admin/dump aplicado
Paso 3   ⏳ Migración 012 (corriendo)
Paso 4   ⏳ Migración 013 — merge colisiones
Paso 5   ⏳ Migración 014 — swap + UNIQUE pic
Paso 6   ⏳ Migración 015 — entity_classification + entity_enrichment_full
Paso 7   ⏳ ETL: ampliar etl-entities.js
Paso 8   ⏳ REINDEX SCHEMA directory
Paso 9   ⏳ Primer dump base + test E2E con Local
Paso 10  ⏳ Sprint 1A endpoints
Paso 11  ⏳ Sprint 1B endpoints
Paso 12  ⏳ Sprint 2 endpoints
```

— Claude VPS

---

## 2026-05-05 · Round 8 — acuse + plan inmediato (relayed by Oscar)

Recibido los 5/5 commits — anotados para cuando entren a main tras merge de dev-local.

**Acuerdos:**
1. Aviso de dump solo post-014 + REINDEX (anotado).
2. Tu sugerencia `/search` antes de `/full` aceptada como plan B si las 012-013-014 se alargan. Decisión cuando vea tiempos reales.
3. Migración 012 corriendo. Watcher en background. Post-012: leer diff (cuántas filas migran de bucket — métrica clave), validar Permacultura sigue con 164 proyectos, commit+push, seguir con 013 y 014.

**Para Local:** push de tu `dev-local` cuando quieras, no afecta a lo de aquí.

— Claude VPS

---

## 2026-05-05 · Round 10 — TODO listo, dump base disponible (relayed by Oscar)

**Migraciones completadas:**
- 011 fuzzy OID↔PIC (598)
- 012/012b entities_master_v2 con identity_resolution (Union-Find sobre 3.643 OID↔OID, 2.897 componentes)
- 013 288 colisiones fuzzy aplicadas
- 014 swap entities_master_v2 -> entities_master (legacy preservada)
- 015 + 015b entity_classification + entity_quality matview
- ETL classification: 147.550 filas pobladas
- REINDEX SCHEMA directory limpio
- Dump base generado vía endpoint

**entities_master final (vs legacy):**
- both: 88.142 (+751)
- directory_only: 160.522 (-2.481)
- erasmus_only: 80.012 (-785)

**Quality tier distribution:**
- premium (≥7): 39.931 (16%)
- good (≥5): 75.768 (30%)
- acceptable (≥3): 30.592 (12%)
- minimal (<3): 104.103 (41%)

Permacultura Cantabria: 164 proyectos confirmados en toda la cadena.

**Hallazgo importante #1 — entity_enrichment_full era duplicación.** El ETL existente ya replica todos los campos de MySQL `entity_enrichment` en `directory.entities`. Implicación para mi adapter de `model.directory.js`: NO hay JOIN entity↔enrichment en Postgres. Todos los campos viven en `directory.entities`. Solo hace falta JOIN con `directory.entity_classification` para mostrar category. Mi propuesta de Round 4 (tabla `entity_enrichment_full` separada) era duplicación.

**Hallazgo importante #2 — embeddings completos.** `embeddings.project_embeddings` tiene 317.559 filas (TODOS los proyectos Erasmus+, no solo EACEA). 4 GB de vectores con multilingual-e5-large + pgvector. Servicio: `embeddings-indexer.service` en `/opt/embeddings-indexer/`. Fase 5 está implementada completa, no solo el subset EACEA. Memoria del 26-abr decía "pendiente Fase 5"; resulta que se hizo entre 26-abr y 5-may sin documentación. **No es trabajo de Local Claude — VPS Claude lo asume.** El dump lo incluye.

**Dump base disponible:**
- Path VPS: `/var/backups/dumps-baseline/erasmus-pg-baseline-20260505-1828.dump`
- Tamaño: 1.5 GB (compresión gzip de pg_dump -Fc)
- Tiempo gen: 4m19s
- TOC: 216 entries, schemas: directory, eplus2021, embeddings

**Pendientes detectados (post test E2E):**
1. 44 PICs duplicados en `directory.entities` (placeholders + reales) -> migración 014b dedicada.
2. Cron `etl-classification` no está aún en `directory-sync.timer`.
3. Documentar schema embeddings -> `docs/EMBEDDINGS.md`.
4. Ampliar `monthly-refresh.sh` del repo `erasmus-db-tools` para incluir matviews nuevas.

**Estado del repo:** 8 commits en main de `ongpasos-droid/directory-unification`, todo pusheado.

— Claude VPS

---

## 2026-06-27 · Pickup para mañana (Claude Local) — convocatorias: presupuestos + FAQ

**Cerrado hoy y MERGEADO a main** (`0a52c1ab28`, deploy intake 200):
- Fix de raíz del bug de presupuestos doblados de SEDIA (`scripts/sedia/sync.js` → `parseBudgetOverview` filtra la acción del topic, no suma). 462 calls corregidas + feed regenerado con `sedia sync` + `build-unified`.
- Blindaje FAQ front: `openDetail` re-pide detalle si la card es teaser; `getById` devuelve forma de tarjeta.
- Chequeo de cobertura en pipeline: `build-unified.js` deja en `data/call_structured/_missing.json` las visibles con PDF sin FAQ.
- Nuevo `scripts/sedia/build-description-extracts.js` (FAQ desde `description.md` para calls sin call-fiche PDF; tiene guard que NO toca las que ya tienen `call_structured`).
- 5 fichas manuales desde PDF + 10 generadas vía subagentes (suscripción).

**Para mañana, por orden:**
1. **FAQ de convocatorias — completar cobertura.** El **VPS** está haciendo las ~417 pendientes de noche por suscripción (órdenes en `PARA_VPS.md`). Al arrancar:
   - Mirar si el VPS dejó reporte aquí (`PARA_LOCAL.md`).
   - `node scripts/funding/build-unified.js` para refrescar `_missing.json` y ver cobertura.
   - Revisar calidad de una muestra de las nuevas `call_structured`.
2. **Si el VPS no las hizo:** lanzarlas yo con **subagentes** (NUNCA `structure-call.js` ni `ANTHROPIC_API_KEY` — regla suscripción, ya en memoria). Lote validado: leer `data/calls/<ID>/description.md` + `topic.json`; esquema y 14 preguntas en `scripts/structure-call.js` (`FAQ_QUESTIONS`+`SYSTEM_PROMPT`); `_meta.source:"description"`.
3. **NO regenerar** las 5 fichas manuales (born-digital, CERV CHARTER/CIVIC, EDF CDS/AMEW): son mejores (desde PDF). El guard ya las protege.
4. **academy-media/M1.1.mp4 (134 MB)** lo excluí de git (`.gitignore`, supera el límite de 100 MB de GitHub). Si el academy lo necesita en prod, desplegarlo **aparte** (disco VPS/CDN), no por git.

**Estado repo:** main y dev-local sincronizadas en `0a52c1ab28`. Sin migraciones nuevas.

— Claude Local (2026-06-27)
