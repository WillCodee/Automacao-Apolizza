"use client";

import { useState, useEffect, useCallback } from "react";
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
  type ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const MES_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

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
    ? `R$${(v / 1000).toFixed(0)}k`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCurFull = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Returns the week number (1-4) for today given year/mesIndex (0-based)
function getCurrentWeek(year: number, mesIndex: number): number {
  const today = new Date();
  if (today.getFullYear() !== year || today.getMonth() !== mesIndex) return -1;
  const day = today.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

// Date range strings per week: ["01/04 - 07/04", "08/04 - 14/04", ...]
function getWeekDateRanges(year: number, mesIndex: number): string[] {
  const lastDay = new Date(year, mesIndex + 1, 0).getDate();
  const mm = String(mesIndex + 1).padStart(2, "0");
  return [
    `01/${mm} - 07/${mm}`,
    `08/${mm} - 14/${mm}`,
    `15/${mm} - 21/${mm}`,
    `22/${mm} - ${String(lastDay).padStart(2, "0")}/${mm}`,
  ];
}

// ── Termômetro SVG ─────────────────────────────────────────────────────────────
function Thermometer({
  pct,
  metaMensal,
  ganhoAtual,
}: {
  pct: number;
  metaMensal: number;
  ganhoAtual: number;
}) {
  const safe = Math.min(Math.max(pct, 0), 100);
  const tubeH = 150;
  const fillH = (safe / 100) * tubeH;
  const color = safe >= 100 ? "#10b981" : safe >= 60 ? "#03a4ed" : "#ff695f";
  const tubeTop = 18;

  return (
    <div className="flex flex-col items-center select-none">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide text-center leading-tight mb-2">
        Termômetro de<br />Meta Mensal
      </p>

      <svg viewBox="0 0 64 230" width={64} height={230}>
        {/* Scale labels */}
        <text x="20" y={tubeTop + 4}  fontSize="7" fill="#94a3b8" textAnchor="end">{fmtCur(metaMensal)}</text>
        <text x="20" y={tubeTop + tubeH / 2 + 4} fontSize="7" fill="#94a3b8" textAnchor="end">{fmtCur(metaMensal * 0.5)}</text>
        <text x="20" y={tubeTop + tubeH + 4} fontSize="7" fill="#94a3b8" textAnchor="end">0</text>

        {/* Tick marks */}
        <line x1="22" y1={tubeTop}              x2="28" y2={tubeTop}              stroke="#cbd5e1" strokeWidth="1" />
        <line x1="22" y1={tubeTop + tubeH / 2}  x2="28" y2={tubeTop + tubeH / 2}  stroke="#cbd5e1" strokeWidth="1" />
        <line x1="22" y1={tubeTop + tubeH}       x2="28" y2={tubeTop + tubeH}       stroke="#cbd5e1" strokeWidth="1" />

        {/* Tube background */}
        <rect x="28" y={tubeTop} width="14" height={tubeH} rx="7" fill="#e2e8f0" />

        {/* Fill clip */}
        <clipPath id="tubeClip">
          <rect x="28" y={tubeTop} width="14" height={tubeH} rx="7" />
        </clipPath>
        <rect
          x="28"
          y={tubeTop + tubeH - fillH}
          width="14"
          height={fillH}
          fill={color}
          clipPath="url(#tubeClip)"
        />

        {/* Bulb */}
        <circle cx="35" cy={tubeTop + tubeH + 22} r="20" fill="#e2e8f0" />
        <circle cx="35" cy={tubeTop + tubeH + 22} r="16" fill={color} />
        <text
          x="35"
          y={tubeTop + tubeH + 27}
          fontSize="11"
          fontWeight="bold"
          fill="white"
          textAnchor="middle"
        >
          {safe.toFixed(0)}%
        </text>
      </svg>

      <p className="text-[9px] text-slate-400 text-center leading-tight mt-1">
        {fmtCur(ganhoAtual)}<br />de {fmtCur(metaMensal)}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function WeeklyGoalChart() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(MES_ARR[now.getMonth()]);
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [metaMensal, setMetaMensal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const mesIndex = MES_ARR.indexOf(mes);
  const mesName = MES_NAMES[mesIndex];

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

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalGanho = semanas.at(-1)?.ganhoAcumulado ?? 0;
  const pct = metaMensal && metaMensal > 0 ? (totalGanho / metaMensal) * 100 : null;
  const falta = metaMensal ? Math.max(metaMensal - totalGanho, 0) : null;

  // % change from previous week to last week with data
  const lastWithData = [...semanas].reverse().find((s) => s.ganho > 0);
  const prevIndex = lastWithData ? semanas.findIndex((s) => s.semana === lastWithData.semana) - 1 : -1;
  const prevGanho = prevIndex >= 0 ? semanas[prevIndex].ganho : 0;
  const progressoSemanal =
    lastWithData && prevGanho > 0
      ? ((lastWithData.ganho - prevGanho) / prevGanho) * 100
      : null;

  // ── Chart setup ──────────────────────────────────────────────────────────────
  const dateRanges = getWeekDateRanges(ano, mesIndex);
  const currentWeek = getCurrentWeek(ano, mesIndex);

  // Determine last week index that has data
  const lastDataIdx = [...semanas].reduce(
    (acc, s, i) => (s.ganho > 0 ? i : acc),
    -1
  );

  const barColors = semanas.map((s, i) => {
    if (i === lastDataIdx && currentWeek === s.semana) return "#03a4ed";   // current week — solid blue
    if (i <= lastDataIdx) return "rgba(3,164,237,0.55)";                   // past weeks — lighter
    return "rgba(203,213,225,0.5)";                                        // future weeks — gray
  });

  const ganhoData = semanas.map((s) => s.ganho);
  const metaLineData = metaMensal ? semanas.map(() => metaMensal) : null;

  const yMax = Math.ceil(
    Math.max(...(metaMensal ? [metaMensal] : []), ...ganhoData, 1) * 1.25 / 100000
  ) * 100000 || 100000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any = {
    labels: semanas.map((s) => [`Semana ${s.semana}`, dateRanges[s.semana - 1]]),
    datasets: [
      {
        type: "bar" as const,
        label: "Actuals atual (R$)",
        data: ganhoData,
        backgroundColor: barColors,
        borderRadius: 4,
        borderSkipped: false,
        order: 2,
      },
      ...(metaLineData
        ? [
            {
              type: "line" as const,
              label: `META MENSAL: ${fmtCurFull(metaMensal!)}`,
              data: metaLineData,
              borderColor: "#ef4444",
              borderWidth: 2,
              borderDash: [8, 5],
              pointRadius: 0,
              fill: false,
              tension: 0,
              order: 1,
            },
          ]
        : []),
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          font: { size: 10 },
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const val = ctx.parsed.y ?? 0;
            return ` ${ctx.dataset.label}: ${fmtCurFull(val)}`;
          },
          afterBody(items) {
            const idx = items[0]?.dataIndex ?? -1;
            const s = semanas[idx];
            if (!s) return [];
            const lines = [];
            if (s.ganhoAcumulado > 0)
              lines.push(` Acumulado: ${fmtCurFull(s.ganhoAcumulado)}`);
            if (pct !== null && idx === lastDataIdx)
              lines.push(` Progresso: ${pct.toFixed(0)}% da meta`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 } },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: {
          font: { size: 10 },
          callback: (v) => fmtCur(Number(v)),
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

      {/* ── Dark header ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">
            Visão Semanal de Progresso da Meta Mensal
          </h3>
          <p className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">
            {mesName} {ano}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-7 rounded-lg border border-slate-600 bg-slate-700 px-2 text-[11px] text-white focus:outline-none"
          >
            {MES_ARR.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-7 rounded-lg border border-slate-600 bg-slate-700 px-2 text-[11px] text-white focus:outline-none"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-100 bg-slate-50/50">

        {/* Meta Mensal */}
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Meta Mensal</p>
          <p className="text-sm font-bold text-slate-800 mt-1 truncate">
            {metaMensal ? fmtCurFull(metaMensal) : "—"}
          </p>
        </div>

        {/* Total Atingido — highlighted */}
        <div className="rounded-xl border border-[#03a4ed] bg-[#03a4ed] px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-blue-100 uppercase tracking-wide">Total Atingido</p>
          <p className="text-sm font-bold text-white mt-1 truncate">{fmtCurFull(totalGanho)}</p>
          {pct !== null && (
            <p className="text-[10px] font-semibold text-blue-100 mt-0.5">({pct.toFixed(0)}%)</p>
          )}
        </div>

        {/* Faltam */}
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Faltam</p>
          <p className="text-sm font-bold text-slate-800 mt-1 truncate">
            {falta !== null ? fmtCurFull(falta) : "—"}
          </p>
        </div>

        {/* Progresso Semanal */}
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Progresso Semanal</p>
          {progressoSemanal !== null ? (
            <>
              <p className={`text-sm font-bold mt-1 ${progressoSemanal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {progressoSemanal >= 0 ? "+" : ""}{progressoSemanal.toFixed(0)}%
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">vs. Semana Anterior</p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">—</p>
          )}
        </div>
      </div>

      {/* ── Body: chart + thermometer ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pt-3 pb-4 flex items-start gap-4">

          {/* Chart */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-600 text-center mb-2">
              Progresso Semanal vs. Meta Mensal — {mesName} {ano}
            </p>
            <div className="h-52">
              <Chart type="bar" data={chartData} options={options} />
            </div>
          </div>

          {/* Thermometer */}
          {metaMensal ? (
            <div className="shrink-0 pt-1">
              <Thermometer
                pct={pct ?? 0}
                metaMensal={metaMensal}
                ganhoAtual={totalGanho}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
