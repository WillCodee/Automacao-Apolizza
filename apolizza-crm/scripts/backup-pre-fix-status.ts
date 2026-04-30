/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as fs from "fs";
import mysql from "mysql2/promise";

const OUT = "backups/pre-fix-status-2026-04-30";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  return lines.join("\n");
}

function toSqlInserts(table: string, rows: any[]): string {
  if (rows.length === 0) return `-- ${table}: 0 rows\n`;
  const headers = Object.keys(rows[0]);
  const escapeVal = (v: any) => {
    if (v == null) return "NULL";
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      const h = String(v.getHours()).padStart(2, "0");
      const mi = String(v.getMinutes()).padStart(2, "0");
      const s = String(v.getSeconds()).padStart(2, "0");
      return `'${y}-${m}-${d} ${h}:${mi}:${s}'`;
    }
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "1" : "0";
    return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  };
  const lines = [`-- ${table}: ${rows.length} rows`];
  // Use multi-row INSERT in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = batch.map((r) => `(${headers.map((h) => escapeVal(r[h])).join(", ")})`).join(",\n  ");
    lines.push(`INSERT INTO ${table} (${headers.join(", ")}) VALUES\n  ${values};`);
  }
  return lines.join("\n");
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não setado");

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, decimalNumbers: true });

  const tables = ["cotacoes", "cotacao_history", "cotacao_notificacoes", "status_config", "users", "metas"];

  for (const t of tables) {
    console.log(`→ Dumping ${t}...`);
    const [rows] = await conn.query(`SELECT * FROM ${t}`);
    const arr = rows as any[];
    fs.writeFileSync(`${OUT}/${t}.json`, JSON.stringify(arr, null, 2));
    fs.writeFileSync(`${OUT}/${t}.csv`, toCsv(arr));
    fs.writeFileSync(`${OUT}/${t}.sql`, toSqlInserts(t, arr));
    console.log(`  ${arr.length} rows → ${t}.json / .csv / .sql`);
  }

  // Snapshot meta
  const [[counts]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM cotacoes) as total_cotacoes,
      (SELECT COUNT(*) FROM cotacoes WHERE deleted_at IS NULL) as ativas,
      (SELECT COUNT(*) FROM cotacoes WHERE status='atrasado' AND deleted_at IS NULL) as atrasadas,
      (SELECT COUNT(*) FROM cotacao_history) as history_total,
      (SELECT COUNT(DISTINCT cotacao_id) FROM cotacao_history) as cotacoes_com_history
  `) as any;

  const meta = {
    timestamp: new Date().toISOString(),
    purpose: "Snapshot pré-mudança status→flag (Caminho A)",
    counts,
    tables_dumped: tables,
  };
  fs.writeFileSync(`${OUT}/META.json`, JSON.stringify(meta, null, 2));
  console.log("\n========== SNAPSHOT ==========");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`\nBackup completo em: ${OUT}/`);

  await conn.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
