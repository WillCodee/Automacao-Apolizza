import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Create atividade_tipo enum
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'atividade_tipo') THEN
      CREATE TYPE "atividade_tipo" AS ENUM('CRIADA', 'EDITADA', 'STATUS_ALTERADO', 'BRIEFING_ADICIONADO', 'ANEXO_ADICIONADO', 'ANEXO_REMOVIDO');
    END IF;
  END $$`;
  console.log("✓ enum atividade_tipo");

  await sql`CREATE TABLE IF NOT EXISTS "situacao_config" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "nome" varchar(100) NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  console.log("✓ situacao_config");

  await sql`CREATE TABLE IF NOT EXISTS "tarefas_atividades" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tarefa_id" uuid NOT NULL,
    "usuario_id" uuid NOT NULL,
    "tipo_acao" "atividade_tipo" NOT NULL,
    "detalhes" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  console.log("✓ tarefas_atividades");

  await sql`CREATE TABLE IF NOT EXISTS "tarefas_checklist" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tarefa_id" uuid NOT NULL,
    "texto" varchar(500) NOT NULL,
    "concluido" boolean DEFAULT false NOT NULL,
    "concluido_por" uuid,
    "concluido_em" timestamp with time zone,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  console.log("✓ tarefas_checklist");

  await sql`CREATE TABLE IF NOT EXISTS "tarefas_anexos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tarefa_id" uuid NOT NULL,
    "usuario_id" uuid NOT NULL,
    "nome_arquivo" varchar(255) NOT NULL,
    "url_blob" text NOT NULL,
    "tamanho" integer NOT NULL,
    "mime_type" varchar(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  console.log("✓ tarefas_anexos");

  await sql`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "visualizada_em" timestamp with time zone`;
  await sql`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "iniciada_em" timestamp with time zone`;
  await sql`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "concluida_em" timestamp with time zone`;
  console.log("✓ tarefas columns (visualizada_em, iniciada_em, concluida_em)");

  // Foreign keys
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_atividades_tarefa_id_tarefas_id_fk') THEN
      ALTER TABLE "tarefas_atividades" ADD CONSTRAINT "tarefas_atividades_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE;
    END IF;
  END $$`;

  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_atividades_usuario_id_users_id_fk') THEN
      ALTER TABLE "tarefas_atividades" ADD CONSTRAINT "tarefas_atividades_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "users"("id");
    END IF;
  END $$`;

  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_checklist_tarefa_id_tarefas_id_fk') THEN
      ALTER TABLE "tarefas_checklist" ADD CONSTRAINT "tarefas_checklist_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE;
    END IF;
  END $$`;

  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_checklist_concluido_por_users_id_fk') THEN
      ALTER TABLE "tarefas_checklist" ADD CONSTRAINT "tarefas_checklist_concluido_por_users_id_fk" FOREIGN KEY ("concluido_por") REFERENCES "users"("id");
    END IF;
  END $$`;

  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_anexos_tarefa_id_tarefas_id_fk') THEN
      ALTER TABLE "tarefas_anexos" ADD CONSTRAINT "tarefas_anexos_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE;
    END IF;
  END $$`;

  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_anexos_usuario_id_users_id_fk') THEN
      ALTER TABLE "tarefas_anexos" ADD CONSTRAINT "tarefas_anexos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "users"("id");
    END IF;
  END $$`;
  console.log("✓ foreign keys");

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS "tarefas_atividades_tarefa_idx" ON "tarefas_atividades" ("tarefa_id","created_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "tarefas_atividades_usuario_idx" ON "tarefas_atividades" ("usuario_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "tarefas_checklist_tarefa_idx" ON "tarefas_checklist" ("tarefa_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "tarefas_checklist_ordem_idx" ON "tarefas_checklist" ("tarefa_id","ordem")`;
  await sql`CREATE INDEX IF NOT EXISTS "tarefas_anexos_tarefa_idx" ON "tarefas_anexos" ("tarefa_id")`;
  console.log("✓ indexes");

  console.log("\nMigração concluída com sucesso!");
}

main().catch(console.error);
