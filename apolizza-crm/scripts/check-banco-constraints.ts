import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function checkConstraints() {
  console.log("Verificando constraints e índices na tabela cotacoes...\n");
  
  // Verificar índices únicos
  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'cotacoes'
    AND indexdef LIKE '%UNIQUE%'
  `;

  console.log("Índices UNIQUE:");
  indexes.forEach(idx => {
    console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
  });

  // Verificar constraints
  const constraints = await sql`
    SELECT conname, contype, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'cotacoes'::regclass
  `;

  console.log("\nConstraints:");
  constraints.forEach(con => {
    console.log(`  - ${con.conname} (${con.contype}): ${con.definition}`);
  });

  // Contar cotações no banco
  const count = await sql`SELECT COUNT(*) as total FROM cotacoes`;
  console.log(`\nTotal de cotações no banco: ${count[0].total}`);
}

checkConstraints().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
