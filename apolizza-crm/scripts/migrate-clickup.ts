/**
 * Script de Migração ClickUp → MySQL (Story 6.4)
 *
 * Extrai tasks da lista de Cotações do ClickUp e insere no banco MySQL.
 * Uso: npx tsx scripts/migrate-clickup.ts [--limit=100] [--dry-run] [--from-backup=data/clickup-backup-2026-04-13.json]
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { hashSync } from "bcryptjs";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

// ============================================================
// CONFIG
// ============================================================

const LIST_ID = process.env.CLICKUP_LIST_ID || "900701916229";
const RENOV_SPACE_ID = process.env.CLICKUP_RENOV_SPACE_ID || "90070369721";
const RENOV_TEAM_ID = process.env.CLICKUP_RENOV_TEAM_ID || "9007156248";
const API_BASE = "https://api.clickup.com/api/v2";
const CLICKUP_TOKEN: string = process.env.CLICKUP_API_TOKEN || "";

// Custom field UUIDs
const FIELDS = {
  A_RECEBER: "cecaeb66-e057-4032-a296-27232581f4d7",
  VALOR_PERDA: "7d482fab-02e0-4e61-9563-b07a5565cf8f",
  ANO: "95fcbbf2-23cd-45dd-a9e3-dcad386e05e9",
  OBSERVACAO: "a8d0ccc1-c30b-4fe4-8514-7ce1841d8b16",
  SITUACAO: "787d9f83-2373-4adb-b709-8ca0da833af1",
  TIPO_CLIENTE: "003939fb-a195-4b62-8239-921442041174",
  PRIMEIRO_PAGAMENTO: "22697a67-9b28-4da0-b5d7-4143632c7a0c",
  FIM_VIGENCIA: "640d44b3-818e-4957-ac1b-2426d2e59e5d",
  PARCELADO_EM: "6e0de4a6-6562-40f0-892a-86d6419c6af1",
  SEGURADORA: "7692b42a-860b-4c74-a975-68547d3fe039",
  PREMIO_SEM_IOF: "7765251e-5e44-4567-a7c8-621584228853",
  INICIO_VIGENCIA: "adefa135-416a-4024-8bce-f55fbf5cceab",
  INDICACAO: "ca2fe9e7-831f-461f-aa32-c6477a0b81c5",
  COMISSAO: "cbab3bed-f4f7-44d1-a11e-374a57352f75",
  PRODUTO: "cf31d2a2-9746-460a-8396-f42b195f6f48",
  PROXIMA_TRATATIVA: "f3e53744-f27d-4e6e-acae-ee69b25daed8",
} as const;

// ANO dropdown: orderindex → year
const ANO_MAP: Record<number, number> = {
  0: 2026,
  1: 2025,
  2: 2027,
  3: 2024,
};

// Parse CLI args
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const TASK_LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : 0; // 0 = all
const DRY_RUN = args.includes("--dry-run");
const backupArg = args.find((a) => a.startsWith("--from-backup="));
const FROM_BACKUP = backupArg ? backupArg.split("=")[1] : null;
const COTACOES_LIST_ID = "900701916229"; // Used to distinguish cotações from other tasks

// DB setup
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL!,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
const db = drizzle(pool, { schema, mode: "default" });

// ============================================================
// TYPES
// ============================================================

interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value: unknown;
  type_config?: {
    options?: Array<{ id: string; name: string; label?: string; orderindex: number }>;
  };
}

interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string };
  priority: { priority: string } | null;
  due_date: string | null;
  start_date: string | null;
  date_created: string;
  assignees: Array<{ id: number; username: string; email?: string; profilePicture?: string }>;
  custom_fields: ClickUpCustomField[];
  tags: Array<{ name: string }>;
  description?: string;
  url?: string;
}

interface MigrationReport {
  startedAt: string;
  finishedAt?: string;
  source: string;
  taskLimit: number;
  totalExtracted: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  usersCreated: string[];
  errors: Array<{ taskId: string; name: string; error: string }>;
  statusBreakdown: Record<string, number>;
  financialSummary: {
    totalAReceber: number;
    totalValorPerda: number;
    totalPremio: number;
    totalComissao: number;
  };
}

// ============================================================
// CLICKUP API
// ============================================================

async function fetchClickUpTasks(
  listId: string,
  maxTasks: number
): Promise<ClickUpTask[]> {
  const allTasks: ClickUpTask[] = [];
  let page = 0;

  while (true) {
    const url = `${API_BASE}/list/${listId}/task?page=${page}&include_closed=true&subtasks=false&order_by=created&reverse=true`;
    console.log(`  Buscando pagina ${page}...`);

    const res = await fetch(url, {
      headers: { Authorization: CLICKUP_TOKEN },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    const tasks: ClickUpTask[] = data.tasks || [];

    if (tasks.length === 0) break;

    allTasks.push(...tasks);
    console.log(`  Pagina ${page}: ${tasks.length} tasks (total: ${allTasks.length})`);

    if (maxTasks > 0 && allTasks.length >= maxTasks) {
      const trimmed = allTasks.slice(0, maxTasks);
      console.log(`  Limite de ${maxTasks} tasks atingido.`);
      return trimmed;
    }

    if (tasks.length < 100) break; // last page
    page++;

    // Rate limiting - 100 req/min
    await sleep(700);
  }

  return allTasks;
}

async function fetchRenovacaoTasks(
  spaceId: string,
  teamId: string,
  maxTasks: number,
  alreadyFetched: number
): Promise<ClickUpTask[]> {
  // Get folders in the space
  const foldersUrl = `${API_BASE}/space/${spaceId}/folder?archived=false`;
  const foldersRes = await fetch(foldersUrl, {
    headers: { Authorization: CLICKUP_TOKEN },
  });

  if (!foldersRes.ok) {
    console.log(`  Aviso: Nao conseguiu acessar Space Renovacao (${foldersRes.status}). Pulando.`);
    return [];
  }

  const foldersData = await foldersRes.json();
  const allTasks: ClickUpTask[] = [];
  const remaining = maxTasks > 0 ? maxTasks - alreadyFetched : 0;

  for (const folder of foldersData.folders || []) {
    for (const list of folder.lists || []) {
      if (maxTasks > 0 && allTasks.length >= remaining) break;

      const tasks = await fetchClickUpTasks(
        list.id,
        maxTasks > 0 ? remaining - allTasks.length : 0
      );
      allTasks.push(...tasks);
    }
    if (maxTasks > 0 && allTasks.length >= remaining) break;
  }

  // Also check folderless lists
  const listsUrl = `${API_BASE}/space/${spaceId}/list?archived=false`;
  const listsRes = await fetch(listsUrl, {
    headers: { Authorization: CLICKUP_TOKEN },
  });

  if (listsRes.ok) {
    const listsData = await listsRes.json();
    for (const list of listsData.lists || []) {
      if (maxTasks > 0 && allTasks.length >= remaining) break;
      const tasks = await fetchClickUpTasks(
        list.id,
        maxTasks > 0 ? remaining - allTasks.length : 0
      );
      allTasks.push(...tasks);
    }
  }

  return allTasks;
}

// ============================================================
// FIELD EXTRACTION HELPERS
// ============================================================

function getCustomField(
  task: ClickUpTask,
  fieldId: string
): ClickUpCustomField | undefined {
  return task.custom_fields?.find((cf) => cf.id === fieldId);
}

/** Extract dropdown label from orderindex value */
function getDropdownLabel(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value === null || field.value === undefined) return null;

  const options = field.type_config?.options;
  if (!options) return String(field.value);

  const idx = Number(field.value);
  const option = options.find((o) => o.orderindex === idx);
  return option ? option.name || option.label || null : null;
}

