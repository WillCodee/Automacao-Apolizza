import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Criando tabelas de grupos de usuários...");

  try {
    await sql.query(`CREATE TABLE IF NOT EXISTS grupos_usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(100) NOT NULL UNIQUE,
      descricao TEXT,
      cor VARCHAR(7) NOT NULL DEFAULT '#03a4ed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    console.log("✓ Tabela grupos_usuarios criada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`⚠ grupos_usuarios: ${msg}`);
  }

  try {
    await sql.query(`CREATE TABLE IF NOT EXISTS grupo_membros (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grupo_id UUID NOT NULL REFERENCES grupos_usuarios(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(grupo_id, user_id)
    )`);
    console.log("✓ Tabela grupo_membros criada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`⚠ grupo_membros: ${msg}`);
  }

  console.log("\nConcluído!");
}

main().catch(console.error);
