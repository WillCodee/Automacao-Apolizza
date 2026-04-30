// Setor (BE = Benefícios | RE = Ramos Elementares) derivado do campo `produto`
// Convenção: produtos com PME/PF/PJ relacionados a saúde/odonto/vida + GARANTIA → BE
// Demais (auto, viagem, residencial, empresarial, etc.) → RE

export type Setor = "BE" | "RE";

const BE_PRODUTOS = new Set([
  "GARANTIA",
  "SAÚDE PME", "SAUDE PME",
  "SAÚDE PF", "SAUDE PF",
  "SAÚDE PJ", "SAUDE PJ",
  "ODONTO PME",
  "ODONTO PF",
  "ODONTO PJ",
  "VIDA PME",
  "VIDA PF",
  "VIDA PJ",
]);

export function getSetor(produto: string | null | undefined): Setor | null {
  if (!produto) return null;
  const p = produto.trim().toUpperCase();
  if (BE_PRODUTOS.has(p)) return "BE";
  return "RE";
}

// SQL CASE para uso em queries Drizzle/raw
// Ex: ${setorCaseSql} as setor
export const setorCaseSql = `
  CASE
    WHEN UPPER(TRIM(produto)) IN ('GARANTIA','SAÚDE PME','SAUDE PME','SAÚDE PF','SAUDE PF','SAÚDE PJ','SAUDE PJ','ODONTO PME','ODONTO PF','ODONTO PJ','VIDA PME','VIDA PF','VIDA PJ')
      THEN 'BE'
    ELSE 'RE'
  END
`;

export const SETOR_LABEL: Record<Setor, string> = {
  BE: "Benefícios",
  RE: "Ramos Elementares",
};
