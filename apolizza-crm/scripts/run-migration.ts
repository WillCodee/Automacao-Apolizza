import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  console.log("Aplicando migration: ALTER comissao TO text...");
  
  await sql`ALTER TABLE cotacoes ALTER COLUMN comissao TYPE text`;
  
  console.log("✓ Migration aplicada com sucesso!");
}

runMigration().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
