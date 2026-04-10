import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { InicioContent } from "@/components/inicio-content";

export default async function InicioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="inicio"
      />
      <InicioContent
        userName={session.user.name || ""}
        userRole={session.user.role}
        userImage={session.user.image ?? null}
        userId={session.user.id}
      />
    </div>
  );
}
