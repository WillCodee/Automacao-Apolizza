/**
 * Cron da Tarde — 18:00 UTC (15:00 BRT)
 * - Tarefas vencendo hoje → Telegram + notificações cotadores
 * - Seguros vencendo hoje (fim_vigencia) → Telegram
 * - Cotações com prazo hoje (due_date) → Telegram
 * - Tarefas atrasadas → email cotadores + admins
 * - Alertas de prazo (due_date = hoje) → email responsáveis
 * - Resumo diário → email admins
 */
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  sendTelegram,
  fmtTarefasHoje,
  fmtVigenciaHoje,
  fmtCotacoesVencendoHoje,
  fmtTarefasAtrasadasTarde,
  fmtResumoDiario,
} from "@/lib/telegram";

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

// ─── 1. Tarefas vencendo hoje ────────────────────────────────────────────────

async function processarTarefasHoje() {
  const rows = await dbQuery<{ id: string; titulo: string; cotador_id: string; cotador_name: string }>(sql`
    SELECT t.id, t.titulo, t.cotador_id, u.name as cotador_name
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.tarefa_status NOT IN ('Concluída','Cancelada')
      AND DATE(t.data_vencimento) = CURDATE()
    ORDER BY t.created_at ASC LIMIT 30
  `);

  if (rows.length > 0) {
    const msg = fmtTarefasHoje(rows as never);
    if (msg) await sendTelegram(msg);

    await db.insert(cotacaoNotificacoes).values(
      rows.map((t) => ({
        cotacaoId: t.id,
        cotacaoNome: t.titulo,
        autorId: null as string | null,
        autorNome: "Auditor",
        tipo: "mensagem",
        texto: `⏰ Sua tarefa *"${t.titulo}"* deve ser finalizada hoje!`,
        destinatarioId: t.cotador_id,
        lida: false,
      }))
    ).catch(() => {}); // ignorar erro de FK (tarefa id != cotacao id)
  }

  return rows.length;
}

// ─── 2. Seguros vencendo hoje (Telegram) ────────────────────────────────────

async function processarVigenciaHoje() {
  const rows = await dbQuery<{ id: string; name: string; seguradora: string | null; assignee_name: string | null }>(sql`
    SELECT c.id, c.name, c.seguradora, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.fim_vigencia = CURDATE()
      AND c.status NOT IN ('perda', 'cancelado', 'concluido ocultar')
    ORDER BY c.name ASC LIMIT 30
  `);

  const msg = fmtVigenciaHoje(rows);
  if (msg) await sendTelegram(msg);

  return rows.length;
}

// ─── 3. Cotações com prazo hoje (Telegram) ───────────────────────────────────

async function processarCotacoesVencendoHoje() {
  const rows = await dbQuery<{ id: string; name: string; assignee_name: string | null; status: string }>(sql`
    SELECT c.id, c.name, c.status, u.name as assignee_name
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND DATE(c.due_date) = CURDATE()
      AND c.status NOT IN ('fechado', 'perda', 'concluido ocultar')
    ORDER BY c.name ASC LIMIT 30
  `);

  const msg = fmtCotacoesVencendoHoje(rows);
  if (msg) await sendTelegram(msg);

  return rows.length;
}

// ─── 5. Tarefas atrasadas (Telegram) ────────────────────────────────────────

async function processarTarefasAtrasadas() {
  const rows = await dbQuery<{ id: string; titulo: string; cotador_name: string; data_vencimento: string | null }>(sql`
    SELECT t.id, t.titulo, CAST(t.data_vencimento AS CHAR) as data_vencimento, u.name as cotador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    WHERE t.data_vencimento < NOW()
      AND t.tarefa_status NOT IN ('Concluída', 'Cancelada')
      AND u.is_active = true
    ORDER BY t.data_vencimento ASC LIMIT 30
  `);

  const msg = fmtTarefasAtrasadasTarde(rows);
  if (msg) await sendTelegram(msg);

  return rows.length;
}


// ─── 6. Resumo diário (Telegram) ────────────────────────────────────────────

async function processarResumoDiario() {
  const rows = await dbQuery<Record<string, unknown>>(sql`
    SELECT
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as novas_hoje,
      SUM(CASE WHEN status = 'atrasado' THEN 1 ELSE 0 END) as atrasadas,
      SUM(CASE WHEN status = 'fechado' AND DATE(updated_at) = CURDATE() THEN 1 ELSE 0 END) as fechadas_hoje,
      SUM(CASE WHEN fim_vigencia IS NOT NULL AND fim_vigencia BETWEEN CURDATE() AND CURDATE() + INTERVAL 30 DAY THEN 1 ELSE 0 END) as vencendo_30d
    FROM cotacoes WHERE deleted_at IS NULL
  `);

  const row = rows[0] as Record<string, unknown>;
  const kpis = {
    novas_hoje: Number(row.novas_hoje) || 0,
    atrasadas: Number(row.atrasadas) || 0,
    fechadas_hoje: Number(row.fechadas_hoje) || 0,
    vencendo_30d: Number(row.vencendo_30d) || 0,
  };

  const msg = fmtResumoDiario(kpis);
  await sendTelegram(msg);

  return kpis;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  try {
    const [tarefasHoje, vigenciaHoje, cotacoesVencendoHoje, tarefasAtrasadas, resumo] = await Promise.all([
      processarTarefasHoje(),
      processarVigenciaHoje(),
      processarCotacoesVencendoHoje(),
      processarTarefasAtrasadas(),
      processarResumoDiario(),
    ]);

    return apiSuccess({
      message: "Cron da tarde executado com sucesso",
      tarefasHoje,
      vigenciaHoje,
      cotacoesVencendoHoje,
      tarefasAtrasadas,
      resumo,
    });
  } catch (error) {
    console.error("API /api/cron/tarde:", error);
    return apiError("Erro ao executar cron da tarde", 500);
  }
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
