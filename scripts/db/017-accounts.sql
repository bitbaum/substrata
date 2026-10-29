BEGIN;

-- Accounts (@bitbaum/accountkit): anyone can have a Substrata account with an
-- email and a password or a passkey, and turn on two-step codes. "Continue
-- with OrangeCat" stays one way in, no longer the only one.
--
-- The six tables match @bitbaum/accountkit/auth/schema, column for column, so
-- every product's account tables are the same. Re-runnable: IF NOT EXISTS on
-- every table and index, foreign keys declared inline (no $$ blocks).
-- test/accounts.test.ts applies this file twice to a real Postgres and signs
-- up against it, so a column that drifts from the package fails there, not at
-- someone's sign-in.
--
-- Additive only. Rows keyed on an OrangeCat actor id (desks, follows, saved AI
-- keys, SUBSTRATA_REVIEWER_ACTOR_IDS) keep working: lib/auth.ts maps a person
-- whose first way in was OrangeCat to that id.

CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'customer' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);

CREATE TABLE IF NOT EXISTS "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_account_uidx" ON "accounts" USING btree ("provider_id","account_id");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
CREATE INDEX IF NOT EXISTS "passkeys_user_id_idx" ON "passkeys" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "two_factors_user_id_idx" ON "two_factors" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "two_factors_secret_idx" ON "two_factors" USING btree ("secret");

COMMIT;
