import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { TarefasList } from "@/components/tarefas-list";

export default async function TarefasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="tarefas"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tarefas Diárias</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {session.user.role === "admin"
                ? "Gerencie as tarefas dos cotadores"
                : "Acompanhe suas tarefas diárias"}
            </p>
          </div>
        </div>
        <TarefasList userRole={session.user.role} userId={session.user.id} />
      </div>
    </div>
  );
}
