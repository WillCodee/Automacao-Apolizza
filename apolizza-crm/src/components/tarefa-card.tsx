"use client";

import { useState, useEffect } from "react";
import { BriefingsList } from "./briefings-list";
import { BriefingForm } from "./briefing-form";
import { UploadAnexos } from "./upload-anexos";
import { AnexosList } from "./anexos-list";
import { AtividadesTimeline } from "./atividades-timeline";
import { TarefaChecklist } from "./tarefa-checklist";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  dataVencimento: string | null;
  status: "Pendente" | "Em Andamento" | "Concluída" | "Cancelada";
  visualizadaEm: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  cotador: { id: string; name: string; email: string; photoUrl: string | null };
  criador: { id: string; name: string; email: string };
  createdAt: string;
}

interface Briefing {
  id: string;
  briefing: string;
  createdAt: string;
  usuario: { id: string; name: string; email: string; photoUrl: string | null };
}

interface TarefaCardProps {
  tarefa: Tarefa;
  isAdmin: boolean;
  userId: string;
  onAtualizada: () => void;
  onDeletada: () => void;
}

const statusFlow: Record<string, string | null> = {
  Pendente: "Em Andamento",
  "Em Andamento": "Concluída",
  Concluída: null,
  Cancelada: null,
};

function fmtDateTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ tarefa }: { tarefa: Tarefa }) {
  const isOverdue =
    tarefa.dataVencimento &&
    tarefa.status !== "Concluída" &&
    tarefa.status !== "Cancelada" &&
    new Date(tarefa.dataVencimento) < new Date();

  if (isOverdue) {
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-red-100 text-red-700 border-red-200">
        Em Atraso
      </span>
    );
  }

  const map: Record<string, string> = {
    Pendente: tarefa.visualizadaEm
      ? "bg-purple-100 text-purple-700 border-purple-200"
      : "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Em Andamento": "bg-blue-100 text-blue-800 border-blue-200",
    Concluída: "bg-green-100 text-green-800 border-green-200",
    Cancelada: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const label: Record<string, string> = {
    Pendente: tarefa.visualizadaEm ? "Visualizada" : "Pendente",
    "Em Andamento": "Em Andamento",
    Concluída: "Concluída",
    Cancelada: "Cancelada",
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${map[tarefa.status]}`}>
      {label[tarefa.status]}
    </span>
  );
}

export function TarefaCard({ tarefa, isAdmin, userId, onAtualizada, onDeletada }: TarefaCardProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [showBriefingForm, setShowBriefingForm] = useState(false);
  const [loadingBriefings, setLoadingBriefings] = useState(false);
  const [anexosRefresh, setAnexosRefresh] = useState(0);
  const [atividadesRefresh, setAtividadesRefresh] = useState(0);

  const isCotador = tarefa.cotador.id === userId;
  const isCreator = tarefa.criador.id === userId;
  const canUpdateStatus = isAdmin || isCotador;
  const userRole = isAdmin ? "admin" : "cotador";

  const isOverdue =
    tarefa.dataVencimento &&
    tarefa.status !== "Concluída" &&
    tarefa.status !== "Cancelada" &&
    new Date(tarefa.dataVencimento) < new Date();

  const nextStatus = statusFlow[tarefa.status];

  const refreshAtividades = () => setAtividadesRefresh((prev) => prev + 1);

  // Marca como visualizada quando cotador expande o card
  useEffect(() => {
    if (expanded && isCotador && !tarefa.visualizadaEm) {
      fetch(`/api/tarefas/${tarefa.id}/visualizar`, { method: "POST" }).catch(() => {});
    }
    if (expanded && briefings.length === 0) {
      loadBriefings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const loadBriefings = async () => {
    setLoadingBriefings(true);
    try {
      const res = await fetch(`/api/tarefas/${tarefa.id}/briefings`);
      const data = await res.json();
      if (data.success) setBriefings(data.data);
    } finally {
      setLoadingBriefings(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!nextStatus) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tarefas/${tarefa.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) { onAtualizada(); refreshAtividades(); }
      else alert(data.error || "Erro ao atualizar status");
    } catch { alert("Erro ao atualizar status"); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja deletar esta tarefa?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tarefas/${tarefa.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) onDeletada();
      else alert(data.error || "Erro ao deletar tarefa");
    } catch { alert("Erro ao deletar tarefa"); }
    finally { setLoading(false); }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border ${isOverdue ? "border-red-300" : "border-slate-200"}`}>
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 text-base leading-tight flex-1">{tarefa.titulo}</h3>
          <StatusBadge tarefa={tarefa} />
        </div>

        {/* Descrição */}
        {tarefa.descricao && (
          <p className="text-slate-500 text-sm line-clamp-2">{tarefa.descricao}</p>
        )}

        {/* Criador → Destinatário */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
          <span className="font-medium text-slate-700">{tarefa.criador.name}</span>
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="flex items-center gap-1">
            {tarefa.cotador.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tarefa.cotador.photoUrl} alt={tarefa.cotador.name} className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#03a4ed]/10 flex items-center justify-center text-[9px] font-semibold text-[#03a4ed]">
                {tarefa.cotador.name.charAt(0)}
              </div>
            )}
            <span className="font-medium text-slate-700">{tarefa.cotador.name}</span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-1 gap-1 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Criada: {fmtDateTime(tarefa.createdAt)}</span>
          </div>
          {tarefa.visualizadaEm && (
            <div className="flex items-center gap-1.5 text-purple-500">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Visualizada: {fmtDateTime(tarefa.visualizadaEm)}</span>
            </div>
          )}
          {tarefa.iniciadaEm && (
            <div className="flex items-center gap-1.5 text-blue-500">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Iniciada: {fmtDateTime(tarefa.iniciadaEm)}</span>
            </div>
          )}
          {tarefa.concluidaEm && (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Concluída: {fmtDateTime(tarefa.concluidaEm)}</span>
            </div>
          )}
          {tarefa.dataVencimento && (
            <div className={`flex items-center gap-1.5 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Prazo: {fmtDateTime(tarefa.dataVencimento)}{isOverdue ? " — ATRASADA" : ""}</span>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          {canUpdateStatus && nextStatus && (
            <button
              onClick={handleStatusUpdate}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-[#03a4ed] hover:bg-blue-50 transition disabled:opacity-50"
            >
              {loading ? "Atualizando..." : `→ ${nextStatus}`}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            {expanded ? "Ocultar" : "Detalhes"}
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition disabled:opacity-50"
            >
              Deletar
            </button>
          )}
        </div>

        {/* Seção Expandida */}
        {expanded && (
          <div className="pt-4 mt-2 border-t border-slate-100 space-y-6">

            {/* CHECKLIST */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">✅ Checklist</h4>
              <TarefaChecklist
                tarefaId={tarefa.id}
                canEdit={canUpdateStatus}
                isCreator={isAdmin || isCreator}
              />
            </div>

            {/* BRIEFINGS */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900">💬 Briefings</h4>
              {canUpdateStatus && !showBriefingForm && (
                <button
                  onClick={() => setShowBriefingForm(true)}
                  className="w-full px-4 py-2 text-sm font-medium text-[#03a4ed] border border-[#03a4ed] rounded-lg hover:bg-blue-50 transition"
                >
                  + Adicionar Briefing
                </button>
              )}
              {showBriefingForm && (
                <BriefingForm
                  tarefaId={tarefa.id}
                  onSuccess={() => { setShowBriefingForm(false); loadBriefings(); refreshAtividades(); }}
                  onCancel={() => setShowBriefingForm(false)}
                />
              )}
              {loadingBriefings ? (
                <p className="text-center py-4 text-slate-400 text-sm">Carregando...</p>
              ) : (
                <BriefingsList briefings={briefings} />
              )}
            </div>

            {/* ANEXOS */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900">📎 Anexos</h4>
              {canUpdateStatus && (
                <UploadAnexos
                  tarefaId={tarefa.id}
                  onUploadSuccess={() => { setAnexosRefresh((p) => p + 1); refreshAtividades(); }}
                />
              )}
              <AnexosList
                tarefaId={tarefa.id}
                refresh={anexosRefresh}
                currentUserId={userId}
                currentUserRole={userRole}
              />
            </div>

            {/* HISTÓRICO */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900">📝 Histórico de Atividades</h4>
              <AtividadesTimeline tarefaId={tarefa.id} refresh={atividadesRefresh} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
