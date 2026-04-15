/**
 * Migration: Add comissao_parcelada column to cotacoes
 * Run: npx tsx scripts/migrate-comissao-parcelada.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Applying migration: comissao_parcelada...");

  await sql`
    ALTER TABLE cotacoes
    ADD COLUMN IF NOT EXISTS comissao_parcelada jsonb
  `;

  console.log("Migration applied successfully.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
