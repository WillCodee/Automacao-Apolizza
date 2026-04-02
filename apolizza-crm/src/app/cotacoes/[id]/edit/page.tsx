import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes } from "@/lib/schema";
import { AppHeader } from "@/components/app-header";
import { CotacaoForm } from "@/components/cotacao-form";
import Link from "next/link";

type Params = { params: Promise<{ id: string }> };

export default async function EditCotacaoPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [row] = await db
    .select()
    .from(cotacoes)
    .where(and(eq(cotacoes.id, id), isNull(cotacoes.deletedAt)));

  if (!row) notFound();

  if (session.user.role === "cotador" && row.assigneeId !== session.user.id) {
    redirect("/cotacoes");
  }

  const initialData = {
    name: row.name,
    status: row.status,
    priority: row.priority || "normal",
    dueDate: row.dueDate ? new Date(row.dueDate).toISOString().split("T")[0] : "",
    assigneeId: row.assigneeId || "",
    tipoCliente: row.tipoCliente || "",
    contatoCliente: row.contatoCliente || "",
    seguradora: row.seguradora || "",
    produto: row.produto || "",
    situacao: row.situacao || "",
    indicacao: row.indicacao || "",
    inicioVigencia: row.inicioVigencia || "",
    fimVigencia: row.fimVigencia || "",
    primeiroPagamento: row.primeiroPagamento || "",
    proximaTratativa: row.proximaTratativa || "",
    parceladoEm: row.parceladoEm ? String(row.parceladoEm) : "",
    premioSemIof: row.premioSemIof || "",
    comissao: row.comissao || "",
    aReceber: row.aReceber || "",
    valorPerda: row.valorPerda || "",
    observacao: row.observacao || "",
    mesReferencia: row.mesReferencia || "",
    anoReferencia: row.anoReferencia ? String(row.anoReferencia) : "",
    isRenovacao: row.isRenovacao,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="cotacoes"
      />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href={`/cotacoes/${id}`} className="text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Editar Cotacao</h1>
          <p className="text-slate-500 mt-1 text-sm">{row.name}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-slate-100">
          <CotacaoForm
            initialData={initialData}
            cotacaoId={id}
            currentUser={{
              id: session.user.id,
              role: session.user.role,
            }}
          />
        </div>
      </div>
    </div>
  );
}
