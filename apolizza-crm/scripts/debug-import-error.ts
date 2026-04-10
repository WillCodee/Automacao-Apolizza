/**
 * Debug: Capturar erro exato de uma cotação que falha
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema });

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

function excelDateToDate(serial: number | string): Date | null {
  if (!serial) return null;
  const num = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(num)) return null;
  const utc_days = Math.floor(num - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
}

async function debugImport() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];

  // Testar a linha 78 (MARINA MELO - PF BRENO)
  const task = tasks[77]; // Index 77 = linha 78

  console.log("═".repeat(80));
  console.log("DEBUG: Linha 78 (MARINA MELO - PF BRENO)");
  console.log("═".repeat(80));
  console.log("\nDados completos:");
  console.log(JSON.stringify(task, null, 2));

  // Tentar inserir
  console.log("\n\nTentando inserir...");
  try {
    const name = task["Task Name"];
    const clickupId = task["Task ID"];
    const premioSemIof = task["PREMIO SEM IOF (currency)"];

    console.log("\nCampos críticos:");
    console.log("  name:", name, "| type:", typeof name);
    console.log("  clickupId:", clickupId, "| type:", typeof clickupId);
    console.log("  premioSemIof:", premioSemIof, "| type:", typeof premioSemIof);

    // Tentar conversão
    const premioStr = premioSemIof ? String(premioSemIof) : null;
    console.log("  premioStr:", premioStr);

    await db.insert(schema.cotacoes).values({
      clickupId: clickupId || null,
      name: name.substring(0, 500),
      status: "fechado",
      priority: "urgente",
      premioSemIof: premioStr,
      tags: [],
      isRenovacao: false,
    });

    console.log("\n✓ Inserção bem-sucedida!");
  } catch (err: any) {
    console.error("\n✗ ERRO:");
    console.error("  Message:", err.message);
    console.error("  Code:", err.code);
    console.error("  Detail:", err.detail);
    console.error("\n  Stack:", err.stack);
  }
}

debugImport().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
