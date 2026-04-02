CREATE TYPE "public"."tarefa_status" AS ENUM('Pendente', 'Em Andamento', 'Concluída', 'Cancelada');--> statement-breakpoint
CREATE TABLE "comissao_tabela" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seguradora" varchar(255) NOT NULL,
	"produto" varchar(255),
	"percentual" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text,
	"data_vencimento" timestamp with time zone,
	"status" "tarefa_status" DEFAULT 'Pendente' NOT NULL,
	"cotador_id" uuid NOT NULL,
	"criador_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotacoes" ALTER COLUMN "status" SET DEFAULT 'não iniciado';--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_cotador_id_users_id_fk" FOREIGN KEY ("cotador_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criador_id_users_id_fk" FOREIGN KEY ("criador_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comissao_tabela_seguradora_idx" ON "comissao_tabela" USING btree ("seguradora");--> statement-breakpoint
CREATE INDEX "tarefas_status_idx" ON "tarefas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tarefas_cotador_idx" ON "tarefas" USING btree ("cotador_id");--> statement-breakpoint
CREATE INDEX "tarefas_criador_idx" ON "tarefas" USING btree ("criador_id");--> statement-breakpoint
CREATE INDEX "tarefas_data_vencimento_idx" ON "tarefas" USING btree ("data_vencimento");