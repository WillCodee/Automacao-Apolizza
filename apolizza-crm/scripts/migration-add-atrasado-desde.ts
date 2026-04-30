/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import mysql from "mysql2/promise";

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não setado");
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  console.log("→ Verificando se coluna atrasado_desde já existe...");
  const [colsRaw] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotacoes' AND COLUMN_NAME = 'atrasado_desde'`,
  );
  const cols = colsRaw as any[];
  if (cols.length > 0) {
    console.log("✓ Coluna atrasado_desde já existe — nada a fazer.");
    await conn.end();
    process.exit(0);
  }

  console.log("→ Aplicando ALTER TABLE...");
  await conn.query(`ALTER TABLE cotacoes ADD COLUMN atrasado_desde DATE NULL DEFAULT NULL`);
  console.log("✓ Coluna atrasado_desde DATE NULL adicionada");

  console.log("→ Verificando se índice já existe...");
  const [idxRaw] = await conn.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotacoes' AND INDEX_NAME = 'idx_atrasado_desde'`,
  );
  const idx = idxRaw as any[];
  if (idx.length === 0) {
    console.log("→ Criando índice idx_atrasado_desde...");
    await conn.query(`CREATE INDEX idx_atrasado_desde ON cotacoes (atrasado_desde)`);
    console.log("✓ Índice criado");
  } else {
    console.log("✓ Índice já existe");
  }

  console.log("\n→ Validando estado pós-migration:");
  const [colCheck] = await conn.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotacoes' AND COLUMN_NAME = 'atrasado_desde'`,
  );
  console.log(JSON.stringify(colCheck, null, 2));

  const [[stats]] = await conn.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN atrasado_desde IS NULL THEN 1 ELSE 0 END) as null_count,
      SUM(CASE WHEN atrasado_desde IS NOT NULL THEN 1 ELSE 0 END) as not_null_count
    FROM cotacoes
  `) as any;
  console.log("Stats:", stats);

  await conn.end();
  console.log("\n✅ Migration aplicada com sucesso. Coluna pronta para backfill.");
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e); process.exit(1); });
