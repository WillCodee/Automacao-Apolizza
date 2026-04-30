/**
 * AUDITORIA 2026 — v2 (refinada)
 *
 * Mudanças vs v1:
 *  - Comparador refinado: comissao numérica, null≡"0" em currency, CCLIENTE como bug conhecido
 *  - Exclui 158 cotações ABR/2026 vindas das planilhas (SoT = planilha)
 *  - Classifica divergências por tier (alta/média/baixa)
 *  - Marca CURRENCY_AMBIGUO (raw inteiro sem ponto) separadamente
 *  - Gera SQL de fix por bloco com log em cotacao_auditoria_correcoes
 *
 * Reusa snapshot: data/clickup-snapshot-cotacoes-{date}.json
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { dbQuery } from "../src/lib/db";

const TODAY = new Date().toISOString().split("T")[0];
const dataDir = path.resolve(__dirname, "../data");
const SNAPSHOT_PATH = path.join(dataDir, `clickup-snapshot-cotacoes-${TODAY}.json`);

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

// Tier de materialidade
const TIER_ALTA = ["aReceber", "premioSemIof", "valorPerda", "comissao", "parceladoEm"];
const TIER_MEDIA = ["status", "situacao", "mesReferencia", "dueDate", "inicioVigencia", "fimVigencia", "primeiroPagamento"];
const TIER_BAIXA = ["priority", "indicacao", "name", "proximaTratativa", "tipoCliente", "seguradora", "produto"];
function tierOf(c: string): "ALTA" | "MEDIA" | "BAIXA" | "X" {
  if (TIER_ALTA.includes(c)) return "ALTA";
  if (TIER_MEDIA.includes(c)) return "MEDIA";
  if (TIER_BAIXA.includes(c)) return "BAIXA";
  return "X";
}

// ============================================================
// Parsers (idem migrator)
// ============================================================
function gcf(t: any, u: string) { return t.custom_fields?.find((f: any) => f.id === u) || null; }
function txt(t: any, u: string): string | null {
  const f = gcf(t, u); if (!f || f.value == null || f.value === "") return null;
  return String(f.value).trim() || null;
}
function dd(t: any, u: string): string | null {
  const f = gcf(t, u); if (!f || f.value == null) return null;
  const opts = f.type_config?.options;
  if (!opts) return String(f.value);
  const idx = Number(f.value); if (isNaN(idx)) return null;
  const o = opts.find((x: any) => x.orderindex === idx);
  return o ? (o.name || o.label || null) : null;
}
function dat(t: any, u: string): string | null {
  const f = gcf(t, u); if (!f?.value) return null;
  const ms = Number(f.value); if (isNaN(ms)) return null;
  return new Date(ms).toISOString().split("T")[0];
}
function curr(t: any, u: string): { val: string | null; ambiguo: boolean; raw: string | null } {
  const f = gcf(t, u); if (!f || f.value == null) return { val: null, ambiguo: false, raw: null };
  const rawStr = String(f.value);
  const raw = parseFloat(rawStr); if (isNaN(raw) || raw === 0) return { val: null, ambiguo: false, raw: rawStr };
  const hasDot = rawStr.includes(".");
  const value = hasDot ? raw : raw / 100;
  // Ambíguo: raw inteiro sem ponto. Sem ground truth, não dá pra saber
  // se é cents (correto dividir) ou reais (errado dividir).
  const ambiguo = !hasDot;
  return { val: value.toFixed(2), ambiguo, raw: rawStr };
}
function intv(t: any, u: string): number | null {
  const f = gcf(t, u); if (!f || f.value == null) return null;
  const n = parseInt(String(f.value), 10); return isNaN(n) ? null : n;
}
function comissaoNum(s: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/%/g, "").replace(",", ".").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
function getComissaoStr(t: any, u: string): string | null {
  const f = gcf(t, u); if (!f || f.value == null || f.value === "") return null;
  return String(f.value).trim() || null;
}
function getAno(t: any): number | null {
  const f = gcf(t, CF.ANO);
  if (f?.value != null) {
    const idx = Number(f.value);
    if (!isNaN(idx) && ANO_MAP[idx] !== undefined) return ANO_MAP[idx];
  }
  for (const k of ["start_date", "due_date", "date_created"]) {
    if (t[k]) { const d = new Date(Number(t[k])); if (!isNaN(d.getTime())) return d.getFullYear(); }
  }
  return null;
}
function getMes(t: any): string | null {
  const lbl = dd(t, CF.MES);
  if (lbl) return lbl.toUpperCase();
  if (!t.due_date) return null;
  const d = new Date(Number(t.due_date));
  return isNaN(d.getTime()) ? null : (MESES[d.getMonth()] || null);
}
function normalizeStatus(s: string): string {
  const map: Record<string, string> = {
    "a fazer": "não iniciado", "to do": "não iniciado",
    "em andamento": "em andamento", "in progress": "em andamento",
    "feito": "fechado", "done": "fechado", "complete": "fechado",
    "concluido ocultar": "fechado", "raut": "raut",
  };
  const k = s.toLowerCase().trim();
  return map[k] || k;
}
function normalizePriority(p: string | null): string {
  if (!p) return "normal";
  const m: Record<string, string> = { urgent: "urgente", high: "alta", normal: "normal", low: "baixa" };
  return m[p.toLowerCase()] || "normal";
}
function safeDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().split("T")[0];
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split("T")[0];
  const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}
function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}
function sqlEscape(v: any): string {
  if (v == null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ============================================================
// Comparador refinado
// ============================================================
function isEmpty(v: any): boolean { return v == null || v === "" || v === "__NULL__"; }

function eqRefined(campo: string, ck: any, db: any): boolean {
  // null ≡ "0" para currency
  if (TIER_ALTA.includes(campo) || campo === "valorPerda") {
    if (campo === "comissao") {
      const a = comissaoNum(ck), b = comissaoNum(db);
      if (a == null && b == null) return true;
      if (a == null || b == null) return isEmpty(ck) && isEmpty(db);
      return Math.abs(a - b) < 0.01;
    }
    // currency / parcelado
    const a = ck != null && ck !== "" ? parseFloat(String(ck)) : null;
    const b = db != null && db !== "" ? parseFloat(String(db)) : null;
    const A = a == null || a === 0 ? null : a;
    const B = b == null || b === 0 ? null : b;
    if (A == null && B == null) return true;
    if (A == null || B == null) return false;
    return Math.abs(A - B) < 0.015;
  }
  // CCLIENTE bug — tratar como divergência real (queremos saber)
  // Datas
  if (["dueDate", "inicioVigencia", "fimVigencia", "primeiroPagamento", "proximaTratativa"].includes(campo)) {
    if (isEmpty(ck) && isEmpty(db)) return true;
    return String(ck || "") === String(db || "");
  }
  // Texto
  if (isEmpty(ck) && isEmpty(db)) return true;
  return String(ck || "").trim().toLowerCase() === String(db || "").trim().toLowerCase();
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot não encontrado: ${SNAPSHOT_PATH}. Rode audit-2026-clickup.ts primeiro.`);
    process.exit(1);
  }
  const tasks: any[] = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
  const tasks2026 = tasks.filter((t) => getAno(t) === 2026);
  console.log(`Snapshot: ${tasks.length} tasks. 2026: ${tasks2026.length}`);

  // Identifica IDs vindos das planilhas (158 ABR/2026 com clickup_id, atualizadas em/depois 2026-04-29)
  const planilhaRows = await dbQuery<any>(`
    SELECT clickup_id FROM cotacoes
    WHERE mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL
      AND clickup_id IS NOT NULL AND DATE(updated_at) >= '2026-04-29'`);
  const planilhaIds = new Set(planilhaRows.map((r) => r.clickup_id));
  console.log(`ABR/2026 vindos da planilha (excluídos da auditoria): ${planilhaIds.size}`);

  const dbRows = await dbQuery<any>(`SELECT * FROM cotacoes WHERE ano_referencia=2026 AND deleted_at IS NULL`);
  const dbByCk = new Map<string, any>();
  for (const r of dbRows) if (r.clickup_id) dbByCk.set(r.clickup_id, r);

  const divs: any[] = [];
  const ausentes: any[] = [];
  const fieldStats: Record<string, { tot: number; div: number }> = {};
  const currencyAmbiguo: any[] = [];
  let auditadas = 0, ignoradasPlanilha = 0;

  for (const task of tasks2026) {
    if (planilhaIds.has(task.id)) { ignoradasPlanilha++; dbByCk.delete(task.id); continue; }
    const dbRow = dbByCk.get(task.id);
    if (!dbRow) {
      ausentes.push({ clickupId: task.id, nome: task.name, mes: getMes(task) });
      continue;
    }
    auditadas++;
    dbByCk.delete(task.id);

    const cPremio = curr(task, CF.PREMIO_SEM_IOF);
    const cAReceber = curr(task, CF.A_RECEBER);
    const cValorPerda = curr(task, CF.VALOR_PERDA);

    const ck: Record<string, any> = {
      name: task.name?.substring(0, 500) || "",
      status: normalizeStatus(task.status?.status || "não iniciado"),
      priority: normalizePriority(task.priority?.priority || null),
      dueDate: task.due_date ? new Date(Number(task.due_date)).toISOString().split("T")[0] : null,
      tipoCliente: dd(task, CF.TIPO_CLIENTE),
      seguradora: txt(task, CF.SEGURADORA),
      produto: dd(task, CF.PRODUTO),
      situacao: dd(task, CF.SITUACAO),
      indicacao: txt(task, CF.INDICACAO),
      inicioVigencia: dat(task, CF.INICIO_VIGENCIA),
      fimVigencia: dat(task, CF.FIM_VIGENCIA),
      primeiroPagamento: dat(task, CF.PRIMEIRO_PAGAMENTO),
      proximaTratativa: dat(task, CF.PROXIMA_TRATATIVA),
      parceladoEm: intv(task, CF.PARCELADO_EM),
      premioSemIof: cPremio.val,
      aReceber: cAReceber.val,
      valorPerda: cValorPerda.val,
      comissao: getComissaoStr(task, CF.COMISSAO),
      mesReferencia: getMes(task),
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
    };

    for (const campo of Object.keys(ck)) {
      if (!fieldStats[campo]) fieldStats[campo] = { tot: 0, div: 0 };
      fieldStats[campo].tot++;
      if (!eqRefined(campo, ck[campo], db[campo])) {
        fieldStats[campo].div++;
        const tier = tierOf(campo);
        const ambiguo = (campo === "premioSemIof" && cPremio.ambiguo) ||
                        (campo === "aReceber" && cAReceber.ambiguo) ||
                        (campo === "valorPerda" && cValorPerda.ambiguo);
        divs.push({
          clickupId: task.id, cotacaoId: dbRow.id, nome: task.name?.substring(0, 100), mes: ck.mesReferencia,
          campo, tier, ambiguo,
          clickup: ck[campo], mysql: db[campo],
          rawClickup: campo === "premioSemIof" ? cPremio.raw : campo === "aReceber" ? cAReceber.raw : campo === "valorPerda" ? cValorPerda.raw : null,
        });
        if (ambiguo) currencyAmbiguo.push({ clickupId: task.id, nome: task.name, campo, raw: campo === "premioSemIof" ? cPremio.raw : campo === "aReceber" ? cAReceber.raw : cValorPerda.raw, parserDeu: ck[campo], banco: db[campo] });
      }
    }
  }

  const extras: any[] = [];
  for (const [cid, row] of dbByCk) extras.push({ clickupId: cid, cotacaoId: row.id, nome: row.name, mes: row.mes_referencia });

  // ============================================================
  // RELATÓRIO
  // ============================================================
  console.log("\n" + "=".repeat(70));
  console.log("  AUDITORIA 2026 v2 — RESULTADOS");
  console.log("=".repeat(70));
  console.log(`\nClickUp 2026:                ${tasks2026.length}`);
  console.log(`Banco 2026 ativos:           ${dbRows.length}`);
  console.log(`Excluídos (planilha SoT):    ${ignoradasPlanilha}`);
  console.log(`Auditados:                   ${auditadas}`);
  console.log(`Ausentes (no ClickUp não DB): ${ausentes.length}`);
  console.log(`Extras (no DB sem ClickUp):  ${extras.length}`);
  console.log(`Total divergências:          ${divs.length}`);
  console.log(`  CURRENCY_AMBIGUO:          ${currencyAmbiguo.length}`);

  console.log("\nDivergências por campo (com tier):");
  const sorted = Object.entries(fieldStats).sort((a, b) => b[1].div - a[1].div);
  for (const [c, s] of sorted) {
    if (s.div === 0) continue;
    const pct = ((s.div / s.tot) * 100).toFixed(1);
    console.log(`  [${tierOf(c).padEnd(5)}] ${c.padEnd(22)} ${String(s.div).padStart(4)}/${s.tot}  (${pct}%)`);
  }

  const byTier: Record<string, number> = { ALTA: 0, MEDIA: 0, BAIXA: 0 };
  for (const d of divs) byTier[d.tier]++;
  console.log("\nDivergências por tier:");
  for (const [t, n] of Object.entries(byTier)) console.log(`  ${t}: ${n}`);

  // ============================================================
  // OUTPUTS
  // ============================================================
  const outBase = path.join(dataDir, `audit-2026-v2-${TODAY}`);

  // CSV divergências
  const csv = ["clickup_id;cotacao_id;nome;mes;campo;tier;ambiguo;clickup;mysql;rawClickup"];
  for (const d of divs) csv.push([d.clickupId, d.cotacaoId, d.nome, d.mes, d.campo, d.tier, d.ambiguo ? "SIM" : "", d.clickup, d.mysql, d.rawClickup].map(csvEscape).join(";"));
  fs.writeFileSync(`${outBase}-divergencias.csv`, csv.join("\n"));

  // CSV ausentes
  const csvA = ["clickup_id;nome;mes"];
  for (const a of ausentes) csvA.push([a.clickupId, a.nome?.substring(0, 100), a.mes].map(csvEscape).join(";"));
  fs.writeFileSync(`${outBase}-ausentes.csv`, csvA.join("\n"));

  // CSV extras
  const csvE = ["clickup_id;cotacao_id;nome;mes"];
  for (const e of extras) csvE.push([e.clickupId, e.cotacaoId, e.nome?.substring(0, 100), e.mes].map(csvEscape).join(";"));
  fs.writeFileSync(`${outBase}-extras.csv`, csvE.join("\n"));

  // CSV ambíguos
  const csvAmb = ["clickup_id;nome;campo;raw_clickup;parser_deu;banco"];
  for (const a of currencyAmbiguo) csvAmb.push([a.clickupId, a.nome?.substring(0, 100), a.campo, a.raw, a.parserDeu, a.banco].map(csvEscape).join(";"));
  fs.writeFileSync(`${outBase}-currency-ambiguo.csv`, csvAmb.join("\n"));

  // SQL DDL: tabela de log
  const ddl = `-- Tabela de log de correções automáticas da auditoria
CREATE TABLE IF NOT EXISTS cotacao_auditoria_correcoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cotacao_id CHAR(36) NOT NULL,
  campo VARCHAR(50) NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  tier VARCHAR(10),
  audit_run_id VARCHAR(50),
  fonte VARCHAR(20) DEFAULT 'clickup',
  aplicado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cotacao (cotacao_id),
  INDEX idx_run (audit_run_id)
);
`;
  fs.writeFileSync(`${outBase}-ddl.sql`, ddl);

  // SQL fix por tier
  const runId = `audit-2026-${TODAY}`;
  const dbFieldMap: Record<string, string> = {
    name: "name", status: "status", priority: "priority", dueDate: "due_date",
    tipoCliente: "tipo_cliente", seguradora: "seguradora", produto: "produto", situacao: "situacao",
    indicacao: "indicacao", inicioVigencia: "inicio_vigencia", fimVigencia: "fim_vigencia",
    primeiroPagamento: "primeiro_pagamento", proximaTratativa: "proxima_tratativa",
    parceladoEm: "parcelado_em", premioSemIof: "premio_sem_iof", aReceber: "a_receber",
    valorPerda: "valor_perda", comissao: "comissao", mesReferencia: "mes_referencia",
  };
  function makeFixSQL(tier: string, divs: any[]): string {
    let sql = `-- ${tier} — ${divs.length} correções\n-- run_id: ${runId}\nSTART TRANSACTION;\n`;
    for (const d of divs) {
      if (d.ambiguo) continue; // pular ambíguos sempre
      const col = dbFieldMap[d.campo]; if (!col) continue;
      sql += `INSERT INTO cotacao_auditoria_correcoes (cotacao_id, campo, valor_antigo, valor_novo, tier, audit_run_id) VALUES (${sqlEscape(d.cotacaoId)}, ${sqlEscape(d.campo)}, ${sqlEscape(d.mysql)}, ${sqlEscape(d.clickup)}, ${sqlEscape(tier)}, ${sqlEscape(runId)});\n`;
      sql += `UPDATE cotacoes SET ${col} = ${sqlEscape(d.clickup)}, updated_at = NOW() WHERE id = ${sqlEscape(d.cotacaoId)};\n`;
    }
    sql += `COMMIT;\n`;
    return sql;
  }
  const divBaixa = divs.filter((d) => d.tier === "BAIXA" && !d.ambiguo);
  const divMedia = divs.filter((d) => d.tier === "MEDIA" && !d.ambiguo);
  const divAlta = divs.filter((d) => d.tier === "ALTA" && !d.ambiguo);
  fs.writeFileSync(`${outBase}-fix-baixa.sql`, makeFixSQL("BAIXA", divBaixa));
  fs.writeFileSync(`${outBase}-fix-media.sql`, makeFixSQL("MEDIA", divMedia));
  fs.writeFileSync(`${outBase}-fix-alta-APROVACAO.sql`, makeFixSQL("ALTA", divAlta));

  // SQL fix CCLIENTE → CLIENTE (typo histórico, escopo global, não só 2026)
  fs.writeFileSync(`${outBase}-fix-cliente-typo.sql`,
    `-- CCLIENTE → CLIENTE (typo histórico em 115+ cotações)\n` +
    `START TRANSACTION;\n` +
    `INSERT INTO cotacao_auditoria_correcoes (cotacao_id, campo, valor_antigo, valor_novo, tier, audit_run_id, fonte)\n` +
    `  SELECT id, 'situacao', 'CCLIENTE', 'CLIENTE', 'MEDIA', '${runId}', 'clickup' FROM cotacoes WHERE situacao='CCLIENTE';\n` +
    `UPDATE cotacoes SET situacao='CLIENTE', updated_at=NOW() WHERE situacao='CCLIENTE';\nCOMMIT;\n`
  );

  // SQL extras (5 cotações no DB sem ClickUp)
  let extrasSql = `-- EXTRAS — ${extras.length} cotações no banco sem correspondência no ClickUp.\n-- Verifique antes via API: GET /task/{id}. Se 404 = soft-delete OK.\n-- run_id: ${runId}\n\n`;
  for (const e of extras) {
    extrasSql += `-- ${e.nome?.substring(0, 60)} (${e.mes})\n`;
    extrasSql += `-- UPDATE cotacoes SET deleted_at=NOW() WHERE id=${sqlEscape(e.cotacaoId)}; -- clickup_id=${e.clickupId}\n\n`;
  }
  fs.writeFileSync(`${outBase}-extras-deletar.sql`, extrasSql);

  // JSON completo
  fs.writeFileSync(`${outBase}.json`, JSON.stringify({
    auditDate: new Date().toISOString(),
    runId,
    snapshot: SNAPSHOT_PATH,
    summary: {
      clickup2026: tasks2026.length, mysql2026: dbRows.length,
      ignoradasPlanilha: ignoradasPlanilha, auditadas,
      ausentes: ausentes.length, extras: extras.length,
      totalDivergencias: divs.length, currencyAmbiguo: currencyAmbiguo.length,
      porTier: byTier,
    },
    fieldStats, divergencias: divs, ausentes, extras, currencyAmbiguo,
  }, null, 2));

  console.log(`\n📁 Arquivos gerados em data/audit-2026-v2-${TODAY}-*:`);
  console.log(`  - divergencias.csv, ausentes.csv, extras.csv, currency-ambiguo.csv`);
  console.log(`  - ddl.sql (cria tabela de log)`);
  console.log(`  - fix-baixa.sql (auto), fix-media.sql (auto), fix-alta-APROVACAO.sql (revisar)`);
  console.log(`  - fix-cliente-typo.sql (CCLIENTE→CLIENTE)`);
  console.log(`  - extras-deletar.sql (revisar antes)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
