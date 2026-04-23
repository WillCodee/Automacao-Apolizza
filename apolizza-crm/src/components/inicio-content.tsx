"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { STATUS_BADGES } from "@/lib/status-config";
import { STATUS_OPTIONS, PRODUTO_OPTIONS } from "@/lib/constants";
import { ProximasTratativas } from "@/components/dashboard/proximas-tratativas";
import { ProximasTrativasKanban } from "@/components/dashboard/proximas-tratativas-kanban";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "Pendente" | "Em Andamento" | "Concluída" | "Cancelada";
  dataVencimento: string | null;
  cotadorId: string;
  criador: { id: string; name: string } | null;
};

type Meta = {
  id: string;
  metaValor: string | null;
  metaQtdCotacoes: number | null;
  metaRenovacoes: number | null;
};

type Produtividade = {
  qtdCotacoes: number;
  qtdFechadas: number;
  qtdPerdas: number;
  valorAReceber: number;
  valorPremio: number;
};

type CotacaoRecente = {
  id: string;
  name: string;
  status: string;
  produto: string | null;
  seguradora: string | null;
  aReceber: string | null;
  dueDate: string | null;
  updatedAt: string;
  priority: string | null;
  tipoCliente: string | null;
};

type InicioData = {
  tarefas: Tarefa[];
  meta: Meta | null;
  produtividade: Produtividade;
  cotacoesRecentes: CotacaoRecente[];
  mes: number;
  ano: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fmt = (v: number | string | null) => {
  const n = Number(v);
  return isNaN(n) || n === 0
    ? "R$ 0,00"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function greeting(name: string) {
  const h = new Date().getHours();
  const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${period}, ${name.split(" ")[0]}!`;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function isOverdue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().setHours(0, 0, 0, 0));
}

const PRIORITY_BADGE: Record<string, string> = {
  urgente: "bg-red-50 text-red-600 border border-red-200",
  alta: "bg-orange-50 text-orange-600 border border-orange-200",
  normal: "bg-slate-100 text-slate-500",
  baixa: "bg-blue-50 text-blue-500",
};

const TAREFA_STATUS_BADGE: Record<string, string> = {
  "Pendente": "bg-amber-50 text-amber-700 border border-amber-200",
  "Em Andamento": "bg-sky-50 text-sky-700 border border-sky-200",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaPanel({ meta, prod }: { meta: Meta | null; prod: Produtividade }) {
  const qtdPct = meta?.metaQtdCotacoes
    ? Math.min(100, Math.round((prod.qtdFechadas / meta.metaQtdCotacoes) * 100))
    : null;

  const valorMeta = meta?.metaValor ? Number(meta.metaValor) : null;
  const valorPct = valorMeta
    ? Math.min(100, Math.round((prod.valorAReceber / valorMeta) * 100))
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Produtividade do Mês</h2>
        <Link
          href="/dashboard"
          className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
        >
          Ver dashboard →
        </Link>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{prod.qtdCotacoes}</p>
          <p className="text-xs text-slate-500 mt-0.5">Cotações</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{prod.qtdFechadas}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Fechadas</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{prod.qtdPerdas}</p>
          <p className="text-xs text-red-500 mt-0.5">Perdas</p>
        </div>
      </div>

      {/* Valor a receber */}
      <div className="bg-[#03a4ed]/5 rounded-xl p-3 mb-4">
        <p className="text-xs text-slate-500 mb-0.5">A Receber este mês</p>
        <p className="text-lg font-bold text-[#03a4ed]">{fmt(prod.valorAReceber)}</p>
      </div>

      {/* Meta progress */}
      {meta ? (
        <div className="space-y-3">
          {qtdPct !== null && meta.metaQtdCotacoes && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Meta de cotações</span>
                <span className="font-semibold text-slate-700">
                  {prod.qtdFechadas} / {meta.metaQtdCotacoes}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    qtdPct >= 100 ? "bg-emerald-500" : "bg-[#03a4ed]"
                  }`}
                  style={{ width: `${qtdPct}%` }}
                />
              </div>
              <p className="text-xs text-right text-slate-400 mt-0.5">{qtdPct}%</p>
            </div>
          )}

          {valorPct !== null && valorMeta && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Meta de valor</span>
                <span className="font-semibold text-slate-700">{fmt(valorMeta)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    valorPct >= 100 ? "bg-emerald-500" : "bg-violet-500"
                  }`}
                  style={{ width: `${valorPct}%` }}
                />
              </div>
              <p className="text-xs text-right text-slate-400 mt-0.5">{valorPct}%</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">
          Nenhuma meta definida para este mês
        </p>
      )}
    </div>
  );
}

function TarefasPanel({
  tarefas,
  onUpdateStatus,
}: {
  tarefas: Tarefa[];
  onUpdateStatus: (id: string, status: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Tarefas do Dia</h2>
          {tarefas.length > 0 && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {tarefas.length}
            </span>
          )}
        </div>
        <Link
          href="/tarefas"
          className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
        >
          Ver todas →
        </Link>
      </div>

      {tarefas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">Tudo em dia!</p>
          <p className="text-xs text-slate-400 mt-0.5">Nenhuma tarefa pendente</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {tarefas.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all"
            >
              {/* Complete button */}
              <button
                onClick={() => onUpdateStatus(t.id, "Concluída")}
                title="Marcar como concluída"
                className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {t.titulo}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${TAREFA_STATUS_BADGE[t.status] || "bg-slate-100 text-slate-500"}`}>
                    {t.status}
                  </span>
                </div>

                {t.dataVencimento && (
                  <p className={`text-xs mt-0.5 ${isOverdue(t.dataVencimento) ? "text-red-500 font-medium" : "text-slate-400"}`}>
                    {isOverdue(t.dataVencimento) ? "⚠ Venceu em " : "Vence em "}
                    {fmtDate(t.dataVencimento)}
                  </p>
                )}
              </div>

              <Link
                href="/tarefas"
                className="flex-shrink-0 text-slate-300 hover:text-[#03a4ed] transition-colors"
                title="Ver tarefa"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InicioContent({
  userName,
  userRole,
  userImage,
  userId,
}: {
  userName: string;
  userRole: "admin" | "cotador" | "proprietario";
  userImage?: string | null;
  userId: string;
}) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(userImage ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [data, setData] = useState<InicioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<{ nome: string; cor: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [seguradoraFilter, setSeguradoraFilter] = useState("");
  const [produtoFilter, setProdutoFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (seguradoraFilter) params.set("seguradora", seguradoraFilter);
    if (produtoFilter) params.set("produto", produtoFilter);

    fetch(`/api/inicio?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setData(res.data);
      })
      .catch((err) => console.error("[inicio] fetch error:", err))
      .finally(() => setLoading(false));
  }, [statusFilter, seguradoraFilter, produtoFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/grupos")
      .then((r) => r.json())
      .then((res) => {
        const grupos = res.data ?? [];
        for (const g of grupos) {
          if (g.membros?.some((m: { id: string }) => m.id === userId)) {
            setGrupo({ nome: g.nome, cor: g.cor ?? "#03a4ed" });
            break;
          }
        }
      })
      .catch(() => {});
  }, [userId]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/users/${userId}/photo`, { method: "POST", body: form });
      const data = await res.json();
      if (data.data?.photoUrl) {
        setCurrentImage(data.data.photoUrl);
        await updateSession({ image: data.data.photoUrl });
        router.refresh();
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateTarefaStatus = async (id: string, status: string) => {
    await fetch(`/api/tarefas/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Filter cotações by search term client-side
  const cotacoesFiltradas = (data?.cotacoesRecentes ?? []).filter((c) =>
    search === "" ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.seguradora ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Avatar clicável para trocar foto */}
          <div className="relative group flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Clique para alterar sua foto"
              className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white shadow-sm bg-[#03a4ed]/10 flex items-center justify-center relative focus:outline-none focus:ring-2 focus:ring-[#03a4ed]"
            >
              {uploadingPhoto ? (
                <span className="w-5 h-5 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
              ) : currentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentImage} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-[#03a4ed]">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
              {/* Overlay ao hover */}
              {!uploadingPhoto && (
                <span className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              )}
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{greeting(userName)}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-400 text-sm capitalize">{today}</p>
              {grupo && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: grupo.cor }}
                >
                  {grupo.nome}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-sm text-slate-500 bg-white rounded-xl px-4 py-2 shadow-sm border border-slate-100">
              {MESES[data.mes - 1]} {data.ano}
            </span>
          )}
          <Link
            href="/cotacoes/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-apolizza-blue-gradient text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md hover:opacity-90 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nova Cotação
          </Link>
        </div>
      </div>

      {/* Próximas Tratativas */}
      {userRole === "cotador" ? <ProximasTratativas /> : <ProximasTrativasKanban />}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: Cotações recentes (2/3 width) ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nome ou seguradora..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[#03a4ed] focus:ring-1 focus:ring-[#03a4ed]/20 bg-slate-50"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#03a4ed] focus:ring-1 focus:ring-[#03a4ed]/20 text-slate-600"
              >
                <option value="">Todos os status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Produto filter */}
              <select
                value={produtoFilter}
                onChange={(e) => setProdutoFilter(e.target.value)}
                className="text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#03a4ed] focus:ring-1 focus:ring-[#03a4ed]/20 text-slate-600"
              >
                <option value="">Todos os produtos</option>
                {PRODUTO_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Clear filters */}
              {(statusFilter || produtoFilter || seguradoraFilter || search) && (
                <button
                  onClick={() => {
                    setStatusFilter("");
                    setProdutoFilter("");
                    setSeguradoraFilter("");
                    setSearch("");
                  }}
                  className="text-sm text-slate-400 hover:text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Cotações table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Minhas Cotações
                {cotacoesFiltradas.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({cotacoesFiltradas.length})
                  </span>
                )}
              </h2>
              <Link
                href="/cotacoes"
                className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
              >
                Ver todas →
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cotacoesFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">Nenhuma cotação encontrada</p>
                <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros ou crie uma nova cotação</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">Nome</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium hidden md:table-cell">Produto</th>
                      <th className="px-5 py-3 font-medium hidden lg:table-cell">Seguradora</th>
                      <th className="px-5 py-3 font-medium text-right">A Receber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cotacoesFiltradas.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/cotacoes/${c.id}`}
                            className="font-medium text-slate-900 hover:text-[#03a4ed] transition-colors leading-tight"
                          >
                            {c.name}
                          </Link>
                          {c.dueDate && (
                            <p className={`text-xs mt-0.5 ${isOverdue(c.dueDate) ? "text-red-400" : "text-slate-400"}`}>
                              {isOverdue(c.dueDate) ? "⚠ " : ""}Vence {fmtDate(c.dueDate)}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${STATUS_BADGES[c.status] || "bg-slate-100 text-slate-600"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell">
                          {c.produto ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell">
                          {c.seguradora ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {fmt(c.aReceber)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Meta + Tarefas (1/3 width) ── */}
        <div className="space-y-4">
          {loading ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 h-64 animate-pulse" />
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 h-48 animate-pulse" />
            </>
          ) : (
            <>
              <MetaPanel meta={data?.meta ?? null} prod={data?.produtividade ?? { qtdCotacoes: 0, qtdFechadas: 0, qtdPerdas: 0, valorAReceber: 0, valorPremio: 0 }} />
              <TarefasPanel
                tarefas={data?.tarefas ?? []}
                onUpdateStatus={handleUpdateTarefaStatus}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
