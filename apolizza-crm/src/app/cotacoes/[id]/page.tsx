import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, users, grupoMembros, gruposUsuarios, cotacaoResponsaveis } from "@/lib/schema";
import { AppHeader } from "@/components/app-header";
import { DocsUpload } from "@/components/docs-upload";
import { AtividadePanel } from "@/components/atividade-panel";
import { ObservacaoEditor } from "@/components/observacao-editor";
import { STATUS_BADGES } from "@/lib/status-config";
import { ExportPDFButton } from "@/components/export-pdf-button";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

const STATUS_BADGE = STATUS_BADGES;

export default async function CotacaoDetailPage({ params, searchParams }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from === "dashboard" ? "/dashboard" : from === "inicio" ? "/inicio" : "/cotacoes";

  const [row] = await db
    .select()
    .from(cotacoes)
    .where(and(eq(cotacoes.id, id), isNull(cotacoes.deletedAt)));

  if (!row) notFound();

  // Todos podem visualizar qualquer cotação (colaboração)

  let assigneeName = "—";
  let assigneeGrupoNome: string | null = null;
  if (row.assigneeId) {
    const [a] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, row.assigneeId));
    if (a) assigneeName = a.name;

    const gmRows = await db
      .select({ nome: gruposUsuarios.nome })
      .from(grupoMembros)
      .innerJoin(gruposUsuarios, eq(grupoMembros.grupoId, gruposUsuarios.id))
      .where(eq(grupoMembros.userId, row.assigneeId))
      .orderBy(gruposUsuarios.nome);
    if (gmRows.length > 0) assigneeGrupoNome = gmRows.map((g) => g.nome).join(", ");
  }

  const coResponsaveis = await db
    .select({ id: users.id, name: users.name, photoUrl: users.photoUrl })
    .from(cotacaoResponsaveis)
    .innerJoin(users, eq(cotacaoResponsaveis.userId, users.id))
    .where(eq(cotacaoResponsaveis.cotacaoId, id));

  const fmt = (v: string | null) =>
    v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const fmtDate = (v: string | Date | null) =>
    v ? new Date(v).toLocaleDateString("pt-BR") : "—";

  const fmtDateTime = (v: string | Date | null) =>
    v
      ? new Date(v).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role}
        userPhoto={session.user.image}
        activePage="cotacoes"
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href={backHref} className="text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium print:hidden">
              ← Voltar
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{row.name}</h1>
          </div>
          <div className="flex gap-2 print:hidden">
            <ExportPDFButton cotacaoName={row.name} cotacaoId={id} />
            <Link
              href={`/cotacoes/${id}/edit`}
              className="px-4 py-2 text-white rounded-xl text-sm font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
            >
              Editar
            </Link>
          </div>
        </div>

        {/* Layout duas colunas */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Coluna principal */}
          <div className="flex-1 min-w-0 space-y-6 w-full">
            <div data-pdf-target className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-6 border border-slate-100">
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
                {assigneeGrupoNome && <Detail label="Grupo" value={assigneeGrupoNome} />}
                {coResponsaveis.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">Co-responsáveis</div>
                    <div className="flex -space-x-2">
                      {coResponsaveis.map((u) => (
                        <div
                          key={u.id}
                          title={u.name}
                          className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-[#03a4ed] text-white text-xs font-bold flex items-center justify-center shadow-sm"
                        >
                          {u.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {coResponsaveis.map((u) => u.name).join(", ")}
                    </div>
                  </div>
                )}
                <Detail label="Tipo Cliente" value={row.tipoCliente} />
                <Detail label="Contato" value={row.contatoCliente} />
                <Detail label="Seguradora" value={row.seguradora} />
                <Detail label="Produto" value={row.produto} />
                <Detail label="Situacao" value={row.situacao} />
                <Detail label="Indicacao" value={row.indicacao} />
                <Detail label="Inicio Vigencia" value={fmtDate(row.inicioVigencia)} />
                <Detail label="Fim Vigencia" value={fmtDate(row.fimVigencia)} />
                <Detail label="1o Pagamento" value={fmtDate(row.primeiroPagamento)} />
                <Detail label="Próxima Tratativa" value={fmtDate(row.proximaTratativa)} />
                <Detail label="Data de Entrega" value={fmtDate(row.dueDate)} />
                <Detail label="Premio s/IOF" value={fmt(row.premioSemIof)} highlight />
                <Detail label="Comissao" value={row.comissao ? `${parseFloat(row.comissao)}%` : "—"} highlight />
                <Detail label="A Receber" value={fmt(row.aReceber)} highlight />
                <Detail label="Valor Perda" value={fmt(row.valorPerda)} />
                <Detail label="Premio c/IOF" value={fmt(row.premioComIof)} highlight />
                <Detail label="Parcelas" value={row.parceladoEm ? `${row.parceladoEm}x` : "—"} />
                <Detail label="Valor p/Parcela" value={fmt(row.valorParcelado)} highlight />
                <Detail
                  label="Referencia"
                  value={row.mesReferencia && row.anoReferencia ? `${row.mesReferencia}/${row.anoReferencia}` : "—"}
                />
              </div>

              {/* Comissionamento parcelado */}
              {row.comissaoParcelada && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Data de Comissionamento ({(row.comissaoParcelada as { parcelas: number; percentuais: number[] }).parcelas} parcelas)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(row.comissaoParcelada as { parcelas: number; percentuais: number[] }).percentuais.map((pct, i) => (
                      <span
                        key={i}
                        className="inline-flex flex-col items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <span className="text-[10px] text-slate-400 font-medium">Parcela {i + 1}</span>
                        <span className="font-semibold text-slate-800">{pct}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <ObservacaoEditor cotacaoId={id} initialValue={row.observacao} />

              <div className="text-xs text-slate-400 pt-4 border-t border-slate-100">
                Criado em {fmtDateTime(row.createdAt)} — Atualizado em {fmtDateTime(row.updatedAt)}
                {row.clickupId && ` — ClickUp #${row.clickupId}`}
              </div>
            </div>

            <div className="print:hidden">
              <DocsUpload cotacaoId={id} />
            </div>
          </div>

          {/* Sidebar — Atividade */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 print:hidden">
            <AtividadePanel
              cotacaoId={id}
              currentUserId={session.user.id}
              currentUserName={session.user.name || ""}
              currentUserPhoto={session.user.image}
            />
          </div>
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
