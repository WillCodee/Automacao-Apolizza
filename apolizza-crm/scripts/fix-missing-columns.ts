import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run(stmt: string) {
  await sql.query(stmt);
}

async function main() {
  console.log("Verificando e adicionando colunas faltantes...");

  const alterations = [
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS valor_parcelado DECIMAL(12,2)`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS premio_sem_iof DECIMAL(12,2)`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS a_receber DECIMAL(12,2)`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS valor_perda DECIMAL(12,2)`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS comissao_parcelada JSONB`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS is_renovacao BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  ];

  for (const stmt of alterations) {
    try {
      await run(stmt);
      console.log(`✓ ${stmt.substring(0, 70)}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`⚠ Erro: ${msg}`);
    }
  }

  console.log("\nConcluído!");
}

main().catch(console.error);
