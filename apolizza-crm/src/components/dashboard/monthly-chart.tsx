"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ANO_OPTIONS } from "@/lib/constants";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type MonthData = {
  mes: string;
  ano: number;
  fechadas: number;
  perdas: number;
  total: number;
  aReceber: number;
};

type AnnualData = {
  ano: number;
  fechadas: number;
  perdas: number;
  total: number;
  aReceber: number;
};

const MES_ORDER = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

// Normaliza variações do banco (ex: "MAIO" → "MAI")
const MES_ALIAS: Record<string, string> = { MAIO: "MAI" };
function normalizeMes(mes: string): string {
  return MES_ALIAS[mes] ?? mes;
}

function sortByMonth(data: MonthData[]): MonthData[] {
  return data
    .filter((d) => d.mes && d.ano)
    .map((d) => ({ ...d, mes: normalizeMes(d.mes) }))
    .filter((d) => MES_ORDER.includes(d.mes))
    .sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return MES_ORDER.indexOf(a.mes) - MES_ORDER.indexOf(b.mes);
    });
}

function aggregateAnnual(data: MonthData[]): AnnualData[] {
  const map: Record<number, AnnualData> = {};
  for (const d of data) {
    if (!map[d.ano]) map[d.ano] = { ano: d.ano, fechadas: 0, perdas: 0, total: 0, aReceber: 0 };
    map[d.ano].fechadas += d.fechadas;
    map[d.ano].perdas += d.perdas;
    map[d.ano].total += d.total;
    map[d.ano].aReceber += d.aReceber;
  }
  return Object.values(map).sort((a, b) => a.ano - b.ano);
}

const baseOptions = {
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

export function MonthlyChart() {
  const currentYear = String(new Date().getFullYear());

  const [ano, setAno] = useState(currentYear);
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"mensal" | "anual">("mensal");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    // Mensal: filtra pelo ano selecionado. Anual: sem filtro para pegar todos os anos.
    if (view === "mensal") params.set("ano", ano);
    const res = await fetch(`/api/dashboard?${params}`);
    const json = await res.json();
    setData(sortByMonth(json.data?.monthlyTrend ?? []));
    setLoading(false);
  }, [ano, view]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmpty = data.length === 0;

  const monthlyChartData = {
    labels: data.map((d) => `${d.mes || "?"}/${String(d.ano).slice(-2)}`),
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

  const annual = aggregateAnnual(data);
  const annualChartData = {
    labels: annual.map((d) => String(d.ano)),
    datasets: [
      {
        label: "Fechadas",
        data: annual.map((d) => d.fechadas),
        backgroundColor: "#22c55e",
        borderRadius: 8,
        borderSkipped: false as const,
      },
      {
        label: "Perdas",
        data: annual.map((d) => d.perdas),
        backgroundColor: "#ff695f",
        borderRadius: 8,
        borderSkipped: false as const,
      },
      {
        label: "Total",
        data: annual.map((d) => d.total),
        backgroundColor: "rgba(3, 164, 237, 0.3)",
        borderRadius: 8,
        borderSkipped: false as const,
      },
    ],
  };

  const annualOptions = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          afterLabel: (ctx: { dataIndex: number }) => {
            const d = annual[ctx.dataIndex];
            if (!d) return "";
            return `A receber: R$ ${d.aReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, ticks: { font: { size: 12, family: "Poppins" } } },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Evolucao {view === "mensal" ? "Mensal" : "Anual"}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {view === "mensal" && (
            <select
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
            >
              {ANO_OPTIONS.map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          )}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setView("mensal")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                view === "mensal"
                  ? "bg-white text-[#03a4ed] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setView("anual")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                view === "anual"
                  ? "bg-white text-[#03a4ed] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Anual
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        <p className="text-slate-400 text-sm py-8 text-center">Sem dados para exibir</p>
      ) : (
        <div className="h-[300px]">
          <Bar
            data={view === "mensal" ? monthlyChartData : annualChartData}
            options={view === "mensal" ? baseOptions : annualOptions}
          />
        </div>
      )}
    </div>
  );
}
