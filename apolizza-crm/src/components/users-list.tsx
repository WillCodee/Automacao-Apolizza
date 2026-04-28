"use client";

import { useState, useEffect, useRef } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "admin" | "cotador" | "proprietario";
  isActive: boolean;
  photoUrl: string | null;
  createdAt: string;
};

function UserAvatar({ user, size = "md" }: { user: User; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
  return (
    <div className={`${dim} rounded-full overflow-hidden bg-[#03a4ed]/10 flex items-center justify-center flex-shrink-0`}>
      {user.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold text-[#03a4ed]">
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function UsersList() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "cotador" as "admin" | "cotador" | "proprietario",
  });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoUserId, setPendingPhotoUserId] = useState<string | null>(null);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    const json = await res.json();
    setUsersList(json.data || []);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function resetForm() {
    setForm({ name: "", email: "", username: "", password: "", role: "cotador" });
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let res: Response;
    if (editingId) {
      const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      res = await fetch(`/api/users/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }

    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Erro ao salvar usuário");
      return;
    }

    resetForm();
    fetchUsers();
  }

  async function toggleActive(userId: string, isActive: boolean) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Erro ao atualizar status");
      return;
    }
    fetchUsers();
  }

  async function handleDelete(userId: string) {
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    const json = await res.json();
    setConfirmDeleteId(null);
    if (!res.ok) {
      alert(json.error || "Erro ao excluir usuário");
      return;
    }
    const n = json.data?.cotacoesDesvinculadas;
    if (n > 0) alert(`Usuário excluído. ${n} cotação(ões) ficaram sem responsável.`);
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

  function triggerPhotoUpload(userId: string) {
    setPendingPhotoUserId(userId);
    fileInputRef.current?.click();
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingPhotoUserId) return;

    setUploadingId(pendingPhotoUserId);
    const fd = new FormData();
    fd.append("photo", file);

    try {
      await fetch(`/api/users/${pendingPhotoUserId}/photo`, {
        method: "POST",
        body: fd,
      });
      fetchUsers();
    } finally {
      setUploadingId(null);
      setPendingPhotoUserId(null);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const editingUser = editingId ? usersList.find((u) => u.id === editingId) : null;

  return (
    <div className="space-y-6">
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoFileChange}
      />

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

          {/* Avatar + photo upload (only when editing) */}
          {editingId && editingUser && (
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#03a4ed]/10 flex items-center justify-center ring-2 ring-white shadow-sm">
                  {editingUser.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editingUser.photoUrl} alt={editingUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-[#03a4ed]">
                      {editingUser.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {uploadingId === editingId && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => triggerPhotoUpload(editingId)}
                  disabled={uploadingId === editingId}
                  className="text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium disabled:opacity-50"
                >
                  {uploadingId === editingId ? "Enviando..." : "Trocar foto"}
                </button>
                <p className="text-xs text-slate-400 mt-0.5">JPG, PNG ou WebP · máx. 5 MB</p>
              </div>
            </div>
          )}

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
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "cotador" | "proprietario" })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              >
                <option value="cotador">Cotador</option>
                <option value="admin">Admin</option>
                <option value="proprietario">Proprietário</option>
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
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <UserAvatar user={u} size="sm" />
                    <button
                      onClick={() => triggerPhotoUpload(u.id)}
                      disabled={uploadingId === u.id}
                      title="Trocar foto"
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#03a4ed] rounded-full flex items-center justify-center hover:bg-[#0288d1] transition-colors disabled:opacity-50"
                    >
                      {uploadingId === u.id ? (
                        <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
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
              <div className="flex justify-end gap-3 flex-wrap">
                <button
                  onClick={() => startEdit(u)}
                  className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium min-h-[44px] flex items-center"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(u.id, u.isActive)}
                  className={`text-xs font-medium min-h-[44px] flex items-center ${u.isActive ? "text-amber-500 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-800"}`}
                >
                  {u.isActive ? "Desativar" : "Reativar"}
                </button>
                {confirmDeleteId === u.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Confirmar?</span>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-xs font-semibold text-white bg-[#ff695f] hover:bg-[#e55a50] px-2 py-1 rounded-lg transition"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(u.id)}
                    className="text-xs font-medium text-[#ff695f] hover:text-[#e55a50] min-h-[44px] flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Excluir
                  </button>
                )}
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
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wide text-right w-[220px]">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersList.map((u) => (
              <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.isActive ? "opacity-50" : ""}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      <UserAvatar user={u} size="sm" />
                      <button
                        onClick={() => triggerPhotoUpload(u.id)}
                        disabled={uploadingId === u.id}
                        title="Trocar foto"
                        className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity disabled:opacity-100"
                      >
                        {uploadingId === u.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <span className="font-medium text-slate-900">{u.name}</span>
                  </div>
                </td>
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
                <td className="px-5 py-3 text-right whitespace-nowrap min-w-[230px]">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => startEdit(u)}
                      className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActive(u.id, u.isActive)}
                      className={`text-xs font-medium ${u.isActive ? "text-amber-500 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-800"}`}
                    >
                      {u.isActive ? "Desativar" : "Reativar"}
                    </button>
                    {confirmDeleteId === u.id ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-xs text-slate-500">Confirmar?</span>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-xs font-semibold text-white bg-[#ff695f] hover:bg-[#e55a50] px-2 py-1 rounded-lg transition"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-slate-500 hover:text-slate-700 px-1"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(u.id)}
                        className="text-xs font-medium text-[#ff695f] hover:text-[#e55a50] flex items-center gap-1 whitespace-nowrap"
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
