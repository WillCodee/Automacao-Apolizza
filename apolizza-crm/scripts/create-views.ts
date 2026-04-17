import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Normaliza mes_referencia para sempre retornar 3 letras (ex: "MAIO" → "MAI", "ABRIL" → "ABR")
const MES_NORM = `
  CASE UPPER(mes_referencia)
    WHEN 'JANEIRO'   THEN 'JAN'
    WHEN 'FEVEREIRO' THEN 'FEV'
    WHEN 'MARÇO'     THEN 'MAR'
    WHEN 'MARCO'     THEN 'MAR'
    WHEN 'ABRIL'     THEN 'ABR'
    WHEN 'MAIO'      THEN 'MAI'
    WHEN 'JUNHO'     THEN 'JUN'
    WHEN 'JULHO'     THEN 'JUL'
    WHEN 'AGOSTO'    THEN 'AGO'
    WHEN 'SETEMBRO'  THEN 'SET'
    WHEN 'OUTUBRO'   THEN 'OUT'
    WHEN 'NOVEMBRO'  THEN 'NOV'
    WHEN 'DEZEMBRO'  THEN 'DEZ'
    ELSE UPPER(mes_referencia)
  END
`;

async function createViews() {
  // Drop all views first to allow column type changes
  await sql`DROP VIEW IF EXISTS vw_cotadores, vw_kpis, vw_status_breakdown, vw_monthly_trend CASCADE`;
  console.log("Views antigas removidas");

  // View: KPIs globais por ano/mês
  await sql`
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
      count(*)::int AS total_cotacoes,
      count(*) FILTER (WHERE LOWER(situacao) = 'fechado')::int AS fechadas,
      count(*) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate'))::int AS perdas,
      count(*) FILTER (WHERE LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL)::int AS em_andamento,
      COALESCE(SUM(a_receber::numeric) FILTER (WHERE LOWER(situacao) = 'fechado'), 0)::float AS total_a_receber,
      COALESCE(SUM(valor_perda::numeric) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate')), 0)::float AS total_valor_perda,
      COALESCE(SUM(premio_sem_iof::numeric) FILTER (WHERE LOWER(situacao) = 'fechado'), 0)::float AS total_premio,
      ROUND(
        count(*) FILTER (WHERE LOWER(situacao) = 'fechado')::numeric
        / NULLIF(count(*), 0) * 100, 1
      )::float AS taxa_conversao
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id
  `;
  console.log("vw_kpis criada");

  // View: Status breakdown
  await sql`
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
      count(*)::int AS count,
      CASE
        WHEN status = 'perda'
        THEN COALESCE(SUM(valor_perda::numeric), 0)::float
        ELSE COALESCE(SUM(a_receber::numeric), 0)::float
      END AS total
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id, status
  `;
  console.log("vw_status_breakdown criada");

  // View: Desempenho por cotador
  await sql`
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
      count(c.id)::int AS total_cotacoes,
      count(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado')::int AS fechadas,
      count(c.id) FILTER (WHERE LOWER(c.situacao) IN ('perda','perda/resgate'))::int AS perdas,
      COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE LOWER(c.situacao) = 'fechado'), 0)::float AS faturamento,
      ROUND(
        count(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado')::numeric
        / NULLIF(count(c.id), 0) * 100, 1
      )::float AS taxa_conversao
    FROM users u
    LEFT JOIN cotacoes c ON c.assignee_id = u.id
      AND c.deleted_at IS NULL
      AND c.ano_referencia IS NOT NULL
      AND c.mes_referencia IS NOT NULL
    WHERE u.is_active = true AND u.role = 'cotador'
    GROUP BY u.id, u.name, u.photo_url, c.ano_referencia, c.mes_referencia
  `;
  console.log("vw_cotadores criada");

  // View: Monthly trend
  await sql`
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
      count(*) FILTER (WHERE LOWER(situacao) = 'fechado')::int AS fechadas,
      count(*) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate'))::int AS perdas,
      count(*)::int AS total,
      COALESCE(SUM(a_receber::numeric) FILTER (WHERE LOWER(situacao) = 'fechado'), 0)::float AS a_receber
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
      AND mes_referencia IS NOT NULL
    GROUP BY ano_referencia, mes_referencia, assignee_id
  `;
  console.log("vw_monthly_trend criada");

  console.log("\nTodas as views criadas com sucesso!");
}

createViews().catch(console.error);
