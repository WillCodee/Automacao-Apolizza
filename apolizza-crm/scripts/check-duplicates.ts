/**
 * Verificar duplicatas de clickup_id no Excel
 */
import * as XLSX from "xlsx";

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];

console.log(`Total de tasks: ${tasks.length}`);

// Verificar duplicatas de clickup_id
const clickupIds = new Map<string, number>();
let duplicates = 0;

tasks.forEach((task, index) => {
  const clickupId = task["Task ID"];
  if (clickupId) {
    if (clickupIds.has(clickupId)) {
      duplicates++;
      console.log(`Duplicata encontrada: ${clickupId} (linha ${index + 3}, anterior: ${clickupIds.get(clickupId)})`);
    } else {
      clickupIds.set(clickupId, index + 3);
    }
  }
});

console.log(`\nTotal de clickup_ids únicos: ${clickupIds.size}`);
console.log(`Duplicatas encontradas: ${duplicates}`);
