import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SituacaoConfigList } from "@/components/situacao-config-list";

export default async function SituacaoConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "proprietario") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="situacao-config"
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <SituacaoConfigList />
      </main>
    </div>
  );
}
