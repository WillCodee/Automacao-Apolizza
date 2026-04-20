CREATE TABLE `chat_leituras` (
	`id` char(36) NOT NULL,
	`mensagem_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`lida_em` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `chat_leituras_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_leituras_unique` UNIQUE(`mensagem_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `chat_mensagens` (
	`id` char(36) NOT NULL,
	`from_user_id` char(36) NOT NULL,
	`to_user_id` char(36),
	`texto` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `chat_mensagens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comissao_tabela` (
	`id` char(36) NOT NULL,
	`seguradora` varchar(255) NOT NULL,
	`produto` varchar(255),
	`percentual` decimal(5,2) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	`updated_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `comissao_tabela_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacao_docs` (
	`id` char(36) NOT NULL,
	`cotacao_id` char(36) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` text NOT NULL,
	`file_size` int,
	`mime_type` varchar(100),
	`uploaded_by` char(36),
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `cotacao_docs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacao_history` (
	`id` char(36) NOT NULL,
	`cotacao_id` char(36) NOT NULL,
	`user_id` char(36),
	`field_name` varchar(100) NOT NULL,
	`old_value` text,
	`new_value` text,
	`changed_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `cotacao_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacao_mensagens` (
	`id` char(36) NOT NULL,
	`cotacao_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`texto` text NOT NULL,
	`image_url` text,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `cotacao_mensagens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacao_notificacoes` (
	`id` char(36) NOT NULL,
	`cotacao_id` char(36) NOT NULL,
	`cotacao_nome` varchar(500) NOT NULL,
	`autor_id` char(36),
	`autor_nome` varchar(255),
	`tipo` varchar(20) NOT NULL,
	`texto` text NOT NULL,
	`destinatario_id` char(36),
	`lida` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `cotacao_notificacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacoes` (
	`id` char(36) NOT NULL,
	`clickup_id` varchar(20),
	`name` varchar(500) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'não iniciado',
	`priority` varchar(20) DEFAULT 'normal',
	`due_date` datetime,
	`assignee_id` char(36),
	`tipo_cliente` varchar(50),
	`contato_cliente` varchar(50),
	`seguradora` varchar(255),
	`produto` varchar(255),
	`situacao` varchar(50),
	`indicacao` varchar(255),
	`inicio_vigencia` date,
	`fim_vigencia` date,
	`primeiro_pagamento` date,
	`parcelado_em` int,
	`valor_parcelado` decimal(12,2),
	`premio_sem_iof` decimal(12,2),
	`comissao` text,
	`a_receber` decimal(12,2),
	`valor_perda` decimal(12,2),
	`proxima_tratativa` date,
	`observacao` text,
	`mes_referencia` varchar(10),
	`ano_referencia` int,
	`comissao_parcelada` json,
	`tags` json,
	`is_renovacao` boolean NOT NULL DEFAULT false,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	`updated_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `cotacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grupo_membros` (
	`id` char(36) NOT NULL,
	`grupo_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `grupo_membros_id` PRIMARY KEY(`id`),
	CONSTRAINT `grupo_membros_unique_idx` UNIQUE(`grupo_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `grupos_usuarios` (
	`id` char(36) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`descricao` text,
	`cor` varchar(7) NOT NULL DEFAULT '#03a4ed',
	`created_at` datetime NOT NULL DEFAULT NOW(),
	`updated_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `grupos_usuarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `grupos_usuarios_nome_idx` UNIQUE(`nome`)
);
--> statement-breakpoint
CREATE TABLE `metas` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`ano` int NOT NULL,
	`mes` int NOT NULL,
	`meta_valor` decimal(12,2),
	`meta_qtd_cotacoes` int,
	`meta_renovacoes` int,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	`updated_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `metas_id` PRIMARY KEY(`id`),
	CONSTRAINT `metas_user_ano_mes_idx` UNIQUE(`user_id`,`ano`,`mes`)
);
--> statement-breakpoint
CREATE TABLE `regras_auditoria` (
	`id` char(36) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`comando` varchar(50) NOT NULL,
	`tipo` varchar(50) NOT NULL,
	`descricao` varchar(200),
	`ativo` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `regras_auditoria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `situacao_config` (
	`id` char(36) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`default_cotador_id` char(36),
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `situacao_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `situacao_config_nome_unique` UNIQUE(`nome`)
);
--> statement-breakpoint
CREATE TABLE `status_config` (
	`id` char(36) NOT NULL,
	`status_name` varchar(50) NOT NULL,
	`display_label` varchar(100) NOT NULL,
	`color` varchar(7) NOT NULL,
	`icon` varchar(10),
	`order_index` int NOT NULL DEFAULT 0,
	`required_fields` json,
	`is_terminal` boolean NOT NULL DEFAULT false,
	CONSTRAINT `status_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `status_config_status_name_unique` UNIQUE(`status_name`)
);
--> statement-breakpoint
CREATE TABLE `tarefas` (
	`id` char(36) NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`descricao` text,
	`data_vencimento` datetime,
	`tarefa_status` enum('Pendente','Em Andamento','Concluída','Cancelada') NOT NULL DEFAULT 'Pendente',
	`cotador_id` char(36) NOT NULL,
	`criador_id` char(36) NOT NULL,
	`visualizada_em` datetime,
	`iniciada_em` datetime,
	`concluida_em` datetime,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	`updated_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `tarefas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarefas_anexos` (
	`id` char(36) NOT NULL,
	`tarefa_id` char(36) NOT NULL,
	`usuario_id` char(36) NOT NULL,
	`nome_arquivo` varchar(255) NOT NULL,
	`url_blob` text NOT NULL,
	`tamanho` int NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `tarefas_anexos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarefas_atividades` (
	`id` char(36) NOT NULL,
	`tarefa_id` char(36) NOT NULL,
	`usuario_id` char(36) NOT NULL,
	`tipo_acao` enum('CRIADA','EDITADA','STATUS_ALTERADO','BRIEFING_ADICIONADO','ANEXO_ADICIONADO','ANEXO_REMOVIDO') NOT NULL,
	`detalhes` json,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `tarefas_atividades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarefas_briefings` (
	`id` char(36) NOT NULL,
	`tarefa_id` char(36) NOT NULL,
	`usuario_id` char(36) NOT NULL,
	`briefing` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `tarefas_briefings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarefas_checklist` (
	`id` char(36) NOT NULL,
	`tarefa_id` char(36) NOT NULL,
	`texto` varchar(500) NOT NULL,
	`concluido` boolean NOT NULL DEFAULT false,
	`concluido_por` char(36),
	`concluido_em` datetime,
	`ordem` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `tarefas_checklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`password_hash` text NOT NULL,
	`role` enum('admin','cotador','proprietario') NOT NULL DEFAULT 'cotador',
	`photo_url` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT NOW(),
	`updated_at` datetime NOT NULL DEFAULT NOW(),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_idx` UNIQUE(`email`),
	CONSTRAINT `users_username_idx` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `chat_leituras` ADD CONSTRAINT `chat_leituras_mensagem_id_chat_mensagens_id_fk` FOREIGN KEY (`mensagem_id`) REFERENCES `chat_mensagens`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_leituras` ADD CONSTRAINT `chat_leituras_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_mensagens` ADD CONSTRAINT `chat_mensagens_from_user_id_users_id_fk` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_mensagens` ADD CONSTRAINT `chat_mensagens_to_user_id_users_id_fk` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_docs` ADD CONSTRAINT `cotacao_docs_cotacao_id_cotacoes_id_fk` FOREIGN KEY (`cotacao_id`) REFERENCES `cotacoes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_docs` ADD CONSTRAINT `cotacao_docs_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_history` ADD CONSTRAINT `cotacao_history_cotacao_id_cotacoes_id_fk` FOREIGN KEY (`cotacao_id`) REFERENCES `cotacoes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_history` ADD CONSTRAINT `cotacao_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_mensagens` ADD CONSTRAINT `cotacao_mensagens_cotacao_id_cotacoes_id_fk` FOREIGN KEY (`cotacao_id`) REFERENCES `cotacoes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_mensagens` ADD CONSTRAINT `cotacao_mensagens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_notificacoes` ADD CONSTRAINT `cotacao_notificacoes_cotacao_id_cotacoes_id_fk` FOREIGN KEY (`cotacao_id`) REFERENCES `cotacoes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_notificacoes` ADD CONSTRAINT `cotacao_notificacoes_autor_id_users_id_fk` FOREIGN KEY (`autor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacao_notificacoes` ADD CONSTRAINT `cotacao_notificacoes_destinatario_id_users_id_fk` FOREIGN KEY (`destinatario_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cotacoes` ADD CONSTRAINT `cotacoes_assignee_id_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grupo_membros` ADD CONSTRAINT `grupo_membros_grupo_id_grupos_usuarios_id_fk` FOREIGN KEY (`grupo_id`) REFERENCES `grupos_usuarios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grupo_membros` ADD CONSTRAINT `grupo_membros_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `metas` ADD CONSTRAINT `metas_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `situacao_config` ADD CONSTRAINT `situacao_config_default_cotador_id_users_id_fk` FOREIGN KEY (`default_cotador_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_cotador_id_users_id_fk` FOREIGN KEY (`cotador_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_criador_id_users_id_fk` FOREIGN KEY (`criador_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_anexos` ADD CONSTRAINT `tarefas_anexos_tarefa_id_tarefas_id_fk` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_anexos` ADD CONSTRAINT `tarefas_anexos_usuario_id_users_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_atividades` ADD CONSTRAINT `tarefas_atividades_tarefa_id_tarefas_id_fk` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_atividades` ADD CONSTRAINT `tarefas_atividades_usuario_id_users_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_briefings` ADD CONSTRAINT `tarefas_briefings_tarefa_id_tarefas_id_fk` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_briefings` ADD CONSTRAINT `tarefas_briefings_usuario_id_users_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_checklist` ADD CONSTRAINT `tarefas_checklist_tarefa_id_tarefas_id_fk` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tarefas_checklist` ADD CONSTRAINT `tarefas_checklist_concluido_por_users_id_fk` FOREIGN KEY (`concluido_por`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chat_leituras_user_idx` ON `chat_leituras` (`user_id`);--> statement-breakpoint
CREATE INDEX `chat_mensagens_from_idx` ON `chat_mensagens` (`from_user_id`);--> statement-breakpoint
CREATE INDEX `chat_mensagens_to_idx` ON `chat_mensagens` (`to_user_id`);--> statement-breakpoint
CREATE INDEX `chat_mensagens_created_idx` ON `chat_mensagens` (`created_at`);--> statement-breakpoint
CREATE INDEX `comissao_tabela_seguradora_idx` ON `comissao_tabela` (`seguradora`);--> statement-breakpoint
CREATE INDEX `cotacao_docs_cotacao_idx` ON `cotacao_docs` (`cotacao_id`);--> statement-breakpoint
CREATE INDEX `cotacao_history_cotacao_idx` ON `cotacao_history` (`cotacao_id`);--> statement-breakpoint
CREATE INDEX `cotacao_history_changed_at_idx` ON `cotacao_history` (`changed_at`);--> statement-breakpoint
CREATE INDEX `cotacao_mensagens_cotacao_idx` ON `cotacao_mensagens` (`cotacao_id`);--> statement-breakpoint
CREATE INDEX `cotacao_mensagens_created_idx` ON `cotacao_mensagens` (`created_at`);--> statement-breakpoint
CREATE INDEX `cotacao_notif_cotacao_idx` ON `cotacao_notificacoes` (`cotacao_id`);--> statement-breakpoint
CREATE INDEX `cotacao_notif_created_idx` ON `cotacao_notificacoes` (`created_at`);--> statement-breakpoint
CREATE INDEX `cotacao_notif_dest_idx` ON `cotacao_notificacoes` (`destinatario_id`);--> statement-breakpoint
CREATE INDEX `cotacao_notif_lida_idx` ON `cotacao_notificacoes` (`lida`);--> statement-breakpoint
CREATE INDEX `cotacoes_status_idx` ON `cotacoes` (`status`);--> statement-breakpoint
CREATE INDEX `cotacoes_due_date_idx` ON `cotacoes` (`due_date`);--> statement-breakpoint
CREATE INDEX `cotacoes_assignee_idx` ON `cotacoes` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `cotacoes_ano_idx` ON `cotacoes` (`ano_referencia`);--> statement-breakpoint
CREATE INDEX `cotacoes_clickup_id_idx` ON `cotacoes` (`clickup_id`);--> statement-breakpoint
CREATE INDEX `cotacoes_deleted_at_idx` ON `cotacoes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `grupo_membros_grupo_idx` ON `grupo_membros` (`grupo_id`);--> statement-breakpoint
CREATE INDEX `grupo_membros_user_idx` ON `grupo_membros` (`user_id`);--> statement-breakpoint
CREATE INDEX `tarefas_status_idx` ON `tarefas` (`tarefa_status`);--> statement-breakpoint
CREATE INDEX `tarefas_cotador_idx` ON `tarefas` (`cotador_id`);--> statement-breakpoint
CREATE INDEX `tarefas_criador_idx` ON `tarefas` (`criador_id`);--> statement-breakpoint
CREATE INDEX `tarefas_data_vencimento_idx` ON `tarefas` (`data_vencimento`);--> statement-breakpoint
CREATE INDEX `tarefas_anexos_tarefa_idx` ON `tarefas_anexos` (`tarefa_id`);--> statement-breakpoint
CREATE INDEX `tarefas_anexos_usuario_idx` ON `tarefas_anexos` (`usuario_id`);--> statement-breakpoint
CREATE INDEX `tarefas_anexos_created_idx` ON `tarefas_anexos` (`created_at`);--> statement-breakpoint
CREATE INDEX `tarefas_atividades_tarefa_idx` ON `tarefas_atividades` (`tarefa_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tarefas_atividades_usuario_idx` ON `tarefas_atividades` (`usuario_id`);--> statement-breakpoint
CREATE INDEX `tarefas_atividades_tipo_idx` ON `tarefas_atividades` (`tipo_acao`);--> statement-breakpoint
CREATE INDEX `tarefas_briefings_tarefa_idx` ON `tarefas_briefings` (`tarefa_id`);--> statement-breakpoint
CREATE INDEX `tarefas_briefings_created_idx` ON `tarefas_briefings` (`created_at`);--> statement-breakpoint
CREATE INDEX `tarefas_checklist_tarefa_idx` ON `tarefas_checklist` (`tarefa_id`);--> statement-breakpoint
CREATE INDEX `tarefas_checklist_ordem_idx` ON `tarefas_checklist` (`tarefa_id`,`ordem`);