/** Extract text/url field value */
function getTextValue(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value === null || field.value === undefined || field.value === "")
    return null;
  return String(field.value);
}

/** Extract currency field value (ClickUp stores in cents) */
function getCurrencyValue(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value === null || field.value === undefined || field.value === "")
    return null;
  const raw = parseFloat(String(field.value));
  if (isNaN(raw)) return null;
  // ClickUp currency fields are stored in cents (e.g. 73610 = R$ 736.10)
  const value = raw / 100;
  return value.toFixed(2);
}

/** Extract plain number field value */
function getNumericValue(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value === null || field.value === undefined || field.value === "")
    return null;
  const num = parseFloat(String(field.value));
  return isNaN(num) ? null : num.toFixed(2);
}

/** Extract comissao value (short_text like "18%" or "1500.00") */
function getComissaoValue(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value === null || field.value === undefined || field.value === "")
    return null;
  const raw = String(field.value).replace("%", "").replace(",", ".").trim();
  const num = parseFloat(raw);
  return isNaN(num) ? null : num.toFixed(2);
}

/** Extract integer field value */
function getIntValue(field: ClickUpCustomField | undefined): number | null {
  if (!field || field.value === null || field.value === undefined || field.value === "")
    return null;
  const num = parseInt(String(field.value));
  return isNaN(num) ? null : num;
}

