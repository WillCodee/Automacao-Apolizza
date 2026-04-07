"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { MES_OPTIONS, ANO_OPTIONS } from "@/lib/constants";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

type Kpis = {
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  emAndamento: number;
  totalAReceber: number;
  totalValorPerda: number;
  prev: {
    totalCotacoes: number;
    fechadas: number;
    totalAReceber: number;
    totalValorPerda: number;
  };
};

type CotadorRank = {
  userId: string;
  name: string;
  photoUrl: string | null;
  totalCotacoes: number;
  fechadas: number;
  faturamento: number;
  taxaConversao: number;
};

type PipelineItem = {
  seguradora?: string;
  produto?: string;
  total: number;
  fechadas: number;
  valor: number;
};

type EvolucaoItem = {
  mes: string;
  ano: number;
  total: number;
  fechadas: number;
  faturamento: number;
};

type ReportData = {
  kpis: Kpis;
  ranking: CotadorRank[];
  pipelineSeguradora: PipelineItem[];
  pipelineProduto: PipelineItem[];
  evolucao: EvolucaoItem[];
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function pctChange(curr: number, prev: number): { value: string; positive: boolean } {
  if (prev === 0) return { value: curr > 0 ? "+100%" : "0%", positive: curr >= 0 };
  const pct = ((curr - prev) / prev) * 100;
  return {
    value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
    positive: pct >= 0,
  };
}

export function RelatorioMensal() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [mes, setMes] = useState(MES_OPTIONS[new Date().getMonth()] as string);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ ano });
    if (mes) params.set("mes", mes);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/relatorios?${params}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }, [ano, mes, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-3 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 mt-3 text-sm">Gerando relatorio...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-16 text-[#ff695f]">Erro ao carregar relatorio.</div>;
  }

  const { kpis, ranking, pipelineSeguradora, pipelineProduto, evolucao } = data;

  const evolLabels = evolucao.map((e) => `${e.mes}/${e.ano}`);
  const chartData = {
    labels: evolLabels,
    datasets: [
      {
        label: "Faturamento",
        data: evolucao.map((e) => e.faturamento),
        backgroundColor: "#22c55e",
        borderRadius: 6,
      },
      {
        label: "Fechadas",
        data: evolucao.map((e) => e.fechadas),
        backgroundColor: "#03a4ed",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { boxWidth: 12, font: { size: 11, family: "Poppins" }, usePointStyle: true, pointStyle: "circle" as const } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { font: { size: 11, family: "Poppins" } } },
      x: { grid: { display: false }, ticks: { font: { size: 10, family: "Poppins" } } },
    },
  };

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>
      {/* Filters + Print */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <select
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
        >
          {ANO_OPTIONS.map((a) => (
            <option key={a} value={String(a)}>{a}</option>
          ))}
        </select>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
        >
          <option value="">Ano inteiro</option>
          {MES_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
          onClick={handlePrint}
          className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-apolizza-gradient hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>

      {/* KPIs with comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Cotacoes", value: kpis.totalCotacoes, prev: kpis.prev.totalCotacoes, isCurrency: false, color: "border-l-[#03a4ed]" },
          { label: "Fechadas", value: kpis.fechadas, prev: kpis.prev.fechadas, isCurrency: false, color: "border-l-emerald-500" },
          { label: "Faturamento", value: kpis.totalAReceber, prev: kpis.prev.totalAReceber, isCurrency: true, color: "border-l-emerald-500" },
          { label: "Valor em Perda", value: kpis.totalValorPerda, prev: kpis.prev.totalValorPerda, isCurrency: true, color: "border-l-[#ff695f]" },
        ].map((kpi) => {
          const change = pctChange(kpi.value, kpi.prev);
          return (
            <div key={kpi.label} className={`bg-white rounded-xl border-l-4 ${kpi.color} p-5 shadow-sm`}>
              <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {kpi.isCurrency ? fmt(kpi.value) : kpi.value}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs font-semibold ${change.positive ? "text-emerald-600" : "text-[#ff695f]"}`}>
                  {change.positive ? "���" : "↓"} {change.value}
                </span>
                <span className="text-xs text-slate-400">vs mes anterior</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ranking Cotadores */}
      {ranking.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Ranking de Cotadores</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-xs uppercase">#</th>
                  <th className="px-4 py-2 font-medium text-xs uppercase">Cotador</th>
                  <th className="px-4 py-2 font-medium text-xs uppercase text-center">Cotacoes</th>
                  <th className="px-4 py-2 font-medium text-xs uppercase text-center">Fechadas</th>
                  <th className="px-4 py-2 font-medium text-xs uppercase text-right">Faturamento</th>
                  <th className="px-4 py-2 font-medium text-xs uppercase text-center">Conversao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.map((r, i) => (
                  <tr key={r.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-lg">{medals[i] || `${i + 1}º`}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.photoUrl ? (
                          <img src={r.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#03a4ed]/10 flex items-center justify-center text-[#03a4ed] font-semibold text-sm">
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-slate-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.totalCotacoes}</td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.fechadas}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(r.faturamento)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#03a4ed] rounded-full"
                            style={{ width: `${Math.min(r.taxaConversao || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{r.taxaConversao || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pipeline Seguradora + Produto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seguradora */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Pipeline por Seguradora</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {pipelineSeguradora.map((item) => (
              <div key={item.seguradora} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.seguradora}</p>
                  <p className="text-xs text-slate-400">{item.total} cotacoes · {item.fechadas} fechadas</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{fmt(item.valor)}</span>
              </div>
            ))}
            {pipelineSeguradora.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sem dados</p>
            )}
          </div>
        </div>

        {/* Produto */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Pipeline por Produto</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {pipelineProduto.map((item) => (
              <div key={item.produto} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.produto}</p>
                  <p className="text-xs text-slate-400">{item.total} cotacoes · {item.fechadas} fechadas</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{fmt(item.valor)}</span>
              </div>
            ))}
            {pipelineProduto.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Evolução 12 meses */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Evolucao Mensal</h3>
        {evolucao.length > 0 ? (
          <div className="h-[300px]">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">Sem dados de evolucao</p>
        )}
      </div>
    </div>
  );
}
