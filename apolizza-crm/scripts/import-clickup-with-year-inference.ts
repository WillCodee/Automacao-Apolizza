/**
 * IMPORTAÇÃO VIA API COM INFERÊNCIA DE ANO
 * Busca as 185 cotações e infere o ANO a partir das datas disponíveis
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { hashSync } from "bcryptjs";
import { readFileSync, writeFileSync } from "fs";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema, casing: 'snake_case' });

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;

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
  "urgent": "urgente",
  "high": "alta",
  "normal": "normal",
  "low": "baixa",
};

interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string };
  priority: { priority: string } | null;
  assignees: Array<{ username: string }>;
  custom_fields: Array<{
    id: string;
    name: string;
    type: string;
    value?: any;
    type_config?: any;
  }>;
  date_created: string;
  date_updated: string;
  date_closed?: string;
  due_date?: string;
}

function normalizeStatus(status: string): string {
  if (!status) return "não iniciado";
  const upper = status.toUpperCase().trim();
  return STATUS_MAP[upper] || "não iniciado";
}

function normalizePriority(priority: string | null): string {
  if (!priority) return "normal";
  const lower = priority.toLowerCase().trim();
  return PRIORITY_MAP[lower] || "normal";
}

async function getOrCreateUser(username: string): Promise<string | null> {
  if (!username || username === "") return null;

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

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

    return newUser.id;
  } catch {
    return null;
  }
}

async function fetchTaskFromClickUp(taskId: string): Promise<ClickUpTask | null> {
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': CLICKUP_API_TOKEN!,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`    ✗ Erro HTTP ${response.status} ao buscar task ${taskId}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error(`    ✗ Erro ao buscar task ${taskId}: ${err.message}`);
    return null;
  }
}

function getCustomFieldValue(task: ClickUpTask, fieldName: string): any {
  const field = task.custom_fields?.find(f => f.name === fieldName);
  if (!field || field.value === null || field.value === undefined) return null;

  // Se for dropdown, pegar o nome da opção
  if (field.type === 'drop_down' && field.type_config?.options) {
    const option = field.type_config.options.find((opt: any) => opt.orderindex === field.value);
    return option?.name || null;
  }

  return field.value;
}

function timestampToDate(timestamp: string | number | null): Date | null {
  if (!timestamp) return null;
  const ms = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  return new Date(ms);
}

/**
 * INFERIR ANO A PARTIR DE DATAS DISPONÍVEIS
 * Prioridade: inicioVigencia > fimVigencia > primeiroPagamento > dueDate > dateCreated
 */
function inferYearFromDates(task: ClickUpTask, customFieldDates: { [key: string]: Date | null }): number | null {
  // Ordem de prioridade das datas
  const datePriority = [
    customFieldDates['inicioVigencia'],
    customFieldDates['fimVigencia'],
    customFieldDates['primeiroPagamento'],
    timestampToDate(task.due_date || null),
    timestampToDate(task.date_created || null),
    timestampToDate(task.date_closed || null),
  ];

  // Retornar o ano da primeira data válida
  for (const date of datePriority) {
    if (date && date instanceof Date && !isNaN(date.getTime())) {
      return date.getFullYear();
    }
  }

  return null;
}

