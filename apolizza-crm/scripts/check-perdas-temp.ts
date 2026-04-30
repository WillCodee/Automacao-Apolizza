import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

async function main() {
  // Total de cotações com situacao perda/perda/resgate
  const total = await db.execute(sql`
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE valor_perda IS NOT NULL AND valor_perda::numeric > 0)::int as com_valor_perda,
      COUNT(*) FILTER (WHERE valor_perda IS NULL OR valor_perda::numeric = 0)::int as sem_valor_perda,
      SUM(valor_perda::numeric) FILTER (WHERE valor_perda IS NOT NULL)::float as soma_valor_perda,
      SUM(a_receber::numeric) FILTER (WHERE a_receber IS NOT NULL)::float as soma_a_receber
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND LOWER(situacao) IN ('perda','perda/resgate')
  `);
  console.log("=== Cotações com situacao perda/perda resgate ===");
  console.log(JSON.stringify(total.rows[0], null, 2));

  // Amostra de perdas com valores baixos
  const sample = await db.execute(sql`
    SELECT id, name, situacao, valor_perda, a_receber, assignee_id
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND LOWER(situacao) IN ('perda','perda/resgate')
    ORDER BY valor_perda::numeric ASC NULLS FIRST
    LIMIT 10
  `);
  console.log("\n=== Amostra (menores valores_perda) ===");
  console.log(JSON.stringify(sample.rows, null, 2));

  // Situacoes distintas no banco
  const situacoes = await db.execute(sql`
    SELECT LOWER(situacao) as situacao, COUNT(*)::int as total
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY LOWER(situacao)
    ORDER BY total DESC
  `);
  console.log("\n=== Situações distintas ===");
  console.log(JSON.stringify(situacoes.rows, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
