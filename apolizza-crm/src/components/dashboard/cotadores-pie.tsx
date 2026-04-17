"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { CardFilter } from "./card-filter";

ChartJS.register(ArcElement, Tooltip, Legend);

type CotadorData = {
  userId: string;
  name: string;
  totalCotacoes: number;
  fechadas: number;
  faturamento: number;
  taxaConversao: number;
};

type MetricKey = "totalCotacoes" | "fechadas" | "faturamento";

const METRIC_LABELS: Record<MetricKey, string> = {
  totalCotacoes: "Total de Cotacoes",
  fechadas: "Cotacoes Fechadas",
  faturamento: "Faturamento (R$)",
};

const COLORS = [
  "#03a4ed",
  "#22c55e",
  "#ff695f",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CotadoresPie() {
  const currentYear = String(new Date().getFullYear());

  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState("");
  const [data, setData] = useState<CotadorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricKey>("totalCotacoes");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("ano", ano);
    if (mes) params.set("mes", mes);
    const res = await fetch(`/api/dashboard?${params}`);
    const json = await res.json();
    setData(json.data?.cotadores ?? []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Desempenho por Cotador</h3>
          <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Desempenho por Cotador</h3>
          <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
        </div>
        <p className="text-slate-400 text-sm py-8 text-center">Sem dados para exibir</p>
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.name.split(" ")[0]),
    datasets: [
      {
        data: data.map((d) => Number(d[metric]) || 0),
        backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: "#fff",
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 10,
          font: { size: 11, family: "Poppins" },
          usePointStyle: true,
          pointStyle: "circle" as const,
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number; dataIndex: number }) => {
            const cotador = data[ctx.dataIndex];
            const val = ctx.parsed;
            const formatted =
              metric === "faturamento"
                ? fmt(val)
                : `${val} ${metric === "totalCotacoes" ? "cotacoes" : "fechadas"}`;
            return ` ${ctx.label}: ${formatted} (${cotador.taxaConversao}% conv.)`;
          },
        },
      },
    },
  };

  const total = data.reduce((acc, d) => acc + (Number(d[metric]) || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Desempenho por Cotador</h3>
        <div className="flex items-center gap-2">
          <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
            className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none"
          >
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
              <option key={k} value={k}>{METRIC_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-[200px]">
        <Doughnut data={chartData} options={options} />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">Total</p>
        <p className="text-base font-bold text-slate-900">
          {metric === "faturamento" ? fmt(total) : total.toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
