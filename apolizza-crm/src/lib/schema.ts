import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  date,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", ["admin", "cotador"]);

export const tarefaStatusEnum = pgEnum("tarefa_status", [
  "Pendente",
  "Em Andamento",
  "Concluída",
  "Cancelada",
]);

export const atividadeTipoEnum = pgEnum("atividade_tipo", [
  "CRIADA",
  "EDITADA",
  "STATUS_ALTERADO",
  "BRIEFING_ADICIONADO",
  "ANEXO_ADICIONADO",
  "ANEXO_REMOVIDO",
]);

// ============================================================
// USERS
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("cotador"),
    photoUrl: text("photo_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
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

export const cotacoes = pgTable(
  "cotacoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clickupId: varchar("clickup_id", { length: 20 }),
    name: varchar("name", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("não iniciado"),
    priority: varchar("priority", { length: 20 }).default("normal"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    assigneeId: uuid("assignee_id").references(() => users.id),

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
    parceladoEm: integer("parcelado_em"),
    valorParcelado: decimal("valor_parcelado", { precision: 12, scale: 2 }),
    premioSemIof: decimal("premio_sem_iof", { precision: 12, scale: 2 }),
    comissao: text("comissao"), // Alterado de decimal para text (fórmulas complexas)
    aReceber: decimal("a_receber", { precision: 12, scale: 2 }),
    valorPerda: decimal("valor_perda", { precision: 12, scale: 2 }),
    proximaTratativa: date("proxima_tratativa"),
    observacao: text("observacao"),
    mesReferencia: varchar("mes_referencia", { length: 10 }), // Alterado de 3 para 10 (ex: "MAIO", "SETEMBRO")
    anoReferencia: integer("ano_referencia"),

    comissaoParcelada: jsonb("comissao_parcelada").$type<{ parcelas: number; percentuais: number[] } | null>(),
    tags: jsonb("tags").$type<string[]>().default([]),
    isRenovacao: boolean("is_renovacao").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cotacoes_status_idx").on(table.status),
    index("cotacoes_due_date_idx").on(table.dueDate),
    index("cotacoes_assignee_idx").on(table.assigneeId),
    index("cotacoes_ano_idx").on(table.anoReferencia),
    index("cotacoes_clickup_id_idx").on(table.clickupId),
    index("cotacoes_deleted_at_idx").on(table.deletedAt),
  ]
);

// ============================================================
// COTACAO_DOCS
// ============================================================

export const cotacaoDocs = pgTable(
  "cotacao_docs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cotacaoId: uuid("cotacao_id")
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cotacao_docs_cotacao_idx").on(table.cotacaoId)]
);

// ============================================================
// METAS
// ============================================================

export const metas = pgTable(
  "metas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    ano: integer("ano").notNull(),
    mes: integer("mes").notNull(),
    metaValor: decimal("meta_valor", { precision: 12, scale: 2 }),
    metaQtdCotacoes: integer("meta_qtd_cotacoes"),
    metaRenovacoes: integer("meta_renovacoes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("metas_user_ano_mes_idx").on(
      table.userId,
      table.ano,
      table.mes
    ),
  ]
);

// ============================================================
// COTACAO_HISTORY (Audit Trail)
// ============================================================

export const cotacaoHistory = pgTable(
  "cotacao_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cotacaoId: uuid("cotacao_id")
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    fieldName: varchar("field_name", { length: 100 }).notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cotacao_history_cotacao_idx").on(table.cotacaoId),
    index("cotacao_history_changed_at_idx").on(table.changedAt),
  ]
);

// ============================================================
// STATUS_CONFIG
// ============================================================

export const statusConfig = pgTable("status_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  statusName: varchar("status_name", { length: 50 }).notNull().unique(),
  displayLabel: varchar("display_label", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  icon: varchar("icon", { length: 10 }),
  orderIndex: integer("order_index").notNull().default(0),
  requiredFields: jsonb("required_fields").$type<string[]>().default([]),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

// ============================================================
// SITUACAO_CONFIG
// ============================================================

export const situacaoConfig = pgTable("situacao_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull().unique(),
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  defaultCotadorId: uuid("default_cotador_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// COMISSAO_TABELA
// ============================================================

export const comissaoTabela = pgTable(
  "comissao_tabela",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seguradora: varchar("seguradora", { length: 255 }).notNull(),
    produto: varchar("produto", { length: 255 }),
    percentual: decimal("percentual", { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("comissao_tabela_seguradora_idx").on(table.seguradora),
  ]
);

// ============================================================
// TAREFAS (EPIC-003: Controle de Tarefas Diárias)
// ============================================================

export const tarefas = pgTable(
  "tarefas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descricao: text("descricao"),
    dataVencimento: timestamp("data_vencimento", { withTimezone: true }),
    status: tarefaStatusEnum("status").notNull().default("Pendente"),
    cotadorId: uuid("cotador_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    criadorId: uuid("criador_id")
      .notNull()
      .references(() => users.id),
    visualizadaEm: timestamp("visualizada_em", { withTimezone: true }),
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true }),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
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

export const tarefasBriefings = pgTable(
  "tarefas_briefings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => users.id),
    briefing: text("briefing").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tarefas_briefings_tarefa_idx").on(table.tarefaId),
    index("tarefas_briefings_created_idx").on(table.createdAt),
  ]
);

// ============================================================
// TAREFAS_ANEXOS (EPIC-003: Story 13.6)
// ============================================================

export const tarefasAnexos = pgTable(
  "tarefas_anexos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => users.id),
    nomeArquivo: varchar("nome_arquivo", { length: 255 }).notNull(),
    urlBlob: text("url_blob").notNull(),
    tamanho: integer("tamanho").notNull(), // em bytes
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const tarefasAtividades = pgTable(
  "tarefas_atividades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => users.id),
    tipoAcao: atividadeTipoEnum("tipo_acao").notNull(),
    detalhes: jsonb("detalhes"), // {campo?: string, valorAnterior?: any, valorNovo?: any, ...}
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const tarefasChecklist = pgTable(
  "tarefas_checklist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    texto: varchar("texto", { length: 500 }).notNull(),
    concluido: boolean("concluido").notNull().default(false),
    concluidoPor: uuid("concluido_por").references(() => users.id),
    concluidoEm: timestamp("concluido_em", { withTimezone: true }),
    ordem: integer("ordem").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tarefas_checklist_tarefa_idx").on(table.tarefaId),
    index("tarefas_checklist_ordem_idx").on(table.tarefaId, table.ordem),
  ]
);

// ============================================================
// COTACAO_MENSAGENS
// ============================================================

export const cotacaoMensagens = pgTable(
  "cotacao_mensagens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cotacaoId: uuid("cotacao_id")
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    texto: text("texto").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cotacao_mensagens_cotacao_idx").on(table.cotacaoId),
    index("cotacao_mensagens_created_idx").on(table.createdAt),
  ]
);

// ============================================================
// GRUPOS DE USUARIOS
// ============================================================

export const gruposUsuarios = pgTable("grupos_usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  cor: varchar("cor", { length: 7 }).notNull().default("#03a4ed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("grupos_usuarios_nome_idx").on(table.nome),
]);

export const grupoMembros = pgTable("grupo_membros", {
  id: uuid("id").defaultRandom().primaryKey(),
  grupoId: uuid("grupo_id").notNull().references(() => gruposUsuarios.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("grupo_membros_unique_idx").on(table.grupoId, table.userId),
  index("grupo_membros_grupo_idx").on(table.grupoId),
  index("grupo_membros_user_idx").on(table.userId),
]);

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
