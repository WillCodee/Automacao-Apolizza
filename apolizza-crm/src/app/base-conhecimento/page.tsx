import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BaseConhecimentoContent } from "@/components/base-conhecimento-content";

export default async function BaseConhecimentoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="base-conhecimento"
      />
      <BaseConhecimentoContent userRole={session.user.role} />
    </div>
  );
}
