/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as fs from "fs";
import mysql from "mysql2/promise";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((ln) => {
    const cells = parseLine(ln);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = cells[i] ?? ""; });
    return o;
  });
}
function parseLine(ln: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < ln.length; i++) {
    const ch = ln[i];
    if (inQ) {
      if (ch === '"' && ln[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

(async () => {
  // Fontes
  const auditFull = JSON.parse(fs.readFileSync("data/audit-report-2026-04-30.json", "utf-8"));
  const planDiv = parseCsv(fs.readFileSync("data/audit-abril-2026-planilha-2026-04-30-divergencias.csv", "utf-8"));

  // Status ClickUp por id (do audit FULL) — keys do JSON: clickupId, nome, campo, clickup, mysql
  const clickupById = new Map<string, any>();
  for (const d of auditFull.divergencias as any[]) {
    if (!clickupById.has(d.clickupId)) clickupById.set(d.clickupId, { name: d.nome, fields: {} });
    clickupById.get(d.clickupId).fields[d.campo] = { clickup: d.clickup, mysql: d.mysql };
  }

  // Banco
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não setado");
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, decimalNumbers: true });

  // Bucket A: 5 ABR/2026 com status divergente entre planilha e banco
  const abrSt = planDiv.filter((d) => d.campo === "status" && d.informativo === "nao");
  const bucketA = abrSt.slice(0, 5);

  // Bucket B: 5 atrasados de OUTROS meses com divergência de status (ClickUp tem status real)
  const stDivAll: any[] = [];
  for (const [cid, info] of clickupById.entries()) {
    if (info.fields.status && info.fields.status.mysql === "atrasado") {
      stDivAll.push({ clickupId: cid, name: info.name, clickup: info.fields.status.clickup, mysql: info.fields.status.mysql });
    }
  }
  // Filtrar fora dos ABR/2026 já no bucket A
  const abrIds = new Set(bucketA.map((x) => x.clickup_id));
  const bucketB = stDivAll.filter((x) => !abrIds.has(x.clickupId)).slice(0, 5);

  // Bucket C: 5 com outras divergências (não-status, não-name)
  const otherDiv: any[] = [];
  for (const [cid, info] of clickupById.entries()) {
    for (const [field, vals] of Object.entries(info.fields) as [string, any][]) {
      if (field === "status" || field === "name") continue;
      otherDiv.push({ clickupId: cid, name: info.name, field, clickup: vals.clickup, mysql: vals.mysql });
      break;
    }
  }
  const bucketC = otherDiv.slice(0, 5);

  // Buscar dados completos do banco para cada amostra
  const allIds = [
    ...bucketA.map((x) => x.clickup_id),
    ...bucketB.map((x) => x.clickupId),
    ...bucketC.map((x) => x.clickupId),
  ].filter(Boolean);

  if (allIds.length === 0) {
    console.error("Nenhuma amostra gerada");
    process.exit(1);
  }

  const placeholders = allIds.map(() => "?").join(",");
  const [dbRowsRaw] = await conn.query(
    `SELECT id, clickup_id, name, status, mes_referencia, ano_referencia, due_date, premio_sem_iof, a_receber FROM cotacoes WHERE clickup_id IN (${placeholders})`,
    allIds,
  );
  const dbRows = dbRowsRaw as any[];
  const dbById = new Map(dbRows.map((r) => [r.clickup_id, r]));

  // Compor CSV
  const headers = [
    "bucket", "clickup_id", "nome",
    "campo_critico", "status_planilha", "status_clickup", "status_banco",
    "mes_ano_banco", "due_date_banco",
    "link_clickup",
    "decisao_supervisor (status_correto)", "observacoes_supervisor",
  ];
  const rows: string[][] = [];

  for (const r of bucketA) {
    const cid = r.clickup_id;
    const db = dbById.get(cid) || {};
    const cu = clickupById.get(cid);
    rows.push([
      "A_ABR2026_planilha",
      cid,
      r.name || db.name || "",
      "status",
      r.planilha || "",
      cu?.fields?.status?.clickup || "",
      db.status || r.banco || "",
      `${db.mes_referencia || ""}/${db.ano_referencia || ""}`,
      db.due_date ? new Date(db.due_date).toISOString().slice(0, 10) : "",
      `https://app.clickup.com/t/${cid}`,
      "", "",
    ]);
  }
  for (const r of bucketB) {
    const cid = r.clickupId;
    const db = dbById.get(cid) || {};
    rows.push([
      "B_atrasado_outros_meses",
      cid,
      r.name || db.name || "",
      "status",
      "(sem planilha)",
      r.clickup || "",
      db.status || r.mysql || "",
      `${db.mes_referencia || ""}/${db.ano_referencia || ""}`,
      db.due_date ? new Date(db.due_date).toISOString().slice(0, 10) : "",
      `https://app.clickup.com/t/${cid}`,
      "", "",
    ]);
  }
  for (const r of bucketC) {
    const cid = r.clickupId;
    const db = dbById.get(cid) || {};
    rows.push([
      `C_outro_campo_${r.field}`,
      cid,
      r.name || db.name || "",
      r.field,
      "(sem planilha)",
      String(r.clickup || ""),
      String(r.mysql || ""),
      `${db.mes_referencia || ""}/${db.ano_referencia || ""}`,
      db.due_date ? new Date(db.due_date).toISOString().slice(0, 10) : "",
      `https://app.clickup.com/t/${cid}`,
      "", "",
    ]);
  }

  const csv = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const out = "data/validacao-supervisor-2026-04-30.csv";
  fs.writeFileSync(out, csv);
  console.log(`✅ ${rows.length} amostras geradas em ${out}`);
  console.log(`\nDistribuição:`);
  console.log(`  A (ABR/2026 planilha):       ${bucketA.length}`);
  console.log(`  B (atrasado outros meses):   ${bucketB.length}`);
  console.log(`  C (outros campos):           ${bucketC.length}`);

  await conn.end();
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e); process.exit(1); });
