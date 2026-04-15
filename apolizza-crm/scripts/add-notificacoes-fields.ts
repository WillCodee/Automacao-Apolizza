/**
 * Migration: adiciona destinatario_id e lida à tabela cotacao_notificacoes
 * Uso: npx tsx scripts/add-notificacoes-fields.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Adicionando colunas destinatario_id e lida em cotacao_notificacoes...");

  await sql`
    ALTER TABLE cotacao_notificacoes
    ADD COLUMN IF NOT EXISTS destinatario_id uuid REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS lida boolean NOT NULL DEFAULT false
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS cotacao_notif_dest_idx ON cotacao_notificacoes (destinatario_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS cotacao_notif_lida_idx ON cotacao_notificacoes (lida)
  `;

  console.log("Migração concluída com sucesso.");
}

main().catch((e) => { console.error(e); process.exit(1); });
