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

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`;
  return `R$${v.toFixed(0)}`;
}

export default function TvMonthlySlide({ monthlyTrend }: { monthlyTrend: MonthlyData[] }) {
  const data = monthlyTrend.slice(-6);
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
        borderWidth: 4,
        pointRadius: 7,
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
          font: { size: 20, family: "Poppins" },
          padding: 28,
          boxWidth: 18,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#e2e8f0",
        bodyColor: "#e2e8f0",
        borderColor: "#334155",
        borderWidth: 1,
        titleFont: { size: 18, family: "Poppins" },
        bodyFont: { size: 17, family: "Poppins" },
        padding: 14,
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
        ticks: { color: "#94a3b8", font: { size: 18, family: "Poppins" } },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        position: "left" as const,
        title: { display: true, text: "Quantidade", color: "#94a3b8", font: { size: 16 } },
        ticks: { color: "#94a3b8", font: { size: 16 } },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y1: {
        position: "right" as const,
        title: { display: true, text: "Faturamento (R$)", color: "#94a3b8", font: { size: 16 } },
        ticks: {
          color: "#94a3b8",
          font: { size: 16 },
          callback(value: string | number) {
            return fmtCurrency(Number(value));
          },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: "clamp(0.75rem, 1.5vw, 1.75rem) clamp(1rem, 2vw, 2.5rem)" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: "clamp(1.25rem, 2.8vw, 3rem)", marginBottom: "clamp(0.5rem, 1vw, 1.25rem)" }}
      >
        Evolucao Mensal
      </h2>
      <div className="flex-1 min-h-0">
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
}
