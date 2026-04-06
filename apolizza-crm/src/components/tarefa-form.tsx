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
  role: string;
  isActive: boolean;
}

interface Situacao {
  id: string;
  nome: string;
  defaultCotadorId: string | null;
}

export function TarefaForm({ onClose, onTarefaCriada }: TarefaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [cotadorId, setCotadorId] = useState("");
  const [situacao, setSituacao] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);

  const fetchUsers = async (attempt = 1) => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const [resUsers, resSit] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/situacao-config"),
      ]);
      const [dataUsers, dataSit] = await Promise.all([resUsers.json(), resSit.json()]);

      if (dataUsers.success) {
        setUsers(dataUsers.data.filter((u: User) => u.isActive));
        setLoadingUsers(false);
      } else {
        throw new Error("users failed");
      }
      if (dataSit.success) {
        setSituacoes(dataSit.data.filter((s: Situacao & { isActive: boolean }) => s.isActive));
      }
    } catch {
      if (attempt < 3) {
        setTimeout(() => fetchUsers(attempt + 1), 1500);
        return;
      }
      setUsersError("Não foi possível carregar os dados. Tente novamente.");
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-preenche destinatário quando situação tem usuário vinculado
  const handleSituacaoChange = (nome: string) => {
    setSituacao(nome);
    const sit = situacoes.find((s) => s.nome === nome);
    if (sit?.defaultCotadorId) {
      setCotadorId(sit.defaultCotadorId);
    }
  };

  const handleChecklistChange = (idx: number, value: string) => {
    setChecklistItems((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const addChecklistItem = () => {
    setChecklistItems((prev) => [...prev, ""]);
  };

  const removeChecklistItem = (idx: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== idx));
  };

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
          dataVencimento: dataVencimento ? new Date(dataVencimento).toISOString() : null,
          cotadorId,
          situacao: situacao || null,
          checklistItems: checklistItems.filter((t) => t.trim()),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Erro ao criar tarefa");
        return;
      }

      onTarefaCriada();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  // Situação selecionada tem usuário vinculado?
  const sitAtual = situacoes.find((s) => s.nome === situacao);
  const cotadorVinculado = sitAtual?.defaultCotadorId
    ? users.find((u) => u.id === sitAtual.defaultCotadorId)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Nova Tarefa</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Título */}
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#03a4ed] focus:ring-2 focus:ring-[#03a4ed]/20 outline-none transition text-sm"
              placeholder="Ex: Revisar propostas pendentes"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#03a4ed] focus:ring-2 focus:ring-[#03a4ed]/20 outline-none transition resize-none text-sm"
              placeholder="Detalhes da tarefa..."
            />
          </div>

          {/* Situação */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Situação
            </label>
            <select
              value={situacao}
              onChange={(e) => handleSituacaoChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#03a4ed] focus:ring-2 focus:ring-[#03a4ed]/20 outline-none transition text-sm text-slate-700"
            >
              <option value="">Sem situação</option>
              {situacoes.map((s) => (
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
            </select>
            {cotadorVinculado && (
              <p className="text-xs text-[#03a4ed] mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Destinatário auto-preenchido: <strong>{cotadorVinculado.name}</strong>
              </p>
            )}
          </div>

          {/* Destinatário */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Destinatário <span className="text-red-500">*</span>
            </label>
            {loadingUsers ? (
              <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-sm text-slate-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Carregando usuários...
              </div>
            ) : usersError ? (
              <div className="space-y-1">
                <div className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600">
                  {usersError}
                </div>
                <button type="button" onClick={() => fetchUsers(1)} className="text-xs text-[#03a4ed] hover:underline font-medium">
                  Tentar novamente
                </button>
              </div>
            ) : (
              <select
                value={cotadorId}
                onChange={(e) => setCotadorId(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#03a4ed] focus:ring-2 focus:ring-[#03a4ed]/20 outline-none transition text-sm text-slate-700"
              >
                <option value="">Selecione o destinatário...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role === "admin" ? "Admin" : "Cotador"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Data de Vencimento */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data de Vencimento
            </label>
            <input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#03a4ed] focus:ring-2 focus:ring-[#03a4ed]/20 outline-none transition text-sm"
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Checklist
              <span className="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
            </label>
            <div className="space-y-2">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border-2 border-slate-300 flex-shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleChecklistChange(idx, e.target.value)}
                    placeholder={`Item ${idx + 1}...`}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-[#03a4ed] focus:ring-1 focus:ring-[#03a4ed]/20 outline-none text-sm bg-slate-50"
                  />
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(idx)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addChecklistItem}
              className="mt-2 text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
            >
              + Adicionar item
            </button>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingUsers}
              className="flex-1 px-4 py-2.5 rounded-xl bg-apolizza-gradient text-white font-medium hover:opacity-90 transition disabled:opacity-50 text-sm"
            >
              {loading ? "Criando..." : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
