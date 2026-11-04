CREATE TABLE "task_completions" (
	"task_id" integer NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_completions_task_id_date_pk" PRIMARY KEY("task_id","date")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"date" date,
	"recurring_days" smallint[],
	"time" char(5),
	"note" text,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tasks_text_check" CHECK (char_length("tasks"."text") between 1 and 300),
	CONSTRAINT "tasks_note_check" CHECK (char_length("tasks"."note") between 1 and 1000),
	CONSTRAINT "tasks_time_check" CHECK ("tasks"."time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "tasks_schedule_check" CHECK (("tasks"."date" is null) <> ("tasks"."recurring_days" is null)),
	CONSTRAINT "tasks_recurring_days_check" CHECK (cardinality("tasks"."recurring_days") between 1 and 7 and "tasks"."recurring_days" <@ array[0,1,2,3,4,5,6]::smallint[])
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_zone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_user_idx" ON "tasks" USING btree ("user_id") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_time_zone_check" CHECK (char_length("users"."time_zone") between 1 and 64);