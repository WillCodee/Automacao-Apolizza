/**
 * Auditoria de importação - comparar Excel vs Banco
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/schema";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema });

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

async function main() {
  console.log("═".repeat(80));
  console.log("  AUDITORIA DE IMPORTAÇÃO - EXCEL vs BANCO");
  console.log("═".repeat(80));

  // 1. Ler Excel
  console.log("\n📥 Lendo arquivo Excel...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Pular 2 linhas vazias (range: 2)
  const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];
  console.log(`   Total de linhas no Excel: ${tasks.length}`);

  // 2. Analisar Excel
  console.log("\n📊 Análise do Excel:");
  let withName = 0;
  let withoutName = 0;
  let withAssignee = 0;
  let withoutAssignee = 0;
  const assignees = new Set<string>();

  tasks.forEach((task) => {
    const name = task["Task Name"];
    const assignee = task["Assignee"];

    if (name && name !== "") {
      withName++;
    } else {
      withoutName++;
    }

    if (assignee && assignee !== "") {
      withAssignee++;
      assignees.add(assignee);
    } else {
      withoutAssignee++;
    }
  });

  console.log(`   ✓ Com nome válido: ${withName}`);
  console.log(`   ✗ Sem nome: ${withoutName}`);
  console.log(`   ✓ Com responsável: ${withAssignee}`);
  console.log(`   ✗ Sem responsável: ${withoutAssignee}`);
  console.log(`   👥 Responsáveis únicos: ${assignees.size}`);

  // 3. Consultar banco
  console.log("\n💾 Consultando banco de dados...");
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN assignee_id IS NOT NULL THEN 1 END) as com_responsavel,
      COUNT(CASE WHEN assignee_id IS NULL THEN 1 END) as sem_responsavel,
      COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deletadas
    FROM cotacoes
  `);
  
  const dbStats = result.rows[0] as any;
  console.log(`   Total no banco: ${dbStats.total}`);
  console.log(`   Com responsável: ${dbStats.com_responsavel}`);
  console.log(`   Sem responsável: ${dbStats.sem_responsavel}`);
  console.log(`   Deletadas (soft): ${dbStats.deletadas}`);

  // 4. Identificar discrepância
  console.log("\n⚠️  Discrepância:");
  const expected = withName; // Linhas com nome válido
  const actual = parseInt(dbStats.total);
  const diff = expected - actual;

  console.log(`   Esperado (Excel com nome): ${expected}`);
  console.log(`   Atual (Banco): ${actual}`);
  console.log(`   Diferença: ${diff} cotações`);

  if (diff > 0) {
    console.log(`\n   ⚠️  ${diff} cotações NÃO foram importadas!`);
  } else if (diff < 0) {
    console.log(`\n   ⚠️  Banco tem ${Math.abs(diff)} cotações a MAIS que o Excel!`);
  } else {
    console.log(`\n   ✓ Dados sincronizados!`);
  }

  // 5. Listar responsáveis únicos
  console.log("\n👥 Responsáveis no Excel:");
  const sortedAssignees = Array.from(assignees).sort();
  sortedAssignees.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a}`);
  });

  console.log("\n" + "═".repeat(80));
  console.log("✓ Auditoria concluída!");
  console.log("═".repeat(80));
}

main().catch((err) => {
  console.error("\n💥 Erro:", err);
  process.exit(1);
});
