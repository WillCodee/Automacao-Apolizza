import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";

const pool = mysql.createPool(process.env.DATABASE_URL!);

async function createViews() {
  // View: KPIs globais por ano/mês — usa situacao para fechadas/perdas
  await pool.query(`
    CREATE OR REPLACE VIEW vw_kpis AS
    SELECT
      ano_referencia AS ano,
      mes_referencia AS mes,
      assignee_id,
      CAST(COUNT(*) AS SIGNED) AS total_cotacoes,
      CAST(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
      CAST(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
      CAST(SUM(CASE WHEN LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL THEN 1 ELSE 0 END) AS SIGNED) AS em_andamento,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_a_receber,
      COALESCE(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_valor_perda,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(premio_sem_iof AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_premio,
      ROUND(
        SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0) * 100, 1
      ) AS taxa_conversao
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id
  `);
  console.log("vw_kpis criada");

  // View: Status breakdown — mantém status para o gráfico de análise por status
  await pool.query(`
    CREATE OR REPLACE VIEW vw_status_breakdown AS
    SELECT
      ano_referencia AS ano,
      mes_referencia AS mes,
      assignee_id,
      status,
      CAST(COUNT(*) AS SIGNED) AS count,
      CASE
        WHEN status = 'perda'
        THEN COALESCE(SUM(CAST(valor_perda AS DECIMAL(12,2))), 0)
        ELSE COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0)
      END AS total
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id, status
  `);
  console.log("vw_status_breakdown criada");

  // View: Desempenho por cotador — usa situacao para fechadas/perdas/faturamento
  await pool.query(`DROP VIEW IF EXISTS vw_cotadores`);
  await pool.query(`
    CREATE OR REPLACE VIEW vw_cotadores AS
    SELECT
      u.id AS user_id,
      u.name,
      u.photo_url,
      c.ano_referencia AS ano,
      c.mes_referencia AS mes,
      CAST(COUNT(c.id) AS SIGNED) AS total_cotacoes,
      CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
      CAST(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
      COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS faturamento,
      ROUND(
        SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END)
        / NULLIF(COUNT(c.id), 0) * 100, 1
      ) AS taxa_conversao
    FROM users u
    LEFT JOIN cotacoes c ON c.assignee_id = u.id AND c.deleted_at IS NULL
    WHERE u.is_active = true AND u.role = 'cotador'
    GROUP BY u.id, u.name, u.photo_url, c.ano_referencia, c.mes_referencia
  `);
  console.log("vw_cotadores criada");

  // View: Monthly trend — usa situacao para fechadas/perdas
  await pool.query(`
    CREATE OR REPLACE VIEW vw_monthly_trend AS
    SELECT
      ano_referencia AS ano,
      mes_referencia AS mes,
      assignee_id,
      CAST(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
      CAST(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
      CAST(COUNT(*) AS SIGNED) AS total,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS a_receber
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id
  `);
  console.log("vw_monthly_trend criada");

  console.log("\nTodas as views criadas com sucesso!");
  await pool.end();
}

createViews().catch(console.error);
