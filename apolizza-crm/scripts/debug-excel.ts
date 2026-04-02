/**
 * Debug da estrutura do Excel
 */
import * as XLSX from "xlsx";

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Tentar diferentes opções de range
console.log("\n=== Teste 1: range: 0 ===");
const data0 = XLSX.utils.sheet_to_json(sheet, { range: 0 });
console.log(`Total: ${data0.length}`);
console.log("Primeira linha:", JSON.stringify(data0[0], null, 2));

console.log("\n=== Teste 2: range: 1 ===");
const data1 = XLSX.utils.sheet_to_json(sheet, { range: 1 });
console.log(`Total: ${data1.length}`);
console.log("Primeira linha:", JSON.stringify(data1[0], null, 2));

console.log("\n=== Teste 3: range: 2 ===");
const data2 = XLSX.utils.sheet_to_json(sheet, { range: 2 });
console.log(`Total: ${data2.length}`);
console.log("Primeira linha:", JSON.stringify(data2[0], null, 2));
console.log("Segunda linha:", JSON.stringify(data2[1], null, 2));

console.log("\n=== Teste 4: raw data ===");
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
console.log(`Range: ${JSON.stringify(range)}`);
console.log(`A1: ${sheet['A1']?.v}`);
console.log(`A2: ${sheet['A2']?.v}`);
console.log(`A3: ${sheet['A3']?.v}`);
console.log(`B3: ${sheet['B3']?.v}`);
console.log(`C3: ${sheet['C3']?.v}`);
