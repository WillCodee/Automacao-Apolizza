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
    premioSemIof: decimal("premio_sem_iof", { precision: 12, scale: 2 }),
    comissao: decimal("comissao", { precision: 12, scale: 2 }),
    aReceber: decimal("a_receber", { precision: 12, scale: 2 }),
    valorPerda: decimal("valor_perda", { precision: 12, scale: 2 }),
    proximaTratativa: date("proxima_tratativa"),
    observacao: text("observacao"),
    mesReferencia: varchar("mes_referencia", { length: 3 }),
    anoReferencia: integer("ano_referencia"),

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
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  cotacoes: many(cotacoes),
  metas: many(metas),
  tarefasCotador: many(tarefas, { relationName: "tarefasCotador" }),
  tarefasCriador: many(tarefas, { relationName: "tarefasCriador" }),
}));

export const cotacoesRelations = relations(cotacoes, ({ one, many }) => ({
  assignee: one(users, {
    fields: [cotacoes.assigneeId],
    references: [users.id],
  }),
  docs: many(cotacaoDocs),
  history: many(cotacaoHistory),
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

export const tarefasRelations = relations(tarefas, ({ one }) => ({
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
}));
