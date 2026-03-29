import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RenovacoesList } from "@/components/renovacoes-list";

export default async function RenovacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="renovacoes"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Renovacoes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Acompanhe renovacoes e vencimentos de apolices
          </p>
        </div>
        <RenovacoesList userRole={session.user.role} />
      </div>
    </div>
  );
}
