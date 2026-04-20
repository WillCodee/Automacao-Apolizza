import { getCurrentUser } from "@/lib/auth-helpers";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";

interface ViewMetricas {
  por_status: Array<{ status: string; total: number }> | null;
  por_cotador: Array<{
    cotador_id: string;
    cotador_name: string;
    cotador_photo: string | null;
    total_tarefas: number;
    concluidas: number;
    pendentes: number;
    em_andamento: number;
  }> | null;
  tendencia_mensal: Array<{
    mes: string;
    criadas: number;
    concluidas: number;
  }> | null;
}

interface KPIs {
  pendentes: number;
  atrasadas: number;
  concluidasHoje: number;
  concluidasSemana: number;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError("Nao autenticado", 401);
    }

    // Query na view de metricas
    const viewResult = await dbQuery(sql`
      SELECT * FROM vw_tarefas_metricas LIMIT 1
    `);

    const metricas: ViewMetricas = viewResult[0] as unknown as ViewMetricas;

    // Calcular KPIs adicionais
    const kpisResult = await dbQuery(sql`
      SELECT
        CAST(SUM(CASE WHEN tarefa_status = 'Pendente' THEN 1 ELSE 0 END) AS SIGNED) as pendentes,
        CAST(SUM(CASE WHEN data_vencimento < NOW() AND tarefa_status != 'Concluída' AND tarefa_status != 'Cancelada' THEN 1 ELSE 0 END) AS SIGNED) as atrasadas,
        CAST(SUM(CASE WHEN tarefa_status = 'Concluída' AND DATE(updated_at) = CURDATE() THEN 1 ELSE 0 END) AS SIGNED) as concluidas_hoje,
        CAST(SUM(CASE WHEN tarefa_status = 'Concluída' AND updated_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) THEN 1 ELSE 0 END) AS SIGNED) as concluidas_semana
      FROM tarefas
    `);

    const kpis = kpisResult[0] as unknown as KPIs;

    return apiSuccess({
      por_status: metricas?.por_status || [],
      por_cotador: metricas?.por_cotador || [],
      tendencia_mensal: metricas?.tendencia_mensal || [],
      kpis: {
        pendentes: Number(kpis.pendentes) || 0,
        atrasadas: Number(kpis.atrasadas) || 0,
        concluidasHoje: Number(kpis.concluidasHoje) || 0,
        concluidasSemana: Number(kpis.concluidasSemana) || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar metricas:", error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao buscar metricas",
      500
    );
  }
}
