/**
 * RE-IMPORTAÇÃO COMPLETA COM AUDITORIA
 * - Limpa tabela cotacoes
 * - Importa TODAS as 3197 cotações do Excel
 * - Trata cotações sem responsável
 * - Log detalhado de erros
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { hashSync } from "bcryptjs";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema });

const EXCEL_PATH = "/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/2026-04-02T14_02_16.511Z APOLIZZA - COMERCIAL - COTACOES.xlsx";

// Mapeamento de status
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
function excelDateToDate(serial: number | string): Date | null {
  if (!serial) return null;

  const num = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(num)) return null;

  const utc_days = Math.floor(num - 25569);
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

async function getOrCreateUser(username: string): Promise<string | null> {
  if (!username || username === "") {
    return null; // Retorna NULL para cotações sem responsável
  }

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
  const email = `${username.toLowerCase().replace(/\s+/g, ".").replace(/,/g, "")}@apolizza.com`;

  try {
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
  } catch (err: any) {
    console.error(`    ✗ ERRO ao criar usuário ${username}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("═".repeat(80));
  console.log("  RE-IMPORTAÇÃO COMPLETA - EXCEL → BANCO");
  console.log("═".repeat(80));

  // ETAPA 1: Limpar banco
  console.log("\n🗑️  ETAPA 1: Limpando tabela cotacoes...");
  const confirmDelete = process.argv.includes("--confirm");

  if (!confirmDelete) {
    console.log("\n⚠️  ATENÇÃO: Este script irá DELETAR todas as cotações do banco!");
    console.log("   Para confirmar, execute: npx tsx scripts/reimport-all.ts --confirm\n");
    process.exit(0);
  }

  await db.execute(sql`DELETE FROM cotacoes`);
  console.log("   ✓ Tabela cotacoes limpa!");

  // ETAPA 2: Ler Excel
  console.log("\n📥 ETAPA 2: Lendo arquivo Excel...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];
  console.log(`   ✓ ${tasks.length} linhas lidas do Excel`);

  // ETAPA 3: Processar usuários
  console.log("\n👤 ETAPA 3: Processando usuários...");
  const uniqueUsers = new Set<string>();
  tasks.forEach((task) => {
    const assignee = task["Assignee"];
    if (assignee && assignee !== "") {
      uniqueUsers.add(assignee);
    }
  });

  const userMap = new Map<string, string | null>();
  for (const username of uniqueUsers) {
    const userId = await getOrCreateUser(username);
    userMap.set(username, userId);
  }
  console.log(`   ✓ ${uniqueUsers.size} usuários processados`);

  // ETAPA 4: Importar cotações
  console.log("\n📥 ETAPA 4: Importando cotações...");
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorLog: Array<{ index: number; name: string; error: string }> = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const progress = `[${i + 1}/${tasks.length}]`;

    try {
      const name = task["Task Name"];

      // IMPORTANTE: Não pular cotações sem nome OU sem responsável
      if (!name || name === "") {
        skipped++;
        console.log(`    ${progress} ⊘ Pulada: sem nome`);
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
        assigneeId: assigneeId || null, // Permite NULL
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
        comissao: comissao ? String(comissao) : null, // Agora é text, não precisa processar
        aReceber: aReceber ? String(aReceber) : null,
        valorPerda: valorPerda ? String(valorPerda) : null,
        mesReferencia: mesReferencia || null,
        anoReferencia: anoReferencia ? (typeof anoReferencia === 'string' ? parseInt(anoReferencia) : anoReferencia) : null,
        observacao: observacao ? String(observacao).substring(0, 5000) : null,
        tags: [],
        isRenovacao: false,
      });

      imported++;

      // Log a cada 100
      if (imported % 100 === 0) {
        console.log(`    ${progress} ${imported} importadas...`);
      }
    } catch (err: any) {
      errors++;
      // Capturar DETALHES completos do erro
      const errorMsg = err.message || String(err);
      const errorCode = err.code || "";
      const errorDetail = err.detail || "";

      errorLog.push({
        index: i + 1,
        name: task["Task Name"] || "(sem nome)",
        error: `${errorMsg} ${errorCode ? `[${errorCode}]` : ""} ${errorDetail || ""}`
      });

      console.error(`    ${progress} ✗ ERRO: ${task["Task Name"]}`);
      console.error(`      └─ ${errorMsg}`);
      if (errorCode) console.error(`      └─ Code: ${errorCode}`);
      if (errorDetail) console.error(`      └─ Detail: ${errorDetail}`);
    }
  }

  // RELATÓRIO FINAL
  console.log("\n" + "═".repeat(80));
  console.log("  RELATÓRIO FINAL");
  console.log("═".repeat(80));
  console.log(`  Total no Excel:     ${tasks.length}`);
  console.log(`  ✓ Importadas:       ${imported}`);
  console.log(`  ○ Puladas:          ${skipped}`);
  console.log(`  ✗ Erros:            ${errors}`);
  console.log("═".repeat(80));

  // Log detalhado de erros
  if (errorLog.length > 0) {
    console.log("\n❌ ERROS DETALHADOS:");
    errorLog.forEach((e) => {
      console.log(`   ${e.index}. ${e.name}`);
      console.log(`      └─ ${e.error}`);
    });
  }

  // Verificação final
  const result = await db.execute(sql`SELECT COUNT(*) as total FROM cotacoes`);
  const finalCount = (result.rows[0] as any).total;
  console.log(`\n✓ Verificação: ${finalCount} cotações no banco`);

  if (parseInt(finalCount) === imported) {
    console.log("✓ SUCESSO! Todos os dados foram importados corretamente.\n");
  } else {
    console.log("⚠️  ATENÇÃO: Há discrepância entre cotações importadas e total no banco!\n");
  }
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
