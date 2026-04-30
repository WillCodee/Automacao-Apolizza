import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";

const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });

async function createViews() {
  await pool.execute("DROP VIEW IF EXISTS vw_cotadores, vw_kpis, vw_status_breakdown, vw_monthly_trend");
  console.log("Views antigas removidas");

  // ── vw_kpis ──────────────────────────────────────────────────────────────────
  // Usa `status` como fonte única (sincronizado com `situacao` via script).
  // Evita double-counting que ocorria ao misturar situacao + status.
  await pool.execute(`
    CREATE VIEW vw_kpis AS
    SELECT
      ano_referencia AS ano,
      UPPER(mes_referencia) AS mes,
      assignee_id,

      -- Totais (novas + renovações)
      count(*)+0 AS total_cotacoes,
      SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END)+0 AS fechadas,
      SUM(CASE WHEN status = 'perda' THEN 1 ELSE 0 END)+0 AS perdas,
      SUM(CASE WHEN status NOT IN ('fechado','perda') THEN 1 ELSE 0 END)+0 AS em_andamento,
      SUM(CASE WHEN atrasado_desde IS NOT NULL THEN 1 ELSE 0 END)+0 AS atrasadas,
      COALESCE(SUM(CASE WHEN status = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS total_a_receber,
      COALESCE(SUM(CASE WHEN status NOT IN ('fechado','perda') THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS total_pipeline,
      COALESCE(SUM(CASE WHEN status <> 'perda' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS total_a_receber_total,
      COALESCE(SUM(CASE WHEN status = 'perda' THEN CAST(valor_perda AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS total_valor_perda,
      COALESCE(SUM(CASE WHEN status = 'fechado' THEN CAST(premio_sem_iof AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS total_premio,
      ROUND(
        SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END)
        / NULLIF(count(*), 0) * 100, 1
      )+0 AS taxa_conversao,

      -- Renovações (tipo_cliente = 'RENOVAÇÃO' ou is_renovacao = true)
      SUM(CASE WHEN UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1 THEN 1 ELSE 0 END)+0 AS total_renovacoes,
      SUM(CASE WHEN status = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_renovacao,
      COALESCE(SUM(CASE WHEN status = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS a_receber_renovacao,
      SUM(CASE WHEN status = 'perda' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS perdas_renovacao,

      -- Novas (não renovação)
      SUM(CASE WHEN NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS total_novas,
      SUM(CASE WHEN status = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_novas,
      COALESCE(SUM(CASE WHEN status = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS a_receber_novas

    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id
  `);
  console.log("vw_kpis criada");

  // ── vw_status_breakdown ───────────────────────────────────────────────────────
  await pool.execute(`
    CREATE VIEW vw_status_breakdown AS
    SELECT
      ano_referencia AS ano,
      UPPER(mes_referencia) AS mes,
      assignee_id,
      status,
      count(*)+0 AS count,
      CASE
        WHEN status = 'perda'
        THEN COALESCE(SUM(CAST(valor_perda AS DECIMAL(12,2))), 0)+0
        ELSE COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0)+0
      END AS total
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id, status
  `);
  console.log("vw_status_breakdown criada");

  // ── vw_cotadores ──────────────────────────────────────────────────────────────
  // Inclui co-responsáveis (cotacao_responsaveis) via UNION para que Ivo
  // apareça no ranking com as cotações CCliente das quais é co-responsável.
  await pool.execute(`
    CREATE VIEW vw_cotadores AS
    SELECT
      u.id AS user_id,
      u.name,
      u.photo_url,
      c.ano_referencia AS ano,
      UPPER(c.mes_referencia) AS mes,

      -- Totais
      count(c.id)+0 AS total_cotacoes,
      SUM(CASE WHEN c.status = 'fechado' THEN 1 ELSE 0 END)+0 AS fechadas,
      SUM(CASE WHEN c.status = 'perda' THEN 1 ELSE 0 END)+0 AS perdas,
      COALESCE(SUM(CASE WHEN c.status = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS faturamento,
      ROUND(
        SUM(CASE WHEN c.status = 'fechado' THEN 1 ELSE 0 END)
        / NULLIF(count(c.id), 0) * 100, 1
      )+0 AS taxa_conversao,

      -- Renovações
      SUM(CASE WHEN UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1 THEN 1 ELSE 0 END)+0 AS total_renovacoes,
      SUM(CASE WHEN c.status = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_renovacao,
      COALESCE(SUM(CASE WHEN c.status = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS faturamento_renovacao,

      -- Novas
      SUM(CASE WHEN c.status = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_novas,
      COALESCE(SUM(CASE WHEN c.status = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS faturamento_novas

    FROM users u
    LEFT JOIN (
      -- cotações onde o usuário é responsável direto
      SELECT assignee_id AS uid, c2.id, c2.situacao, c2.status, c2.a_receber,
             c2.tipo_cliente, c2.is_renovacao, c2.ano_referencia, c2.mes_referencia
      FROM cotacoes c2
      WHERE c2.deleted_at IS NULL
        AND c2.ano_referencia IS NOT NULL
        AND c2.mes_referencia IS NOT NULL
      UNION
      -- cotações onde o usuário é co-responsável (sem duplicar com linha acima)
      SELECT cr.user_id AS uid, c2.id, c2.situacao, c2.status, c2.a_receber,
             c2.tipo_cliente, c2.is_renovacao, c2.ano_referencia, c2.mes_referencia
      FROM cotacao_responsaveis cr
      JOIN cotacoes c2 ON c2.id = cr.cotacao_id
      WHERE c2.deleted_at IS NULL
        AND c2.ano_referencia IS NOT NULL
        AND c2.mes_referencia IS NOT NULL
        AND c2.assignee_id != cr.user_id
    ) c ON c.uid = u.id
    WHERE u.is_active = 1 AND u.role IN ('cotador', 'admin')
    GROUP BY u.id, u.name, u.photo_url, c.ano_referencia, c.mes_referencia
  `);
  console.log("vw_cotadores criada");

  // ── vw_monthly_trend ──────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE VIEW vw_monthly_trend AS
    SELECT
      ano_referencia AS ano,
      UPPER(mes_referencia) AS mes,
      assignee_id,

      -- Totais
      SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END)+0 AS fechadas,
      SUM(CASE WHEN status = 'perda' THEN 1 ELSE 0 END)+0 AS perdas,
      count(*)+0 AS total,
      COALESCE(SUM(CASE WHEN status = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS a_receber,

      -- Renovações
      SUM(CASE WHEN status = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_renovacao,
      COALESCE(SUM(CASE WHEN status = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS a_receber_renovacao,

      -- Novas
      SUM(CASE WHEN status = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_novas,
      COALESCE(SUM(CASE WHEN status = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0)+0 AS a_receber_novas

    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id
  `);
  console.log("vw_monthly_trend criada");

  console.log("\nTodas as views criadas com sucesso!");
  await pool.end();
}

createViews().catch(console.error);
