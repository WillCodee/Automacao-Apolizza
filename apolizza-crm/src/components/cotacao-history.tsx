"use client";

import { useState, useEffect } from "react";

type HistoryEntry = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  userName: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  status: "Status",
  priority: "Prioridade",
  dueDate: "Data de Entrega",
  assigneeId: "Responsavel",
  tipoCliente: "Tipo Cliente",
  contatoCliente: "Contato",
  seguradora: "Seguradora",
  produto: "Produto",
  situacao: "Situacao",
  indicacao: "Indicacao",
  inicioVigencia: "Inicio Vigencia",
  fimVigencia: "Fim Vigencia",
  primeiroPagamento: "1o Pagamento",
  parceladoEm: "Parcela do Cliente",
  valorParcelado: "Valor Parcelado (R$/mês)",
  premioSemIof: "Premio sem IOF",
  comissao: "Comissao",
  aReceber: "A Receber",
  valorPerda: "Valor Perda",
  proximaTratativa: "Data Contato com Cliente",
  observacao: "Observacao",
  mesReferencia: "Mes Ref",
  anoReferencia: "Ano Ref",
  tags: "Tags",
  isRenovacao: "Renovacao",
};

export function CotacaoHistory({ cotacaoId }: { cotacaoId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && history.length === 0) {
      fetch(`/api/cotacoes/${cotacaoId}/history`)
        .then((r) => r.json())
        .then((d) => setHistory(d.data || []));
    }
  }, [open, cotacaoId, history.length]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-slate-900">
          Historico de Alteracoes
        </h3>
        <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto">
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400 text-center">
              Nenhuma alteracao registrada.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.id} className="px-5 py-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-medium text-slate-500">{h.userName || "Sistema"}</span>
                    <span>
                      {new Date(h.changedAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">
                      {FIELD_LABELS[h.fieldName] || h.fieldName}
                    </span>
                    :{" "}
                    <span className="text-[#ff695f] line-through">
                      {h.oldValue || "vazio"}
                    </span>{" "}
                    →{" "}
                    <span className="text-emerald-600 font-medium">
                      {h.newValue || "vazio"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
