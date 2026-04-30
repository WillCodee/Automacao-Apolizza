import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes, cotacaoHistory } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { notifyWithFallback, fmtAtrasado } from "@/lib/telegram";

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

    // Marca atrasado_desde = CURDATE() em cotacoes vencidas que nao estao em status
    // terminal e ainda nao tinham a flag setada. Status real e preservado.
    const novasAtrasadas = await dbQuery<{ id: string; name: string; assignee_id: string | null; status: string }>(sql`
      SELECT id, name, assignee_id, status
      FROM cotacoes
      WHERE deleted_at IS NULL
        AND atrasado_desde IS NULL
        AND due_date < CURDATE()
        AND status NOT IN ('fechado', 'perda', 'concluido ocultar')
    `);

    if (novasAtrasadas.length > 0) {
      const ids = novasAtrasadas.map((c) => c.id);
      await db.execute(sql`
        UPDATE cotacoes
        SET atrasado_desde = CURDATE(), updated_at = NOW()
        WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      `);

      // Audit trail (D4)
      await db.insert(cotacaoHistory).values(
        novasAtrasadas.map((c) => ({
          cotacaoId: c.id,
          userId: null,
          fieldName: "atrasado_desde",
          oldValue: null,
          newValue: new Date().toISOString().slice(0, 10),
        }))
      );

      await db.insert(cotacaoNotificacoes).values(
        novasAtrasadas.map((c) => ({
          cotacaoId: c.id,
          cotacaoNome: c.name,
          autorId: null as string | null,
          autorNome: "Sistema",
          tipo: "atrasado",
          texto: `Cotacao "${c.name}" passou do prazo (status real: ${c.status}).`,
          destinatarioId: null as string | null,
          lida: false,
        }))
      );

      const telegramRows = novasAtrasadas.map((c) => ({
        id: c.id, name: c.name, due_date: "", assignee_name: null,
      }));
      const atrasadoText = fmtAtrasado(telegramRows);
      await notifyWithFallback(
        atrasadoText,
        `${novasAtrasadas.length} cotação(ões) atrasada(s)`,
        `<h2>Cotações Atrasadas</h2><p>${novasAtrasadas.map((c) => c.name).join(", ")}</p>`,
      );
    }

    // Limpa flag de cotacoes que voltaram a estar em dia ou viraram terminais
    const desmarcadas = await dbQuery<{ id: string }>(sql`
      SELECT id FROM cotacoes
      WHERE deleted_at IS NULL
        AND atrasado_desde IS NOT NULL
        AND (status IN ('fechado', 'perda', 'concluido ocultar') OR due_date >= CURDATE() OR due_date IS NULL)
    `);
    if (desmarcadas.length > 0) {
      const ids = desmarcadas.map((d) => d.id);
      await db.execute(sql`
        UPDATE cotacoes
        SET atrasado_desde = NULL, updated_at = NOW()
        WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      `);
      await db.insert(cotacaoHistory).values(
        desmarcadas.map((d) => ({
          cotacaoId: d.id,
          userId: null,
          fieldName: "atrasado_desde",
          oldValue: "(set)",
          newValue: null,
        }))
      );
    }

    return apiSuccess({
      message: `${novasAtrasadas.length} marcada(s); ${desmarcadas.length} desmarcada(s)`,
      novasAtrasadas: novasAtrasadas.length,
      desmarcadas: desmarcadas.length,
    });
  } catch (error) {
    console.error("API POST /api/cron/atrasados:", error);
    return apiError("Erro ao executar cron de atrasados", 500);
  }
}
