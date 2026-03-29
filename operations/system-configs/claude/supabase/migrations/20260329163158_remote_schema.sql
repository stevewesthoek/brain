


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "financialfreedom_schema";


ALTER SCHEMA "financialfreedom_schema" OWNER TO "financialfreedom_user";


CREATE SCHEMA IF NOT EXISTS "jpvbootcamp";


ALTER SCHEMA "jpvbootcamp" OWNER TO "supabase_admin";


COMMENT ON SCHEMA "jpvbootcamp" IS 'Tenant schema: JPV Bootcamp (isolated)';



CREATE SCHEMA IF NOT EXISTS "maybe_schema";


ALTER SCHEMA "maybe_schema" OWNER TO "maybe_user";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "tenant_boilerplate";


ALTER SCHEMA "tenant_boilerplate" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "tenant_cedula";


ALTER SCHEMA "tenant_cedula" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_jpvbootcamp";


ALTER SCHEMA "tenant_jpvbootcamp" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_olivetoorganizing";


ALTER SCHEMA "tenant_olivetoorganizing" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "tenant_openfund";


ALTER SCHEMA "tenant_openfund" OWNER TO "mcp_manager";


CREATE SCHEMA IF NOT EXISTS "tenant_prochat";


ALTER SCHEMA "tenant_prochat" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_prochattools";


ALTER SCHEMA "tenant_prochattools" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "tenant_procore";


ALTER SCHEMA "tenant_procore" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_prokit";


ALTER SCHEMA "tenant_prokit" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_prokitcore";


ALTER SCHEMA "tenant_prokitcore" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_prokitstudio";


ALTER SCHEMA "tenant_prokitstudio" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_rebuildwp";


ALTER SCHEMA "tenant_rebuildwp" OWNER TO "mcp_manager";


CREATE SCHEMA IF NOT EXISTS "tenant_resend";


ALTER SCHEMA "tenant_resend" OWNER TO "tenant_resend_user";


CREATE SCHEMA IF NOT EXISTS "tenant_saaskit";


ALTER SCHEMA "tenant_saaskit" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_saaskitcore";


ALTER SCHEMA "tenant_saaskitcore" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_saaskitstudio";


ALTER SCHEMA "tenant_saaskitstudio" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "tenant_saysthebible";


ALTER SCHEMA "tenant_saysthebible" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "tenant_statuslink";


ALTER SCHEMA "tenant_statuslink" OWNER TO "tenant_statuslink_user";


CREATE SCHEMA IF NOT EXISTS "tenant_viadieden";


ALTER SCHEMA "tenant_viadieden" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "ya_finance_schema";


ALTER SCHEMA "ya_finance_schema" OWNER TO "ya_finance_user";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "tenant_boilerplate"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_boilerplate"."SubscriptionStatus" OWNER TO "tenant_boilerplate_user";


CREATE TYPE "tenant_cedula"."BufferLevel" AS ENUM (
    'YES',
    'LIMITED',
    'NO'
);


ALTER TYPE "tenant_cedula"."BufferLevel" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."DocsValid" AS ENUM (
    'YES',
    'NO_OR_DOUBT'
);


ALTER TYPE "tenant_cedula"."DocsValid" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."EmigrationView" AS ENUM (
    'PROCESS_WITH_UNCERTAINTY',
    'EXCITING_BUT_MANAGEABLE',
    'SOLVES_MULTIPLE_PROBLEMS'
);


ALTER TYPE "tenant_cedula"."EmigrationView" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."EmotionalExpectation" AS ENUM (
    'ADJUSTMENT_TAKES_TIME',
    'RUST_WITH_QUESTIONS',
    'MAINLY_RELIEF'
);


ALTER TYPE "tenant_cedula"."EmotionalExpectation" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."IntakeDecision" AS ENUM (
    'REVIEW',
    'QUALIFIED',
    'REJECTED'
);


ALTER TYPE "tenant_cedula"."IntakeDecision" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."IntentTiming" AS ENUM (
    'SERIOUS_6_12_MONTHS',
    'ORIENTING_NO_TIMING',
    'CURIOUS'
);


ALTER TYPE "tenant_cedula"."IntentTiming" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_cedula"."SubscriptionStatus" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."TravelParty" AS ENUM (
    'ALONE',
    'PARTNER',
    'FAMILY',
    'OTHERS'
);


ALTER TYPE "tenant_cedula"."TravelParty" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."UncertaintyHandling" AS ENUM (
    'CALM_PROBLEM_SOLVER',
    'STRESSFUL_BUT_CAN_COPE',
    'EASILY_OVERWHELMED'
);


ALTER TYPE "tenant_cedula"."UncertaintyHandling" OWNER TO "supabase_admin";


CREATE TYPE "tenant_cedula"."YesNo" AS ENUM (
    'YES',
    'NO'
);


ALTER TYPE "tenant_cedula"."YesNo" OWNER TO "supabase_admin";


CREATE TYPE "tenant_jpvbootcamp"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_jpvbootcamp"."SubscriptionStatus" OWNER TO "postgres";


CREATE TYPE "tenant_openfund"."ImportBatchStatus" AS ENUM (
    'pending',
    'completed',
    'failed'
);


ALTER TYPE "tenant_openfund"."ImportBatchStatus" OWNER TO "mcp_manager";


CREATE TYPE "tenant_openfund"."RuleMatchField" AS ENUM (
    'description',
    'counterparty',
    'reference',
    'source'
);


ALTER TYPE "tenant_openfund"."RuleMatchField" OWNER TO "mcp_manager";


CREATE TYPE "tenant_openfund"."RuleMatchType" AS ENUM (
    'regex',
    'contains',
    'startsWith',
    'endsWith'
);


ALTER TYPE "tenant_openfund"."RuleMatchType" OWNER TO "mcp_manager";


CREATE TYPE "tenant_openfund"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_openfund"."SubscriptionStatus" OWNER TO "mcp_manager";


CREATE TYPE "tenant_openfund"."TransactionClassificationSource" AS ENUM (
    'none',
    'rule',
    'history',
    'import',
    'manual'
);


ALTER TYPE "tenant_openfund"."TransactionClassificationSource" OWNER TO "mcp_manager";


CREATE TYPE "tenant_openfund"."TransactionDirection" AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE "tenant_openfund"."TransactionDirection" OWNER TO "mcp_manager";


CREATE TYPE "tenant_prochat"."AccessStatus" AS ENUM (
    'pending',
    'invited',
    'active',
    'revoked'
);


ALTER TYPE "tenant_prochat"."AccessStatus" OWNER TO "tenant_prochat_user";


CREATE TYPE "tenant_prochat"."LicenseEventType" AS ENUM (
    'purchase_completed',
    'github_username_linked',
    'collaborator_invited',
    'access_revoked',
    'revocation_email_sent',
    'access_restored',
    'license_reactivated'
);


ALTER TYPE "tenant_prochat"."LicenseEventType" OWNER TO "tenant_prochat_user";


CREATE TYPE "tenant_prochat"."PaymentStatus" AS ENUM (
    'pending',
    'completed',
    'failed'
);


ALTER TYPE "tenant_prochat"."PaymentStatus" OWNER TO "tenant_prochat_user";


CREATE TYPE "tenant_prochat"."ProductType" AS ENUM (
    'saaskit',
    'prokit',
    'uxkit'
);


ALTER TYPE "tenant_prochat"."ProductType" OWNER TO "tenant_prochat_user";


CREATE TYPE "tenant_prochat"."ProvisioningStatus" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
);


ALTER TYPE "tenant_prochat"."ProvisioningStatus" OWNER TO "tenant_prochat_user";


CREATE TYPE "tenant_prochat"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_prochat"."SubscriptionStatus" OWNER TO "tenant_prochat_user";


CREATE TYPE "tenant_prochattools"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_prochattools"."SubscriptionStatus" OWNER TO "tenant_prochattools_user";


CREATE TYPE "tenant_procore"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_procore"."SubscriptionStatus" OWNER TO "tenant_procore_user";


CREATE TYPE "tenant_prokit"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_prokit"."SubscriptionStatus" OWNER TO "tenant_prokit_user";


CREATE TYPE "tenant_prokitcore"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_prokitcore"."SubscriptionStatus" OWNER TO "tenant_prokitcore_user";


CREATE TYPE "tenant_prokitstudio"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_prokitstudio"."SubscriptionStatus" OWNER TO "tenant_prokitstudio_user";


CREATE TYPE "tenant_saaskit"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_saaskit"."SubscriptionStatus" OWNER TO "tenant_saaskit_user";


CREATE TYPE "tenant_saaskitcore"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_saaskitcore"."SubscriptionStatus" OWNER TO "tenant_saaskitcore_user";


CREATE TYPE "tenant_saaskitstudio"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_saaskitstudio"."SubscriptionStatus" OWNER TO "tenant_saaskitstudio_user";


CREATE TYPE "tenant_saysthebible"."EmailSendStatus" AS ENUM (
    'queued',
    'sent',
    'failed'
);


ALTER TYPE "tenant_saysthebible"."EmailSendStatus" OWNER TO "tenant_saysthebible_user";


CREATE TYPE "tenant_saysthebible"."EmailSequenceStatus" AS ENUM (
    'active',
    'completed',
    'cancelled'
);


ALTER TYPE "tenant_saysthebible"."EmailSequenceStatus" OWNER TO "tenant_saysthebible_user";


CREATE TYPE "tenant_saysthebible"."PipelineJobStatus" AS ENUM (
    'pending',
    'processing',
    'ready',
    'published',
    'failed'
);


ALTER TYPE "tenant_saysthebible"."PipelineJobStatus" OWNER TO "tenant_saysthebible_user";


CREATE TYPE "tenant_saysthebible"."PurchaseAssetVariant" AS ENUM (
    'master',
    'watermarked'
);


ALTER TYPE "tenant_saysthebible"."PurchaseAssetVariant" OWNER TO "tenant_saysthebible_user";


CREATE TYPE "tenant_saysthebible"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "tenant_saysthebible"."SubscriptionStatus" OWNER TO "tenant_saysthebible_user";


CREATE TYPE "tenant_statuslink"."Actor" AS ENUM (
    'BROKER',
    'LENDER',
    'CLIENT',
    'SOLICITOR',
    'APPRAISER'
);


ALTER TYPE "tenant_statuslink"."Actor" OWNER TO "tenant_statuslink_user";


CREATE TYPE "tenant_statuslink"."PhaseState" AS ENUM (
    'PENDING',
    'ACTIVE',
    'BLOCKED',
    'COMPLETED'
);


ALTER TYPE "tenant_statuslink"."PhaseState" OWNER TO "tenant_statuslink_user";


CREATE TYPE "tenant_statuslink"."StageKind" AS ENUM (
    'APPLICATION_RECEIVED',
    'DOCS_PENDING',
    'LENDER_SUBMISSION',
    'VALUATION_BOOKED',
    'VALUATION_COMPLETE',
    'UNDERWRITING',
    'CONDITIONAL_APPROVAL',
    'FINAL_APPROVAL',
    'COMPLETION_FUNDS',
    'SETTLED'
);


ALTER TYPE "tenant_statuslink"."StageKind" OWNER TO "tenant_statuslink_user";


CREATE TYPE "ya_finance_schema"."ImportBatchStatus" AS ENUM (
    'pending',
    'completed',
    'failed'
);


ALTER TYPE "ya_finance_schema"."ImportBatchStatus" OWNER TO "ya_finance_user";


CREATE TYPE "ya_finance_schema"."SubscriptionStatus" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "ya_finance_schema"."SubscriptionStatus" OWNER TO "ya_finance_user";


