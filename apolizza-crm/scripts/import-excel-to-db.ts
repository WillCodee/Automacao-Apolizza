/**
 * Importar dados reais do Excel do ClickUp para o banco
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { hashSync } from "bcryptjs";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema });

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

// Mapeamento de status ClickUp → Sistema
const STATUS_MAP: Record<string, string> = {
  "PENDENCIA": "pendencia",
  "PENDÊNCIA": "pendencia",
  "FECHADO": "fechado",
  "PERDA": "perda",
  "RAUT": "raut",
  "ATRASADO": "atrasado",
  "IMPLANTANDO": "implantando",
  "IMPLANTAÇÃO": "implantando",
  "NÃO INICIADO": "não iniciado",
  "NAO INICIADO": "não iniciado",
  "CONCLUIDO OCULTAR": "concluido ocultar",
};

// Mapeamento de prioridade
const PRIORITY_MAP: Record<string, string> = {
  "URGENT": "urgente",
  "HIGH": "alta",
  "NORMAL": "normal",
  "LOW": "baixa",
};

// Converter data Excel (número) para Date
function excelDateToDate(serial: number): Date | null {
  if (!serial || isNaN(serial)) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info;
}

// Normalizar status
function normalizeStatus(status: string): string {
  if (!status) return "não iniciado";
  const upper = status.toUpperCase().trim();
  return STATUS_MAP[upper] || "não iniciado";
}

// Normalizar prioridade
function normalizePriority(priority: string): string {
  if (!priority) return "normal";
  const upper = priority.toUpperCase().trim();
  return PRIORITY_MAP[upper] || "normal";
}

async function getOrCreateUser(username: string): Promise<string> {
  if (!username) return "";

  // Buscar usuário existente
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Criar novo usuário
  const tempPassword = hashSync("mudar123", 10);
  const email = `${username.toLowerCase().replace(/\s+/g, ".")}@apolizza.com`;

  const [newUser] = await db
    .insert(schema.users)
    .values({
      email,
      name: username,
      username,
      passwordHash: tempPassword,
      role: "cotador",
      isActive: true,
    })
    .returning();

  console.log(`    ✓ Usuário criado: ${username}`);
  return newUser.id;
}

async function main() {
  console.log("═".repeat(70));
  console.log("  IMPORTAÇÃO COMPLETA DO EXCEL");
  console.log("═".repeat(70));

  // 1. Ler Excel
  console.log("\n📥 Lendo arquivo Excel...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // 2. Converter para JSON com range: 2 (pula 2 linhas vazias, usa linha 3 como header)
  const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];
  console.log(`   Tasks válidas: ${tasks.length}`);

  // 4. Processar usuários únicos
  console.log("\n👤 Processando usuários...");
  const uniqueUsers = new Set<string>();
  tasks.forEach((task) => {
    const assignee = task["Assignee"];
    if (assignee && assignee !== "") {
      uniqueUsers.add(assignee);
    }
  });

  const userMap = new Map<string, string>();
  for (const username of uniqueUsers) {
    const userId = await getOrCreateUser(username);
    userMap.set(username, userId);
  }
  console.log(`   ✓ ${uniqueUsers.size} usuários processados`);

  // 5. Importar tasks
  console.log("\n📥 Importando cotações...");
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const progress = `[${i + 1}/${tasks.length}]`;

    try {
      const name = task["Task Name"];
      if (!name || name === "") {
        skipped++;
        continue;
      }

      const clickupId = task["Task ID"];
      const status = normalizeStatus(task["Status"]);
      const priority = normalizePriority(task["Priority"]);
      const assigneeUsername = task["Assignee"];
      const assigneeId = assigneeUsername ? userMap.get(assigneeUsername) : null;

      // Datas
      const dueDate = excelDateToDate(task["Due Date"]);
      const dateCreated = excelDateToDate(task["Date Created"]);

      // Custom fields
      const aReceber = task["A RECEBER (currency)"];
      const anoReferencia = task["ANO (drop down)"];
      const comissao = task["COMISSÃO APOLIZZA (short text)"];
      const contatoCliente = task["CONTATO CLIENTE (phone)"];
      const fimVigencia = excelDateToDate(task["DATA DE FIM VIGENCIA (date)"]);
      const inicioVigencia = excelDateToDate(task["DATA DE INICIO VIGENCIA (date)"]);
      const indicacao = task["INDICAÇÃO (short text)"];
      const mesReferencia = task["MÊS (drop down)"];
      const observacao = task["OBSERVAÇÃO (text)"] || task["Task Content"];
      const parceladoEm = task["PARCELADO EM (number)"];
      const premioSemIof = task["PREMIO SEM IOF (currency)"];
      const primeiroPagamento = excelDateToDate(task["PRIMEIRO PAGAMENTO (date)"]);
      const produto = task["PRODUTO (drop down)"];
      const seguradora = task["SEGURADORA (short text)"];
      const situacao = task["SITUAÇÃO (drop down)"];
      const tipoCliente = task["TIPO CLIENTE (drop down)"];
      const valorPerda = task["VALOR EM PERDA (currency)"];
      const proximaTratativa = excelDateToDate(task["A PRÓXIMA TRATIVA (date)"]);

      // Inserir no banco
      await db.insert(schema.cotacoes).values({
        clickupId: clickupId || null,
        name: name.substring(0, 500),
        status,
        priority,
        dueDate,
        assigneeId: assigneeId || null,
        tipoCliente: tipoCliente || null,
        contatoCliente: contatoCliente || null,
        seguradora: seguradora || null,
        produto: produto || null,
        situacao: situacao || null,
        indicacao: indicacao || null,
        inicioVigencia: inicioVigencia ? inicioVigencia.toISOString().split("T")[0] : null,
        fimVigencia: fimVigencia ? fimVigencia.toISOString().split("T")[0] : null,
        primeiroPagamento: primeiroPagamento ? primeiroPagamento.toISOString().split("T")[0] : null,
        proximaTratativa: proximaTratativa ? proximaTratativa.toISOString().split("T")[0] : null,
        parceladoEm: parceladoEm ? parseInt(parceladoEm) : null,
        premioSemIof: premioSemIof ? String(premioSemIof) : null,
        comissao: comissao ? String(comissao).replace("%", "").replace(",", ".") : null,
        aReceber: aReceber ? String(aReceber) : null,
        valorPerda: valorPerda ? String(valorPerda) : null,
        mesReferencia: mesReferencia || null,
        anoReferencia: anoReferencia ? (typeof anoReferencia === 'string' ? parseInt(anoReferencia) : anoReferencia) : null,
        observacao: observacao ? String(observacao).substring(0, 5000) : null,
        tags: [],
        isRenovacao: false,
      });

      imported++;
      if (imported % 100 === 0) {
        console.log(`    ${progress} ${imported} importadas...`);
      }
    } catch (err: any) {
      errors++;
      console.error(`    ${progress} ✗ ERRO: ${task["Task Name"]} - ${err.message}`);
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log("  RELATÓRIO FINAL");
  console.log("═".repeat(70));
  console.log(`  ✓ Importadas:  ${imported}`);
  console.log(`  ○ Puladas:     ${skipped}`);
  console.log(`  ✗ Erros:       ${errors}`);
  console.log("═".repeat(70));
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
