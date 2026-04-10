/**
 * IMPORTAÇÃO FINAL - BATCH COM TRY-CATCH INDIVIDUAL
 * Cada cotação é inserida individualmente, erros não bloqueiam o resto
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

const PRIORITY_MAP: Record<string, string> = {
  "URGENT": "urgente",
  "HIGH": "alta",
  "NORMAL": "normal",
  "LOW": "baixa",
};

function excelDateToDate(serial: number | string): Date | null {
  if (!serial) return null;
  const num = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(num)) return null;
  const utc_days = Math.floor(num - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
}

function normalizeStatus(status: string): string {
  if (!status) return "não iniciado";
  const upper = status.toUpperCase().trim();
  return STATUS_MAP[upper] || "não iniciado";
}

function normalizePriority(priority: string): string {
  if (!priority) return "normal";
  const upper = priority.toUpperCase().trim();
  return PRIORITY_MAP[upper] || "normal";
}

async function getOrCreateUser(username: string): Promise<string | null> {
  if (!username || username === "") {
    return null;
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  try {
    const tempPassword = hashSync("mudar123", 10);
    const email = `${username.toLowerCase().replace(/\s+/g, ".").replace(/,/g, "")}@apolizza.com`;

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
  } catch {
    return null;
  }
}

async function main() {
  console.log("═".repeat(80));
  console.log("  IMPORTAÇÃO FINAL - TOLERANTE A ERROS");
  console.log("═".repeat(80));

  const confirmDelete = process.argv.includes("--confirm");
  if (!confirmDelete) {
    console.log("\n⚠️  ATENÇÃO: Este script irá DELETAR todas as cotações do banco!");
    console.log("   Para confirmar, execute: npx tsx scripts/final-import.ts --confirm\n");
    process.exit(0);
  }

  // Limpar banco
  console.log("\n🗑️  Limpando tabela cotacoes...");
  await db.execute(sql`DELETE FROM cotacoes`);
  console.log("   ✓ Tabela limpa!");

  // Ler Excel
  console.log("\n📥 Lendo Excel...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const tasks = XLSX.utils.sheet_to_json(sheet, { range: 2 }) as any[];
  console.log(`   ✓ ${tasks.length} linhas`);

  // Processar usuários
  console.log("\n👤 Processando usuários...");
  const uniqueUsers = new Set<string>();
  tasks.forEach(t => {
    const a = t["Assignee"];
    if (a && a !== "") uniqueUsers.add(a);
  });

  const userMap = new Map<string, string | null>();
  for (const u of uniqueUsers) {
    const id = await getOrCreateUser(u);
    userMap.set(u, id);
  }
  console.log(`   ✓ ${uniqueUsers.size} usuários`);

  // Importar cotações COM TRY-CATCH INDIVIDUAL
  console.log("\n📥 Importando cotações (modo robusto)...");
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorSample: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

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

      const dueDate = excelDateToDate(task["Due Date"]);
      const inicioVigencia = excelDateToDate(task["DATA DE INICIO VIGENCIA (date)"]);
      const fimVigencia = excelDateToDate(task["DATA DE FIM VIGENCIA (date)"]);
      const primeiroPagamento = excelDateToDate(task["PRIMEIRO PAGAMENTO (date)"]);
      const proximaTratativa = excelDateToDate(task["A PRÓXIMA TRATIVA (date)"]);

      const premioSemIof = task["PREMIO SEM IOF (currency)"];
      const aReceber = task["A RECEBER (currency)"];
      const valorPerda = task["VALOR EM PERDA (currency)"];

      // INSERT INDIVIDUAL COM TRY-CATCH
      await db.insert(schema.cotacoes).values({
        clickupId: clickupId || null,
        name: String(name).substring(0, 500),
        status,
        priority,
        dueDate,
        assigneeId: assigneeId || null,
        tipoCliente: task["TIPO CLIENTE (drop down)"] || null,
        contatoCliente: task["CONTATO CLIENTE (phone)"] || null,
        seguradora: task["SEGURADORA (short text)"] || null,
        produto: task["PRODUTO (drop down)"] || null,
        situacao: task["SITUAÇÃO (drop down)"] || null,
        indicacao: task["INDICAÇÃO (short text)"] || null,
        inicioVigencia: inicioVigencia ? inicioVigencia.toISOString().split("T")[0] : null,
        fimVigencia: fimVigencia ? fimVigencia.toISOString().split("T")[0] : null,
        primeiroPagamento: primeiroPagamento ? primeiroPagamento.toISOString().split("T")[0] : null,
        proximaTratativa: proximaTratativa ? proximaTratativa.toISOString().split("T")[0] : null,
        parceladoEm: task["PARCELADO EM (number)"] ? parseInt(task["PARCELADO EM (number)"]) : null,
        premioSemIof: premioSemIof ? String(premioSemIof) : null,
        comissao: task["COMISSÃO APOLIZZA (short text)"] ? String(task["COMISSÃO APOLIZZA (short text)"]) : null,
        aReceber: aReceber ? String(aReceber) : null,
        valorPerda: valorPerda ? String(valorPerda) : null,
        mesReferencia: task["MÊS (drop down)"] || null,
        anoReferencia: task["ANO (drop down)"] ? (typeof task["ANO (drop down)"] === 'string' ? parseInt(task["ANO (drop down)"]) : task["ANO (drop down)"]) : null,
        observacao: (task["OBSERVAÇÃO (text)"] || task["Task Content"]) ? String(task["OBSERVAÇÃO (text)"] || task["Task Content"]).substring(0, 5000) : null,
        tags: [],
        isRenovacao: false,
      });

      imported++;
      if (imported % 500 === 0) {
        console.log(`    [${i + 1}/${tasks.length}] ${imported} importadas...`);
      }
    } catch (err: any) {
      errors++;
      if (errorSample.length < 10) {
        errorSample.push(`${task["Task Name"]}: ${err.message}`);
      }
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log("  RELATÓRIO FINAL");
  console.log("═".repeat(80));
  console.log(`  Total Excel:    ${tasks.length}`);
  console.log(`  ✓ Importadas:   ${imported}`);
  console.log(`  ○ Puladas:      ${skipped}`);
  console.log(`  ✗ Erros:        ${errors}`);
  console.log("═".repeat(80));

  if (errorSample.length > 0) {
    console.log("\n❌ Amostra de erros:");
    errorSample.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
  }

  const result = await db.execute(sql`SELECT COUNT(*) as total FROM cotacoes`);
  console.log(`\n✓ Total no banco: ${(result.rows[0] as any).total}`);
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
