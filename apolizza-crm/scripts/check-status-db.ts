/**
 * Verificar status no banco
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn);

async function main() {
  console.log("═".repeat(70));
  console.log("  VERIFICAÇÃO DE STATUS NO BANCO");
  console.log("═".repeat(70));

  // 1. Status config
  console.log("\n📋 STATUS CONFIG:\n");
  const configs = await db.execute(sql`
    SELECT status_name, display_label, color, order_index
    FROM status_config
    ORDER BY order_index
  `);

  configs.rows.forEach((row: any) => {
    console.log(`  ${row.order_index}. ${row.display_label.padEnd(25)} | ${row.status_name.padEnd(20)} | ${row.color}`);
  });

  // 2. Status nas cotações
  console.log("\n\n📊 STATUS NAS COTAÇÕES:\n");
  const statusCount = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY status
    ORDER BY count DESC
  `);

  statusCount.rows.forEach((row: any) => {
    console.log(`  ${row.count.toString().padStart(3)} cotações - ${row.status}`);
  });

  // 3. Cotações com status inválido
  console.log("\n\n⚠️  STATUS INVÁLIDOS (não estão em status_config):\n");
  const invalid = await db.execute(sql`
    SELECT c.id, c.name, c.status
    FROM cotacoes c
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN (
        SELECT status_name FROM status_config
      )
    LIMIT 10
  `);

  if (invalid.rows.length === 0) {
    console.log("  ✓ Nenhum status inválido encontrado!");
  } else {
    invalid.rows.forEach((row: any) => {
      console.log(`  - [${row.id.substring(0, 8)}] ${row.name.substring(0, 50)} - status: "${row.status}"`);
    });
  }

  console.log("\n" + "═".repeat(70));
}

main().catch(console.error);