/** Extract date field (ClickUp returns ms timestamp for date fields) */
function getDateValue(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value === null || field.value === undefined || field.value === "")
    return null;
  const ms = Number(field.value);
  if (isNaN(ms)) return null;
  return new Date(ms).toISOString().split("T")[0]; // YYYY-MM-DD
}

/** Convert ClickUp timestamp (ms) to Date */
function msToDate(ms: string | null): Date | null {
  if (!ms) return null;
  const num = Number(ms);
  return isNaN(num) ? null : new Date(num);
}

/** Normalize ClickUp status - remove extra spaces */
function normalizeStatus(status: string): string {
  // Remove leading/trailing spaces and normalize to exact ClickUp format
  const s = status.trim();

  // Fix "perda " (com espaço) → "perda" (sem espaço)
  if (s === "perda " || s === "perda") return "perda";

  // Retorna o status exato do ClickUp
  return s;
}

/** Map ClickUp priority to our format */
function normalizePriority(priority: string | null): string {
  if (!priority) return "normal";
  const map: Record<string, string> = {
    urgent: "urgente",
    high: "alta",
    normal: "normal",
    low: "baixa",
  };
  return map[priority.toLowerCase()] || "normal";
}

/** Get ANO from custom field with fallback chain */
function getAnoReferencia(task: ClickUpTask): number | null {
  // 1. Campo ANO dropdown
  const field = getCustomField(task, FIELDS.ANO);
  if (field?.value !== null && field?.value !== undefined) {
    const idx = Number(field.value);
    if (ANO_MAP[idx]) return ANO_MAP[idx];
  }
  // 2. start_date (campo nativo ClickUp)
  if (task.start_date) {
    const d = new Date(Number(task.start_date));
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  // 3. due_date
  if (task.due_date) {
    const d = new Date(Number(task.due_date));
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  // 4. date_created (última opção)
  if (task.date_created) {
    const d = new Date(Number(task.date_created));
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  return null;
}

/** Get MES from due_date */
function getMesReferencia(task: ClickUpTask): string | null {
  const due = task.due_date ? Number(task.due_date) : null;
  if (!due || isNaN(due)) return null;
  const months = [
    "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
    "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
  ];
  return months[new Date(due).getMonth()];
}

// ============================================================
// USER MANAGEMENT
// ============================================================

async function getOrCreateUsers(
  tasks: ClickUpTask[]
): Promise<Map<string, string>> {
  const usernameMap = new Map<string, string>(); // username → user.id
  const uniqueAssignees = new Map<
    string,
    { username: string; email?: string; profilePicture?: string }
  >();

  // Collect unique assignees
  for (const task of tasks) {
    for (const a of task.assignees || []) {
      if (a.username && !uniqueAssignees.has(a.username)) {
        uniqueAssignees.set(a.username, {
          username: a.username,
          email: a.email,
          profilePicture: a.profilePicture,
        });
      }
    }
  }

  console.log(`\nAssignees unicos encontrados: ${uniqueAssignees.size}`);

  // Check existing users by username AND email
  const existingUsers = await db.select().from(schema.users);
  const emailToId = new Map<string, string>();
  for (const u of existingUsers) {
    usernameMap.set(u.username, u.id);
    emailToId.set(u.email, u.id);
  }

  // Create missing users
  const tempPassword = hashSync("mudar123", 10);
  const created: string[] = [];

  for (const [username, info] of uniqueAssignees) {
    if (usernameMap.has(username)) {
      console.log(`  Usuario existente (username): ${username}`);
      continue;
    }

    const email = info.email || `${username.toLowerCase().replace(/\s+/g, ".")}@apolizza.com`;

    // Check if email already exists (user with different username)
    if (emailToId.has(email)) {
      const existingId = emailToId.get(email)!;
      usernameMap.set(username, existingId);
      console.log(`  Usuario existente (email ${email}): ${username} → id ${existingId.substring(0, 8)}...`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Criaria usuario: ${username}`);
      usernameMap.set(username, "dry-run-id");
      continue;
    }

    await db
      .insert(schema.users)
      .values({
        email,
        name: username,
        username,
        passwordHash: tempPassword,
        role: "cotador",
        photoUrl: info.profilePicture || null,
        isActive: true,
      });

    const [newUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username));

    usernameMap.set(username, newUser.id);
    emailToId.set(email, newUser.id);
    created.push(username);
    console.log(`  ✓ Usuario criado: ${username} (${email})`);
  }

  return usernameMap;
}

// ============================================================
// TASK MAPPING
// ============================================================

function mapTaskToCotacao(
  task: ClickUpTask,
  userMap: Map<string, string>,
  isRenovacao: boolean
) {
  const assigneeUsername = task.assignees?.[0]?.username;
  const assigneeId = assigneeUsername ? userMap.get(assigneeUsername) : null;

  return {
    clickupId: task.id,
    name: task.name.substring(0, 500),
    status: normalizeStatus(task.status?.status || "nao iniciado"),
    priority: normalizePriority(task.priority?.priority || null),
    dueDate: msToDate(task.due_date),
    assigneeId: assigneeId && assigneeId !== "dry-run-id" ? assigneeId : null,

    // Dropdown fields
    tipoCliente: getDropdownLabel(getCustomField(task, FIELDS.TIPO_CLIENTE)),
    situacao: getDropdownLabel(getCustomField(task, FIELDS.SITUACAO)),

    // Text fields
    seguradora: getTextValue(getCustomField(task, FIELDS.SEGURADORA)),
    produto: getDropdownLabel(getCustomField(task, FIELDS.PRODUTO)), // dropdown, not text
    indicacao: getTextValue(getCustomField(task, FIELDS.INDICACAO)),
    contatoCliente: null, // Not available as a standard custom field in ClickUp

    // Date fields
    inicioVigencia: getDateValue(getCustomField(task, FIELDS.INICIO_VIGENCIA)),
    fimVigencia: getDateValue(getCustomField(task, FIELDS.FIM_VIGENCIA)),
    primeiroPagamento: getDateValue(getCustomField(task, FIELDS.PRIMEIRO_PAGAMENTO)),
    proximaTratativa: getDateValue(getCustomField(task, FIELDS.PROXIMA_TRATATIVA)),

    // Numeric fields
    parceladoEm: getIntValue(getCustomField(task, FIELDS.PARCELADO_EM)),
    premioSemIof: getCurrencyValue(getCustomField(task, FIELDS.PREMIO_SEM_IOF)),
    comissao: getComissaoValue(getCustomField(task, FIELDS.COMISSAO)),
    aReceber: getCurrencyValue(getCustomField(task, FIELDS.A_RECEBER)),
    valorPerda: getCurrencyValue(getCustomField(task, FIELDS.VALOR_PERDA)),

    // Derived fields
    mesReferencia: getMesReferencia(task),
    anoReferencia: getAnoReferencia(task),

    // Meta
    tags: task.tags?.map((t) => t.name) || [],
    isRenovacao,
    observacao: getTextValue(getCustomField(task, FIELDS.OBSERVACAO)) || task.description?.substring(0, 5000) || null,
  };
}

// ============================================================
// UPSERT
// ============================================================

async function upsertCotacao(
  data: ReturnType<typeof mapTaskToCotacao>
): Promise<"inserted" | "updated" | "skipped"> {
  // Check if exists
  const existing = await db
    .select({ id: schema.cotacoes.id })
    .from(schema.cotacoes)
    .where(eq(schema.cotacoes.clickupId, data.clickupId!));

  if (existing.length > 0) {
    // Update
    await db
      .update(schema.cotacoes)
      .set({
        name: data.name,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId,
        tipoCliente: data.tipoCliente,
        situacao: data.situacao,
        seguradora: data.seguradora,
        produto: data.produto,
        indicacao: data.indicacao,
        // contatoCliente: preservado — campo exclusivo do CRM
        inicioVigencia: data.inicioVigencia,
        fimVigencia: data.fimVigencia,
        primeiroPagamento: data.primeiroPagamento,
        proximaTratativa: data.proximaTratativa,
        parceladoEm: data.parceladoEm,
        premioSemIof: data.premioSemIof,
        comissao: data.comissao,
        aReceber: data.aReceber,
        valorPerda: data.valorPerda,
        mesReferencia: data.mesReferencia,
        anoReferencia: data.anoReferencia,
        tags: data.tags,
        isRenovacao: data.isRenovacao,
        observacao: data.observacao,
      })
      .where(eq(schema.cotacoes.clickupId, data.clickupId!));
    return "updated";
  }

  // Insert
  await db.insert(schema.cotacoes).values(data);
  return "inserted";
}

// ============================================================
// MAIN
// ============================================================

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const report: MigrationReport = {
    startedAt: new Date().toISOString(),
    source: "ClickUp API v2",
    taskLimit: TASK_LIMIT,
    totalExtracted: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalErrors: 0,
    usersCreated: [],
    errors: [],
    statusBreakdown: {},
    financialSummary: {
      totalAReceber: 0,
      totalValorPerda: 0,
      totalPremio: 0,
      totalComissao: 0,
    },
  };

  console.log("=".repeat(60));
  console.log("  MIGRAÇÃO CLICKUP → MySQL");
  console.log(`  Fonte: ${FROM_BACKUP ? `Backup JSON (${FROM_BACKUP})` : "ClickUp API"}`);
  console.log(`  Limite: ${TASK_LIMIT || "TODAS"} tasks`);
  console.log(`  Modo: ${DRY_RUN ? "DRY-RUN (sem escrita)" : "PRODUÇÃO"}`);
  console.log("=".repeat(60));

  let allTasks: ClickUpTask[];
  let cotacoesCount: number;

  if (FROM_BACKUP) {
    // ── Load from backup JSON ──
    console.log(`\n📂 Carregando tasks do backup: ${FROM_BACKUP}`);
    const raw = readFileSync(FROM_BACKUP, "utf-8");
    let loaded: ClickUpTask[] = JSON.parse(raw);

    // Filter only COTAÇÕES list tasks (ignore PEDIDOS, WEEKLY PLANNER, etc.)
    const beforeFilter = loaded.length;
    loaded = loaded.filter((t: any) => t.list?.id === COTACOES_LIST_ID);
    console.log(`  Total no arquivo: ${beforeFilter} | Filtradas (COTAÇÕES): ${loaded.length}`);

    if (TASK_LIMIT > 0) {
      loaded = loaded.slice(0, TASK_LIMIT);
      console.log(`  Limite aplicado: ${loaded.length}`);
    }

    allTasks = loaded;
    cotacoesCount = allTasks.length; // All are cotações from backup
    report.source = `Backup JSON: ${FROM_BACKUP}`;
  } else {
    // ── Fetch from ClickUp API ──
    if (!CLICKUP_TOKEN) {
      console.error("CLICKUP_API_TOKEN nao definido em .env.local (necessario sem --from-backup)");
      await pool.end();
      process.exit(1);
    }

    console.log("\n📥 Extraindo tasks da lista Cotações...");
    const cotacoesTasks = await fetchClickUpTasks(LIST_ID, TASK_LIMIT);
    console.log(`  Total extraido (Cotações): ${cotacoesTasks.length}`);
    cotacoesCount = cotacoesTasks.length;

    let renovacaoTasks: ClickUpTask[] = [];
    const remaining = TASK_LIMIT > 0 ? TASK_LIMIT - cotacoesTasks.length : 0;

    if (TASK_LIMIT === 0 || remaining > 0) {
      console.log("\n📥 Extraindo tasks do Space Renovação...");
      renovacaoTasks = await fetchRenovacaoTasks(
        RENOV_SPACE_ID,
        RENOV_TEAM_ID,
        TASK_LIMIT,
        cotacoesTasks.length
      );
      console.log(`  Total extraido (Renovação): ${renovacaoTasks.length}`);
    }

    allTasks = [...cotacoesTasks, ...renovacaoTasks];

    // Save backup JSON
    console.log("\n💾 Salvando backup JSON...");
    mkdirSync("data", { recursive: true });
    const backupFile = `data/clickup-backup-${new Date().toISOString().split("T")[0]}.json`;
    writeFileSync(backupFile, JSON.stringify(allTasks, null, 2));
    console.log(`  Backup salvo em: ${backupFile} (${allTasks.length} tasks)`);
  }

  report.totalExtracted = allTasks.length;
  console.log(`\n📊 Total de tasks a migrar: ${allTasks.length}`);

  // ── Step 4: Create/find users ──
  console.log("\n👤 Processando usuarios...");
  const userMap = await getOrCreateUsers(allTasks);

  // ── Step 5: Migrate tasks ──
  console.log(`\n🔄 Migrando ${allTasks.length} tasks...`);

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    const isRenovacao = i >= cotacoesCount; // Tasks after cotações are renovações
    const progress = `[${i + 1}/${allTasks.length}]`;

    try {
      const mapped = mapTaskToCotacao(task, userMap, isRenovacao);

      // Track status
      report.statusBreakdown[mapped.status] =
        (report.statusBreakdown[mapped.status] || 0) + 1;

      // Track financials
      report.financialSummary.totalAReceber += parseFloat(mapped.aReceber || "0");
      report.financialSummary.totalValorPerda += parseFloat(mapped.valorPerda || "0");
      report.financialSummary.totalPremio += parseFloat(mapped.premioSemIof || "0");
      report.financialSummary.totalComissao += parseFloat(mapped.comissao || "0");

      if (DRY_RUN) {
        console.log(`  ${progress} [DRY-RUN] ${task.name.substring(0, 60)} (${mapped.status})`);
        report.totalSkipped++;
        continue;
      }

      const result = await upsertCotacao(mapped);

      if (result === "inserted") {
        report.totalInserted++;
        console.log(`  ${progress} ✓ INSERT: ${task.name.substring(0, 50)} (${mapped.status})`);
      } else {
        report.totalUpdated++;
        console.log(`  ${progress} ↻ UPDATE: ${task.name.substring(0, 50)} (${mapped.status})`);
      }
    } catch (err: any) {
      report.totalErrors++;
      report.errors.push({
        taskId: task.id,
        name: task.name,
        error: err.message,
      });
      console.error(`  ${progress} ✗ ERRO: ${task.name.substring(0, 50)} — ${err.message}`);
    }
  }

  // ── Step 6: Generate report ──
  report.finishedAt = new Date().toISOString();

  console.log("\n" + "=".repeat(60));
  console.log("  RELATÓRIO DE MIGRAÇÃO");
  console.log("=".repeat(60));
  console.log(`  Inicio:     ${report.startedAt}`);
  console.log(`  Fim:        ${report.finishedAt}`);
  console.log(`  Extraidas:  ${report.totalExtracted}`);
  console.log(`  Inseridas:  ${report.totalInserted}`);
  console.log(`  Atualizadas:${report.totalUpdated}`);
  console.log(`  Erros:      ${report.totalErrors}`);
  console.log(`\n  Status breakdown:`);
  for (const [status, count] of Object.entries(report.statusBreakdown).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`    ${status}: ${count}`);
  }
  console.log(`\n  Resumo financeiro:`);
  console.log(`    A Receber:     R$ ${report.financialSummary.totalAReceber.toFixed(2)}`);
  console.log(`    Valor Perda:   R$ ${report.financialSummary.totalValorPerda.toFixed(2)}`);
  console.log(`    Prêmio s/ IOF: R$ ${report.financialSummary.totalPremio.toFixed(2)}`);
  console.log(`    Comissão:      R$ ${report.financialSummary.totalComissao.toFixed(2)}`);

  if (report.errors.length > 0) {
    console.log(`\n  Erros:`);
    for (const e of report.errors) {
      console.log(`    - [${e.taskId}] ${e.name}: ${e.error}`);
    }
  }

  // Save report
  const reportFile = `data/migration-report-${new Date().toISOString().split("T")[0]}.json`;
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n  Relatório salvo em: ${reportFile}`);
  console.log("=".repeat(60));

  if (report.totalErrors > 0) {
    await pool.end();
    process.exit(1);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n💥 Erro fatal:", err);
  await pool.end();
  process.exit(1);
});
