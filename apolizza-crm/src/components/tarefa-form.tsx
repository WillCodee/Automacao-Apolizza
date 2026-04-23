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

interface Grupo {
  id: string;
  nome: string;
  cor: string | null;
  totalMembros: number;
}

type Modo = "usuario" | "grupo";

export function TarefaForm({ onClose, onTarefaCriada }: TarefaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [cotadorId, setCotadorId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [modo, setModo] = useState<Modo>("usuario");
  const [users, setUsers] = useState<User[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [loadingAttempt, setLoadingAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);

  const fetchUsers = async (attempt = 1) => {
    setLoadingUsers(true);
    setLoadingAttempt(attempt);
    setUsersError("");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/users", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        setUsers(data.data.filter((u: User) => u.isActive));
        setLoadingUsers(false);
        setLoadingAttempt(0);
        return;
      }

      if (attempt < 5) {
        const delay = attempt * 2000;
        setTimeout(() => fetchUsers(attempt + 1), delay);
        return;
      }
      setUsersError("Não foi possível carregar os usuários após 5 tentativas.");
    } catch (error) {
      console.error(`[TarefaForm] Erro ao carregar usuários (tentativa ${attempt}/5):`, error);

      if (attempt < 5) {
        const delay = attempt * 2000;
        setTimeout(() => fetchUsers(attempt + 1), delay);
        return;
      }

      const errorMsg = error instanceof Error && error.name === 'AbortError'
        ? "Tempo limite excedido. O servidor está demorando para responder."
        : "Erro ao conectar. Verifique sua conexão.";
      setUsersError(errorMsg);
    }
    setLoadingUsers(false);
    setLoadingAttempt(0);
  };

  const fetchGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const res = await fetch("/api/grupos");
      const data = await res.json();
      if (data.success) {
        setGrupos(data.data ?? []);
      }
    } catch (err) {
      console.error("[TarefaForm] Erro ao carregar grupos:", err);
    }
    setLoadingGrupos(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const payload: Record<string, unknown> = {
        titulo,
        descricao: descricao || null,
        dataVencimento: dataVencimento ? new Date(dataVencimento).toISOString() : null,
        checklistItems: checklistItems.filter((t) => t.trim()),
      };

      if (modo === "grupo") {
        payload.grupoId = grupoId;
      } else {
        payload.cotadorId = cotadorId;
      }

      const res = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const isDestinatarioValido = modo === "usuario" ? !!cotadorId : !!grupoId;

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

          {/* Destinatário — Toggle usuario/grupo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Destinatário <span className="text-red-500">*</span>
            </label>

            {/* Toggle buttons */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => { setModo("usuario"); setGrupoId(""); }}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modo === "usuario"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Usuário
              </button>
              <button
                type="button"
                onClick={() => { setModo("grupo"); setCotadorId(""); }}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modo === "grupo"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Grupo
              </button>
            </div>

            {modo === "usuario" ? (
              // Select de usuários
              loadingUsers ? (
                <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {loadingAttempt > 1
                    ? `Tentativa ${loadingAttempt}/5... (aguarde, pode levar até 15s)`
                    : "Carregando usuários... (pode levar até 15s na 1ª vez)"}
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
              )
            ) : (
              // Select de grupos
              loadingGrupos ? (
                <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Carregando grupos...
                </div>
              ) : grupos.length === 0 ? (
                <div className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
                  Nenhum grupo cadastrado. Crie um grupo em Administração primeiro.
                </div>
              ) : (
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#03a4ed] focus:ring-2 focus:ring-[#03a4ed]/20 outline-none transition text-sm text-slate-700"
                >
                  <option value="">Selecione o grupo...</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome} ({g.totalMembros} {g.totalMembros === 1 ? "membro" : "membros"})
                    </option>
                  ))}
                </select>
              )
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
              disabled={loading || (modo === "usuario" && loadingUsers) || !isDestinatarioValido}
              className="flex-1 px-4 py-2.5 rounded-xl bg-apolizza-gradient text-white font-medium hover:opacity-90 transition disabled:opacity-50 text-sm"
            >
              {loading ? "Criando..." : modo === "grupo" ? "Criar para Grupo" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
