import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

const path1 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/BENEFICIOS SAUDE VIDA DENTAL E GARANTIAS DE ABRIL.xlsx";
const path2 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/RAMOS ELEMENTAR AUTO, RC, VIAGEM, EMPRESARIAL, CONDOMINIO, ETC DE ABRIL.xlsx";

function getIds(p: string) {
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets["Tasks"];
  const all = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
  return all.slice(2).filter(r => r["__EMPTY"] === "Task").map(r => String(r["__EMPTY_1"] || "")).filter(Boolean);
}

async function main() {
  const plIds = new Set([...getIds(path1), ...getIds(path2)]);

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });

  const [rows] = await conn.execute(`
    SELECT u.name as cotador, c.name as cliente, c.situacao, c.status,
      c.produto, CAST(c.a_receber AS DECIMAL(12,2)) as a_receber,
      c.clickup_id, c.mes_referencia
    FROM cotacoes c
    LEFT JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
    ORDER BY u.name, c.name
  `) as [Record<string, unknown>[], unknown];

  const all = rows as Record<string, unknown>[];
  const soBanco = all.filter(c => !c.clickup_id || !plIds.has(String(c.clickup_id)));

  const fmt = (v: unknown) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  console.log(`\n=== REGISTROS SÓ NO BANCO (${soBanco.length}) ===`);
  console.log("  (sem clickup_id OU clickup_id não encontrado nas planilhas)\n");
  soBanco.forEach(c => {
    const cid = c.clickup_id ? String(c.clickup_id) : "SEM_ID";
    const cotador = String(c.cotador || "SEM ASSIGNEE").padEnd(20);
    const cliente = String(c.cliente || "").substring(0, 40).padEnd(40);
    const sit = String(c.situacao || "").padEnd(16);
    const prod = String(c.produto || "").padEnd(20);
    const ar = fmt(c.a_receber).padStart(12);
    console.log(`  [${cid}] ${cotador} | ${cliente} | ${sit} | ${prod} | ${ar}`);
  });

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
