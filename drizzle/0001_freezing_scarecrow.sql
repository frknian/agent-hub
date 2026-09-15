CREATE TYPE "public"."agent_role" AS ENUM('primary', 'reviewer', 'fallback', 'premium');--> statement-breakpoint
CREATE TYPE "public"."agent_system_mode" AS ENUM('preset', 'custom');--> statement-breakpoint
CREATE TYPE "public"."approval_mode" AS ENUM('manual', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('untested', 'connected', 'error');--> statement-breakpoint
CREATE TYPE "public"."provider_type" AS ENUM('qwen', 'kimi', 'openai');--> statement-breakpoint
CREATE TABLE "agent_role_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid NOT NULL,
	"role" "agent_role" NOT NULL,
	"provider" "provider_type" NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "agent_system_mode" DEFAULT 'preset' NOT NULL,
	"preset_id" text,
	"premium_approval" "approval_mode" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "provider_type" NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"key_hint" text NOT NULL,
	"status" "credential_status" DEFAULT 'untested' NOT NULL,
	"last_tested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_role_configs" ADD CONSTRAINT "agent_role_configs_system_id_agent_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."agent_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_systems" ADD CONSTRAINT "agent_systems_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_role_configs_system_role_idx" ON "agent_role_configs" USING btree ("system_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_systems_user_idx" ON "agent_systems" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_credentials_user_idx" ON "provider_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_user_provider_idx" ON "provider_credentials" USING btree ("user_id","provider");