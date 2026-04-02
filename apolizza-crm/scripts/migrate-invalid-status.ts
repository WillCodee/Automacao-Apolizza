/**
 * Migrar cotações com status inválidos para status válidos do ClickUp
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn);

// Mapeamento de status antigos para novos
const STATUS_MIGRATION: Record<string, string> = {
  "em andamento": "raut",
  "aprovado": "implantando",
  "em analise": "raut",
  "aguardando": "pendencia",
  "venda parada": "pendencia",
  "cancelado": "perda",
  "nao iniciado": "não iniciado", // corrigir acento
};

async function main() {
  console.log("═".repeat(70));
  console.log("  MIGRAÇÃO DE STATUS INVÁLIDOS");
  console.log("═".repeat(70));

  for (const [oldStatus, newStatus] of Object.entries(STATUS_MIGRATION)) {
    console.log(`\n🔄 Migrando "${oldStatus}" → "${newStatus}"`);

    const result = await db.execute(sql`
      UPDATE cotacoes
      SET status = ${newStatus}, updated_at = now()
      WHERE status = ${oldStatus}
        AND deleted_at IS NULL
      RETURNING id, name
    `);

    if (result.rows.length > 0) {
      console.log(`   ✓ ${result.rows.length} cotação(ões) atualizadas:`);
      result.rows.forEach((row: any) => {
        console.log(`     - ${row.name.substring(0, 60)}`);
      });
    } else {
      console.log(`   ○ Nenhuma cotação encontrada`);
    }
  }

  // Verificar se ainda há status inválidos
  console.log("\n\n📊 Verificação final:\n");
  const invalid = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND status NOT IN (
        SELECT status_name FROM status_config
      )
    GROUP BY status
  `);

  if (invalid.rows.length === 0) {
    console.log("   ✅ SUCESSO! Todos os status estão válidos!");
  } else {
    console.log("   ⚠️  Ainda existem status inválidos:");
    invalid.rows.forEach((row: any) => {
      console.log(`     - ${row.count} cotações com status "${row.status}"`);
    });
  }

  console.log("\n" + "═".repeat(70));
}

main().catch(console.error);
