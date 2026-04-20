import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
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

    // Mark cotacoes as "atrasado" when:
    // - due_date < now
    // - status is not terminal (fechado, perda, concluido ocultar)
    // - not already "atrasado"
    // - not soft deleted
    // MySQL does not support RETURNING, so we do UPDATE + SELECT
    await db.execute(sql`
      UPDATE cotacoes
      SET status = 'atrasado', updated_at = NOW()
      WHERE deleted_at IS NULL
        AND due_date < NOW()
        AND status NOT IN ('fechado', 'perda', 'concluido ocultar', 'atrasado')
    `);

    const updatedRows = await dbQuery(sql`
      SELECT id, name, assignee_id, status
      FROM cotacoes
      WHERE deleted_at IS NULL
        AND status = 'atrasado'
        AND updated_at >= NOW() - INTERVAL 1 MINUTE
        AND due_date < NOW()
    `);

    const updated = updatedRows as { id: string; name: string; assignee_id: string | null; status: string }[];

    // Cria notificacoes para admins/proprietarios sobre cotacoes atrasadas
    if (updated.length > 0) {
      const notifs = updated.map((c) => ({
        cotacaoId: c.id,
        cotacaoNome: c.name,
        autorId: null as string | null,
        autorNome: "Sistema",
        tipo: "atrasado",
        texto: `Cota\u00e7\u00e3o "${c.name}" passou do prazo e foi marcada como atrasada.`,
        destinatarioId: null as string | null, // null = visivel a todos admin/proprietario
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
