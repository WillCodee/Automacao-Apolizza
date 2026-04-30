import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

const path1 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/BENEFICIOS SAUDE VIDA DENTAL E GARANTIAS DE ABRIL.xlsx";
const path2 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/RAMOS ELEMENTAR AUTO, RC, VIAGEM, EMPRESARIAL, CONDOMINIO, ETC DE ABRIL.xlsx";

const FELIPE_ID = "2147534d-1177-497f-adf1-db9b9156e0c6";
const IVO_ID    = "dec868b3-e8e3-4dbe-a11f-04485f55bc06";

function getRows(p: string) {
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets["Tasks"];
  const all = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
  return all.slice(2).filter(r => r["__EMPTY"] === "Task").map(r => ({
    taskId:   String(r["__EMPTY_1"] || ""),
    nome:     String(r["__EMPTY_2"] || ""),
    assignee: String(r["__EMPTY_5"] || ""),
    situacao: String(r["__EMPTY_49"] || ""),
  }));
}

async function main() {
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });

  // ── IDs da planilha ─────────────────────────────────────────────────────────
  const ramosRows = getRows(path2);
  const benefRows = getRows(path1);
  const allRows   = [...ramosRows, ...benefRows];

  const ramosIds  = new Set(ramosRows.map(r => r.taskId).filter(Boolean));
  const gestaoIds = new Set(allRows.filter(r => r.assignee.toUpperCase() === "GESTAO").map(r => r.taskId).filter(Boolean));

  console.log("\n=== ANÁLISE PRÉ-ATRIBUIÇÃO ===");
  console.log(`  Cotações RAMOS ELEMENTAR (planilha): ${ramosRows.length}`);
  console.log(`  Cotações com GESTAO como assignee:   ${gestaoIds.size}`);

  // ── Estado atual no banco ───────────────────────────────────────────────────
  const [rows] = await conn.execute(`
    SELECT c.id, c.name as cliente, c.clickup_id, c.situacao, c.status,
           c.produto, CAST(c.a_receber AS DECIMAL(12,2)) as a_receber,
           u.name as cotador, c.assignee_id
    FROM cotacoes c
    LEFT JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
    ORDER BY c.name
  `) as [Record<string, unknown>[], unknown];

  const all = rows as Record<string, unknown>[];
  const fmt = (v: unknown) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  // ── 1. RAMOS ELEMENTAR → Felipe ─────────────────────────────────────────────
  const paraFelipe = all.filter(r => r.clickup_id && ramosIds.has(String(r.clickup_id)));

  console.log(`\n--- RAMOS ELEMENTAR para Felipe (${paraFelipe.length}) ---`);
  paraFelipe.forEach(r =>
    console.log(`  [${r.clickup_id}] ${String(r.cliente).substring(0, 42).padEnd(42)} | ${String(r.situacao || "").padEnd(16)} | ${r.produto}`)
  );

  // ── 2. GESTAO na planilha → Ivo ──────────────────────────────────────────────
  const paraIvo_gestao = all.filter(r => r.clickup_id && gestaoIds.has(String(r.clickup_id)));

  console.log(`\n--- GESTAO (planilha) para Ivo (${paraIvo_gestao.length}) ---`);
  paraIvo_gestao.forEach(r =>
    console.log(`  [${r.clickup_id}] ${String(r.cliente).substring(0, 42).padEnd(42)} | ${String(r.situacao || "").padEnd(16)} | ${r.produto}`)
  );

  // ── 3. CCliente no banco (situacao LIKE %cliente%) ───────────────────────────
  const [cclienteRows] = await conn.execute(`
    SELECT c.id, c.name as cliente, c.clickup_id, c.situacao,
           c.produto, CAST(c.a_receber AS DECIMAL(12,2)) as a_receber,
           u.name as cotador, c.assignee_id
    FROM cotacoes c
    LEFT JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
      AND LOWER(c.situacao) LIKE '%cliente%'
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
    ORDER BY c.name
  `) as [Record<string, unknown>[], unknown];

  const ccliente = cclienteRows as Record<string, unknown>[];
  const jaComIvo = ccliente.filter(r => r.assignee_id === IVO_ID);
  const semIvo   = ccliente.filter(r => r.assignee_id !== IVO_ID);

  console.log(`\n--- CCliente no banco: ${ccliente.length} total ---`);
  console.log(`  Já atribuídas a Ivo: ${jaComIvo.length}`);
  console.log(`  Sem Ivo (serão atribuídas): ${semIvo.length}`);
  semIvo.forEach(r =>
    console.log(`  [${r.clickup_id || "SEM_ID"}] ${String(r.cotador || "SEM").padEnd(18)} | ${String(r.cliente).substring(0, 40).padEnd(40)} | ${r.situacao}`)
  );

  // ── EXECUÇÃO ─────────────────────────────────────────────────────────────────
  console.log("\n=== EXECUTANDO ATRIBUIÇÕES ===");

  // 1. Ramos → Felipe
  if (paraFelipe.length > 0) {
    const ids = paraFelipe.map(r => r.id);
    const ph  = ids.map(() => "?").join(",");
    await conn.execute(`UPDATE cotacoes SET assignee_id = ?, updated_at = NOW() WHERE id IN (${ph})`, [FELIPE_ID, ...ids]);
    console.log(`✅ ${paraFelipe.length} cotações RAMOS ELEMENTAR → Luis Felipe`);
  }

  // 2. Gestao → Ivo
  if (paraIvo_gestao.length > 0) {
    const ids = paraIvo_gestao.map(r => r.id);
    const ph  = ids.map(() => "?").join(",");
    await conn.execute(`UPDATE cotacoes SET assignee_id = ?, updated_at = NOW() WHERE id IN (${ph})`, [IVO_ID, ...ids]);
    console.log(`✅ ${paraIvo_gestao.length} cotações GESTAO → Ivo Santos`);
  }

  // 3. CCliente sem Ivo → Ivo
  if (semIvo.length > 0) {
    const ids = semIvo.map(r => r.id);
    const ph  = ids.map(() => "?").join(",");
    await conn.execute(`UPDATE cotacoes SET assignee_id = ?, updated_at = NOW() WHERE id IN (${ph})`, [IVO_ID, ...ids]);
    console.log(`✅ ${semIvo.length} cotações CCliente (sem assignee) → Ivo Santos`);
  }

  // ── VERIFICAÇÃO FINAL ────────────────────────────────────────────────────────
  const [final] = await conn.execute(`
    SELECT u.name as cotador,
      COUNT(*) as total,
      SUM(CASE WHEN LOWER(c.situacao) = 'fechado' OR c.status = 'fechado' THEN 1 ELSE 0 END) as fechadas,
      SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' THEN 1 ELSE 0 END) as perdas,
      SUM(CASE WHEN LOWER(c.situacao) LIKE '%cliente%' THEN 1 ELSE 0 END) as ccliente,
      CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' OR c.status = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) as a_receber
    FROM cotacoes c
    JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
    GROUP BY u.name
    ORDER BY total DESC
  `) as [Record<string, unknown>[], unknown];

  console.log("\n=== VERIFICAÇÃO FINAL — ABR/2026 POR COTADOR ===");
  console.log("  Cotador               | Total | Fechadas | Perdas | CCliente | A Receber");
  console.log("  " + "-".repeat(75));
  (final as Record<string, unknown>[]).forEach(r =>
    console.log(`  ${String(r.cotador).padEnd(22)}| ${String(r.total).padStart(5)} | ${String(r.fechadas).padStart(8)} | ${String(r.perdas).padStart(6)} | ${String(r.ccliente).padStart(8)} | ${fmt(r.a_receber).padStart(14)}`)
  );

  // Sem assignee restante
  const [semAss] = await conn.execute(`
    SELECT COUNT(*) as total FROM cotacoes
    WHERE deleted_at IS NULL AND assignee_id IS NULL
      AND (UPPER(mes_referencia) = 'ABR' OR UPPER(mes_referencia) = 'ABRIL')
      AND ano_referencia = 2026
  `) as [Record<string, unknown>[], unknown];
  console.log(`\n  Ainda SEM ASSIGNEE: ${(semAss as Record<string,unknown>[])[0].total}`);

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
