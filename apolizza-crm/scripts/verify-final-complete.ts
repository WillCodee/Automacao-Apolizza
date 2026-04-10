/**
 * VERIFICAÇÃO FINAL COMPLETA
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import * as XLSX from "xlsx";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("═".repeat(80));
  console.log("  VERIFICAÇÃO FINAL: Excel vs Banco");
  console.log("═".repeat(80));

  // 1. Ler Excel
  console.log("\n📋 Lendo arquivo Excel...");
  const filePath = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`   ✓ Total de linhas no Excel (bruto): ${rawData.length}`);

  // A primeira linha está vazia, a segunda tem os cabeçalhos
  // Dados reais começam da linha 3 (índice 2)
  const header = rawData[1]; // Linha 2 tem os cabeçalhos
  const excelData = rawData.slice(2); // Dados começam da linha 3

  console.log(`   ✓ Total de cotações no Excel: ${excelData.length}`);

  // Mapear colunas
  const taskIdCol = "__EMPTY_1"; // "Task ID"
  const taskNameCol = "__EMPTY_2"; // "Task Name"

  // Extrair ClickUp IDs válidos do Excel
  const excelClickUpIds = new Set<string>();
  const excelRows = new Map<string, any>();

  excelData.forEach(row => {
    const clickupId = row[taskIdCol]?.toString().trim();
    if (clickupId && clickupId !== "" && clickupId !== "undefined") {
      excelClickUpIds.add(clickupId);
      excelRows.set(clickupId, row);
    }
  });

  console.log(`   ✓ ClickUp IDs únicos válidos: ${excelClickUpIds.size}`);

  // 2. Buscar do banco
  console.log("\n💾 Buscando cotações do banco...");
  const dbResult = await sql`
    SELECT clickup_id, name, ano_referencia, status
    FROM cotacoes
    WHERE deleted_at IS NULL
    ORDER BY clickup_id;
  `;

  console.log(`   ✓ Total no banco (não deletadas): ${dbResult.length}`);

  // Extrair ClickUp IDs do banco
  const dbClickUpIds = new Set<string>();
  const dbRows = new Map<string, any>();

  dbResult.forEach((row: any) => {
    if (row.clickup_id) {
      dbClickUpIds.add(row.clickup_id);
      dbRows.set(row.clickup_id, row);
    }
  });

  console.log(`   ✓ Com ClickUp ID: ${dbClickUpIds.size}`);

  // 3. Comparação
  console.log("\n" + "═".repeat(80));
  console.log("  ANÁLISE COMPARATIVA");
  console.log("═".repeat(80));

  // IDs que estão no Excel mas NÃO no banco
  const missingInDb = Array.from(excelClickUpIds).filter(id => !dbClickUpIds.has(id));

  // IDs que estão no banco mas NÃO no Excel
  const extraInDb = Array.from(dbClickUpIds).filter(id => !excelClickUpIds.has(id));

  console.log(`\n📊 Estatísticas:`);
  console.log(`   • Excel (cotações):          ${excelClickUpIds.size}`);
  console.log(`   • Banco (com ClickUp ID):    ${dbClickUpIds.size}`);
  console.log(`   • Total no banco:            ${dbResult.length}`);

  console.log(`\n🔍 Diferenças:`);
  console.log(`   • Faltando no banco:         ${missingInDb.length}`);
  console.log(`   • Extras no banco:           ${extraInDb.length}`);

  // 4. Relatório detalhado
  if (missingInDb.length > 0) {
    console.log(`\n❌ ATENÇÃO: ${missingInDb.length} cotações do Excel NÃO estão no banco:`);
    missingInDb.slice(0, 10).forEach(id => {
      const row = excelRows.get(id);
      const name = row?.[taskNameCol] || 'Nome não encontrado';
      console.log(`   • ${id}: ${name.toString().substring(0, 60)}`);
    });
    if (missingInDb.length > 10) {
      console.log(`   ... e mais ${missingInDb.length - 10} cotações`);
    }
  }

  if (extraInDb.length > 0) {
    console.log(`\n⚠️  INFO: ${extraInDb.length} cotações no banco NÃO estão no Excel:`);
    console.log(`   (Isso é normal se foram criadas depois da exportação)`);
    extraInDb.slice(0, 5).forEach(id => {
      const row = dbRows.get(id);
      console.log(`   • ${id}: ${row?.name?.substring(0, 60)}`);
    });
    if (extraInDb.length > 5) {
      console.log(`   ... e mais ${extraInDb.length - 5} cotações`);
    }
  }

  // 5. Verificar anos
  console.log(`\n📅 Verificação de Anos:`);
  const comAno = await sql`
    SELECT COUNT(*) as total
    FROM cotacoes
    WHERE ano_referencia IS NOT NULL
      AND deleted_at IS NULL;
  `;

  const semAno = await sql`
    SELECT COUNT(*) as total
    FROM cotacoes
    WHERE ano_referencia IS NULL
      AND deleted_at IS NULL;
  `;

  console.log(`   • Cotações COM ano:    ${comAno[0].total}`);
  console.log(`   • Cotações SEM ano:    ${semAno[0].total}`);

  // 6. Breakdown por ano
  const porAno = await sql`
    SELECT
      ano_referencia,
      COUNT(*) as total
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY ano_referencia
    ORDER BY ano_referencia;
  `;

  console.log(`\n   Distribuição por ano:`);
  porAno.forEach((row: any) => {
    const ano = row.ano_referencia || 'NULL';
    console.log(`     • ${ano}: ${row.total} cotações`);
  });

  // 7. Conclusão
  console.log("\n" + "═".repeat(80));
  console.log("  CONCLUSÃO");
  console.log("═".repeat(80));

  if (missingInDb.length === 0) {
    console.log("\n✅ PERFEITO!");
    console.log(`   • Todas as ${excelClickUpIds.size} cotações do Excel estão no banco`);
    console.log(`   • ${comAno[0].total} cotações têm ano definido`);
    console.log(`   • ${semAno[0].total} cotações ainda sem ano`);

    if (extraInDb.length > 0) {
      console.log(`\n   ℹ️  ${extraInDb.length} cotações extras no banco (criadas após exportação)`);
    }
  } else {
    console.log(`\n⚠️  ATENÇÃO: ${missingInDb.length} cotações ainda precisam ser importadas`);
  }

  console.log("═".repeat(80));
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
