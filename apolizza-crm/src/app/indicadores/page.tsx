import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { IndicadoresContent } from "@/components/indicadores-content";

export default async function IndicadoresPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "proprietario") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="indicadores"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Indicadores — Ranking de Produtores</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Origem da venda (campo <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">indicação</span>) — agrupado em UPPER/trim para unir grafias.
          </p>
        </div>
        <IndicadoresContent />
      </div>
    </div>
  );
}
