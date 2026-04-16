"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  TIPO_CLIENTE_OPTIONS,
  MES_OPTIONS,
  ANO_OPTIONS,
  PRODUTO_OPTIONS,
} from "@/lib/constants";
import { calcularDataEntrega, toDateInput, precisaMaisInfo } from "@/lib/prazo-utils";
import { validateStatusFields, type StatusRule } from "@/lib/status-validation";

type User = { id: string; name: string; role: string };

type ComissaoParcelada = {
  parcelas: number;
  percentuais: number[];
};

type CotacaoData = {
  name: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
  tipoCliente: string;
  contatoCliente: string;
  seguradora: string;
  produto: string;
  situacao: string;
  indicacao: string;
  inicioVigencia: string;
  fimVigencia: string;
  primeiroPagamento: string;
  proximaTratativa: string;
  parceladoEm: string;
  valorParcelado: string;
  premioSemIof: string;
  comissao: string;
  aReceber: string;
  valorPerda: string;
  observacao: string;
  mesReferencia: string;
  anoReferencia: string;
  isRenovacao: boolean;
  comissaoParcelada: ComissaoParcelada | null;
};

const SAUDE_PRODUTOS = ["SAÚDE PF", "SAÚDE PJ"] as const;
function isSaudeProduto(produto: string) {
  return SAUDE_PRODUTOS.includes(produto as (typeof SAUDE_PRODUTOS)[number]);
}

const EMPTY: CotacaoData = {
  name: "",
  status: "não iniciado",
  priority: "normal",
  dueDate: "",
  assigneeId: "",
  tipoCliente: "",
  contatoCliente: "",
  seguradora: "",
  produto: "",
  situacao: "",
  indicacao: "",
  inicioVigencia: "",
  fimVigencia: "",
  primeiroPagamento: "",
  proximaTratativa: "",
  parceladoEm: "",
  valorParcelado: "",
  premioSemIof: "",
  comissao: "",
  aReceber: "",
  valorPerda: "",
  observacao: "",
  mesReferencia: "",
  anoReferencia: "",
  isRenovacao: false,
  comissaoParcelada: null,
};

interface CotacaoFormProps {
  initialData?: Partial<CotacaoData>;
  cotacaoId?: string;
  currentUser: { id: string; role: "admin" | "cotador" | "proprietario" };
}

