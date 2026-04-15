import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuditoriaContent } from "./auditoria-content";

export default async function AuditoriaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Apenas admin e proprietário podem acessar
  if (session.user.role !== "admin" && session.user.role !== "proprietario") {
    redirect("/dashboard");
  }

  return <AuditoriaContent userName={session.user.name || ""} userRole={session.user.role} />;
}
