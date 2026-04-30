import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

async function main() {
  // Status 'perda' vs situacao 'perda/resgate' — são campos diferentes
  const cross = await db.execute(sql`
    SELECT
      status,
      LOWER(situacao) as situacao,
      COUNT(*)::int as total,
      SUM(a_receber::numeric)::float as soma_a_receber,
      SUM(valor_perda::numeric)::float as soma_valor_perda
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND (status = 'perda' OR LOWER(situacao) IN ('perda','perda/resgate'))
    GROUP BY status, LOWER(situacao)
    ORDER BY total DESC
  `);
  console.log("=== Cruzamento status=perda vs situacao=perda/resgate ===");
  console.log(JSON.stringify(cross.rows, null, 2));

  // Cotações com status='perda' mas situacao diferente de perda/resgate
  const statusPerdaSemSituacao = await db.execute(sql`
    SELECT COUNT(*)::int as total,
      SUM(a_receber::numeric)::float as soma_a_receber,
      SUM(valor_perda::numeric)::float as soma_valor_perda
    FROM cotacoes
    WHERE deleted_at IS NULL AND status = 'perda'
      AND (LOWER(situacao) NOT IN ('perda','perda/resgate') OR situacao IS NULL)
  `);
  console.log("\n=== Status=perda MAS situacao != perda/resgate (não capturadas nas views) ===");
  console.log(JSON.stringify(statusPerdaSemSituacao.rows[0], null, 2));

  // Totais combinados para dar visão real
  const real = await db.execute(sql`
    SELECT
      COUNT(*)::int as total_perdas,
      SUM(a_receber::numeric)::float as soma_a_receber_perdas,
      SUM(valor_perda::numeric)::float as soma_valor_perda_perdas
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND (status = 'perda' OR LOWER(situacao) IN ('perda','perda/resgate'))
  `);
  console.log("\n=== Total REAL de perdas (status=perda OR situacao=perda/resgate) ===");
  console.log(JSON.stringify(real.rows[0], null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
