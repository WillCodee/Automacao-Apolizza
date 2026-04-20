import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";

const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });

async function createViews() {
  await pool.execute("DROP VIEW IF EXISTS vw_cotadores, vw_kpis, vw_status_breakdown, vw_monthly_trend");
  console.log("Views antigas removidas");

  // ── vw_kpis ──────────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE VIEW vw_kpis AS
    SELECT
      ano_referencia AS ano,
      CASE UPPER(mes_referencia)
        WHEN 'JANEIRO'   THEN 'JAN' WHEN 'FEVEREIRO' THEN 'FEV'
        WHEN 'MARÇO'     THEN 'MAR' WHEN 'MARCO'     THEN 'MAR'
        WHEN 'ABRIL'     THEN 'ABR' WHEN 'MAIO'      THEN 'MAI'
        WHEN 'JUNHO'     THEN 'JUN' WHEN 'JULHO'     THEN 'JUL'
        WHEN 'AGOSTO'    THEN 'AGO' WHEN 'SETEMBRO'  THEN 'SET'
        WHEN 'OUTUBRO'   THEN 'OUT' WHEN 'NOVEMBRO'  THEN 'NOV'
        WHEN 'DEZEMBRO'  THEN 'DEZ' ELSE UPPER(mes_referencia)
      END AS mes,
      assignee_id,

      -- Totais (novas + renovações)
      count(*)+0 AS total_cotacoes,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END)+0 AS fechadas,
      SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN 1 ELSE 0 END)+0 AS perdas,
      SUM(CASE WHEN LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL THEN 1 ELSE 0 END)+0 AS em_andamento,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_a_receber,
      COALESCE(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN CAST(valor_perda AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_valor_perda,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(premio_sem_iof AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_premio,
      ROUND(
        SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END)
        / NULLIF(count(*), 0) * 100, 1
      ) AS taxa_conversao,

      -- Renovações (tipo_cliente = 'RENOVAÇÃO' ou is_renovacao = true)
      SUM(CASE WHEN UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1 THEN 1 ELSE 0 END)+0 AS total_renovacoes,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_renovacao,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS a_receber_renovacao,
      SUM(CASE WHEN (LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda') AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS perdas_renovacao,

      -- Novas (não renovação)
      SUM(CASE WHEN NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS total_novas,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_novas,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS a_receber_novas

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
      CASE UPPER(mes_referencia)
        WHEN 'JANEIRO'   THEN 'JAN' WHEN 'FEVEREIRO' THEN 'FEV'
        WHEN 'MARÇO'     THEN 'MAR' WHEN 'MARCO'     THEN 'MAR'
        WHEN 'ABRIL'     THEN 'ABR' WHEN 'MAIO'      THEN 'MAI'
        WHEN 'JUNHO'     THEN 'JUN' WHEN 'JULHO'     THEN 'JUL'
        WHEN 'AGOSTO'    THEN 'AGO' WHEN 'SETEMBRO'  THEN 'SET'
        WHEN 'OUTUBRO'   THEN 'OUT' WHEN 'NOVEMBRO'  THEN 'NOV'
        WHEN 'DEZEMBRO'  THEN 'DEZ' ELSE UPPER(mes_referencia)
      END AS mes,
      assignee_id,
      status,
      count(*)+0 AS count,
      CASE
        WHEN status = 'perda'
        THEN COALESCE(SUM(CAST(valor_perda AS DECIMAL(12,2))), 0)
        ELSE COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0)
      END AS total
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id, status
  `);
  console.log("vw_status_breakdown criada");

  // ── vw_cotadores ──────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE VIEW vw_cotadores AS
    SELECT
      u.id AS user_id,
      u.name,
      u.photo_url,
      c.ano_referencia AS ano,
      CASE UPPER(c.mes_referencia)
        WHEN 'JANEIRO'   THEN 'JAN' WHEN 'FEVEREIRO' THEN 'FEV'
        WHEN 'MARÇO'     THEN 'MAR' WHEN 'MARCO'     THEN 'MAR'
        WHEN 'ABRIL'     THEN 'ABR' WHEN 'MAIO'      THEN 'MAI'
        WHEN 'JUNHO'     THEN 'JUN' WHEN 'JULHO'     THEN 'JUL'
        WHEN 'AGOSTO'    THEN 'AGO' WHEN 'SETEMBRO'  THEN 'SET'
        WHEN 'OUTUBRO'   THEN 'OUT' WHEN 'NOVEMBRO'  THEN 'NOV'
        WHEN 'DEZEMBRO'  THEN 'DEZ' ELSE UPPER(c.mes_referencia)
      END AS mes,

      -- Totais
      count(c.id)+0 AS total_cotacoes,
      SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END)+0 AS fechadas,
      SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' THEN 1 ELSE 0 END)+0 AS perdas,
      COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS faturamento,
      ROUND(
        SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END)
        / NULLIF(count(c.id), 0) * 100, 1
      ) AS taxa_conversao,

      -- Renovações
      SUM(CASE WHEN UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1 THEN 1 ELSE 0 END)+0 AS total_renovacoes,
      SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_renovacao,
      COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS faturamento_renovacao,

      -- Novas
      SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_novas,
      COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = 1) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS faturamento_novas

    FROM users u
    LEFT JOIN cotacoes c ON c.assignee_id = u.id
      AND c.deleted_at IS NULL
      AND c.ano_referencia IS NOT NULL
      AND c.mes_referencia IS NOT NULL
    WHERE u.is_active = 1 AND u.role IN ('cotador', 'proprietario')
    GROUP BY u.id, u.name, u.photo_url, c.ano_referencia, c.mes_referencia
  `);
  console.log("vw_cotadores criada");

  // ── vw_monthly_trend ──────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE VIEW vw_monthly_trend AS
    SELECT
      ano_referencia AS ano,
      CASE UPPER(mes_referencia)
        WHEN 'JANEIRO'   THEN 'JAN' WHEN 'FEVEREIRO' THEN 'FEV'
        WHEN 'MARÇO'     THEN 'MAR' WHEN 'MARCO'     THEN 'MAR'
        WHEN 'ABRIL'     THEN 'ABR' WHEN 'MAIO'      THEN 'MAI'
        WHEN 'JUNHO'     THEN 'JUN' WHEN 'JULHO'     THEN 'JUL'
        WHEN 'AGOSTO'    THEN 'AGO' WHEN 'SETEMBRO'  THEN 'SET'
        WHEN 'OUTUBRO'   THEN 'OUT' WHEN 'NOVEMBRO'  THEN 'NOV'
        WHEN 'DEZEMBRO'  THEN 'DEZ' ELSE UPPER(mes_referencia)
      END AS mes,
      assignee_id,

      -- Totais
      SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END)+0 AS fechadas,
      SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN 1 ELSE 0 END)+0 AS perdas,
      count(*)+0 AS total,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS a_receber,

      -- Renovações
      SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_renovacao,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS a_receber_renovacao,

      -- Novas
      SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END)+0 AS fechadas_novas,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS a_receber_novas

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
