-- Migration: Aumentar limite do campo mes_referencia de VARCHAR(3) para VARCHAR(10)
-- Motivo: Meses como "MAIO", "JUNHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO" têm mais de 3 caracteres

ALTER TABLE cotacoes
ALTER COLUMN mes_referencia TYPE varchar(10);
