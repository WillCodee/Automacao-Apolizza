import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role === "cotador") return apiError("Acesso negado", 403);

    const ano = new Date().getFullYear();

    // Cotacoes agrupadas por usuario
    const byUserData = await dbQuery(sql`
      SELECT
        c.id, c.name, c.status, c.situacao, c.produto,
        c.a_receber, c.valor_perda, c.priority,
        u.id as assignee_id, u.name as assignee_name, u.photo_url as assignee_photo
      FROM cotacoes c
      LEFT JOIN users u ON u.id = c.assignee_id
      WHERE c.deleted_at IS NULL
        AND (c.ano_referencia = ${ano} OR c.ano_referencia IS NULL)
      ORDER BY c.created_at DESC
      LIMIT 500
    `);

    // Grupos e membros
    const groupData = await dbQuery(sql`
      SELECT
        g.id as grupo_id, g.nome as grupo_nome, g.cor as grupo_cor,
        gm.user_id
      FROM grupos_usuarios g
      JOIN grupo_membros gm ON gm.grupo_id = g.id
    `);

    // Map userId -> groupIds
    const userToGroups = new Map<string, string[]>();
    const groupMeta = new Map<string, { nome: string; cor: string | null }>();

    for (const row of groupData as Array<{ grupo_id: string; grupo_nome: string; grupo_cor: string | null; user_id: string }>) {
      if (!userToGroups.has(row.user_id)) userToGroups.set(row.user_id, []);
      userToGroups.get(row.user_id)!.push(row.grupo_id);
      if (!groupMeta.has(row.grupo_id)) {
        groupMeta.set(row.grupo_id, { nome: row.grupo_nome, cor: row.grupo_cor });
      }
    }

    type CotRow = {
      id: string; name: string; status: string; situacao: string | null;
      produto: string | null; a_receber: string | null; valor_perda: string | null;
      priority: string | null; assignee_id: string | null; assignee_name: string | null;
      assignee_photo: string | null;
    };

    const byUser: Record<string, { name: string; photo: string | null; cotacoes: unknown[]; fechadas: number; perdas: number }> = {};
    const byGroup: Record<string, { name: string; color: string | null; cotacoes: unknown[]; fechadas: number; perdas: number }> = {};

    for (const r of byUserData as CotRow[]) {
      const userId = r.assignee_id || "sem_responsavel";
      const userName = r.assignee_name || "Sem Responsavel";

      if (!byUser[userId]) {
        byUser[userId] = { name: userName, photo: r.assignee_photo, cotacoes: [], fechadas: 0, perdas: 0 };
      }

      const cotacao = {
        id: r.id, name: r.name, status: r.status, situacao: r.situacao,
        produto: r.produto, aReceber: r.a_receber, valorPerda: r.valor_perda,
        assigneeName: r.assignee_name, assigneePhoto: r.assignee_photo, priority: r.priority,
        grupoNome: null,
      };

      byUser[userId].cotacoes.push(cotacao);
      if (r.status === "fechado") byUser[userId].fechadas++;
      if (r.status === "perda") byUser[userId].perdas++;

      // Tambem agrupa por grupo
      const groupIds = r.assignee_id ? (userToGroups.get(r.assignee_id) || []) : [];
      for (const gId of groupIds) {
        const meta = groupMeta.get(gId);
        if (!meta) continue;
        if (!byGroup[gId]) {
          byGroup[gId] = { name: meta.nome, color: meta.cor, cotacoes: [], fechadas: 0, perdas: 0 };
        }
        byGroup[gId].cotacoes.push({ ...cotacao, grupoNome: meta.nome });
        if (r.status === "fechado") byGroup[gId].fechadas++;
        if (r.status === "perda") byGroup[gId].perdas++;
      }
    }

    return apiSuccess({ byUser, byGroup });
  } catch (error) {
    console.error("GET /api/dashboard/kanban:", error);
    return apiError("Erro ao buscar dados do kanban", 500);
  }
}
