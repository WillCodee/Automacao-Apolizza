import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function createTarefasMetricasView() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL!,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });

  console.log("🔨 Criando SQL View: vw_tarefas_metricas");

  try {
    await pool.query(`DROP VIEW IF EXISTS vw_tarefas_metricas`);

    await pool.query(`
      CREATE VIEW vw_tarefas_metricas AS
      SELECT
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('status', status, 'total', total))
          FROM (
            SELECT status, COUNT(*) as total
            FROM tarefas
            GROUP BY status
          ) t1
        ) as por_status,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'cotador_id', cotador_id,
            'cotador_name', cotador_name,
            'cotador_photo', cotador_photo,
            'total_tarefas', total_tarefas,
            'concluidas', concluidas,
            'pendentes', pendentes,
            'em_andamento', em_andamento
          ))
          FROM (
            SELECT
              u.id as cotador_id,
              u.name as cotador_name,
              u.photo_url as cotador_photo,
              COUNT(t.id) as total_tarefas,
              SUM(CASE WHEN t.status = 'Concluída' THEN 1 ELSE 0 END) as concluidas,
              SUM(CASE WHEN t.status = 'Pendente' THEN 1 ELSE 0 END) as pendentes,
              SUM(CASE WHEN t.status = 'Em Andamento' THEN 1 ELSE 0 END) as em_andamento
            FROM users u
            LEFT JOIN tarefas t ON t.cotador_id = u.id
            WHERE u.role IN ('cotador','admin','proprietario')
              AND u.is_active = 1
              AND u.name <> 'Suporte'
            GROUP BY u.id, u.name, u.photo_url
          ) t2
        ) as por_cotador,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('mes', mes, 'criadas', criadas, 'concluidas', concluidas))
          FROM (
            SELECT
              DATE_FORMAT(created_at, '%Y-%m-01') as mes,
              COUNT(*) as criadas,
              SUM(CASE WHEN status = 'Concluída' THEN 1 ELSE 0 END) as concluidas
            FROM tarefas
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
            ORDER BY mes DESC
          ) t3
        ) as tendencia_mensal
    `);

    console.log("✅ View vw_tarefas_metricas criada com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao criar view:", error);
    throw error;
  } finally {
    await pool.end();
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
