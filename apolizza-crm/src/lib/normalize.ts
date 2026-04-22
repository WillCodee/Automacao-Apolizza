/**
 * Utilitário de normalização de tipos MySQL.
 * MySQL retorna DECIMAL como string — estas funções garantem
 * que o frontend sempre receba number.
 */

export function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function normalizeRow<T extends Record<string, unknown>>(
  row: T,
  numericFields: string[]
): T {
  const result = { ...row };
  for (const field of numericFields) {
    if (field in result) {
      (result as Record<string, unknown>)[field] = toNum(result[field]);
    }
  }
  return result;
}

export function normalizeRows<T extends Record<string, unknown>>(
  rows: T[],
  numericFields: string[]
): T[] {
  return rows.map((row) => normalizeRow(row, numericFields));
}

// ── Mapeamento de mês abreviado → nome completo (como armazenado no banco) ───
const MES_ABREV_TO_FULL: Record<string, string> = {
  JAN: "JANEIRO", FEV: "FEVEREIRO", MAR: "MARÇO",
  ABR: "ABRIL",   MAI: "MAIO",      JUN: "JUNHO",
  JUL: "JULHO",   AGO: "AGOSTO",    SET: "SETEMBRO",
  OUT: "OUTUBRO", NOV: "NOVEMBRO",  DEZ: "DEZEMBRO",
};

/**
 * Retorna SQL fragment para filtrar mes_referencia aceitando tanto
 * abreviação ("ABR") quanto nome completo ("ABRIL").
 * Uso: sql`AND ${mesFilter(mes)}` ou embed inline.
 */
export function mesFullName(mesAbrev: string): string {
  const upper = mesAbrev.toUpperCase();
  return MES_ABREV_TO_FULL[upper] ?? upper;
}
