"use client";

import { useState } from "react";

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

interface TarefaCardProps {
  tarefa: Tarefa;
  isAdmin: boolean;
  onAtualizada: () => void;
  onDeletada: () => void;
}

const statusColors = {
  Pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Em Andamento": "bg-blue-100 text-blue-800 border-blue-200",
  Concluída: "bg-green-100 text-green-800 border-green-200",
  Cancelada: "bg-gray-100 text-gray-800 border-gray-200",
};

export function TarefaCard({ tarefa, isAdmin, onAtualizada, onDeletada }: TarefaCardProps) {
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
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
          <p className="text-slate-600 text-sm line-clamp-2">{tarefa.descricao}</p>
        )}

        {/* Cotador */}
        <div className="flex items-center gap-2">
          {tarefa.cotador.photoUrl ? (
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
          <span className={isOverdue ? "text-red-600 font-medium" : "text-slate-600"}>
            {formatDate(tarefa.dataVencimento)}
            {isOverdue && " (Atrasada)"}
          </span>
        </div>

        {/* Ações (apenas admin) */}
        {isAdmin && (
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            >
              {loading ? "Deletando..." : "Deletar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
