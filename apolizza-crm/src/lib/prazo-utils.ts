// ============================================================
// PRAZO-UTILS: Cálculo automático de Data de Entrega nas Tarefas
// Baseado na tabela de prazos por Produto + Tipo Cliente
// ============================================================

// Grupos de produtos conforme a imagem prazos.png
const RAMOS_ELEMENTAR = new Set([
  "AUTO", "CAMINHÃO", "MOTO",
  "RESIDENCIAL", "EMPRESARIAL", "CONDOMÍNIO", "RURAL",
  "EQUIPAMENTOS", "TRANSPORTE",
  "RC PROFISSIONAL", "RC GERAL",
  "D&O", "E&O",
  "CELULAR", "NOTEBOOK", "PORTÁTEIS",
  "CYBER", "NÁUTICO", "AERONÁUTICO",
  "MÁQUINAS", "OBRAS", "EVENTOS",
  "LUCROS CESSANTES", "PENHOR RURAL", "SEGURO SAFRA",
  "OUTROS", "VIAGEM", "PET", "BIKE", "PLACA AVULSA",
  "CONSÓRCIO - AUTO", "CONSÓRCIO - IMÓVEL", "CONSÓRCIO - OUTROS",
  "PREVIDÊNCIA", "CAPITALIZAÇÃO",
]);

// Produtos tratados igual a GARANTIA
const GARANTIA_GROUP = new Set([
  "GARANTIA", "FIANÇA LOCATÍCIA", "FIANÇA JUDICIAL",
]);

const BENEFICIOS_PF = new Set([
  "SAÚDE PF", "VIDA PF", "ODONTO PF",
]);

const BENEFICIOS_PJ = new Set([
  "SAÚDE PJ", "VIDA PJ", "ODONTO PJ",
]);

// Helpers
function addHours(date: Date, h: number): Date {
  return new Date(date.getTime() + h * 60 * 60 * 1000);
}

function addDays(date: Date, d: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + d);
  return result;
}

function addWorkingDays(date: Date, n: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < n) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function subtractWorkingDays(date: Date, n: number): Date {
  const result = new Date(date);
  let subtracted = 0;
  while (subtracted < n) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) subtracted++;
  }
  return result;
}

function subtractDays(date: Date, d: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - d);
  return result;
}

/**
 * Calcula a Data de Entrega automática da cotação.
 *
 * @param produto            - Valor de PRODUTO_OPTIONS selecionado
 * @param tipoCliente        - Valor de TIPO_CLIENTE_OPTIONS ("NOVO/CASA" | "NOVO" | "RENOVAÇÃO")
 * @param quantidadeVeiculos - Qtd de veículos (FROTAS + NOVO/NOVO-CASA)
 * @param quantidadeVidas    - Qtd de vidas (BENEFÍCIOS PJ + RENOVAÇÃO; ≤99 = 30d, >99 = 60d)
 * @param situacao           - Situação da cotação ("IMPLANTAÇÃO" → 20 dias para Benefícios)
 * @param fimVigencia        - Data fim da vigência atual (YYYY-MM-DD); quando informada, prazos
 *                             de RENOVAÇÃO são contados regressivamente a partir dela
 * @returns Date calculada
 */
export function calcularDataEntrega(
  produto: string,
  tipoCliente: string,
  quantidadeVeiculos?: number | null,
  quantidadeVidas?: number | null,
  situacao?: string | null,
  fimVigencia?: string | null
): Date {
  const now = new Date();
  const base = fimVigencia ? new Date(fimVigencia + "T00:00:00") : null;
  const isNovo = tipoCliente === "NOVO" || tipoCliente === "NOVO/CASA";
  const isRenovacao = tipoCliente === "RENOVAÇÃO";
  const isBeneficio = BENEFICIOS_PF.has(produto) || BENEFICIOS_PJ.has(produto);

  // Regra especial: Benefícios com situação IMPLANTAÇÃO → 20 dias a partir de hoje
  if (isBeneficio && situacao === "IMPLANTAÇÃO") {
    return addDays(now, 20);
  }

  if (isRenovacao) {
    if (RAMOS_ELEMENTAR.has(produto) || produto === "FROTAS") {
      // 10 úteis antes do fim da vigência (se informada) ou a partir de hoje
      return base
        ? subtractWorkingDays(base, 10)
        : addWorkingDays(now, 10);
    }
    if (GARANTIA_GROUP.has(produto)) {
      return base ? subtractDays(base, 10) : addDays(now, 10);
    }
    if (BENEFICIOS_PF.has(produto)) {
      return base ? subtractDays(base, 30) : addDays(now, 30);
    }
    if (BENEFICIOS_PJ.has(produto)) {
      if (quantidadeVidas != null && quantidadeVidas > 99) {
        return base ? subtractDays(base, 60) : addDays(now, 60);
      }
      return base ? subtractDays(base, 30) : addDays(now, 30);
    }
  }

  if (isNovo) {
    if (GARANTIA_GROUP.has(produto)) {
      return addDays(now, 2);
    }
    if (produto === "FROTAS") {
      const qtd = quantidadeVeiculos ?? 1;
      if (qtd <= 2) return addHours(now, 24);
      if (qtd <= 10) return addDays(now, 2);
      return addDays(now, 5);
    }
    if (RAMOS_ELEMENTAR.has(produto)) {
      return addHours(now, 24);
    }
    // SAÚDE PF, VIDA PF, ODONTO PF → 1 dia útil
    if (BENEFICIOS_PF.has(produto)) {
      return addWorkingDays(now, 1);
    }
    // SAÚDE PJ, VIDA PJ, ODONTO PJ → depende da qtd de vidas
    if (BENEFICIOS_PJ.has(produto)) {
      if (quantidadeVidas != null && quantidadeVidas > 100) {
        return addWorkingDays(now, 5);
      }
      return addWorkingDays(now, 2);
    }
  }

  return addDays(now, 1);
}

/** Grupos exportados para uso no form (exibir botão contextual) */
export const PRODUTO_FROTAS = "FROTAS";
export const PRODUTOS_BENEFICIOS_PJ = ["SAÚDE PJ", "VIDA PJ", "ODONTO PJ"] as const;

/** Verifica se a combinação Produto + TipoCliente necessita de informações adicionais */
export function precisaMaisInfo(produto: string, tipoCliente: string): {
  mostrarVeiculos: boolean;
  mostrarVidas: boolean;
  isNovoPJ: boolean;
} {
  const isNovo = tipoCliente === "NOVO" || tipoCliente === "NOVO/CASA";
  const isRenovacao = tipoCliente === "RENOVAÇÃO";
  const isBeneficioPJ = (PRODUTOS_BENEFICIOS_PJ as readonly string[]).includes(produto);
  return {
    mostrarVeiculos: produto === PRODUTO_FROTAS && isNovo,
    mostrarVidas: isBeneficioPJ && (isRenovacao || isNovo),
    isNovoPJ: isBeneficioPJ && isNovo,
  };
}

/**
 * Formata uma Date para o formato de input date (YYYY-MM-DD)
 */
export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
