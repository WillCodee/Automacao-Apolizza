import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { UsuariosPageClient } from "@/components/usuarios-page-client";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "proprietario") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="usuarios"
      />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <UsuariosPageClient />
      </main>
    </div>
  );
}
