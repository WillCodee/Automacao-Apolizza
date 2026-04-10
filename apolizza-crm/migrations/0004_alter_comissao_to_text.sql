-- Migration: Alterar campo comissao de decimal para text
-- Motivo: Valores no Excel contém fórmulas textuais como "250 + 2.5 VIT"

ALTER TABLE cotacoes
ALTER COLUMN comissao TYPE text;
