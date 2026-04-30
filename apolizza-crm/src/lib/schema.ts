import {
  mysqlTable,
  char,
  varchar,
  text,
  boolean,
  int,
  decimal,
  date,
  datetime,
  json,
  mysqlEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ============================================================
// HELPER: UUID generator para MySQL (não tem uuid_generate_v4)
// ============================================================
const genUUID = () => randomUUID();

// ============================================================
// USERS
// ============================================================

export const users = mysqlTable(
  "users",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: mysqlEnum("role", ["admin", "cotador", "proprietario"]).notNull().default("cotador"),
    photoUrl: text("photo_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`NOW()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_username_idx").on(table.username),
  ]
);

// ============================================================
// COTACOES
// ============================================================

export const cotacoes = mysqlTable(
  "cotacoes",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    clickupId: varchar("clickup_id", { length: 20 }),
    name: varchar("name", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("não iniciado"),
    priority: varchar("priority", { length: 20 }).default("normal"),
    dueDate: datetime("due_date"),
    assigneeId: char("assignee_id", { length: 36 }).references(() => users.id),
    grupoId: char("grupo_id", { length: 36 }),

    // 19 custom fields mapeados do ClickUp
    tipoCliente: varchar("tipo_cliente", { length: 50 }),
    contatoCliente: varchar("contato_cliente", { length: 50 }),
    seguradora: varchar("seguradora", { length: 255 }),
    produto: varchar("produto", { length: 255 }),
    situacao: varchar("situacao", { length: 50 }),
    indicacao: varchar("indicacao", { length: 255 }),
    inicioVigencia: date("inicio_vigencia"),
    fimVigencia: date("fim_vigencia"),
    primeiroPagamento: date("primeiro_pagamento"),
    parceladoEm: int("parcelado_em"),
    valorParcelado: decimal("valor_parcelado", { precision: 12, scale: 2 }),
    premioSemIof: decimal("premio_sem_iof", { precision: 12, scale: 2 }),
    premioComIof: decimal("premio_com_iof", { precision: 12, scale: 2 }),
    comissao: text("comissao"),
    aReceber: decimal("a_receber", { precision: 12, scale: 2 }),
    valorPerda: decimal("valor_perda", { precision: 12, scale: 2 }),
    proximaTratativa: date("proxima_tratativa"),
    observacao: text("observacao"),
    mesReferencia: varchar("mes_referencia", { length: 10 }),
    anoReferencia: int("ano_referencia"),

    comissaoParcelada: json("comissao_parcelada").$type<{ parcelas: number; percentuais: number[] } | null>(),
    tags: json("tags").$type<string[]>(),
    isRenovacao: boolean("is_renovacao").notNull().default(false),
    atrasadoDesde: date("atrasado_desde"),
    deletedAt: datetime("deleted_at"),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`NOW()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cotacoes_status_idx").on(table.status),
    index("cotacoes_due_date_idx").on(table.dueDate),
    index("cotacoes_assignee_idx").on(table.assigneeId),
    index("cotacoes_ano_idx").on(table.anoReferencia),
    index("cotacoes_clickup_id_idx").on(table.clickupId),
    index("cotacoes_deleted_at_idx").on(table.deletedAt),
    index("idx_atrasado_desde").on(table.atrasadoDesde),
  ]
);

// ============================================================
// COTACAO_DOCS
// ============================================================

export const cotacaoDocs = mysqlTable(
  "cotacao_docs",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    cotacaoId: char("cotacao_id", { length: 36 })
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: int("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    uploadedBy: char("uploaded_by", { length: 36 }).references(() => users.id),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [index("cotacao_docs_cotacao_idx").on(table.cotacaoId)]
);

// ============================================================
// METAS
// ============================================================

export const metas = mysqlTable(
  "metas",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    userId: char("user_id", { length: 36 }).references(() => users.id),
    grupoId: char("grupo_id", { length: 36 }).references(() => gruposUsuarios.id),
    ano: int("ano").notNull(),
    mes: int("mes").notNull(),
    metaValor: decimal("meta_valor", { precision: 12, scale: 2 }),
    metaQtdCotacoes: int("meta_qtd_cotacoes"),
    metaRenovacoes: int("meta_renovacoes"),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`NOW()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("metas_user_ano_mes_idx").on(
      table.userId,
      table.ano,
      table.mes
    ),
    uniqueIndex("metas_grupo_ano_mes_idx").on(
      table.grupoId,
      table.ano,
      table.mes
    ),
  ]
);

