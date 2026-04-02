CREATE TABLE "tarefas_briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"briefing" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotacoes" ALTER COLUMN "comissao" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tarefas_briefings" ADD CONSTRAINT "tarefas_briefings_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas_briefings" ADD CONSTRAINT "tarefas_briefings_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefas_briefings_tarefa_idx" ON "tarefas_briefings" USING btree ("tarefa_id");--> statement-breakpoint
CREATE INDEX "tarefas_briefings_created_idx" ON "tarefas_briefings" USING btree ("created_at");