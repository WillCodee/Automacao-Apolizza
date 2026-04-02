import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CotacaoForm } from "@/components/cotacao-form";

export default async function NovaCotacaoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="cotacoes"
      />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Nova Cotacao</h1>
          <p className="text-slate-500 mt-1 text-sm">Preencha os dados da cotacao</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-slate-100">
          <CotacaoForm
            currentUser={{
              id: session.user.id,
              role: session.user.role,
            }}
          />
        </div>
      </div>
    </div>
  );
}
