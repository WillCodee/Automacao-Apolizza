import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { sendTelegram, fmtAtrasado } from "@/lib/telegram";

// POST/GET /api/cron/atrasados
// Protected by CRON_SECRET header (Vercel Cron chama GET)
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    if (!cronSecret) {
      return apiError("CRON_SECRET nao configurado no servidor", 500);
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return apiError("Nao autorizado", 401);
    }

    // Mark cotações as "atrasado" when:
    // - due_date < now
    // - status is not terminal (fechado, perda, concluido ocultar)
    // - not already "atrasado"
    // - not soft deleted
    const result = await db.execute(sql`
      UPDATE cotacoes
      SET status = 'atrasado', updated_at = now()
      WHERE deleted_at IS NULL
        AND due_date < now()
        AND status NOT IN ('fechado', 'perda', 'concluido ocultar', 'atrasado')
      RETURNING id, name, assignee_id, status
    `);

    const updated = result.rows as { id: string; name: string; assignee_id: string | null; status: string }[];

    // Cria notificações para admins/proprietários sobre cotações atrasadas
    if (updated.length > 0) {
      const notifs = updated.map((c) => ({
        cotacaoId: c.id,
        cotacaoNome: c.name,
        autorId: null as string | null,
        autorNome: "Sistema",
        tipo: "atrasado",
        texto: `Cotação "${c.name}" passou do prazo e foi marcada como atrasada.`,
        destinatarioId: null as string | null, // null = visível a todos admin/proprietario
        lida: false,
      }));

      await db.insert(cotacaoNotificacoes).values(notifs);

      // Envia ao Telegram imediatamente
      const telegramRows = updated.map((c) => ({
        id: c.id, name: c.name, due_date: "", assignee_name: null,
      }));
      await sendTelegram(fmtAtrasado(telegramRows));
    }

    return apiSuccess({
      message: `${updated.length} cotacao(oes) marcada(s) como atrasado`,
      updated,
    });
  } catch (error) {
    console.error("API POST /api/cron/atrasados:", error);
    return apiError("Erro ao executar cron de atrasados", 500);
  }
}
