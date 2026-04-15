/**
 * Seed: Popula a tabela situacao_config com as situações iniciais.
 * Uso: npx tsx scripts/seed-situacao-config.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { situacaoConfig } from "../src/lib/schema";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn);

const SITUACOES = [
  { nome: "IMPLANTAÇÃO", orderIndex: 0 },
  { nome: "COTAR",       orderIndex: 1 },
  { nome: "CLIENTE",     orderIndex: 2 },
  { nome: "RAUT",        orderIndex: 3 },
  { nome: "FECHADO",     orderIndex: 4 },
  { nome: "PERDA/RESGATE", orderIndex: 5 },
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  console.log("Seeding situacao_config...");

  for (const s of SITUACOES) {
    await db
      .insert(situacaoConfig)
      .values({ ...s, isActive: true })
      .onConflictDoUpdate({
        target: situacaoConfig.nome,
        set: { orderIndex: s.orderIndex, isActive: true },
      });
    console.log(`  ✓ ${s.nome}`);
  }

  console.log(`\nDone! ${SITUACOES.length} situações seeded.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
