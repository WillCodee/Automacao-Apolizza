import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function verify() {
  const total = await sql`SELECT COUNT(*) as total FROM cotacoes WHERE clickup_id IS NOT NULL`;
  const byStatus = await sql`SELECT status, COUNT(*) as cnt FROM cotacoes WHERE clickup_id IS NOT NULL GROUP BY status ORDER BY cnt DESC`;
  const financials = await sql`SELECT SUM(a_receber::numeric) as a_receber, SUM(valor_perda::numeric) as perda, SUM(premio_sem_iof::numeric) as premio FROM cotacoes WHERE clickup_id IS NOT NULL`;
  const users = await sql`SELECT username, role FROM users ORDER BY username`;
  const sample = await sql`SELECT name, status, tipo_cliente, situacao, a_receber, valor_perda, seguradora, produto FROM cotacoes WHERE clickup_id IS NOT NULL AND a_receber IS NOT NULL LIMIT 5`;

  console.log("\n=== CONTAGEM ===");
  console.log("Total migradas:", total[0].total);

  console.log("\n=== POR STATUS ===");
  for (const r of byStatus) console.log(`  ${r.status}: ${r.cnt}`);

  console.log("\n=== FINANCEIRO ===");
  console.log("  A Receber: R$", parseFloat(financials[0].a_receber || "0").toFixed(2));
  console.log("  Perda:     R$", parseFloat(financials[0].perda || "0").toFixed(2));
  console.log("  Premio:    R$", parseFloat(financials[0].premio || "0").toFixed(2));

  console.log("\n=== USUARIOS ===");
  for (const u of users) console.log(`  ${u.username} (${u.role})`);

  console.log("\n=== AMOSTRA (5 cotacoes com A Receber) ===");
  for (const s of sample) {
    console.log(`  ${(s.name as string).substring(0, 50)}`);
    console.log(`    status=${s.status}, situacao=${s.situacao}, tipo=${s.tipo_cliente}`);
    console.log(`    a_receber=R$${s.a_receber}, seguradora=${s.seguradora}, produto=${s.produto}`);
  }
}

verify().catch(console.error);
