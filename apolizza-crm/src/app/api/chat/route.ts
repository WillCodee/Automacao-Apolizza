import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { chatMensagens } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod/v4";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    // -- Suporte user --
    const suporteRows = await dbQuery(sql`
      SELECT id FROM users WHERE username = 'suporte' LIMIT 1
    `);
    const suporteId = (suporteRows[0] as Record<string, unknown> | undefined)?.id as string | undefined;
    const suporteSql = suporteId ? sql`AND cm.from_user_id != ${suporteId} AND cm.to_user_id != ${suporteId}` : sql``;

    // -- Broadcast ("Todos") --
    const [broadcastLastRows, broadcastUnreadRows] = await Promise.all([
      dbQuery(sql`
        SELECT cm.texto, cm.created_at, u.name as from_user_name
        FROM chat_mensagens cm
        JOIN users u ON u.id = cm.from_user_id
        WHERE cm.to_user_id IS NULL
        ORDER BY cm.created_at DESC LIMIT 1
      `),
      dbQuery(sql`
        SELECT CAST(COUNT(cm.id) AS SIGNED) as count
        FROM chat_mensagens cm
        WHERE cm.to_user_id IS NULL
          AND cm.from_user_id != ${user.id}
          AND NOT EXISTS (
            SELECT 1 FROM chat_leituras cl
            WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
          )
      `),
    ]);

    // -- Suporte conversation --
    let suporteData = null;
    if (suporteId) {
      const [suporteConvRows, suporteUnreadRows] = await Promise.all([
        dbQuery(sql`
          SELECT cm.texto, cm.created_at, cm.from_user_id
          FROM chat_mensagens cm
          WHERE cm.to_user_id IS NOT NULL
            AND (
              (cm.from_user_id = ${suporteId} AND cm.to_user_id = ${user.id})
              OR (cm.from_user_id = ${user.id} AND cm.to_user_id = ${suporteId})
            )
          ORDER BY cm.created_at DESC LIMIT 1
        `),
        dbQuery(sql`
          SELECT CAST(COUNT(cm.id) AS SIGNED) as count
          FROM chat_mensagens cm
          WHERE cm.from_user_id = ${suporteId}
            AND cm.to_user_id = ${user.id}
            AND NOT EXISTS (
              SELECT 1 FROM chat_leituras cl
              WHERE cl.mensagem_id = cm.id AND cl.user_id = ${user.id}
            )
        `),
      ]);

      const lastMsg = suporteConvRows[0] as Record<string, unknown> | undefined;
      suporteData = {
        userId: suporteId,
        lastTexto: lastMsg?.texto ?? null,
        lastCreatedAt: lastMsg?.created_at ?? null,
        lastFromUserId: lastMsg?.from_user_id ?? null,
        naoLidas: Number((suporteUnreadRows[0] as Record<string, unknown>)?.count ?? 0),
      };
    }

    // -- Direct conversations (excluding Suporte) --
    // Note: MySQL does not support DISTINCT ON, using GROUP BY with subquery instead
    const directRows = await dbQuery(sql`
      SELECT
        sub.other_user_id   AS otherUserId,
        u.name              AS otherUserName,
        u.photo_url         AS otherUserPhoto,
        sub.last_texto      AS lastTexto,
        sub.last_created_at AS lastCreatedAt,
        sub.last_from_user_id AS lastFromUserId,
        COALESCE(uc.count, 0) AS naoLidas
      FROM (
        SELECT
          other_user_id,
          SUBSTRING_INDEX(GROUP_CONCAT(texto ORDER BY created_at DESC SEPARATOR '|||'), '|||', 1) AS last_texto,
          MAX(created_at) AS last_created_at,
          SUBSTRING_INDEX(GROUP_CONCAT(from_user_id ORDER BY created_at DESC SEPARATOR '|||'), '|||', 1) AS last_from_user_id
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
        ) msgs
        GROUP BY other_user_id
      ) sub
      JOIN users u ON u.id = sub.other_user_id
      LEFT JOIN (
        SELECT
          CASE WHEN cm.from_user_id = ${user.id}
            THEN cm.to_user_id
            ELSE cm.from_user_id
          END AS other_user_id,
          CAST(COUNT(cm.id) AS SIGNED) AS count
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
      ) uc ON uc.other_user_id = sub.other_user_id
      ORDER BY sub.last_created_at DESC
    `);

    const lastBc = broadcastLastRows[0] as Record<string, unknown> | undefined;
    const bcCount = Number((broadcastUnreadRows[0] as Record<string, unknown>)?.count ?? 0);

    return apiSuccess({
      todos: {
        lastTexto: lastBc?.texto ?? null,
        lastCreatedAt: lastBc?.created_at ?? null,
        lastFromUserName: lastBc?.from_user_name ?? null,
        naoLidas: bcCount,
      },
      suporte: suporteData,
      diretas: directRows,
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

    const insertData = { fromUserId: user.id, toUserId: parsed.data.toUserId ?? null, texto: parsed.data.texto };
    await db.insert(chatMensagens).values(insertData);

    const [nova] = await db
      .select()
      .from(chatMensagens)
      .where(sql`${chatMensagens.fromUserId} = ${user.id}`)
      .orderBy(sql`${chatMensagens.createdAt} DESC`)
      .limit(1);

    return apiSuccess(nova, 201);
  } catch (error) {
    console.error("POST /api/chat:", error);
    return apiError("Erro ao enviar mensagem", 500);
  }
}
