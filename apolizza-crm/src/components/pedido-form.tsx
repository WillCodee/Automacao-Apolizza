"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRODUTO_OPTIONS, MES_OPTIONS, ANO_OPTIONS, PRIORITY_OPTIONS } from "@/lib/constants";

type User = { id: string; name: string; email: string };

export function PedidoForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [form, setForm] = useState({
    nomeCliente: "",
    contatoCliente: "",
    prioridade: "normal",
    indicacao: "",
    produto: "",
    mes: "",
    ano: String(new Date().getFullYear()),
    responsavelId: "",
    descricao: "",
    situacao: "COTAR",
  });

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.data || []));
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const { nomeCliente, contatoCliente, prioridade, produto, mes, ano, responsavelId, descricao } = form;
    if (!nomeCliente || !contatoCliente || !prioridade || !produto || !mes || !ano || !responsavelId || !descricao) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      files.forEach((f) => formData.append("anexos", f));

      const res = await fetch("/api/pedidos", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar pedido.");
        return;
      }

      setSuccess("Pedido criado e tarefa gerada com sucesso! Notificação enviada.");
      setTimeout(() => router.push("/tarefas"), 2000);
    } catch {
      setError("Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  }

  const inputBase = "w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition text-slate-900 text-sm border-slate-200 bg-white";
  const labelClass = "block text-sm font-medium text-slate-600 mb-1";
  const req = <span className="text-red-500 ml-0.5">*</span>;

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
      className="space-y-6"
    >
      {/* Identificação do Cliente */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900 mb-3">Dados do Cliente</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome do Cliente {req}</label>
            <input
              type="text"
              value={form.nomeCliente}
              onChange={(e) => set("nomeCliente", e.target.value)}
              className={inputBase}
              placeholder="Ex: João Silva"
            />
          </div>
          <div>
            <label className={labelClass}>Contato do Cliente {req}</label>
            <input
              type="tel"
              value={form.contatoCliente}
              onChange={(e) => set("contatoCliente", e.target.value)}
              className={inputBase}
              placeholder="(XX) XXXXX-XXXX"
            />
          </div>
          <div>
            <label className={labelClass}>Indicação</label>
            <input
              type="text"
              value={form.indicacao}
              onChange={(e) => set("indicacao", e.target.value)}
              className={inputBase}
              placeholder="Quem indicou?"
            />
          </div>
          <div>
            <label className={labelClass}>Prioridade {req}</label>
            <select value={form.prioridade} onChange={(e) => set("prioridade", e.target.value)} className={inputBase}>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Seguro */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900 mb-3">Dados do Seguro</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Produto {req}</label>
            <select value={form.produto} onChange={(e) => set("produto", e.target.value)} className={inputBase}>
              <option value="">Selecione...</option>
              {PRODUTO_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Mês {req}</label>
            <select value={form.mes} onChange={(e) => set("mes", e.target.value)} className={inputBase}>
              <option value="">Selecione...</option>
              {MES_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ano {req}</label>
            <select value={form.ano} onChange={(e) => set("ano", e.target.value)} className={inputBase}>
              {ANO_OPTIONS.map((a) => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Tarefa */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900 mb-3">Tarefa</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Responsável pela Tarefa {req}</label>
            <select value={form.responsavelId} onChange={(e) => set("responsavelId", e.target.value)} className={inputBase}>
              <option value="">Selecione o responsável...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Situação</label>
            <input
              type="text"
              value={form.situacao}
              readOnly
              className={`${inputBase} bg-slate-50 cursor-not-allowed`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Descrição da Tarefa {req}</label>
          <textarea
            rows={4}
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            className={inputBase}
            placeholder="Descreva o que deve ser feito..."
          />
        </div>
      </fieldset>

      {/* Anexos */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-slate-900 mb-3">Anexos</legend>
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-[#03a4ed] transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFiles} />
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="text-sm text-slate-500">Clique para adicionar arquivos ou arraste aqui</p>
            <p className="text-xs text-slate-400">PDF, PNG, JPG, DOCX, XLSX até 10MB</p>
          </div>
        </div>
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-xs text-slate-700 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-600 text-sm px-4 py-3 rounded-xl border border-emerald-100">{success}</div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 text-white rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] focus:ring-2 focus:ring-[#03a4ed] focus:ring-offset-2 transition-all shadow-sm disabled:opacity-50"
        >
          {loading ? "Criando pedido..." : "Criar Pedido"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