CREATE TYPE "ya_finance_schema"."TransactionDirection" AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE "ya_finance_schema"."TransactionDirection" OWNER TO "ya_finance_user";


CREATE OR REPLACE FUNCTION "tenant_jpvbootcamp"."sync_customer_provisioning_plans"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- if one is set and the other isn't, mirror it
  IF NEW.current_plan IS NULL AND NEW.plan IS NOT NULL THEN
    NEW.current_plan := NEW.plan;
  ELSIF NEW.plan IS NULL AND NEW.current_plan IS NOT NULL THEN
    NEW.plan := NEW.current_plan;
  END IF;

  -- if both set but different, prefer current_plan (because app expects it)
  IF NEW.current_plan IS NOT NULL AND NEW.plan IS NOT NULL AND NEW.current_plan <> NEW.plan THEN
    NEW.plan := NEW.current_plan;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "tenant_jpvbootcamp"."sync_customer_provisioning_plans"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "tenant_resend"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "tenant_resend"."update_updated_at_column"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "tenant_statuslink"."cuid"() RETURNS "text"
    LANGUAGE "sql"
    AS $$
SELECT lower(substr(md5(random()::text || clock_timestamp()::text), 1, 32));
$$;


ALTER FUNCTION "tenant_statuslink"."cuid"() OWNER TO "tenant_statuslink_user";


CREATE OR REPLACE FUNCTION "tenant_statuslink"."set_current_timestamp_updated_at_organization"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "tenant_statuslink"."set_current_timestamp_updated_at_organization"() OWNER TO "tenant_statuslink_user";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "jpvbootcamp"."customer_provisioning" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "stripe_subscription_id" "text",
    "wp_user_id" integer,
    "current_plan" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_provisioning_current_plan_check" CHECK (("current_plan" = ANY (ARRAY['pro'::"text", 'vip'::"text"])))
);


ALTER TABLE "jpvbootcamp"."customer_provisioning" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "jpvbootcamp"."stripe_webhook_events" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "jpvbootcamp"."stripe_webhook_events" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."WaitlistSubscriber" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "firstName" "text",
    "source" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."WaitlistSubscriber" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."_prisma_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."audiences" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."cash_accounts" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "institution_id" bigint NOT NULL,
    "type" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" character varying(255),
    "account_number" character varying(255),
    "balance" numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    "interest_rate" numeric(5,3) DEFAULT '0'::numeric NOT NULL,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone,
    "deleted_at" timestamp(0) without time zone,
    "import_map" "json"
);


ALTER TABLE "public"."cash_accounts" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."cash_accounts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cash_accounts_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."cash_accounts_id_seq" OWNED BY "public"."cash_accounts"."id";



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "group_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "color" character varying(255) NOT NULL,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone
);


ALTER TABLE "public"."categories" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."categories_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";



CREATE TABLE IF NOT EXISTS "public"."credit_cards" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "institution_id" bigint NOT NULL,
    "brand" character varying(255),
    "name" character varying(255) NOT NULL,
    "description" character varying(255),
    "interest_rate" numeric(5,3) DEFAULT '0'::numeric NOT NULL,
    "credit_limit" numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    "balance" numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone,
    "deleted_at" timestamp(0) without time zone,
    "import_map" "json"
);


ALTER TABLE "public"."credit_cards" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."credit_cards_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."credit_cards_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."credit_cards_id_seq" OWNED BY "public"."credit_cards"."id";



CREATE TABLE IF NOT EXISTS "public"."failed_jobs" (
    "id" bigint NOT NULL,
    "uuid" character varying(255) NOT NULL,
    "connection" "text" NOT NULL,
    "queue" "text" NOT NULL,
    "payload" "text" NOT NULL,
    "exception" "text" NOT NULL,
    "failed_at" timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."failed_jobs" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."failed_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."failed_jobs_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."failed_jobs_id_seq" OWNED BY "public"."failed_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone
);


ALTER TABLE "public"."groups" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."groups_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."groups_id_seq" OWNED BY "public"."groups"."id";



CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "url" character varying(255),
    "logo" "text",
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone
);


ALTER TABLE "public"."institutions" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."institutions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."institutions_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."institutions_id_seq" OWNED BY "public"."institutions"."id";



CREATE TABLE IF NOT EXISTS "public"."loans" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "institution_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "type" character varying(255),
    "number" character varying(255),
    "description" character varying(255),
    "opened_at" "date",
    "interest_rate" numeric(5,3) DEFAULT '0'::numeric NOT NULL,
    "remaining_balance" numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    "original_balance" numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    "payment_amount" numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone,
    "deleted_at" timestamp(0) without time zone,
    "import_map" "json"
);


ALTER TABLE "public"."loans" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."loans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."loans_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."loans_id_seq" OWNED BY "public"."loans"."id";



CREATE TABLE IF NOT EXISTS "public"."migrations" (
    "id" integer NOT NULL,
    "migration" character varying(255) NOT NULL,
    "batch" integer NOT NULL
);


ALTER TABLE "public"."migrations" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."migrations_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."migrations_id_seq" OWNED BY "public"."migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "email" character varying(255) NOT NULL,
    "token" character varying(255) NOT NULL,
    "created_at" timestamp(0) without time zone
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "financialfreedom_user";


CREATE TABLE IF NOT EXISTS "public"."personal_access_tokens" (
    "id" bigint NOT NULL,
    "tokenable_type" character varying(255) NOT NULL,
    "tokenable_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "token" character varying(64) NOT NULL,
    "abilities" "text",
    "last_used_at" timestamp(0) without time zone,
    "expires_at" timestamp(0) without time zone,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone
);


ALTER TABLE "public"."personal_access_tokens" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."personal_access_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."personal_access_tokens_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."personal_access_tokens_id_seq" OWNED BY "public"."personal_access_tokens"."id";



CREATE TABLE IF NOT EXISTS "public"."rules" (
    "id" bigint NOT NULL,
    "accountable_id" bigint NOT NULL,
    "accountable_type" character varying(255) NOT NULL,
    "search_string" character varying(255) NOT NULL,
    "replace_string" character varying(255) NOT NULL,
    "category_id" bigint,
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone
);


ALTER TABLE "public"."rules" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."rules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rules_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."rules_id_seq" OWNED BY "public"."rules"."id";



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "slug" "text" NOT NULL,
    "db_user" "text" NOT NULL,
    "db_password" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "schema_name" "text" NOT NULL,
    "type" "text" DEFAULT 'prod'::"text" NOT NULL,
    "external_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" bigint NOT NULL,
    "uuid" "uuid" NOT NULL,
    "user_id" bigint NOT NULL,
    "accountable_id" bigint NOT NULL,
    "accountable_type" character varying(255) NOT NULL,
    "category_id" bigint,
    "amount" numeric(10,3) NOT NULL,
    "date" "date" NOT NULL,
    "merchant" character varying(255),
    "notes" "text",
    "type" character varying(255) NOT NULL,
    "reconciled" integer DEFAULT 0 NOT NULL,
    "receipt_url" "text",
    "original" "json",
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone,
    "deleted_at" timestamp(0) without time zone
);


ALTER TABLE "public"."transactions" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."transactions_id_seq" OWNED BY "public"."transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "email_verified_at" timestamp(0) without time zone,
    "password" character varying(255) NOT NULL,
    "remember_token" character varying(100),
    "created_at" timestamp(0) without time zone,
    "updated_at" timestamp(0) without time zone,
    "default_currency" character varying(255) DEFAULT 'USD'::character varying NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "financialfreedom_user";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "financialfreedom_user";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



CREATE TABLE IF NOT EXISTS "tenant_boilerplate"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_boilerplate"."Audiences" OWNER TO "tenant_boilerplate_user";


CREATE TABLE IF NOT EXISTS "tenant_boilerplate"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_boilerplate"."Project" OWNER TO "tenant_boilerplate_user";


CREATE TABLE IF NOT EXISTS "tenant_boilerplate"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_boilerplate"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_boilerplate"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_boilerplate"."Subscription" OWNER TO "tenant_boilerplate_user";


CREATE TABLE IF NOT EXISTS "tenant_boilerplate"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_boilerplate"."_prisma_migrations" OWNER TO "tenant_boilerplate_user";


CREATE TABLE IF NOT EXISTS "tenant_cedula"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_cedula"."Audiences" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_cedula"."CedulaIntake" (
    "id" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "fullName" "text" NOT NULL,
    "email" "text" NOT NULL,
    "country" "text" NOT NULL,
    "travelParty" "tenant_cedula"."TravelParty" NOT NULL,
    "groupSize" integer,
    "intentTiming" "tenant_cedula"."IntentTiming" NOT NULL,
    "motivation" "text",
    "whyNowFit" "text",
    "expectations" "text"[],
    "emigrationView" "tenant_cedula"."EmigrationView" NOT NULL,
    "canPay" "tenant_cedula"."YesNo" NOT NULL,
    "bufferLevel" "tenant_cedula"."BufferLevel" NOT NULL,
    "uncertaintyHandling" "tenant_cedula"."UncertaintyHandling" NOT NULL,
    "emotionalExpectation" "tenant_cedula"."EmotionalExpectation" NOT NULL,
    "criminalRecord" "tenant_cedula"."YesNo" NOT NULL,
    "docsValid" "tenant_cedula"."DocsValid" NOT NULL,
    "understandsNoGuarantee" "tenant_cedula"."YesNo" NOT NULL,
    "understandsNoRefund" "tenant_cedula"."YesNo" NOT NULL,
    "decision" "tenant_cedula"."IntakeDecision" DEFAULT 'REVIEW'::"tenant_cedula"."IntakeDecision" NOT NULL,
    "rejectionCode" "text",
    "rejectionMessage" "text"
);


ALTER TABLE "tenant_cedula"."CedulaIntake" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_cedula"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_cedula"."Project" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_cedula"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_cedula"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_cedula"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_cedula"."Subscription" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_cedula"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_cedula"."_prisma_migrations" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_jpvbootcamp"."Audiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "webhookLink" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "assistant_id" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "tenant_jpvbootcamp"."Project" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_jpvbootcamp"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_jpvbootcamp"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_jpvbootcamp"."Subscription" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_jpvbootcamp"."_prisma_migrations" OWNER TO "tenant_jpvbootcamp_user";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."customer_provisioning" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "wp_user_id" bigint,
    "email" "text",
    "plan" "text" NOT NULL,
    "status" "text" DEFAULT 'provisioned'::"text" NOT NULL,
    "last_event_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_plan" "text",
    "last_notified_plan" "text",
    "last_notified_event_id" "text",
    "last_notified_at" timestamp with time zone,
    "normalized_email" "text",
    CONSTRAINT "customer_provisioning_plan_check" CHECK (("plan" = ANY (ARRAY['pro'::"text", 'vip'::"text", 'none'::"text"])))
);


ALTER TABLE "tenant_jpvbootcamp"."customer_provisioning" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."email_subscribers" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "source" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "tenant_jpvbootcamp"."email_subscribers" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."partner_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text" NOT NULL,
    "wp_user_id" integer NOT NULL,
    "partner_slug" "text" NOT NULL,
    "category_slug" "text" NOT NULL,
    "ref_path" "text",
    "user_agent_hash" "text",
    "ip_hash" "text"
);


