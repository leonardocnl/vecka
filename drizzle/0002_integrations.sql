ALTER TABLE "tasks" ADD COLUMN "external_source" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_external_idx" ON "tasks" USING btree ("user_id","external_source","external_id") WHERE "tasks"."external_id" is not null;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_external_check" CHECK (("tasks"."external_source" is null) = ("tasks"."external_id" is null)
                and char_length("tasks"."external_source") between 1 and 64
                and char_length("tasks"."external_id") between 1 and 255);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_url_check" CHECK (char_length("tasks"."url") between 1 and 2048);