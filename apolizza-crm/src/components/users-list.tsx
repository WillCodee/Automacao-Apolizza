"use client";

import { useState, useEffect } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "admin" | "cotador";
  isActive: boolean;
  createdAt: string;
};

export function UsersList() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "cotador" as "admin" | "cotador",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    const json = await res.json();
    setUsersList(json.data || []);
  }

  function resetForm() {
    setForm({ name: "", email: "", username: "", password: "", role: "cotador" });
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingId) {
      const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      await fetch(`/api/users/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }

    resetForm();
    fetchUsers();
  }

  async function toggleActive(userId: string, isActive: boolean) {
    if (isActive) {
      if (!confirm("Desativar este usuario?")) return;
      await fetch(`/api/users/${userId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
    }
    fetchUsers();
  }

  function startEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      username: user.username,
      password: "",
      role: user.role,
    });
    setEditingId(user.id);
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Gestao de Usuarios</h2>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
          >
            + Novo Usuario
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId ? "Editar Usuario" : "Novo Usuario"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">Nome</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Username</label>
              <input
                type="text"
                required={!editingId}
                disabled={!!editingId}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50 disabled:text-slate-400 focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">
                Senha {editingId ? "(deixe vazio para manter)" : ""}
              </label>
              <input
                type="password"
                required={!editingId}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Perfil</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "cotador" })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              >
                <option value="cotador">Cotador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm">
              {editingId ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {usersList.map((u) => (
            <div key={u.id} className={`p-4 space-y-2 ${!u.isActive ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#03a4ed]/10 flex items-center justify-center text-[#03a4ed] font-semibold text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                    u.role === "admin" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-[#03a4ed]"
                  }`}>
                    {u.role}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                    u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#ff695f]"
                  }`}>
                    {u.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => startEdit(u)}
                  className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium min-h-[44px] flex items-center"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(u.id, u.isActive)}
                  className={`text-xs font-medium min-h-[44px] flex items-center ${u.isActive ? "text-[#ff695f] hover:text-[#e55a50]" : "text-emerald-600 hover:text-emerald-800"}`}
                >
                  {u.isActive ? "Desativar" : "Reativar"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wide">Nome</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wide">Email</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wide">Perfil</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wide text-center">Status</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wide text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersList.map((u) => (
              <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.isActive ? "opacity-50" : ""}`}>
                <td className="px-5 py-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    u.role === "admin" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-[#03a4ed]"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#ff695f]"
                  }`}>
                    {u.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right space-x-2">
                  <button
                    onClick={() => startEdit(u)}
                    className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActive(u.id, u.isActive)}
                    className={`text-xs font-medium ${u.isActive ? "text-[#ff695f] hover:text-[#e55a50]" : "text-emerald-600 hover:text-emerald-800"}`}
                  >
                    {u.isActive ? "Desativar" : "Reativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
