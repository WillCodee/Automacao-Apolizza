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
  const [fetchError, setFetchError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterMes, setFilterMes] = useState<string>("");
  const [filterAno, setFilterAno] = useState<string>("");

  const currentYear = new Date().getFullYear();
  const ANOS = Array.from({ length: 4 }, (_, i) => String(currentYear - i));
  const MESES = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" }, { value: "4", label: "Abril" },
    { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];

  const fetchTarefas = async () => {
    try {
      setLoading(true);
      setFetchError("");
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (filterMes) params.set("mes", filterMes);
      if (filterAno) params.set("ano", filterAno);

      const res = await fetch(`/api/tarefas?${params}`);
      const data = await res.json();

      if (data.success) {
        setTarefas(data.data);
      } else {
        setFetchError(data.error || "Erro ao carregar tarefas");
      }
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
      setFetchError("Erro de conexão ao carregar tarefas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTarefas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, dateFrom, dateTo, filterMes, filterAno]);

  const handleTarefaCriada = () => {
    setShowForm(false);
    // Delay para garantir que o MySQL replicou o INSERT antes do SELECT
    setTimeout(() => fetchTarefas(), 500);
  };

  const handleTarefaAtualizada = () => {
    fetchTarefas();
  };

  const handleTarefaDeletada = () => {
    fetchTarefas();
  };

  const isAdmin = userRole === "admin" || userRole === "proprietario";

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

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-white"
          >
            <option value="">Mês</option>
            {MESES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={filterAno}
            onChange={(e) => setFilterAno(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-white"
          >
            <option value="">Ano</option>
            {ANOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Vencimento de:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-white"
          />
          <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Até:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-white"
          />
          {(dateFrom || dateTo || filterMes || filterAno) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setFilterMes(""); setFilterAno(""); }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕ Limpar
            </button>
          )}
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
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-600">{fetchError}</p>
          <button onClick={fetchTarefas} className="text-sm text-red-600 font-medium hover:underline">Tentar novamente</button>
        </div>
      )}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-apolizza-blue border-r-transparent"></div>
          <p className="mt-4 text-slate-500">Carregando tarefas...</p>
        </div>
      ) : tarefas.length === 0 && !fetchError ? (
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
