CREATE TYPE "public"."user_role" AS ENUM('admin', 'cotador');--> statement-breakpoint
CREATE TABLE "cotacao_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cotacao_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacao_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cotacao_id" uuid NOT NULL,
	"user_id" uuid,
	"field_name" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clickup_id" varchar(20),
	"name" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'nao iniciado' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"due_date" timestamp with time zone,
	"assignee_id" uuid,
	"tipo_cliente" varchar(50),
	"contato_cliente" varchar(50),
	"seguradora" varchar(255),
	"produto" varchar(255),
	"situacao" varchar(50),
	"indicacao" varchar(255),
	"inicio_vigencia" date,
	"fim_vigencia" date,
	"primeiro_pagamento" date,
	"parcelado_em" integer,
	"premio_sem_iof" numeric(12, 2),
	"comissao" numeric(12, 2),
	"a_receber" numeric(12, 2),
	"valor_perda" numeric(12, 2),
	"proxima_tratativa" date,
	"observacao" text,
	"mes_referencia" varchar(3),
	"ano_referencia" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_renovacao" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"meta_valor" numeric(12, 2),
	"meta_qtd_cotacoes" integer,
	"meta_renovacoes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status_name" varchar(50) NOT NULL,
	"display_label" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"icon" varchar(10),
	"order_index" integer DEFAULT 0 NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "status_config_status_name_unique" UNIQUE("status_name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'cotador' NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotacao_docs" ADD CONSTRAINT "cotacao_docs_cotacao_id_cotacoes_id_fk" FOREIGN KEY ("cotacao_id") REFERENCES "public"."cotacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_docs" ADD CONSTRAINT "cotacao_docs_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_history" ADD CONSTRAINT "cotacao_history_cotacao_id_cotacoes_id_fk" FOREIGN KEY ("cotacao_id") REFERENCES "public"."cotacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_history" ADD CONSTRAINT "cotacao_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacoes" ADD CONSTRAINT "cotacoes_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotacao_docs_cotacao_idx" ON "cotacao_docs" USING btree ("cotacao_id");--> statement-breakpoint
CREATE INDEX "cotacao_history_cotacao_idx" ON "cotacao_history" USING btree ("cotacao_id");--> statement-breakpoint
CREATE INDEX "cotacao_history_changed_at_idx" ON "cotacao_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "cotacoes_status_idx" ON "cotacoes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cotacoes_due_date_idx" ON "cotacoes" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "cotacoes_assignee_idx" ON "cotacoes" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "cotacoes_ano_idx" ON "cotacoes" USING btree ("ano_referencia");--> statement-breakpoint
CREATE INDEX "cotacoes_clickup_id_idx" ON "cotacoes" USING btree ("clickup_id");--> statement-breakpoint
CREATE INDEX "cotacoes_deleted_at_idx" ON "cotacoes" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "metas_user_ano_mes_idx" ON "metas" USING btree ("user_id","ano","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");