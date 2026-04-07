import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatLeituras } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ conversaId: string }> };

// GET /api/chat/[conversaId] — messages in a conversation
// conversaId = "todos" for broadcast, or a userId for direct DMs
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { conversaId } = await params;

    let mensagens;

    if (conversaId === "todos") {
      const result = await db.execute(sql`
        SELECT
          m.id,
          m.texto,
          m.created_at as "createdAt",
          m.from_user_id as "fromUserId",
          u.name as "fromUserName",
          u.photo_url as "fromUserPhoto",
          EXISTS (
            SELECT 1 FROM chat_leituras l WHERE l.mensagem_id = m.id AND l.user_id = ${user.id}
          ) as "lida"
        FROM chat_mensagens m
        JOIN users u ON u.id = m.from_user_id
        WHERE m.to_user_id IS NULL
        ORDER BY m.created_at ASC
        LIMIT 200
      `);
      mensagens = result.rows;
    } else {
      const result = await db.execute(sql`
        SELECT
          m.id,
          m.texto,
          m.created_at as "createdAt",
          m.from_user_id as "fromUserId",
          u.name as "fromUserName",
          u.photo_url as "fromUserPhoto",
          EXISTS (
            SELECT 1 FROM chat_leituras l WHERE l.mensagem_id = m.id AND l.user_id = ${user.id}
          ) as "lida"
        FROM chat_mensagens m
        JOIN users u ON u.id = m.from_user_id
        WHERE m.to_user_id IS NOT NULL
          AND (
            (m.from_user_id = ${user.id} AND m.to_user_id = ${conversaId})
            OR (m.from_user_id = ${conversaId} AND m.to_user_id = ${user.id})
          )
        ORDER BY m.created_at ASC
        LIMIT 200
      `);
      mensagens = result.rows;
    }

    // Mark unread messages as read
    const unread = (mensagens as Record<string, unknown>[])
      .filter((m) => !m.lida && m.fromUserId !== user.id)
      .map((m) => String(m.id));

    if (unread.length > 0) {
      await db.insert(chatLeituras).values(
        unread.map((id) => ({ mensagemId: id, userId: user.id }))
      ).onConflictDoNothing();
    }

    return apiSuccess(mensagens);
  } catch (error) {
    console.error("GET /api/chat/[conversaId]:", error);
    return apiError("Erro ao carregar mensagens", 500);
  }
}
