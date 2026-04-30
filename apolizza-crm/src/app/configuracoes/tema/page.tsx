import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ThemeSelector } from "@/components/theme-selector";

export default async function TemaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Tema disponível para todos os usuários autenticados

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader userName={session.user.name || ""} userRole={session.user.role} userPhoto={session.user.image} activePage="tema" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Personalização de Tema</h1>
          <p className="text-slate-500 text-sm mt-1">Escolha as cores e o modo de exibição do sistema.</p>
        </div>
        <ThemeSelector />
      </div>
    </div>
  );
}
