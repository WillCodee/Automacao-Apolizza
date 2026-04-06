import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // 1. Adiciona default_cotador_id em situacao_config
  await sql`ALTER TABLE situacao_config ADD COLUMN IF NOT EXISTS default_cotador_id uuid REFERENCES users(id) ON DELETE SET NULL`;
  console.log("✓ situacao_config.default_cotador_id");

  // 2. Adiciona situacao em tarefas
  await sql`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS situacao varchar(100)`;
  console.log("✓ tarefas.situacao");

  // 3. Vincula COMCLIENTE ao usuário GESTAO
  const gestao = await sql`SELECT id FROM users WHERE username = 'GESTAO' AND is_active = true LIMIT 1`;
  if (gestao.length === 0) {
    console.error("✗ Usuário GESTAO não encontrado");
    return;
  }
  const gestaoId = gestao[0].id;
  console.log(`✓ Usuário GESTAO encontrado: ${gestaoId}`);

  const updated = await sql`
    UPDATE situacao_config
    SET default_cotador_id = ${gestaoId}
    WHERE nome = 'COMCLIENTE'
    RETURNING id, nome, default_cotador_id
  `;
  if (updated.length > 0) {
    console.log(`✓ COMCLIENTE vinculado a GESTAO:`, updated[0]);
  } else {
    console.warn("⚠ Situação COMCLIENTE não encontrada");
  }

  console.log("\nMigração concluída!");
}

main().catch(console.error);
