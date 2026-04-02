import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, users } from "@/lib/schema";
import { AppHeader } from "@/components/app-header";
import { DocsUpload } from "@/components/docs-upload";
import { CotacaoHistory } from "@/components/cotacao-history";
import { STATUS_BADGES } from "@/lib/status-config";

type Params = { params: Promise<{ id: string }> };

const STATUS_BADGE = STATUS_BADGES;

export default async function CotacaoDetailPage({ params }: Params) {
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

  let assigneeName = "—";
  if (row.assigneeId) {
    const [a] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, row.assigneeId));
    if (a) assigneeName = a.name;
  }

  const fmt = (v: string | null) =>
    v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const fmtDate = (v: string | Date | null) =>
    v ? new Date(v).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        activePage="cotacoes"
      />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/cotacoes" className="text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium">
              ← Voltar
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{row.name}</h1>
          </div>
          <Link
            href={`/cotacoes/${id}/edit`}
            className="px-4 py-2 text-white rounded-xl text-sm font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
          >
            Editar
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-6 border border-slate-100">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${STATUS_BADGE[row.status] || "bg-slate-100 text-slate-600"}`}>
              {row.status}
            </span>
            <span className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-sm capitalize">
              {row.priority}
            </span>
            {row.isRenovacao && (
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
                Renovacao
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Detail label="Responsavel" value={assigneeName} />
            <Detail label="Tipo Cliente" value={row.tipoCliente} />
            <Detail label="Contato" value={row.contatoCliente} />
            <Detail label="Seguradora" value={row.seguradora} />
            <Detail label="Produto" value={row.produto} />
            <Detail label="Situacao" value={row.situacao} />
            <Detail label="Indicacao" value={row.indicacao} />
            <Detail label="Inicio Vigencia" value={fmtDate(row.inicioVigencia)} />
            <Detail label="Fim Vigencia" value={fmtDate(row.fimVigencia)} />
            <Detail label="1o Pagamento" value={fmtDate(row.primeiroPagamento)} />
            <Detail label="Proxima Tratativa" value={fmtDate(row.proximaTratativa)} />
            <Detail label="Data Limite" value={fmtDate(row.dueDate)} />
            <Detail label="Premio sem IOF" value={fmt(row.premioSemIof)} highlight />
            <Detail label="Comissao" value={fmt(row.comissao)} highlight />
            <Detail label="A Receber" value={fmt(row.aReceber)} highlight />
            <Detail label="Valor Perda" value={fmt(row.valorPerda)} />
            <Detail label="Parcelado Em" value={row.parceladoEm ? `${row.parceladoEm}x` : "—"} />
            <Detail
              label="Referencia"
              value={row.mesReferencia && row.anoReferencia ? `${row.mesReferencia}/${row.anoReferencia}` : "—"}
            />
          </div>

          {row.observacao && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Observacao</p>
              <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{row.observacao}</p>
            </div>
          )}

          <div className="text-xs text-slate-400 pt-4 border-t border-slate-100">
            Criado em {fmtDate(row.createdAt)} — Atualizado em {fmtDate(row.updatedAt)}
            {row.clickupId && ` — ClickUp #${row.clickupId}`}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <DocsUpload cotacaoId={id} />
          <CotacaoHistory cotacaoId={id} />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 ${highlight ? "font-semibold text-slate-900" : "text-slate-700"}`}>{value || "—"}</p>
    </div>
  );
}
