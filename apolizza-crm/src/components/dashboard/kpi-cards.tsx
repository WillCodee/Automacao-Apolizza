"use client";

import { useState, useEffect, useCallback } from "react";
import { CardFilter } from "./card-filter";

type KpiData = {
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  emAndamento: number;
  totalAReceber: number;
  totalValorPerda: number;
  totalPremio: number;
  taxaConversao: number;
  // Renovações
  totalRenovacoes: number;
  fechadasRenovacao: number;
  aReceberRenovacao: number;
  perdasRenovacao: number;
  // Novas
  totalNovas: number;
  fechadasNovas: number;
  aReceberNovas: number;
};

const MES_OPTIONS_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function KpiCardsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 opacity-50 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border-l-4 border-l-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="w-9 h-9 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-8 w-32 bg-slate-100 rounded mb-2" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini-tag de renovação / novas
function SplitBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}18`, color }}>
      {label}: {value}
    </span>
  );
}

export function KpiCards() {
  const currentYear = String(new Date().getFullYear());
  const currentMes = MES_OPTIONS_ARR[new Date().getMonth()];

  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState(currentMes);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ ano });
    if (mes) params.set("mes", mes);
    const res = await fetch(`/api/dashboard?${params}`);
    const json = await res.json();
    setKpis(json.data?.kpis ?? null);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <KpiCardsSkeleton />;
  if (!kpis) return null;

  const taxaRenov = kpis.totalRenovacoes > 0
    ? Math.round((kpis.fechadasRenovacao / kpis.totalRenovacoes) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-900">Indicadores</h3>
        <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
      </div>

      {/* ── 4 KPI cards principais ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total Cotações */}
        <div className="bg-white rounded-xl border-l-4 border-l-[#03a4ed] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Total Cotações</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#03a4ed]/10 text-[#03a4ed]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.totalCotacoes}</p>
          <p className="text-xs text-slate-400 mt-1">
            {kpis.fechadas} fechadas · {kpis.perdas} perdas · {kpis.emAndamento} em andamento
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            <SplitBadge label="Renov." value={String(kpis.totalRenovacoes)} color="#8b5cf6" />
            <SplitBadge label="Novas" value={String(kpis.totalNovas)} color="#03a4ed" />
          </div>
        </div>

        {/* Comissão A Receber */}
        <div className="bg-white rounded-xl border-l-4 border-l-emerald-500 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Comissão (A Receber)</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{fmt(kpis.totalAReceber)}</p>
          <p className="text-xs text-slate-400 mt-1">{kpis.fechadas} cotações fechadas</p>
          <div className="flex flex-wrap gap-1 mt-2">
            <SplitBadge label="Renov." value={fmt(kpis.aReceberRenovacao)} color="#8b5cf6" />
            <SplitBadge label="Novas"  value={fmt(kpis.aReceberNovas)}     color="#10b981" />
          </div>
        </div>

        {/* Valor em Perda */}
        <div className="bg-white rounded-xl border-l-4 border-l-[#ff695f] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Valor em Perda</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#ff695f]/10 text-[#ff695f]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-[#ff695f]">{fmt(kpis.totalValorPerda)}</p>
          <p className="text-xs text-slate-400 mt-1">{kpis.perdas} cotação(ões)</p>
          {kpis.perdasRenovacao > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <SplitBadge label="Renov. perdidas" value={String(kpis.perdasRenovacao)} color="#ff695f" />
            </div>
          )}
        </div>

        {/* Taxa de Conversão */}
        <div className="bg-white rounded-xl border-l-4 border-l-violet-500 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Taxa de Conversão</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-violet-700">{kpis.taxaConversao}%</p>
          <p className="text-xs text-slate-400 mt-1">{kpis.emAndamento} em andamento</p>
          {kpis.totalRenovacoes > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <SplitBadge label="Tx. Renov." value={`${taxaRenov}%`} color="#8b5cf6" />
            </div>
          )}
        </div>
      </div>

      {/* ── Faixa de renovações ── */}
      {kpis.totalRenovacoes > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Renovações</span>
          </div>
          <span className="text-xs text-violet-600">{kpis.totalRenovacoes} no período</span>
          <span className="text-xs text-violet-600">{kpis.fechadasRenovacao} fechadas</span>
          <span className="text-xs font-semibold text-violet-800">{fmt(kpis.aReceberRenovacao)} a receber</span>
          {kpis.perdasRenovacao > 0 && (
            <span className="text-xs text-red-500">{kpis.perdasRenovacao} perdidas</span>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {kpis.totalAReceber > 0
              ? `${Math.round((kpis.aReceberRenovacao / kpis.totalAReceber) * 100)}% do total`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}