ALTER TABLE "tenant_jpvbootcamp"."partner_clicks" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."partner_sessions" (
    "session_id" "text" NOT NULL,
    "wp_user_id" integer NOT NULL,
    "wp_email_hash" "text" NOT NULL,
    "wp_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "tenant_jpvbootcamp"."partner_sessions" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."sponsored_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "wp_user_id" integer NOT NULL,
    "email_hash" "text" NOT NULL,
    "name" "text" NOT NULL,
    "message" "text",
    "reviewed_by_wp_user_id" integer,
    "reviewed_at" timestamp with time zone,
    "decision_note" "text",
    "email" "text",
    "updated_at" timestamp with time zone,
    "last_admin_email_sent_at" timestamp with time zone,
    CONSTRAINT "sponsored_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "tenant_jpvbootcamp"."sponsored_applications" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."sponsored_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wp_user_id" integer NOT NULL,
    "tier" "text" NOT NULL,
    "seat_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "sponsored_grants_tier_check" CHECK (("tier" = ANY (ARRAY['pro'::"text", 'vip'::"text"])))
);


ALTER TABLE "tenant_jpvbootcamp"."sponsored_grants" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."sponsored_seats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tier" "text" NOT NULL,
    "stripe_payment_intent_id" "text" NOT NULL,
    "stripe_checkout_session_id" "text" NOT NULL,
    "donated_by_email_hash" "text",
    "claimed_by_wp_user_id" integer,
    "claimed_at" timestamp with time zone,
    "donor_email_sent_at" timestamp with time zone,
    "admin_notified_at" timestamp with time zone,
    "reserved_by_application_id" "uuid",
    "reserved_at" timestamp with time zone,
    CONSTRAINT "sponsored_seats_tier_check" CHECK (("tier" = ANY (ARRAY['pro'::"text", 'vip'::"text"])))
);


ALTER TABLE "tenant_jpvbootcamp"."sponsored_seats" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_jpvbootcamp"."stripe_webhook_events" (
    "event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "livemode" boolean,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "payload" "jsonb",
    "stripe_event_id" "text",
    "event_type" "text"
);


ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Account" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_openfund"."Account" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_openfund"."Audiences" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."CategorizationRule" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "importBatchId" "text",
    "ledgerId" "text",
    "categoryId" "text" NOT NULL,
    "label" "text" NOT NULL,
    "pattern" "text" NOT NULL,
    "matchType" "tenant_openfund"."RuleMatchType" DEFAULT 'regex'::"tenant_openfund"."RuleMatchType" NOT NULL,
    "matchField" "tenant_openfund"."RuleMatchField" DEFAULT 'description'::"tenant_openfund"."RuleMatchField" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastMatchedAt" timestamp(3) without time zone,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "tenant_openfund"."CategorizationRule" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Category" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_openfund"."Category" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."ImportBatch" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "fileType" "text",
    "status" "tenant_openfund"."ImportBatchStatus" DEFAULT 'pending'::"tenant_openfund"."ImportBatchStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "importedRows" integer DEFAULT 0 NOT NULL,
    "duplicateRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    "autoCategorizedRows" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_openfund"."ImportBatch" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Ledger" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "lockedBy" "text",
    "lockNote" "text"
);


ALTER TABLE "tenant_openfund"."Ledger" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."LedgerLock" (
    "id" "text" NOT NULL,
    "ledgerId" "text" NOT NULL,
    "lockedAt" timestamp(3) without time zone NOT NULL,
    "lockedBy" "text",
    "note" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_openfund"."LedgerLock" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."OpeningBalance" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "effectiveDate" timestamp(3) without time zone NOT NULL,
    "amountMinor" bigint NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "note" "text",
    "createdBy" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "lockedBy" "text"
);


ALTER TABLE "tenant_openfund"."OpeningBalance" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_openfund"."Project" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_openfund"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_openfund"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_openfund"."Subscription" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."Transaction" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "ledgerId" "text",
    "date" timestamp(3) without time zone NOT NULL,
    "description" "text" NOT NULL,
    "normalizedKey" "text" DEFAULT ''::"text" NOT NULL,
    "source" "text" NOT NULL,
    "categoryId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "accountId" "text",
    "importBatchId" "text",
    "amountMinor" bigint NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "direction" "tenant_openfund"."TransactionDirection" DEFAULT 'credit'::"tenant_openfund"."TransactionDirection" NOT NULL,
    "counterparty" "text",
    "reference" "text",
    "hash" "text" NOT NULL,
    "sourceFile" "text",
    "rawRow" "jsonb",
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "classificationSource" "tenant_openfund"."TransactionClassificationSource" DEFAULT 'none'::"tenant_openfund"."TransactionClassificationSource" NOT NULL,
    "classificationRuleId" "text",
    "importFingerprint" "text"
);


