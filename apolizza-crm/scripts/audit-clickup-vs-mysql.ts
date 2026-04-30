/**
 * AUDITORIA COMPLETA: ClickUp vs MySQL
 * Compara TODOS os campos, campo a campo, task por task.
 * Gera relatório detalhado em JSON e resumo no console.
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// ============================================================
// CUSTOM FIELD UUIDs (do migrate-clickup.ts)
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
  "a fazer": "não iniciado",
  "to do": "não iniciado",
  "em andamento": "em andamento",
  "in progress": "em andamento",
  "feito": "fechado",
  "done": "fechado",
  "complete": "fechado",
  "concluido ocultar": "fechado",
  "raut": "raut",
};

// ============================================================
// PARSERS (replicam exatamente o migrate-clickup.ts)
// ============================================================
function getCustomField(task: any, uuid: string): any | null {
  return task.custom_fields?.find((f: any) => f.id === uuid) || null;
}

function getTextValue(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value === null || f.value === undefined || f.value === "") return null;
  return String(f.value).trim() || null;
}

function getDropdownLabel(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value === null || f.value === undefined) return null;
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
  if (!f || f.value === null || f.value === undefined) return null;
  const rawStr = String(f.value);
  const raw = parseFloat(rawStr);
  if (isNaN(raw) || raw === 0) return null;
  const hasDecimal = rawStr.includes(".");
  const value = hasDecimal ? raw : raw / 100;
  return value.toFixed(2);
}

function getIntValue(task: any, uuid: string): number | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value === null || f.value === undefined) return null;
  const n = parseInt(String(f.value), 10);
  return isNaN(n) ? null : n;
}

function getComissaoValue(task: any, uuid: string): string | null {
  const f = getCustomField(task, uuid);
  if (!f || f.value === null || f.value === undefined || f.value === "") return null;
  const raw = String(f.value).trim();
  if (!raw) return null;
  if (/^[\d.,]+%$/.test(raw)) {
    const num = parseFloat(raw.replace("%", "").replace(",", "."));
    return isNaN(num) ? raw : num.toFixed(2);
  }
  if (/^[\d.,]+$/.test(raw)) {
    const num = parseFloat(raw.replace(",", "."));
    return isNaN(num) ? raw : num.toFixed(2);
  }
  return raw;
}

function normalizeStatus(s: string): string {
  const lower = s.toLowerCase().trim();
  return STATUS_MAP[lower] || lower;
}

function normalizePriority(p: string | null): string {
  if (!p) return "normal";
  const map: Record<string, string> = { urgent: "urgente", high: "alta", normal: "normal", low: "baixa" };
  return map[p.toLowerCase()] || "normal";
}

function msToDateStr(ms: string | null): string | null {
  if (!ms) return null;
  const num = Number(ms);
  if (isNaN(num)) return null;
  return new Date(num).toISOString().split("T")[0];
}

function getAnoReferencia(task: any): number | null {
  // 1. ANO dropdown
  const f = getCustomField(task, CF.ANO);
  if (f && f.value !== null && f.value !== undefined) {
    const idx = Number(f.value);
    if (!isNaN(idx) && ANO_MAP[idx] !== undefined) return ANO_MAP[idx];
  }
  // 2. start_date
  if (task.start_date) {
    const d = new Date(Number(task.start_date));
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  // 3. due_date
  if (task.due_date) {
    const d = new Date(Number(task.due_date));
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  // 4. date_created
  if (task.date_created) {
    const d = new Date(Number(task.date_created));
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  return null;
}

function getMesReferencia(task: any): string | null {
  // Tenta dropdown MES primeiro
  const mesLabel = getDropdownLabel(task, CF.MES);
  if (mesLabel) return mesLabel.toUpperCase();
  // Fallback: due_date
  if (!task.due_date) return null;
  const d = new Date(Number(task.due_date));
  if (isNaN(d.getTime())) return null;
  return MESES[d.getMonth()] || null;
}

// ============================================================
// COMPARAÇÃO CAMPO A CAMPO
// ============================================================
interface Divergencia {
  clickupId: string;
  nome: string;
  campo: string;
  clickup: any;
  mysql: any;
}

function normalizeForCompare(v: any): string {
  if (v === null || v === undefined || v === "") return "__NULL__";
  if (typeof v === "number") return v.toFixed(2);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  let s = String(v).trim();
  // Normaliza datas no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) s = s.split("T")[0];
  return s;
}

function compareDecimal(clickup: string | null, mysql: string | null): boolean {
  const a = clickup ? parseFloat(clickup) : null;
  const b = mysql ? parseFloat(mysql) : null;
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.015; // tolerância de 1 centavo
}

function compareField(campo: string, clickupVal: any, mysqlVal: any): boolean {
  // Campos financeiros — comparação numérica com tolerância
  if (["premioSemIof", "aReceber", "valorPerda"].includes(campo)) {
    return compareDecimal(clickupVal, mysqlVal);
  }

  const a = normalizeForCompare(clickupVal);
  const b = normalizeForCompare(mysqlVal);

  // Case-insensitive para texto
  if (a.toLowerCase() === b.toLowerCase()) return true;

  return false;
}

function safeDateStr(v: any): string | null {
  if (!v) return null;
  try {
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      return v.toISOString().split("T")[0];
    }
    const s = String(v);
    // Já no formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // YYYY-MM-DDTHH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split("T")[0];
    // Date string longa
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(70));
  console.log("  AUDITORIA CLICKUP vs MYSQL — Campo a Campo");
  console.log("=".repeat(70));

  // 1. Carregar backup ClickUp mais recente
  const dataDir = path.resolve(__dirname, "../data");
  const backupFile = "clickup-backup-2026-04-20.json";
  const backupPath = path.join(dataDir, backupFile);

  if (!fs.existsSync(backupPath)) {
    console.error(`Backup não encontrado: ${backupPath}`);
    process.exit(1);
  }

  console.log(`\nCarregando backup: ${backupFile}...`);
  const tasks: any[] = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  console.log(`Total tasks no backup: ${tasks.length}`);

  // 2. Conectar ao MySQL
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  console.log("Conectado ao MySQL.\n");

  // 3. Buscar TODAS as cotações do MySQL com clickup_id
  const [rows] = await conn.execute(
    "SELECT * FROM cotacoes WHERE clickup_id IS NOT NULL AND deleted_at IS NULL"
  ) as [any[], any];
  console.log(`Total cotações MySQL (com clickup_id): ${rows.length}`);

  // Indexar MySQL por clickup_id
  const mysqlMap = new Map<string, any>();
  for (const row of rows) {
    mysqlMap.set(row.clickup_id, row);
  }

  // 4. Auditoria campo a campo
  const divergencias: Divergencia[] = [];
  const ausentes: { clickupId: string; nome: string }[] = [];
  const extras: { clickupId: string; nome: string }[] = [];
  let auditados = 0;

  const fieldStats: Record<string, { total: number; divergentes: number }> = {};
  function initField(campo: string) {
    if (!fieldStats[campo]) fieldStats[campo] = { total: 0, divergentes: 0 };
  }

  for (const task of tasks) {
    const clickupId = task.id;
    const dbRow = mysqlMap.get(clickupId);

    if (!dbRow) {
      ausentes.push({ clickupId, nome: task.name });
      continue;
    }

    auditados++;
    mysqlMap.delete(clickupId); // marca como processado

    // Extrair valores do ClickUp usando mesmos parsers da migração
    const ck = {
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
      observacao: getTextValue(task, CF.OBSERVACAO) || (task.description?.trim() || null),
      mesReferencia: getMesReferencia(task),
      anoReferencia: getAnoReferencia(task),
    };

    // Valores do MySQL
    const db = {
      name: dbRow.name,
      status: dbRow.status,
      priority: dbRow.priority || "normal",
      dueDate: safeDateStr(dbRow.due_date),
      tipoCliente: dbRow.tipo_cliente || null,
      seguradora: dbRow.seguradora || null,
      produto: dbRow.produto || null,
      situacao: dbRow.situacao || null,
      indicacao: dbRow.indicacao || null,
      inicioVigencia: safeDateStr(dbRow.inicio_vigencia),
      fimVigencia: safeDateStr(dbRow.fim_vigencia),
      primeiroPagamento: safeDateStr(dbRow.primeiro_pagamento),
      proximaTratativa: safeDateStr(dbRow.proxima_tratativa),
      parceladoEm: dbRow.parcelado_em,
      premioSemIof: dbRow.premio_sem_iof ? String(dbRow.premio_sem_iof) : null,
      aReceber: dbRow.a_receber ? String(dbRow.a_receber) : null,
      valorPerda: dbRow.valor_perda ? String(dbRow.valor_perda) : null,
      comissao: dbRow.comissao || null,
      observacao: dbRow.observacao || null,
      mesReferencia: dbRow.mes_referencia || null,
      anoReferencia: dbRow.ano_referencia,
    };

    // Comparar cada campo
    const campos = Object.keys(ck) as (keyof typeof ck)[];
    for (const campo of campos) {
      initField(campo);
      fieldStats[campo].total++;

      // Observação: comparação especial (truncada, com fallback description)
      if (campo === "observacao") {
        const ckObs = normalizeForCompare(ck.observacao);
        const dbObs = normalizeForCompare(db.observacao);
        // Só reporta se ambos têm valor e são diferentes
        if (ckObs !== "__NULL__" && dbObs !== "__NULL__" && ckObs.substring(0, 200).toLowerCase() !== dbObs.substring(0, 200).toLowerCase()) {
          fieldStats[campo].divergentes++;
          divergencias.push({
            clickupId,
            nome: task.name,
            campo,
            clickup: ck.observacao?.substring(0, 100),
            mysql: db.observacao?.substring(0, 100),
          });
        }
        continue;
      }

      if (!compareField(campo, ck[campo], db[campo])) {
        fieldStats[campo].divergentes++;
        divergencias.push({
          clickupId,
          nome: task.name,
          campo,
          clickup: ck[campo],
          mysql: db[campo],
        });
      }
    }
  }

  // Registros no MySQL que não existem no ClickUp backup
  for (const [cid, row] of mysqlMap) {
    extras.push({ clickupId: cid, nome: row.name });
  }

  // ============================================================
  // RELATÓRIO
  // ============================================================
  console.log("\n" + "=".repeat(70));
  console.log("  RESULTADOS DA AUDITORIA");
  console.log("=".repeat(70));

  console.log(`\n📊 RESUMO GERAL:`);
  console.log(`   Tasks no backup ClickUp:    ${tasks.length}`);
  console.log(`   Cotações no MySQL:          ${rows.length}`);
  console.log(`   Auditadas (match):          ${auditados}`);
  console.log(`   No ClickUp mas não no MySQL: ${ausentes.length}`);
  console.log(`   No MySQL mas não no backup:  ${extras.length}`);
  console.log(`   Total divergências:         ${divergencias.length}`);

  console.log(`\n📋 DIVERGÊNCIAS POR CAMPO:`);
  console.log("   " + "-".repeat(50));
  const sortedFields = Object.entries(fieldStats)
    .sort((a, b) => b[1].divergentes - a[1].divergentes);
  for (const [campo, stats] of sortedFields) {
    const pct = ((stats.divergentes / stats.total) * 100).toFixed(1);
    const bar = stats.divergentes > 0 ? "⚠️ " : "✅ ";
    console.log(`   ${bar}${campo.padEnd(22)} ${String(stats.divergentes).padStart(5)} / ${stats.total}  (${pct}%)`);
  }

  if (ausentes.length > 0 && ausentes.length <= 50) {
    console.log(`\n❌ TASKS NO CLICKUP MAS NÃO NO MYSQL (${ausentes.length}):`);
    for (const a of ausentes.slice(0, 20)) {
      console.log(`   - ${a.clickupId}: ${a.nome.substring(0, 60)}`);
    }
    if (ausentes.length > 20) console.log(`   ... e mais ${ausentes.length - 20}`);
  }

  if (extras.length > 0) {
    console.log(`\n➕ NO MYSQL MAS NÃO NO BACKUP (${extras.length}):`);
    for (const e of extras.slice(0, 20)) {
      console.log(`   - ${e.clickupId}: ${e.nome.substring(0, 60)}`);
    }
  }

  // Top 10 divergências por exemplo
  if (divergencias.length > 0) {
    console.log(`\n🔍 EXEMPLOS DE DIVERGÊNCIAS (primeiros 15):`);
    for (const d of divergencias.slice(0, 15)) {
      console.log(`   [${d.campo}] ${d.nome.substring(0, 40)}`);
      console.log(`     ClickUp: ${JSON.stringify(d.clickup)}`);
      console.log(`     MySQL:   ${JSON.stringify(d.mysql)}`);
    }
  }

  // Salvar relatório completo em JSON
  const report = {
    auditDate: new Date().toISOString(),
    backupFile,
    summary: {
      totalClickUp: tasks.length,
      totalMySQL: rows.length,
      auditados,
      ausentesNoMySQL: ausentes.length,
      extrasNoMySQL: extras.length,
      totalDivergencias: divergencias.length,
    },
    fieldStats,
    ausentes: ausentes.slice(0, 200),
    extras,
    divergencias,
  };

  const reportPath = path.join(dataDir, `audit-report-${new Date().toISOString().split("T")[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Relatório completo salvo em: ${reportPath}`);

  await conn.end();
  console.log("\n— Dara, arquitetando dados 🗄️\n");
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
