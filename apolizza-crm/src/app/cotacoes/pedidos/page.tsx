import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { PedidoForm } from "@/components/pedido-form";
import { CopyLinkButton } from "@/components/copy-link-button";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";

export default async function PedidosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const publicLink = `${APP_URL}/pedido`;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="cotacoes"
      />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/cotacoes" className="text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium">
              ← Voltar para Cotações
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Novo Pedido</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Preencha os dados do pedido. Uma tarefa será criada automaticamente e o responsável será notificado.
            </p>
          </div>
          {/* Link público para clientes */}
          <div className="flex-shrink-0">
            <p className="text-xs text-slate-400 mb-1.5">Link público para clientes</p>
            <CopyLinkButton link={publicLink} />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-slate-100">
          <PedidoForm />
        </div>
      </div>
    </div>
  );
}
