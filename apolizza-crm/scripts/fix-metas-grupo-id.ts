import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mysql from "mysql2/promise";

async function main() {
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 1 });

  console.log("Adicionando coluna grupo_id na tabela metas...");
  await pool.query(
    "ALTER TABLE metas ADD COLUMN grupo_id char(36) DEFAULT NULL AFTER user_id"
  );
  console.log("Coluna grupo_id adicionada com sucesso!");

  // Verificar
  const [columns] = await pool.query("SHOW COLUMNS FROM metas WHERE Field = 'grupo_id'");
  console.table(columns);

  await pool.end();
}

main();
