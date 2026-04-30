import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AppHeader } from "@/components/app-header";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="dashboard"
      />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <DashboardContent userRole={session.user.role} />
      </main>
    </div>
  );
}
