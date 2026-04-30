"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useSession } from "next-auth/react";

type Notificacao = {
  id: string;
  cotacaoId: string;
  cotacaoNome: string;
  autorId: string | null;
  autorNome: string | null;
  tipo: "mensagem" | "observacao" | "atrasado";
  texto: string;
  destinatarioId: string | null;
  lida: boolean;
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

const TIPO_CONFIG = {
  mensagem:   { emoji: "💬", label: "Mensagem",   bg: "bg-violet-100 text-violet-700" },
  observacao: { emoji: "📝", label: "Observação", bg: "bg-amber-100 text-amber-700" },
  atrasado:   { emoji: "⏰", label: "Atrasado",   bg: "bg-red-100 text-red-700" },
};

export default function NotificacoesPage() {
  const { data: session, status } = useSession();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<"" | "mensagem" | "observacao" | "atrasado">("");
  const [filterLida, setFilterLida] = useState<"" | "nao-lidas">("nao-lidas");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/login";
      return;
    }
    if (status === "authenticated") {
      fetch("/api/notificacoes")
        .then((r) => r.json())
        .then((j) => setNotificacoes(j.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [status]);

  async function marcarTodasLidas() {
    setMarking(true);
    try {
      await fetch("/api/notificacoes", { method: "PUT" });
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    } finally {
      setMarking(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) return null;

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  let filtered = notificacoes;
  if (filterTipo) filtered = filtered.filter((n) => n.tipo === filterTipo);
  if (filterLida === "nao-lidas") filtered = filtered.filter((n) => !n.lida);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userName={session.user.name || ""}
        userRole={session.user.role as "admin" | "cotador" | "proprietario"}
        userPhoto={session.user.image}
        activePage="notificacoes"
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              Notificações
              {naoLidas > 0 && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-[#ff695f] text-white text-xs font-bold">
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Mensagens, observações e alertas das cotações.
            </p>
          </div>

          {naoLidas > 0 && (
            <button
              onClick={marcarTodasLidas}
              disabled={marking}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {marking ? "Marcando..." : "Marcar todas como lidas"}
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterLida("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterLida === "" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterLida("nao-lidas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                filterLida === "nao-lidas" ? "bg-[#ff695f] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {naoLidas > 0 && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
              Não lidas {naoLidas > 0 ? `(${naoLidas})` : ""}
            </button>
          </div>

          <div className="w-px bg-slate-200" />

          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterTipo("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTipo === "" ? "bg-[#03a4ed] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Todos tipos
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
            <button
              onClick={() => setFilterTipo("atrasado")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                filterTipo === "atrasado" ? "bg-red-500 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              ⏰ Atrasadas
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
            <h3 className="text-base font-semibold text-slate-700 mb-1">Nenhuma notificação</h3>
            <p className="text-sm text-slate-400">Você está em dia — nenhuma notificação nos filtros selecionados.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {filtered.map((n) => {
              const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.mensagem;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    !n.lida ? "bg-[#ff695f]/[0.04] hover:bg-[#ff695f]/[0.07]" : "hover:bg-slate-50/50"
                  }`}
                >
                  {/* Ícone tipo */}
                  <div className="shrink-0 mt-0.5 relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base ${cfg.bg}`}>
                      {cfg.emoji}
                    </div>
                    {/* Ponto vermelho de não lida */}
                    {!n.lida && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#ff695f] border-2 border-white" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`font-semibold text-sm ${!n.lida ? "text-slate-900" : "text-slate-700"}`}>
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
                    <p className={`text-sm break-words leading-relaxed ${!n.lida ? "text-slate-800" : "text-slate-600"}`}>
                      {n.texto}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.createdAt)}</p>
                  </div>

                  {/* Badge tipo + indicador não lida */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                    {!n.lida && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff695f] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Nova
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
