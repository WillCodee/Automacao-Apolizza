/**
 * Etapa 2b: verifica 5 EXTRAS via ClickUp API. 404 → soft-delete; 200 → reporta.
 * Etapa 2c: importa 21 AUSENTES (pula 2 testes) via API + parser do migrate.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { dbQuery } from "../src/lib/db";
import { db } from "../src/lib/db";
import * as schema from "../src/lib/schema";
import { sql, eq, inArray } from "drizzle-orm";

const TOKEN = process.env.CLICKUP_API_TOKEN!;
const API = "https://api.clickup.com/api/v2";
const RUN_ID = "audit-2026-2026-04-30";

// Custom field UUIDs (idem migrate-clickup.ts)
const CF = {
  A_RECEBER: "cecaeb66-e057-4032-a296-27232581f4d7",
  INDICACAO: "ca2fe9e7-831f-461f-aa32-c6477a0b81c5",
  OBSERVACAO: "a8d0ccc1-c30b-4fe4-8514-7ce1841d8b16",
  PARCELADO_EM: "6e0de4a6-6562-40f0-892a-86d6419c6af1",
  PREMIO_SEM_IOF: "7765251e-5e44-4567-a7c8-621584228853",
  SEGURADORA: "7692b42a-860b-4c74-a975-68547d3fe039",
  VALOR_PERDA: "7d482fab-02e0-4e61-9563-b07a5565cf8f",
  PROXIMA_TRATATIVA: "f3e53744-f27d-4e6e-acae-ee69b25daed8",
  ANO: "95fcbbf2-23cd-45dd-a9e3-dcad386e05e9",
  COMISSAO: "cbab3bed-f4f7-44d1-a11e-374a57352f75",
  CONTATO_CLIENTE: "208b1c92-3c4d-4ced-a41a-15035b0aaadf",
  FIM_VIGENCIA: "640d44b3-818e-4957-ac1b-2426d2e59e5d",
  INICIO_VIGENCIA: "adefa135-416a-4024-8bce-f55fbf5cceab",
  MES: "84c942c3-e5d4-4519-8575-999e746d0c8b",
  PRIMEIRO_PAGAMENTO: "22697a67-9b28-4da0-b5d7-4143632c7a0c",
  PRODUTO: "cf31d2a2-9746-460a-8396-f42b195f6f48",
  TIPO_CLIENTE: "003939fb-a195-4b62-8239-921442041174",
  SITUACAO: "787d9f83-2373-4adb-b709-8ca0da833af1",
};
const ANO_MAP: Record<number, number> = { 0: 2026, 1: 2025, 2: 2027, 3: 2024 };
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function gcf(t: any, u: string) { return t.custom_fields?.find((f: any) => f.id === u) || null; }
function txt(t: any, u: string) { const f = gcf(t, u); if (!f || f.value == null || f.value === "") return null; return String(f.value).trim() || null; }
function dd(t: any, u: string) {
  const f = gcf(t, u); if (!f || f.value == null) return null;
  const opts = f.type_config?.options; if (!opts) return String(f.value);
  const idx = Number(f.value); if (isNaN(idx)) return null;
  const o = opts.find((x: any) => x.orderindex === idx);
  return o ? (o.name || o.label || null) : null;
}
function dat(t: any, u: string) { const f = gcf(t, u); if (!f?.value) return null; const ms = Number(f.value); if (isNaN(ms)) return null; return new Date(ms).toISOString().split("T")[0]; }
function curr(t: any, u: string) {
  const f = gcf(t, u); if (!f || f.value == null) return null;
  const rawStr = String(f.value); const raw = parseFloat(rawStr); if (isNaN(raw) || raw === 0) return null;
  return (rawStr.includes(".") ? raw : raw / 100).toFixed(2);
}
function intv(t: any, u: string) { const f = gcf(t, u); if (!f || f.value == null) return null; const n = parseInt(String(f.value), 10); return isNaN(n) ? null : n; }
function getAno(t: any) {
  const f = gcf(t, CF.ANO);
  if (f?.value != null) { const idx = Number(f.value); if (!isNaN(idx) && ANO_MAP[idx] !== undefined) return ANO_MAP[idx]; }
  for (const k of ["start_date", "due_date", "date_created"]) if (t[k]) { const d = new Date(Number(t[k])); if (!isNaN(d.getTime())) return d.getFullYear(); }
  return null;
}
function getMes(t: any) {
  const lbl = dd(t, CF.MES); if (lbl) return lbl.toUpperCase();
  if (!t.due_date) return null;
  const d = new Date(Number(t.due_date)); return isNaN(d.getTime()) ? null : (MESES[d.getMonth()] || null);
}
function normalizeStatus(s: string) {
  const map: Record<string, string> = { "a fazer": "não iniciado", "to do": "não iniciado", "em andamento": "em andamento", "in progress": "em andamento", "feito": "fechado", "done": "fechado", "complete": "fechado", "concluido ocultar": "fechado", "raut": "raut" };
  const k = s.toLowerCase().trim(); return map[k] || k;
}
function normalizePriority(p: string | null) {
  if (!p) return "normal";
  const m: Record<string, string> = { urgent: "urgente", high: "alta", normal: "normal", low: "baixa" };
  return m[p.toLowerCase()] || "normal";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchTask(id: string): Promise<{ status: number; data: any | null }> {
  const r = await fetch(`${API}/task/${id}?include_subtasks=false`, { headers: { Authorization: TOKEN } });
  if (r.status === 404) return { status: 404, data: null };
  if (!r.ok) return { status: r.status, data: null };
  return { status: 200, data: await r.json() };
}

const EXTRAS = [
  { cotacaoId: "3c460c74-31bf-4330-928e-cbbefc3a0daa", clickupId: "86b8pxp5h" },
  { cotacaoId: "c4cee55b-0f9a-455e-ae43-b835c06baf6d", clickupId: "86b9enhxx" },
  { cotacaoId: "cb54a086-e7ff-47a3-bc72-29751004997f", clickupId: "86b8r1tng" },
  { cotacaoId: "de9b80c0-1d89-4677-8e30-f8c64f55e8b1", clickupId: "86b8v48j0" },
  { cotacaoId: "e7f109e2-d7b5-4fd9-a5a2-85fadb03c3b6", clickupId: "86b8bafxa" },
];

const SKIP_AUSENTES = new Set(["86b8br5f6", "86b92czfu"]); // testes
const AUSENTES_IDS = [
  "86b731zeg", "86b7m9znq", "86b7tbxbw", "86b87f00c", "86b8br5f6", "86b8fct9g",
  "86b8frw4f", "86b8ge7wh", "86b8rwq1z", "86b8vrx7k", "86b92czfu", "86b96bac4",
  "86b9d00bd", "86b9jqkef", "86b9jqywu", "86b9jr0rz", "86b9jt4tw", "86b9me7m2",
  "86b9mkueh", "86b9mm5hn", "86b9mmva0", "86b9mn30g", "86b9mn6bu",
];

async function main() {
  if (!TOKEN) { console.error("CLICKUP_API_TOKEN não configurado"); process.exit(1); }

  // ============== 2b: EXTRAS ==============
  console.log("\n=== 2b: Verificando 5 EXTRAS via ClickUp API ===");
  const toSoftDelete: { cotacaoId: string; clickupId: string }[] = [];
  const reportar: { cotacaoId: string; clickupId: string; status: number; data?: any }[] = [];
  for (const e of EXTRAS) {
    const r = await fetchTask(e.clickupId);
    console.log(`  ${e.clickupId} → status ${r.status}`);
    if (r.status === 404) toSoftDelete.push(e);
    else reportar.push({ ...e, status: r.status, data: r.data });
    await sleep(700);
  }
  if (toSoftDelete.length) {
    const ids = toSoftDelete.map((x) => x.cotacaoId);
    // Log + soft-delete em transação
    for (const x of toSoftDelete) {
      await dbQuery(`INSERT INTO cotacao_auditoria_correcoes (cotacao_id, campo, valor_antigo, valor_novo, tier, audit_run_id, fonte) VALUES ('${x.cotacaoId}', 'deleted_at', NULL, 'NOW()', 'MEDIA', '${RUN_ID}', 'clickup-404')`);
    }
    await db.update(schema.cotacoes).set({ deletedAt: sql`NOW()` }).where(inArray(schema.cotacoes.id, ids));
    console.log(`  Soft-deletados: ${toSoftDelete.length} cotações (clickup retornou 404)`);
  }
  if (reportar.length) {
    console.log(`\n  ⚠ ${reportar.length} extras NÃO retornaram 404 — mantidos no banco. Detalhes:`);
    for (const r of reportar) {
      console.log(`    ${r.clickupId}: status=${r.status} list_id=${r.data?.list?.id || "?"} list_name=${r.data?.list?.name || "?"}`);
    }
  }

  // ============== 2c: AUSENTES ==============
  console.log("\n=== 2c: Importando AUSENTES ===");
  const userMap = new Map<string, string>();
  const usersList = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users);
  for (const u of usersList) userMap.set(u.username.toLowerCase(), u.id);

  let inserted = 0, skipped = 0, failed: string[] = [];
  for (const id of AUSENTES_IDS) {
    if (SKIP_AUSENTES.has(id)) { console.log(`  ${id}: PULADO (teste)`); skipped++; continue; }
    const r = await fetchTask(id);
    if (r.status !== 200 || !r.data) { console.log(`  ${id}: FALHA status=${r.status}`); failed.push(id); continue; }
    const t = r.data;
    const assigneeUsername = (t.assignees?.[0]?.username || "").toLowerCase();
    const assigneeId = assigneeUsername ? userMap.get(assigneeUsername) || null : null;

    const data = {
      clickupId: t.id,
      name: (t.name || "(sem nome)").substring(0, 500),
      status: normalizeStatus(t.status?.status || "não iniciado"),
      priority: normalizePriority(t.priority?.priority || null),
      dueDate: t.due_date ? new Date(Number(t.due_date)) : null,
      assigneeId,
      tipoCliente: dd(t, CF.TIPO_CLIENTE),
      situacao: dd(t, CF.SITUACAO),
      seguradora: txt(t, CF.SEGURADORA),
      produto: dd(t, CF.PRODUTO),
      indicacao: txt(t, CF.INDICACAO),
      contatoCliente: null,
      inicioVigencia: dat(t, CF.INICIO_VIGENCIA),
      fimVigencia: dat(t, CF.FIM_VIGENCIA),
      primeiroPagamento: dat(t, CF.PRIMEIRO_PAGAMENTO),
      proximaTratativa: dat(t, CF.PROXIMA_TRATATIVA),
      parceladoEm: intv(t, CF.PARCELADO_EM),
      premioSemIof: curr(t, CF.PREMIO_SEM_IOF),
      comissao: txt(t, CF.COMISSAO),
      aReceber: curr(t, CF.A_RECEBER),
      valorPerda: curr(t, CF.VALOR_PERDA),
      mesReferencia: getMes(t),
      anoReferencia: getAno(t),
      tags: [],
      isRenovacao: false,
      observacao: txt(t, CF.OBSERVACAO) || (t.description?.substring(0, 5000) || null),
    };

    try {
      await db.insert(schema.cotacoes).values(data as any);
      console.log(`  ${id}: INSERIDA — ${data.name.substring(0, 50)} (${data.mesReferencia}/${data.anoReferencia})`);
      inserted++;
    } catch (e: any) {
      console.log(`  ${id}: ERRO insert: ${e.message}`);
      failed.push(id);
    }
    await sleep(700);
  }

  console.log("\n=== RESUMO ETAPA 2 ===");
  console.log(`2b extras: soft-deleted=${toSoftDelete.length}, mantidos=${reportar.length}`);
  console.log(`2c ausentes: inserted=${inserted}, skipped=${skipped}, failed=${failed.length}`);
  if (failed.length) console.log("  Failed IDs:", failed);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
