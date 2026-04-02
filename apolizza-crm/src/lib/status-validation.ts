/**
 * Validação de campos obrigatórios por status.
 * Usado tanto no backend (API) quanto pode ser importado pelo frontend.
 */

const FIELD_LABELS: Record<string, string> = {
  fim_vigencia: "Fim Vigência",
  inicio_vigencia: "Início Vigência",
  indicacao: "Indicação",
  produto: "Produto",
  seguradora: "Seguradora",
  situacao: "Situação",
  tipo_cliente: "Tipo Cliente",
  comissao: "Comissão",
  primeiro_pagamento: "1º Pagamento",
  a_receber: "A Receber",
  parcelado_em: "Parcelado Em",
  premio_sem_iof: "Prêmio sem IOF",
  valor_perda: "Valor em Perda",
};

// Map DB column names (snake_case) to form field names (camelCase)
const FIELD_MAP: Record<string, string> = {
  fim_vigencia: "fimVigencia",
  inicio_vigencia: "inicioVigencia",
  indicacao: "indicacao",
  produto: "produto",
  seguradora: "seguradora",
  situacao: "situacao",
  tipo_cliente: "tipoCliente",
  comissao: "comissao",
  primeiro_pagamento: "primeiroPagamento",
  a_receber: "aReceber",
  parcelado_em: "parceladoEm",
  premio_sem_iof: "premioSemIof",
  valor_perda: "valorPerda",
};

export type StatusRule = {
  statusName: string;
  requiredFields: string[] | null;
};

export type ValidationResult = {
  valid: boolean;
  missingFields: { dbField: string; formField: string; label: string }[];
};

export function validateStatusFields(
  cotacaoData: Record<string, unknown>,
  newStatus: string,
  rules: StatusRule[]
): ValidationResult {
  const rule = rules.find((r) => r.statusName === newStatus);

  if (!rule || !rule.requiredFields || rule.requiredFields.length === 0) {
    return { valid: true, missingFields: [] };
  }

  const missingFields: ValidationResult["missingFields"] = [];

  for (const dbField of rule.requiredFields) {
    const formField = FIELD_MAP[dbField] || dbField;
    const value = cotacaoData[formField];

    const isEmpty =
      value === null ||
      value === undefined ||
      value === "" ||
      value === 0;

    if (isEmpty) {
      missingFields.push({
        dbField,
        formField,
        label: FIELD_LABELS[dbField] || dbField,
      });
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
