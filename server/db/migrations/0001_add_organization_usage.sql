CREATE TABLE "organization_usage" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_usage" ADD CONSTRAINT "organization_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "credit_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"action" text NOT NULL,
	"credits_cost" integer NOT NULL,
	"description" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_activity" ADD CONSTRAINT "credit_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "credit_activity_org_id_idx" ON "credit_activity" ("organization_id");
--> statement-breakpoint
CREATE INDEX "credit_activity_created_at_idx" ON "credit_activity" ("created_at");
