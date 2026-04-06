"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { STATUS_OPTIONS, PRODUTO_OPTIONS } from "@/lib/constants";

type Renovacao = {
  id: string;
  name: string;
  status: string;
  seguradora: string | null;
  produto: string | null;
  aReceber: number | null;
  fimVigencia: string | null;
  isRenovacao: boolean;
  cotador: string | null;
  diasParaVencer: number | null;
};

type RenovacoesKpis = {
  total: number;
  vencendo30: number;
  renovadas: number;
  perdidas: number;
};

const URGENCIA_BADGE: Record<string, string> = {
  critico: "bg-red-100 text-red-700 border-red-200",
  urgente: "bg-amber-100 text-amber-700 border-amber-200",
  atencao: "bg-emerald-100 text-emerald-700 border-emerald-200",
  normal: "bg-slate-100 text-slate-600 border-slate-200",
  vencido: "bg-red-200 text-red-800 border-red-300",
};

function getUrgencia(dias: number | null) {
  if (dias === null) return { label: "—", key: "normal" };
  if (dias < 0) return { label: `Vencido ha ${Math.abs(dias)}d`, key: "vencido" };
  if (dias <= 15) return { label: `${dias}d - Critico`, key: "critico" };
  if (dias <= 30) return { label: `${dias}d - Urgente`, key: "urgente" };
  if (dias <= 60) return { label: `${dias}d - Atencao`, key: "atencao" };
  return { label: `${dias} dias`, key: "normal" };
}

export function RenovacoesList({ userRole }: { userRole: "admin" | "cotador" }) {
  const [renovacoes, setRenovacoes] = useState<Renovacao[]>([]);
  const [kpis, setKpis] = useState<RenovacoesKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [urgenciaFilter, setUrgenciaFilter] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [produtoFilter, setProdutoFilter] = useState("");
  const [seguradoraFilter, setSeguradoraFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urgenciaFilter) params.set("urgencia", urgenciaFilter);

    const res = await fetch(`/api/renovacoes?${params}`);
    const json = await res.json();
    setRenovacoes(json.data?.renovacoes || []);
    setKpis(json.data?.kpis || null);
    setLoading(false);
  }, [urgenciaFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Seguradoras únicas para o filtro
  const seguradorasUnicas = useMemo(() => {
    const set = new Set(renovacoes.map((r) => r.seguradora).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [renovacoes]);

  // Filtros client-side
  const renovacoesFiltradas = useMemo(() => {
    return renovacoes.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) &&
          !(r.seguradora ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (produtoFilter && r.produto !== produtoFilter) return false;
      if (seguradoraFilter && r.seguradora !== seguradoraFilter) return false;
      return true;
    });
  }, [renovacoes, search, statusFilter, produtoFilter, seguradoraFilter]);

  const hasFilters = search || statusFilter || produtoFilter || seguradoraFilter;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setProdutoFilter("");
    setSeguradoraFilter("");
  };

  const fmt = (v: number | null) =>
    v != null
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Renovacoes" value={kpis.total} color="bg-[#03a4ed]" />
          <KpiCard label="Vencendo em 30d" value={kpis.vencendo30} color="bg-amber-500" />
          <KpiCard label="Renovadas" value={kpis.renovadas} color="bg-emerald-500" />
          <KpiCard label="Perdidas" value={kpis.perdidas} color="bg-[#ff695f]" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100 space-y-3">
        {/* Search + dropdowns */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome ou seguradora..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[#03a4ed] focus:ring-1 focus:ring-[#03a4ed]/20 bg-slate-50"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#03a4ed] text-slate-600"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Produto */}
          <select
            value={produtoFilter}
            onChange={(e) => setProdutoFilter(e.target.value)}
            className="text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#03a4ed] text-slate-600"
          >
            <option value="">Todos os produtos</option>
            {PRODUTO_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Seguradora */}
          <select
            value={seguradoraFilter}
            onChange={(e) => setSeguradoraFilter(e.target.value)}
            className="text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#03a4ed] text-slate-600"
          >
            <option value="">Todas as seguradoras</option>
            {seguradorasUnicas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-slate-400 hover:text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Urgência pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-slate-500">Urgência:</span>
          {[
            { label: "Todos", value: "" },
            { label: "Crítico (≤15d)", value: "15" },
            { label: "Urgente (≤30d)", value: "30" },
            { label: "Atenção (≤60d)", value: "60" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setUrgenciaFilter(f.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                urgenciaFilter === f.value
                  ? "bg-[#03a4ed] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 mt-2 text-sm">Carregando...</p>
          </div>
        ) : renovacoesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhuma renovacao encontrada.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {renovacoesFiltradas.map((r) => {
                const urg = getUrgencia(r.diasParaVencer);
                return (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/cotacoes/${r.id}`} className="text-sm font-semibold text-slate-900 hover:text-[#03a4ed] transition-colors line-clamp-2 flex-1">
                        {r.name}
                      </Link>
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border ${URGENCIA_BADGE[urg.key]}`}>
                        {urg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {r.seguradora && <span>{r.seguradora}</span>}
                      {r.produto && <span>{r.produto}</span>}
                      {r.fimVigencia && (
                        <span>Venc: {new Date(r.fimVigencia).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{fmt(r.aReceber)}</span>
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold capitalize bg-slate-100 text-slate-600">
                        {r.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Nome</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Seguradora</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Produto</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Fim Vigencia</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Urgencia</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">A Receber</th>
                    {userRole === "admin" && (
                      <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Cotador</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {renovacoesFiltradas.map((r) => {
                    const urg = getUrgencia(r.diasParaVencer);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[250px] truncate">
                          <Link href={`/cotacoes/${r.id}`} className="hover:text-[#03a4ed] transition-colors">
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold capitalize bg-slate-100 text-slate-600">
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.seguradora || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{r.produto || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.fimVigencia
                            ? new Date(r.fimVigencia).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${URGENCIA_BADGE[urg.key]}`}>
                            {urg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(r.aReceber)}</td>
                        {userRole === "admin" && (
                          <td className="px-4 py-3 text-slate-600">{r.cotador || "—"}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <span className="text-white font-bold text-lg">{value}</span>
        </div>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
    </div>
  );
}
