"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface Semana {
  semana: number;
  novas: number;
  fechadas: number;
  perdas: number;
  ganho: number;
  ganhoAcumulado: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(v: number) {
  return v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : fmt(v);
}

// ── Termômetro ────────────────────────────────────────────────────────────────
function ThermometerSVG({ pct, color }: { pct: number; color: string }) {
  const clampedPct = Math.min(pct, 120);
  const tubeX = 38, tubeY = 22, tubeW = 34, tubeH = 300;
  const fillHeight = Math.min((clampedPct / 120) * tubeH, tubeH);
  const bulbCy = tubeY + tubeH + 44;
  const bulbR = 36, innerR = 27;
  const cx = tubeX + tubeW / 2;

  return (
    <svg
      viewBox={`0 0 115 ${bulbCy + bulbR + 18}`}
      style={{ height: 500, width: "auto" }}
      className="mx-auto"
    >
      {/* Tube background */}
      <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={tubeW / 2} fill="#1e293b" stroke="#334155" strokeWidth="2" />
      {/* Fill */}
      <rect
        x={tubeX + 2}
        y={tubeY + tubeH - fillHeight}
        width={tubeW - 4}
        height={fillHeight}
        rx={(tubeW - 4) / 2}
        fill={color}
        style={{ transition: "all 1s ease-in-out" }}
      />
      {/* Bulb */}
      <circle cx={cx} cy={bulbCy} r={bulbR} fill={color} style={{ transition: "all 1s ease-in-out" }} />
      <circle cx={cx} cy={bulbCy} r={innerR} fill="#0f172a" />
      <text x={cx} y={bulbCy + 6} textAnchor="middle" fill="white" fontSize="17" fontWeight="bold">
        {pct.toFixed(0)}%
      </text>
      {/* Scale */}
      {[0, 25, 50, 75, 100].map(mark => {
        const y = tubeY + tubeH - (mark / 120) * tubeH;
        return (
          <g key={mark}>
            <line x1={tubeX + tubeW} y1={y} x2={tubeX + tubeW + 12} y2={y} stroke="#475569" strokeWidth="1.5" />
            <text x={tubeX + tubeW + 16} y={y + 4} fill="#94a3b8" fontSize="11">{mark}%</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── MetaCard ──────────────────────────────────────────────────────────────────
function MetaCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl" style={{ padding: "16px 20px" }}>
      <p className="text-slate-400 font-medium" style={{ fontSize: 14, marginBottom: 6 }}>
        {label}
      </p>
      <p className={`font-bold leading-tight ${color}`} style={{ fontSize: 32 }}>
        {value}
      </p>
      {sub && (
        <p className="text-slate-400" style={{ fontSize: 13, marginTop: 4 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Main slide ────────────────────────────────────────────────────────────────
export default function TvMetaSlide({ metaMensal, semanas }: { metaMensal: number | null; semanas: Semana[] }) {
  if (metaMensal === null || metaMensal === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-slate-400 font-semibold text-center" style={{ fontSize: 32 }}>
          Meta mensal não definida
        </p>
      </div>
    );
  }

  const totalAtingido = semanas.length > 0 ? semanas[semanas.length - 1].ganhoAcumulado : 0;
  const pct = (totalAtingido / metaMensal) * 100;
  const faltam = Math.max(metaMensal - totalAtingido, 0);
  const batida = pct >= 100;

  const now = new Date();
  const weekNum = Math.min(Math.ceil(now.getDate() / 7), 4);
  const semanaAtual = semanas.find(s => s.semana === weekNum);

  const color = pct >= 100 ? "#22c55e" : pct >= 60 ? "#03a4ed" : "#ef4444";

  // ── Chart ──────────────────────────────────────────────────────────────────
  const lastDataIdx = semanas.reduce((acc, s, i) => (s.ganho > 0 ? i : acc), -1);
  const barColors = semanas.map((s, i) => {
    if (i === lastDataIdx && weekNum === s.semana) return "#03a4ed";
    if (i <= lastDataIdx) return "rgba(3,164,237,0.5)";
    return "rgba(100,116,139,0.25)";
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any = {
    labels: semanas.map(s => `Sem. ${s.semana}`),
    datasets: [
      {
        type: "bar" as const,
        label: "A Receber (R$)",
        data: semanas.map(s => s.ganho),
        backgroundColor: barColors,
        borderRadius: 6,
        borderSkipped: false,
        order: 2,
      },
      {
        type: "line" as const,
        label: `Meta: ${fmt(metaMensal)}`,
        data: semanas.map(() => metaMensal),
        borderColor: "#ef4444",
        borderWidth: 2.5,
        borderDash: [10, 6],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 1,
      },
    ],
  };

  const yMax =
    Math.ceil(
      Math.max(metaMensal, ...semanas.map(s => s.ganho), 1) * 1.3 / 50000
    ) * 50000 || 100000;

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { boxWidth: 14, font: { size: 15 }, padding: 16, color: "#94a3b8" },
      },
      tooltip: {
        callbacks: {
          label(ctx) { return ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}`; },
          afterBody(items) {
            const s = semanas[items[0]?.dataIndex ?? -1];
            return s?.ganhoAcumulado > 0 ? [` Acumulado: ${fmt(s.ganhoAcumulado)}`] : [];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 16 }, color: "#94a3b8" },
        border: { color: "#334155" },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        grid: { color: "rgba(51,65,85,0.4)" },
        ticks: { font: { size: 14 }, color: "#94a3b8", callback: v => fmtK(Number(v)) },
        border: { color: "#334155" },
      },
    },
  };

  return (
    <div className="flex h-full">
      {/* ── Left: Termômetro + Cards ───────────────────────────────────────── */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 540, padding: "18px 20px 18px 28px", gap: 20 }}
      >
        {/* Termômetro */}
        <div className="flex flex-col items-center flex-shrink-0">
          <ThermometerSVG pct={pct} color={color} />
          {batida && (
            <div
              className="px-4 py-2 bg-green-600/20 border border-green-500/40 rounded-xl"
              style={{ marginTop: 10 }}
            >
              <span className="text-green-400 font-bold tracking-wider" style={{ fontSize: 22 }}>
                META BATIDA!
              </span>
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: 14 }}>
          <MetaCard label="Meta Mensal" value={fmt(metaMensal)} color="text-slate-300" />
          <MetaCard
            label="Total Atingido"
            value={fmt(totalAtingido)}
            sub={`${pct.toFixed(1)}% da meta`}
            color="text-sky-400"
          />
          <MetaCard
            label="Faltam"
            value={fmt(faltam)}
            color={batida ? "text-green-400" : "text-orange-400"}
          />
          <MetaCard
            label={`Semana ${weekNum}`}
            value={fmt(semanaAtual?.ganho ?? 0)}
            sub={`${semanaAtual?.fechadas ?? 0} fechadas`}
            color="text-purple-400"
          />
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 my-5" style={{ width: 1, background: "rgba(51,65,85,0.7)" }} />

      {/* ── Right: Gráfico Semanal ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ padding: "20px 32px 20px 28px" }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <p className="font-bold text-white" style={{ fontSize: 20 }}>
            Progresso Semanal vs. Meta Mensal
          </p>
          <p className="text-slate-400" style={{ fontSize: 13, marginTop: 3 }}>
            Acompanhamento semana a semana do mês corrente
          </p>
        </div>

        {/* Semana cards */}
        <div className="grid grid-cols-4" style={{ gap: 10, marginBottom: 16 }}>
          {semanas.map(s => {
            const isCurrent = s.semana === weekNum;
            return (
              <div
                key={s.semana}
                className={`rounded-xl border text-center ${
                  isCurrent
                    ? "border-sky-500/60 bg-sky-500/10"
                    : "border-slate-700/40 bg-slate-800/50"
                }`}
                style={{ padding: "10px 8px" }}
              >
                <p
                  className={`font-bold ${isCurrent ? "text-sky-400" : "text-slate-400"}`}
                  style={{ fontSize: 13 }}
                >
                  Semana {s.semana}
                </p>
                <p className="text-white font-bold" style={{ fontSize: 20, marginTop: 2 }}>
                  {fmt(s.ganho)}
                </p>
                <p className="text-slate-400" style={{ fontSize: 12, marginTop: 2 }}>
                  {s.fechadas} fechadas
                </p>
                {s.ganhoAcumulado > 0 && (
                  <p className="text-emerald-400" style={{ fontSize: 11, marginTop: 2 }}>
                    Acum: {fmt(s.ganhoAcumulado)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0">
          <Chart type="bar" data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
}
