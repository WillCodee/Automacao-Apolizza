"use client";

import { useState, useEffect } from "react";
import { BriefingsList } from "./briefings-list";
import { BriefingForm } from "./briefing-form";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  dataVencimento: string | null;
  status: "Pendente" | "Em Andamento" | "Concluída" | "Cancelada";
  cotador: {
    id: string;
    name: string;
    email: string;
    photoUrl: string | null;
  };
  criador: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface Briefing {
  id: string;
  briefing: string;
  createdAt: string;
  usuario: {
    id: string;
    name: string;
    email: string;
    photoUrl: string | null;
  };
}

interface TarefaCardProps {
  tarefa: Tarefa;
  isAdmin: boolean;
  userId: string;
  onAtualizada: () => void;
  onDeletada: () => void;
}

const statusColors = {
  Pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Em Andamento": "bg-blue-100 text-blue-800 border-blue-200",
  Concluída: "bg-green-100 text-green-800 border-green-200",
  Cancelada: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusFlow: Record<string, string | null> = {
  Pendente: "Em Andamento",
  "Em Andamento": "Concluída",
  Concluída: null,
  Cancelada: null,
};

export function TarefaCard({
  tarefa,
  isAdmin,
  userId,
  onAtualizada,
  onDeletada,
}: TarefaCardProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [showBriefingForm, setShowBriefingForm] = useState(false);
  const [loadingBriefings, setLoadingBriefings] = useState(false);

  const isCotador = tarefa.cotador.id === userId;
  const canUpdateStatus = isAdmin || isCotador;

  // Carregar briefings quando expandir
  useEffect(() => {
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
      if (data.success) {
        setBriefings(data.data);
      }
    } catch (error) {
      console.error("Erro ao carregar briefings:", error);
    } finally {
      setLoadingBriefings(false);
    }
  };

  const handleStatusUpdate = async () => {
    const nextStatus = statusFlow[tarefa.status];
    if (!nextStatus) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tarefas/${tarefa.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (data.success) {
        onAtualizada();
      } else {
        alert(data.error || "Erro ao atualizar status");
      }
    } catch {
      alert("Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja deletar esta tarefa?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tarefas/${tarefa.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        onDeletada();
      } else {
        alert(data.error || "Erro ao deletar tarefa");
      }
    } catch {
      alert("Erro ao deletar tarefa");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sem prazo";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const isOverdue =
    tarefa.dataVencimento &&
    tarefa.status !== "Concluída" &&
    new Date(tarefa.dataVencimento) < new Date();

  const nextStatus = statusFlow[tarefa.status];

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border ${
        isOverdue ? "border-red-300" : "border-slate-200"
      }`}
    >
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 text-lg leading-tight">
            {tarefa.titulo}
          </h3>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
              statusColors[tarefa.status]
            }`}
          >
            {tarefa.status}
          </span>
        </div>

        {/* Descrição */}
        {tarefa.descricao && (
          <p className="text-slate-600 text-sm line-clamp-2">
            {tarefa.descricao}
          </p>
        )}

        {/* Cotador */}
        <div className="flex items-center gap-2">
          {tarefa.cotador.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tarefa.cotador.photoUrl}
              alt={tarefa.cotador.name}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-apolizza-blue/10 flex items-center justify-center text-xs font-semibold text-apolizza-blue">
              {tarefa.cotador.name.charAt(0)}
            </div>
          )}
          <span className="text-sm text-slate-700">{tarefa.cotador.name}</span>
        </div>

        {/* Data de Vencimento */}
        <div className="flex items-center gap-2 text-sm">
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span
            className={isOverdue ? "text-red-600 font-medium" : "text-slate-600"}
          >
            {formatDate(tarefa.dataVencimento)}
            {isOverdue && " (Atrasada)"}
          </span>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          {/* Botão de Status (cotador ou admin) */}
          {canUpdateStatus && nextStatus && (
            <button
              onClick={handleStatusUpdate}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-apolizza-blue hover:bg-blue-50 transition disabled:opacity-50"
            >
              {loading ? "Atualizando..." : `Marcar como ${nextStatus}`}
            </button>
          )}

          {/* Botão Ver Briefings */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            {expanded ? "Ocultar" : "Ver Briefings"}
          </button>

          {/* Botão Deletar (apenas admin) */}
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            >
              Deletar
            </button>
          )}
        </div>

        {/* Seção Expandida - Briefings */}
        {expanded && (
          <div className="pt-4 mt-4 border-t border-slate-100 space-y-4">
            {/* Botão Adicionar Briefing (cotador ou admin) */}
            {canUpdateStatus && !showBriefingForm && (
              <button
                onClick={() => setShowBriefingForm(true)}
                className="w-full px-4 py-2 text-sm font-medium text-apolizza-blue border border-apolizza-blue rounded-lg hover:bg-blue-50 transition"
              >
                + Adicionar Briefing
              </button>
            )}

            {/* Formulário de Briefing */}
            {showBriefingForm && (
              <BriefingForm
                tarefaId={tarefa.id}
                onSuccess={() => {
                  setShowBriefingForm(false);
                  loadBriefings();
                }}
                onCancel={() => setShowBriefingForm(false)}
              />
            )}

            {/* Lista de Briefings */}
            {loadingBriefings ? (
              <div className="text-center py-4 text-slate-500 text-sm">
                Carregando briefings...
              </div>
            ) : (
              <BriefingsList briefings={briefings} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
