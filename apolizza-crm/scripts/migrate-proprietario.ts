import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Aplicando migração: proprietario role + cotacao_notificacoes...");

  // 1. Adiciona 'proprietario' ao enum user_role (se ainda não existir)
  try {
    await db.execute(sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'proprietario'`);
    console.log("  ✓ Enum user_role: 'proprietario' adicionado");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      console.log("  ✓ Enum user_role: 'proprietario' já existia");
    } else {
      throw e;
    }
  }

  // 2. Cria tabela cotacao_notificacoes (se não existir)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cotacao_notificacoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cotacao_id UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
      cotacao_nome VARCHAR(500) NOT NULL,
      autor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      autor_nome VARCHAR(255),
      tipo VARCHAR(20) NOT NULL,
      texto TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ Tabela cotacao_notificacoes criada (ou já existia)");

  // 3. Cria índices
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cotacao_notif_cotacao_idx ON cotacao_notificacoes(cotacao_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cotacao_notif_created_idx ON cotacao_notificacoes(created_at)
  `);
  console.log("  ✓ Índices criados");

  console.log("\n✅ Migração concluída!");
}

migrate().catch(console.error).finally(() => process.exit(0));
