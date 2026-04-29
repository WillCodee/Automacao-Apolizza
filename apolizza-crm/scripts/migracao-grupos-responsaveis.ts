import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mysql from "mysql2/promise";

const IVO_ID    = "dec868b3-e8e3-4dbe-a11f-04485f55bc06";
const IANNE_ID  = "eaaf6668-abe6-4b17-ab2f-16d741ff3d76";
const CAIO_ID   = "a4aec230-844c-457d-9d65-fe5a33b8606d";
const LUIS_ID   = "2147534d-1177-497f-adf1-db9b9156e0c6";
const GRUPO_SAUDE_ID = "74ebff63-1454-41ae-b92d-0698e4e82c2a";
const GRUPO_RE_ID    = "e62230ef-ccfe-4757-8b25-1c8f3e6ac92f";

export const SAUDE_ODONTO_PRODUCTS = [
  "VIDA PF", "VIDA PJ", "VIDA PME",
  "SAUDE PF", "SAUDE PJ", "SAÚDE PME", "SAÚDE EMPRESARIAL",
  "ODONTO PF", "ODONTO PJ", "ODONTO PME", "DENTAL EMPRESARIAL",
  "PREVIDENCIA", "GARANTIA", "GARATIA", "MIP", "PME/SUZANA",
];

async function batchUpdate(
  conn: mysql.Connection,
  ids: string[],
  assigneeId: string,
  batchSize = 500
) {
  let total = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const ph = batch.map(() => "?").join(", ");
    const [r] = await conn.execute(
      `UPDATE cotacoes SET assignee_id = ? WHERE id IN (${ph})`,
      [assigneeId, ...batch]
    );
    total += (r as mysql.ResultSetHeader).affectedRows;
  }
  return total;
}

async function main() {
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });
  console.log("=== Migração: grupos e responsáveis ===\n");

  // ── STEP 1: grupo_id para Saúde e Odonto ─────────────────────────────────
  const ph = SAUDE_ODONTO_PRODUCTS.map(() => "?").join(", ");
  const [r1] = await conn.execute(
    `UPDATE cotacoes SET grupo_id = ? WHERE deleted_at IS NULL AND UPPER(produto) IN (${ph})`,
    [GRUPO_SAUDE_ID, ...SAUDE_ODONTO_PRODUCTS]
  );
  console.log(`[1] grupo_id SAUDEEODONTO: ${(r1 as mysql.ResultSetHeader).affectedRows} rows`);

  // ── STEP 2: grupo_id para Ramos Elementares ───────────────────────────────
  const [r2] = await conn.execute(
    `UPDATE cotacoes SET grupo_id = ? WHERE deleted_at IS NULL AND produto IS NOT NULL AND UPPER(produto) NOT IN (${ph})`,
    [GRUPO_RE_ID, ...SAUDE_ODONTO_PRODUCTS]
  );
  console.log(`[2] grupo_id RAMOS ELEMENTARES: ${(r2 as mysql.ResultSetHeader).affectedRows} rows`);

  // ── STEP 3: assignee_id Ramos Elementares → Luis Felipe ──────────────────
  const [r3] = await conn.execute(
    `UPDATE cotacoes SET assignee_id = ? WHERE deleted_at IS NULL AND grupo_id = ?`,
    [LUIS_ID, GRUPO_RE_ID]
  );
  console.log(`[3] Ramos Elementares → Luis Felipe: ${(r3 as mysql.ResultSetHeader).affectedRows} rows`);

  // ── STEP 4: assignee_id Saúde e Odonto → 95% Ianne / 5% Caio ────────────
  const [soRows] = await conn.execute(
    `SELECT id FROM cotacoes WHERE deleted_at IS NULL AND grupo_id = ? ORDER BY id`,
    [GRUPO_SAUDE_ID]
  );
  const ids = (soRows as { id: string }[]).map((r) => r.id);
  const total = ids.length;
  const ianneCount = Math.round(total * 0.95);
  const caioCount = total - ianneCount;

  console.log(`\n[4] Saúde e Odonto total: ${total}`);
  console.log(`    Ianne recebe: ${ianneCount} (${((ianneCount / total) * 100).toFixed(1)}%)`);
  console.log(`    Caio recebe: ${caioCount} (${((caioCount / total) * 100).toFixed(1)}%)`);

  const updated4 = await batchUpdate(conn, ids.slice(0, ianneCount), IANNE_ID);
  console.log(`    → Ianne: ${updated4} rows atualizados`);

  if (caioCount > 0) {
    const updated5 = await batchUpdate(conn, ids.slice(ianneCount), CAIO_ID);
    console.log(`    → Caio: ${updated5} rows atualizados`);
  }

  // ── STEP 5: Ivo como co-responsável em todas as cotações CCliente ─────────
  const [r6] = await conn.execute(`
    INSERT IGNORE INTO cotacao_responsaveis (cotacao_id, user_id)
    SELECT id, ?
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND LOWER(situacao) LIKE '%cliente%'
      AND assignee_id != ?
  `, [IVO_ID, IVO_ID]);
  console.log(`\n[5] Ivo co-responsável CCliente: ${(r6 as mysql.ResultSetHeader).affectedRows} inserções`);

  // ── Verificação final ─────────────────────────────────────────────────────
  const [v1] = await conn.execute(`
    SELECT assignee_id, COUNT(*) as total FROM cotacoes
    WHERE deleted_at IS NULL AND grupo_id = ? GROUP BY assignee_id
  `, [GRUPO_SAUDE_ID]);
  console.log("\n=== Saúde e Odonto por assignee ===");
  console.table(v1);

  const [v2] = await conn.execute(`
    SELECT assignee_id, COUNT(*) as total FROM cotacoes
    WHERE deleted_at IS NULL AND grupo_id = ? GROUP BY assignee_id
  `, [GRUPO_RE_ID]);
  console.log("=== Ramos Elementares por assignee ===");
  console.table(v2);

  const [v3] = await conn.execute(`
    SELECT COUNT(*) as ivo_coresponsavel FROM cotacao_responsaveis WHERE user_id = ?
  `, [IVO_ID]);
  console.log("=== Co-responsáveis de Ivo ===");
  console.table(v3);

  await conn.end();
  console.log("\n✓ Migração concluída com sucesso!");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
