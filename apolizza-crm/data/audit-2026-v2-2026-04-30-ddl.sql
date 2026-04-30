-- Tabela de log de correções automáticas da auditoria
CREATE TABLE IF NOT EXISTS cotacao_auditoria_correcoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cotacao_id CHAR(36) NOT NULL,
  campo VARCHAR(50) NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  tier VARCHAR(10),
  audit_run_id VARCHAR(50),
  fonte VARCHAR(20) DEFAULT 'clickup',
  aplicado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cotacao (cotacao_id),
  INDEX idx_run (audit_run_id)
);