// ============================================================
// METAS_PRODUTO
// ============================================================

export const metasProduto = mysqlTable(
  "metas_produto",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    ano: int("ano").notNull(),
    mes: int("mes").notNull(),
    produto: varchar("produto", { length: 100 }).notNull(),
    metaValor: decimal("meta_valor", { precision: 12, scale: 2 }),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`NOW()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("metas_produto_ano_mes_produto_idx").on(table.ano, table.mes, table.produto),
  ]
);

// ============================================================
// COTACAO_HISTORY (Audit Trail)
// ============================================================

export const cotacaoHistory = mysqlTable(
  "cotacao_history",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    cotacaoId: char("cotacao_id", { length: 36 })
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    userId: char("user_id", { length: 36 }).references(() => users.id),
    fieldName: varchar("field_name", { length: 100 }).notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedAt: datetime("changed_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("cotacao_history_cotacao_idx").on(table.cotacaoId),
    index("cotacao_history_changed_at_idx").on(table.changedAt),
  ]
);

// ============================================================
// STATUS_CONFIG
// ============================================================

export const statusConfig = mysqlTable("status_config", {
  id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
  statusName: varchar("status_name", { length: 50 }).notNull().unique(),
  displayLabel: varchar("display_label", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  icon: varchar("icon", { length: 10 }),
  orderIndex: int("order_index").notNull().default(0),
  requiredFields: json("required_fields").$type<string[]>(),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

// ============================================================
// SITUACAO_CONFIG
// ============================================================

export const situacaoConfig = mysqlTable("situacao_config", {
  id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
  nome: varchar("nome", { length: 100 }).notNull().unique(),
  orderIndex: int("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  defaultCotadorId: char("default_cotador_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: datetime("created_at").notNull().default(sql`NOW()`),
});

// ============================================================
// COMISSAO_TABELA
// ============================================================

export const comissaoTabela = mysqlTable(
  "comissao_tabela",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    seguradora: varchar("seguradora", { length: 255 }).notNull(),
    produto: varchar("produto", { length: 255 }),
    percentual: decimal("percentual", { precision: 5, scale: 2 }).notNull(),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`NOW()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("comissao_tabela_seguradora_idx").on(table.seguradora),
  ]
);

// ============================================================
// TAREFAS (EPIC-003: Controle de Tarefas Diárias)
// ============================================================

