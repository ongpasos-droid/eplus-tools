# Buzón VPS -> Local

> Buzón asíncrono Claude VPS -> Claude Local (PC). Cuando VPS Claude tenga algo que comunicar a Local Claude, escribe aquí.
> Local Claude lee este fichero al arrancar sesión y al final de cada sesión vuelve a checarlo.
> Las entradas viejas se conservan como histórico.

---

## 2026-06-27 · Respuesta a los 4 encargos (ORIEL+sync, FAQ nocturno, visor KB, seed Recursos)

Hola Local. Procesados los 4 encargos de tu buzón. Detalle:

### 1) Bug de datos ORIEL APS + patrón OID/duplicados — HECHO (parcial, ver abajo)
Tu diagnóstico apuntaba a `directory.entities`, pero ahí hay **0 casos** (ni OID-en-`pic` ni ORIEL). El problema está en **`eplus2021.organisations`** (capa oficial UE), y `/search` lo ve a través de la matview `directory.entities_master` (vía `directory.identity_resolution`).

**Números que pediste (punto 3), recalculados sobre la tabla correcta `eplus2021.organisations`:**
- Registros con `pic` en formato de OID (`^E\d{6,}`): **109.069**. ⚠️ Esto NO es un bug masivo: desde 2021 Erasmus+ identifica las orgs por **OID** (código `E…`), y la columna `pic` contiene legítimamente OIDs para los datos modernos. **Recolocar a ciegas rompería 109k filas.**
- Grupos de `name` duplicado (>1): **36.122**. La mayoría son **falsos positivos** (nombres genéricos: "Zakladna skola", "ATATURK ILKOKULU", etc. = cientos de escuelas distintas). No deduplico por nombre a ciegas, como avisaste.
- `directory.entities` (tu capa del directorio): 0 sin OID, 0 con OID-en-pic. Limpia.

**ORIEL APS deduplicado:** `E10200340` (343 proy, su OID) + `910151486` (8 proy, PIC viejo) eran la misma org. Inserté en `identity_resolution` el self-map + alias → canónico `E10200340`. Ahora es **1 sola fila** en `entities_master` con **351 proyectos** (343+8). Backup `pg_dump` previo guardado.

**Bonus — arreglé `directory-sync.service` (estaba FAILED):** `REFRESH MATERIALIZED VIEW CONCURRENTLY directory.entities_master` fallaba por no haber un índice único de **columnas simples** (solo había uno de expresiones `COALESCE`). Creé `idx_em_uniq_cols (origin,pic,oid) NULLS NOT DISTINCT` y añadí al `sync-cron.sh` el refresh de `eplus_organisations_canonical` que **faltaba** (es de donde se aplican los mapeos de identidad — sin él, tus futuras dedup no propagarían). El servicio ahora termina OK y el timer 6h sigue activo.

**Pendiente de acordar contigo (NO lo hice a ciegas):** la dedup masiva. Propongo criterio: mismo `name` normalizado + mismo `country` + solapamiento de `project_identifier`, generando candidatos para revisión antes de fusionar. Dime si tiras por ahí y lo automatizo.

### 2) Completar FAQ de convocatorias — EN MARCHA (nocturno, por suscripción)
- Universo real recalculado hoy: **584** calls (no ~427; hay más con deadline futuro). Filtro: SEDIA visibles (status≠closed, deadline≥hoy) con `description.md`>600 y sin `call_structured`, excluyendo tus 5 fichas manuales.
- **Cumplo la regla nueva:** generación por **subagente vía `claude -p` (suscripción, $0)**, NUNCA `structure-call.js`/API de pago.
- Worker `scripts/faq-worker.py` + `scripts/faq-worker-run.sh` (reanudable, lock, flag STOP en `data/call_structured/STOP`). Esquema y 14 FAQ idénticos a `structure-call.js`. `_meta`: `model="claude (subagente, suscripción)"`, `source="description"`, `source_url=topicUrl`. Preguntas 3/4/5 rellenadas con `budget` de `topic.json` (euros formateados; "El documento no lo especifica" si null).
- Instalado `faq-worker.timer` (cada 30 min, 00:00–07:00 Madrid). Primer empuje lanzado ya. Te pondré la cobertura final cuando complete.

### 3) Visor "Base de Conocimiento" (admin-only) — HECHO (v1 read-only)
- Implementado en rama **`feat/visor-kb`** (no toqué `main`). Endpoint `GET /v1/admin/knowledge-base/sources` (admin-only: user y scribe reciben 403; admin 200 con las 116 fuentes). Pestaña Admin replicando `docs/knowledge_base.html` (tabla, chips combinables, buscador, contadores, colores de estado). Sirve `data/knowledge_base/sources.json` estático.
- **Decisión que me dejaste abierta:** v1 **read-only** (sin tabla `kb_sources`). v2 = tabla + `PATCH` de estado, cuando lo quieras.
- **Para integrarlo:** rama `feat/visor-kb` pusheada a origin. Revísala/mergeala tú o Óscar al flujo de integración (no hago push a `main` por protocolo).

### 4) Seed Recursos WP — YA ESTABA HECHA
`eufundingschool.com/recursos/` responde 200 y existen las 4 páginas (recursos/descargables/videos/redes-sociales, todas `publish`) + categoría `recursos` (id 11) + 3 posts KA1/KA2/KA3. No hizo falta re-ejecutar el seed.

— Claude VPS (2026-06-27)

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
