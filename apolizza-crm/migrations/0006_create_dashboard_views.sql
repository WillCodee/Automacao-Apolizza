-- Migration: Criar views SQL para Dashboard
-- Garante que as views existam mesmo após recrear o banco

-- View 1: KPIs globais por ano/mês
CREATE OR REPLACE VIEW vw_kpis AS
SELECT
  ano_referencia AS ano,
  mes_referencia AS mes,
  assignee_id,
  count(*)::int AS total_cotacoes,
  count(*) FILTER (WHERE status = 'fechado')::int AS fechadas,
  count(*) FILTER (WHERE status = 'perda')::int AS perdas,
  count(*) FILTER (WHERE status NOT IN ('fechado','perda','concluido ocultar'))::int AS em_andamento,
  COALESCE(SUM(a_receber::numeric) FILTER (WHERE status = 'fechado'), 0)::float AS total_a_receber,
  COALESCE(SUM(valor_perda::numeric) FILTER (WHERE status = 'perda'), 0)::float AS total_valor_perda,
  COALESCE(SUM(premio_sem_iof::numeric) FILTER (WHERE status = 'fechado'), 0)::float AS total_premio,
  ROUND(
    count(*) FILTER (WHERE status = 'fechado')::numeric
    / NULLIF(count(*), 0) * 100, 1
  )::float AS taxa_conversao
FROM cotacoes
WHERE deleted_at IS NULL
GROUP BY ano_referencia, mes_referencia, assignee_id;

-- View 2: Status breakdown
CREATE OR REPLACE VIEW vw_status_breakdown AS
SELECT
  ano_referencia AS ano,
  mes_referencia AS mes,
  assignee_id,
  status,
  count(*)::int AS count,
  COALESCE(SUM(a_receber::numeric), 0)::float AS total
FROM cotacoes
WHERE deleted_at IS NULL
GROUP BY ano_referencia, mes_referencia, assignee_id, status;

-- View 3: Desempenho por cotador
DROP VIEW IF EXISTS vw_cotadores;
CREATE OR REPLACE VIEW vw_cotadores AS
SELECT
  u.id AS user_id,
  u.name,
  u.photo_url,
  c.ano_referencia AS ano,
  c.mes_referencia AS mes,
  count(c.id)::int AS total_cotacoes,
  count(c.id) FILTER (WHERE c.status = 'fechado')::int AS fechadas,
  COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE c.status = 'fechado'), 0)::float AS faturamento,
  ROUND(
    count(c.id) FILTER (WHERE c.status = 'fechado')::numeric
    / NULLIF(count(c.id), 0) * 100, 1
  )::float AS taxa_conversao
FROM users u
LEFT JOIN cotacoes c ON c.assignee_id = u.id AND c.deleted_at IS NULL
WHERE u.is_active = true AND u.role = 'cotador'
GROUP BY u.id, u.name, u.photo_url, c.ano_referencia, c.mes_referencia;

-- View 4: Monthly trend
CREATE OR REPLACE VIEW vw_monthly_trend AS
SELECT
  ano_referencia AS ano,
  mes_referencia AS mes,
  assignee_id,
  count(*) FILTER (WHERE status = 'fechado')::int AS fechadas,
  count(*) FILTER (WHERE status = 'perda')::int AS perdas,
  count(*)::int AS total,
  COALESCE(SUM(a_receber::numeric) FILTER (WHERE status = 'fechado'), 0)::float AS a_receber
FROM cotacoes
WHERE deleted_at IS NULL
GROUP BY ano_referencia, mes_referencia, assignee_id;
