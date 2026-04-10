/**
 * Cria a tabela situacao_config e popula com dados iniciais.
 * Uso: npx tsx scripts/create-situacao-config-table.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  console.log("Criando tabela situacao_config...");

  await sql`
    CREATE TABLE IF NOT EXISTS situacao_config (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome        VARCHAR(100) NOT NULL UNIQUE,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ Tabela criada (ou já existia)");

  const situacoes = [
    { nome: "IMPLANTAÇÃO",   order_index: 0 },
    { nome: "COTAR",         order_index: 1 },
    { nome: "CLIENTE",       order_index: 2 },
    { nome: "RAUT",          order_index: 3 },
    { nome: "FECHADO",       order_index: 4 },
    { nome: "PERDA/RESGATE", order_index: 5 },
  ];

  console.log("\nPopulando situações...");
  for (const s of situacoes) {
    await sql`
      INSERT INTO situacao_config (nome, order_index, is_active)
      VALUES (${s.nome}, ${s.order_index}, true)
      ON CONFLICT (nome) DO UPDATE
        SET order_index = EXCLUDED.order_index,
            is_active   = true
    `;
    console.log(`  ✓ ${s.nome}`);
  }

  console.log("\nConcluído!");
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
