import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

const path1 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/BENEFICIOS SAUDE VIDA DENTAL E GARANTIAS DE ABRIL.xlsx";

const IANNE_ID = "eaaf6668-abe6-4b17-ab2f-16d741ff3d76";
const CAIO_ID  = "a4aec230-844c-457d-9d65-fe5a33b8606d";

function getIds(p: string) {
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets["Tasks"];
  const all = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
  return all.slice(2).filter(r => r["__EMPTY"] === "Task").map(r => String(r["__EMPTY_1"] || "")).filter(Boolean);
}

async function main() {
  const planilhaIds = new Set(getIds(path1));
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });

  // Busca as cotações SEM ASSIGNEE que estão na planilha, ordenadas por nome
  const [rows] = await conn.execute(`
    SELECT c.id, c.name as cliente, c.clickup_id
    FROM cotacoes c
    WHERE c.deleted_at IS NULL
      AND c.assignee_id IS NULL
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
    ORDER BY c.name
  `) as [Record<string, unknown>[], unknown];

  const all = rows as Record<string, unknown>[];
  const daPlanilha = all.filter(r => planilhaIds.has(String(r.clickup_id || "")));

  console.log(`\nTotal encontrado da planilha BENEFÍCIOS sem assignee: ${daPlanilha.length}`);

  if (daPlanilha.length !== 113) {
    console.warn(`Atenção: esperado 113, encontrado ${daPlanilha.length}`);
  }

  const paraIanne = daPlanilha.slice(0, 100);
  const paraCaio  = daPlanilha.slice(100);

  console.log(`  → Ianne Lima:    ${paraIanne.length} cotações`);
  console.log(`  → Caio Vinicius: ${paraCaio.length} cotações`);

  // Atualiza Ianne
  if (paraIanne.length > 0) {
    const ids = paraIanne.map(r => r.id);
    const placeholders = ids.map(() => "?").join(",");
    await conn.execute(
      `UPDATE cotacoes SET assignee_id = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
      [IANNE_ID, ...ids]
    );
    console.log(`\n✅ ${paraIanne.length} cotações atribuídas a Ianne Lima`);
  }

  // Atualiza Caio
  if (paraCaio.length > 0) {
    const ids = paraCaio.map(r => r.id);
    const placeholders = ids.map(() => "?").join(",");
    await conn.execute(
      `UPDATE cotacoes SET assignee_id = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
      [CAIO_ID, ...ids]
    );
    console.log(`✅ ${paraCaio.length} cotações atribuídas a Caio Vinicius`);
  }

  // Verificação
  const [check] = await conn.execute(`
    SELECT u.name, COUNT(*) as total
    FROM cotacoes c
    JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
      AND c.assignee_id IN (?, ?)
    GROUP BY u.name
  `, [IANNE_ID, CAIO_ID]) as [Record<string, unknown>[], unknown];

  console.log("\n=== VERIFICAÇÃO FINAL ===");
  (check as Record<string, unknown>[]).forEach(r =>
    console.log(`  ${r.name}: ${r.total} cotações em ABR/2026`)
  );

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
