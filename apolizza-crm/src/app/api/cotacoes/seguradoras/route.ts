import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const rows = await dbQuery<{ seguradora: string }>(sql`
      SELECT DISTINCT seguradora
      FROM cotacoes
      WHERE seguradora IS NOT NULL
        AND seguradora != ''
        AND deleted_at IS NULL
      ORDER BY seguradora
    `);

    const seguradoras = rows.map((r) => r.seguradora);

    return apiSuccess(seguradoras);
  } catch (error) {
    console.error("API GET /api/cotacoes/seguradoras:", error);
    return apiError("Erro ao listar seguradoras", 500);
  }
}
