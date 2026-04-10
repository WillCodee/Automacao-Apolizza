"use client";

import { useState, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = { text: string; tip?: string };
type Section = {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
  tags: string[];
};
type Category = {
  id: string;
  label: string;
  icon: React.ReactNode;
  sections: Section[];
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-2.5 mt-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#03a4ed] text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-slate-700 text-sm leading-relaxed">
            {s.text}
            {s.tip && (
              <span className="ml-1 text-[#03a4ed] font-medium text-xs">({s.tip})</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function InfoBox({ type, children }: { type: "tip" | "warning" | "info"; children: React.ReactNode }) {
  const styles = {
    tip: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-blue-50 border-[#03a4ed]/30 text-blue-800",
  };
  const icons = { tip: "✓", warning: "⚠", info: "ℹ" };
  return (
    <div className={`flex gap-2.5 p-3 rounded-xl border text-sm mt-3 ${styles[type]}`}>
      <span className="font-bold flex-shrink-0">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mt-3 rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-slate-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Accordion Item ───────────────────────────────────────────────────────────

function AccordionItem({ section, isOpen, onToggle }: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{section.icon}</span>
          <span className="font-semibold text-slate-800 text-sm">{section.title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 bg-white border-t border-slate-100">
          {section.content}
        </div>
      )}
    </div>
  );
}

// ─── Category Icons ───────────────────────────────────────────────────────────

const IconHome = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const IconDocs = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const IconTag = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
const IconRefresh = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const IconBolt = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconChart = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconTasks = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const IconBell = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const IconGear = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconUsers = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;

// ─── Categories Data ──────────────────────────────────────────────────────────

function buildCategories(): Category[] {
  return [
    {
      id: "primeiros-passos",
      label: "Primeiros Passos",
      icon: IconHome,
      sections: [
        {
          id: "login",
          title: "Como fazer login",
          icon: "🔐",
          tags: ["login", "acesso", "senha", "usuário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                O acesso ao Apolizza CRM é feito por usuário e senha. Você pode entrar com seu <strong>nome de usuário</strong> ou com seu <strong>e-mail cadastrado</strong>.
              </p>
              <StepList steps={[
                { text: "Acesse o sistema pelo link da sua corretora." },
                { text: "No campo de login, digite seu nome de usuário ou e-mail." },
                { text: "Digite sua senha e clique em Entrar." },
                { text: "Você será redirecionado automaticamente para a tela Início." },
              ]} />
              <InfoBox type="tip">
                Se esquecer a senha, peça ao proprietário do sistema para redefini-la.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "perfis",
          title: "Perfis de acesso: Cotador, Admin e Proprietário",
          icon: "👤",
          tags: ["perfil", "admin", "cotador", "proprietário", "permissão", "acesso"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                O sistema possui três perfis de acesso com permissões diferentes:
              </p>
              <Table
                headers={["Funcionalidade", "Cotador", "Admin", "Proprietário"]}
                rows={[
                  ["Início (próprias cotações)", "✅", "✅", "✅"],
                  ["Lista de cotações (todos)", "✅", "✅", "✅"],
                  ["Criar e editar cotações próprias", "✅", "✅", "✅"],
                  ["Dashboard — próprios KPIs/metas", "✅", "✅", "✅"],
                  ["Dashboard — visão geral da equipe", "❌", "✅", "✅"],
                  ["Renovações e Calendário", "✅", "✅", "✅"],
                  ["Tarefas e Operações", "✅", "✅", "✅"],
                  ["Tema (personalização visual)", "✅", "✅", "✅"],
                  ["Operações em lote (bulk)", "❌", "✅", "✅"],
                  ["Relatórios gerenciais", "❌", "✅", "✅"],
                  ["Notificações de cotações", "❌", "✅", "✅"],
                  ["Cadastro de Metas", "❌", "❌", "✅"],
                  ["Config. Status (campos obrig.)", "❌", "❌", "✅"],
                  ["Config. Situação", "❌", "❌", "✅"],
                  ["Gestão de Usuários", "❌", "❌", "✅"],
                  ["Automação: marcação de atrasados", "❌", "❌", "✅"],
                ]}
              />
            </div>
          ),
        },
        {
          id: "navegacao",
          title: "Navegando pelo sistema",
          icon: "🧭",
          tags: ["navegação", "menu", "telas", "início", "dashboard"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-2">
                O menu superior dá acesso a todas as áreas do sistema conforme seu perfil:
              </p>
              <Table
                headers={["Item do Menu", "O que encontra lá", "Perfil"]}
                rows={[
                  ["Início", "Visão geral com atalhos e suas cotações recentes", "Todos"],
                  ["Dashboard", "KPIs, gráficos, metas — geral para admin/proprietário", "Todos"],
                  ["Base de Conhecimento", "Este guia completo do sistema", "Todos"],
                  ["Cotações → Lista", "Todas as cotações com filtros avançados", "Todos"],
                  ["Cotações → Nova Cotação", "Formulário para criar uma nova cotação", "Todos"],
                  ["Cotações → Renovações", "Apólices próximas do vencimento (Fim de Vigência)", "Todos"],
                  ["Operações → Tarefas", "Gestão de tarefas com filtros de mês/ano", "Todos"],
                  ["Operações → Calendário", "Visão mensal de eventos e vencimentos", "Todos"],
                  ["Tema", "Personalizar cores e modo claro/escuro", "Todos"],
                  ["Administração → Relatórios", "Relatório gerencial com ranking", "Admin / Proprietário"],
                  ["Administração → Notificações", "Feed de mensagens e observações das cotações", "Admin / Proprietário"],
                  ["Administração → Metas", "Cadastro de metas mensais por cotador", "Proprietário"],
                  ["Configurações", "Status, situações, usuários", "Proprietário"],
                ]}
              />
            </div>
          ),
        },
      ],
    },
    {
      id: "cotacoes",
      label: "Cotações",
      icon: IconDocs,
      sections: [
        {
          id: "criar-cotacao",
          title: "Como criar uma nova cotação",
          icon: "➕",
          tags: ["criar", "nova cotação", "formulário", "cadastro"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Toda cotação é registrada com campos estruturados que facilitam o acompanhamento e a busca.
              </p>
              <StepList steps={[
                { text: "Clique em Cotações → Nova Cotação no menu superior." },
                { text: "Preencha o Nome do Cliente (obrigatório)." },
                { text: "Selecione o Produto (ex.: AUTO, RESIDENCIAL, VIDA PF…)." },
                { text: "Defina o Status inicial — normalmente não iniciado." },
                { text: "Preencha os demais campos relevantes: seguradora, valor, prazo, observações." },
                { text: "Clique em Salvar. Você será redirecionado para a tela de detalhe da cotação." },
              ]} />
              <InfoBox type="tip">
                Alguns status exigem campos obrigatórios. Se um campo estiver vazio, o sistema bloqueia a mudança de status e informa o que falta.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "campos-cotacao",
          title: "Campos disponíveis em uma cotação",
          icon: "📋",
          tags: ["campos", "produto", "seguradora", "valor", "fim de vigência", "situação", "prioridade"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">Cada cotação possui até 19 campos personalizados:</p>
              <Table
                headers={["Campo", "Tipo", "Descrição"]}
                rows={[
                  ["Cliente", "Texto", "Nome do cliente ou empresa"],
                  ["Produto", "Lista", "Tipo de seguro (AUTO, VIDA, SAÚDE, etc.)"],
                  ["Seguradora", "Texto", "Nome da seguradora cotada"],
                  ["Status", "Lista", "Fase atual no fluxo de trabalho"],
                  ["Situação", "Lista", "Classificação estratégica da cotação"],
                  ["Prioridade", "Lista", "Urgente / Alta / Normal / Baixa"],
                  ["Tipo de Cliente", "Lista", "NOVO/CASA, NOVO ou RENOVAÇÃO"],
                  ["Início de Vigência", "Data", "Data de início da apólice"],
                  ["Fim de Vigência", "Data", "Data de vencimento da apólice — base para alertas de renovação"],
                  ["Prêmio s/ IOF", "Número", "Valor do prêmio sem IOF em R$"],
                  ["A Receber", "Número", "Valor da comissão a receber em R$"],
                  ["Cotador", "Usuário", "Responsável pela cotação"],
                  ["Observações", "Texto", "Anotações livres — geram notificações quando alteradas"],
                  ["Documentos", "Arquivo", "PDFs, imagens e outros anexos"],
                ]}
              />
            </div>
          ),
        },
        {
          id: "visualizar-filtrar",
          title: "Visualizar e filtrar cotações",
          icon: "🔍",
          tags: ["filtrar", "buscar", "lista", "kanban", "pesquisar"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                A tela <strong>Lista de Cotações</strong> oferece dois modos de visualização e filtros avançados. Todos os perfis veem cotações de toda a equipe na lista.
              </p>
              <div className="mt-3 space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 mb-1">📄 Modo Lista</p>
                  <p className="text-sm text-slate-600">Exibe as cotações em tabela com todas as colunas visíveis. Ideal para varredura rápida e seleção múltipla (admin/proprietário).</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 mb-1">🗂️ Modo Kanban</p>
                  <p className="text-sm text-slate-600">Organiza as cotações em colunas por status. Ideal para visualizar o pipeline e mover cotações entre status.</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-700 mt-4 mb-2">Filtros disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {["Status", "Situação", "Produto", "Prioridade", "Seguradora", "Cotador", "Período", "Tipo de Cliente", "Busca por nome/seguradora"].map(f => (
                  <span key={f} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#03a4ed]/10 text-[#03a4ed]">{f}</span>
                ))}
              </div>
            </div>
          ),
        },
        {
          id: "operacoes-em-lote",
          title: "Operações em lote (bulk) — Admin e Proprietário",
          icon: "⚡",
          tags: ["lote", "bulk", "selecionar", "múltiplos", "deletar em massa", "admin", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                No modo Lista, Admin e Proprietário podem selecionar várias cotações e aplicar ações em massa. Cotadores não têm acesso a esta funcionalidade.
              </p>
              <StepList steps={[
                { text: "Na tela de cotações (modo Lista), marque o checkbox à esquerda de cada cotação desejada." },
                { text: "Para selecionar todas as visíveis, clique no checkbox do cabeçalho da tabela." },
                { text: "Com cotações selecionadas, o painel de ações em lote aparece automaticamente." },
                { text: "Escolha: Alterar status para X (selecione o status no dropdown e clique Aplicar) ou Excluir." },
                { text: "Confirme a ação na caixa de diálogo." },
              ]} />
              <InfoBox type="warning">
                A exclusão em lote é um soft delete — as cotações ficam ocultas da interface mas podem ser recuperadas pelo banco.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "exportar-importar",
          title: "Exportar e importar cotações (CSV)",
          icon: "📤",
          tags: ["exportar", "importar", "csv", "excel", "planilha", "colunas"],
          content: (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Colunas do arquivo CSV exportado:</p>
              <Table
                headers={["Coluna", "Descrição"]}
                rows={[
                  ["Nome", "Nome do cliente ou cotação"],
                  ["Link", "URL direta para a cotação no sistema"],
                  ["Status", "Status atual"],
                  ["Prioridade", "urgente / alta / normal / baixa"],
                  ["Produto", "Tipo de seguro"],
                  ["Seguradora", "Nome da seguradora"],
                  ["A Receber", "Comissão a receber em R$ (formato: 1234,56)"],
                  ["Valor Perda", "Valor da perda em R$"],
                  ["Comissão", "Percentual ou valor de comissão"],
                  ["Prêmio s/ IOF", "Prêmio sem IOF em R$"],
                  ["Tipo Cliente", "NOVO/CASA, NOVO ou RENOVAÇÃO"],
                  ["Situação", "Situação estratégica"],
                  ["Mês", "Mês de referência (ex: JAN, FEV…)"],
                  ["Ano", "Ano de referência"],
                  ["Cotador", "Nome do responsável"],
                  ["Criado Em", "Data de criação no formato dd/mm/aaaa"],
                ]}
              />
              <p className="text-sm font-semibold text-slate-700 mt-4 mb-2">Exportar para CSV:</p>
              <StepList steps={[
                { text: "Na tela de cotações, aplique filtros desejados (opcional)." },
                { text: "Clique no botão Exportar CSV. O download inicia automaticamente." },
                { text: "Abra no Excel: use o delimitador ponto-e-vírgula (;) para separar as colunas corretamente." },
              ]} />
              <p className="text-sm font-semibold text-slate-700 mt-4 mb-2">Importar de CSV:</p>
              <StepList steps={[
                { text: "Exporte uma cotação existente para obter o modelo com as colunas corretas." },
                { text: "Preencha o arquivo com os novos registros, mantendo os cabeçalhos intactos." },
                { text: "Clique em Importar CSV, selecione o arquivo e confirme. O sistema informa erros linha a linha." },
              ]} />
            </div>
          ),
        },
        {
          id: "documentos-historico",
          title: "Documentos e histórico de alterações",
          icon: "📁",
          tags: ["documentos", "anexo", "histórico", "auditoria", "pdf"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Cada cotação possui uma aba de <strong>Documentos</strong> e uma aba de <strong>Histórico</strong> na tela de detalhe.
              </p>
              <div className="mt-3 space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 mb-1">📎 Documentos</p>
                  <p className="text-sm text-slate-600">Faça upload de PDFs, imagens e outros arquivos diretamente na cotação. Os arquivos ficam armazenados em nuvem e podem ser baixados a qualquer momento.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 mb-1">🕐 Histórico</p>
                  <p className="text-sm text-slate-600">Registra automaticamente todas as alterações campo a campo — quem alterou, o valor anterior e o novo, e o horário exato. É somente leitura e não pode ser apagado.</p>
                </div>
              </div>
            </div>
          ),
        },
        {
          id: "mensagens-cotacao",
          title: "Mensagens e observações em cotações",
          icon: "💬",
          tags: ["mensagem", "observação", "comentário", "notificação", "comunicação"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Dentro de cada cotação há duas formas de registrar informações que geram notificações para admin e proprietário:
              </p>
              <div className="mt-3 space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 mb-1">📝 Campo Observações</p>
                  <p className="text-sm text-slate-600">Quando o campo Observações é preenchido ou atualizado, uma notificação é gerada automaticamente e aparece em <strong>Administração → Notificações</strong>.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 mb-1">💬 Chat da Cotação</p>
                  <p className="text-sm text-slate-600">Cada cotação tem um chat dedicado. Toda mensagem enviada também gera uma notificação visível para admin e proprietário, com link direto para a cotação.</p>
                </div>
              </div>
              <InfoBox type="info">
                O histórico de alterações de campos (Histórico) NÃO gera notificações — apenas observações e mensagens do chat da cotação.
              </InfoBox>
            </div>
          ),
        },
      ],
    },
    {
      id: "status-situacoes",
      label: "Status e Situações",
      icon: IconTag,
      sections: [
        {
          id: "status",
          title: "Os 8 status do fluxo de trabalho",
          icon: "🔄",
          tags: ["status", "fluxo", "etapa", "pipeline"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                O status representa a fase operacional atual da cotação:
              </p>
              <Table
                headers={["Status", "Significado", "Quem define"]}
                rows={[
                  ["não iniciado", "Cotação recém-criada, ainda não trabalhada", "Manual"],
                  ["raut", "Renovação Automática — renova apólice no plano atual", "Manual"],
                  ["atrasado", "Prazo vencido — marcado automaticamente pelo sistema", "Automático"],
                  ["pendencia", "Aguardando documentação, informação ou retorno do cliente", "Manual"],
                  ["perda", "Negócio perdido — cliente não fechou", "Manual"],
                  ["fechado", "Negócio fechado com sucesso", "Manual"],
                  ["implantando", "Em processo de implantação/emissão da apólice", "Manual"],
                  ["concluido ocultar", "Concluído e removido da lista padrão (arquivado)", "Manual"],
                ]}
              />
              <InfoBox type="warning">
                O status <strong>atrasado</strong> é definido automaticamente pelo cron job diário. Esta automação é configurada pelo Proprietário.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "situacoes",
          title: "As 6 situações estratégicas",
          icon: "🎯",
          tags: ["situação", "classificação", "estratégia", "pipeline"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                A situação é uma classificação estratégica que organiza o pipeline e aparece nos relatórios:
              </p>
              <Table
                headers={["Situação", "Quando usar"]}
                rows={[
                  ["IMPLANTAÇÃO", "Apólice sendo emitida / em fase de implantação"],
                  ["COTAR", "Processo de Cotação — cliente em negociação"],
                  ["CLIENTE", "Apólice enviada ao cliente e acompanhamento contínuo"],
                  ["RAUT", "Renovação Automática — processo em andamento"],
                  ["FECHADO", "Negócio encerrado"],
                  ["PERDA/RESGATE", "Cliente perdido — em tentativa de resgate"],
                ]}
              />
              <InfoBox type="tip">
                Use situação em conjunto com status: a situação mostra o contexto estratégico; o status, a etapa operacional.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "campos-obrigatorios",
          title: "Campos obrigatórios por status (Proprietário)",
          icon: "⚙️",
          tags: ["campos obrigatórios", "validação", "status config", "configuração", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                O <strong>Proprietário</strong> pode definir quais campos precisam estar preenchidos para que uma cotação avance para cada status, em <strong>Configurações → Config. Status</strong>.
              </p>
              <StepList steps={[
                { text: "Acesse Configurações → Config. Status (Proprietário)." },
                { text: "Clique em um status para abrir sua configuração." },
                { text: "Marque quais campos são obrigatórios para esse status." },
                { text: "Salve. O sistema passará a bloquear a mudança se os campos estiverem vazios." },
              ]} />
              <InfoBox type="tip">
                Configuração recomendada: <strong>fechado</strong> deve exigir Prêmio s/ IOF, Seguradora e Fim de Vigência — garantindo dados completos nos relatórios.
              </InfoBox>
            </div>
          ),
        },
      ],
    },
    {
      id: "renovacoes",
      label: "Renovações",
      icon: IconRefresh,
      sections: [
        {
          id: "sistema-renovacoes",
          title: "Como funciona o sistema de renovações",
          icon: "🔔",
          tags: ["renovação", "vencimento", "alerta", "apólice", "fim de vigência"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                O sistema monitora o campo <strong>Fim de Vigência</strong> de cada cotação e exibe alertas visuais na tela de Renovações. Mantenha este campo sempre atualizado.
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-2xl">🔴</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Vence em até 15 dias — Crítico</p>
                    <p className="text-xs text-red-600">Ação imediata. Entre em contato com o cliente hoje.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-2xl">🟡</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-700">Vence em até 30 dias — Atenção</p>
                    <p className="text-xs text-amber-600">Iniciar processo de renovação. Solicitar documentos e comparativos.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-2xl">🔵</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-700">Vence em até 60 dias — Planejamento</p>
                    <p className="text-xs text-blue-600">Identificar e planejar a renovação com antecedência.</p>
                  </div>
                </div>
              </div>
              <InfoBox type="warning">
                A base para os alertas é o campo <strong>Fim de Vigência</strong> da cotação. Cotações sem esse campo preenchido não aparecem na tela de Renovações.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "fluxo-renovacao",
          title: "Passo a passo da renovação",
          icon: "📅",
          tags: ["fluxo", "renovação", "processo", "passo a passo"],
          content: (
            <div>
              <StepList steps={[
                { text: "Acesse Cotações → Renovações para ver apólices próximas do vencimento." },
                { text: "Filtre por urgência (15, 30 ou 60 dias) para priorizar ações." },
                { text: "Clique na cotação para abrir o detalhe." },
                { text: "Contate o cliente para negociar a renovação." },
                { text: "Atualize o Tipo de Cliente para RENOVAÇÃO e preencha os dados da nova apólice." },
                { text: "Quando renovada, mude o status para fechado e atualize o campo Fim de Vigência com a nova data." },
                { text: "O sistema atualiza os alertas automaticamente com base na nova data de Fim de Vigência." },
              ]} />
            </div>
          ),
        },
      ],
    },
    {
      id: "automacoes",
      label: "Automações",
      icon: IconBolt,
      sections: [
        {
          id: "cron-atrasados",
          title: "Automação: marcação de cotações atrasadas (Proprietário)",
          icon: "⏰",
          tags: ["automação", "cron", "atrasado", "automático", "prazo", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Esta automação é gerenciada exclusivamente pelo <strong>Proprietário</strong>. Um job diário verifica cotações com prazo vencido e muda o status para <strong>atrasado</strong> automaticamente.
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                <p className="text-xs font-mono text-slate-500 mb-1">Endpoint (CRON_SECRET requerido)</p>
                <p className="text-sm font-mono text-slate-700">POST /api/cron/atrasados</p>
              </div>
              <p className="text-sm font-semibold text-slate-700 mt-4 mb-2">Como funciona:</p>
              <StepList steps={[
                { text: "Todo dia, o cron job é acionado automaticamente pela Vercel." },
                { text: "Busca cotações com status não iniciado, pendencia ou raut com prazo vencido." },
                { text: "Altera o status para atrasado e registra no histórico como 'cron automático'." },
              ]} />
              <InfoBox type="info">
                Se uma cotação aparecer como atrasada indevidamente, verifique a Data de Validade e corrija o status manualmente.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "alertas-renovacao",
          title: "Automação: alertas de Fim de Vigência",
          icon: "📬",
          tags: ["alerta", "renovação", "fim de vigência", "vencimento", "automático"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                O sistema monitora o campo <strong>Fim de Vigência</strong> de cada cotação e calcula alertas em tempo real na tela de Renovações.
              </p>
              <Table
                headers={["Janela", "Cor do alerta", "Ação recomendada"]}
                rows={[
                  ["0–15 dias", "Vermelho (crítico)", "Contato imediato com o cliente"],
                  ["16–30 dias", "Amarelo (atenção)", "Iniciar processo de renovação"],
                  ["31–60 dias", "Azul (planejamento)", "Identificar e preparar renovação"],
                ]}
              />
            </div>
          ),
        },
        {
          id: "notificacoes-cotacoes",
          title: "Notificações automáticas de cotações",
          icon: "🔔",
          tags: ["notificação", "mensagem", "observação", "automático", "admin", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Toda mensagem enviada no chat de uma cotação e toda alteração no campo Observações geram uma notificação automática, visível para <strong>Admin e Proprietário</strong> em <strong>Administração → Notificações</strong>.
              </p>
              <Table
                headers={["Evento", "Tipo de notificação", "Quem vê"]}
                rows={[
                  ["Mensagem enviada no chat da cotação", "💬 Mensagem", "Admin e Proprietário"],
                  ["Campo Observações alterado", "📝 Observação", "Admin e Proprietário"],
                ]}
              />
              <InfoBox type="info">
                Alterações de outros campos (status, seguradora, etc.) NÃO geram notificações — apenas são registradas no Histórico da cotação.
              </InfoBox>
            </div>
          ),
        },
      ],
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: IconChart,
      sections: [
        {
          id: "kpis",
          title: "Entendendo os KPIs",
          icon: "📊",
          tags: ["kpi", "indicador", "métrica", "dashboard", "desempenho"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                O Dashboard exibe os principais indicadores de desempenho:
              </p>
              <Table
                headers={["KPI", "O que mede", "Cotador vê"]}
                rows={[
                  ["Total de Cotações", "Quantidade no período selecionado", "Só as próprias"],
                  ["Cotações Fechadas", "Quantas resultaram em negócio fechado", "Só as próprias"],
                  ["Taxa de Conversão", "% fechadas / total", "Própria taxa"],
                  ["Valor Total", "Soma dos prêmios fechados", "Próprio valor"],
                  ["Metas vs Realizado", "Meta mensal x resultado atual", "Própria meta"],
                ]}
              />
              <InfoBox type="info">
                Cotadores veem apenas seus próprios KPIs e metas. Admin e Proprietário veem a visão consolidada de toda a equipe.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "graficos",
          title: "Gráficos e análises visuais",
          icon: "📈",
          tags: ["gráfico", "análise", "mensal", "tendência", "breakdown"],
          content: (
            <div>
              <div className="space-y-3 mt-2">
                {[
                  { icon: "📊", title: "Gráfico Mensal", desc: "Evolução mês a mês de cotações criadas vs. fechadas." },
                  { icon: "🍩", title: "Breakdown por Status", desc: "Distribuição de todas as cotações por status — visualiza onde estão concentradas no pipeline." },
                  { icon: "👥", title: "Performance por Cotador", desc: "Ranking com total de cotações, fechamentos e taxa de conversão por cotador (admin/proprietário)." },
                  { icon: "🎯", title: "Metas vs Realizado", desc: "Comparativo entre meta mensal e resultado atual de cada cotador." },
                ].map((item) => (
                  <div key={item.title} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-sm font-semibold text-slate-700">{item.icon} {item.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ),
        },
      ],
    },
    {
      id: "operacoes",
      label: "Tarefas e Calendário",
      icon: IconTasks,
      sections: [
        {
          id: "tarefas",
          title: "Gerenciando tarefas",
          icon: "✅",
          tags: ["tarefa", "checklist", "pendência", "prazo", "responsável", "filtro", "mês", "ano"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                A tela de Tarefas permite criar e acompanhar atividades da equipe. Cotadores veem apenas suas próprias tarefas; admin e proprietário veem todas.
              </p>
              <StepList steps={[
                { text: "Acesse Operações → Tarefas no menu." },
                { text: "Use os filtros de status (Pendente, Em Andamento, Concluída) para focar no que precisa de atenção." },
                { text: "Use os filtros de Mês e Ano para ver tarefas de um período específico." },
                { text: "Use o filtro de data de vencimento (De / Até) para filtrar por prazo." },
                { text: "Admin cria novas tarefas com o botão + Nova Tarefa." },
                { text: "Atualize o status da tarefa conforme o andamento." },
              ]} />
              <Table
                headers={["Status", "Significado"]}
                rows={[
                  ["Pendente", "Aguardando início"],
                  ["Em Andamento", "Sendo executada"],
                  ["Concluída", "Finalizada com sucesso"],
                  ["Cancelada", "Não será executada"],
                ]}
              />
            </div>
          ),
        },
        {
          id: "calendario",
          title: "Usando o calendário",
          icon: "📅",
          tags: ["calendário", "evento", "agenda", "mês", "data"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                O Calendário exibe uma visão mensal de vencimentos de cotações e prazos de tarefas gerados automaticamente.
              </p>
              <StepList steps={[
                { text: "Acesse Operações → Calendário." },
                { text: "Navegue pelos meses com as setas." },
                { text: "Clique em um evento para ver o detalhe e acessar a cotação ou tarefa relacionada." },
              ]} />
              <InfoBox type="info">
                Os eventos são gerados a partir das datas de Fim de Vigência das cotações e dos prazos de tarefas. Não é necessário cadastrar eventos manualmente.
              </InfoBox>
            </div>
          ),
        },
      ],
    },
    {
      id: "notificacoes",
      label: "Notificações",
      icon: IconBell,
      sections: [
        {
          id: "feed-notificacoes",
          title: "Feed de notificações (Admin e Proprietário)",
          icon: "🔔",
          tags: ["notificação", "feed", "mensagem", "observação", "admin", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Em <strong>Administração → Notificações</strong>, Admin e Proprietário têm acesso ao feed de todas as mensagens e observações registradas nas cotações.
              </p>
              <div className="mt-3 space-y-2">
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
                  <p className="text-sm font-semibold text-violet-700 mb-1">💬 Mensagens</p>
                  <p className="text-sm text-violet-600">Mensagens enviadas no chat de qualquer cotação aparecem aqui com link direto para a cotação.</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-semibold text-amber-700 mb-1">📝 Observações</p>
                  <p className="text-sm text-amber-600">Alterações no campo Observações de qualquer cotação aparecem aqui com o texto inserido e link para a cotação.</p>
                </div>
              </div>
              <StepList steps={[
                { text: "Acesse Administração → Notificações." },
                { text: "Use os botões Todas / Mensagens / Observações para filtrar o tipo." },
                { text: "Clique no nome da cotação em qualquer notificação para abri-la diretamente." },
              ]} />
            </div>
          ),
        },
      ],
    },
    {
      id: "administracao",
      label: "Administração",
      icon: IconUsers,
      sections: [
        {
          id: "usuarios",
          title: "Gestão de usuários (Proprietário)",
          icon: "👥",
          tags: ["usuário", "criar", "editar", "senha", "admin", "cotador", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Em <strong>Configurações → Usuários</strong>, o Proprietário pode criar, editar e gerenciar todos os usuários.
              </p>
              <StepList steps={[
                { text: "Acesse Configurações → Usuários." },
                { text: "Clique em Novo Usuário." },
                { text: "Preencha: nome, usuário (login), e-mail, senha e perfil (cotador, admin ou proprietario)." },
                { text: "Salve. O usuário já pode fazer login com as credenciais cadastradas." },
                { text: "Para redefinir senha: clique no usuário e altere o campo de senha." },
              ]} />
              <InfoBox type="warning">
                Defina senhas seguras. Cada ação no sistema é registrada com o usuário responsável.
              </InfoBox>
            </div>
          ),
        },
        {
          id: "relatorios",
          title: "Relatórios gerenciais (Admin e Proprietário)",
          icon: "📑",
          tags: ["relatório", "ranking", "desempenho", "gerencial"],
          content: (
            <div>
              <div className="space-y-2 mt-2">
                {[
                  { title: "🏆 Ranking de Cotadores", desc: "Classifica por fechamentos, taxa de conversão e valor total de prêmios." },
                  { title: "📊 Análise por Produto", desc: "Quais produtos (AUTO, VIDA, SAÚDE…) geram mais negócios e valor." },
                  { title: "📈 Evolução Mensal", desc: "Comparativo mês a mês no ano selecionado." },
                ].map((item) => (
                  <div key={item.title} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ),
        },
        {
          id: "metas-admin",
          title: "Cadastrando metas mensais (Proprietário)",
          icon: "🎯",
          tags: ["meta", "objetivo", "mensal", "cotador", "cadastro", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Somente o <strong>Proprietário</strong> cadastra metas mensais. Elas são exibidas no Dashboard para medir desempenho individual.
              </p>
              <StepList steps={[
                { text: "Acesse Administração → Cadastro de Metas." },
                { text: "Selecione o cotador no campo Usuário." },
                { text: "Selecione o mês e o ano." },
                { text: "Digite o valor da meta (em R$)." },
                { text: "Clique em Salvar. Aparece imediatamente no Dashboard." },
              ]} />
            </div>
          ),
        },
      ],
    },
    {
      id: "configuracoes",
      label: "Configurações",
      icon: IconGear,
      sections: [
        {
          id: "config-situacao",
          title: "Configurando situações (Proprietário)",
          icon: "🏷️",
          tags: ["situação", "configurar", "opção", "proprietário"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Em <strong>Configurações → Config. Situação</strong>, o Proprietário personaliza as opções de situação disponíveis para as cotações.
              </p>
              <StepList steps={[
                { text: "Acesse Configurações → Config. Situação." },
                { text: "Veja as situações ativas (IMPLANTAÇÃO, COTAR, CLIENTE, RAUT, FECHADO, PERDA/RESGATE)." },
                { text: "Adicione, edite ou desative situações conforme a necessidade." },
                { text: "Salve. As mudanças refletem nos formulários de cotação." },
              ]} />
            </div>
          ),
        },
        {
          id: "tema",
          title: "Temas e aparência do sistema",
          icon: "🎨",
          tags: ["tema", "cor", "aparência", "dark mode", "personalizar"],
          content: (
            <div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Todos os usuários podem personalizar o tema em <strong>Tema</strong> no menu. 5 temas de cores + modo escuro disponíveis:
              </p>
              <Table
                headers={["Tema", "Cor principal", "Destaque"]}
                rows={[
                  ["🌊 Oceano (padrão)", "Azul #03a4ed", "Coral #ff695f"],
                  ["🌿 Esmeralda", "Verde #10b981", "Âmbar #f59e0b"],
                  ["💜 Violeta", "Roxo #8b5cf6", "Rosa #ec4899"],
                  ["🌅 Pôr do Sol", "Laranja #f97316", "Vermelho #ef4444"],
                  ["🌙 Meia-Noite", "Índigo #6366f1", "Teal #14b8a6"],
                ]}
              />
              <InfoBox type="info">
                A preferência de tema é salva por dispositivo. Cada usuário pode ter uma preferência diferente.
              </InfoBox>
            </div>
          ),
        },
      ],
    },
  ];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BaseConhecimentoContent({ userRole }: { userRole: "admin" | "cotador" | "proprietario" }) {
  const categories = useMemo(() => buildCategories(), []);
  const [activeCategory, setActiveCategory] = useState("primeiros-passos");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["login"]));
  const [search, setSearch] = useState("");

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const currentCategory = categories.find((c) => c.id === activeCategory) ?? categories[0];

  const filteredSections = useMemo(() => {
    if (!search.trim()) return currentCategory?.sections ?? [];
    const q = search.toLowerCase();
    return (currentCategory?.sections ?? []).filter(
      (s) => s.title.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q))
    );
  }, [search, currentCategory]);

  const globalResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: { cat: Category; section: Section }[] = [];
    for (const cat of categories) {
      for (const section of cat.sections) {
        if (section.title.toLowerCase().includes(q) || section.tags.some((t) => t.includes(q))) {
          results.push({ cat, section });
        }
      }
    }
    return results;
  }, [search, categories]);

  const isGlobalSearch = search.trim().length > 0;

  void userRole; // available for future role-based filtering

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-apolizza-gradient flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Base de Conhecimento</h1>
            <p className="text-sm text-slate-500">Guia completo de uso do Apolizza CRM</p>
          </div>
        </div>

        <div className="relative mt-5 max-w-xl">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar no guia... (ex: renovação, bulk, status)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#03a4ed]/30 focus:border-[#03a4ed] shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Global search results */}
      {isGlobalSearch && globalResults !== null && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            {globalResults.length === 0 ? "Nenhum resultado encontrado." : `${globalResults.length} resultado${globalResults.length !== 1 ? "s" : ""}`}
          </p>
          <div className="space-y-3">
            {globalResults.map(({ cat, section }) => (
              <div key={section.id}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{cat.label}</p>
                <AccordionItem
                  section={section}
                  isOpen={openSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category nav + content */}
      {!isGlobalSearch && (
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <nav className="sticky top-4 space-y-1">
              {categories.map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setOpenSections(new Set()); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      isActive ? "bg-[#03a4ed]/10 text-[#03a4ed]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    <span className={isActive ? "text-[#03a4ed]" : "text-slate-400"}>{cat.icon}</span>
                    {cat.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Mobile category tabs */}
          <div className="md:hidden w-full mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setOpenSections(new Set()); }}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive ? "bg-[#03a4ed] text-white" : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {currentCategory && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">{currentCategory.label}</h2>
                  <button
                    onClick={() => {
                      const allIds = new Set(currentCategory.sections.map((s) => s.id));
                      const allOpen = currentCategory.sections.every((s) => openSections.has(s.id));
                      setOpenSections(allOpen ? new Set() : allIds);
                    }}
                    className="text-xs text-[#03a4ed] hover:underline font-medium"
                  >
                    {currentCategory.sections.every((s) => openSections.has(s.id)) ? "Recolher todos" : "Expandir todos"}
                  </button>
                </div>
                {filteredSections.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Nenhuma seção encontrada.</p>
                ) : (
                  filteredSections.map((section) => (
                    <AccordionItem
                      key={section.id}
                      section={section}
                      isOpen={openSections.has(section.id)}
                      onToggle={() => toggleSection(section.id)}
                    />
                  ))
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
