-- Views SQL para KPIs e Desempenho
-- Rodar apos a migration inicial:
--   psql $DATABASE_URL -f scripts/create-views.sql

-- ============================================================
-- View: KPIs financeiros agrupados por mes
-- ============================================================

DROP VIEW IF EXISTS vw_kpis_mensal;

CREATE VIEW vw_kpis_mensal AS
SELECT
  DATE_TRUNC('month', due_date) AS mes,
  COUNT(*) FILTER (WHERE status = 'fechado') AS qtd_fechadas,
  COUNT(*) FILTER (WHERE status = 'perda') AS qtd_perda,
  COUNT(*) AS total_cotacoes,
  COALESCE(SUM(a_receber::numeric) FILTER (WHERE status = 'fechado'), 0) AS total_a_receber,
  COALESCE(SUM(valor_perda::numeric) FILTER (WHERE status = 'perda'), 0) AS total_valor_perda,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'fechado')::numeric /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS taxa_conversao
FROM cotacoes
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', due_date);

-- ============================================================
-- View: Desempenho por cotador
-- ============================================================

DROP VIEW IF EXISTS vw_desempenho_cotador;

CREATE VIEW vw_desempenho_cotador AS
SELECT
  u.id AS user_id,
  u.name,
  u.username,
  u.photo_url,
  COUNT(c.id) AS total_cotacoes,
  COUNT(c.id) FILTER (WHERE c.status = 'fechado') AS fechadas,
  COUNT(c.id) FILTER (WHERE c.status = 'perda') AS perdas,
  COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE c.status = 'fechado'), 0) AS faturamento,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.status = 'fechado')::numeric /
    NULLIF(COUNT(c.id), 0) * 100, 1
  ) AS taxa_conversao
FROM users u
LEFT JOIN cotacoes c ON c.assignee_id = u.id AND c.deleted_at IS NULL
WHERE u.role = 'cotador' AND u.is_active = true
GROUP BY u.id, u.name, u.username, u.photo_url;
