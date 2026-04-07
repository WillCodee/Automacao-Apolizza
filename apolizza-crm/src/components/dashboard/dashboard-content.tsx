"use client";

import { useState, useEffect, useCallback } from "react";
import { KpiCards } from "./kpi-cards";
import { StatusBreakdown } from "./status-breakdown";
import { MonthlyChart } from "./monthly-chart";
import { CotadoresTable } from "./cotadores-table";
import { RecentCotacoes } from "./recent-cotacoes";
import { MetasCard } from "./metas-card";

type DashboardData = {
  kpis: {
    totalCotacoes: number;
    fechadas: number;
    perdas: number;
    emAndamento: number;
    totalAReceber: number;
    totalValorPerda: number;
    totalPremio: number;
    taxaConversao: number;
  };
  statusBreakdown: { status: string; count: number; total: number }[];
  monthlyTrend: { mes: string; ano: number; fechadas: number; perdas: number; total: number; aReceber: number }[];
  cotadores: { userId: string; name: string; photoUrl?: string; totalCotacoes: number; fechadas: number; faturamento: number; taxaConversao: number }[];
};

export function DashboardContent({ userRole }: { userRole: "admin" | "cotador" }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/dashboard?${params}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm text-slate-500 font-medium whitespace-nowrap">De:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-white"
        />
        <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Até:</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-white"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ✕ Limpar
          </button>
        )}
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-3 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 mt-3 text-sm">Carregando dashboard...</p>
        </div>
      ) : data ? (
        <>
          <KpiCards kpis={data.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MonthlyChart data={data.monthlyTrend} />
            </div>
            <div className="space-y-6">
              <MetasCard
                kpis={data.kpis}
                ano={dateFrom ? new Date(dateFrom).getFullYear() : new Date().getFullYear()}
                isAdmin={userRole === "admin"}
              />
              <StatusBreakdown data={data.statusBreakdown} />
            </div>
          </div>

          {userRole === "admin" && data.cotadores.length > 0 && (
            <CotadoresTable data={data.cotadores} />
          )}

          <RecentCotacoes />
        </>
      ) : (
        <div className="text-center py-16 text-[#ff695f]">Erro ao carregar dashboard.</div>
      )}
    </div>
  );
}
