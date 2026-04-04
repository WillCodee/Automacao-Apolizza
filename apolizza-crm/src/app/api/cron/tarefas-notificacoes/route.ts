import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  sendAlertEmail,
  getAdminEmails,
  buildNovaTarefaHtml,
  buildTarefaAtrasadaHtml,
  buildTarefaConcluidaHtml
} from "@/lib/email";

// ─── Tipos ──────────────────────────────────────────────────────

interface TarefaRow extends Record<string, unknown> {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  status: string;
  cotador_id: string;
  cotador_name: string;
  cotador_email: string;
  criador_name: string;
}

// ─── Handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  console.log("[cron:tarefas-notificacoes] Iniciando processamento...");

  const results = {
    novasTarefas: 0,
    tarefasAtrasadas: 0,
    tarefasConcluidas: 0,
    emailsEnviados: 0,
    emailsFalharam: 0,
  };

  try {
    // 1️⃣ Tarefas criadas hoje → email para cotador
    const novasTarefasResult = await db.execute<TarefaRow>(sql`
      SELECT
        t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
        u.name as cotador_name, u.email as cotador_email,
        criador.name as criador_name
      FROM tarefas t
      JOIN users u ON t.cotador_id = u.id
      JOIN users criador ON t.criador_id = criador.id
      WHERE t.created_at::date = NOW()::date
        AND u.is_active = true
    `);

    for (const tarefa of novasTarefasResult.rows) {
      const html = buildNovaTarefaHtml(tarefa);
      const result = await sendAlertEmail({
        to: tarefa.cotador_email,
        subject: `🆕 Nova Tarefa: ${tarefa.titulo}`,
        html,
      });

      if (result.success) {
        results.emailsEnviados++;
      } else {
        results.emailsFalharam++;
      }
      results.novasTarefas++;
    }

    console.log(`[cron:tarefas-notificacoes] ✅ ${results.novasTarefas} novas tarefas processadas`);

    // 2️⃣ Tarefas atrasadas → email para cotador + gestor
    const tarefasAtrasadasResult = await db.execute<TarefaRow>(sql`
      SELECT
        t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
        u.name as cotador_name, u.email as cotador_email,
        criador.name as criador_name
      FROM tarefas t
      JOIN users u ON t.cotador_id = u.id
      JOIN users criador ON t.criador_id = criador.id
      WHERE t.data_vencimento < NOW()
        AND t.status NOT IN ('Concluída', 'Cancelada')
        AND u.is_active = true
    `);

    const admins = await getAdminEmails();

    for (const tarefa of tarefasAtrasadasResult.rows) {
      const html = buildTarefaAtrasadaHtml(tarefa);
      const recipients = [tarefa.cotador_email, ...admins];

      const result = await sendAlertEmail({
        to: recipients,
        subject: `⚠️ Tarefa Atrasada: ${tarefa.titulo}`,
        html,
      });

      if (result.success) {
        results.emailsEnviados++;
      } else {
        results.emailsFalharam++;
      }
      results.tarefasAtrasadas++;
    }

    console.log(`[cron:tarefas-notificacoes] ⚠️  ${results.tarefasAtrasadas} tarefas atrasadas processadas`);

    // 3️⃣ Tarefas concluídas hoje → email para gestor
    const tarefasConcluidasResult = await db.execute<TarefaRow>(sql`
      SELECT
        t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
        u.name as cotador_name, u.email as cotador_email,
        criador.name as criador_name
      FROM tarefas t
      JOIN users u ON t.cotador_id = u.id
      JOIN users criador ON t.criador_id = criador.id
      WHERE t.updated_at::date = NOW()::date
        AND t.status = 'Concluída'
        AND u.is_active = true
    `);

    for (const tarefa of tarefasConcluidasResult.rows) {
      const html = buildTarefaConcluidaHtml(tarefa);

      const result = await sendAlertEmail({
        to: admins,
        subject: `✅ Tarefa Concluída: ${tarefa.titulo}`,
        html,
      });

      if (result.success) {
        results.emailsEnviados++;
      } else {
        results.emailsFalharam++;
      }
      results.tarefasConcluidas++;
    }

    console.log(`[cron:tarefas-notificacoes] ✅ ${results.tarefasConcluidas} tarefas concluídas processadas`);

    console.log(
      `[cron:tarefas-notificacoes] 📧 ${results.emailsEnviados} emails enviados, ${results.emailsFalharam} falharam`
    );

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[cron:tarefas-notificacoes] Erro:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        ...results,
      },
      { status: 500 }
    );
  }
}
