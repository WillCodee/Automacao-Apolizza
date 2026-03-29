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
import { Bar } from "react-chartjs-2";

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

type MonthData = {
  mes: string;
  ano: number;
  fechadas: number;
  perdas: number;
  total: number;
  aReceber: number;
};

export function MonthlyChart({ data }: { data: MonthData[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Evolucao Mensal</h3>
        <p className="text-slate-400 text-sm py-8 text-center">Sem dados para exibir</p>
      </div>
    );
  }

  const labels = data.map((d) => `${d.mes || "?"}/${d.ano || "?"}`);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Fechadas",
        data: data.map((d) => d.fechadas),
        backgroundColor: "#22c55e",
        borderRadius: 6,
      },
      {
        label: "Perdas",
        data: data.map((d) => d.perdas),
        backgroundColor: "#ff695f",
        borderRadius: 6,
      },
      {
        label: "Total",
        data: data.map((d) => d.total),
        backgroundColor: "rgba(3, 164, 237, 0.25)",
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          boxWidth: 12,
          font: { size: 11, family: "Poppins" },
          usePointStyle: true,
          pointStyle: "circle" as const,
          padding: 16,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#f1f5f9" },
        ticks: { font: { size: 11, family: "Poppins" } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, family: "Poppins" } },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Evolucao Mensal</h3>
      <div className="h-[300px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
