import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MetasAdmin } from "@/components/metas-admin";
import { db } from "@/lib/db";
import { users, gruposUsuarios } from "@/lib/schema";
import { eq, and, notInArray } from "drizzle-orm";

export default async function MetasAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "proprietario") redirect("/dashboard");

  const [cotadores, grupos] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, photoUrl: users.photoUrl })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          notInArray(users.role, ["admin"]),
          notInArray(users.name, ["Suporte"])
        )
      )
      .orderBy(users.name),
    db
      .select({ id: gruposUsuarios.id, nome: gruposUsuarios.nome, cor: gruposUsuarios.cor })
      .from(gruposUsuarios)
      .orderBy(gruposUsuarios.nome),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader userName={session.user.name || ""} userRole={session.user.role} activePage="metas-admin" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Metas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Defina as metas mensais da empresa, cotadores e grupos.
          </p>
        </div>
        <MetasAdmin cotadores={cotadores} grupos={grupos} />
      </div>
    </div>
  );
}
