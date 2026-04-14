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
import { ANO_OPTIONS } from "@/lib/constants";

const MESES_ORDEM = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

// Paleta de cores por ano — até 8 anos simultâneos
const ANO_COLORS: Record<number, { bg: string; border: string }> = {
  2020: { bg: "rgba(139,92,246,0.75)",  border: "#7c3aed" },
  2021: { bg: "rgba(249,115,22,0.75)",  border: "#ea580c" },
  2022: { bg: "rgba(234,179,8,0.75)",   border: "#ca8a04" },
  2023: { bg: "rgba(239,68,68,0.75)",   border: "#dc2626" },
  2024: { bg: "rgba(3,164,237,0.75)",   border: "#0288d1" },
  2025: { bg: "rgba(34,197,94,0.75)",   border: "#16a34a" },
  2026: { bg: "rgba(255,105,95,0.75)",  border: "#e55a50" },
  2027: { bg: "rgba(20,184,166,0.75)",  border: "#0d9488" },
};
const DEFAULT_COLOR = { bg: "rgba(100,116,139,0.75)", border: "#475569" };

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
  total: number;
  fechadas: number;
  faturamento: number;
};

type EvolucaoMultiItem = {
  ano: number;
  mes: string;
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
  const currentYear = String(new Date().getFullYear());

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(currentYear);

  // Anos selecionados para o gráfico de evolução (independente do filtro de KPIs)
  const [anosEvolucao, setAnosEvolucao] = useState<string[]>([currentYear]);
  const [evolucaoMulti, setEvolucaoMulti] = useState<EvolucaoMultiItem[]>([]);
  const [loadingEvolucao, setLoadingEvolucao] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/relatorios?ano=${ano}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }, [ano]);

  const fetchEvolucao = useCallback(async () => {
    if (anosEvolucao.length === 0) { setEvolucaoMulti([]); return; }
    setLoadingEvolucao(true);
    const res = await fetch(`/api/relatorios/evolucao?anos=${anosEvolucao.join(",")}`);
    const json = await res.json();
    setEvolucaoMulti(json.data?.evolucao ?? []);
    setLoadingEvolucao(false);
  }, [anosEvolucao]);

  useEffect(() => { fetchReport(); }, [fetchReport]);
  useEffect(() => { fetchEvolucao(); }, [fetchEvolucao]);

  function toggleAnoEvolucao(a: string) {
    setAnosEvolucao((prev) =>
      prev.includes(a)
        ? prev.length > 1 ? prev.filter((x) => x !== a) : prev  // mínimo 1 ano
        : [...prev, a].sort()
    );
  }

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

  const { kpis, ranking, pipelineSeguradora, pipelineProduto } = data;

  // Agrupa dados de evolução por ano → por mês
  const anosOrdenados = [...anosEvolucao].sort();
  const chartData = {
    labels: MESES_ORDEM,
    datasets: anosOrdenados.map((anoStr) => {
      const anoN = Number(anoStr);
      const cor = ANO_COLORS[anoN] ?? DEFAULT_COLOR;
      const byMes = new Map(
        evolucaoMulti.filter((e) => e.ano === anoN).map((e) => [e.mes, e])
      );
      return {
        label: String(anoN),
        data: MESES_ORDEM.map((m) => byMes.get(m)?.faturamento ?? 0),
        backgroundColor: cor.bg,
        borderColor: cor.border,
        borderWidth: 1,
        borderRadius: 5,
      };
    }),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: { boxWidth: 12, font: { size: 11, family: "Poppins" }, usePointStyle: true, pointStyle: "circle" as const },
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#f1f5f9" },
        ticks: {
          font: { size: 11, family: "Poppins" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) =>
            `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
        },
      },
      x: { grid: { display: false }, ticks: { font: { size: 10, family: "Poppins" } } },
    },
  } as Parameters<typeof Bar>[0]["options"];

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>
      {/* Filters + Print */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Ano:</label>
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
          >
            {ANO_OPTIONS.map((a) => (
              <option key={a} value={String(a)}>{a}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePrint}
          className="ml-auto px-4 py-2 text-sm font-medium text-white rounded-xl bg-apolizza-gradient hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
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
                <span className="text-xs text-slate-400">vs {Number(ano) - 1}</span>
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

      {/* Evolução Mensal Multi-Ano */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Evolução Mensal — Faturamento (R$)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Jan → Dez · selecione os anos para comparar</p>
          </div>
          {/* Pills de seleção de ano */}
          <div className="flex flex-wrap gap-2">
            {ANO_OPTIONS.map((a) => {
              const aStr = String(a);
              const ativo = anosEvolucao.includes(aStr);
              const cor = ANO_COLORS[a] ?? DEFAULT_COLOR;
              return (
                <button
                  key={a}
                  onClick={() => toggleAnoEvolucao(aStr)}
                  style={ativo ? { backgroundColor: cor.border, borderColor: cor.border, color: "#fff" } : {}}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                    ativo
                      ? "shadow-sm"
                      : "border-slate-200 text-slate-500 bg-white hover:border-slate-400 hover:text-slate-700"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        {loadingEvolucao ? (
          <div className="h-[320px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : evolucaoMulti.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center">
            <p className="text-sm text-slate-400">Sem dados para os anos selecionados</p>
          </div>
        ) : (
          <div className="h-[320px]">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
}
