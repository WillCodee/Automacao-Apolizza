"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type CotacaoKanban = {
  id: string;
  name: string;
  status: string;
  situacao: string | null;
  produto: string | null;
  aReceber: string | null;
  valorPerda: string | null;
  assigneeName: string | null;
  assigneePhoto: string | null;
  grupoNome: string | null;
  priority: string | null;
};

type KanbanData = {
  byUser: Record<string, { name: string; photo: string | null; cotacoes: CotacaoKanban[]; fechadas: number; perdas: number }>;
  byGroup: Record<string, { name: string; color: string | null; cotacoes: CotacaoKanban[]; fechadas: number; perdas: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  "não iniciado": "bg-slate-100 text-slate-600",
  "raut":         "bg-yellow-100 text-yellow-700",
  "atrasado":     "bg-red-100 text-red-700",
  "pendencia":    "bg-orange-100 text-orange-700",
  "perda":        "bg-red-100 text-red-600 line-through",
  "fechado":      "bg-emerald-100 text-emerald-700",
  "implantando":  "bg-blue-100 text-blue-700",
  "concluido ocultar": "bg-slate-100 text-slate-400",
};

const fmt = (v: string | null) => {
  const n = Number(v);
  if (!v || isNaN(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

type ViewMode = "user" | "group";

export function AdminKanban() {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("user");

  useEffect(() => {
    fetch("/api/dashboard/kanban")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setData(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-100 rounded w-48" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-slate-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const columns = viewMode === "user"
    ? Object.entries(data.byUser)
    : Object.entries(data.byGroup);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Visão Kanban</h2>
          <p className="text-xs text-slate-400 mt-0.5">Cotações, vendas e perdas por {viewMode === "user" ? "usuário" : "grupo"}</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode("user")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${viewMode === "user" ? "bg-white text-[#03a4ed] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Por Usuário
          </button>
          <button
            onClick={() => setViewMode("group")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${viewMode === "group" ? "bg-white text-[#03a4ed] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Por Grupo
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4" style={{ minWidth: `${Math.max(columns.length * 280, 400)}px` }}>
          {columns.map(([key, col]) => (
            <KanbanColumn key={key} col={col as KanbanData["byUser"][string]} viewMode={viewMode} />
          ))}
          {columns.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-slate-400">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ col, viewMode }: {
  col: { name: string; photo?: string | null; color?: string | null; cotacoes: CotacaoKanban[]; fechadas: number; perdas: number };
  viewMode: ViewMode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const vendas = col.cotacoes.filter((c) => c.status === "fechado");
  const perdas = col.cotacoes.filter((c) => c.status === "perda");
  const emAndamento = col.cotacoes.filter((c) => !["fechado", "perda", "concluido ocultar"].includes(c.status));

  return (
    <div className="flex-shrink-0 w-64 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      {/* Column header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-3 flex items-center gap-2 hover:bg-slate-100 transition-colors"
      >
        {viewMode === "user" ? (
          <div className="w-7 h-7 rounded-full bg-[#03a4ed]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {(col as { photo?: string | null }).photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(col as { photo?: string | null }).photo!} alt={col.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-[#03a4ed]">{col.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        ) : (
          <div
            className="w-3 h-7 rounded-full flex-shrink-0"
            style={{ background: (col as { color?: string | null }).color || "#03a4ed" }}
          />
        )}
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{col.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-emerald-600 font-medium">{col.fechadas} fechadas</span>
            <span className="text-[10px] text-red-500">{col.perdas} perdas</span>
          </div>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-1 max-h-80 overflow-y-auto">
          {/* Em andamento */}
          {emAndamento.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 py-1.5">
                Em Andamento ({emAndamento.length})
              </p>
              {emAndamento.map((c) => <CotacaoCard key={c.id} cotacao={c} />)}
            </div>
          )}

          {/* Vendas fechadas */}
          {vendas.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider px-1 py-1.5">
                Fechadas ({vendas.length})
              </p>
              {vendas.map((c) => <CotacaoCard key={c.id} cotacao={c} />)}
            </div>
          )}

          {/* Perdas */}
          {perdas.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider px-1 py-1.5">
                Perdas ({perdas.length})
              </p>
              {perdas.map((c) => <CotacaoCard key={c.id} cotacao={c} />)}
            </div>
          )}

          {col.cotacoes.length === 0 && (
            <div className="py-4 text-center text-xs text-slate-400">Nenhuma cotação</div>
          )}
        </div>
      )}
    </div>
  );
}

function CotacaoCard({ cotacao }: { cotacao: CotacaoKanban }) {
  const isPerda = cotacao.status === "perda";
  const isFechado = cotacao.status === "fechado";

  return (
    <Link
      href={`/cotacoes/${cotacao.id}`}
      className={`block p-2.5 rounded-lg border text-xs transition-all hover:shadow-sm ${
        isFechado ? "bg-emerald-50 border-emerald-200" :
        isPerda ? "bg-red-50 border-red-200" :
        "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      <p className={`font-medium truncate mb-1 ${isPerda ? "text-red-600 line-through" : "text-slate-800"}`}>
        {cotacao.name}
      </p>
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[cotacao.status] || "bg-slate-100 text-slate-500"}`}>
          {cotacao.status}
        </span>
        <span className={`text-[10px] font-semibold ${isFechado ? "text-emerald-600" : isPerda ? "text-red-500" : "text-slate-500"}`}>
          {isFechado ? fmt(cotacao.aReceber) : isPerda ? fmt(cotacao.valorPerda) : cotacao.produto || "—"}
        </span>
      </div>
    </Link>
  );
}
