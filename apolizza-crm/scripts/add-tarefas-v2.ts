import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Aplicando migrações tarefas v2...");

  // Adicionar colunas de timestamps na tabela tarefas
  await sql`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS visualizada_em TIMESTAMPTZ`;
  await sql`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS iniciada_em TIMESTAMPTZ`;
  await sql`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ`;
  console.log("✓ Colunas visualizada_em, iniciada_em, concluida_em adicionadas à tarefas");

  // Criar tabela de checklist
  await sql`
    CREATE TABLE IF NOT EXISTS tarefas_checklist (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tarefa_id UUID NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
      texto VARCHAR(500) NOT NULL,
      concluido BOOLEAN NOT NULL DEFAULT false,
      concluido_por UUID REFERENCES users(id),
      concluido_em TIMESTAMPTZ,
      ordem INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS tarefas_checklist_tarefa_idx ON tarefas_checklist(tarefa_id)`;
  await sql`CREATE INDEX IF NOT EXISTS tarefas_checklist_ordem_idx ON tarefas_checklist(tarefa_id, ordem)`;
  console.log("✓ Tabela tarefas_checklist criada");

  console.log("✅ Migração concluída!");
}

main().catch((e) => { console.error(e); process.exit(1); });
