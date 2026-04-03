import { getCurrentUser } from "@/lib/auth-helpers";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

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
      return apiError("Não autenticado", 401);
    }

    // Query na view de métricas
    const viewResult = await sql`
      SELECT * FROM vw_tarefas_metricas LIMIT 1
    `;

    const metricas: ViewMetricas = viewResult[0] as ViewMetricas;

    // Calcular KPIs adicionais
    const kpisResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Pendente') as pendentes,
        COUNT(*) FILTER (
          WHERE data_vencimento < NOW()
          AND status != 'Concluída'
          AND status != 'Cancelada'
        ) as atrasadas,
        COUNT(*) FILTER (
          WHERE status = 'Concluída'
          AND DATE(updated_at) = CURRENT_DATE
        ) as concluidas_hoje,
        COUNT(*) FILTER (
          WHERE status = 'Concluída'
          AND updated_at >= DATE_TRUNC('week', NOW())
        ) as concluidas_semana
      FROM tarefas
    `;

    const kpis = kpisResult[0] as KPIs;

    return apiSuccess({
      por_status: metricas.por_status || [],
      por_cotador: metricas.por_cotador || [],
      tendencia_mensal: metricas.tendencia_mensal || [],
      kpis: {
        pendentes: Number(kpis.pendentes) || 0,
        atrasadas: Number(kpis.atrasadas) || 0,
        concluidasHoje: Number(kpis.concluidasHoje) || 0,
        concluidasSemana: Number(kpis.concluidasSemana) || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao buscar métricas",
      500
    );
  }
}
