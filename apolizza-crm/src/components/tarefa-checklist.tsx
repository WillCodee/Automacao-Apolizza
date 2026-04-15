"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
  concluidoPor: string | null;
  concluidoEm: string | null;
  ordem: number;
  concluidoPorUser?: { id: string; name: string } | null;
}

interface TarefaChecklistProps {
  tarefaId: string;
  canEdit: boolean;
  isCreator: boolean;
}

export function TarefaChecklist({ tarefaId, canEdit, isCreator }: TarefaChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoItem, setNovoItem] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChecklist = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/checklist`);
      const data = await res.json();
      if (data.success) setItems(data.data);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tarefaId]);

  useEffect(() => {
    fetchChecklist();
    // Polling a cada 5s para atualizações em tempo real
    intervalRef.current = setInterval(() => fetchChecklist(true), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchChecklist]);

  const handleToggle = async (item: ChecklistItem) => {
    // Otimistic update
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, concluido: !i.concluido } : i)
    );
    await fetch(`/api/tarefas/${tarefaId}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, concluido: !item.concluido }),
    });
    fetchChecklist(true);
  };

  const handleAdd = async () => {
    if (!novoItem.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/tarefas/${tarefaId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: novoItem.trim(), ordem: items.length }),
      });
      setNovoItem("");
      setShowInput(false);
      fetchChecklist(true);
    } finally {
      setAdding(false);
    }
  };

  const done = items.filter((i) => i.concluido).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  if (loading) {
    return <div className="text-xs text-slate-400 py-2">Carregando checklist...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Header + progresso */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-[#03a4ed]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 font-medium shrink-0">{done}/{items.length}</span>
        </div>
      )}

      {/* Itens */}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 group">
            <button
              onClick={() => handleToggle(item)}
              disabled={!canEdit}
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                item.concluido
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-slate-300 hover:border-emerald-400"
              } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            >
              {item.concluido && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${item.concluido ? "line-through text-slate-400" : "text-slate-700"}`}>
                {item.texto}
              </span>
              {item.concluido && item.concluidoPorUser && (
                <p className="text-xs text-slate-400 mt-0.5">
                  por {item.concluidoPorUser.name}
                  {item.concluidoEm && ` · ${new Date(item.concluidoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Adicionar item (apenas criador ou admin) */}
      {isCreator && (
        <div className="mt-2">
          {showInput ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowInput(false); }}
                placeholder="Novo item..."
                autoFocus
                className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#03a4ed] bg-slate-50"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !novoItem.trim()}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#03a4ed] text-white font-medium disabled:opacity-50"
              >
                {adding ? "..." : "Add"}
              </button>
              <button onClick={() => setShowInput(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
            >
              + Adicionar item
            </button>
          )}
        </div>
      )}

      {items.length === 0 && !isCreator && (
        <p className="text-xs text-slate-400 italic">Nenhum item no checklist.</p>
      )}
    </div>
  );
}
