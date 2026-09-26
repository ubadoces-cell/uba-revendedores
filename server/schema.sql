BEGIN;

DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'Destino deve estar vazio; nenhuma alteracao aplicada'; END IF; END $$;

CREATE TABLE public.uba_database_identity (id integer PRIMARY KEY CHECK(id=1), application text NOT NULL CHECK(application='uba-revendedores'));
INSERT INTO public.uba_database_identity VALUES (1,'uba-revendedores');

CREATE TABLE public."accounts" (
 "id" text NOT NULL,
 "username" text NOT NULL,
 "password_hash" text NOT NULL,
 "password_salt" text NOT NULL,
 "role" text DEFAULT 'seller'::text NOT NULL,
 "vendor_id" text,
 "active" integer DEFAULT 1 NOT NULL,
 "created_at" text DEFAULT (CURRENT_TIMESTAMP)::text NOT NULL
);
CREATE TABLE public."sessions" (
 "id" text NOT NULL,
 "account_id" text NOT NULL,
 "token_hash" text NOT NULL,
 "expires_at" text NOT NULL,
 "created_at" text DEFAULT (CURRENT_TIMESTAMP)::text NOT NULL
);
CREATE TABLE public."reseller_customer_accounts" (
 "id" text NOT NULL,
 "name" text NOT NULL,
 "email" text DEFAULT ''::text NOT NULL,
 "email_norm" text DEFAULT ''::text NOT NULL,
 "phone" text DEFAULT ''::text NOT NULL,
 "phone_norm" text DEFAULT ''::text NOT NULL,
 "doc" text DEFAULT ''::text NOT NULL,
 "doc_norm" text DEFAULT ''::text NOT NULL,
 "store" text DEFAULT ''::text NOT NULL,
 "purpose" text DEFAULT 'commerce'::text NOT NULL,
 "status" text DEFAULT 'pending'::text NOT NULL,
 "password_hash" text NOT NULL,
 "password_salt" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."reseller_customer_sessions" (
 "id" text NOT NULL,
 "account_id" text NOT NULL,
 "token_hash" text NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."reseller_orders" (
 "id" text NOT NULL,
 "code" text NOT NULL,
 "status" text NOT NULL,
 "customer_account_id" text,
 "customer_name" text NOT NULL,
 "customer_email" text DEFAULT ''::text NOT NULL,
 "customer_phone" text DEFAULT ''::text NOT NULL,
 "customer_store" text DEFAULT ''::text NOT NULL,
 "customer_doc" text DEFAULT ''::text NOT NULL,
 "purpose" text NOT NULL,
 "delivery" jsonb NOT NULL,
 "items" jsonb NOT NULL,
 "units" integer NOT NULL,
 "total_cents" integer NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "payment_status" text DEFAULT 'aguardando_pagamento'::text NOT NULL,
 "asaas_customer_id" text,
 "asaas_payment_id" text,
 "pix_payload" text,
 "pix_encoded_image" text,
 "pix_expiration_at" timestamp with time zone,
 "public_token_hash" text,
 "paid_at" timestamp with time zone,
 "stock_applied" boolean DEFAULT false NOT NULL,
 "production_allocation" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "customer_note" text DEFAULT ''::text NOT NULL
);
CREATE TABLE public."shared_stock_state" (
 "id" integer NOT NULL,
 "data" text NOT NULL,
 "updated_at" text NOT NULL
);
CREATE TABLE public.asaas_webhook_events (event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,payment_id TEXT,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE public.reseller_integration_identity(id TEXT PRIMARY KEY,public_key TEXT NOT NULL,private_key TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

ALTER TABLE public."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."accounts" ADD CONSTRAINT "accounts_username_key" UNIQUE (username);
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public."shared_stock_state" ADD CONSTRAINT "shared_stock_state_pkey" PRIMARY KEY (id);
ALTER TABLE public."reseller_orders" ADD CONSTRAINT "reseller_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."reseller_orders" ADD CONSTRAINT "reseller_orders_code_key" UNIQUE (code);
ALTER TABLE public."reseller_customer_accounts" ADD CONSTRAINT "reseller_customer_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."reseller_customer_sessions" ADD CONSTRAINT "reseller_customer_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."reseller_customer_sessions" ADD CONSTRAINT "reseller_customer_sessions_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE public."reseller_customer_sessions" ADD CONSTRAINT "reseller_customer_sessions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES reseller_customer_accounts(id) ON DELETE CASCADE;

COMMIT;