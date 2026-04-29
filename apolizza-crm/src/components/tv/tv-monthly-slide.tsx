"use client";

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
import { Chart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface MonthlyData {
  mes: string;
  ano: number;
  fechadas: number;
  perdas: number;
  total: number;
  aReceber: number;
  fechadasRenovacao: number;
  aReceberRenovacao: number;
  fechadasNovas: number;
  aReceberNovas: number;
}

const MES_ORDER: Record<string, number> = {
  JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6,
  JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12,
};

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`;
  return `R$${v.toFixed(0)}`;
}

// Fixed font sizes designed for 1920×1080 (scale transform handles other resolutions)
const FONTS = { legend: 18, tick: 15, tooltip: 16 };

export default function TvMonthlySlide({ monthlyTrend }: { monthlyTrend: MonthlyData[] }) {
  const sorted = [...monthlyTrend].sort((a, b) => {
    if (a.ano !== b.ano) return a.ano - b.ano;
    return (MES_ORDER[a.mes] ?? 0) - (MES_ORDER[b.mes] ?? 0);
  });
  const data = sorted.slice(-6);
  const labels = data.map(d => d.mes);

  const chartData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Fechadas",
        data: data.map(d => d.fechadas),
        backgroundColor: "rgba(34, 197, 94, 0.7)",
        borderColor: "#22c55e",
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Perdas",
        data: data.map(d => d.perdas),
        backgroundColor: "rgba(255, 105, 95, 0.7)",
        borderColor: "#ff695f",
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "line" as const,
        label: "Faturamento",
        data: data.map(d => d.aReceber),
        borderColor: "#03a4ed",
        backgroundColor: "rgba(3, 164, 237, 0.1)",
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: "#03a4ed",
        tension: 0.3,
        fill: true,
        yAxisID: "y1",
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#e2e8f0",
          font: { size: FONTS.legend, family: "Poppins" },
          padding: 16,
          boxWidth: 14,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#e2e8f0",
        bodyColor: "#e2e8f0",
        borderColor: "#334155",
        borderWidth: 1,
        titleFont: { size: FONTS.tooltip, family: "Poppins" },
        bodyFont: { size: FONTS.tooltip, family: "Poppins" },
        padding: 10,
        callbacks: {
          label(ctx: { dataset: { label?: string }; parsed: { y: number | null } }) {
            const label = ctx.dataset.label || "";
            const val = ctx.parsed.y ?? 0;
            if (label === "Faturamento") return `${label}: ${fmtCurrency(val)}`;
            return `${label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", font: { size: FONTS.tick, family: "Poppins" } },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        position: "left" as const,
        title: { display: true, text: "Qtd", color: "#94a3b8", font: { size: FONTS.tick } },
        ticks: { color: "#94a3b8", font: { size: FONTS.tick } },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y1: {
        position: "right" as const,
        title: { display: true, text: "Faturamento (R$)", color: "#94a3b8", font: { size: FONTS.tick } },
        ticks: {
          color: "#94a3b8",
          font: { size: FONTS.tick },
          callback(value: string | number) {
            return fmtCurrency(Number(value));
          },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: "14px 20px" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: 28, marginBottom: 10 }}
      >
        Evolução Mensal
      </h2>
      <div className="flex-1 min-h-0">
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
}
