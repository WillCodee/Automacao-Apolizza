import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

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
      RETURNING id, name, status
    `);

    const updated = result.rows;

    return apiSuccess({
      message: `${updated.length} cotacao(oes) marcada(s) como atrasado`,
      updated,
    });
  } catch (error) {
    console.error("API POST /api/cron/atrasados:", error);
    return apiError("Erro ao executar cron de atrasados", 500);
  }
}
