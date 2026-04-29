"use client";

import { useState, useEffect } from "react";
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

function useChartFonts() {
  const [fonts, setFonts] = useState({ legend: 13, tick: 11, tooltip: 12 });
  useEffect(() => {
    const update = () => {
      const h = window.innerHeight;
      setFonts(
        h >= 900 ? { legend: 18, tick: 16, tooltip: 16 } :
        h >= 700 ? { legend: 14, tick: 12, tooltip: 13 } :
                   { legend: 11, tick: 10, tooltip: 11 }
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return fonts;
}

export default function TvMonthlySlide({ monthlyTrend }: { monthlyTrend: MonthlyData[] }) {
  const fonts = useChartFonts();

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
          font: { size: fonts.legend, family: "Poppins" },
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
        titleFont: { size: fonts.tooltip, family: "Poppins" },
        bodyFont: { size: fonts.tooltip, family: "Poppins" },
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
        ticks: { color: "#94a3b8", font: { size: fonts.tick, family: "Poppins" } },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        position: "left" as const,
        title: { display: true, text: "Qtd", color: "#94a3b8", font: { size: fonts.tick } },
        ticks: { color: "#94a3b8", font: { size: fonts.tick } },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y1: {
        position: "right" as const,
        title: { display: true, text: "Faturamento (R$)", color: "#94a3b8", font: { size: fonts.tick } },
        ticks: {
          color: "#94a3b8",
          font: { size: fonts.tick },
          callback(value: string | number) {
            return fmtCurrency(Number(value));
          },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: "clamp(0.5rem, 1.2vmin, 1.75rem) clamp(0.75rem, 1.5vmin, 2.5rem)" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: "clamp(1rem, 2.8vmin, 3rem)", marginBottom: "clamp(0.3rem, 0.8vmin, 1.25rem)" }}
      >
        Evolução Mensal
      </h2>
      <div className="flex-1 min-h-0">
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
}
