"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

type Notificacao = {
  id: string;
  cotacaoId: string;
  cotacaoNome: string;
  autorId: string | null;
  autorNome: string | null;
  tipo: "mensagem" | "observacao";
  texto: string;
  createdAt: string;
};

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificacoesPage() {
  const { data: session, status } = useSession();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<"" | "mensagem" | "observacao">("");

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/login";
      return;
    }
    if (status === "authenticated") {
      const role = session?.user?.role;
      if (role !== "admin" && role !== "proprietario") {
        window.location.href = "/dashboard";
        return;
      }
      fetch("/api/notificacoes")
        .then((r) => r.json())
        .then((j) => setNotificacoes(j.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [status, session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) return null;

  const filtered = filterTipo ? notificacoes.filter((n) => n.tipo === filterTipo) : notificacoes;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role as "admin" | "cotador" | "proprietario"}
        activePage="notificacoes"
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notificações de Cotações</h1>
            <p className="text-slate-500 text-sm mt-1">
              Mensagens e observações registradas nas cotações.
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#03a4ed]/10 text-[#03a4ed]">
                {filtered.length} notificaç{filtered.length !== 1 ? "ões" : "ão"}
              </span>
            </p>
          </div>

          {/* Filtro por tipo */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterTipo("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTipo === "" ? "bg-[#03a4ed] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterTipo("mensagem")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTipo === "mensagem" ? "bg-violet-500 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Mensagens
            </button>
            <button
              onClick={() => setFilterTipo("observacao")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTipo === "observacao" ? "bg-amber-500 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Observações
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Nenhuma notificação ainda</h3>
            <p className="text-sm text-slate-400">Mensagens e observações das cotações aparecerão aqui.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {filtered.map((n) => (
              <div key={n.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    n.tipo === "mensagem" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {n.tipo === "mensagem" ? "💬" : "📝"}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-900 text-sm">
                      {n.autorNome || "Sistema"}
                    </span>
                    <span className="text-slate-400 text-xs">em</span>
                    <Link
                      href={`/cotacoes/${n.cotacaoId}`}
                      className="text-sm text-[#03a4ed] font-medium hover:underline truncate max-w-[200px]"
                    >
                      {n.cotacaoNome}
                    </Link>
                  </div>
                  <p className="text-sm text-slate-700 break-words leading-relaxed">{n.texto}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.createdAt)}</p>
                </div>

                {/* Badge */}
                <div className="shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    n.tipo === "mensagem"
                      ? "bg-violet-100 text-violet-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {n.tipo === "mensagem" ? "Mensagem" : "Observação"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
