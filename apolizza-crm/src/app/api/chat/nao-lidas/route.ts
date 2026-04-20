import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/chat/nao-lidas — unread count + current user info (used for ChatGlobal init)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const rows = await dbQuery(sql`
      SELECT CAST(COUNT(*) AS SIGNED) as count
      FROM chat_mensagens m
      WHERE
        m.from_user_id != ${user.id}
        AND (
          m.to_user_id = ${user.id}
          OR m.to_user_id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM chat_leituras l
          WHERE l.mensagem_id = m.id AND l.user_id = ${user.id}
        )
    `);

    const count = Number(rows[0].count ?? 0);

    return apiSuccess({
      count,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        photoUrl: user.image ?? null,
      },
    });
  } catch (error) {
    console.error("GET /api/chat/nao-lidas:", error);
    return apiError("Erro interno", 500);
  }
}
