"use client";

import { useState, useEffect } from "react";
import { TarefaForm } from "./tarefa-form";
import { TarefaCard } from "./tarefa-card";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  dataVencimento: string | null;
  status: "Pendente" | "Em Andamento" | "Concluída" | "Cancelada";
  visualizadaEm: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
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
  updatedAt: string;
}

interface TarefasListProps {
  userRole: string;
  userId: string;
}

export function TarefasList({ userRole, userId }: TarefasListProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchTarefas = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/tarefas?${params}`);
      const data = await res.json();

      if (data.success) {
        setTarefas(data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTarefas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleTarefaCriada = () => {
    setShowForm(false);
    fetchTarefas();
  };

  const handleTarefaAtualizada = () => {
    fetchTarefas();
  };

  const handleTarefaDeletada = () => {
    fetchTarefas();
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-6">
      {/* Filtros e Ações */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === ""
                ? "bg-apolizza-blue text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterStatus("Pendente")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "Pendente"
                ? "bg-yellow-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilterStatus("Em Andamento")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "Em Andamento"
                ? "bg-blue-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Em Andamento
          </button>
          <button
            onClick={() => setFilterStatus("Concluída")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "Concluída"
                ? "bg-green-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Concluídas
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 text-white rounded-xl font-medium text-sm bg-apolizza-gradient hover:opacity-90 transition-all shadow-lg shadow-[#ff695f]/20"
          >
            + Nova Tarefa
          </button>
        )}
      </div>

      {/* Lista de Tarefas */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-apolizza-blue border-r-transparent"></div>
          <p className="mt-4 text-slate-500">Carregando tarefas...</p>
        </div>
      ) : tarefas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow">
          <p className="text-slate-500">Nenhuma tarefa encontrada</p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2 text-apolizza-blue font-medium hover:underline"
            >
              Criar primeira tarefa
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tarefas.map((tarefa) => (
            <TarefaCard
              key={tarefa.id}
              tarefa={tarefa}
              isAdmin={isAdmin}
              userId={userId}
              onAtualizada={handleTarefaAtualizada}
              onDeletada={handleTarefaDeletada}
            />
          ))}
        </div>
      )}

      {/* Modal de Criação */}
      {showForm && (
        <TarefaForm
          onClose={() => setShowForm(false)}
          onTarefaCriada={handleTarefaCriada}
        />
      )}
    </div>
  );
}
