/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as XLSX from "xlsx";
import * as fs from "fs";
import mysql from "mysql2/promise";

const FILES = [
  { label: "BENEFICIOS", file: "dados/BENEFICIOS SAUDE VIDA DENTAL E GARANTIAS DE ABRIL.xlsx" },
  { label: "RAMOS_ELEMENTAR", file: "dados/RAMOS ELEMENTAR AUTO, RC, VIAGEM, EMPRESARIAL, CONDOMINIO, ETC DE ABRIL.xlsx" },
];

const TS = new Date().toISOString().slice(0, 10);
const OUT_DIR = "data";
const PREFIX = `audit-abril-2026-planilha-${TS}`;

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const utcDays = v - 25569;
    const ms = utcDays * 86400 * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    return t.slice(0, 10);
  }
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function intVal(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function lower(v: unknown): string | null {
  const s = str(v);
  return s ? s.toLowerCase() : null;
}

function priorityMap(v: unknown): string | null {
  const s = lower(v);
  if (!s) return null;
  if (s === "high") return "alta";
  if (s === "low") return "baixa";
  if (s === "normal") return "normal";
  if (s === "urgent") return "urgente";
  return s;
}

type SheetRow = {
  origem: string;
  clickupId: string;
  name: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  proximaTratativa: string | null;
  aReceber: number | null;
  anoReferencia: number | null;
  comissao: string | null;
  contatoCliente: string | null;
  fimVigencia: string | null;
  inicioVigencia: string | null;
  indicacao: string | null;
  mesReferencia: string | null;
  observacao: string | null;
  parceladoEm: number | null;
  premioSemIof: number | null;
  primeiroPagamento: string | null;
  produto: string | null;
  seguradora: string | null;
  situacao: string | null;
  tipoCliente: string | null;
  valorPerda: number | null;
};

function loadSheet(label: string, file: string): SheetRow[] {
  const wb = XLSX.readFile(path.resolve(file));
  const sh = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true }) as unknown[][];
  const headers = aoa[2] as string[];
  const dataRows = aoa.slice(3).filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== ""));
  return dataRows.map((row) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => { o[h] = (row as unknown[])[i] ?? null; });
    return {
      origem: label,
      clickupId: String(o["Task ID"] || "").trim(),
      name: str(o["Task Name"]),
      status: lower(o["Status"]),
      priority: priorityMap(o["Priority"]),
      dueDate: excelDateToISO(o["Due Date"]),
      proximaTratativa: excelDateToISO(o["A PRÓXIMA TRATIVA (date)"]),
      aReceber: num(o["A RECEBER (currency)"]),
      anoReferencia: intVal(o["ANO (drop down)"]),
      comissao: str(o["COMISSÃO APOLIZZA (short text)"]),
      contatoCliente: str(o["CONTATO CLIENTE (phone)"]),
      fimVigencia: excelDateToISO(o["DATA DE FIM VIGENCIA (date)"]),
      inicioVigencia: excelDateToISO(o["DATA DE INICIO VIGENCIA (date)"]),
      indicacao: str(o["INDICAÇÃO (short text)"]),
      mesReferencia: str(o["MÊS (drop down)"]),
      observacao: str(o["OBSERVAÇÃO (text)"]),
      parceladoEm: intVal(o["PARCELADO EM (number)"]),
      premioSemIof: num(o["PREMIO SEM IOF (currency)"]),
      primeiroPagamento: excelDateToISO(o["PRIMEIRO PAGAMENTO (date)"]),
      produto: str(o["PRODUTO (drop down)"]),
      seguradora: str(o["SEGURADORA (short text)"]),
      situacao: lower(o["SITUAÇÃO (drop down)"]),
      tipoCliente: str(o["TIPO CLIENTE (drop down)"]),
      valorPerda: num(o["VALOR EM PERDA (currency)"]),
    };
  }).filter((r) => r.clickupId);
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file: string, header: string[], rows: any[][]) {
  const lines = [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`  [csv] ${file} (${rows.length} linhas)`);
}

function normDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // usar componentes locais para evitar shift por timezone
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}
function eqDate(a: any, b: any): boolean {
  return normDate(a) === normDate(b);
}
function eqNum(a: any, b: any): boolean {
  const na = a == null || a === "" ? null : Number(a);
  const nb = b == null || b === "" ? null : Number(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  return Math.abs(na - nb) < 0.01;
}
function eqStr(a: any, b: any, lower = false): boolean {
  let sa = a == null ? "" : String(a).trim();
  let sb = b == null ? "" : String(b).trim();
  if (lower) { sa = sa.toLowerCase(); sb = sb.toLowerCase(); }
  return sa === sb;
}

const COMPARE_FIELDS: Array<{ key: keyof SheetRow; col: string; type: "str" | "lower" | "num" | "date" | "int"; informativo?: boolean }> = [
  { key: "name", col: "name", type: "str", informativo: true },
  { key: "status", col: "status", type: "lower" },
  { key: "priority", col: "priority", type: "lower" },
  { key: "dueDate", col: "due_date", type: "date" },
  { key: "proximaTratativa", col: "proxima_tratativa", type: "date" },
  { key: "aReceber", col: "a_receber", type: "num" },
  { key: "anoReferencia", col: "ano_referencia", type: "int" },
  { key: "comissao", col: "comissao", type: "str" },
  { key: "contatoCliente", col: "contato_cliente", type: "str" },
  { key: "fimVigencia", col: "fim_vigencia", type: "date" },
  { key: "inicioVigencia", col: "inicio_vigencia", type: "date" },
  { key: "indicacao", col: "indicacao", type: "str" },
  { key: "mesReferencia", col: "mes_referencia", type: "str" },
  { key: "observacao", col: "observacao", type: "str", informativo: true },
  { key: "parceladoEm", col: "parcelado_em", type: "int" },
  { key: "premioSemIof", col: "premio_sem_iof", type: "num" },
  { key: "primeiroPagamento", col: "primeiro_pagamento", type: "date" },
  { key: "produto", col: "produto", type: "str" },
  { key: "seguradora", col: "seguradora", type: "str" },
  { key: "situacao", col: "situacao", type: "lower" },
  { key: "tipoCliente", col: "tipo_cliente", type: "str" },
  { key: "valorPerda", col: "valor_perda", type: "num" },
];

function fieldsEqual(plan: any, db: any, type: string): boolean {
  switch (type) {
    case "date": return eqDate(plan, db);
    case "num":
    case "int": return eqNum(plan, db);
    case "lower": return eqStr(plan, db, true);
    case "str":
    default: return eqStr(plan, db);
  }
}

function sqlVal(v: any, type: string): string {
  if (v == null || v === "") return "NULL";
  if (type === "num" || type === "int") return String(v);
  if (type === "date") return `'${String(v).slice(0, 10)}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

(async () => {
  // 1) Carregar planilhas
  console.log("→ Carregando planilhas...");
  const planRows: SheetRow[] = [];
  for (const { label, file } of FILES) {
    const rows = loadSheet(label, file);
    console.log(`  ${label}: ${rows.length} linhas`);
    planRows.push(...rows);
  }
  const planById = new Map(planRows.map((r) => [r.clickupId, r]));
  console.log(`Total planilha: ${planRows.length} (${planById.size} clickup_ids únicos)`);

  // 2) Buscar banco WHERE mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL
  console.log("\n→ Consultando MySQL HostGator (mes_referencia='ABR' AND ano_referencia=2026)...");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não setado");
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, decimalNumbers: true });
  const [dbRowsRaw] = await conn.query(`
    SELECT
      id, clickup_id, name, status, priority, due_date,
      proxima_tratativa, a_receber, ano_referencia, comissao,
      contato_cliente, fim_vigencia, inicio_vigencia, indicacao,
      mes_referencia, observacao, parcelado_em, premio_sem_iof,
      primeiro_pagamento, produto, seguradora, situacao, tipo_cliente,
      valor_perda, deleted_at
    FROM cotacoes
    WHERE mes_referencia = 'ABR'
      AND ano_referencia = 2026
      AND deleted_at IS NULL
  `);
  const dbRows = dbRowsRaw as any[];
  console.log(`  banco: ${dbRows.length} cotações ABR/2026 (não deletadas)`);
  await conn.end();

  const dbByClickup = new Map<string, any>();
  for (const r of dbRows) {
    if (r.clickup_id) dbByClickup.set(String(r.clickup_id), r);
  }

  // 3) Cruzar
  const ausentes: SheetRow[] = []; // planilha tem, banco não
  const extras: any[] = [];        // banco tem, planilha não
  type Diverg = { clickupId: string; campo: string; planilha: any; banco: any; informativo: boolean; origem: string; nome: string };
  const divergencias: Diverg[] = [];

  for (const r of planRows) {
    const db = dbByClickup.get(r.clickupId);
    if (!db) {
      ausentes.push(r);
      continue;
    }
    for (const f of COMPARE_FIELDS) {
      const planVal = (r as any)[f.key];
      const dbVal = db[f.col];
      if (!fieldsEqual(planVal, dbVal, f.type)) {
        divergencias.push({
          clickupId: r.clickupId,
          campo: f.col,
          planilha: f.type === "date" ? normDate(planVal) : planVal,
          banco: f.type === "date" ? normDate(dbVal) : dbVal,
          informativo: !!f.informativo,
          origem: r.origem,
          nome: r.name || db.name || "",
        });
      }
    }
  }

  for (const r of dbRows) {
    if (!r.clickup_id || !planById.has(String(r.clickup_id))) extras.push(r);
  }

  // 4) Gerar CSVs
  console.log("\n→ Gerando relatórios...");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  writeCsv(`${OUT_DIR}/${PREFIX}-ausentes-no-banco.csv`,
    ["origem", "clickup_id", "name", "status", "produto", "seguradora", "tipo_cliente", "premio_sem_iof", "a_receber", "valor_perda"],
    ausentes.map((r) => [r.origem, r.clickupId, r.name, r.status, r.produto, r.seguradora, r.tipoCliente, r.premioSemIof, r.aReceber, r.valorPerda])
  );

  writeCsv(`${OUT_DIR}/${PREFIX}-extras-no-banco.csv`,
    ["clickup_id", "name", "status", "produto", "seguradora", "tipo_cliente", "premio_sem_iof", "a_receber", "valor_perda", "created_at"],
    extras.map((r) => [r.clickup_id, r.name, r.status, r.produto, r.seguradora, r.tipo_cliente, r.premio_sem_iof, r.a_receber, r.valor_perda, r.created_at])
  );

  writeCsv(`${OUT_DIR}/${PREFIX}-divergencias.csv`,
    ["origem", "clickup_id", "name", "campo", "planilha", "banco", "informativo"],
    divergencias.map((d) => [d.origem, d.clickupId, d.nome, d.campo, d.planilha, d.banco, d.informativo ? "sim" : "nao"])
  );

  // 5) Gerar SQLs
  // INSERTs para ausentes
  const insertSqlLines: string[] = [
    "-- audit-abril-2026: INSERTs para cotações da planilha ausentes no banco",
    "-- ATENÇÃO: revisar antes de aplicar. assignee_id ficará NULL (precisa atribuir manualmente).",
    "",
  ];
  for (const r of ausentes) {
    const cols = [
      "id", "clickup_id", "name", "status", "priority", "due_date",
      "proxima_tratativa", "a_receber", "ano_referencia", "comissao",
      "contato_cliente", "fim_vigencia", "inicio_vigencia", "indicacao",
      "mes_referencia", "observacao", "parcelado_em", "premio_sem_iof",
      "primeiro_pagamento", "produto", "seguradora", "situacao",
      "tipo_cliente", "valor_perda", "is_renovacao",
    ];
    const vals = [
      "UUID()",
      sqlVal(r.clickupId, "str"),
      sqlVal(r.name, "str"),
      sqlVal(r.status, "str"),
      sqlVal(r.priority, "str"),
      sqlVal(r.dueDate, "date"),
      sqlVal(r.proximaTratativa, "date"),
      sqlVal(r.aReceber, "num"),
      sqlVal(r.anoReferencia, "int"),
      sqlVal(r.comissao, "str"),
      sqlVal(r.contatoCliente, "str"),
      sqlVal(r.fimVigencia, "date"),
      sqlVal(r.inicioVigencia, "date"),
      sqlVal(r.indicacao, "str"),
      sqlVal(r.mesReferencia, "str"),
      sqlVal(r.observacao, "str"),
      sqlVal(r.parceladoEm, "int"),
      sqlVal(r.premioSemIof, "num"),
      sqlVal(r.primeiroPagamento, "date"),
      sqlVal(r.produto, "str"),
      sqlVal(r.seguradora, "str"),
      sqlVal(r.situacao, "str"),
      sqlVal(r.tipoCliente, "str"),
      sqlVal(r.valorPerda, "num"),
      r.tipoCliente === "RENOVAÇÃO" ? "TRUE" : "FALSE",
    ];
    insertSqlLines.push(`INSERT INTO cotacoes (${cols.join(", ")}) VALUES (${vals.join(", ")});`);
  }
  fs.writeFileSync(`${OUT_DIR}/${PREFIX}-inserts.sql`, insertSqlLines.join("\n"));
  console.log(`  [sql] ${OUT_DIR}/${PREFIX}-inserts.sql (${ausentes.length} INSERTs)`);

  // UPDATEs para divergências (não-informativas, agrupadas por clickup_id)
  const updateGroups = new Map<string, Diverg[]>();
  for (const d of divergencias) {
    if (d.informativo) continue;
    const list = updateGroups.get(d.clickupId) || [];
    list.push(d);
    updateGroups.set(d.clickupId, list);
  }
  const updateSqlLines: string[] = [
    "-- audit-abril-2026: UPDATEs para divergências não-informativas (planilha → banco)",
    "-- ATENÇÃO: revisar valores antes de aplicar.",
    "",
  ];
  for (const [cid, diffs] of updateGroups) {
    const sets = diffs.map((d) => {
      const f = COMPARE_FIELDS.find((cf) => cf.col === d.campo)!;
      return `${d.campo} = ${sqlVal(d.planilha, f.type)}`;
    });
    updateSqlLines.push(`-- ${diffs[0].nome}`);
    updateSqlLines.push(`UPDATE cotacoes SET ${sets.join(", ")} WHERE clickup_id = '${cid}';`);
  }
  fs.writeFileSync(`${OUT_DIR}/${PREFIX}-updates.sql`, updateSqlLines.join("\n"));
  console.log(`  [sql] ${OUT_DIR}/${PREFIX}-updates.sql (${updateGroups.size} UPDATEs · ${[...updateGroups.values()].flat().length} campos)`);

  // 6) Resumo MD
  const totalPlanPremio = planRows.reduce((s, r) => s + (r.premioSemIof || 0), 0);
  const totalPlanReceber = planRows.reduce((s, r) => s + (r.aReceber || 0), 0);
  const totalDbPremio = dbRows.reduce((s, r) => s + Number(r.premio_sem_iof || 0), 0);
  const totalDbReceber = dbRows.reduce((s, r) => s + Number(r.a_receber || 0), 0);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const divNonInfo = divergencias.filter((d) => !d.informativo);
  const divByField = new Map<string, number>();
  for (const d of divNonInfo) divByField.set(d.campo, (divByField.get(d.campo) || 0) + 1);

  const md = `# Auditoria Abril/2026 — Planilhas × Banco MySQL

**Data:** ${TS}
**Fonte:** Planilhas enviadas pelo cliente (BENEFÍCIOS + RAMOS ELEMENTAR)
**Filtro banco:** \`mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL\`

## Totais

| Métrica | Planilhas | Banco | Diferença |
|---------|-----------|-------|-----------|
| Cotações | ${planRows.length} | ${dbRows.length} | ${dbRows.length - planRows.length} |
| Prêmio s/IOF | ${fmt(totalPlanPremio)} | ${fmt(totalDbPremio)} | ${fmt(totalDbPremio - totalPlanPremio)} |
| A Receber | ${fmt(totalPlanReceber)} | ${fmt(totalDbReceber)} | ${fmt(totalDbReceber - totalPlanReceber)} |

## Cruzamento por \`clickup_id\`

| Categoria | Quantidade | Arquivo |
|-----------|-----------|---------|
| Ausentes no banco (planilha tem, banco não) | **${ausentes.length}** | \`${PREFIX}-ausentes-no-banco.csv\` |
| Extras no banco (banco tem, planilha não) | **${extras.length}** | \`${PREFIX}-extras-no-banco.csv\` |
| Divergências em campos | **${divergencias.length}** total / ${divNonInfo.length} não-informativas | \`${PREFIX}-divergencias.csv\` |

## Divergências por campo (não-informativas)

| Campo | Qtd |
|-------|-----|
${[...divByField.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n")}

## Próximos passos

1. **Revisar** \`${PREFIX}-ausentes-no-banco.csv\` — decidir quais inserir
2. **Revisar** \`${PREFIX}-extras-no-banco.csv\` — confirmar se devem permanecer ou ser removidos
3. **Revisar** \`${PREFIX}-divergencias.csv\` — validar lado correto (planilha vs banco)
4. **Aplicar** \`${PREFIX}-inserts.sql\` para criar ausentes (assignee_id ficará NULL)
5. **Aplicar** \`${PREFIX}-updates.sql\` para sincronizar divergências não-informativas
`;
  fs.writeFileSync(`${OUT_DIR}/${PREFIX}-resumo.md`, md);
  console.log(`  [md]  ${OUT_DIR}/${PREFIX}-resumo.md`);

  console.log("\n========== RESUMO ==========");
  console.log(`Planilhas: ${planRows.length} | Banco: ${dbRows.length}`);
  console.log(`Ausentes (planilha→banco): ${ausentes.length}`);
  console.log(`Extras (banco→planilha):    ${extras.length}`);
  console.log(`Divergências total:         ${divergencias.length} (${divNonInfo.length} não-informativas)`);
  console.log(`Prêmio s/IOF — plan: ${fmt(totalPlanPremio)} | banco: ${fmt(totalDbPremio)}`);
  console.log(`A Receber    — plan: ${fmt(totalPlanReceber)} | banco: ${fmt(totalDbReceber)}`);
  console.log("============================");
  process.exit(0);
})().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
