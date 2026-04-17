"use client";

import { useState, useEffect, useRef } from "react";

type HistoryEntry = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  userName: string | null;
};

type Mensagem = {
  id: string;
  texto: string;
  imageUrl: string | null;
  createdAt: string;
  userId: string;
  userName: string | null;
  userPhoto: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  criacao: "Criação",
  name: "Nome",
  status: "Status",
  priority: "Prioridade",
  dueDate: "Data de Entrega",
  assigneeId: "Responsavel",
  tipoCliente: "Tipo Cliente",
  contatoCliente: "Contato",
  seguradora: "Seguradora",
  produto: "Produto",
  situacao: "Situacao",
  indicacao: "Indicacao",
  inicioVigencia: "Inicio Vigencia",
  fimVigencia: "Fim Vigencia",
  primeiroPagamento: "1o Pagamento",
  parceladoEm: "Parcela do Cliente",
  valorParcelado: "Valor Parcelado (R$/mes)",
  premioSemIof: "Premio sem IOF",
  comissao: "Comissao",
  aReceber: "A Receber",
  valorPerda: "Valor Perda",
  proximaTratativa: "Próxima Tratativa",
  observacao: "Observacao",
  mesReferencia: "Mes Ref",
  anoReferencia: "Ano Ref",
  tags: "Tags",
  isRenovacao: "Renovacao",
};

