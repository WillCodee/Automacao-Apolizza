import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { CotacoesView } from "@/components/cotacoes-view";

export default async function CotacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="cotacoes"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cotacoes</h1>
            <p className="text-slate-500 mt-1 text-sm">Gerencie suas cotacoes de seguros</p>
          </div>
          <Link
            href="/cotacoes/new"
            className="px-4 py-2.5 text-white rounded-xl font-medium text-sm bg-apolizza-gradient hover:opacity-90 transition-all shadow-lg shadow-[#ff695f]/20"
          >
            + Nova Cotacao
          </Link>
        </div>
        <CotacoesView userRole={session.user.role} />
      </div>
    </div>
  );
}
