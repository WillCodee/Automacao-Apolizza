/**
 * AUDITORIA 2026 — ClickUp (live) vs MySQL
 *
 * Fase 1: Snapshot fresco da lista COTAÇÕES via API ClickUp
 * Fase 2: Compara campo-a-campo com banco MySQL (apenas ano_referencia=2026)
 *         Gera 3 CSVs + JSON detalhado
 *
 * Uso:
 *   npx tsx scripts/audit-2026-clickup.ts                 # full pipeline
 *   npx tsx scripts/audit-2026-clickup.ts --skip-fetch    # reusa último snapshot
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { dbQuery } from "../src/lib/db";

const SKIP_FETCH = process.argv.includes("--skip-fetch");

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN!;
const LIST_ID = process.env.CLICKUP_LIST_ID || "900701916229";
const API_BASE = "https://api.clickup.com/api/v2";

if (!CLICKUP_TOKEN) {
  console.error("CLICKUP_API_TOKEN não configurado em .env.local");
  process.exit(1);
}

// ============================================================
// CUSTOM FIELD UUIDs (idem migrate-clickup.ts)
// ============================================================
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

const STATUS_MAP: Record<string, string> = {
  "a fazer": "não iniciado", "to do": "não iniciado",
  "em andamento": "em andamento", "in progress": "em andamento",
  "feito": "fechado", "done": "fechado", "complete": "fechado",
  "concluido ocultar": "fechado", "raut": "raut",
};

// ============================================================
// PARSERS (idênticos ao migrate-clickup.ts)
// ============================================================
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getCustomField(task: any, uuid: string) { return task.custom_fields?.find((f: any) => f.id === uuid) || null; }
function getTextValue(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value == null || f.value === "") return null;
  return String(f.value).trim() || null;
}
function getDropdownLabel(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value == null) return null;
  const opts = f.type_config?.options;
  if (!opts || !Array.isArray(opts)) return String(f.value);
  const idx = Number(f.value);
  if (isNaN(idx)) return null;
  const opt = opts.find((o: any) => o.orderindex === idx);
  return opt ? (opt.name || opt.label || null) : null;
}
function getDateValue(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || !f.value) return null;
  const ms = Number(f.value);
  if (isNaN(ms)) return null;
  return new Date(ms).toISOString().split("T")[0];
}
function getCurrencyValue(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value == null) return null;
  const rawStr = String(f.value);
  const raw = parseFloat(rawStr);
  if (isNaN(raw) || raw === 0) return null;
  const value = rawStr.includes(".") ? raw : raw / 100;
  return value.toFixed(2);
}
function getIntValue(task: any, uuid: string): number | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value == null) return null;
  const n = parseInt(String(f.value), 10);
  return isNaN(n) ? null : n;
}
function getComissaoValue(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value == null || f.value === "") return null;
  const raw = String(f.value).trim();
  if (!raw) return null;
  if (/^[\d.,]+%$/.test(raw)) {
    const n = parseFloat(raw.replace("%", "").replace(",", "."));
    return isNaN(n) ? raw : n.toFixed(2);
  }
  if (/^[\d.,]+$/.test(raw)) {
    const n = parseFloat(raw.replace(",", "."));
    return isNaN(n) ? raw : n.toFixed(2);
  }
  return raw;
}
function normalizeStatus(s: string): string { return STATUS_MAP[s.toLowerCase().trim()] || s.toLowerCase().trim(); }
function normalizePriority(p: string | null): string {
  if (!p) return "normal";
  const m: Record<string, string> = { urgent: "urgente", high: "alta", normal: "normal", low: "baixa" };
  return m[p.toLowerCase()] || "normal";
}
function msToDateStr(ms: any): string | null {
  if (!ms) return null;
  const n = Number(ms);
  if (isNaN(n)) return null;
  return new Date(n).toISOString().split("T")[0];
}
function getAnoReferencia(task: any): number | null {
  const f = getCustomField(task, CF.ANO);
  if (f?.value != null) {
    const idx = Number(f.value);
    if (!isNaN(idx) && ANO_MAP[idx] !== undefined) return ANO_MAP[idx];
  }
  for (const k of ["start_date", "due_date", "date_created"]) {
    if (task[k]) {
      const d = new Date(Number(task[k]));
      if (!isNaN(d.getTime())) return d.getFullYear();
    }
  }
  return null;
}
function getMesReferencia(task: any): string | null {
  const lbl = getDropdownLabel(task, CF.MES);
  if (lbl) return lbl.toUpperCase();
  if (!task.due_date) return null;
  const d = new Date(Number(task.due_date));
  return isNaN(d.getTime()) ? null : (MESES[d.getMonth()] || null);
}

// ============================================================
// FETCH
// ============================================================
async function fetchAllCotacoes(): Promise<any[]> {
  const tasks: any[] = [];
  let page = 0;
  while (true) {
    const url = `${API_BASE}/list/${LIST_ID}/task?page=${page}&include_closed=true&subtasks=false&order_by=created&reverse=true`;
    console.log(`  Página ${page}...`);
    const res = await fetch(url, { headers: { Authorization: CLICKUP_TOKEN } });
    if (!res.ok) throw new Error(`ClickUp API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const batch = data.tasks || [];
    if (!batch.length) break;
    tasks.push(...batch);
    console.log(`    +${batch.length} (total ${tasks.length})`);
    if (batch.length < 100) break;
    page++;
    await sleep(700);
  }
  return tasks;
}

// ============================================================
// COMPARE
// ============================================================
function normalize(v: any): string {
  if (v == null || v === "") return "__NULL__";
  if (typeof v === "number") return v.toFixed(2);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  let s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) s = s.split("T")[0];
  return s;
}
function eqDecimal(a: string | null, b: string | null) {
  const x = a ? parseFloat(a) : null, y = b ? parseFloat(b) : null;
  if (x == null && y == null) return true;
  if (x == null || y == null) return false;
  return Math.abs(x - y) < 0.015;
}
function eqField(field: string, a: any, b: any): boolean {
  if (["premioSemIof", "aReceber", "valorPerda"].includes(field)) return eqDecimal(a, b);
  return normalize(a).toLowerCase() === normalize(b).toLowerCase();
}
function safeDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().split("T")[0];
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split("T")[0];
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}
function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const dataDir = path.resolve(__dirname, "../data");
  fs.mkdirSync(dataDir, { recursive: true });
  const today = new Date().toISOString().split("T")[0];
  const snapshotPath = path.join(dataDir, `clickup-snapshot-cotacoes-${today}.json`);

  // ---------- FASE 1 ----------
  let tasks: any[];
  if (SKIP_FETCH && fs.existsSync(snapshotPath)) {
    console.log(`[SKIP-FETCH] Lendo ${snapshotPath}`);
    tasks = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  } else {
    console.log("=== FASE 1: Snapshot ClickUp (lista cotações) ===");
    tasks = await fetchAllCotacoes();
    fs.writeFileSync(snapshotPath, JSON.stringify(tasks, null, 2));
    console.log(`Salvo: ${snapshotPath} (${tasks.length} tasks)`);
  }

  // Filtra ano=2026
  const tasks2026 = tasks.filter((t) => getAnoReferencia(t) === 2026);
  console.log(`Tasks ClickUp 2026: ${tasks2026.length} de ${tasks.length}`);

  // ---------- FASE 2 ----------
  console.log("\n=== FASE 2: Comparação campo-a-campo ===");
  const dbRows = await dbQuery<any>(
    "SELECT * FROM cotacoes WHERE ano_referencia=2026 AND deleted_at IS NULL"
  );
  console.log(`Cotações no banco (ano=2026): ${dbRows.length}`);

  const dbByClickup = new Map<string, any>();
  const dbCrmOnly: any[] = [];
  for (const r of dbRows) {
    if (r.clickup_id) dbByClickup.set(r.clickup_id, r);
    else dbCrmOnly.push(r);
  }

  const divergencias: any[] = [];
  const ausentes: any[] = []; // ClickUp sem match no DB
  const fieldStats: Record<string, { total: number; div: number }> = {};
  let auditadas = 0;

  for (const task of tasks2026) {
    const dbRow = dbByClickup.get(task.id);
    if (!dbRow) {
      ausentes.push({ clickupId: task.id, nome: task.name, mes: getMesReferencia(task) });
      continue;
    }
    auditadas++;
    dbByClickup.delete(task.id); // marca consumido

    const ck: Record<string, any> = {
      name: task.name?.substring(0, 500) || "",
      status: normalizeStatus(task.status?.status || "não iniciado"),
      priority: normalizePriority(task.priority?.priority || null),
      dueDate: msToDateStr(task.due_date),
      tipoCliente: getDropdownLabel(task, CF.TIPO_CLIENTE),
      seguradora: getTextValue(task, CF.SEGURADORA),
      produto: getDropdownLabel(task, CF.PRODUTO),
      situacao: getDropdownLabel(task, CF.SITUACAO),
      indicacao: getTextValue(task, CF.INDICACAO),
      inicioVigencia: getDateValue(task, CF.INICIO_VIGENCIA),
      fimVigencia: getDateValue(task, CF.FIM_VIGENCIA),
      primeiroPagamento: getDateValue(task, CF.PRIMEIRO_PAGAMENTO),
      proximaTratativa: getDateValue(task, CF.PROXIMA_TRATATIVA),
      parceladoEm: getIntValue(task, CF.PARCELADO_EM),
      premioSemIof: getCurrencyValue(task, CF.PREMIO_SEM_IOF),
      aReceber: getCurrencyValue(task, CF.A_RECEBER),
      valorPerda: getCurrencyValue(task, CF.VALOR_PERDA),
      comissao: getComissaoValue(task, CF.COMISSAO),
      mesReferencia: getMesReferencia(task),
      anoReferencia: getAnoReferencia(task),
    };
    const db: Record<string, any> = {
      name: dbRow.name, status: dbRow.status, priority: dbRow.priority || "normal",
      dueDate: safeDateStr(dbRow.due_date),
      tipoCliente: dbRow.tipo_cliente, seguradora: dbRow.seguradora,
      produto: dbRow.produto, situacao: dbRow.situacao, indicacao: dbRow.indicacao,
      inicioVigencia: safeDateStr(dbRow.inicio_vigencia),
      fimVigencia: safeDateStr(dbRow.fim_vigencia),
      primeiroPagamento: safeDateStr(dbRow.primeiro_pagamento),
      proximaTratativa: safeDateStr(dbRow.proxima_tratativa),
      parceladoEm: dbRow.parcelado_em,
      premioSemIof: dbRow.premio_sem_iof != null ? String(dbRow.premio_sem_iof) : null,
      aReceber: dbRow.a_receber != null ? String(dbRow.a_receber) : null,
      valorPerda: dbRow.valor_perda != null ? String(dbRow.valor_perda) : null,
      comissao: dbRow.comissao,
      mesReferencia: dbRow.mes_referencia,
      anoReferencia: dbRow.ano_referencia,
    };

    for (const campo of Object.keys(ck)) {
      if (!fieldStats[campo]) fieldStats[campo] = { total: 0, div: 0 };
      fieldStats[campo].total++;
      if (!eqField(campo, ck[campo], db[campo])) {
        fieldStats[campo].div++;
        divergencias.push({
          clickupId: task.id, nome: task.name, mes: ck.mesReferencia,
          campo, clickup: ck[campo], mysql: db[campo],
        });
      }
    }
  }

  // Extras: cotações no banco com clickup_id mas que não vieram no snapshot
  const extras: any[] = [];
  for (const [cid, row] of dbByClickup) {
    extras.push({ clickupId: cid, nome: row.name, mes: row.mes_referencia });
  }

  // ---------- RELATÓRIO ----------
  console.log("\n" + "=".repeat(70));
  console.log("  RESULTADOS");
  console.log("=".repeat(70));
  console.log(`\nClickUp 2026:           ${tasks2026.length}`);
  console.log(`Banco 2026:             ${dbRows.length}`);
  console.log(`  com clickup_id:       ${dbRows.length - dbCrmOnly.length}`);
  console.log(`  CRM-only (sem ck):    ${dbCrmOnly.length}`);
  console.log(`Auditadas (match):      ${auditadas}`);
  console.log(`No ClickUp não no banco: ${ausentes.length}`);
  console.log(`No banco não no ClickUp: ${extras.length}`);
  console.log(`Total divergências:     ${divergencias.length}`);

  console.log("\nDivergências por campo:");
  const sorted = Object.entries(fieldStats).sort((a, b) => b[1].div - a[1].div);
  for (const [c, s] of sorted) {
    if (s.div === 0) continue;
    const pct = ((s.div / s.total) * 100).toFixed(1);
    console.log(`  ${c.padEnd(22)} ${String(s.div).padStart(5)} / ${s.total}  (${pct}%)`);
  }

  // ---------- OUTPUTS ----------
  // CSV divergências
  const divCsv = ["clickup_id;nome;mes;campo;clickup;mysql"];
  for (const d of divergencias) {
    divCsv.push([d.clickupId, d.nome?.substring(0, 100), d.mes, d.campo, d.clickup, d.mysql].map(csvEscape).join(";"));
  }
  fs.writeFileSync(path.join(dataDir, `audit-2026-divergencias-${today}.csv`), divCsv.join("\n"));

  const ausCsv = ["clickup_id;nome;mes"];
  for (const a of ausentes) ausCsv.push([a.clickupId, a.nome?.substring(0, 100), a.mes].map(csvEscape).join(";"));
  fs.writeFileSync(path.join(dataDir, `audit-2026-ausentes-${today}.csv`), ausCsv.join("\n"));

  const extCsv = ["clickup_id;nome;mes"];
  for (const e of extras) extCsv.push([e.clickupId, e.nome?.substring(0, 100), e.mes].map(csvEscape).join(";"));
  fs.writeFileSync(path.join(dataDir, `audit-2026-extras-${today}.csv`), extCsv.join("\n"));

  // JSON completo
  fs.writeFileSync(path.join(dataDir, `audit-2026-${today}.json`), JSON.stringify({
    auditDate: new Date().toISOString(),
    snapshot: snapshotPath,
    summary: {
      clickup2026: tasks2026.length,
      mysql2026: dbRows.length,
      mysqlComClickup: dbRows.length - dbCrmOnly.length,
      mysqlCrmOnly: dbCrmOnly.length,
      auditadas, ausentes: ausentes.length, extras: extras.length, totalDivergencias: divergencias.length,
    },
    fieldStats, divergencias, ausentes, extras, crmOnly: dbCrmOnly.map((r) => ({ id: r.id, nome: r.name, mes: r.mes_referencia })),
  }, null, 2));

  console.log(`\nCSVs e JSON salvos em: ${dataDir}/audit-2026-*-${today}.{csv,json}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
