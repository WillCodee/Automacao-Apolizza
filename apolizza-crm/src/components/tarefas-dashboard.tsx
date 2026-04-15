"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface MetricasData {
  por_status: Array<{ status: string; total: number }>;
  por_cotador: Array<{
    cotador_id: string;
    cotador_name: string;
    cotador_photo: string | null;
    total_tarefas: number;
    concluidas: number;
    pendentes: number;
    em_andamento: number;
  }>;
  tendencia_mensal: Array<{
    mes: string;
    criadas: number;
    concluidas: number;
  }>;
  kpis: {
    pendentes: number;
    atrasadas: number;
    concluidasHoje: number;
    concluidasSemana: number;
  };
}

export function TarefasDashboard() {
  const [data, setData] = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetricas() {
      try {
        const res = await fetch("/api/tarefas/metricas");
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Erro ao buscar métricas");
        }

        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    fetchMetricas();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-600">❌ {error}</p>
      </div>
    );
  }

  if (!data || data.por_status.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
        <p className="text-gray-600 text-lg">📊 Nenhuma tarefa encontrada</p>
        <p className="text-gray-500 text-sm mt-2">
          Crie algumas tarefas para visualizar as métricas
        </p>
      </div>
    );
  }

  // Preparar dados para gráfico de status (Doughnut)
  const statusData = {
    labels: data.por_status.map((s) => s.status),
    datasets: [
      {
        label: "Tarefas por Status",
        data: data.por_status.map((s) => s.total),
        backgroundColor: [
          "#fbbf24", // Pendente (amarelo)
          "#03a4ed", // Em Andamento (azul Apolizza)
          "#10b981", // Concluída (verde)
          "#ef4444", // Cancelada (vermelho)
        ],
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  const statusOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { family: "Poppins", size: 12 },
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            const total = data.por_status.reduce((acc, s) => acc + s.total, 0);
            const percent = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percent}%)`;
          },
        },
      },
    },
  };

  // Preparar dados para gráfico de cotadores (Bar)
  const cotadoresData = {
    labels: data.por_cotador.map((c) => c.cotador_name),
    datasets: [
      {
        label: "Concluídas",
        data: data.por_cotador.map((c) => c.concluidas),
        backgroundColor: "#10b981",
      },
      {
        label: "Em Andamento",
        data: data.por_cotador.map((c) => c.em_andamento),
        backgroundColor: "#03a4ed",
      },
      {
        label: "Pendentes",
        data: data.por_cotador.map((c) => c.pendentes),
        backgroundColor: "#fbbf24",
      },
    ],
  };

  const cotadoresOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { family: "Poppins", size: 12 },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { font: { family: "Poppins" } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { font: { family: "Poppins" } },
      },
    },
  };

  // Preparar dados para tendência mensal (Line)
  const tendenciaData = {
    labels: data.tendencia_mensal.map((t) => {
      const date = new Date(t.mes);
      return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    }),
    datasets: [
      {
        label: "Criadas",
        data: data.tendencia_mensal.map((t) => t.criadas),
        borderColor: "#ff695f",
        backgroundColor: "rgba(255, 105, 95, 0.1)",
        tension: 0.3,
      },
      {
        label: "Concluídas",
        data: data.tendencia_mensal.map((t) => t.concluidas),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.3,
      },
    ],
  };

  const tendenciaOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { family: "Poppins", size: 12 },
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { family: "Poppins" } },
      },
      y: {
        beginAtZero: true,
        ticks: { font: { family: "Poppins" } },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-6 border border-yellow-200">
          <p className="text-yellow-700 text-sm font-medium mb-1">Pendentes</p>
          <p className="text-3xl font-bold text-yellow-900">{data.kpis.pendentes}</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200">
          <p className="text-red-700 text-sm font-medium mb-1">Atrasadas</p>
          <p className="text-3xl font-bold text-red-900">{data.kpis.atrasadas}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
          <p className="text-green-700 text-sm font-medium mb-1">Concluídas Hoje</p>
          <p className="text-3xl font-bold text-green-900">{data.kpis.concluidasHoje}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
          <p className="text-blue-700 text-sm font-medium mb-1">Concluídas Semana</p>
          <p className="text-3xl font-bold text-blue-900">{data.kpis.concluidasSemana}</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Tarefas por Status
          </h3>
          <div className="h-64">
            <Doughnut data={statusData} options={statusOptions} />
          </div>
        </div>

        {/* Gráfico de Cotadores */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Tarefas por Cotador
          </h3>
          <div className="h-64">
            <Bar data={cotadoresData} options={cotadoresOptions} />
          </div>
        </div>
      </div>

      {/* Tendência Mensal */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Tendência Mensal (Últimos 12 Meses)
        </h3>
        <div className="h-80">
          <Line data={tendenciaData} options={tendenciaOptions} />
        </div>
      </div>
    </div>
  );
}
