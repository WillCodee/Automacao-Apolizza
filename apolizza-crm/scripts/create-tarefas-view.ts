import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function createTarefasMetricasView() {
  console.log("🔨 Criando SQL View: vw_tarefas_metricas");

  try {
    // Drop view se já existir
    await sql`DROP VIEW IF EXISTS vw_tarefas_metricas CASCADE`;

    // Criar view com métricas agregadas
    await sql`
      CREATE VIEW vw_tarefas_metricas AS
      WITH tarefas_por_status AS (
        SELECT
          status,
          COUNT(*) as total
        FROM tarefas
        GROUP BY status
      ),
      tarefas_por_cotador AS (
        SELECT
          u.id as cotador_id,
          u.name as cotador_name,
          u.photo_url as cotador_photo,
          COUNT(t.id) as total_tarefas,
          COUNT(CASE WHEN t.status = 'Concluída' THEN 1 END) as concluidas,
          COUNT(CASE WHEN t.status = 'Pendente' THEN 1 END) as pendentes,
          COUNT(CASE WHEN t.status = 'Em Andamento' THEN 1 END) as em_andamento
        FROM users u
        LEFT JOIN tarefas t ON t.cotador_id = u.id
        WHERE u.role = 'cotador'
        GROUP BY u.id, u.name, u.photo_url
      ),
      tendencia_mensal AS (
        SELECT
          DATE_TRUNC('month', created_at) as mes,
          COUNT(*) as criadas,
          COUNT(CASE WHEN status = 'Concluída' THEN 1 END) as concluidas
        FROM tarefas
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY mes DESC
      )
      SELECT
        (SELECT json_agg(row_to_json(tarefas_por_status)) FROM tarefas_por_status) as por_status,
        (SELECT json_agg(row_to_json(tarefas_por_cotador)) FROM tarefas_por_cotador) as por_cotador,
        (SELECT json_agg(row_to_json(tendencia_mensal)) FROM tendencia_mensal) as tendencia_mensal;
    `;

    console.log("✅ View vw_tarefas_metricas criada com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao criar view:", error);
    throw error;
  }
}

createTarefasMetricasView()
  .then(() => {
    console.log("✅ Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script falhou:", error);
    process.exit(1);
  });
