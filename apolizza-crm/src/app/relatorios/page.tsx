import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RelatorioMensal } from "@/components/relatorio-mensal";

export default async function RelatoriosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "proprietario") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="relatorios"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Relatorio Gerencial</h1>
          <p className="text-slate-500 mt-1 text-sm">Resumo mensal com KPIs, ranking e pipeline</p>
        </div>
        <RelatorioMensal />
      </div>
    </div>
  );
}
