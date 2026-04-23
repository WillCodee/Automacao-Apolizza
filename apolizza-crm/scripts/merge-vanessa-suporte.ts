import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mysql from "mysql2/promise";

const VANESSA_COTADOR_ID = "9c6cfa58-5482-4a7c-8bfe-c807c10bfa9c";
const VANESSA_PROP_ID = "92509c63-114c-4596-b743-91a42c38217c";
const SUPORTE_ID = "c0dfa707-f58c-4a63-bcc3-654f61cc9b74";

async function main() {
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 1 });

  console.log("=== 1. Migrar meta da Vanessa (cotador) → Vanessa Nogueira ===");

  // Verificar se Vanessa Nogueira já tem meta no mesmo período
  const [metasCotador] = await pool.query(
    "SELECT id, ano, mes FROM metas WHERE user_id = ?",
    [VANESSA_COTADOR_ID]
  );
  const metas = metasCotador as any[];

  for (const meta of metas) {
    const [existing] = await pool.query(
      "SELECT id FROM metas WHERE user_id = ? AND ano = ? AND mes = ?",
      [VANESSA_PROP_ID, meta.ano, meta.mes]
    );
    if ((existing as any[]).length > 0) {
      console.log(`  Meta ${meta.ano}/${meta.mes}: Vanessa Nogueira já tem → deletando duplicada`);
      await pool.query("DELETE FROM metas WHERE id = ?", [meta.id]);
    } else {
      console.log(`  Meta ${meta.ano}/${meta.mes}: transferindo para Vanessa Nogueira`);
      await pool.query("UPDATE metas SET user_id = ? WHERE id = ?", [VANESSA_PROP_ID, meta.id]);
    }
  }

  console.log("\n=== 2. Desativar Vanessa (cotador) ===");
  await pool.query(
    "UPDATE users SET is_active = 0 WHERE id = ?",
    [VANESSA_COTADOR_ID]
  );
  console.log("  Vanessa (cotador) desativada");

  console.log("\n=== 3. Suporte → proprietario ===");
  await pool.query(
    "UPDATE users SET role = 'proprietario' WHERE id = ?",
    [SUPORTE_ID]
  );
  console.log("  Suporte atualizado para proprietario");

  // Verificação final
  console.log("\n=== Verificação final ===");
  const [result] = await pool.query(
    "SELECT name, username, role, is_active FROM users WHERE id IN (?, ?, ?)",
    [VANESSA_PROP_ID, VANESSA_COTADOR_ID, SUPORTE_ID]
  );
  console.table(result);

  await pool.end();
  console.log("\nDone!");
}

main();
