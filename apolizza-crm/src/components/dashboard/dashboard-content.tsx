"use client";

import { KpiCards } from "./kpi-cards";
import { StatusBreakdown } from "./status-breakdown";
import { MonthlyChart } from "./monthly-chart";
import { CotadoresTable } from "./cotadores-table";
import { CotadoresPie } from "./cotadores-pie";
import { FilteredChart } from "./filtered-chart";
import { MetasCard } from "./metas-card";

export function DashboardContent({ userRole }: { userRole: "admin" | "cotador" | "proprietario" }) {
  const isAdminOrProprietario = userRole === "admin" || userRole === "proprietario";
  return (
    <div className="space-y-6">
      {/* Row 1: KPIs */}
      <KpiCards />

      {/* Row 2: Evolucao + Metas + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyChart />
        </div>
        <div className="space-y-6">
          <MetasCard isAdmin={isAdminOrProprietario} />
          <StatusBreakdown />
        </div>
      </div>

      {/* Row 3: Analise por filtro + Pie cotadores (admin/proprietario) */}
      <div className={`grid grid-cols-1 gap-6 ${isAdminOrProprietario ? "lg:grid-cols-3" : ""}`}>
        <div className={isAdminOrProprietario ? "lg:col-span-2" : ""}>
          <FilteredChart userRole={userRole} />
        </div>
        {isAdminOrProprietario && (
          <div>
            <CotadoresPie />
          </div>
        )}
      </div>

      {/* Row 4: Cards de cotadores (admin/proprietario) */}
      {isAdminOrProprietario && (
        <CotadoresTable />
      )}
    </div>
  );
}