export const tarefas = mysqlTable(
  "tarefas",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descricao: text("descricao"),
    dataVencimento: datetime("data_vencimento"),
    status: mysqlEnum("status", [
      "Pendente",
      "Em Andamento",
      "Concluída",
      "Cancelada",
    ]).notNull().default("Pendente"),
    cotadorId: char("cotador_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    criadorId: char("criador_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    visualizadaEm: datetime("visualizada_em"),
    iniciadaEm: datetime("iniciada_em"),
    concluidaEm: datetime("concluida_em"),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`NOW()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tarefas_status_idx").on(table.status),
    index("tarefas_cotador_idx").on(table.cotadorId),
    index("tarefas_criador_idx").on(table.criadorId),
    index("tarefas_data_vencimento_idx").on(table.dataVencimento),
  ]
);

// ============================================================
// TAREFAS_BRIEFINGS (EPIC-003: Story 13.2)
// ============================================================

export const tarefasBriefings = mysqlTable(
  "tarefas_briefings",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    tarefaId: char("tarefa_id", { length: 36 })
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    usuarioId: char("usuario_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    briefing: text("briefing").notNull(),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("tarefas_briefings_tarefa_idx").on(table.tarefaId),
    index("tarefas_briefings_created_idx").on(table.createdAt),
  ]
);

// ============================================================
// TAREFAS_ANEXOS (EPIC-003: Story 13.6)
// ============================================================

export const tarefasAnexos = mysqlTable(
  "tarefas_anexos",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    tarefaId: char("tarefa_id", { length: 36 })
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    usuarioId: char("usuario_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    nomeArquivo: varchar("nome_arquivo", { length: 255 }).notNull(),
    urlBlob: text("url_blob").notNull(),
    tamanho: int("tamanho").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("tarefas_anexos_tarefa_idx").on(table.tarefaId),
    index("tarefas_anexos_usuario_idx").on(table.usuarioId),
    index("tarefas_anexos_created_idx").on(table.createdAt),
  ]
);

// ============================================================
// TAREFAS_ATIVIDADES (EPIC-003: Story 13.5)
// ============================================================

export const tarefasAtividades = mysqlTable(
  "tarefas_atividades",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    tarefaId: char("tarefa_id", { length: 36 })
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    usuarioId: char("usuario_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    tipoAcao: mysqlEnum("tipo_acao", [
      "CRIADA",
      "EDITADA",
      "STATUS_ALTERADO",
      "BRIEFING_ADICIONADO",
      "ANEXO_ADICIONADO",
      "ANEXO_REMOVIDO",
    ]).notNull(),
    detalhes: json("detalhes"),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("tarefas_atividades_tarefa_idx").on(table.tarefaId, table.createdAt),
    index("tarefas_atividades_usuario_idx").on(table.usuarioId),
    index("tarefas_atividades_tipo_idx").on(table.tipoAcao),
  ]
);

// ============================================================
// TAREFAS_CHECKLIST
// ============================================================

export const tarefasChecklist = mysqlTable(
  "tarefas_checklist",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    tarefaId: char("tarefa_id", { length: 36 })
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    texto: varchar("texto", { length: 500 }).notNull(),
    concluido: boolean("concluido").notNull().default(false),
    concluidoPor: char("concluido_por", { length: 36 }).references(() => users.id),
    concluidoEm: datetime("concluido_em"),
    ordem: int("ordem").notNull().default(0),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("tarefas_checklist_tarefa_idx").on(table.tarefaId),
    index("tarefas_checklist_ordem_idx").on(table.tarefaId, table.ordem),
  ]
);

// ============================================================
// COTACAO_NOTIFICACOES (feed de notificações de alterações/mensagens)
// ============================================================

export const cotacaoNotificacoes = mysqlTable(
  "cotacao_notificacoes",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    cotacaoId: char("cotacao_id", { length: 36 })
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    cotacaoNome: varchar("cotacao_nome", { length: 500 }).notNull(),
    autorId: char("autor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    autorNome: varchar("autor_nome", { length: 255 }),
    tipo: varchar("tipo", { length: 20 }).notNull(),
    texto: text("texto").notNull(),
    destinatarioId: char("destinatario_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
    lida: boolean("lida").notNull().default(false),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("cotacao_notif_cotacao_idx").on(table.cotacaoId),
    index("cotacao_notif_created_idx").on(table.createdAt),
    index("cotacao_notif_dest_idx").on(table.destinatarioId),
    index("cotacao_notif_lida_idx").on(table.lida),
  ]
);

// ============================================================
// COTACAO_MENSAGENS
// ============================================================

export const cotacaoMensagens = mysqlTable(
  "cotacao_mensagens",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    cotacaoId: char("cotacao_id", { length: 36 })
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    texto: text("texto").notNull(),
    imageUrl: text("image_url"),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => [
    index("cotacao_mensagens_cotacao_idx").on(table.cotacaoId),
    index("cotacao_mensagens_created_idx").on(table.createdAt),
  ]
);

// ============================================================
// GRUPOS DE USUARIOS
// ============================================================

export const gruposUsuarios = mysqlTable("grupos_usuarios", {
  id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  cor: varchar("cor", { length: 7 }).notNull().default("#03a4ed"),
  createdAt: datetime("created_at").notNull().default(sql`NOW()`),
  updatedAt: datetime("updated_at").notNull().default(sql`NOW()`).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("grupos_usuarios_nome_idx").on(table.nome),
]);

export const grupoMembros = mysqlTable("grupo_membros", {
  id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
  grupoId: char("grupo_id", { length: 36 }).notNull().references(() => gruposUsuarios.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: datetime("created_at").notNull().default(sql`NOW()`),
}, (table) => [
  uniqueIndex("grupo_membros_unique_idx").on(table.grupoId, table.userId),
  index("grupo_membros_grupo_idx").on(table.grupoId),
  index("grupo_membros_user_idx").on(table.userId),
]);

// ============================================================
// CHAT GLOBAL
// ============================================================

export const chatMensagens = mysqlTable(
  "chat_mensagens",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    fromUserId: char("from_user_id", { length: 36 }).notNull().references(() => users.id),
    toUserId: char("to_user_id", { length: 36 }).references(() => users.id),
    texto: text("texto").notNull(),
    createdAt: datetime("created_at").notNull().default(sql`NOW()`),
  },
  (table) => [
    index("chat_mensagens_from_idx").on(table.fromUserId),
    index("chat_mensagens_to_idx").on(table.toUserId),
    index("chat_mensagens_created_idx").on(table.createdAt),
  ]
);

export const chatLeituras = mysqlTable(
  "chat_leituras",
  {
    id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
    mensagemId: char("mensagem_id", { length: 36 }).notNull().references(() => chatMensagens.id, { onDelete: "cascade" }),
    userId: char("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    lidaEm: datetime("lida_em").notNull().default(sql`NOW()`),
  },
  (table) => [
    uniqueIndex("chat_leituras_unique").on(table.mensagemId, table.userId),
    index("chat_leituras_user_idx").on(table.userId),
  ]
);

// ============================================================
// REGRAS DE AUDITORIA
// ============================================================

export const regrasAuditoria = mysqlTable("regras_auditoria", {
  id: char("id", { length: 36 }).primaryKey().$defaultFn(genUUID),
  nome: varchar("nome", { length: 100 }).notNull(),
  comando: varchar("comando", { length: 50 }).notNull(),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  descricao: varchar("descricao", { length: 200 }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: datetime("created_at").notNull().default(sql`NOW()`),
});

// ============================================================
// CO-RESPONSAVEIS (N:N) — Story PRD-016
// ============================================================

export const cotacaoResponsaveis = mysqlTable(
  "cotacao_responsaveis",
  {
    cotacaoId: char("cotacao_id", { length: 36 }).notNull(),
    userId: char("user_id", { length: 36 }).notNull(),
    createdAt: datetime("created_at").notNull().default(sql`NOW()`),
  },
  (table) => [
    uniqueIndex("cotacao_responsaveis_pk").on(table.cotacaoId, table.userId),
    index("cotacao_responsaveis_user_idx").on(table.userId),
  ]
);

export const tarefaResponsaveis = mysqlTable(
  "tarefa_responsaveis",
  {
    tarefaId: char("tarefa_id", { length: 36 }).notNull(),
    userId: char("user_id", { length: 36 }).notNull(),
    createdAt: datetime("created_at").notNull().default(sql`NOW()`),
  },
  (table) => [
    uniqueIndex("tarefa_responsaveis_pk").on(table.tarefaId, table.userId),
    index("tarefa_responsaveis_user_idx").on(table.userId),
  ]
);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  cotacoes: many(cotacoes),
  metas: many(metas),
  tarefasCotador: many(tarefas, { relationName: "tarefasCotador" }),
  tarefasCriador: many(tarefas, { relationName: "tarefasCriador" }),
  briefings: many(tarefasBriefings),
  anexos: many(tarefasAnexos),
  atividades: many(tarefasAtividades),
}));

export const cotacoesRelations = relations(cotacoes, ({ one, many }) => ({
  assignee: one(users, {
    fields: [cotacoes.assigneeId],
    references: [users.id],
  }),
  docs: many(cotacaoDocs),
  history: many(cotacaoHistory),
  mensagens: many(cotacaoMensagens),
}));

export const cotacaoMensagensRelations = relations(cotacaoMensagens, ({ one }) => ({
  cotacao: one(cotacoes, {
    fields: [cotacaoMensagens.cotacaoId],
    references: [cotacoes.id],
  }),
  user: one(users, {
    fields: [cotacaoMensagens.userId],
    references: [users.id],
  }),
}));

export const cotacaoDocsRelations = relations(cotacaoDocs, ({ one }) => ({
  cotacao: one(cotacoes, {
    fields: [cotacaoDocs.cotacaoId],
    references: [cotacoes.id],
  }),
  uploader: one(users, {
    fields: [cotacaoDocs.uploadedBy],
    references: [users.id],
  }),
}));

export const metasRelations = relations(metas, ({ one }) => ({
  user: one(users, {
    fields: [metas.userId],
    references: [users.id],
  }),
  grupo: one(gruposUsuarios, {
    fields: [metas.grupoId],
    references: [gruposUsuarios.id],
  }),
}));

export const cotacaoHistoryRelations = relations(
  cotacaoHistory,
  ({ one }) => ({
    cotacao: one(cotacoes, {
      fields: [cotacaoHistory.cotacaoId],
      references: [cotacoes.id],
    }),
    user: one(users, {
      fields: [cotacaoHistory.userId],
      references: [users.id],
    }),
  })
);

export const tarefasRelations = relations(tarefas, ({ one, many }) => ({
  cotador: one(users, {
    fields: [tarefas.cotadorId],
    references: [users.id],
    relationName: "tarefasCotador",
  }),
  criador: one(users, {
    fields: [tarefas.criadorId],
    references: [users.id],
    relationName: "tarefasCriador",
  }),
  briefings: many(tarefasBriefings),
  anexos: many(tarefasAnexos),
  atividades: many(tarefasAtividades),
  checklist: many(tarefasChecklist),
}));

export const tarefasChecklistRelations = relations(tarefasChecklist, ({ one }) => ({
  tarefa: one(tarefas, {
    fields: [tarefasChecklist.tarefaId],
    references: [tarefas.id],
  }),
  concluidoPorUser: one(users, {
    fields: [tarefasChecklist.concluidoPor],
    references: [users.id],
  }),
}));

export const tarefasBriefingsRelations = relations(tarefasBriefings, ({ one }) => ({
  tarefa: one(tarefas, {
    fields: [tarefasBriefings.tarefaId],
    references: [tarefas.id],
  }),
  usuario: one(users, {
    fields: [tarefasBriefings.usuarioId],
    references: [users.id],
  }),
}));

export const tarefasAnexosRelations = relations(tarefasAnexos, ({ one }) => ({
  tarefa: one(tarefas, {
    fields: [tarefasAnexos.tarefaId],
    references: [tarefas.id],
  }),
  usuario: one(users, {
    fields: [tarefasAnexos.usuarioId],
    references: [users.id],
  }),
}));

export const tarefasAtividadesRelations = relations(tarefasAtividades, ({ one }) => ({
  tarefa: one(tarefas, {
    fields: [tarefasAtividades.tarefaId],
    references: [tarefas.id],
  }),
  usuario: one(users, {
    fields: [tarefasAtividades.usuarioId],
    references: [users.id],
  }),
}));

export const gruposUsuariosRelations = relations(gruposUsuarios, ({ many }) => ({
  membros: many(grupoMembros),
}));

export const grupoMembrosRelations = relations(grupoMembros, ({ one }) => ({
  grupo: one(gruposUsuarios, { fields: [grupoMembros.grupoId], references: [gruposUsuarios.id] }),
  user: one(users, { fields: [grupoMembros.userId], references: [users.id] }),
}));
