import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CalendarioMensal } from "@/components/calendario-mensal";

export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="calendario"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
          <p className="text-slate-500 mt-1 text-sm">Vencimentos, tratativas e pagamentos do mes</p>
        </div>
        <CalendarioMensal />
      </div>
    </div>
  );
}
