import * as XLSX from "xlsx";

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];

console.log("Verificando valores inválidos em campos decimais...\n");

let invalidPremio = 0;
let invalidAReceber = 0;
let invalidValorPerda = 0;

tasks.forEach((task, index) => {
  const premioSemIof = task["PREMIO SEM IOF (currency)"];
  const aReceber = task["A RECEBER (currency)"];
  const valorPerda = task["VALOR EM PERDA (currency)"];

  // Verificar premioSemIof
  if (premioSemIof && premioSemIof !== "") {
    const premioStr = String(premioSemIof);
    const premioNum = parseFloat(premioStr);
    if (isNaN(premioNum)) {
      invalidPremio++;
      if (invalidPremio <= 5) {
        console.log(`Linha ${index + 3}: premioSemIof inválido: "${premioStr}"`);
      }
    }
  }

  // Verificar aReceber
  if (aReceber && aReceber !== "") {
    const aReceberStr = String(aReceber);
    const aReceberNum = parseFloat(aReceberStr);
    if (isNaN(aReceberNum)) {
      invalidAReceber++;
      if (invalidAReceber <= 5) {
        console.log(`Linha ${index + 3}: aReceber inválido: "${aReceberStr}"`);
      }
    }
  }

  // Verificar valorPerda
  if (valorPerda && valorPerda !== "") {
    const valorPerdaStr = String(valorPerda);
    const valorPerdaNum = parseFloat(valorPerdaStr);
    if (isNaN(valorPerdaNum)) {
      invalidValorPerda++;
      if (invalidValorPerda <= 5) {
        console.log(`Linha ${index + 3}: valorPerda inválido: "${valorPerdaStr}"`);
      }
    }
  }
});

console.log(`\nTotais:`);
console.log(`  premioSemIof inválidos: ${invalidPremio}`);
console.log(`  aReceber inválidos: ${invalidAReceber}`);
console.log(`  valorPerda inválidos: ${invalidValorPerda}`);
console.log(`\nTotal de problemas potenciais: ${invalidPremio + invalidAReceber + invalidValorPerda}`);
