CREATE TYPE "public"."atividade_tipo" AS ENUM('CRIADA', 'EDITADA', 'STATUS_ALTERADO', 'BRIEFING_ADICIONADO', 'ANEXO_ADICIONADO', 'ANEXO_REMOVIDO');--> statement-breakpoint
CREATE TABLE "situacao_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(100) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "situacao_config_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "tarefas_anexos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"nome_arquivo" varchar(255) NOT NULL,
	"url_blob" text NOT NULL,
	"tamanho" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas_atividades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo_acao" "atividade_tipo" NOT NULL,
	"detalhes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"texto" varchar(500) NOT NULL,
	"concluido" boolean DEFAULT false NOT NULL,
	"concluido_por" uuid,
	"concluido_em" timestamp with time zone,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotacoes" ALTER COLUMN "mes_referencia" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "tarefas" ADD COLUMN "visualizada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tarefas" ADD COLUMN "iniciada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tarefas" ADD COLUMN "concluida_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tarefas_anexos" ADD CONSTRAINT "tarefas_anexos_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas_anexos" ADD CONSTRAINT "tarefas_anexos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas_atividades" ADD CONSTRAINT "tarefas_atividades_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas_atividades" ADD CONSTRAINT "tarefas_atividades_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas_checklist" ADD CONSTRAINT "tarefas_checklist_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas_checklist" ADD CONSTRAINT "tarefas_checklist_concluido_por_users_id_fk" FOREIGN KEY ("concluido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefas_anexos_tarefa_idx" ON "tarefas_anexos" USING btree ("tarefa_id");--> statement-breakpoint
CREATE INDEX "tarefas_anexos_usuario_idx" ON "tarefas_anexos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tarefas_anexos_created_idx" ON "tarefas_anexos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tarefas_atividades_tarefa_idx" ON "tarefas_atividades" USING btree ("tarefa_id","created_at");--> statement-breakpoint
CREATE INDEX "tarefas_atividades_usuario_idx" ON "tarefas_atividades" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tarefas_atividades_tipo_idx" ON "tarefas_atividades" USING btree ("tipo_acao");--> statement-breakpoint
CREATE INDEX "tarefas_checklist_tarefa_idx" ON "tarefas_checklist" USING btree ("tarefa_id");--> statement-breakpoint
CREATE INDEX "tarefas_checklist_ordem_idx" ON "tarefas_checklist" USING btree ("tarefa_id","ordem");