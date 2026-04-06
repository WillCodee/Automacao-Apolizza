"use client";

import { useState, useEffect } from "react";

type SituacaoItem = {
  id: string;
  nome: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  defaultCotadorId: string | null;
};

type User = {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
};

export function SituacaoConfigList() {
  const [items, setItems] = useState<SituacaoItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", orderIndex: 0, defaultCotadorId: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchItems();
    fetchUsers();
  }, []);

  async function fetchItems() {
    const res = await fetch("/api/situacao-config");
    const json = await res.json();
    setItems(json.data || []);
  }

  async function fetchUsers() {
    const res = await fetch("/api/users");
    const json = await res.json();
    if (json.success) setUsers(json.data.filter((u: User) => u.isActive));
  }

  function resetForm() {
    setForm({ nome: "", orderIndex: 0, defaultCotadorId: "" });
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  function startEdit(item: SituacaoItem) {
    setForm({ nome: item.nome, orderIndex: item.orderIndex, defaultCotadorId: item.defaultCotadorId ?? "" });
    setEditingId(item.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = editingId ? `/api/situacao-config/${editingId}` : "/api/situacao-config";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        orderIndex: form.orderIndex,
        defaultCotadorId: form.defaultCotadorId || null,
      }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error || "Erro ao salvar");
      return;
    }

    resetForm();
    fetchItems();
  }

  async function handleToggleActive(item: SituacaoItem) {
    await fetch(`/api/situacao-config/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    fetchItems();
  }

  async function handleDelete(item: SituacaoItem) {
    if (!confirm(`Excluir a situação "${item.nome}"?\n\nCotações com esta situação podem ficar sem classificação.`)) return;
    setDeletingId(item.id);
    await fetch(`/api/situacao-config/${item.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (editingId === item.id) resetForm();
    fetchItems();
  }

  function getUserName(id: string | null) {
    if (!id) return null;
    return users.find((u) => u.id === id)?.name ?? null;
  }

  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Configuração de Situações</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Situações disponíveis no formulário de cotação
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
          >
            + Nova Situação
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId ? "Editar Situação" : "Nova Situação"}
          </h3>

          {error && (
            <p className="text-xs text-[#ff695f] bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">Nome</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: COTAR, CLIENTE, IMPLANTAÇÃO..."
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
              <p className="text-[10px] text-slate-400 mt-1">Será salvo em maiúsculas</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Ordem</label>
              <input
                type="number"
                min={0}
                value={form.orderIndex}
                onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Responsável padrão</label>
            <select
              value={form.defaultCotadorId}
              onChange={(e) => setForm({ ...form, defaultCotadorId: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition text-slate-700"
            >
              <option value="">Nenhum (sem auto-atribuição)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.role === "admin" ? "Admin" : "Cotador"}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Ao mudar a situação da cotação para esta, o responsável será atribuído automaticamente.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Active items */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Situações Ativas</h3>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
            {activeItems.length}
          </span>
        </div>

        {activeItems.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">
            Nenhuma situação cadastrada. Crie a primeira acima.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeItems.map((item) => {
              const linkedUser = getUserName(item.defaultCotadorId);
              return (
                <li key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#03a4ed]/10 flex items-center justify-center text-[10px] font-bold text-[#03a4ed] shrink-0">
                      {item.orderIndex}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-800">{item.nome}</span>
                      {linkedUser && (
                        <span className="ml-2 text-xs text-emerald-600 font-medium">
                          → {linkedUser}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(item)}
                      className="text-xs text-amber-500 hover:text-amber-700 font-medium"
                    >
                      Desativar
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="text-xs text-[#ff695f] hover:text-[#e55a50] font-medium disabled:opacity-50"
                    >
                      {deletingId === item.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Inactive items */}
      {inactiveItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-500">Situações Inativas</h3>
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
              {inactiveItems.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {inactiveItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-400 line-through">{item.nome}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                  >
                    Reativar
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="text-xs text-[#ff695f] hover:text-[#e55a50] font-medium disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
