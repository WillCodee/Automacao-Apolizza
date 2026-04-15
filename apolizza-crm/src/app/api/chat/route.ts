import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMensagens } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod/v4";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    // ── Suporte user ─────────────────────────────────────────────────
    const suporteRows = await db.execute(sql`
      SELECT id FROM users WHERE username = 'suporte' LIMIT 1
    `);
    const suporteId = (suporteRows.rows[0] as Record<string, unknown> | undefined)?.id as string | undefined;
    const suporteSql = suporteId ? sql`AND cm.from_user_id != ${suporteId} AND cm.to_user_id != ${suporteId}` : sql``;

    // ── Broadcast ("Todos") ──────────────────────────────────────────
    const [broadcastLast, broadcastUnread] = await Promise.all([
      db.execute(sql`
        SELECT cm.texto, cm.created_at, u.name as from_user_name
        FROM chat_mensagens cm
        JOIN users u ON u.id = cm.from_user_id
        WHERE cm.to_user_id IS NULL
        ORDER BY cm.created_at DESC LIMIT 1
      `),
      db.execute(sql`
        SELECT COUNT(cm.id)::int as count
        FROM chat_mensagens cm
        WHERE cm.to_user_id IS NULL
          AND cm.from_user_id != ${user.id}
          AND NOT EXISTS (
            SELECT 1 FROM chat_leituras cl
            WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
          )
      `),
    ]);

    // ── Suporte conversation ─────────────────────────────────────────
    let suporteData = null;
    if (suporteId) {
      const [suporteConv, suporteUnread] = await Promise.all([
        db.execute(sql`
          SELECT cm.texto, cm.created_at, cm.from_user_id
          FROM chat_mensagens cm
          WHERE cm.to_user_id IS NOT NULL
            AND (
              (cm.from_user_id = ${suporteId} AND cm.to_user_id = ${user.id})
              OR (cm.from_user_id = ${user.id} AND cm.to_user_id = ${suporteId})
            )
          ORDER BY cm.created_at DESC LIMIT 1
        `),
        db.execute(sql`
          SELECT COUNT(cm.id)::int as count
          FROM chat_mensagens cm
          WHERE cm.from_user_id = ${suporteId}
            AND cm.to_user_id = ${user.id}
            AND NOT EXISTS (
              SELECT 1 FROM chat_leituras cl
              WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
            )
        `),
      ]);

      const lastMsg = suporteConv.rows[0] as Record<string, unknown> | undefined;
      suporteData = {
        userId: suporteId,
        lastTexto: lastMsg?.texto ?? null,
        lastCreatedAt: lastMsg?.created_at ?? null,
        lastFromUserId: lastMsg?.from_user_id ?? null,
        naoLidas: Number((suporteUnread.rows[0] as Record<string, unknown>)?.count ?? 0),
      };
    }

    // ── Direct conversations (excluding Suporte) ────────────────────
    const directResult = await db.execute(sql`
      WITH latest_msgs AS (
        SELECT DISTINCT ON (other_user_id)
          other_user_id,
          texto     AS last_texto,
          created_at AS last_created_at,
          from_user_id AS last_from_user_id
        FROM (
          SELECT
            CASE WHEN cm.from_user_id = ${user.id}
              THEN cm.to_user_id
              ELSE cm.from_user_id
            END AS other_user_id,
            cm.texto,
            cm.created_at,
            cm.from_user_id
          FROM chat_mensagens cm
          WHERE cm.to_user_id IS NOT NULL
            AND (cm.from_user_id = ${user.id} OR cm.to_user_id = ${user.id})
            ${suporteSql}
          ORDER BY cm.created_at DESC
        ) sub
        ORDER BY other_user_id, last_created_at DESC
      ),
      unread_counts AS (
        SELECT
          CASE WHEN cm.from_user_id = ${user.id}
            THEN cm.to_user_id
            ELSE cm.from_user_id
          END AS other_user_id,
          COUNT(cm.id)::int AS count
        FROM chat_mensagens cm
        WHERE cm.to_user_id IS NOT NULL
          AND (cm.from_user_id = ${user.id} OR cm.to_user_id = ${user.id})
          AND cm.from_user_id != ${user.id}
          ${suporteSql}
          AND NOT EXISTS (
            SELECT 1 FROM chat_leituras cl
            WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
          )
        GROUP BY CASE WHEN cm.from_user_id = ${user.id}
          THEN cm.to_user_id ELSE cm.from_user_id END
      )
      SELECT
        l.other_user_id   AS "otherUserId",
        u.name            AS "otherUserName",
        u.photo_url       AS "otherUserPhoto",
        l.last_texto      AS "lastTexto",
        l.last_created_at AS "lastCreatedAt",
        l.last_from_user_id AS "lastFromUserId",
        COALESCE(uc.count, 0)::int AS "naoLidas"
      FROM latest_msgs l
      JOIN users u ON u.id = l.other_user_id
      LEFT JOIN unread_counts uc ON uc.other_user_id = l.other_user_id
      ORDER BY l.last_created_at DESC
    `);

    const lastBc = broadcastLast.rows[0] as Record<string, unknown> | undefined;
    const bcCount = Number((broadcastUnread.rows[0] as Record<string, unknown>)?.count ?? 0);

    return apiSuccess({
      todos: {
        lastTexto: lastBc?.texto ?? null,
        lastCreatedAt: lastBc?.created_at ?? null,
        lastFromUserName: lastBc?.from_user_name ?? null,
        naoLidas: bcCount,
      },
      suporte: suporteData,
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

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return apiError("Dados invalidos", 400);

    const [nova] = await db
      .insert(chatMensagens)
      .values({ fromUserId: user.id, toUserId: parsed.data.toUserId ?? null, texto: parsed.data.texto })
      .returning();

    return apiSuccess(nova, 201);
  } catch (error) {
    console.error("POST /api/chat:", error);
    return apiError("Erro ao enviar mensagem", 500);
  }
}
