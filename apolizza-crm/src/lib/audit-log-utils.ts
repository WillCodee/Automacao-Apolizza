type TipoAcao =
  | "CRIADA"
  | "EDITADA"
  | "STATUS_ALTERADO"
  | "BRIEFING_ADICIONADO"
  | "ANEXO_ADICIONADO"
  | "ANEXO_REMOVIDO";

export function formatarDetalhesAtividade(
  tipoAcao: TipoAcao,
  detalhes?: Record<string, any> | null
): string {
  if (!detalhes) return getDescricaoTipoAcao(tipoAcao);

  switch (tipoAcao) {
    case "CRIADA":
      return "Tarefa criada";
    case "EDITADA":
      if (detalhes.campo) {
        return `${detalhes.campo} alterado${
          detalhes.valorAnterior
            ? ` de "${detalhes.valorAnterior}" para "${detalhes.valorNovo}"`
            : ""
        }`;
      }
      return "Tarefa editada";
    case "STATUS_ALTERADO":
      return `Status alterado de "${detalhes.valorAnterior}" para "${detalhes.valorNovo}"`;
    case "BRIEFING_ADICIONADO":
      return detalhes.briefing
        ? `Briefing: "${detalhes.briefing.substring(0, 50)}${detalhes.briefing.length > 50 ? "..." : ""}"`
        : "Briefing adicionado";
    case "ANEXO_ADICIONADO":
      return detalhes.nomeArquivo ? `Anexo adicionado: ${detalhes.nomeArquivo}` : "Anexo adicionado";
    case "ANEXO_REMOVIDO":
      return detalhes.nomeArquivo ? `Anexo removido: ${detalhes.nomeArquivo}` : "Anexo removido";
    default:
      return getDescricaoTipoAcao(tipoAcao);
  }
}

function getDescricaoTipoAcao(tipoAcao: TipoAcao): string {
  const descricoes: Record<TipoAcao, string> = {
    CRIADA: "Tarefa criada",
    EDITADA: "Tarefa editada",
    STATUS_ALTERADO: "Status alterado",
    BRIEFING_ADICIONADO: "Briefing adicionado",
    ANEXO_ADICIONADO: "Anexo adicionado",
    ANEXO_REMOVIDO: "Anexo removido",
  };
  return descricoes[tipoAcao] || "Atividade registrada";
}

export function getIconeTipoAcao(tipoAcao: TipoAcao): string {
  const icones: Record<TipoAcao, string> = {
    CRIADA: "✨",
    EDITADA: "✏️",
    STATUS_ALTERADO: "🔄",
    BRIEFING_ADICIONADO: "💬",
    ANEXO_ADICIONADO: "📎",
    ANEXO_REMOVIDO: "🗑️",
  };
  return icones[tipoAcao] || "📝";
}