function Avatar({ name, photo }: { name: string | null; photo: string | null }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name || ""}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[#03a4ed] text-white text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AtividadePanel({
  cotacaoId,
  currentUserId,
  currentUserName,
  currentUserPhoto,
}: {
  cotacaoId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserPhoto?: string | null;
}) {
  const [tab, setTab] = useState<"historico" | "mensagens">("historico");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [mensagensLoaded, setMensagensLoaded] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [imagemSelecionada, setImagemSelecionada] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemExpandida, setImagemExpandida] = useState<string | null>(null);
  const mensagensEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadHistory() {
    setHistoryLoading(true);
    fetch(`/api/cotacoes/${cotacaoId}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.data || []))
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    if (tab === "historico") {
      loadHistory();
    }
    if (tab === "mensagens" && !mensagensLoaded) {
      fetch(`/api/cotacoes/${cotacaoId}/mensagens`)
        .then((r) => r.json())
        .then((d) => {
          setMensagens(d.data || []);
          setMensagensLoaded(true);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cotacaoId]);

  useEffect(() => {
    function onRefresh() {
      loadHistory();
      if (tab !== "historico") setTab("historico");
    }
    window.addEventListener("apolizza:history-refresh", onRefresh);
    return () => window.removeEventListener("apolizza:history-refresh", onRefresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "mensagens") {
      mensagensEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagens, tab]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagemSelecionada(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagemPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removerImagem() {
    setImagemSelecionada(null);
    setImagemPreview(null);
  }

  async function enviarMensagem() {
    if (!texto.trim() && !imagemSelecionada) return;
    setEnviando(true);
    try {
      let res: Response;
      if (imagemSelecionada) {
        const fd = new FormData();
        fd.append("texto", texto.trim());
        fd.append("image", imagemSelecionada);
        res = await fetch(`/api/cotacoes/${cotacaoId}/mensagens`, { method: "POST", body: fd });
      } else {
        res = await fetch(`/api/cotacoes/${cotacaoId}/mensagens`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: texto.trim() }),
        });
      }
      const data = await res.json();
      if (data.data) {
        setMensagens((prev) => [...prev, data.data]);
        setTexto("");
        removerImagem();
      }
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  }

  return (
    <>
      {/* Lightbox */}
      {imagemExpandida && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagemExpandida(null)}
        >
          <img
            src={imagemExpandida}
            alt="Imagem ampliada"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setImagemExpandida(null)}
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[500px]">
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
            Atividade
          </h3>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-100">
            <button
              onClick={() => setTab("historico")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === "historico"
                  ? "text-[#03a4ed] border-b-2 border-[#03a4ed] -mb-px"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setTab("mensagens")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === "mensagens"
                  ? "text-[#03a4ed] border-b-2 border-[#03a4ed] -mb-px"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mensagens
              {mensagens.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#03a4ed] text-white text-[10px] font-bold">
                  {mensagens.length > 9 ? "9+" : mensagens.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === "historico" && (
            <div className="flex-1 overflow-y-auto">
              {/* Botão recarregar */}
              <div className="flex justify-end px-4 pt-2 pb-1">
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="text-[11px] text-slate-400 hover:text-[#03a4ed] transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <svg className={`w-3 h-3 ${historyLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar
                </button>
              </div>

              {historyLoading ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">Carregando...</p>
              ) : history.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">
                  Nenhuma alteração registrada.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50 px-1">
                  {history.map((h) => (
                    <li key={h.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${h.fieldName === "criacao" ? "bg-emerald-500" : "bg-[#03a4ed]"}`} />
                        <div className="flex-1 min-w-0">
                          {h.fieldName === "criacao" ? (
                            <>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                <span className="font-semibold text-slate-900">{h.userName || "Sistema"}</span>
                                {" "}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
                                  ✦ Cotação criada
                                </span>
                              </p>
                              {h.newValue && (
                                <p className="text-xs text-slate-500 mt-0.5">{h.newValue}</p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                <span className="font-semibold text-slate-900">
                                  {h.userName || "Sistema"}
                                </span>{" "}
                                alterou{" "}
                                <span className="font-medium text-slate-700">
                                  {FIELD_LABELS[h.fieldName] || h.fieldName}
                                </span>
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                <span className="text-[#ff695f] line-through">{h.oldValue || "vazio"}</span>
                                {" → "}
                                <span className="text-emerald-600 font-medium">{h.newValue || "vazio"}</span>
                              </p>
                            </>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            {fmtDateTime(h.changedAt)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "mensagens" && (
            <>
              {/* Messages list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {!mensagensLoaded ? (
                  <p className="text-sm text-slate-400 text-center py-6">Carregando...</p>
                ) : mensagens.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Nenhuma mensagem ainda. Seja o primeiro!
                  </p>
                ) : (
                  mensagens.map((m) => {
                    const isMine = m.userId === currentUserId;
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <Avatar name={m.userName} photo={m.userPhoto} />
                        <div className={`max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                          <span className={`text-[11px] text-slate-400 mb-1 ${isMine ? "text-right" : "text-left"}`}>
                            {isMine ? "Voce" : (m.userName || "Usuario")}
                          </span>
                          <div
                            className={`rounded-2xl text-sm leading-relaxed ${
                              isMine
                                ? "bg-[#03a4ed] text-white rounded-tr-sm"
                                : "bg-slate-100 text-slate-800 rounded-tl-sm"
                            } ${m.imageUrl ? "p-1.5" : "px-3 py-2"}`}
                          >
                            {m.imageUrl && (
                              <img
                                src={m.imageUrl}
                                alt="Imagem da mensagem"
                                className="rounded-xl max-w-[220px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setImagemExpandida(m.imageUrl!)}
                              />
                            )}
                            {m.texto && (
                              <p className={`whitespace-pre-wrap break-words ${m.imageUrl ? "px-2 pt-1.5 pb-1" : ""}`}>
                                {m.texto}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1">
                            {fmtDateTime(m.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={mensagensEndRef} />
              </div>

              {/* Compose */}
              <div className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-100">
                {/* Image preview */}
                {imagemPreview && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={imagemPreview}
                      alt="Preview"
                      className="h-20 rounded-xl object-cover border border-slate-200"
                    />
                    <button
                      onClick={removerImagem}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#ff695f] text-white text-xs flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <Avatar name={currentUserName} photo={currentUserPhoto ?? null} />
                  <div className="flex-1 relative">
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={imagemSelecionada ? "Legenda (opcional)..." : "Escreva uma mensagem... (Enter para enviar)"}
                      rows={2}
                      className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition bg-slate-50 placeholder:text-slate-400"
                    />
                    {/* Image attach button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Anexar imagem"
                      className="absolute right-2.5 bottom-2.5 text-slate-400 hover:text-[#03a4ed] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                  <button
                    onClick={enviarMensagem}
                    disabled={enviando || (!texto.trim() && !imagemSelecionada)}
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
      </div>
    </>
  );
}
