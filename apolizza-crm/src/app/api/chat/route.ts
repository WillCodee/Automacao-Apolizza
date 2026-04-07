import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMensagens } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod/v4";

// GET /api/chat — returns list of conversations for current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    // ── Broadcast conversation ("Todos") ──────────────────────────────
    const broadcastLast = await db.execute(sql`
      SELECT
        cm.id,
        cm.texto,
        cm.created_at as "createdAt",
        u.name as "fromUserName"
      FROM chat_mensagens cm
      JOIN users u ON u.id = cm.from_user_id
      WHERE cm.to_user_id IS NULL
      ORDER BY cm.created_at DESC
      LIMIT 1
    `);

    const broadcastNaoLidas = await db.execute(sql`
      SELECT COUNT(cm.id)::int as count
      FROM chat_mensagens cm
      WHERE cm.to_user_id IS NULL
        AND cm.from_user_id != ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM chat_leituras cl
          WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
        )
    `);

    // ── Direct conversations ──────────────────────────────────────────
    const directResult = await db.execute(sql`
      SELECT
        sub.other_user_id as "otherUserId",
        u.name as "otherUserName",
        u.photo_url as "otherUserPhoto",
        sub.last_texto as "lastTexto",
        sub.last_created_at as "lastCreatedAt",
        sub.last_from_user_id as "lastFromUserId",
        sub.nao_lidas as "naoLidas"
      FROM (
        SELECT
          CASE WHEN cm.from_user_id = ${user.id}
            THEN cm.to_user_id
            ELSE cm.from_user_id
          END as other_user_id,
          (array_agg(cm.texto ORDER BY cm.created_at DESC))[1] as last_texto,
          MAX(cm.created_at) as last_created_at,
          (array_agg(cm.from_user_id ORDER BY cm.created_at DESC))[1] as last_from_user_id,
          COUNT(CASE WHEN
            cm.from_user_id != ${user.id}
            AND NOT EXISTS (
              SELECT 1 FROM chat_leituras cl
              WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
            )
          THEN 1 END)::int as nao_lidas
        FROM chat_mensagens cm
        WHERE cm.to_user_id IS NOT NULL
          AND (cm.from_user_id = ${user.id} OR cm.to_user_id = ${user.id})
        GROUP BY
          CASE WHEN cm.from_user_id = ${user.id}
            THEN cm.to_user_id
            ELSE cm.from_user_id
          END
      ) sub
      JOIN users u ON u.id = sub.other_user_id
      ORDER BY sub.last_created_at DESC
    `);

    const lastBroadcast = broadcastLast.rows[0] as Record<string, unknown> | undefined;
    const broadcastCount = Number((broadcastNaoLidas.rows[0] as Record<string, unknown>).count ?? 0);

    return apiSuccess({
      todos: {
        lastTexto: lastBroadcast?.texto ?? null,
        lastCreatedAt: lastBroadcast?.createdAt ?? null,
        lastFromUserName: lastBroadcast?.fromUserName ?? null,
        naoLidas: broadcastCount,
      },
      diretas: directResult.rows,
    });
  } catch (error) {
    console.error("GET /api/chat:", error);
    return apiError("Erro ao carregar conversas", 500);
  }
}

const sendSchema = z.object({
  texto: z.string().min(1).max(2000),
  toUserId: z.string().nullable().optional(),
});

// POST /api/chat — send a message
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return apiError("Dados invalidos", 400);

    const { texto, toUserId } = parsed.data;

    const [nova] = await db
      .insert(chatMensagens)
      .values({
        fromUserId: user.id,
        toUserId: toUserId ?? null,
        texto,
      })
      .returning();

    return apiSuccess(nova, 201);
  } catch (error) {
    console.error("POST /api/chat:", error);
    return apiError("Erro ao enviar mensagem", 500);
  }
}
