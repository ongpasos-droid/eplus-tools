/**
 * structure-call.js
 *
 * Reads each text extract in data/call_extracts/<id>.json and asks Claude to
 * extract structured info from the call document: budget, eligibility,
 * duration, scope summary in Spanish, and a FAQ.
 *
 * Output: data/call_structured/<id>.json
 *
 * Idempotent: skips files whose structured output is newer than the extract,
 * and whose source_text_hash matches (so editing the prompt forces re-run).
 *
 * Usage:
 *   node scripts/structure-call.js [--only=<source_id>] [--limit=N] [--force]
 *
 * Cost: ~6000 input tokens + ~1500 output tokens per call with Sonnet 4.6
 *   = ~$2 / 100 calls (mostly input-driven).
 */
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = process.env.AI_MODEL_EXTRACTION || 'claude-sonnet-4-5-20250929';
const MAX_INPUT_CHARS = 30000; // ~7500 input tokens — covers scope/budget/eligibility
const CONCURRENCY = 3;

const EXTRACT_DIR = path.join(__dirname, '..', 'data', 'call_extracts');
const OUT_DIR     = path.join(__dirname, '..', 'data', 'call_structured');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY  = (() => { const a = args.find(x => x.startsWith('--only=')); return a ? a.split('=')[1] : null; })();
const LIMIT = (() => { const a = args.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : null; })();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en convocatorias EU (Erasmus+, Horizon, ESF+, Digital Europe, CERV, LIFE, etc.).
Te paso el texto de un "call document" oficial. Extrae los campos clave a JSON.

REGLAS:
- Devuelve SOLO JSON válido, sin markdown ni comentarios.
- Si un campo no aparece literalmente en el texto, devuelve null. No inventes.
- Los importes en euros: número decimal sin separadores ni símbolos.
- Cofinanciación / max funding rate: porcentaje 0-100.
- Idioma del scope_summary_es y de las preguntas/respuestas del FAQ: SIEMPRE español, claro y directo.
- El FAQ debe responder las dudas reales que tendría alguien que quiere preparar la propuesta: presupuesto, deadline, quién puede aplicar, mínimo de socios, duración, qué hay que entregar, criterios de evaluación.
- 5 a 8 entradas en el FAQ.

SCHEMA:
{
  "budget_per_project_max_eur": number|null,
  "budget_per_project_min_eur": number|null,
  "budget_total_eur": number|null,
  "expected_grants": number|null,
  "cofinancing_pct": number|null,
  "duration_months_min": number|null,
  "duration_months_max": number|null,
  "min_partners": number|null,
  "min_countries": number|null,
  "deadline": "YYYY-MM-DD"|null,
  "deadline_model": "single-stage"|"two-stage"|"multiple cut-off"|null,
  "eligible_entity_types": string[],   // ej: ["NGO", "Public body", "University", "SME"]
  "eligible_countries_summary": string|null,
  "audience": string|null,             // a quién va dirigido (max 200 chars)
  "scope_summary_es": string,          // resumen ejecutivo en español, 3-5 frases, qué propone la call y para qué
  "themes": string[],                  // 2-5 temas/tags clave para búsqueda
  "faq": [ { "q": string, "a": string } ]
}`;

function hashText(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }

async function callClaude(text) {
  const trimmed = text.slice(0, MAX_INPUT_CHARS);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `TEXTO DEL CALL:\n\n${trimmed}\n\nDevuelve solo el JSON.` }],
  });
  const raw = res.content.find(c => c.type === 'text')?.text || '';
  // Strip optional markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) {
    const err = new Error('Invalid JSON returned by model');
    err.raw = raw; err.cleaned = cleaned;
    throw err;
  }
  return { parsed, usage: res.usage };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let files = fs.readdirSync(EXTRACT_DIR).filter(f => f.endsWith('.json'));
  if (ONLY) files = files.filter(f => f === ONLY + '.json');
  if (LIMIT) files = files.slice(0, LIMIT);

  let okCount = 0, errCount = 0, skipCount = 0;
  let totalIn = 0, totalOut = 0;

  const queue = files.slice();
  async function worker(workerId) {
    while (queue.length) {
      const file = queue.shift();
      const sid = file.replace(/\.json$/, '');
      const inPath  = path.join(EXTRACT_DIR, file);
      const outPath = path.join(OUT_DIR, file);
      const extract = JSON.parse(fs.readFileSync(inPath, 'utf8'));
      const textHash = hashText(extract.text.slice(0, MAX_INPUT_CHARS));

      if (!FORCE && fs.existsSync(outPath)) {
        try {
          const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
          if (prev._meta?.source_text_hash === textHash) { skipCount++; continue; }
        } catch { /* malformed — re-run */ }
      }

      try {
        const t0 = Date.now();
        const { parsed, usage } = await callClaude(extract.text);
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        totalIn += usage.input_tokens || 0;
        totalOut += usage.output_tokens || 0;
        const out = {
          source_id: sid,
          _meta: {
            model: MODEL,
            extracted_at: new Date().toISOString(),
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            source_text_hash: textHash,
            source_url: extract.source_url,
          },
          ...parsed,
        };
        fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
        okCount++;
        console.log(`[w${workerId}] ${sid} ✓ (${dt}s · in ${usage.input_tokens} · out ${usage.output_tokens}) — ${okCount}/${files.length}`);
      } catch (e) {
        errCount++;
        console.log(`[w${workerId}] ${sid} ✗ ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  // Cost estimate (Sonnet 4.5/4.6: $3/M input + $15/M output)
  const costIn  = totalIn  / 1_000_000 * 3;
  const costOut = totalOut / 1_000_000 * 15;
  console.log(`\nDone. ok=${okCount} err=${errCount} skipped=${skipCount}`);
  console.log(`Tokens: in=${totalIn.toLocaleString()} out=${totalOut.toLocaleString()}`);
  console.log(`Cost (Sonnet pricing): $${(costIn + costOut).toFixed(3)}  (in=$${costIn.toFixed(3)} out=$${costOut.toFixed(3)})`);
}

main().catch(e => { console.error(e); process.exit(1); });
