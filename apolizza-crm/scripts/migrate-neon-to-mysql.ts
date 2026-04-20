/**
 * Migracao de Dados: Neon PostgreSQL → MySQL HostGator
 *
 * Uso: npx tsx scripts/migrate-neon-to-mysql.ts
 *
 * Estrategia: buscar TUDO do Neon primeiro (rapido), fechar conexao, depois inserir no MySQL.
 * Isso evita timeout do Neon free tier que mata conexoes longas.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
import mysql from "mysql2/promise";

// ============================================================
// CONFIG
// ============================================================

const NEON_URL = process.env.DATABASE_URL_NEON;
const MYSQL_URL = process.env.DATABASE_URL;

if (!NEON_URL) {
  console.error("❌ DATABASE_URL_NEON nao configurado no .env.local");
  process.exit(1);
}
if (!MYSQL_URL) {
  console.error("❌ DATABASE_URL nao configurado no .env.local");
  process.exit(1);
}

const BATCH_SIZE = 50;

// Ordem de migracao respeitando FKs
const TABLES_ORDER = [
  "users",
  "status_config",
  "situacao_config",
  "regras_auditoria",
  "grupos_usuarios",
  "cotacoes",
  "metas",
  "comissao_tabela",
  "grupo_membros",
  "chat_mensagens",
  "cotacao_docs",
  "cotacao_history",
  "cotacao_notificacoes",
  "cotacao_mensagens",
  "tarefas",
  "chat_leituras",
  "tarefas_briefings",
  "tarefas_anexos",
  "tarefas_atividades",
  "tarefas_checklist",
];

const BOOLEAN_COLUMNS: Record<string, string[]> = {
  users: ["is_active"],
  cotacoes: ["is_renovacao"],
  status_config: ["is_terminal"],
  situacao_config: ["is_active"],
  cotacao_notificacoes: ["lida"],
  tarefas_checklist: ["concluido"],
  regras_auditoria: ["ativo"],
};

const JSON_COLUMNS: Record<string, string[]> = {
  cotacoes: ["comissao_parcelada", "tags"],
  status_config: ["required_fields"],
  tarefas_atividades: ["detalhes"],
};

// ============================================================
// HELPERS
// ============================================================

function formatValue(val: unknown, colName: string, tableName: string): unknown {
  if (val === null || val === undefined) return null;

  if (BOOLEAN_COLUMNS[tableName]?.includes(colName)) {
    return val ? 1 : 0;
  }

  if (JSON_COLUMNS[tableName]?.includes(colName)) {
    if (typeof val === "object") return JSON.stringify(val);
    return typeof val === "string" ? val : JSON.stringify(val);
  }

  if (val instanceof Date) {
    return val.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
  }

  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    return val.replace("T", " ").replace("Z", "").slice(0, 19);
  }

  return val;
}

function escapeColumns(columns: string[]): string {
  return columns.map((c) => `\`${c}\``).join(", ");
}

function placeholders(count: number): string {
  return Array(count).fill("?").join(", ");
}

async function getMySQLColumns(conn: mysql.Connection, tableName: string): Promise<Set<string>> {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set((rows as any[]).map((r) => r.COLUMN_NAME));
}

// ============================================================
// PHASE 1: EXPORT FROM NEON
// ============================================================

async function exportFromNeon(): Promise<Map<string, { rows: Record<string, unknown>[]; count: number }>> {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  FASE 1: EXPORTAR DADOS DO NEON (PostgreSQL)      ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  const pgClient = new pg.Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
  });
  await pgClient.connect();
  console.log("🔌 Neon conectado\n");

  const data = new Map<string, { rows: Record<string, unknown>[]; count: number }>();

  for (const tableName of TABLES_ORDER) {
    try {
      const result = await pgClient.query(`SELECT * FROM "${tableName}"`);
      data.set(tableName, { rows: result.rows, count: result.rows.length });
      console.log(`   📤 ${tableName}: ${result.rows.length} registros`);
    } catch (err: any) {
      console.error(`   ❌ ${tableName}: ${err.message}`);
      data.set(tableName, { rows: [], count: 0 });
    }
  }

  await pgClient.end();
  console.log("\n🔌 Neon desconectado (dados em memoria)\n");

  const totalRows = Array.from(data.values()).reduce((sum, d) => sum + d.count, 0);
  console.log(`📊 Total exportado: ${totalRows} registros em ${data.size} tabelas\n`);

  return data;
}

// ============================================================
// PHASE 2: IMPORT TO MYSQL
// ============================================================

async function importToMySQL(data: Map<string, { rows: Record<string, unknown>[]; count: number }>) {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  FASE 2: IMPORTAR PARA MYSQL (HostGator)          ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  const mysqlConn = await mysql.createConnection({
    uri: MYSQL_URL!,
    connectTimeout: 30000,
  });
  console.log("🔌 MySQL conectado");

  await mysqlConn.execute("SET FOREIGN_KEY_CHECKS = 0");
  await mysqlConn.execute("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'");
  console.log("🔓 FK checks desabilitados\n");

  const report: { table: string; pgCount: number; inserted: number; errors: number; duration: number }[] = [];
  let totalInserted = 0;
  let totalErrors = 0;

  for (const tableName of TABLES_ORDER) {
    const start = Date.now();
    const tableData = data.get(tableName);

    if (!tableData || tableData.count === 0) {
      console.log(`━━━ ${tableName}: vazia, pulando`);
      report.push({ table: tableName, pgCount: 0, inserted: 0, errors: 0, duration: 0 });
      continue;
    }

    console.log(`━━━ ${tableName} (${tableData.count} registros) ━━━`);

    try {
      // Limpar tabela no MySQL
      await mysqlConn.execute(`DELETE FROM \`${tableName}\``);

      // Colunas do MySQL
      const mysqlCols = await getMySQLColumns(mysqlConn, tableName);

      // Filtrar colunas
      const allPgCols = Object.keys(tableData.rows[0]);
      const columns = allPgCols.filter((c) => mysqlCols.has(c));
      const skipped = allPgCols.filter((c) => !mysqlCols.has(c));
      if (skipped.length > 0) {
        console.log(`   ⚠️  Colunas ignoradas: ${skipped.join(", ")}`);
      }

      const insertSQL = `INSERT INTO \`${tableName}\` (${escapeColumns(columns)}) VALUES (${placeholders(columns.length)})`;

      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < tableData.rows.length; i += BATCH_SIZE) {
        const batch = tableData.rows.slice(i, i + BATCH_SIZE);

        for (const row of batch) {
          try {
            const values = columns.map((col) => formatValue(row[col], col, tableName));
            await mysqlConn.execute(insertSQL, values);
            inserted++;
          } catch (err: any) {
            errors++;
            if (errors <= 3) {
              console.error(`   ❌ Erro row ${inserted + errors}: ${err.message?.slice(0, 150)}`);
            }
          }
        }

        const pct = Math.round(((i + batch.length) / tableData.count) * 100);
        process.stdout.write(`\r   📥 ${pct}% (${inserted}/${tableData.count})`);
      }

      console.log(); // newline

      totalInserted += inserted;
      totalErrors += errors;
      const duration = Date.now() - start;
      console.log(`   ${errors === 0 ? "✅" : "⚠️"} ${inserted} inseridos, ${errors} erros (${(duration / 1000).toFixed(1)}s)`);

      report.push({ table: tableName, pgCount: tableData.count, inserted, errors, duration });
    } catch (err: any) {
      console.error(`   ❌ ERRO: ${err.message}`);
      report.push({ table: tableName, pgCount: tableData.count, inserted: 0, errors: 1, duration: Date.now() - start });
      totalErrors++;
    }
  }

  await mysqlConn.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("\n🔒 FK checks reabilitados");

  // ============================================================
  // VERIFICACAO
  // ============================================================

  console.log("\n📋 Verificacao pos-migracao:");
  for (const tableName of TABLES_ORDER) {
    const [rows] = await mysqlConn.execute(`SELECT COUNT(*) as c FROM \`${tableName}\``);
    const mysqlCount = (rows as any)[0].c;
    const pgCount = data.get(tableName)?.count ?? 0;
    const match = Number(mysqlCount) === pgCount ? "✅" : "❌";
    console.log(`   ${match} ${tableName}: MySQL=${mysqlCount} PG=${pgCount}`);
  }

  // ============================================================
  // RELATORIO
  // ============================================================

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║               RELATORIO DA MIGRACAO               ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("Tabela                    | PG     | MySQL  | Erros | Tempo");
  console.log("─".repeat(70));
  for (const r of report) {
    const name = r.table.padEnd(25);
    const pgC = String(r.pgCount).padStart(6);
    const myC = String(r.inserted).padStart(6);
    const er = String(r.errors).padStart(5);
    const tm = `${(r.duration / 1000).toFixed(1)}s`.padStart(7);
    console.log(`${name} | ${pgC} | ${myC} | ${er} | ${tm}`);
  }
  console.log("─".repeat(70));
  console.log(`TOTAL: ${totalInserted} registros migrados, ${totalErrors} erros`);

  // Salvar relatorio
  const fs = await import("fs");
  fs.mkdirSync("data", { recursive: true });
  const reportPath = `data/migration-neon-mysql-${new Date().toISOString().split("T")[0]}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    date: new Date().toISOString(),
    report,
    totalInserted,
    totalErrors,
  }, null, 2));
  console.log(`\n💾 Relatorio: ${reportPath}`);

  await mysqlConn.end();

  console.log("\n🏁 Migracao concluida!");
  if (totalErrors > 0) {
    console.log(`⚠️  ${totalErrors} erros. Revise o relatorio.`);
    process.exit(1);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const data = await exportFromNeon();
  await importToMySQL(data);
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
