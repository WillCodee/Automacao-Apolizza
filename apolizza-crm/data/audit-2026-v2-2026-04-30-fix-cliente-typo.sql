-- CCLIENTE → CLIENTE (typo histórico em 115+ cotações)
START TRANSACTION;
INSERT INTO cotacao_auditoria_correcoes (cotacao_id, campo, valor_antigo, valor_novo, tier, audit_run_id, fonte)
  SELECT id, 'situacao', 'CCLIENTE', 'CLIENTE', 'MEDIA', 'audit-2026-2026-04-30', 'clickup' FROM cotacoes WHERE situacao='CCLIENTE';
UPDATE cotacoes SET situacao='CLIENTE', updated_at=NOW() WHERE situacao='CCLIENTE';
COMMIT;
