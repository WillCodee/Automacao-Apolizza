"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { STATUS_COLORS, STATUS_BADGES } from "@/lib/status-config";
import { CardFilter } from "./card-filter";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type StatusData = {
  status: string;
  count: number;
  total: number;
};

type CotacaoItem = {
  id: string;
  name: string;
  status: string;
  produto: string | null;
  seguradora: string | null;
  aReceber: number | null;
  valorPerda: number | null;
};

type DrillDown = {
  title: string;
  loading: boolean;
  items: CotacaoItem[];
  total: number;
};

type Props = {
  userRole: "admin" | "cotador" | "proprietario";
};

type ViewMode = "situacao" | "status";

type SituacaoData = {
  situacao: string;
  total: number;
  faturamento: number;
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getStatusColor(status: string) {
  return STATUS_COLORS[status.toLowerCase()] ?? "#cbd5e1";
}

function getStatusBadge(status: string) {
  return STATUS_BADGES[status.toLowerCase()] ?? "bg-slate-100 text-slate-600";
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

const fmtFull = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FilteredChart({ userRole }: Props) {
  const currentYear = String(new Date().getFullYear());

  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState("");
  const [statusBreakdown, setStatusBreakdown] = useState<StatusData[]>([]);
  const [situacaoBreakdown, setSituacaoBreakdown] = useState<SituacaoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("status");
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("ano", ano);
    if (mes) params.set("mes", mes);
    const [dashRes, analiseRes] = await Promise.all([
      fetch(`/api/dashboard?${params}`),
      fetch(`/api/analise?${params}`),
    ]);
    const dash = await dashRes.json();
    const analise = await analiseRes.json();
    setStatusBreakdown(dash.data?.statusBreakdown ?? []);
    setSituacaoBreakdown(analise.data?.porSituacao ?? []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Fetch drill-down cotacoes */
  const fetchDrillDown = useCallback(async (title: string, extraParams: Record<string, string>) => {
    setDrillDown({ title, loading: true, items: [], total: 0 });

    const params = new URLSearchParams({ limit: "50", ...extraParams });
    params.set("ano", ano);
    if (mes) params.set("mes", mes);

    const res = await fetch(`/api/cotacoes?${params}`);
    const json = await res.json();
    setDrillDown({
      title,
      loading: false,
      items: (json.data ?? []) as CotacaoItem[],
      total: json.pagination?.total ?? 0,
    });
  }, [ano, mes]);

  /* Chart click handlers */
  const handleStatusClick = useCallback(
    (_: unknown, elements: { datasetIndex: number; index: number }[]) => {
      if (!elements.length) return;
      const s = statusBreakdown[elements[0].index];
      if (!s) return;
      fetchDrillDown(`Status: ${s.status}`, { status: s.status });
    },
    [statusBreakdown, fetchDrillDown]
  );

  const handleSituacaoClick = useCallback(
    (_: unknown, elements: { datasetIndex: number; index: number }[]) => {
      if (!elements.length) return;
      const s = situacaoBreakdown[elements[0].index];
      if (!s) return;
      fetchDrillDown(`Situação: ${s.situacao}`, { situacao: s.situacao });
    },
    [situacaoBreakdown, fetchDrillDown]
  );

  /* Situação colors */
  const SITUACAO_COLORS: Record<string, string> = {
    "IMPLANTAÇÃO": "#03a4ed",
    "COTAR": "#f59e0b",
    "CCLIENTE": "#22c55e",
    "CLIENTE": "#22c55e",
    "RAUT": "#a855f7",
    "FECHADO": "#10b981",
    "PERDA/RESGATE": "#ff695f",
  };
  const getSituacaoColor = (s: string) => SITUACAO_COLORS[s.toUpperCase()] ?? "#94a3b8";

  /* Chart data */
  const situacaoChartData = {
    labels: situacaoBreakdown.map((s) => s.situacao),
    datasets: [
      {
        label: "Qtd. Cotações",
        data: situacaoBreakdown.map((s) => s.total),
        backgroundColor: situacaoBreakdown.map((s) => hexToRgba(getSituacaoColor(s.situacao), 0.8)),
        borderColor: situacaoBreakdown.map((s) => getSituacaoColor(s.situacao)),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false as const,
      },
    ],
  };

  const situacaoOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { dataIndex: number; parsed: { y: number | null } }) => {
            const s = situacaoBreakdown[ctx.dataIndex];
            const count = ctx.parsed.y ?? 0;
            return [
              ` ${count} cotações`,
              ` Faturamento: ${fmtFull(s.faturamento)}`,
              ``,
              ` Clique para ver cotações`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#f1f5f9" },
        ticks: { font: { size: 11, family: "Poppins" }, stepSize: 1 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 9, family: "Poppins" }, maxRotation: 30 },
      },
    },
    onClick: handleSituacaoClick,
  };

  const statusChartData = {
    labels: statusBreakdown.map((s) => s.status),
    datasets: [
      {
        label: "Qtd. Cotacoes",
        data: statusBreakdown.map((s) => s.count),
        backgroundColor: statusBreakdown.map((s) => hexToRgba(getStatusColor(s.status), 0.8)),
        borderColor: statusBreakdown.map((s) => getStatusColor(s.status)),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false as const,
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { dataIndex: number; parsed: { y: number | null } }) => {
            const s = statusBreakdown[ctx.dataIndex];
            const count = ctx.parsed.y ?? 0;
            const isPerda = s.status.toLowerCase() === "perda";
            return [
              ` ${count} cotacoes`,
              ` ${isPerda ? "Valor Perda" : "Valor"}: ${fmtFull(s.total)}`,
              ``,
              ` Clique para ver cotacoes`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#f1f5f9" },
        ticks: { font: { size: 11, family: "Poppins" }, stepSize: 1 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 9, family: "Poppins" }, maxRotation: 30 },
      },
    },
    onClick: handleStatusClick,
  };

  /* Summary pills */
  const totalCotacoes = statusBreakdown.reduce((a, s) => a + s.count, 0);
  const totalValor = statusBreakdown.reduce((a, s) => a + s.total, 0);
  const totalFaturamentoSituacao = situacaoBreakdown.reduce((a, s) => a + s.faturamento, 0);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Analise por Filtro Aplicado</h3>
            <p className="text-xs text-slate-400 mt-0.5">Clique em uma coluna para ver as cotacoes</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setView("situacao")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  view === "situacao"
                    ? "bg-white text-[#03a4ed] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Por Situação
              </button>
              <button
                onClick={() => setView("status")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  view === "status"
                    ? "bg-white text-[#03a4ed] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Por Status
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary pills */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-[#03a4ed]" />
                <span className="text-xs text-slate-600 font-medium">{totalCotacoes} cotações</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-600 font-medium">{fmt(view === "situacao" ? totalFaturamentoSituacao : totalValor)} em valor</span>
              </div>
            </div>

            {/* Situação color legend */}
            {view === "situacao" && situacaoBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {situacaoBreakdown.map((s) => (
                  <span key={s.situacao} className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 rounded-full px-2.5 py-1">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getSituacaoColor(s.situacao) }} />
                    {s.situacao}
                  </span>
                ))}
              </div>
            )}

            {/* Status color legend */}
            {view === "status" && statusBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {statusBreakdown.map((s) => (
                  <span key={s.status} className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 rounded-full px-2.5 py-1">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(s.status) }} />
                    {s.status}
                  </span>
                ))}
              </div>
            )}

            <div className="h-[240px]" style={{ cursor: "pointer" }}>
              {view === "situacao" && situacaoBreakdown.length > 0 ? (
                <Bar data={situacaoChartData} options={situacaoOptions} />
              ) : view === "status" && statusBreakdown.length > 0 ? (
                <Bar data={statusChartData} options={statusOptions} />
              ) : (
                <p className="text-slate-400 text-sm py-8 text-center">Sem dados para exibir</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Drill-down modal */}
      {drillDown && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setDrillDown(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 capitalize">{drillDown.title}</h4>
                {!drillDown.loading && (
                  <p className="text-xs text-slate-400 mt-0.5">{drillDown.total} cotacao{drillDown.total !== 1 ? "es" : ""} encontrada{drillDown.total !== 1 ? "s" : ""}</p>
                )}
              </div>
              <button
                onClick={() => setDrillDown(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-3">
              {drillDown.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : drillDown.items.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-10">Nenhuma cotacao encontrada</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {drillDown.items.map((item) => {
                    const isPerda = item.status.toLowerCase() === "perda";
                    const valor = isPerda ? item.valorPerda : item.aReceber;
                    return (
                      <Link
                        key={item.id}
                        href={`/cotacoes/${item.id}`}
                        onClick={() => setDrillDown(null)}
                        className="flex items-center gap-3 py-3 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-[#03a4ed] transition-colors">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {[item.produto, item.seguradora].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                        {valor != null && valor > 0 && (
                          <span className={`text-xs font-semibold whitespace-nowrap ${isPerda ? "text-[#ff695f]" : "text-emerald-600"}`}>
                            {fmtFull(valor)}
                          </span>
                        )}
                        <span className="text-slate-300 group-hover:text-slate-400 text-sm">›</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {!drillDown.loading && drillDown.total > drillDown.items.length && (
              <div className="px-5 py-3 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400">
                  Mostrando {drillDown.items.length} de {drillDown.total} —
                  <Link
                    href="/cotacoes"
                    className="text-[#03a4ed] hover:underline ml-1"
                    onClick={() => setDrillDown(null)}
                  >
                    ver todas em Cotacoes
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
