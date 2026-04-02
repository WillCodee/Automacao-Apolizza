"use client";

import { useState, useEffect } from "react";

interface TarefaFormProps {
  onClose: () => void;
  onTarefaCriada: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function TarefaForm({ onClose, onTarefaCriada }: TarefaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [cotadorId, setCotadorId] = useState("");
  const [cotadores, setCotadores] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Buscar lista de cotadores
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCotadores(data.data.filter((u: User) => u.id));
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descricao: descricao || null,
          dataVencimento: dataVencimento
            ? new Date(dataVencimento).toISOString()
            : null,
          cotadorId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Erro ao criar tarefa");
        return;
      }

      onTarefaCriada();
    } catch (err: any) {
      setError(err.message || "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Nova Tarefa</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={255}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-apolizza-blue focus:ring-2 focus:ring-apolizza-blue/20 outline-none transition"
              placeholder="Ex: Revisar propostas pendentes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-apolizza-blue focus:ring-2 focus:ring-apolizza-blue/20 outline-none transition resize-none"
              placeholder="Detalhes da tarefa..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cotador <span className="text-red-500">*</span>
            </label>
            <select
              value={cotadorId}
              onChange={(e) => setCotadorId(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-apolizza-blue focus:ring-2 focus:ring-apolizza-blue/20 outline-none transition"
            >
              <option value="">Selecione um cotador</option>
              {cotadores.map((cotador) => (
                <option key={cotador.id} value={cotador.id}>
                  {cotador.name} ({cotador.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data de Vencimento
            </label>
            <input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-apolizza-blue focus:ring-2 focus:ring-apolizza-blue/20 outline-none transition"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-apolizza-gradient text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
