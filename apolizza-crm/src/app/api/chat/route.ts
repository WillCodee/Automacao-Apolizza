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

    // Broadcast conversation ("Todos")
    const broadcastResult = await db.execute(sql`
      SELECT
        m.id,
        m.texto,
        m.created_at as "createdAt",
        m.from_user_id as "fromUserId",
        u.name as "fromUserName",
        u.photo_url as "fromUserPhoto",
        COUNT(CASE WHEN
          m.from_user_id != ${user.id}
          AND NOT EXISTS (SELECT 1 FROM chat_leituras l WHERE l.mensagem_id = m.id AND l.user_id = ${user.id})
        THEN 1 END)::int as "naoLidas"
      FROM chat_mensagens m
      JOIN users u ON u.id = m.from_user_id
      WHERE m.to_user_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1
    `);

    const naoLidasBroadcast = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM chat_mensagens m
      WHERE m.to_user_id IS NULL
        AND m.from_user_id != ${user.id}
        AND NOT EXISTS (SELECT 1 FROM chat_leituras l WHERE l.mensagem_id = m.id AND l.user_id = ${user.id})
    `);

    // Direct conversations
    const directResult = await db.execute(sql`
      SELECT
        other_user_id as "otherUserId",
        u.name as "otherUserName",
        u.photo_url as "otherUserPhoto",
        last_texto as "lastTexto",
        last_created_at as "lastCreatedAt",
        last_from_user_id as "lastFromUserId",
        nao_lidas as "naoLidas"
      FROM (
        SELECT
          CASE WHEN from_user_id = ${user.id} THEN to_user_id ELSE from_user_id END as other_user_id,
          (array_agg(texto ORDER BY created_at DESC))[1] as last_texto,
          MAX(created_at) as last_created_at,
          (array_agg(from_user_id ORDER BY created_at DESC))[1] as last_from_user_id,
          COUNT(CASE WHEN
            from_user_id != ${user.id}
            AND NOT EXISTS (SELECT 1 FROM chat_leituras l WHERE l.mensagem_id = id AND l.user_id = ${user.id})
          THEN 1 END)::int as nao_lidas
        FROM chat_mensagens
        WHERE to_user_id IS NOT NULL
          AND (from_user_id = ${user.id} OR to_user_id = ${user.id})
        GROUP BY CASE WHEN from_user_id = ${user.id} THEN to_user_id ELSE from_user_id END
      ) sub
      JOIN users u ON u.id = other_user_id
      ORDER BY last_created_at DESC
    `);

    const lastBroadcast = broadcastResult.rows[0] as Record<string, unknown> | undefined;
    const broadcastCount = Number((naoLidasBroadcast.rows[0] as Record<string, unknown>).count ?? 0);

    return apiSuccess({
      todos: lastBroadcast
        ? {
            lastTexto: lastBroadcast.texto,
            lastCreatedAt: lastBroadcast.createdAt,
            lastFromUserName: lastBroadcast.fromUserName,
            naoLidas: broadcastCount,
          }
        : { lastTexto: null, lastCreatedAt: null, lastFromUserName: null, naoLidas: 0 },
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
