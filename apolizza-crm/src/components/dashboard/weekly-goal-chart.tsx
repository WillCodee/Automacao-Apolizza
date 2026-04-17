"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

type Semana = {
  semana: number;
  novas: number;
  fechadas: number;
  perdas: number;
  ganho: number;
  ganhoAcumulado: number;
};

const fmtCur = (v: number) =>
  v >= 1000
    ? `R$${(v / 1000).toFixed(1)}k`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCurFull = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function WeeklyGoalChart() {
  const now = new Date();
  const currentMes = MES_ARR[now.getMonth()];
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(currentMes);
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [metaMensal, setMetaMensal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/semanal?ano=${ano}&mes=${mes}`);
      const json = await res.json();
      setSemanas(json.data?.semanas ?? []);
      setMetaMensal(json.data?.metaMensal ?? null);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const labels = ["Sem. 1", "Sem. 2", "Sem. 3", "Sem. 4"];
  const totalCotacoes = semanas.reduce((s, w) => s + w.novas, 0);
  const totalFechadas = semanas.reduce((s, w) => s + w.fechadas, 0);
  const totalGanho = semanas[3]?.ganhoAcumulado ?? semanas.at(-1)?.ganhoAcumulado ?? 0;
  const pct = metaMensal && metaMensal > 0 ? (totalGanho / metaMensal) * 100 : null;
  const pctBar = pct !== null ? Math.min(pct, 100) : null;

  // Meta linear: onde deveria estar ao fim de cada semana
  const metaLinear = metaMensal
    ? labels.map((_, i) => parseFloat(((metaMensal / 4) * (i + 1)).toFixed(2)))
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Cotações no período",
        data: semanas.map((s) => s.novas),
        backgroundColor: "rgba(3,164,237,0.75)",
        borderRadius: 4,
        yAxisID: "yQtd",
        order: 3,
      },
      {
        type: "bar" as const,
        label: "Fechadas",
        data: semanas.map((s) => s.fechadas),
        backgroundColor: "rgba(16,185,129,0.85)",
        borderRadius: 4,
        yAxisID: "yQtd",
        order: 2,
      },
      {
        type: "line" as const,
        label: "Ganho acumulado",
        data: semanas.map((s) => s.ganhoAcumulado),
        borderColor: "#ff695f",
        backgroundColor: "rgba(255,105,95,0.1)",
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: "#ff695f",
        fill: true,
        tension: 0.3,
        yAxisID: "yValor",
        order: 1,
      },
      ...(metaLinear
        ? [
            {
              type: "line" as const,
              label: "Ritmo ideal (meta)",
              data: metaLinear,
              borderColor: "#8b5cf6",
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 3,
              pointBackgroundColor: "#8b5cf6",
              fill: false,
              tension: 0,
              yAxisID: "yValor",
              order: 0,
            },
          ]
        : []),
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: { boxWidth: 12, font: { size: 11 }, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const label = ctx.dataset.label ?? "";
            const val = ctx.parsed.y ?? 0;
            if (ctx.dataset.yAxisID === "yValor") {
              return ` ${label}: ${fmtCurFull(val)}`;
            }
            return ` ${label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 12 } },
      },
      yQtd: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: "rgba(0,0,0,0.05)" },
        title: { display: true, text: "Qtd. Cotações", font: { size: 10 } },
      },
      yValor: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        grid: { display: false },
        ticks: {
          font: { size: 11 },
          callback: (v) => fmtCur(Number(v)),
        },
        title: { display: true, text: "Faturamento", font: { size: 10 } },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Progresso Semanal</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cotações e faturamento por semana — mesmos dados do dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none"
          >
            {MES_ARR.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="px-5 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total no período</p>
          <p className="text-lg font-bold text-[#03a4ed] mt-0.5">{totalCotacoes}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Fechadas</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">{totalFechadas}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Ganho total</p>
          <p className="text-lg font-bold text-[#ff695f] mt-0.5">{fmtCur(totalGanho)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
            {metaMensal ? "% da meta mensal" : "Meta mensal"}
          </p>
          {metaMensal ? (
            <div className="mt-1">
              <p className={`text-lg font-bold ${(pct ?? 0) >= 100 ? "text-emerald-600" : (pct ?? 0) >= 50 ? "text-[#03a4ed]" : "text-amber-500"}`}>
                {pct?.toFixed(0)}%
              </p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pctBar ?? 0}%`,
                    backgroundColor: (pct ?? 0) >= 100 ? "#10b981" : (pct ?? 0) >= 50 ? "#03a4ed" : "#f59e0b",
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Meta: {fmtCur(metaMensal)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-0.5">Não definida</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pb-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-56">
            <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : totalCotacoes === 0 ? (
          <div className="flex items-center justify-center h-56 text-slate-400 text-sm">
            Nenhuma cotação encontrada para {mes}/{ano}
          </div>
        ) : (
          <div className="h-56">
            <Chart type="bar" data={chartData} options={options} />
          </div>
        )}
      </div>

      {/* Legend explicativa */}
      {totalCotacoes > 0 && (
        <div className="px-5 pb-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-50 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "rgba(3,164,237,0.75)" }} />
            Cotações no período (por semana de atualização)
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "rgba(16,185,129,0.85)" }} />
            Fechadas naquela semana
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: "#ff695f" }} />
            Faturamento acumulado
          </span>
          {metaMensal && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="inline-block w-5 border-t-2 border-dashed border-violet-500" />
              Ritmo ideal para bater a meta
            </span>
          )}
        </div>
      )}
    </div>
  );
}