export function CotacaoForm({ initialData, cotacaoId, currentUser }: CotacaoFormProps) {
  const router = useRouter();
  const isEdit = !!cotacaoId;
  const [form, setForm] = useState<CotacaoData>({ ...EMPTY, ...initialData });
  const [users, setUsers] = useState<User[]>([]);
  const [statusRules, setStatusRules] = useState<StatusRule[]>([]);
  const [situacoes, setSituacoes] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [comissaoPercentual, setComissaoPercentual] = useState(initialData?.comissao ?? "");
  const [aReceberManual, setAReceberManual] = useState(false);
  const [valorParceladoManual, setValorParceladoManual] = useState(false);
  const [showMaisInfo, setShowMaisInfo] = useState(false);
  const [quantidadeVeiculos, setQuantidadeVeiculos] = useState("");
  const [quantidadeVidas, setQuantidadeVidas] = useState("");
  // Impede recálculo automático da data de entrega ao carregar form em modo edição
  const skipDueDateCalc = useRef(isEdit);

  useEffect(() => {
    fetch("/api/status-config")
      .then((r) => r.json())
      .then((d) => setStatusRules(d.data || []));

    fetch("/api/situacao-config")
      .then((r) => r.json())
      .then((d) => setSituacoes((d.data || []).filter((s: { isActive: boolean }) => s.isActive).map((s: { nome: string }) => s.nome)));

    if (currentUser.role === "admin") {
      fetch("/api/users")
        .then((r) => r.json())
        .then((d) => setUsers(d.data || []));
    }
  }, [currentUser.role]);

  function set(field: keyof CotacaoData, value: string | boolean | ComissaoParcelada | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Story 11.6 AC8: Auto-suggest commission % when seguradora is selected
  useEffect(() => {
    if (!form.seguradora) return;
    fetch(`/api/comissao-tabela?seguradora=${encodeURIComponent(form.seguradora)}${form.produto ? `&produto=${encodeURIComponent(form.produto)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        const rows = d.data || [];
        if (rows.length > 0) {
          // Pick most specific match (with produto) or first
          const match = rows.find((r: { produto: string | null }) => r.produto === form.produto) || rows[0];
          if (match?.percentual) {
            setComissaoPercentual(String(match.percentual));
          }
        }
      })
      .catch(() => {});
  }, [form.seguradora, form.produto]);

  // Auto-cálculo da Data de Entrega com base em Produto + Tipo Cliente + Situação + infos extras
  // Em modo edição, NÃO recalcula ao carregar (apenas quando usuário altera os campos)
  useEffect(() => {
    if (skipDueDateCalc.current) return;
    if (!form.produto || !form.tipoCliente) return;
    const qtdVeiculos = quantidadeVeiculos ? Number(quantidadeVeiculos) : null;
    const qtdVidas = quantidadeVidas ? Number(quantidadeVidas) : null;
    const dataEntrega = calcularDataEntrega(
      form.produto,
      form.tipoCliente,
      qtdVeiculos,
      qtdVidas,
      form.situacao || null,
      form.fimVigencia || null
    );
    setForm((prev) => ({ ...prev, dueDate: toDateInput(dataEntrega) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.produto, form.tipoCliente, form.situacao, form.fimVigencia, quantidadeVeiculos, quantidadeVidas]);

  // Auto-cálculo de Valor Parcelado = Premio sem IOF / Parcela do Cliente
  useEffect(() => {
    if (valorParceladoManual) return;
    const premio = parseFloat(form.premioSemIof);
    const parcelas = parseInt(form.parceladoEm, 10);
    if (!isNaN(premio) && !isNaN(parcelas) && parcelas > 0 && premio > 0) {
      setForm((prev) => ({ ...prev, valorParcelado: (premio / parcelas).toFixed(2) }));
    }
  }, [form.premioSemIof, form.parceladoEm]);

  // comissao salva a porcentagem (ex: "21"); aReceber = premioSemIof * (comissao% / 100)
  useEffect(() => {
    const pct = parseFloat(comissaoPercentual);
    if (!isNaN(pct) && pct > 0) {
      setForm((prev) => ({ ...prev, comissao: comissaoPercentual }));
    }
    const premio = parseFloat(form.premioSemIof);
    if (!isNaN(premio) && !isNaN(pct) && pct > 0 && premio > 0 && !aReceberManual) {
      setForm((prev) => ({ ...prev, aReceber: (premio * pct / 100).toFixed(2) }));
    }
  }, [form.premioSemIof, comissaoPercentual]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!form.name.trim()) {
      setError("Nome do cliente e obrigatorio.");
      setLoading(false);
      return;
    }

    // Validate required fields for target status
    setInvalidFields(new Set());
    const validation = validateStatusFields(form as unknown as Record<string, unknown>, form.status, statusRules);
    if (!validation.valid) {
      const fieldSet = new Set(validation.missingFields.map((f) => f.formField));
      setInvalidFields(fieldSet);
      const missing = validation.missingFields.map((f) => f.label).join(", ");
      setError(`Campos obrigatorios para status "${form.status}": ${missing}`);
      setLoading(false);
      return;
    }

    // Validação: Data Contato com Cliente não pode ser superior à Data de Entrega
    if (form.proximaTratativa && form.dueDate) {
      if (new Date(form.proximaTratativa) > new Date(form.dueDate)) {
        setError("Próxima Tratativa não pode ser superior à Data de Entrega.");
        setLoading(false);
        return;
      }
    }

    const body: Record<string, unknown> = {
      name: form.name,
      status: form.status,
      priority: form.priority,
      isRenovacao: form.isRenovacao,
      tags: [],
    };

    if (form.dueDate) body.dueDate = new Date(form.dueDate).toISOString();
    if (form.assigneeId) body.assigneeId = form.assigneeId;
    if (form.tipoCliente) body.tipoCliente = form.tipoCliente;
    if (form.contatoCliente) body.contatoCliente = form.contatoCliente;
    if (form.seguradora) body.seguradora = form.seguradora;
    if (form.produto) body.produto = form.produto;
    if (form.situacao) body.situacao = form.situacao;
    if (form.indicacao) body.indicacao = form.indicacao;
    if (form.inicioVigencia) body.inicioVigencia = form.inicioVigencia;
    if (form.fimVigencia) body.fimVigencia = form.fimVigencia;
    if (form.primeiroPagamento) body.primeiroPagamento = form.primeiroPagamento;
    if (form.proximaTratativa) body.proximaTratativa = form.proximaTratativa;
    if (form.parceladoEm) body.parceladoEm = Number(form.parceladoEm);
    if (form.valorParcelado) body.valorParcelado = form.valorParcelado;
    if (form.premioSemIof) body.premioSemIof = form.premioSemIof;
    if (form.comissao) body.comissao = form.comissao;
    if (form.aReceber) body.aReceber = form.aReceber;
    if (form.valorPerda) body.valorPerda = form.valorPerda;
    if (form.observacao) body.observacao = form.observacao;
    if (form.mesReferencia) body.mesReferencia = form.mesReferencia;
    if (form.anoReferencia) body.anoReferencia = Number(form.anoReferencia);
    if (isSaudeProduto(form.produto) && form.comissaoParcelada) {
      body.comissaoParcelada = form.comissaoParcelada;
    } else {
      body.comissaoParcelada = null;
    }

    const url = isEdit ? `/api/cotacoes/${cotacaoId}` : "/api/cotacoes";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Erro ao salvar cotacao.");
      setLoading(false);
      return;
    }

    setSuccess(isEdit ? "Cotacao atualizada!" : "Cotacao criada!");
    setTimeout(() => router.push("/cotacoes"), 1000);
  }

  const inputBase =
    "w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition text-slate-900 text-sm";
  const inputClass = (field?: string) =>
    `${inputBase} ${field && invalidFields.has(field) ? "border-[#ff695f] bg-red-50" : "border-slate-200"}`;
  const labelClass = "block text-sm font-medium text-slate-600 mb-1";
  const sectionClass = "space-y-4";

  const requiredFormFields = useMemo(() => {
    const rule = statusRules.find((r) => r.statusName === form.status);
    if (!rule?.requiredFields) return new Set<string>();
    const map: Record<string, string> = {
      fim_vigencia: "fimVigencia",
      inicio_vigencia: "inicioVigencia",
      indicacao: "indicacao",
      produto: "produto",
      seguradora: "seguradora",
      situacao: "situacao",
      tipo_cliente: "tipoCliente",
      comissao: "comissao",
      primeiro_pagamento: "primeiroPagamento",
      a_receber: "aReceber",
      parcelado_em: "parceladoEm",
      premio_sem_iof: "premioSemIof",
      valor_perda: "valorPerda",
      mes_referencia: "mesReferencia",
      ano_referencia: "anoReferencia",
    };
    return new Set(rule.requiredFields.map((f) => map[f] || f));
  }, [statusRules, form.status]);

  const req = (field: string) => requiredFormFields.has(field)
    ? <span className="text-red-500 ml-0.5">*</span>
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Impede Enter de submeter o form (apenas inputs de texto)
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
      className="space-y-8"
    >
      {/* Identificacao */}
      <fieldset className={sectionClass}>
        <legend className="text-lg font-semibold text-slate-900 mb-3">
          Identificacao
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="name" className={labelClass}>
              Nome do Cliente / Cotacao *
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass()}
              placeholder="Ex: Maria Silva - Auto Porto"
            />
          </div>
          <div>
            <label htmlFor="status" className={labelClass}>Status</label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputClass()}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className={labelClass}>Prioridade</label>
            <select
              id="priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              className={inputClass()}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Data de Entrega</label>
            <div className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-500 bg-slate-50 min-h-[38px]">
              {form.dueDate
                ? new Date(form.dueDate + "T00:00:00").toLocaleDateString("pt-BR")
                : "Selecione Produto e Tipo Cliente"}
            </div>
          </div>
          {currentUser.role === "admin" ? (
            <div>
              <label htmlFor="assigneeId" className={labelClass}>Responsavel</label>
              <select
                id="assigneeId"
                value={form.assigneeId}
                onChange={(e) => set("assigneeId", e.target.value)}
                className={inputClass()}
              >
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </fieldset>

      {/* Dados do Seguro */}
      <fieldset className={sectionClass}>
        <legend className="text-lg font-semibold text-slate-900 mb-3">
          Dados do Seguro
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="tipoCliente" className={labelClass}>Tipo Cliente{req("tipoCliente")}</label>
            <select
              id="tipoCliente"
              value={form.tipoCliente}
              onChange={(e) => { skipDueDateCalc.current = false; set("tipoCliente", e.target.value); }}
              className={inputClass("tipoCliente")}
            >
              <option value="">Selecione...</option>
              {TIPO_CLIENTE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="contatoCliente" className={labelClass}>Contato</label>
            <input
              id="contatoCliente"
              type="tel"
              value={form.contatoCliente}
              onChange={(e) => set("contatoCliente", e.target.value)}
              className={inputClass()}
              placeholder="(XX) XXXXX-XXXX"
            />
          </div>
          <div>
            <label htmlFor="seguradora" className={labelClass}>Seguradora{req("seguradora")}</label>
            <input
              id="seguradora"
              type="text"
              value={form.seguradora}
              onChange={(e) => set("seguradora", e.target.value)}
              className={inputClass("seguradora")}
            />
          </div>
          <div>
            <label htmlFor="produto" className={labelClass}>Produto{req("produto")}</label>
            <select
              id="produto"
              value={form.produto}
              onChange={(e) => { skipDueDateCalc.current = false; set("produto", e.target.value); }}
              className={inputClass("produto")}
            >
              <option value="">Selecione...</option>
              {PRODUTO_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="situacao" className={labelClass}>Situacao{req("situacao")}</label>
            <select
              id="situacao"
              value={form.situacao}
              onChange={(e) => { skipDueDateCalc.current = false; set("situacao", e.target.value); }}
              className={inputClass("situacao")}
            >
              <option value="">Selecione...</option>
              {situacoes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="indicacao" className={labelClass}>Indicacao{req("indicacao")}</label>
            <input
              id="indicacao"
              type="text"
              value={form.indicacao}
              onChange={(e) => set("indicacao", e.target.value)}
              className={inputClass("indicacao")}
            />
          </div>
        </div>

        {/* Botão de informações adicionais para parametrização do prazo */}
        {(() => {
          if (!form.produto || !form.tipoCliente) return null;
          const info = precisaMaisInfo(form.produto, form.tipoCliente);
          if (!info.mostrarVeiculos && !info.mostrarVidas) return null;
          return (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowMaisInfo((v) => !v)}
                className="px-4 py-2 text-sm font-medium text-[#03a4ed] border border-[#03a4ed] rounded-xl hover:bg-blue-50 transition"
              >
                {showMaisInfo ? "− Ocultar informações adicionais" : "+ Adicionar mais informações"}
              </button>

              {showMaisInfo && (
                <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                  <p className="text-xs text-slate-500 font-medium">
                    Informações adicionais para cálculo preciso da Data de Entrega — opcional
                  </p>
                  {info.mostrarVeiculos && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Quantidade de Veículos
                        <span className="text-slate-400 font-normal ml-1">
                          (≤ 2 = 24h &nbsp;·&nbsp; ≤ 10 = 2 dias &nbsp;·&nbsp; &gt; 10 = 5 dias)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={quantidadeVeiculos}
                        onChange={(e) => setQuantidadeVeiculos(e.target.value)}
                        placeholder="Ex: 5"
                        className="w-48 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none bg-white"
                      />
                    </div>
                  )}
                  {info.mostrarVidas && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Quantidade de Vidas
                        <span className="text-slate-400 font-normal ml-1">
                          {info.isNovoPJ
                            ? "(≤ 100 = 2 dias úteis · > 100 = 5 dias úteis)"
                            : "(≤ 99 = 30 dias · > 99 = 60 dias)"}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={quantidadeVidas}
                        onChange={(e) => { skipDueDateCalc.current = false; setQuantidadeVidas(e.target.value); }}
                        placeholder="Ex: 50"
                        className="w-48 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </fieldset>

      {/* Datas */}
      <fieldset className={sectionClass}>
        <legend className="text-lg font-semibold text-slate-900 mb-3">
          Datas
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="inicioVigencia" className={labelClass}>Inicio Vigencia{req("inicioVigencia")}</label>
            <input
              id="inicioVigencia"
              type="date"
              value={form.inicioVigencia}
              onChange={(e) => set("inicioVigencia", e.target.value)}
              className={inputClass("inicioVigencia")}
            />
          </div>
          <div>
            <label htmlFor="fimVigencia" className={labelClass}>Fim Vigencia{req("fimVigencia")}</label>
            <input
              id="fimVigencia"
              type="date"
              value={form.fimVigencia}
              onChange={(e) => { skipDueDateCalc.current = false; set("fimVigencia", e.target.value); }}
              className={inputClass("fimVigencia")}
            />
          </div>
          <div>
            <label htmlFor="primeiroPagamento" className={labelClass}>1o Pagamento{req("primeiroPagamento")}</label>
            <input
              id="primeiroPagamento"
              type="date"
              value={form.primeiroPagamento}
              onChange={(e) => set("primeiroPagamento", e.target.value)}
              className={inputClass("primeiroPagamento")}
            />
          </div>
          <div>
            <label htmlFor="proximaTratativa" className={labelClass}>Próxima Tratativa</label>
            <input
              id="proximaTratativa"
              type="date"
              value={form.proximaTratativa}
              max={form.dueDate || undefined}
              onChange={(e) => set("proximaTratativa", e.target.value)}
              className={inputClass()}
            />
            {form.dueDate && (
              <p className="text-xs text-slate-400 mt-1">
                Máximo: {new Date(form.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {/* Financeiro */}
      <fieldset className={sectionClass}>
        <legend className="text-lg font-semibold text-slate-900 mb-3">
          Financeiro
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="premioSemIof" className={labelClass}>Premio sem IOF (R$){req("premioSemIof")}</label>
            <input
              id="premioSemIof"
              type="number"
              step="0.01"
              min="0"
              value={form.premioSemIof}
              onChange={(e) => set("premioSemIof", e.target.value)}
              className={inputClass("premioSemIof")}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="comissaoPercentual" className={labelClass}>Comissao (%){req("comissao")}</label>
            <input
              id="comissaoPercentual"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={comissaoPercentual}
              onChange={(e) => {
                setComissaoPercentual(e.target.value);
                setAReceberManual(false);
              }}
              className={inputClass()}
              placeholder="Ex: 15.00"
            />
            {form.premioSemIof && comissaoPercentual && (
              <p className="text-xs text-slate-400 mt-1">
                {comissaoPercentual}% de R$ {parseFloat(form.premioSemIof).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="aReceber" className={labelClass}>
              A Receber (R$){req("aReceber")}
              {!aReceberManual && comissaoPercentual && (
                <span className="text-xs text-[#03a4ed] ml-1">robô</span>
              )}
            </label>
            <input
              id="aReceber"
              type="number"
              step="0.01"
              min="0"
              value={form.aReceber}
              onChange={(e) => {
                setAReceberManual(true);
                set("aReceber", e.target.value);
              }}
              className={inputClass("aReceber")}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="valorPerda" className={labelClass}>Valor em Perda (R$){req("valorPerda")}</label>
            <input
              id="valorPerda"
              type="number"
              step="0.01"
              min="0"
              value={form.valorPerda}
              onChange={(e) => set("valorPerda", e.target.value)}
              className={inputClass("valorPerda")}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="parceladoEm" className={labelClass}>Parcela do Cliente{req("parceladoEm")}</label>
            <input
              id="parceladoEm"
              type="text"
              value={form.parceladoEm}
              onChange={(e) => set("parceladoEm", e.target.value)}
              className={inputClass("parceladoEm")}
              placeholder="Ex: 12"
            />
          </div>
          <div>
            <label htmlFor="valorParcelado" className={labelClass}>
              Valor Parcelado (R$/mês)
              {!valorParceladoManual && form.valorParcelado && (
                <span className="text-xs text-[#03a4ed] ml-1">robô</span>
              )}
            </label>
            <input
              id="valorParcelado"
              type="number"
              step="0.01"
              min="0"
              value={form.valorParcelado}
              onChange={(e) => {
                setValorParceladoManual(true);
                set("valorParcelado", e.target.value);
              }}
              className={inputClass()}
              placeholder="0.00"
            />
          </div>
        </div>
      </fieldset>

      {/* Data de Comissionamento — apenas Saúde PF / Saúde PJ */}
      {isSaudeProduto(form.produto) && (
        <fieldset className={sectionClass}>
          <legend className="text-lg font-semibold text-slate-900 mb-1">
            Data de Comissionamento
          </legend>
          <p className="text-xs text-slate-500 mb-3">
            Informe quantas parcelas de comissão e a porcentagem de cada uma.
          </p>

          <div className="mb-4">
            <label htmlFor="parcelasComissao" className={labelClass}>
              Quantidade de Parcelas
            </label>
            <input
              id="parcelasComissao"
              type="text"
              value={form.comissaoParcelada?.parcelas ?? ""}
              onChange={(e) => {
                const n = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                const prev = form.comissaoParcelada?.percentuais ?? [];
                const percentuais = Array.from({ length: n }, (_, i) => prev[i] ?? 0);
                set("comissaoParcelada", { parcelas: n, percentuais });
              }}
              className={`${inputBase} border-slate-200 max-w-[160px]`}
              placeholder="Ex: 12"
            />
          </div>

          {form.comissaoParcelada && form.comissaoParcelada.parcelas > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: form.comissaoParcelada.parcelas }, (_, i) => (
                <div key={i}>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Parcela {i + 1} (%)
                  </label>
                  <input
                    type="text"
                    value={form.comissaoParcelada!.percentuais[i] ?? ""}
                    onChange={(e) => {
                      const percentuais = [...(form.comissaoParcelada!.percentuais)];
                      percentuais[i] = parseFloat(e.target.value) || 0;
                      set("comissaoParcelada", {
                        parcelas: form.comissaoParcelada!.parcelas,
                        percentuais,
                      });
                    }}
                    className={`${inputBase} border-slate-200`}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {/* Referencia e Observacoes */}
      <fieldset className={sectionClass}>
        <legend className="text-lg font-semibold text-slate-900 mb-3">
          Referencia
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="mesReferencia" className={labelClass}>Mes{req("mesReferencia")}</label>
            <select
              id="mesReferencia"
              value={form.mesReferencia}
              onChange={(e) => set("mesReferencia", e.target.value)}
              className={inputClass()}
            >
              <option value="">Selecione...</option>
              {MES_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="anoReferencia" className={labelClass}>Ano{req("anoReferencia")}</label>
            <select
              id="anoReferencia"
              value={form.anoReferencia}
              onChange={(e) => set("anoReferencia", e.target.value)}
              className={inputClass()}
            >
              <option value="">Selecione...</option>
              {ANO_OPTIONS.map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRenovacao}
                onChange={(e) => set("isRenovacao", e.target.checked)}
                className="w-4 h-4 text-[#03a4ed] rounded border-slate-300 focus:ring-[#03a4ed]"
              />
              <span className="text-sm text-slate-700">Renovacao</span>
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="observacao" className={labelClass}>Observacao / Quadro Fixo</label>
          <textarea
            id="observacao"
            rows={3}
            value={form.observacao}
            onChange={(e) => set("observacao", e.target.value)}
            className={inputClass()}
            placeholder="Notas adicionais..."
          />
        </div>
      </fieldset>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 text-[#ff695f] text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-600 text-sm px-4 py-3 rounded-xl border border-emerald-100">
          {success}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 text-white rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] focus:ring-2 focus:ring-[#03a4ed] focus:ring-offset-2 transition-all shadow-sm disabled:opacity-50"
        >
          {loading ? "Salvando..." : isEdit ? "Atualizar" : "Criar Cotacao"}
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