async function main() {
  console.log("═".repeat(80));
  console.log("  IMPORTAÇÃO VIA API COM INFERÊNCIA DE ANO");
  console.log("═".repeat(80));

  if (!CLICKUP_API_TOKEN) {
    console.error("\n❌ CLICKUP_API_TOKEN não encontrado no .env.local");
    process.exit(1);
  }

  // Ler IDs das cotações com erro
  console.log("\n📋 Lendo lista de cotações com erro...");
  const errorCsv = readFileSync("/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/cotacoes-erros.csv", "utf-8");
  const errorLines = errorCsv.split("\n").slice(1).filter(l => l.trim());

  const clickupIds: string[] = [];
  errorLines.forEach(line => {
    const match = line.match(/^\d+,"([^"]+)"/);
    if (match) {
      clickupIds.push(match[1]);
    }
  });

  console.log(`   ✓ ${clickupIds.length} ClickUp IDs para buscar`);

  // Processar
  console.log("\n🔄 Buscando dados da API e inferindo ANO...");
  let imported = 0;
  let failed = 0;
  let notFound = 0;
  let yearInferred = 0;
  const userCache = new Map<string, string | null>();
  const failedTasks: Array<{ id: string; name: string; error: string }> = [];
  const inferenceLog: Array<{ name: string; yearSource: string; year: number }> = [];

  for (let i = 0; i < clickupIds.length; i++) {
    const clickupId = clickupIds[i];
    const progress = `[${i + 1}/${clickupIds.length}]`;

    try {
      // Buscar task da API
      const task = await fetchTaskFromClickUp(clickupId);

      if (!task) {
        notFound++;
        console.log(`    ${progress} ⊘ Task ${clickupId} não encontrada na API`);
        continue;
      }

      // Extrair dados
      const assigneeUsername = task.assignees?.[0]?.username || "";
      let assigneeId: string | null = null;

      if (assigneeUsername) {
        if (userCache.has(assigneeUsername)) {
          assigneeId = userCache.get(assigneeUsername)!;
        } else {
          assigneeId = await getOrCreateUser(assigneeUsername);
          userCache.set(assigneeUsername, assigneeId);
        }
      }

      const status = normalizeStatus(task.status?.status || "");
      const priority = normalizePriority(task.priority?.priority || null);

      // Custom fields
      let anoValue = getCustomFieldValue(task, "ANO");
      const mes = getCustomFieldValue(task, "MÊS");
      const tipoCliente = getCustomFieldValue(task, "TIPO CLIENTE");
      const contatoCliente = getCustomFieldValue(task, "CONTATO CLIENTE");
      const seguradora = getCustomFieldValue(task, "SEGURADORA");
      const produto = getCustomFieldValue(task, "PRODUTO");
      const situacao = getCustomFieldValue(task, "SITUAÇÃO");
      const indicacao = getCustomFieldValue(task, "INDICAÇÃO");
      const comissao = getCustomFieldValue(task, "COMISSÃO APOLIZZA");
      const observacao = getCustomFieldValue(task, "OBSERVAÇÃO");
      const parceladoEm = getCustomFieldValue(task, "PARCELADO EM");
      const premioSemIof = getCustomFieldValue(task, "PREMIO SEM IOF");
      const aReceber = getCustomFieldValue(task, "A RECEBER");
      const valorPerda = getCustomFieldValue(task, "VALOR EM PERDA");

      // Datas
      const dueDate = task.due_date ? timestampToDate(task.due_date) : null;
      const inicioVigencia = timestampToDate(getCustomFieldValue(task, "DATA DE INICIO VIGENCIA"));
      const fimVigencia = timestampToDate(getCustomFieldValue(task, "DATA DE FIM VIGENCIA"));
      const primeiroPagamento = timestampToDate(getCustomFieldValue(task, "PRIMEIRO PAGAMENTO"));
      const proximaTratativa = timestampToDate(getCustomFieldValue(task, "A PRÓXIMA TRATIVA"));

      // INFERIR ANO SE ESTIVER VAZIO
      let yearSource = "campo ANO";
      if (!anoValue) {
        const inferredYear = inferYearFromDates(task, {
          inicioVigencia,
          fimVigencia,
          primeiroPagamento
        });

        if (inferredYear) {
          anoValue = inferredYear;
          yearInferred++;

          // Determinar a fonte do ano
          if (inicioVigencia) yearSource = "início vigência";
          else if (fimVigencia) yearSource = "fim vigência";
          else if (primeiroPagamento) yearSource = "primeiro pagamento";
          else if (dueDate) yearSource = "due date";
          else yearSource = "data criação";

          inferenceLog.push({
            name: task.name,
            yearSource,
            year: inferredYear
          });
        }
      }

      const ano = anoValue ? (typeof anoValue === 'string' ? parseInt(anoValue) : anoValue) : null;

      // Inserir no banco
      await db.insert(schema.cotacoes).values({
        clickupId: task.id,
        name: task.name.substring(0, 500),
        status,
        priority,
        dueDate,
        assigneeId,
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
        comissao: comissao ? String(comissao) : null,
        aReceber: aReceber ? String(aReceber) : null,
        valorPerda: valorPerda ? String(valorPerda) : null,
        mesReferencia: mes || null,
        anoReferencia: ano,
        observacao: observacao ? String(observacao).substring(0, 5000) : null,
        tags: [],
        isRenovacao: false,
      });

      imported++;
      const yearInfo = anoValue ? `Ano: ${ano} (${yearSource})` : `Ano: N/A`;
      console.log(`    ${progress} ✓ ${task.name.substring(0, 60)} - ${yearInfo}`);

      // Rate limit: esperar 100ms entre requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err: any) {
      failed++;
      failedTasks.push({
        id: clickupId,
        name: "Desconhecido",
        error: err.message
      });
      console.error(`    ${progress} ✗ Erro ao importar ${clickupId}: ${err.message}`);
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log("  RELATÓRIO FINAL");
  console.log("═".repeat(80));
  console.log(`  Total buscado:       ${clickupIds.length}`);
  console.log(`  ✓ Importadas:        ${imported}`);
  console.log(`  📅 Anos inferidos:   ${yearInferred}`);
  console.log(`  ⊘ Não encontradas:   ${notFound}`);
  console.log(`  ✗ Erros:             ${failed}`);
  console.log("═".repeat(80));

  // Verificar total final
  const result = await db.execute(sql`SELECT COUNT(*) as total FROM cotacoes`);
  const finalTotal = (result.rows[0] as any).total;
  console.log(`\n✅ Total final no banco: ${finalTotal} cotações`);

  // Salvar log de inferências
  if (inferenceLog.length > 0) {
    console.log(`\n📊 Análise de inferência de anos:`);
    const sourceCount = new Map<string, number>();
    inferenceLog.forEach(log => {
      sourceCount.set(log.yearSource, (sourceCount.get(log.yearSource) || 0) + 1);
    });

    console.log(`\n   Fontes usadas para inferir o ano:`);
    Array.from(sourceCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`     • ${source}: ${count} cotações`);
      });

    const inferLog = inferenceLog.map(l => `"${l.name}","${l.yearSource}",${l.year}`).join("\n");
    writeFileSync("/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/anos-inferidos.csv",
      `Nome,Fonte do Ano,Ano Inferido\n${inferLog}`, "utf-8");
    console.log(`\n   📄 Log de inferências salvo em: dados/anos-inferidos.csv`);
  }

  // Salvar log de falhas
  if (failedTasks.length > 0) {
    const failLog = failedTasks.map(f => `${f.id},${f.name},"${f.error}"`).join("\n");
    writeFileSync("/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/clickup-api-failed.csv",
      `ClickUp ID,Nome,Erro\n${failLog}`, "utf-8");
    console.log(`\n⚠️  Log de falhas salvo em: dados/clickup-api-failed.csv`);
  }

  console.log("\n🎉 Importação com inferência de ANO concluída!\n");
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
