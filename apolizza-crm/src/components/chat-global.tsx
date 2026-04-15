"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type CurrentUser = { id: string; name: string; role: string; photoUrl: string | null };

type SuporteData = {
  userId: string;
  lastTexto: string | null;
  lastCreatedAt: string | null;
  lastFromUserId: string | null;
  naoLidas: number;
};

type ConversaTodos = {
  lastTexto: string | null;
  lastCreatedAt: string | null;
  lastFromUserName: string | null;
  naoLidas: number;
};

type Conversa = {
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto: string | null;
  lastTexto: string | null;
  lastCreatedAt: string | null;
  lastFromUserId: string;
  naoLidas: number;
};

type Mensagem = {
  id: string;
  texto: string;
  createdAt: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserPhoto: string | null;
};

type UserOption = { id: string; name: string; photoUrl: string | null };

type ConversaAtiva = { id: "todos" | string; nome: string; photo: string | null };

function Avatar({ name, photo, size = "md" }: { name: string | null; photo: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-sm";
  if (photo) return <img src={photo} alt={name || ""} className={`${dim} rounded-full object-cover shrink-0`} />;
  const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`${dim} rounded-full bg-[var(--primary)] text-white font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function fmtTime(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtFull(v: string) {
  return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ChatGlobal() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"lista" | "thread" | "nova">("lista");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [todosData, setTodosData] = useState<ConversaTodos | null>(null);
  const [suporteData, setSuporteData] = useState<SuporteData | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<ConversaAtiva | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Unread count + current user (polled) ────────────────────────
  const fetchNaoLidas = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/nao-lidas");
      if (!r.ok) return;
      const d = await r.json();
      if (d.data) {
        setNaoLidas(d.data.count);
        setCurrentUser((prev) => prev ?? d.data.user);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNaoLidas();
    const t = setInterval(fetchNaoLidas, 30_000);
    return () => clearInterval(t);
  }, [fetchNaoLidas]);

  // ── Conversation list ────────────────────────────────────────────
  const fetchConversas = useCallback(async () => {
    try {
      const r = await fetch("/api/chat");
      const d = await r.json();
      if (d.data) {
        setTodosData(d.data.todos);
        setSuporteData(d.data.suporte ?? null);
        setConversas(d.data.diretas || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (open && view === "lista") fetchConversas();
  }, [open, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Messages ─────────────────────────────────────────────────────
  const fetchMensagens = useCallback(async (id: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/chat/${id}`);
      const d = await r.json();
      if (d.data) {
        setMensagens(d.data);
        setNaoLidas((p) => Math.max(0, p - 1));
      }
    } catch { /* silent */ }
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (conversaAtiva) fetchMensagens(conversaAtiva.id);
  }, [conversaAtiva]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Poll new messages while thread is open
  useEffect(() => {
    if (!conversaAtiva) return;
    const t = setInterval(() => fetchMensagens(conversaAtiva.id), 15_000);
    return () => clearInterval(t);
  }, [conversaAtiva]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send ─────────────────────────────────────────────────────────
  async function enviar() {
    if (!texto.trim() || !conversaAtiva || enviando) return;
    setEnviando(true);
    try {
      const toUserId = conversaAtiva.id === "todos" ? null : conversaAtiva.id;
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim(), toUserId }),
      });
      if (r.ok) {
        setTexto("");
        await fetchMensagens(conversaAtiva.id);
        await fetchConversas();
        fetchNaoLidas();
      }
    } finally {
      setEnviando(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  }

  function openThread(id: "todos" | string, nome: string, photo: string | null) {
    setConversaAtiva({ id, nome, photo });
    setView("thread");
    setMensagens([]);
  }

  function backToList() {
    setConversaAtiva(null);
    setView("lista");
    setTexto("");
    fetchConversas();
    fetchNaoLidas();
  }

  function openPanel() {
    setOpen(true);
    setView("lista");
    setConversaAtiva(null);
  }

  function closePanel() {
    setOpen(false);
    setView("lista");
    setConversaAtiva(null);
  }

  // Load users for "Nova Mensagem"
  useEffect(() => {
    if (view !== "nova" || users.length > 0) return;
    fetch("/api/users?limit=200")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.data || []) as UserOption[];
        setUsers(list.filter((u) => u.id !== currentUser?.id && u.name !== "Suporte"));
      })
      .catch(() => {});
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (!currentUser) return null;

  // ── UI helpers ───────────────────────────────────────────────────
  const totalBadge = naoLidas > 99 ? "99+" : String(naoLidas);

  return (
    <>
      {/* ── Floating Button ─────────────────────────────────────────── */}
      <button
        onClick={openPanel}
        title="Chat"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-105 transition-all"
        style={{ background: "var(--primary)" }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center" style={{ background: "var(--accent)" }}>
            {totalBadge}
          </span>
        )}
      </button>

      {/* ── Backdrop ────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={closePanel} />
      )}

      {/* ── Panel ───────────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] max-w-full z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="px-4 py-3.5 flex items-center gap-3 shrink-0"
          style={{ background: `linear-gradient(135deg, var(--header-from), var(--header-to))` }}
        >
          {(view === "thread" || view === "nova") && (
            <button
              onClick={view === "nova" ? () => { setView("lista"); setUserSearch(""); } : backToList}
              className="text-white/70 hover:text-white transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {view === "thread" && conversaAtiva ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {conversaAtiva.id === "todos" ? (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              ) : suporteData && conversaAtiva.id === suporteData.userId ? (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 text-base">🤖</div>
              ) : (
                <Avatar name={conversaAtiva.nome} photo={conversaAtiva.photo} />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{conversaAtiva.nome}</p>
                {suporteData && conversaAtiva.id === suporteData.userId && (
                  <p className="text-white/60 text-[10px]">Agente virtual</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="font-bold text-white text-base leading-none">
                {view === "nova" ? "Nova mensagem" : "Chat"}
              </h2>
              {view === "lista" && naoLidas > 0 && (
                <p className="text-white/60 text-xs mt-0.5">{naoLidas} não lida{naoLidas !== 1 ? "s" : ""}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {view === "lista" && (
              <button
                onClick={() => { setView("nova"); setUserSearch(""); }}
                title="Nova mensagem"
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={closePanel}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── LISTA ─────────────────────────────────────────────────── */}
        {view === "lista" && (
          <div className="flex-1 overflow-y-auto" style={{ color: "var(--foreground)" }}>
            {/* Canal Todos */}
            <ConversaItem
              icon={
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)" }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--primary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              }
              nome="Todos"
              sub={todosData?.lastTexto ? `${todosData.lastFromUserName}: ${todosData.lastTexto}` : "Canal geral da equipe"}
              time={todosData?.lastCreatedAt ?? null}
              naoLidas={todosData?.naoLidas ?? 0}
              onClick={() => openThread("todos", "Todos", null)}
            />

            {/* Canal Suporte */}
            {suporteData && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-subtle)" }}>Suporte</span>
                </div>
                <ConversaItem
                  icon={
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
                      🤖
                    </div>
                  }
                  nome="Suporte"
                  sub={
                    suporteData.lastTexto
                      ? `${suporteData.lastFromUserId === currentUser.id ? "Você: " : ""}${suporteData.lastTexto}`
                      : "Agente virtual — dúvidas sobre o sistema"
                  }
                  time={suporteData.lastCreatedAt}
                  naoLidas={suporteData.naoLidas}
                  onClick={() => openThread(suporteData.userId, "Suporte", null)}
                />
              </>
            )}

            {/* DMs */}
            {conversas.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-subtle)" }}>Mensagens diretas</span>
              </div>
            )}
            {conversas.map((c) => (
              <ConversaItem
                key={c.otherUserId}
                icon={<Avatar name={c.otherUserName} photo={c.otherUserPhoto} />}
                nome={c.otherUserName}
                sub={c.lastTexto ? `${c.lastFromUserId === currentUser.id ? "Você: " : ""}${c.lastTexto}` : ""}
                time={c.lastCreatedAt}
                naoLidas={c.naoLidas}
                onClick={() => openThread(c.otherUserId, c.otherUserName, c.otherUserPhoto)}
              />
            ))}

            {conversas.length === 0 && !suporteData && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-subtle)" }}>Nenhuma conversa ainda.</p>
                <button
                  onClick={() => { setView("nova"); setUserSearch(""); }}
                  className="mt-2 text-sm font-medium hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  Iniciar conversa
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── NOVA MENSAGEM ─────────────────────────────────────────── */}
        {view === "nova" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-xl outline-none transition"
                style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--foreground)" }}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openThread(u.id, u.name, u.photoUrl)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-80"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <Avatar name={u.name} photo={u.photoUrl} size="sm" />
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{u.name}</span>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-subtle)" }}>Nenhum usuário encontrado.</p>
              )}
            </div>
          </div>
        )}

        {/* ── THREAD ───────────────────────────────────────────────── */}
        {view === "thread" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: "var(--surface-2)" }}>
              {loadingMsgs ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                </div>
              ) : mensagens.length === 0 ? (
                <p className="text-xs text-center py-10" style={{ color: "var(--text-subtle)" }}>Nenhuma mensagem ainda.</p>
              ) : (
                mensagens.map((m) => {
                  const isMine = m.fromUserId === currentUser.id;
                  return (
                    <div key={m.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMine && <Avatar name={m.fromUserName} photo={m.fromUserPhoto} size="sm" />}
                      <div className={`max-w-[76%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                        {!isMine && conversaAtiva?.id === "todos" && (
                          <span className="text-[10px] mb-0.5 px-1" style={{ color: "var(--text-muted)" }}>{m.fromUserName}</span>
                        )}
                        <div
                          className="px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm"
                          style={isMine
                            ? { background: "var(--primary)", color: "#fff", borderTopRightRadius: 4 }
                            : { background: "var(--surface)", color: "var(--foreground)", borderTopLeftRadius: 4, border: "1px solid var(--border)" }
                          }
                        >
                          {m.texto}
                        </div>
                        <span className="text-[10px] mt-1 px-1" style={{ color: "var(--text-subtle)" }}>{fmtFull(m.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            {/* Compose */}
            <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem... (Enter para enviar)"
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-xl resize-none outline-none transition"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--foreground)" }}
                  />
                </div>
                <button
                  onClick={enviar}
                  disabled={enviando || !texto.trim()}
                  className="shrink-0 w-9 h-9 rounded-xl text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "var(--primary)" }}
                >
                  {enviando ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Shared conversation row component ─────────────────────────────
function ConversaItem({
  icon, nome, sub, time, naoLidas, onClick,
}: {
  icon: React.ReactNode;
  nome: string;
  sub: string;
  time: string | null;
  naoLidas: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity hover:opacity-75"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>{nome}</span>
          {time && <span className="text-[10px] shrink-0" style={{ color: "var(--text-subtle)" }}>{fmtTime(time)}</span>}
        </div>
        {sub && (
          <p
            className={`text-xs truncate mt-0.5 ${naoLidas > 0 ? "font-semibold" : ""}`}
            style={{ color: naoLidas > 0 ? "var(--foreground)" : "var(--text-muted)" }}
          >
            {sub}
          </p>
        )}
      </div>
      {naoLidas > 0 && (
        <span
          className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
          style={{ background: "var(--primary)" }}
        >
          {naoLidas}
        </span>
      )}
    </button>
  );
}
