"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type CurrentUser = {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
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

type ConversasTodos = {
  lastTexto: string | null;
  lastCreatedAt: string | null;
  lastFromUserName: string | null;
  naoLidas: number;
};

type Mensagem = {
  id: string;
  texto: string;
  createdAt: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserPhoto: string | null;
  lida: boolean;
};

type UserOption = {
  id: string;
  name: string;
  photoUrl: string | null;
};

function Avatar({ name, photo, size = "md" }: { name: string | null; photo: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  if (photo) {
    return <img src={photo} alt={name || ""} className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`${dim} rounded-full bg-[#03a4ed] text-white font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function fmtTime(v: string | null) {
  if (!v) return "";
  return new Date(v).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

export function ChatGlobal() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"lista" | "thread" | "nova">("lista");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [todosData, setTodosData] = useState<ConversasTodos | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<{ id: "todos" | string; nome: string; photo: string | null } | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user info + unread count
  const fetchNaoLidas = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/nao-lidas");
      if (!r.ok) return;
      const d = await r.json();
      if (d.data) {
        setNaoLidas(d.data.count);
        if (!currentUser) setCurrentUser(d.data.user);
      }
    } catch {/* ignore */}
  }, [currentUser]);

  useEffect(() => {
    fetchNaoLidas();
    const interval = setInterval(fetchNaoLidas, 30000);
    return () => clearInterval(interval);
  }, [fetchNaoLidas]);

  // Load conversations list when panel opens
  const fetchConversas = useCallback(async () => {
    try {
      const r = await fetch("/api/chat");
      const d = await r.json();
      if (d.data) {
        setTodosData(d.data.todos);
        setConversas(d.data.diretas || []);
      }
    } catch {/* ignore */}
  }, []);

  useEffect(() => {
    if (open && view === "lista") {
      fetchConversas();
    }
  }, [open, view, fetchConversas]);

  // Load messages for active thread
  const fetchMensagens = useCallback(async (conversaId: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/chat/${conversaId}`);
      const d = await r.json();
      if (d.data) {
        setMensagens(d.data);
        setNaoLidas((prev) => Math.max(0, prev - 1)); // optimistic
      }
    } catch {/* ignore */}
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (conversaAtiva) {
      fetchMensagens(conversaAtiva.id);
    }
  }, [conversaAtiva, fetchMensagens]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Poll for new messages when thread is open
  useEffect(() => {
    if (!conversaAtiva) return;
    const interval = setInterval(() => fetchMensagens(conversaAtiva.id), 15000);
    return () => clearInterval(interval);
  }, [conversaAtiva, fetchMensagens]);

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
      const d = await r.json();
      if (d.data) {
        setTexto("");
        await fetchMensagens(conversaAtiva.id);
        fetchConversas();
      }
    } finally {
      setEnviando(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
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

  // Load users for new conversation
  useEffect(() => {
    if (view === "nova" && users.length === 0) {
      fetch("/api/users?limit=100")
        .then((r) => r.json())
        .then((d) => {
          const list = (d.data || []) as UserOption[];
          setUsers(list.filter((u) => u.id !== currentUser?.id));
        })
        .catch(() => {});
    }
  }, [view, users.length, currentUser?.id]);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (!currentUser) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setOpen(true); setView("lista"); }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#03a4ed] text-white shadow-lg hover:bg-[#0288d1] transition-all hover:scale-105 flex items-center justify-center"
        title="Chat"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#ff695f] text-white text-[11px] font-bold flex items-center justify-center">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => { setOpen(false); setView("lista"); setConversaAtiva(null); }}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] max-w-full z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ─── HEADER ─── */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-gradient-to-r from-[#03a4ed] to-[#0288d1]">
          {view === "thread" && (
            <button onClick={backToList} className="text-white/80 hover:text-white transition-colors mr-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {view === "nova" && (
            <button onClick={() => { setView("lista"); setUserSearch(""); }} className="text-white/80 hover:text-white transition-colors mr-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {view === "thread" && conversaAtiva ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {conversaAtiva.id === "todos" ? (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              ) : (
                <Avatar name={conversaAtiva.nome} photo={conversaAtiva.photo} />
              )}
              <span className="font-semibold text-white truncate">{conversaAtiva.nome}</span>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="font-bold text-white text-base">
                {view === "nova" ? "Nova Mensagem" : "Chat"}
              </h2>
              {view === "lista" && naoLidas > 0 && (
                <p className="text-white/70 text-xs">{naoLidas} nao lida{naoLidas > 1 ? "s" : ""}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {view === "lista" && (
              <button
                onClick={() => { setView("nova"); setUserSearch(""); }}
                title="Nova mensagem direta"
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setView("lista"); setConversaAtiva(null); }}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── LISTA DE CONVERSAS ─── */}
        {view === "lista" && (
          <div className="flex-1 overflow-y-auto">
            {/* Canal Todos */}
            <button
              onClick={() => openThread("todos", "Todos", null)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[#03a4ed]/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#03a4ed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 text-sm">Todos</span>
                  {todosData?.lastCreatedAt && (
                    <span className="text-[11px] text-slate-400 shrink-0">{fmtTime(todosData.lastCreatedAt)}</span>
                  )}
                </div>
                {todosData?.lastTexto && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {todosData.lastFromUserName}: {todosData.lastTexto}
                  </p>
                )}
                {!todosData?.lastTexto && (
                  <p className="text-xs text-slate-400 mt-0.5">Canal para todos os usuarios</p>
                )}
              </div>
              {(todosData?.naoLidas ?? 0) > 0 && (
                <span className="shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-[#03a4ed] text-white text-[11px] font-bold flex items-center justify-center">
                  {todosData!.naoLidas}
                </span>
              )}
            </button>

            {/* DMs */}
            {conversas.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-slate-400">Nenhuma conversa direta ainda.</p>
                <button
                  onClick={() => { setView("nova"); setUserSearch(""); }}
                  className="mt-2 text-xs text-[#03a4ed] hover:underline"
                >
                  Iniciar conversa
                </button>
              </div>
            )}

            {conversas.map((c) => (
              <button
                key={c.otherUserId}
                onClick={() => openThread(c.otherUserId, c.otherUserName, c.otherUserPhoto)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50 text-left"
              >
                <Avatar name={c.otherUserName} photo={c.otherUserPhoto} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 text-sm truncate">{c.otherUserName}</span>
                    {c.lastCreatedAt && (
                      <span className="text-[11px] text-slate-400 shrink-0">{fmtTime(c.lastCreatedAt)}</span>
                    )}
                  </div>
                  {c.lastTexto && (
                    <p className={`text-xs truncate mt-0.5 ${c.naoLidas > 0 ? "font-medium text-slate-800" : "text-slate-500"}`}>
                      {c.lastFromUserId === currentUser.id ? "Voce: " : ""}{c.lastTexto}
                    </p>
                  )}
                </div>
                {c.naoLidas > 0 && (
                  <span className="shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-[#03a4ed] text-white text-[11px] font-bold flex items-center justify-center">
                    {c.naoLidas}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ─── NOVA MENSAGEM (user picker) ─── */}
        {view === "nova" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-slate-100 shrink-0">
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#03a4ed] bg-slate-50 placeholder:text-slate-400"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              <button
                onClick={() => openThread("todos", "Todos", null)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
              >
                <div className="w-9 h-9 rounded-full bg-[#03a4ed]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#03a4ed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Todos</p>
                  <p className="text-xs text-slate-400">Mensagem para todos os usuarios</p>
                </div>
              </button>

              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openThread(u.id, u.name, u.photoUrl)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
                >
                  <Avatar name={u.name} photo={u.photoUrl} size="sm" />
                  <span className="text-sm font-medium text-slate-900">{u.name}</span>
                </button>
              ))}

              {filteredUsers.length === 0 && userSearch && (
                <p className="text-xs text-slate-400 text-center py-8">Nenhum usuario encontrado.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── THREAD ─── */}
        {view === "thread" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : mensagens.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhuma mensagem ainda. Diga ola!</p>
              ) : (
                mensagens.map((m) => {
                  const isMine = m.fromUserId === currentUser.id;
                  return (
                    <div key={m.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                      <Avatar name={m.fromUserName} photo={m.fromUserPhoto} size="sm" />
                      <div className={`max-w-[75%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                        {!isMine && conversaAtiva?.id === "todos" && (
                          <span className="text-[10px] text-slate-400 mb-1">{m.fromUserName}</span>
                        )}
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isMine
                              ? "bg-[#03a4ed] text-white rounded-tr-sm"
                              : "bg-slate-100 text-slate-800 rounded-tl-sm"
                          }`}
                        >
                          {m.texto}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">{fmtTime(m.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-100">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem... (Enter para enviar)"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-slate-50 placeholder:text-slate-400"
                  />
                </div>
                <button
                  onClick={enviar}
                  disabled={enviando || !texto.trim()}
                  className="shrink-0 w-9 h-9 rounded-xl bg-[#03a4ed] text-white flex items-center justify-center hover:bg-[#0288d1] transition disabled:opacity-40 disabled:cursor-not-allowed"
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
