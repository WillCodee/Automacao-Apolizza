"use client";

import { KpiCards } from "./kpi-cards";
import { StatusBreakdown } from "./status-breakdown";
import { MonthlyChart } from "./monthly-chart";
import { CotadoresTable } from "./cotadores-table";
import { CotadoresPie } from "./cotadores-pie";
import { FilteredChart } from "./filtered-chart";
import { MetasCard } from "./metas-card";
import { ProximasTratativas } from "./proximas-tratativas";
import { AdminKanban } from "./admin-kanban";
import { AnálisePanel } from "./analise-panel";
import { MetasDashboard } from "./metas-dashboard";
import { WeeklyGoalChart } from "./weekly-goal-chart";
import { MetasProdutoChart } from "./metas-produto-chart";

export function DashboardContent({ userRole }: { userRole: "admin" | "cotador" | "proprietario" }) {
  const isAdminOrProprietario = userRole === "admin" || userRole === "proprietario";
  const isCotador = userRole === "cotador";
  return (
    <div className="space-y-6">
      {/* Row 1: KPIs */}
      <KpiCards />

      {/* Próximas Tratativas — apenas cotador */}
      {isCotador && <ProximasTratativas />}

      {/* Row 2: Evolucao + Metas (compacto) + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <MonthlyChart />
        </div>
        {/* Sidebar: flex column so StatusBreakdown fills remaining height */}
        <div className="flex flex-col gap-6 h-full">
          <MetasCard isAdmin={isAdminOrProprietario} />
          <div className="flex-1 min-h-0">
            <StatusBreakdown />
          </div>
        </div>
      </div>

      {/* Row 3: Analise por filtro + Pie cotadores (admin/proprietario) */}
      <div className={`grid grid-cols-1 gap-6 items-stretch ${isAdminOrProprietario ? "lg:grid-cols-3" : ""}`}>
        <div className={isAdminOrProprietario ? "lg:col-span-2" : ""}>
          <FilteredChart userRole={userRole} />
        </div>
        {isAdminOrProprietario && (
          <div className="h-full">
            <CotadoresPie />
          </div>
        )}
      </div>

      {/* Row 4: Análise de Cotações (por cotador/grupo e por status/situação) */}
      <AnálisePanel userRole={userRole} />

      {/* Row 5: Progresso semanal vs meta */}
      <WeeklyGoalChart />

      {/* Row 6: Metas & Desempenho detalhado + Meta por Produto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <MetasDashboard isAdmin={isAdminOrProprietario} />
        <MetasProdutoChart />
      </div>

      {/* Row 6: Cards de cotadores (admin/proprietario) */}
      {isAdminOrProprietario && (
        <CotadoresTable />
      )}

      {/* Row 7: Kanban por usuário e grupo (admin/proprietario) */}
      {isAdminOrProprietario && (
        <AdminKanban />
      )}
    </div>
  );
}
