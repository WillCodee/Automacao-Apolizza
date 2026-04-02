/**
 * Importar dados do Excel para o sistema
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";
import { hashSync } from "bcryptjs";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema });

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

async function main() {
  console.log("═".repeat(70));
  console.log("  IMPORTAÇÃO DE DADOS DO EXCEL");
  console.log("═".repeat(70));

  // 1. Ler Excel
  console.log("\n📥 Lendo arquivo Excel...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  console.log(`   Sheet: ${sheetName}`);

  // 2. Converter para JSON
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet);
  console.log(`   Total de linhas: ${jsonData.length}`);

  // 3. Mostrar preview dos dados
  console.log("\n📋 Preview das primeiras 3 linhas:");
  console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));

  // 4. Verificar colunas
  console.log("\n📊 Colunas encontradas:");
  if (jsonData.length > 0) {
    const columns = Object.keys(jsonData[0] as any);
    columns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col}`);
    });
  }

  // 5. Salvar como CSV para referência
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const csvPath = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/cotacoes-import.csv";
  writeFileSync(csvPath, csv);
  console.log(`\n💾 CSV salvo em: ${csvPath}`);

  console.log("\n" + "═".repeat(70));
  console.log("✓ Análise concluída! Verifique os dados antes de importar.");
  console.log("═".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});
