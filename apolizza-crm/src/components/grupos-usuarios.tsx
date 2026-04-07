"use client";

import { useState, useEffect } from "react";

const CORES_PREDEFINIDAS = [
  "#03a4ed",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#ef4444",
  "#f59e0b",
  "#14b8a6",
  "#6366f1",
];

type MembroBasico = {
  id: string;
  name: string;
  photoUrl: string | null;
};

type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  createdAt: string;
  updatedAt: string;
  membros: MembroBasico[];
  totalMembros: number;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
};

function MemberAvatar({ member, size = "sm" }: { member: MembroBasico; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  return (
    <div className={`${dim} rounded-full overflow-hidden bg-[#03a4ed]/10 flex items-center justify-center flex-shrink-0 border-2 border-white`}>
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold text-[#03a4ed]">
          {member.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function GrupoCard({
  grupo,
  onEdit,
  onDelete,
  onRefresh,
}: {
  grupo: Grupo;
  onEdit: (g: Grupo) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      setAllUsers(json.data || []);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && allUsers.length === 0) {
      await fetchUsers();
    }
  }

  async function handleAddMember(userId: string) {
    setAddingId(userId);
    try {
      await fetch(`/api/grupos/${grupo.id}/membros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setSearchTerm("");
      onRefresh();
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingId(userId);
    try {
      await fetch(`/api/grupos/${grupo.id}/membros/${userId}`, { method: "DELETE" });
      onRefresh();
    } finally {
      setRemovingId(null);
    }
  }

  const memberIds = new Set(grupo.membros.map((m) => m.id));
  const nonMembers = allUsers.filter(
    (u) =>
      !memberIds.has(u.id) &&
      (searchTerm === "" ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: grupo.cor }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: grupo.cor + "20" }}
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: grupo.cor }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">{grupo.nome}</h3>
              {grupo.descricao && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{grupo.descricao}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(grupo)}
              className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium px-2 py-1"
            >
              Editar
            </button>
            <button
              onClick={() => onDelete(grupo.id)}
              className="text-xs text-[#ff695f] hover:text-[#e55a50] font-medium px-2 py-1"
            >
              Excluir
            </button>
          </div>
        </div>

        {/* Member avatars preview */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center">
            {grupo.membros.slice(0, 5).map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <MemberAvatar member={m} size="xs" />
              </div>
            ))}
            {grupo.totalMembros > 5 && (
              <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center -ml-2">
                <span className="text-xs text-slate-500 font-medium">+{grupo.totalMembros - 5}</span>
              </div>
            )}
            {grupo.totalMembros === 0 && (
              <span className="text-xs text-slate-400">Sem membros</span>
            )}
          </div>
          <button
            onClick={handleExpand}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1 transition-colors"
          >
            Gerenciar Membros
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded member management */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {/* Current members */}
            {grupo.membros.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Membros atuais</p>
                <div className="space-y-1">
                  {grupo.membros.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
                      <div className="flex items-center gap-2">
                        <MemberAvatar member={m} size="sm" />
                        <span className="text-sm text-slate-700">{m.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={removingId === m.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#ff695f] hover:text-[#e55a50] disabled:opacity-50"
                        title="Remover membro"
                      >
                        {removingId === m.id ? (
                          <div className="w-4 h-4 border-2 border-[#ff695f] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">Nenhum membro ainda</p>
            )}

            {/* Add new member */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Adicionar membro</p>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-3">
                  <div className="w-4 h-4 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Buscar usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
                  />
                  {nonMembers.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-100">
                      {nonMembers.slice(0, 8).map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleAddMember(u.id)}
                          disabled={addingId === u.id}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#03a4ed]/10 flex items-center justify-center flex-shrink-0">
                              {u.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.photoUrl} alt={u.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <span className="text-xs font-semibold text-[#03a4ed]">
                                  {u.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-slate-800 font-medium">{u.name}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                          </div>
                          {addingId === u.id ? (
                            <div className="w-4 h-4 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4 text-[#03a4ed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : searchTerm !== "" ? (
                    <p className="text-xs text-slate-400 text-center py-2">Nenhum usuário encontrado</p>
                  ) : allUsers.length === memberIds.size ? (
                    <p className="text-xs text-slate-400 text-center py-2">Todos os usuários já são membros</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function GruposUsuarios() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<Grupo | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    cor: "#03a4ed",
  });

  async function fetchGrupos() {
    try {
      const res = await fetch("/api/grupos");
      const json = await res.json();
      setGrupos(json.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGrupos();
  }, []);

  function openCreate() {
    setEditingGrupo(null);
    setForm({ nome: "", descricao: "", cor: "#03a4ed" });
    setShowForm(true);
  }

  function openEdit(grupo: Grupo) {
    setEditingGrupo(grupo);
    setForm({ nome: grupo.nome, descricao: grupo.descricao ?? "", cor: grupo.cor });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingGrupo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingGrupo) {
        await fetch(`/api/grupos/${editingGrupo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            descricao: form.descricao || undefined,
            cor: form.cor,
          }),
        });
      } else {
        await fetch("/api/grupos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            descricao: form.descricao || undefined,
            cor: form.cor,
          }),
        });
      }
      setShowForm(false);
      setEditingGrupo(null);
      await fetchGrupos();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este grupo? Esta ação removerá todos os membros do grupo.")) return;
    await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    await fetchGrupos();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Grupos de Usuários</h2>
        {!showForm && (
          <button
            onClick={openCreate}
            className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
          >
            + Novo Grupo
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border border-slate-100"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            {editingGrupo ? "Editar Grupo" : "Novo Grupo"}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">
                Nome <span className="text-[#ff695f]">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Equipe Comercial"
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium">Descrição</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição opcional do grupo..."
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium">Cor do grupo</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CORES_PREDEFINIDAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setForm({ ...form, cor })}
                    className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: cor,
                      borderColor: form.cor === cor ? "#1e293b" : "transparent",
                      transform: form.cor === cor ? "scale(1.15)" : "scale(1)",
                    }}
                    title={cor}
                  >
                    {form.cor === cor && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingGrupo ? "Salvar" : "Criar Grupo"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Nenhum grupo criado ainda.</p>
          <button
            onClick={openCreate}
            className="mt-3 text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium"
          >
            Criar primeiro grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grupos.map((grupo) => (
            <GrupoCard
              key={grupo.id}
              grupo={grupo}
              onEdit={openEdit}
              onDelete={handleDelete}
              onRefresh={fetchGrupos}
            />
          ))}
        </div>
      )}
    </div>
  );
}
