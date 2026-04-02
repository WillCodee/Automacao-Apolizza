"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

type StatusConfig = {
  id: string;
  statusName: string;
  displayLabel: string;
  color: string;
  icon: string;
  orderIndex: number;
};

type KanbanCotacao = {
  id: string;
  name: string;
  status: string;
  seguradora: string | null;
  produto: string | null;
  aReceber: number | null;
  priority: string;
  createdAt: string;
};

type KanbanBoardProps = {
  userRole: "admin" | "cotador";
};

const PRIORITY_DOT: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-amber-500",
  normal: "bg-[#03a4ed]",
  baixa: "bg-slate-400",
};

export function KanbanBoard({ userRole }: KanbanBoardProps) {
  const [columns, setColumns] = useState<StatusConfig[]>([]);
  const [cotacoes, setCotacoes] = useState<KanbanCotacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const updatingRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [configRes, cotacoesRes] = await Promise.all([
      fetch("/api/status-config"),
      fetch("/api/cotacoes?limit=100"),
    ]);
    const configJson = await configRes.json();
    const cotacoesJson = await cotacoesRes.json();

    setColumns(
      (configJson.data || []).sort((a: StatusConfig, b: StatusConfig) => a.orderIndex - b.orderIndex)
    );
    setCotacoes(cotacoesJson.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleDragStart(e: React.DragEvent, cotacaoId: string) {
    e.dataTransfer.setData("text/plain", cotacaoId);
    setDraggingId(cotacaoId);
  }

  function handleDragOver(e: React.DragEvent, statusName: string) {
    e.preventDefault();
    setDragOverCol(statusName);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault();
    setDragOverCol(null);
    const cotacaoId = e.dataTransfer.getData("text/plain");
    if (!cotacaoId || updatingRef.current) return;

    const cotacao = cotacoes.find((c) => c.id === cotacaoId);
    if (!cotacao || cotacao.status === newStatus) {
      setDraggingId(null);
      return;
    }

    // Optimistic update
    setCotacoes((prev) =>
      prev.map((c) => (c.id === cotacaoId ? { ...c, status: newStatus } : c))
    );
    setDraggingId(null);

    updatingRef.current = true;
    try {
      const res = await fetch(`/api/cotacoes/${cotacaoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao mover cotacao");
        // Revert
        setCotacoes((prev) =>
          prev.map((c) =>
            c.id === cotacaoId ? { ...c, status: cotacao.status } : c
          )
        );
      }
    } catch {
      // Revert on error
      setCotacoes((prev) =>
        prev.map((c) =>
          c.id === cotacaoId ? { ...c, status: cotacao.status } : c
        )
      );
    }
    updatingRef.current = false;
  }

  const fmt = (v: number | null) =>
    v != null
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "";

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 mt-2 text-sm">Carregando Kanban...</p>
      </div>
    );
  }

  // Only show columns that have cotações or are commonly used
  const activeColumns = columns.filter((col) => {
    const count = cotacoes.filter((c) => c.status === col.statusName).length;
    return count > 0 || ["não iniciado", "raut", "fechado", "perda"].includes(col.statusName);
  });

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {activeColumns.map((col) => {
          const colCotacoes = cotacoes.filter((c) => c.status === col.statusName);
          const isDragOver = dragOverCol === col.statusName;

          return (
            <div
              key={col.statusName}
              className={`w-72 flex-shrink-0 rounded-xl border transition-all ${
                isDragOver
                  ? "border-[#03a4ed] bg-sky-50/50 shadow-md"
                  : "border-slate-200 bg-slate-50/50"
              }`}
              onDragOver={(e) => handleDragOver(e, col.statusName)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.statusName)}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color || "#94a3b8" }}
                />
                <span className="text-sm font-semibold text-slate-700 truncate">
                  {col.icon} {col.displayLabel || col.statusName}
                </span>
                <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-200 rounded-full px-2 py-0.5">
                  {colCotacoes.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[100px] max-h-[60vh] overflow-y-auto">
                {colCotacoes.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Nenhuma cotacao
                  </p>
                )}
                {colCotacoes.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, c.id)}
                    className={`bg-white rounded-lg p-3 border border-slate-100 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                      draggingId === c.id ? "opacity-50 scale-95" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[c.priority] || PRIORITY_DOT.normal}`} />
                      <Link
                        href={`/cotacoes/${c.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-[#03a4ed] transition-colors line-clamp-2 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.name}
                      </Link>
                    </div>
                    {(c.seguradora || c.aReceber) && (
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate max-w-[120px]">{c.seguradora || ""}</span>
                        {c.aReceber ? (
                          <span className="font-semibold text-emerald-600">{fmt(c.aReceber)}</span>
                        ) : null}
                      </div>
                    )}
                    {c.produto && (
                      <span className="inline-block mt-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        {c.produto}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
