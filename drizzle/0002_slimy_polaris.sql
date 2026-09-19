CREATE TABLE "bot_pending" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"step" text DEFAULT 'kind' NOT NULL,
	"merchant" text,
	"amount_idr" numeric(20, 2) DEFAULT '0' NOT NULL,
	"date" date,
	"kind" text,
	"account_id" uuid,
	"category" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "bot_pending" ADD CONSTRAINT "bot_pending_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_telegram_chat_id_unique" UNIQUE("telegram_chat_id");