ALTER TABLE "tenant_openfund"."Transaction" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_openfund"."User" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_openfund"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_openfund"."_prisma_migrations" OWNER TO "mcp_manager";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_prochat"."Audiences" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."License" (
    "id" "text" NOT NULL,
    "purchaser_email" "text" NOT NULL,
    "product" "tenant_prochat"."ProductType" NOT NULL,
    "payment_reference" "text" NOT NULL,
    "payment_status" "tenant_prochat"."PaymentStatus" DEFAULT 'pending'::"tenant_prochat"."PaymentStatus" NOT NULL,
    "provisioning_status" "tenant_prochat"."ProvisioningStatus" DEFAULT 'pending'::"tenant_prochat"."ProvisioningStatus" NOT NULL,
    "access_status" "tenant_prochat"."AccessStatus" DEFAULT 'pending'::"tenant_prochat"."AccessStatus" NOT NULL,
    "github_username" "text",
    "revoked_at" timestamp(3) without time zone,
    "revoked_reason" "text",
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "tenant_prochat"."License" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."LicenseEvent" (
    "id" "text" NOT NULL,
    "license_id" "text" NOT NULL,
    "type" "tenant_prochat"."LicenseEventType" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_prochat"."LicenseEvent" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_prochat"."Project" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_prochat"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_prochat"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_prochat"."Subscription" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."WaitlistSignup" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "selected_products" "jsonb" NOT NULL,
    "selected_products_csv" "text" NOT NULL,
    "source" "text" DEFAULT 'waitlist'::"text" NOT NULL,
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "unsubscribe_token" "text",
    "unsubscribed_at" timestamp(3) without time zone
);


ALTER TABLE "tenant_prochat"."WaitlistSignup" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochat"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_prochat"."_prisma_migrations" OWNER TO "tenant_prochat_user";


CREATE TABLE IF NOT EXISTS "tenant_prochattools"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_prochattools"."Audiences" OWNER TO "tenant_prochattools_user";


CREATE TABLE IF NOT EXISTS "tenant_prochattools"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_prochattools"."Project" OWNER TO "tenant_prochattools_user";


CREATE TABLE IF NOT EXISTS "tenant_prochattools"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_prochattools"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_prochattools"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_prochattools"."Subscription" OWNER TO "tenant_prochattools_user";


CREATE TABLE IF NOT EXISTS "tenant_prochattools"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_prochattools"."_prisma_migrations" OWNER TO "tenant_prochattools_user";


CREATE TABLE IF NOT EXISTS "tenant_procore"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_procore"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_procore"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_procore"."Subscription" OWNER TO "tenant_procore_user";


CREATE TABLE IF NOT EXISTS "tenant_procore"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_procore"."_prisma_migrations" OWNER TO "tenant_procore_user";


CREATE TABLE IF NOT EXISTS "tenant_prokit"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_prokit"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_prokit"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_prokit"."Subscription" OWNER TO "tenant_prokit_user";


CREATE TABLE IF NOT EXISTS "tenant_prokit"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_prokit"."_prisma_migrations" OWNER TO "tenant_prokit_user";


CREATE TABLE IF NOT EXISTS "tenant_prokitcore"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_prokitcore"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_prokitcore"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_prokitcore"."Subscription" OWNER TO "tenant_prokitcore_user";


CREATE TABLE IF NOT EXISTS "tenant_prokitcore"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_prokitcore"."_prisma_migrations" OWNER TO "tenant_prokitcore_user";


CREATE TABLE IF NOT EXISTS "tenant_prokitstudio"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_prokitstudio"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_prokitstudio"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_prokitstudio"."Subscription" OWNER TO "tenant_prokitstudio_user";


CREATE TABLE IF NOT EXISTS "tenant_prokitstudio"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_prokitstudio"."_prisma_migrations" OWNER TO "tenant_prokitstudio_user";


CREATE TABLE IF NOT EXISTS "tenant_resend"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "domain_id" "uuid",
    "key_name" character varying(255) NOT NULL,
    "key_hash" character varying(255) NOT NULL,
    "key_prefix" character varying(20) NOT NULL,
    "permissions" "jsonb" DEFAULT '["send"]'::"jsonb",
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "tenant_resend"."api_keys" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_resend"."domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "domain" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "ses_identity_arn" character varying(255),
    "ses_configuration_set" character varying(255),
    "do_domain_id" character varying(255),
    "dns_records" "jsonb" DEFAULT '[]'::"jsonb",
    "verification_token" character varying(255),
    "smtp_credentials" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "tenant_resend"."domains" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_resend"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_id" "uuid",
    "domain_id" "uuid",
    "message_id" character varying(255),
    "from_email" character varying(255) NOT NULL,
    "to_emails" "jsonb" NOT NULL,
    "cc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "bcc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "subject" character varying(500),
    "html_content" "text",
    "text_content" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "ses_message_id" character varying(255),
    "error_message" "text",
    "webhook_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "tenant_resend"."email_logs" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_resend"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "name" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "tenant_resend"."users" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_resend"."waitlist_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "estimated_volume" integer,
    "current_provider" character varying(100),
    "referral_source" character varying(100),
    "user_agent" "text",
    "ip_address" "inet",
    "utm_source" character varying(100),
    "utm_medium" character varying(100),
    "utm_campaign" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "tenant_resend"."waitlist_signups" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_resend"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_log_id" "uuid",
    "event_type" character varying(50) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "tenant_resend"."webhook_events" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "tenant_saaskit"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_saaskit"."Audiences" OWNER TO "tenant_saaskit_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskit"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_saaskit"."Project" OWNER TO "tenant_saaskit_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskit"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_saaskit"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_saaskit"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_saaskit"."Subscription" OWNER TO "tenant_saaskit_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskit"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_saaskit"."_prisma_migrations" OWNER TO "tenant_saaskit_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitcore"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_saaskitcore"."Audiences" OWNER TO "tenant_saaskitcore_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitcore"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_saaskitcore"."Project" OWNER TO "tenant_saaskitcore_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitcore"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_saaskitcore"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_saaskitcore"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_saaskitcore"."Subscription" OWNER TO "tenant_saaskitcore_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitcore"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_saaskitcore"."_prisma_migrations" OWNER TO "tenant_saaskitcore_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitstudio"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_saaskitstudio"."Audiences" OWNER TO "tenant_saaskitstudio_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitstudio"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_saaskitstudio"."Project" OWNER TO "tenant_saaskitstudio_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitstudio"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_saaskitstudio"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_saaskitstudio"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_saaskitstudio"."Subscription" OWNER TO "tenant_saaskitstudio_user";


CREATE TABLE IF NOT EXISTS "tenant_saaskitstudio"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_saaskitstudio"."_prisma_migrations" OWNER TO "tenant_saaskitstudio_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."Asset" (
    "id" "text" NOT NULL,
    "catalogProductId" "text",
    "slug" "text" NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "bucket" "text" DEFAULT 'audio'::"text" NOT NULL,
    "objectPath" "text" NOT NULL,
    "mimeType" "text" DEFAULT 'audio/wav'::"text" NOT NULL,
    "format" "text" DEFAULT 'wav_24_48'::"text" NOT NULL,
    "durationSeconds" integer,
    "checksum" "text",
    "active" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."Asset" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tenant_saysthebible"."Audiences" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."CatalogProduct" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "scriptureRef" "text",
    "description" "text",
    "stripeProductId" "text" NOT NULL,
    "stripePriceId" "text",
    "unitAmount" integer,
    "currency" "text",
    "isAvailable" boolean DEFAULT false NOT NULL,
    "catalogOrder" integer DEFAULT 0 NOT NULL,
    "audioFormat" "text",
    "durationMinutes" integer,
    "artworkPath" "text",
    "legacySlugs" "text"[] DEFAULT ARRAY[]::"text"[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "book" "text",
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "story" "text",
    "version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "libraryDescription" "text"
);


ALTER TABLE "tenant_saysthebible"."CatalogProduct" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."CustomerAccount" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "clerkUserId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."CustomerAccount" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."DownloadEvent" (
    "id" "text" NOT NULL,
    "purchaseId" "text" NOT NULL,
    "assetId" "text" NOT NULL,
    "ipAddress" "text",
    "userAgent" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."DownloadEvent" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."DownloadGrant" (
    "id" "text" NOT NULL,
    "purchaseId" "text" NOT NULL,
    "userId" "text",
    "ipHash" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."DownloadGrant" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."EmailPreference" (
    "email" "text" NOT NULL,
    "onboardingOptOut" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."EmailPreference" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."EmailSendLog" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "sequenceKey" "text" NOT NULL,
    "step" integer NOT NULL,
    "enrollmentId" "text" NOT NULL,
    "resendMessageId" "text",
    "status" "tenant_saysthebible"."EmailSendStatus" DEFAULT 'queued'::"tenant_saysthebible"."EmailSendStatus" NOT NULL,
    "error" "text",
    "sentAt" timestamp(3) without time zone,
    "unsubscribeTokenHash" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."EmailSendLog" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."EmailSequenceEnrollment" (
    "id" "text" NOT NULL,
    "userId" "text",
    "email" "text" NOT NULL,
    "purchaseId" "text",
    "sequenceKey" "text" NOT NULL,
    "status" "tenant_saysthebible"."EmailSequenceStatus" DEFAULT 'active'::"tenant_saysthebible"."EmailSequenceStatus" NOT NULL,
    "enrolledAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastStepSentAt" timestamp(3) without time zone,
    "nextSendAt" timestamp(3) without time zone,
    "currentStep" integer DEFAULT 1 NOT NULL,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."EmailSequenceEnrollment" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."LibraryAccessLinkRequest" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "ipAddress" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."LibraryAccessLinkRequest" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."MagicLink" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "tokenHash" "text" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."MagicLink" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."PipelineJob" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "ssmlPath" "text",
    "status" "tenant_saysthebible"."PipelineJobStatus" DEFAULT 'pending'::"tenant_saysthebible"."PipelineJobStatus" NOT NULL,
    "azureTtsJobId" "text",
    "audioPath" "text",
    "videoPath" "text",
    "youtubeVideoId" "text",
    "youtubePostedAt" timestamp(3) without time zone,
    "errorMessage" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "youtubeScheduledAt" timestamp(3) without time zone
);


ALTER TABLE "tenant_saysthebible"."PipelineJob" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."ProductPrice" (
    "id" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "unitAmount" integer NOT NULL,
    "stripePriceId" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."ProductPrice" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "tenant_saysthebible"."Project" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."Purchase" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "stripeCheckoutSessionId" "text" NOT NULL,
    "stripePaymentIntentId" "text",
    "productSlug" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "amountTotal" integer NOT NULL,
    "status" "text" DEFAULT 'paid'::"text" NOT NULL,
    "fulfillmentTokenHash" "text",
    "fulfillmentTokenExpiresAt" timestamp(3) without time zone,
    "fulfillmentTokenUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "emailSentAt" timestamp(3) without time zone
);


ALTER TABLE "tenant_saysthebible"."Purchase" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."PurchaseAsset" (
    "id" "text" NOT NULL,
    "purchaseId" "text" NOT NULL,
    "assetId" "text" NOT NULL,
    "variant" "tenant_saysthebible"."PurchaseAssetVariant" DEFAULT 'master'::"tenant_saysthebible"."PurchaseAssetVariant" NOT NULL,
    "objectPathOverride" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."PurchaseAsset" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."StripeWebhookDelivery" (
    "id" "text" NOT NULL,
    "stripeEventId" "text" NOT NULL,
    "type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "livemode" boolean DEFAULT false NOT NULL,
    "payloadJson" "jsonb",
    "signaturePresent" boolean DEFAULT false NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "processingError" "text"
);


ALTER TABLE "tenant_saysthebible"."StripeWebhookDelivery" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."StripeWebhookEvent" (
    "id" "text" NOT NULL,
    "stripeEventId" "text" NOT NULL,
    "eventType" "text" NOT NULL,
    "processedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."StripeWebhookEvent" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "tenant_saysthebible"."SubscriptionStatus" DEFAULT 'inactive'::"tenant_saysthebible"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "tenant_saysthebible"."Subscription" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."UserSession" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "tokenHash" "text" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_saysthebible"."UserSession" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_saysthebible"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_saysthebible"."_prisma_migrations" OWNER TO "tenant_saysthebible_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."DeeplinkLog" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "stripeCustomerId" "text",
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "convertedAt" timestamp(3) without time zone
);


ALTER TABLE "tenant_statuslink"."DeeplinkLog" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Dossier" (
    "id" "text" NOT NULL,
    "ownerId" "text" NOT NULL,
    "dossierNumber" "text" NOT NULL,
    "displayName" "text",
    "propertyAddress" "text",
    "targetDate" timestamp(3) without time zone,
    "currentStageId" "text",
    "lastUpdatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "publicTokenJti" "text" NOT NULL,
    "publicTokenExp" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "adminToken" "text",
    "lastNotifiedAt" timestamp(3) without time zone,
    "isDraft" boolean DEFAULT false NOT NULL,
    "activatedAt" timestamp(6) with time zone,
    "draftStep" integer
);


ALTER TABLE "tenant_statuslink"."Dossier" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Event" (
    "id" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "type" "text" NOT NULL,
    "meta" "jsonb",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_statuslink"."Event" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Feedback" (
    "id" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "rating" "text" NOT NULL,
    "comment" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_statuslink"."Feedback" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Message" (
    "id" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "participantId" "text",
    "participantRole" "text",
    "senderRole" "text" NOT NULL,
    "senderEmail" "text",
    "senderUserId" "text",
    "content" "text" NOT NULL,
    "phaseId" "text",
    "targetParticipantId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "tenant_statuslink"."Message" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Milestone" (
    "id" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "kind" "tenant_statuslink"."StageKind" NOT NULL,
    "title" "text" NOT NULL,
    "responsible" "tenant_statuslink"."Actor" NOT NULL,
    "expectedDate" timestamp(3) without time zone,
    "completedDate" timestamp(3) without time zone,
    "orderIndex" integer NOT NULL,
    "assignedToParticipantId" "text",
    "status" "tenant_statuslink"."PhaseState" DEFAULT 'PENDING'::"tenant_statuslink"."PhaseState" NOT NULL
);


ALTER TABLE "tenant_statuslink"."Milestone" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."N8nRetry" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "dossierId" "text",
    "meta" "jsonb",
    "attempts" integer DEFAULT 0 NOT NULL,
    "lastError" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "tenant_statuslink"."N8nRetry" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Organization" (
    "id" "text" NOT NULL,
    "workspaceId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logoUrl" "text",
    "brandColor" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "tenant_statuslink"."Organization" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Participant" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "linkToken" "text" NOT NULL,
    "role" "text" NOT NULL,
    "pushOptIn" boolean DEFAULT false NOT NULL,
    "emailOptIn" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "linkTokenExpiresAt" timestamp(3) without time zone
);


ALTER TABLE "tenant_statuslink"."Participant" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."PhaseDocumentRequirement" (
    "id" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "dossierId" "text" NOT NULL,
    "milestoneId" "text" NOT NULL,
    "title" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "completedByParticipantId" "text"
);


ALTER TABLE "tenant_statuslink"."PhaseDocumentRequirement" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."PhaseNotificationEvent" (
    "id" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dossierId" "text" NOT NULL,
    "milestoneId" "text" NOT NULL,
    "participantId" "text",
    "kind" "text" NOT NULL,
    "status" "text" NOT NULL
);


ALTER TABLE "tenant_statuslink"."PhaseNotificationEvent" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."PhaseViewEvent" (
    "id" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dossierId" "text" NOT NULL,
    "milestoneId" "text" NOT NULL,
    "participantId" "text"
);


ALTER TABLE "tenant_statuslink"."PhaseViewEvent" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."PushDelivery" (
    "id" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "subscriptionId" "text" NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveredAt" timestamp(3) without time zone,
    "openedAt" timestamp(3) without time zone,
    "meta" "jsonb"
);


ALTER TABLE "tenant_statuslink"."PushDelivery" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."PushSubscription" (
    "id" "text" NOT NULL,
    "dossierId" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "participantId" "text",
    "deliveredAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone
);


ALTER TABLE "tenant_statuslink"."PushSubscription" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."Subscription" (
    "id" "text" NOT NULL,
    "userId" "text",
    "stripeCustomerId" "text" NOT NULL,
    "stripeSubscriptionId" "text",
    "stripePriceId" "text",
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "contactEmail" "text",
    "trialEndsAt" timestamp(3) without time zone,
    "trialActive" boolean DEFAULT true NOT NULL,
    "trialWelcomeSentAt" timestamp(3) without time zone,
    "trialMidSentAt" timestamp(3) without time zone,
    "trialFinalSentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "plan" "text" DEFAULT 'trial'::"text" NOT NULL,
    "cancellationReminderSentAt" timestamp(3) without time zone,
    "cancellationScheduledFor" timestamp(3) without time zone
);


ALTER TABLE "tenant_statuslink"."Subscription" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."SystemLog" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "message" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "meta" "jsonb"
);


ALTER TABLE "tenant_statuslink"."SystemLog" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."UserSettings" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "notifications" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "branding" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "automations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "brokerDeepLinkExpiryDays" integer DEFAULT 180,
    "participantMagicLinkExpiryDays" integer DEFAULT 7
);


ALTER TABLE "tenant_statuslink"."UserSettings" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."WorkspaceBranding" (
    "id" "text" NOT NULL,
    "workspaceId" "text" NOT NULL,
    "displayName" "text",
    "logoUrl" "text",
    "brandColor" "text",
    "contactEmail" "text",
    "tagline" "text",
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "icon128Url" "text",
    "icon192Url" "text",
    "icon512Url" "text",
    "iconVersion" "text"
);


ALTER TABLE "tenant_statuslink"."WorkspaceBranding" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "tenant_statuslink"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "tenant_statuslink"."_prisma_migrations" OWNER TO "tenant_statuslink_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Account" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."Account" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Audiences" (
    "id" "text" NOT NULL,
    "resend_id" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "ya_finance_schema"."Audiences" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Category" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."Category" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."ImportBatch" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "fileType" "text",
    "status" "ya_finance_schema"."ImportBatchStatus" DEFAULT 'pending'::"ya_finance_schema"."ImportBatchStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "importedRows" integer DEFAULT 0 NOT NULL,
    "duplicateRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    "autoCategorizedRows" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."ImportBatch" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Ledger" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."Ledger" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."LedgerLock" (
    "id" "text" NOT NULL,
    "ledgerId" "text" NOT NULL,
    "lockedAt" timestamp(3) without time zone NOT NULL,
    "lockedBy" "text",
    "note" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."LedgerLock" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Project" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "webhook_id" "text" NOT NULL,
    "scenario_id" "text" NOT NULL,
    "user_clerk_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'default'::"text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assistant_id" "text",
    "webhookLink" "text" NOT NULL
);


ALTER TABLE "ya_finance_schema"."Project" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Subscription" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "sub_status" "ya_finance_schema"."SubscriptionStatus" DEFAULT 'inactive'::"ya_finance_schema"."SubscriptionStatus" NOT NULL,
    "sub_type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "last_stripe_cs_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "sub_stripe_id" "text",
    "user_clerk_id" "text" NOT NULL
);


ALTER TABLE "ya_finance_schema"."Subscription" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."Transaction" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "ledgerId" "text",
    "date" timestamp(3) without time zone NOT NULL,
    "description" "text" NOT NULL,
    "normalizedKey" "text" DEFAULT ''::"text" NOT NULL,
    "source" "text" NOT NULL,
    "categoryId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "accountId" "text",
    "importBatchId" "text",
    "amountMinor" bigint NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "direction" "ya_finance_schema"."TransactionDirection" DEFAULT 'credit'::"ya_finance_schema"."TransactionDirection" NOT NULL,
    "counterparty" "text",
    "reference" "text",
    "hash" "text" NOT NULL,
    "sourceFile" "text",
    "rawRow" "jsonb",
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."Transaction" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "ya_finance_schema"."User" OWNER TO "ya_finance_user";


CREATE TABLE IF NOT EXISTS "ya_finance_schema"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "ya_finance_schema"."_prisma_migrations" OWNER TO "ya_finance_user";


ALTER TABLE ONLY "public"."cash_accounts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cash_accounts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credit_cards" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_cards_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."failed_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."failed_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."groups" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."groups_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."institutions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."institutions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."loans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."loans_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."personal_access_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."personal_access_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "jpvbootcamp"."customer_provisioning"
    ADD CONSTRAINT "customer_provisioning_email_key" UNIQUE ("email");



ALTER TABLE ONLY "jpvbootcamp"."customer_provisioning"
    ADD CONSTRAINT "customer_provisioning_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "jpvbootcamp"."customer_provisioning"
    ADD CONSTRAINT "customer_provisioning_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "jpvbootcamp"."customer_provisioning"
    ADD CONSTRAINT "customer_provisioning_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "jpvbootcamp"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."WaitlistSubscriber"
    ADD CONSTRAINT "WaitlistSubscriber_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."WaitlistSubscriber"
    ADD CONSTRAINT "WaitlistSubscriber_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_resend_id_key" UNIQUE ("resend_id");



ALTER TABLE ONLY "public"."cash_accounts"
    ADD CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."failed_jobs"
    ADD CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."failed_jobs"
    ADD CONSTRAINT "failed_jobs_uuid_unique" UNIQUE ("uuid");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."personal_access_tokens"
    ADD CONSTRAINT "personal_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_access_tokens"
    ADD CONSTRAINT "personal_access_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "public"."rules"
    ADD CONSTRAINT "rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_boilerplate"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_boilerplate"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_boilerplate"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_boilerplate"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_cedula"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_cedula"."CedulaIntake"
    ADD CONSTRAINT "CedulaIntake_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_cedula"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_cedula"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_cedula"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Subscription"
    ADD CONSTRAINT "Subscription_last_stripe_cs_id_key" UNIQUE ("last_stripe_cs_id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Subscription"
    ADD CONSTRAINT "Subscription_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Subscription"
    ADD CONSTRAINT "Subscription_user_clerk_id_key" UNIQUE ("user_clerk_id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."Subscription"
    ADD CONSTRAINT "Subscription_user_email_key" UNIQUE ("user_email");



ALTER TABLE ONLY "tenant_jpvbootcamp"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."customer_provisioning"
    ADD CONSTRAINT "customer_provisioning_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."email_subscribers"
    ADD CONSTRAINT "email_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."partner_clicks"
    ADD CONSTRAINT "partner_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."partner_sessions"
    ADD CONSTRAINT "partner_sessions_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."sponsored_applications"
    ADD CONSTRAINT "sponsored_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."sponsored_grants"
    ADD CONSTRAINT "sponsored_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."sponsored_seats"
    ADD CONSTRAINT "sponsored_seats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."sponsored_seats"
    ADD CONSTRAINT "sponsored_seats_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."sponsored_seats"
    ADD CONSTRAINT "sponsored_seats_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "tenant_openfund"."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."CategorizationRule"
    ADD CONSTRAINT "CategorizationRule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."ImportBatch"
    ADD CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."LedgerLock"
    ADD CONSTRAINT "LedgerLock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."Ledger"
    ADD CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."OpeningBalance"
    ADD CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_openfund"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."LicenseEvent"
    ADD CONSTRAINT "LicenseEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."License"
    ADD CONSTRAINT "License_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."WaitlistSignup"
    ADD CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochat"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochattools"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochattools"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochattools"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prochattools"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_procore"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_procore"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prokit"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prokit"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prokitcore"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prokitcore"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prokitstudio"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_prokitstudio"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_resend"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_resend"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_key_name_key" UNIQUE ("user_id", "key_name");



ALTER TABLE ONLY "tenant_resend"."domains"
    ADD CONSTRAINT "domains_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "tenant_resend"."domains"
    ADD CONSTRAINT "domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_resend"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_resend"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "tenant_resend"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_resend"."waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_email_key" UNIQUE ("email");



ALTER TABLE ONLY "tenant_resend"."waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_resend"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskit"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskit"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskit"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskit"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitcore"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitcore"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitcore"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitcore"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitstudio"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitstudio"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitstudio"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saaskitstudio"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."Asset"
    ADD CONSTRAINT "Asset_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."CatalogProduct"
    ADD CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."CustomerAccount"
    ADD CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."DownloadEvent"
    ADD CONSTRAINT "DownloadEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."DownloadGrant"
    ADD CONSTRAINT "DownloadGrant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."EmailPreference"
    ADD CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "tenant_saysthebible"."EmailSendLog"
    ADD CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."EmailSequenceEnrollment"
    ADD CONSTRAINT "EmailSequenceEnrollment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."LibraryAccessLinkRequest"
    ADD CONSTRAINT "LibraryAccessLinkRequest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."MagicLink"
    ADD CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."PipelineJob"
    ADD CONSTRAINT "PipelineJob_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."ProductPrice"
    ADD CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."PurchaseAsset"
    ADD CONSTRAINT "PurchaseAsset_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."Purchase"
    ADD CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."StripeWebhookDelivery"
    ADD CONSTRAINT "StripeWebhookDelivery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."StripeWebhookEvent"
    ADD CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."UserSession"
    ADD CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_saysthebible"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."DeeplinkLog"
    ADD CONSTRAINT "DeeplinkLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Dossier"
    ADD CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Feedback"
    ADD CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Milestone"
    ADD CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."N8nRetry"
    ADD CONSTRAINT "N8nRetry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Participant"
    ADD CONSTRAINT "Participant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."PhaseDocumentRequirement"
    ADD CONSTRAINT "PhaseDocumentRequirement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."PhaseNotificationEvent"
    ADD CONSTRAINT "PhaseNotificationEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."PhaseViewEvent"
    ADD CONSTRAINT "PhaseViewEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."PushDelivery"
    ADD CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."PushSubscription"
    ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."SystemLog"
    ADD CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."UserSettings"
    ADD CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."WorkspaceBranding"
    ADD CONSTRAINT "WorkspaceBranding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tenant_statuslink"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Audiences"
    ADD CONSTRAINT "Audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."ImportBatch"
    ADD CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."LedgerLock"
    ADD CONSTRAINT "LedgerLock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Ledger"
    ADD CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ya_finance_schema"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



CREATE INDEX "customer_provisioning_plan_idx" ON "jpvbootcamp"."customer_provisioning" USING "btree" ("current_plan");



CREATE INDEX "customer_provisioning_status_idx" ON "jpvbootcamp"."customer_provisioning" USING "btree" ("status");



CREATE INDEX "stripe_webhook_events_type_idx" ON "jpvbootcamp"."stripe_webhook_events" USING "btree" ("type");



CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_index" ON "public"."personal_access_tokens" USING "btree" ("tokenable_type", "tokenable_id");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_boilerplate"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_boilerplate"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_boilerplate"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_boilerplate"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_boilerplate"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_cedula"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_cedula"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_cedula"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_cedula"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_cedula"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_jpvbootcamp"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "customer_provisioning_customer_uq" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE UNIQUE INDEX "customer_provisioning_email_uq" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "customer_provisioning_normalized_email_uq" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("normalized_email");



CREATE INDEX "customer_provisioning_stripe_customer_id_idx" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "customer_provisioning_stripe_customer_id_uq" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("stripe_customer_id") WHERE (("stripe_customer_id" IS NOT NULL) AND ("stripe_customer_id" <> ''::"text"));



CREATE INDEX "customer_provisioning_stripe_subscription_id_idx" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("stripe_subscription_id");



CREATE INDEX "customer_provisioning_subscription_idx" ON "tenant_jpvbootcamp"."customer_provisioning" USING "btree" ("stripe_subscription_id");



CREATE UNIQUE INDEX "email_subscribers_email_key" ON "tenant_jpvbootcamp"."email_subscribers" USING "btree" ("email");



CREATE INDEX "partner_clicks_category_slug_idx" ON "tenant_jpvbootcamp"."partner_clicks" USING "btree" ("category_slug");



CREATE INDEX "partner_clicks_created_at_idx" ON "tenant_jpvbootcamp"."partner_clicks" USING "btree" ("created_at");



CREATE INDEX "partner_clicks_partner_slug_idx" ON "tenant_jpvbootcamp"."partner_clicks" USING "btree" ("partner_slug");



CREATE INDEX "partner_clicks_session_id_idx" ON "tenant_jpvbootcamp"."partner_clicks" USING "btree" ("session_id");



CREATE INDEX "partner_clicks_wp_user_id_idx" ON "tenant_jpvbootcamp"."partner_clicks" USING "btree" ("wp_user_id");



CREATE INDEX "partner_sessions_expires_at_idx" ON "tenant_jpvbootcamp"."partner_sessions" USING "btree" ("expires_at");



CREATE INDEX "partner_sessions_wp_user_id_idx" ON "tenant_jpvbootcamp"."partner_sessions" USING "btree" ("wp_user_id");



CREATE INDEX "sponsored_applications_status_idx" ON "tenant_jpvbootcamp"."sponsored_applications" USING "btree" ("status");



CREATE INDEX "sponsored_applications_wp_user_id_idx" ON "tenant_jpvbootcamp"."sponsored_applications" USING "btree" ("wp_user_id");



CREATE INDEX "sponsored_grants_ends_at_idx" ON "tenant_jpvbootcamp"."sponsored_grants" USING "btree" ("ends_at");



CREATE INDEX "sponsored_grants_wp_user_id_idx" ON "tenant_jpvbootcamp"."sponsored_grants" USING "btree" ("wp_user_id");



CREATE INDEX "sponsored_seats_claimed_by_wp_user_id_idx" ON "tenant_jpvbootcamp"."sponsored_seats" USING "btree" ("claimed_by_wp_user_id");



CREATE INDEX "sponsored_seats_created_at_idx" ON "tenant_jpvbootcamp"."sponsored_seats" USING "btree" ("created_at");



CREATE INDEX "sponsored_seats_reserved_by_application_id_idx" ON "tenant_jpvbootcamp"."sponsored_seats" USING "btree" ("reserved_by_application_id");



CREATE UNIQUE INDEX "stripe_webhook_events_event_id_idx" ON "tenant_jpvbootcamp"."stripe_webhook_events" USING "btree" ("event_id");



CREATE INDEX "stripe_webhook_events_event_type_idx" ON "tenant_jpvbootcamp"."stripe_webhook_events" USING "btree" ("event_type");



CREATE INDEX "stripe_webhook_events_received_at_idx" ON "tenant_jpvbootcamp"."stripe_webhook_events" USING "btree" ("received_at" DESC);



CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_uq" ON "tenant_jpvbootcamp"."stripe_webhook_events" USING "btree" ("stripe_event_id");



CREATE UNIQUE INDEX "Account_userId_identifier_key" ON "tenant_openfund"."Account" USING "btree" ("userId", "identifier");



CREATE INDEX "Account_userId_idx" ON "tenant_openfund"."Account" USING "btree" ("userId");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_openfund"."Audiences" USING "btree" ("resend_id");



CREATE INDEX "CategorizationRule_ledgerId_idx" ON "tenant_openfund"."CategorizationRule" USING "btree" ("ledgerId");



CREATE INDEX "CategorizationRule_userId_isActive_priority_idx" ON "tenant_openfund"."CategorizationRule" USING "btree" ("userId", "isActive", "priority");



CREATE UNIQUE INDEX "Category_name_key" ON "tenant_openfund"."Category" USING "btree" ("name");



CREATE INDEX "ImportBatch_userId_startedAt_idx" ON "tenant_openfund"."ImportBatch" USING "btree" ("userId", "startedAt");



CREATE UNIQUE INDEX "LedgerLock_ledgerId_key" ON "tenant_openfund"."LedgerLock" USING "btree" ("ledgerId");



CREATE UNIQUE INDEX "Ledger_userId_month_year_key" ON "tenant_openfund"."Ledger" USING "btree" ("userId", "month", "year");



CREATE INDEX "OpeningBalance_accountId_effectiveDate_idx" ON "tenant_openfund"."OpeningBalance" USING "btree" ("accountId", "effectiveDate");



CREATE UNIQUE INDEX "OpeningBalance_accountId_effectiveDate_key" ON "tenant_openfund"."OpeningBalance" USING "btree" ("accountId", "effectiveDate");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_openfund"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_openfund"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_openfund"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_openfund"."Subscription" USING "btree" ("user_email");



CREATE INDEX "Transaction_classificationRuleId_idx" ON "tenant_openfund"."Transaction" USING "btree" ("classificationRuleId");



CREATE UNIQUE INDEX "Transaction_hash_key" ON "tenant_openfund"."Transaction" USING "btree" ("hash");



CREATE INDEX "Transaction_userId_accountId_date_idx" ON "tenant_openfund"."Transaction" USING "btree" ("userId", "accountId", "date");



CREATE INDEX "Transaction_userId_date_idx" ON "tenant_openfund"."Transaction" USING "btree" ("userId", "date");



CREATE UNIQUE INDEX "Transaction_userId_importFingerprint_key" ON "tenant_openfund"."Transaction" USING "btree" ("userId", "importFingerprint");



CREATE INDEX "Transaction_userId_normalizedKey_amountMinor_idx" ON "tenant_openfund"."Transaction" USING "btree" ("userId", "normalizedKey", "amountMinor");



CREATE UNIQUE INDEX "User_email_key" ON "tenant_openfund"."User" USING "btree" ("email");



CREATE INDEX "tenant_openfund_migrations_name_idx" ON "tenant_openfund"."_prisma_migrations" USING "btree" ("migration_name");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_prochat"."Audiences" USING "btree" ("resend_id");



CREATE INDEX "LicenseEvent_license_id_type_idx" ON "tenant_prochat"."LicenseEvent" USING "btree" ("license_id", "type");



CREATE UNIQUE INDEX "License_payment_reference_key" ON "tenant_prochat"."License" USING "btree" ("payment_reference");



CREATE INDEX "License_product_access_status_idx" ON "tenant_prochat"."License" USING "btree" ("product", "access_status");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_prochat"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_prochat"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_prochat"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_prochat"."Subscription" USING "btree" ("user_email");



CREATE INDEX "WaitlistSignup_source_created_at_idx" ON "tenant_prochat"."WaitlistSignup" USING "btree" ("source", "created_at");



CREATE UNIQUE INDEX "WaitlistSignup_unsubscribe_token_key" ON "tenant_prochat"."WaitlistSignup" USING "btree" ("unsubscribe_token");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_prochattools"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_prochattools"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_prochattools"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_prochattools"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_prochattools"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_procore"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_procore"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_procore"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_procore"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_prokit"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_prokit"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_prokit"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_prokit"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_prokitcore"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_prokitcore"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_prokitcore"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_prokitcore"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_prokitstudio"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_prokitstudio"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_prokitstudio"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_prokitstudio"."Subscription" USING "btree" ("user_email");



CREATE INDEX "idx_api_keys_domain_id" ON "tenant_resend"."api_keys" USING "btree" ("domain_id");



CREATE INDEX "idx_api_keys_key_hash" ON "tenant_resend"."api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_api_keys_user_id" ON "tenant_resend"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_domains_domain" ON "tenant_resend"."domains" USING "btree" ("domain");



CREATE INDEX "idx_domains_user_id" ON "tenant_resend"."domains" USING "btree" ("user_id");



CREATE INDEX "idx_email_logs_api_key_id" ON "tenant_resend"."email_logs" USING "btree" ("api_key_id");



CREATE INDEX "idx_email_logs_created_at" ON "tenant_resend"."email_logs" USING "btree" ("created_at");



CREATE INDEX "idx_email_logs_domain_id" ON "tenant_resend"."email_logs" USING "btree" ("domain_id");



CREATE INDEX "idx_email_logs_message_id" ON "tenant_resend"."email_logs" USING "btree" ("message_id");



CREATE INDEX "idx_waitlist_signups_created_at" ON "tenant_resend"."waitlist_signups" USING "btree" ("created_at");



CREATE INDEX "idx_waitlist_signups_email" ON "tenant_resend"."waitlist_signups" USING "btree" ("email");



CREATE INDEX "idx_waitlist_signups_utm_source" ON "tenant_resend"."waitlist_signups" USING "btree" ("utm_source");



CREATE INDEX "idx_webhook_events_email_log_id" ON "tenant_resend"."webhook_events" USING "btree" ("email_log_id");



CREATE INDEX "idx_webhook_events_processed" ON "tenant_resend"."webhook_events" USING "btree" ("processed");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_saaskit"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_saaskit"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_saaskit"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_saaskit"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_saaskit"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_saaskitcore"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_saaskitcore"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_saaskitcore"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_saaskitcore"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_saaskitcore"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_saaskitstudio"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_saaskitstudio"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_saaskitstudio"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_saaskitstudio"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_saaskitstudio"."Subscription" USING "btree" ("user_email");



CREATE INDEX "Asset_catalogProductId_active_createdAt_idx" ON "tenant_saysthebible"."Asset" USING "btree" ("catalogProductId", "active", "createdAt");



CREATE UNIQUE INDEX "Asset_objectPath_key" ON "tenant_saysthebible"."Asset" USING "btree" ("objectPath");



CREATE INDEX "Asset_slug_active_createdAt_idx" ON "tenant_saysthebible"."Asset" USING "btree" ("slug", "active", "createdAt");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "tenant_saysthebible"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "CatalogProduct_slug_key" ON "tenant_saysthebible"."CatalogProduct" USING "btree" ("slug");



CREATE UNIQUE INDEX "CatalogProduct_stripeProductId_key" ON "tenant_saysthebible"."CatalogProduct" USING "btree" ("stripeProductId");



CREATE UNIQUE INDEX "CustomerAccount_clerkUserId_key" ON "tenant_saysthebible"."CustomerAccount" USING "btree" ("clerkUserId");



CREATE UNIQUE INDEX "CustomerAccount_email_key" ON "tenant_saysthebible"."CustomerAccount" USING "btree" ("email");



CREATE INDEX "DownloadEvent_assetId_createdAt_idx" ON "tenant_saysthebible"."DownloadEvent" USING "btree" ("assetId", "createdAt");



CREATE INDEX "DownloadEvent_purchaseId_createdAt_idx" ON "tenant_saysthebible"."DownloadEvent" USING "btree" ("purchaseId", "createdAt");



CREATE INDEX "DownloadGrant_ipHash_createdAt_idx" ON "tenant_saysthebible"."DownloadGrant" USING "btree" ("ipHash", "createdAt");



CREATE INDEX "DownloadGrant_purchaseId_createdAt_idx" ON "tenant_saysthebible"."DownloadGrant" USING "btree" ("purchaseId", "createdAt");



CREATE INDEX "DownloadGrant_userId_createdAt_idx" ON "tenant_saysthebible"."DownloadGrant" USING "btree" ("userId", "createdAt");



CREATE INDEX "EmailSendLog_email_sequenceKey_status_idx" ON "tenant_saysthebible"."EmailSendLog" USING "btree" ("email", "sequenceKey", "status");



CREATE INDEX "EmailSendLog_enrollmentId_createdAt_idx" ON "tenant_saysthebible"."EmailSendLog" USING "btree" ("enrollmentId", "createdAt");



CREATE UNIQUE INDEX "EmailSendLog_sequenceKey_step_email_key" ON "tenant_saysthebible"."EmailSendLog" USING "btree" ("sequenceKey", "step", "email");



CREATE UNIQUE INDEX "EmailSendLog_unsubscribeTokenHash_key" ON "tenant_saysthebible"."EmailSendLog" USING "btree" ("unsubscribeTokenHash");



CREATE UNIQUE INDEX "EmailSequenceEnrollment_email_sequenceKey_key" ON "tenant_saysthebible"."EmailSequenceEnrollment" USING "btree" ("email", "sequenceKey");



CREATE INDEX "EmailSequenceEnrollment_email_sequenceKey_status_idx" ON "tenant_saysthebible"."EmailSequenceEnrollment" USING "btree" ("email", "sequenceKey", "status");



CREATE INDEX "EmailSequenceEnrollment_status_nextSendAt_idx" ON "tenant_saysthebible"."EmailSequenceEnrollment" USING "btree" ("status", "nextSendAt");



CREATE INDEX "LibraryAccessLinkRequest_email_createdAt_idx" ON "tenant_saysthebible"."LibraryAccessLinkRequest" USING "btree" ("email", "createdAt");



CREATE INDEX "LibraryAccessLinkRequest_ipAddress_createdAt_idx" ON "tenant_saysthebible"."LibraryAccessLinkRequest" USING "btree" ("ipAddress", "createdAt");



CREATE UNIQUE INDEX "MagicLink_tokenHash_key" ON "tenant_saysthebible"."MagicLink" USING "btree" ("tokenHash");



CREATE INDEX "MagicLink_userId_createdAt_idx" ON "tenant_saysthebible"."MagicLink" USING "btree" ("userId", "createdAt");



CREATE UNIQUE INDEX "PipelineJob_slug_key" ON "tenant_saysthebible"."PipelineJob" USING "btree" ("slug");



CREATE INDEX "PipelineJob_status_createdAt_idx" ON "tenant_saysthebible"."PipelineJob" USING "btree" ("status", "createdAt");



CREATE INDEX "ProductPrice_productId_currency_active_idx" ON "tenant_saysthebible"."ProductPrice" USING "btree" ("productId", "currency", "active");



CREATE UNIQUE INDEX "ProductPrice_stripePriceId_key" ON "tenant_saysthebible"."ProductPrice" USING "btree" ("stripePriceId");



CREATE INDEX "PurchaseAsset_assetId_createdAt_idx" ON "tenant_saysthebible"."PurchaseAsset" USING "btree" ("assetId", "createdAt");



CREATE UNIQUE INDEX "PurchaseAsset_purchaseId_variant_key" ON "tenant_saysthebible"."PurchaseAsset" USING "btree" ("purchaseId", "variant");



CREATE INDEX "Purchase_productSlug_createdAt_idx" ON "tenant_saysthebible"."Purchase" USING "btree" ("productSlug", "createdAt");



CREATE UNIQUE INDEX "Purchase_stripeCheckoutSessionId_key" ON "tenant_saysthebible"."Purchase" USING "btree" ("stripeCheckoutSessionId");



CREATE INDEX "Purchase_userId_createdAt_idx" ON "tenant_saysthebible"."Purchase" USING "btree" ("userId", "createdAt");



CREATE INDEX "StripeWebhookDelivery_receivedAt_idx" ON "tenant_saysthebible"."StripeWebhookDelivery" USING "btree" ("receivedAt");



CREATE UNIQUE INDEX "StripeWebhookDelivery_stripeEventId_key" ON "tenant_saysthebible"."StripeWebhookDelivery" USING "btree" ("stripeEventId");



CREATE INDEX "StripeWebhookDelivery_type_receivedAt_idx" ON "tenant_saysthebible"."StripeWebhookDelivery" USING "btree" ("type", "receivedAt");



CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "tenant_saysthebible"."StripeWebhookEvent" USING "btree" ("stripeEventId");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "tenant_saysthebible"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "tenant_saysthebible"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "tenant_saysthebible"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "tenant_saysthebible"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "tenant_saysthebible"."UserSession" USING "btree" ("tokenHash");



CREATE INDEX "UserSession_userId_createdAt_idx" ON "tenant_saysthebible"."UserSession" USING "btree" ("userId", "createdAt");



CREATE INDEX "DeeplinkLog_email_idx" ON "tenant_statuslink"."DeeplinkLog" USING "btree" ("email");



CREATE INDEX "DeeplinkLog_stripeCustomerId_idx" ON "tenant_statuslink"."DeeplinkLog" USING "btree" ("stripeCustomerId");



CREATE UNIQUE INDEX "Dossier_adminToken_key" ON "tenant_statuslink"."Dossier" USING "btree" ("adminToken");



CREATE UNIQUE INDEX "Dossier_dossierNumber_key" ON "tenant_statuslink"."Dossier" USING "btree" ("dossierNumber");



CREATE UNIQUE INDEX "Dossier_publicTokenJti_key" ON "tenant_statuslink"."Dossier" USING "btree" ("publicTokenJti");



CREATE INDEX "Message_dossierId_createdAt_idx" ON "tenant_statuslink"."Message" USING "btree" ("dossierId", "createdAt");



CREATE INDEX "Message_participantId_idx" ON "tenant_statuslink"."Message" USING "btree" ("participantId");



CREATE INDEX "Message_targetParticipantId_idx" ON "tenant_statuslink"."Message" USING "btree" ("targetParticipantId");



CREATE UNIQUE INDEX "Organization_workspaceId_key" ON "tenant_statuslink"."Organization" USING "btree" ("workspaceId");



CREATE UNIQUE INDEX "Participant_linkToken_key" ON "tenant_statuslink"."Participant" USING "btree" ("linkToken");



CREATE INDEX "PhaseDocumentRequirement_completedByParticipantId_idx" ON "tenant_statuslink"."PhaseDocumentRequirement" USING "btree" ("completedByParticipantId");



CREATE INDEX "PhaseDocumentRequirement_dossierId_idx" ON "tenant_statuslink"."PhaseDocumentRequirement" USING "btree" ("dossierId");



CREATE INDEX "PhaseDocumentRequirement_milestoneId_idx" ON "tenant_statuslink"."PhaseDocumentRequirement" USING "btree" ("milestoneId");



CREATE INDEX "PhaseNotificationEvent_dossierId_idx" ON "tenant_statuslink"."PhaseNotificationEvent" USING "btree" ("dossierId");



CREATE INDEX "PhaseNotificationEvent_milestoneId_idx" ON "tenant_statuslink"."PhaseNotificationEvent" USING "btree" ("milestoneId");



CREATE INDEX "PhaseNotificationEvent_participantId_idx" ON "tenant_statuslink"."PhaseNotificationEvent" USING "btree" ("participantId");



CREATE INDEX "PhaseViewEvent_dossierId_idx" ON "tenant_statuslink"."PhaseViewEvent" USING "btree" ("dossierId");



CREATE INDEX "PhaseViewEvent_milestoneId_idx" ON "tenant_statuslink"."PhaseViewEvent" USING "btree" ("milestoneId");



CREATE INDEX "PhaseViewEvent_participantId_idx" ON "tenant_statuslink"."PhaseViewEvent" USING "btree" ("participantId");



CREATE INDEX "PushDelivery_dossierId_idx" ON "tenant_statuslink"."PushDelivery" USING "btree" ("dossierId");



CREATE INDEX "PushDelivery_subscriptionId_idx" ON "tenant_statuslink"."PushDelivery" USING "btree" ("subscriptionId");



CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "tenant_statuslink"."PushSubscription" USING "btree" ("endpoint");



CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "tenant_statuslink"."Subscription" USING "btree" ("stripeCustomerId");



CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "tenant_statuslink"."Subscription" USING "btree" ("stripeSubscriptionId");



CREATE INDEX "Subscription_trialActive_trialEndsAt_idx" ON "tenant_statuslink"."Subscription" USING "btree" ("trialActive", "trialEndsAt");



CREATE UNIQUE INDEX "Subscription_userId_key" ON "tenant_statuslink"."Subscription" USING "btree" ("userId");



CREATE UNIQUE INDEX "UserSettings_userId_key" ON "tenant_statuslink"."UserSettings" USING "btree" ("userId");



CREATE UNIQUE INDEX "WorkspaceBranding_workspaceId_key" ON "tenant_statuslink"."WorkspaceBranding" USING "btree" ("workspaceId");



CREATE UNIQUE INDEX "Account_userId_identifier_key" ON "ya_finance_schema"."Account" USING "btree" ("userId", "identifier");



CREATE INDEX "Account_userId_idx" ON "ya_finance_schema"."Account" USING "btree" ("userId");



CREATE UNIQUE INDEX "Audiences_resend_id_key" ON "ya_finance_schema"."Audiences" USING "btree" ("resend_id");



CREATE UNIQUE INDEX "Category_name_key" ON "ya_finance_schema"."Category" USING "btree" ("name");



CREATE INDEX "ImportBatch_userId_startedAt_idx" ON "ya_finance_schema"."ImportBatch" USING "btree" ("userId", "startedAt");



CREATE UNIQUE INDEX "LedgerLock_ledgerId_key" ON "ya_finance_schema"."LedgerLock" USING "btree" ("ledgerId");



CREATE UNIQUE INDEX "Ledger_userId_month_year_key" ON "ya_finance_schema"."Ledger" USING "btree" ("userId", "month", "year");



CREATE UNIQUE INDEX "Subscription_last_stripe_cs_id_key" ON "ya_finance_schema"."Subscription" USING "btree" ("last_stripe_cs_id");



CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "ya_finance_schema"."Subscription" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "Subscription_user_clerk_id_key" ON "ya_finance_schema"."Subscription" USING "btree" ("user_clerk_id");



CREATE UNIQUE INDEX "Subscription_user_email_key" ON "ya_finance_schema"."Subscription" USING "btree" ("user_email");



CREATE UNIQUE INDEX "Transaction_hash_key" ON "ya_finance_schema"."Transaction" USING "btree" ("hash");



CREATE INDEX "Transaction_userId_accountId_date_idx" ON "ya_finance_schema"."Transaction" USING "btree" ("userId", "accountId", "date");



CREATE INDEX "Transaction_userId_date_idx" ON "ya_finance_schema"."Transaction" USING "btree" ("userId", "date");



CREATE INDEX "Transaction_userId_normalizedKey_amountMinor_idx" ON "ya_finance_schema"."Transaction" USING "btree" ("userId", "normalizedKey", "amountMinor");



CREATE UNIQUE INDEX "User_email_key" ON "ya_finance_schema"."User" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "trg_sync_customer_provisioning_plans" BEFORE INSERT OR UPDATE ON "tenant_jpvbootcamp"."customer_provisioning" FOR EACH ROW EXECUTE FUNCTION "tenant_jpvbootcamp"."sync_customer_provisioning_plans"();



CREATE OR REPLACE TRIGGER "update_api_keys_updated_at" BEFORE UPDATE ON "tenant_resend"."api_keys" FOR EACH ROW EXECUTE FUNCTION "tenant_resend"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_domains_updated_at" BEFORE UPDATE ON "tenant_resend"."domains" FOR EACH ROW EXECUTE FUNCTION "tenant_resend"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_logs_updated_at" BEFORE UPDATE ON "tenant_resend"."email_logs" FOR EACH ROW EXECUTE FUNCTION "tenant_resend"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "tenant_resend"."users" FOR EACH ROW EXECUTE FUNCTION "tenant_resend"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_waitlist_signups_updated_at" BEFORE UPDATE ON "tenant_resend"."waitlist_signups" FOR EACH ROW EXECUTE FUNCTION "tenant_resend"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_organization_updated_at" BEFORE UPDATE ON "tenant_statuslink"."Organization" FOR EACH ROW EXECUTE FUNCTION "tenant_statuslink"."set_current_timestamp_updated_at_organization"();



ALTER TABLE ONLY "public"."cash_accounts"
    ADD CONSTRAINT "cash_accounts_institution_id_foreign" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."cash_accounts"
    ADD CONSTRAINT "cash_accounts_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_group_id_foreign" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_institution_id_foreign" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_institution_id_foreign" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."rules"
    ADD CONSTRAINT "rules_category_id_foreign" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_foreign" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "tenant_jpvbootcamp"."sponsored_grants"
    ADD CONSTRAINT "sponsored_grants_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "tenant_jpvbootcamp"."sponsored_seats"("id");



ALTER TABLE ONLY "tenant_openfund"."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_openfund"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_openfund"."CategorizationRule"
    ADD CONSTRAINT "CategorizationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "tenant_openfund"."Category"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "tenant_openfund"."CategorizationRule"
    ADD CONSTRAINT "CategorizationRule_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "tenant_openfund"."ImportBatch"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."CategorizationRule"
    ADD CONSTRAINT "CategorizationRule_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "tenant_openfund"."Ledger"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."CategorizationRule"
    ADD CONSTRAINT "CategorizationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_openfund"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_openfund"."ImportBatch"
    ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_openfund"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_openfund"."LedgerLock"
    ADD CONSTRAINT "LedgerLock_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "tenant_openfund"."Ledger"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_openfund"."Ledger"
    ADD CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_openfund"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "tenant_openfund"."OpeningBalance"
    ADD CONSTRAINT "OpeningBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "tenant_openfund"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "tenant_openfund"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "tenant_openfund"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_classificationRuleId_fkey" FOREIGN KEY ("classificationRuleId") REFERENCES "tenant_openfund"."CategorizationRule"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "tenant_openfund"."ImportBatch"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "tenant_openfund"."Ledger"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_openfund"."Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_openfund"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "tenant_prochat"."LicenseEvent"
    ADD CONSTRAINT "LicenseEvent_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "tenant_prochat"."License"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "tenant_resend"."api_keys"
    ADD CONSTRAINT "api_keys_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "tenant_resend"."domains"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_resend"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_resend"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_resend"."domains"
    ADD CONSTRAINT "domains_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_resend"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_resend"."email_logs"
    ADD CONSTRAINT "email_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "tenant_resend"."api_keys"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_resend"."email_logs"
    ADD CONSTRAINT "email_logs_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "tenant_resend"."domains"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_resend"."webhook_events"
    ADD CONSTRAINT "webhook_events_email_log_id_fkey" FOREIGN KEY ("email_log_id") REFERENCES "tenant_resend"."email_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."Asset"
    ADD CONSTRAINT "Asset_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "tenant_saysthebible"."CatalogProduct"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_saysthebible"."DownloadEvent"
    ADD CONSTRAINT "DownloadEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "tenant_saysthebible"."Asset"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."DownloadEvent"
    ADD CONSTRAINT "DownloadEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "tenant_saysthebible"."Purchase"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."DownloadGrant"
    ADD CONSTRAINT "DownloadGrant_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "tenant_saysthebible"."Purchase"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."EmailSendLog"
    ADD CONSTRAINT "EmailSendLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "tenant_saysthebible"."EmailSequenceEnrollment"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."EmailSequenceEnrollment"
    ADD CONSTRAINT "EmailSequenceEnrollment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "tenant_saysthebible"."Purchase"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_saysthebible"."EmailSequenceEnrollment"
    ADD CONSTRAINT "EmailSequenceEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_saysthebible"."CustomerAccount"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_saysthebible"."MagicLink"
    ADD CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_saysthebible"."CustomerAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."ProductPrice"
    ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "tenant_saysthebible"."CatalogProduct"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."PurchaseAsset"
    ADD CONSTRAINT "PurchaseAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "tenant_saysthebible"."Asset"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."PurchaseAsset"
    ADD CONSTRAINT "PurchaseAsset_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "tenant_saysthebible"."Purchase"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."Purchase"
    ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_saysthebible"."CustomerAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_saysthebible"."UserSession"
    ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_saysthebible"."CustomerAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."Event"
    ADD CONSTRAINT "Event_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."Feedback"
    ADD CONSTRAINT "Feedback_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."Message"
    ADD CONSTRAINT "Message_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."Message"
    ADD CONSTRAINT "Message_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_statuslink"."Message"
    ADD CONSTRAINT "Message_targetParticipantId_fkey" FOREIGN KEY ("targetParticipantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_statuslink"."Milestone"
    ADD CONSTRAINT "Milestone_assignedToParticipantId_fkey" FOREIGN KEY ("assignedToParticipantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_statuslink"."Milestone"
    ADD CONSTRAINT "Milestone_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."Participant"
    ADD CONSTRAINT "Participant_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseDocumentRequirement"
    ADD CONSTRAINT "PhaseDocumentRequirement_completedByParticipantId_fkey" FOREIGN KEY ("completedByParticipantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_statuslink"."PhaseDocumentRequirement"
    ADD CONSTRAINT "PhaseDocumentRequirement_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseDocumentRequirement"
    ADD CONSTRAINT "PhaseDocumentRequirement_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "tenant_statuslink"."Milestone"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseNotificationEvent"
    ADD CONSTRAINT "PhaseNotificationEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseNotificationEvent"
    ADD CONSTRAINT "PhaseNotificationEvent_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "tenant_statuslink"."Milestone"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseNotificationEvent"
    ADD CONSTRAINT "PhaseNotificationEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_statuslink"."PhaseViewEvent"
    ADD CONSTRAINT "PhaseViewEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseViewEvent"
    ADD CONSTRAINT "PhaseViewEvent_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "tenant_statuslink"."Milestone"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PhaseViewEvent"
    ADD CONSTRAINT "PhaseViewEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "tenant_statuslink"."PushDelivery"
    ADD CONSTRAINT "PushDelivery_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PushDelivery"
    ADD CONSTRAINT "PushDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "tenant_statuslink"."PushSubscription"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PushSubscription"
    ADD CONSTRAINT "PushSubscription_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "tenant_statuslink"."Dossier"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."PushSubscription"
    ADD CONSTRAINT "PushSubscription_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tenant_statuslink"."Participant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_statuslink"."UserSettings"("userId") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tenant_statuslink"."WorkspaceBranding"
    ADD CONSTRAINT "WorkspaceBranding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "tenant_statuslink"."UserSettings"("userId") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "ya_finance_schema"."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ya_finance_schema"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "ya_finance_schema"."ImportBatch"
    ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ya_finance_schema"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "ya_finance_schema"."LedgerLock"
    ADD CONSTRAINT "LedgerLock_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ya_finance_schema"."Ledger"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "ya_finance_schema"."Ledger"
    ADD CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ya_finance_schema"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "ya_finance_schema"."Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ya_finance_schema"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "ya_finance_schema"."Transaction"
    ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ya_finance_schema"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "ya_finance_schema"."Transaction"
    ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ya_finance_schema"."ImportBatch"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "ya_finance_schema"."Transaction"
    ADD CONSTRAINT "Transaction_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ya_finance_schema"."Ledger"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "ya_finance_schema"."Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ya_finance_schema"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "financialfreedom_schema" TO "newrelic_monitor";



GRANT ALL ON SCHEMA "jpvbootcamp" TO "tenant_jpvbootcamp_user";



GRANT USAGE ON SCHEMA "maybe_schema" TO "newrelic_monitor";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON SCHEMA "public" TO "financialfreedom_user";
GRANT USAGE ON SCHEMA "public" TO "newrelic_monitor";
GRANT ALL ON SCHEMA "public" TO "mcp_manager";
GRANT ALL ON SCHEMA "public" TO "umami";



GRANT ALL ON SCHEMA "tenant_boilerplate" TO "tenant_boilerplate_user";



GRANT ALL ON SCHEMA "tenant_cedula" TO "tenant_cedula_user";



GRANT ALL ON SCHEMA "tenant_jpvbootcamp" TO "tenant_jpvbootcamp_user";



GRANT ALL ON SCHEMA "tenant_olivetoorganizing" TO "tenant_olivetoorganizing_user";



GRANT ALL ON SCHEMA "tenant_openfund" TO "tenant_openfund_user";



GRANT ALL ON SCHEMA "tenant_prochat" TO "tenant_prochat_user";



GRANT ALL ON SCHEMA "tenant_prochattools" TO "tenant_prochattools_user";



GRANT ALL ON SCHEMA "tenant_procore" TO "tenant_procore_user";



GRANT ALL ON SCHEMA "tenant_prokit" TO "tenant_prokit_user";



GRANT ALL ON SCHEMA "tenant_prokitcore" TO "tenant_prokitcore_user";



GRANT ALL ON SCHEMA "tenant_prokitstudio" TO "tenant_prokitstudio_user";



GRANT ALL ON SCHEMA "tenant_rebuildwp" TO "tenant_rebuildwp_user";



GRANT ALL ON SCHEMA "tenant_saaskit" TO "tenant_saaskit_user";



GRANT ALL ON SCHEMA "tenant_saaskitcore" TO "tenant_saaskitcore_user";



GRANT ALL ON SCHEMA "tenant_saaskitstudio" TO "tenant_saaskitstudio_user";



GRANT ALL ON SCHEMA "tenant_saysthebible" TO "tenant_saysthebible_user";



GRANT ALL ON SCHEMA "tenant_viadieden" TO "tenant_viadieden_user";



GRANT USAGE ON SCHEMA "ya_finance_schema" TO "newrelic_monitor";











































































































































































GRANT ALL ON FUNCTION "tenant_jpvbootcamp"."sync_customer_provisioning_plans"() TO "tenant_jpvbootcamp_user";


















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "jpvbootcamp"."customer_provisioning" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "jpvbootcamp"."stripe_webhook_events" TO "tenant_jpvbootcamp_user";









GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."WaitlistSubscriber" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."WaitlistSubscriber" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."WaitlistSubscriber" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."WaitlistSubscriber" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."WaitlistSubscriber" TO "financialfreedom_user";
GRANT SELECT ON TABLE "public"."WaitlistSubscriber" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."WaitlistSubscriber" TO "mcp_manager";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."_prisma_migrations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."_prisma_migrations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."_prisma_migrations" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."_prisma_migrations" TO "financialfreedom_user";
GRANT SELECT ON TABLE "public"."_prisma_migrations" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."_prisma_migrations" TO "mcp_manager";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."audiences" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."audiences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."audiences" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."audiences" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."audiences" TO "financialfreedom_user";
GRANT SELECT ON TABLE "public"."audiences" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."audiences" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."cash_accounts" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cash_accounts" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."cash_accounts_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."categories" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."categories" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."credit_cards" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."credit_cards" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."credit_cards_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."failed_jobs" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."failed_jobs" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."failed_jobs_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."groups" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."groups" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."groups_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."institutions" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."institutions" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."institutions_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."loans" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."loans" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."loans_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."migrations" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."migrations" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."migrations_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."password_reset_tokens" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."password_reset_tokens" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."personal_access_tokens" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."personal_access_tokens" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."personal_access_tokens_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."rules" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rules" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."rules_id_seq" TO "mcp_manager";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tenants" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tenants" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tenants" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tenants" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."transactions" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transactions" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "mcp_manager";



GRANT SELECT ON TABLE "public"."users" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "mcp_manager";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "mcp_manager";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Audiences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Audiences" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Audiences" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Audiences" TO "financialfreedom_user";
GRANT SELECT ON TABLE "tenant_jpvbootcamp"."Audiences" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Audiences" TO "mcp_manager";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Audiences" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "financialfreedom_user";
GRANT SELECT ON TABLE "tenant_jpvbootcamp"."Project" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "mcp_manager";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Project" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "financialfreedom_user";
GRANT SELECT ON TABLE "tenant_jpvbootcamp"."Subscription" TO "newrelic_monitor";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "mcp_manager";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."Subscription" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."customer_provisioning" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."email_subscribers" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."partner_clicks" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."partner_sessions" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."sponsored_applications" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."sponsored_grants" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."sponsored_seats" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_jpvbootcamp"."stripe_webhook_events" TO "tenant_jpvbootcamp_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Account" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Audiences" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."CategorizationRule" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Category" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."ImportBatch" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Ledger" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."LedgerLock" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."OpeningBalance" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Project" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Subscription" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."Transaction" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."User" TO "tenant_openfund_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "tenant_openfund"."_prisma_migrations" TO "tenant_openfund_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "tenant_resend"."api_keys" TO "tenant_resend_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "tenant_resend"."domains" TO "tenant_resend_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "tenant_resend"."email_logs" TO "tenant_resend_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "tenant_resend"."users" TO "tenant_resend_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "tenant_resend"."waitlist_signups" TO "tenant_resend_user";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "tenant_resend"."webhook_events" TO "tenant_resend_user";









ALTER DEFAULT PRIVILEGES FOR ROLE "financialfreedom_user" IN SCHEMA "financialfreedom_schema" GRANT ALL ON SEQUENCES TO "financialfreedom_user";









ALTER DEFAULT PRIVILEGES FOR ROLE "financialfreedom_user" IN SCHEMA "financialfreedom_schema" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "financialfreedom_user";






ALTER DEFAULT PRIVILEGES FOR ROLE "maybe_user" IN SCHEMA "maybe_schema" GRANT ALL ON SEQUENCES TO "maybe_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "maybe_user" IN SCHEMA "maybe_schema" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "maybe_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";















ALTER DEFAULT PRIVILEGES FOR ROLE "mcp_manager" IN SCHEMA "tenant_openfund" GRANT ALL ON SEQUENCES TO "tenant_openfund_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "mcp_manager" IN SCHEMA "tenant_openfund" GRANT ALL ON FUNCTIONS TO "tenant_openfund_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "mcp_manager" IN SCHEMA "tenant_openfund" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "tenant_openfund_user";


















ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tenant_statuslink" GRANT ALL ON SEQUENCES TO "tenant_statuslink_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tenant_statuslink" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "tenant_statuslink_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "ya_finance_user" IN SCHEMA "ya_finance_schema" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "ya_finance_user";
