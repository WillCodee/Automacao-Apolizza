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

function MemberAvatar({ member, size = "sm" }: { member: MembroBasico; size?: "sm" | "xs" | "md" }) {
  const dim =
    size === "xs" ? "w-6 h-6 text-xs" : size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-sm";
  return (
    <div
      className={`${dim} rounded-full overflow-hidden bg-[#03a4ed]/10 flex items-center justify-center flex-shrink-0 border-2 border-white`}
    >
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

/* ─── Card na lista ─────────────────────────────────────────────────── */
function GrupoCard({
  grupo,
  onEdit,
  onDelete,
}: {
  grupo: Grupo;
  onEdit: (g: Grupo) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
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
              className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={() => onDelete(grupo.id)}
              className="text-xs text-[#ff695f] hover:text-[#e55a50] font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Excluir
            </button>
          </div>
        </div>

        {/* Member avatars preview */}
        <div className="mt-4 flex items-center gap-2">
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
          </div>
          <span className="text-xs text-slate-400">
            {grupo.totalMembros === 0
              ? "Sem membros"
              : `${grupo.totalMembros} membro${grupo.totalMembros > 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Detalhe / edição do grupo ─────────────────────────────────────── */
function GrupoDetalhe({
  grupo,
  onBack,
  onSaved,
  onDeleted,
}: {
  grupo: Grupo;
  onBack: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    nome: grupo.nome,
    descricao: grupo.descricao ?? "",
    cor: grupo.cor,
  });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Membros
  const [membros, setMembros] = useState<MembroBasico[]>(grupo.membros);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLoadingUsers(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setAllUsers(d.data || []))
      .finally(() => setLoadingUsers(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveOk(false);
    try {
      await fetch(`/api/grupos/${grupo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          descricao: form.descricao || undefined,
          cor: form.cor,
        }),
      });
      setSaveOk(true);
      onSaved();
      setTimeout(() => setSaveOk(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este grupo? Esta ação removerá todos os membros.")) return;
    await fetch(`/api/grupos/${grupo.id}`, { method: "DELETE" });
    onDeleted();
  }

  async function handleAddMember(userId: string) {
    setAddingId(userId);
    try {
      await fetch(`/api/grupos/${grupo.id}/membros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const user = allUsers.find((u) => u.id === userId);
      if (user) {
        setMembros((prev) => [...prev, { id: user.id, name: user.name, photoUrl: user.photoUrl }]);
      }
      setSearchTerm("");
      onSaved();
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingId(userId);
    try {
      await fetch(`/api/grupos/${grupo.id}/membros/${userId}`, { method: "DELETE" });
      setMembros((prev) => prev.filter((m) => m.id !== userId));
      onSaved();
    } finally {
      setRemovingId(null);
    }
  }

  const memberIds = new Set(membros.map((m) => m.id));
  const nonMembers = allUsers.filter(
    (u) =>
      !memberIds.has(u.id) &&
      (searchTerm === "" ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header com voltar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500">Grupos</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate">{grupo.nome}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Coluna esquerda: formulário de edição */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Color bar animada */}
            <div className="h-2 w-full transition-colors duration-300" style={{ backgroundColor: form.cor }} />
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <h3 className="font-semibold text-slate-900">Informações do Grupo</h3>

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
                  placeholder="Descrição opcional..."
                  rows={3}
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

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                {saveOk && (
                  <span className="text-xs text-emerald-600 font-medium">Salvo!</span>
                )}
              </div>
            </form>
          </div>

          {/* Zona de perigo */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
            <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Zona de Perigo</h4>
            <p className="text-xs text-slate-500 mb-3">
              Excluir o grupo remove todos os membros permanentemente.
            </p>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-[#ff695f] text-sm border border-red-200 rounded-xl hover:bg-red-50 transition font-medium"
            >
              Excluir Grupo
            </button>
          </div>
        </div>

        {/* Coluna direita: membros */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Membros</h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                {membros.length}
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Lista de membros atuais */}
              {membros.length > 0 ? (
                <div className="space-y-1">
                  {membros.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <MemberAvatar member={m} size="sm" />
                        <span className="text-sm text-slate-700 font-medium">{m.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={removingId === m.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-[#ff695f] disabled:opacity-50 p-1 rounded-lg hover:bg-red-50"
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
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum membro ainda</p>
              )}

              {/* Adicionar membro */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Adicionar membro
                </p>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
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
                      <div className="max-h-52 overflow-y-auto space-y-0.5 rounded-xl border border-slate-100">
                        {nonMembers.slice(0, 10).map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAddMember(u.id)}
                            disabled={addingId === u.id}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#03a4ed]/10 flex items-center justify-center flex-shrink-0">
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
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Formulário de criação ──────────────────────────────────────────── */
function GrupoCreateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ nome: "", descricao: "", cor: "#03a4ed" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          descricao: form.descricao || undefined,
          cor: form.cor,
        }),
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="h-2 w-full transition-colors duration-300" style={{ backgroundColor: form.cor }} />
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">Novo Grupo</h3>

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
            placeholder="Descrição opcional..."
            rows={2}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 font-medium">Cor</label>
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

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar Grupo"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Container principal ────────────────────────────────────────────── */
export function GruposUsuarios() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "detail" | "create">("list");
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);

  async function fetchGrupos() {
    try {
      const res = await fetch("/api/grupos");
      const json = await res.json();
      const data: Grupo[] = json.data || [];
      setGrupos(data);
      // Atualiza o grupo selecionado se estiver no detalhe
      if (selectedGrupo) {
        const updated = data.find((g) => g.id === selectedGrupo.id);
        if (updated) setSelectedGrupo(updated);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(grupo: Grupo) {
    setSelectedGrupo(grupo);
    setView("detail");
  }

  function goBack() {
    setView("list");
    setSelectedGrupo(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este grupo? Esta ação removerá todos os membros do grupo.")) return;
    await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    await fetchGrupos();
  }

  /* ── Lista ── */
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Grupos de Usuários</h2>
          <button
            onClick={() => setView("create")}
            className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
          >
            + Novo Grupo
          </button>
        </div>

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
              onClick={() => setView("create")}
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Criar ── */
  if (view === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500">Grupos</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-900">Novo Grupo</span>
        </div>
        <div className="max-w-lg">
          <GrupoCreateForm
            onCancel={() => setView("list")}
            onCreated={async () => {
              await fetchGrupos();
              setView("list");
            }}
          />
        </div>
      </div>
    );
  }

  /* ── Detalhe ── */
  if (view === "detail" && selectedGrupo) {
    return (
      <GrupoDetalhe
        grupo={selectedGrupo}
        onBack={goBack}
        onSaved={fetchGrupos}
        onDeleted={() => {
          fetchGrupos();
          goBack();
        }}
      />
    );
  }

  return null;
}
