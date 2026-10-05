CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "consents" DROP CONSTRAINT "consents_purpose";--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_purpose" CHECK ("consents"."purpose" in ('terms', 'privacy', 'adult', 'ai_external', 'bank_connection'));--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_id" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_same_user" FOREIGN KEY ("user_id","device_id") REFERENCES "public"."devices"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
-- AM-03 (T-019): refresh_tokens, aislada como las demás tablas del usuario.
GRANT SELECT, INSERT, UPDATE, DELETE ON "refresh_tokens" TO luka_app;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "refresh_tokens" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());--> statement-breakpoint
-- AM-03 (T-019). El inicio de sesión, el registro y el refresco leen users y refresh_tokens antes de
-- saber quién es el usuario. Lo hacen solo las funciones auth.*, que corren como luka_auth: un rol sin
-- inicio de sesión ni BYPASSRLS cuyas políticas solo dejan ver lo que la función fijó (un correo, un
-- id o un hash). Crear el rol y darle sus funciones es un paso privilegiado (T-040).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'luka_auth') THEN
    CREATE ROLE luka_auth NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;--> statement-breakpoint
CREATE FUNCTION app.auth_email() RETURNS public.citext LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.auth_email', true), '')::public.citext
$$;--> statement-breakpoint
CREATE FUNCTION app.auth_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.auth_user_id', true), '')::uuid
$$;--> statement-breakpoint
CREATE FUNCTION app.auth_token_hash() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.auth_token_hash', true), '')
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO luka_auth;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.auth_email(), app.auth_user_id(), app.auth_token_hash() TO luka_auth;--> statement-breakpoint
GRANT SELECT ("id", "email", "password_hash", "deleted_at") ON "users" TO luka_auth;--> statement-breakpoint
GRANT INSERT ("id", "email", "password_hash", "display_name") ON "users" TO luka_auth;--> statement-breakpoint
GRANT SELECT ("id", "user_id", "device_id", "family_id", "token_hash", "expires_at", "used_at", "revoked_at") ON "refresh_tokens" TO luka_auth;--> statement-breakpoint
CREATE POLICY "autenticacion_leer" ON "users" FOR SELECT TO luka_auth USING ("email" = app.auth_email());--> statement-breakpoint
CREATE POLICY "autenticacion_crear" ON "users" FOR INSERT TO luka_auth WITH CHECK ("id" = app.auth_user_id());--> statement-breakpoint
CREATE POLICY "autenticacion_leer" ON "refresh_tokens" FOR SELECT TO luka_auth USING ("token_hash" = app.auth_token_hash());--> statement-breakpoint
CREATE SCHEMA auth;--> statement-breakpoint
GRANT USAGE ON SCHEMA auth TO luka_app;--> statement-breakpoint
-- search_path fijo y pg_temp al final: nadie puede colar una tabla u operador con el mismo nombre.
-- El id y el hash de la contraseña de un correo, o nada si no existe.
CREATE FUNCTION auth.login_lookup(p_email public.citext)
  RETURNS TABLE (user_id uuid, password_hash text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.auth_email', p_email::text, true);
  RETURN QUERY SELECT u.id, u.password_hash FROM public.users u WHERE u.email = p_email AND u.deleted_at IS NULL;
END $$;--> statement-breakpoint
-- Crea la cuenta sin fijar app.user_id: la API no adopta un id que manda el cliente antes de saber
-- que es nuevo. Devuelve created, email_taken o id_taken, sin decir de quién es lo que ya existe.
CREATE FUNCTION auth.create_user(p_id uuid, p_email public.citext, p_password_hash text, p_display_name text)
  RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_constraint text;
BEGIN
  PERFORM set_config('app.auth_user_id', p_id::text, true);
  INSERT INTO public.users (id, email, password_hash, display_name)
    VALUES (p_id, p_email, p_password_hash, p_display_name);
  RETURN 'created';
EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
  RETURN CASE v_constraint WHEN 'users_email_unique' THEN 'email_taken' ELSE 'id_taken' END;
END $$;--> statement-breakpoint
-- El token de refresco de un hash, para rotarlo después con el contexto de su dueño.
CREATE FUNCTION auth.refresh_lookup(p_token_hash text)
  RETURNS TABLE (id uuid, user_id uuid, device_id uuid, family_id uuid, expires_at timestamptz, used_at timestamptz, revoked_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.auth_token_hash', p_token_hash, true);
  RETURN QUERY SELECT t.id, t.user_id, t.device_id, t.family_id, t.expires_at, t.used_at, t.revoked_at
    FROM public.refresh_tokens t WHERE t.token_hash = p_token_hash;
END $$;--> statement-breakpoint
ALTER FUNCTION auth.login_lookup(public.citext) OWNER TO luka_auth;--> statement-breakpoint
ALTER FUNCTION auth.create_user(uuid, public.citext, text, text) OWNER TO luka_auth;--> statement-breakpoint
ALTER FUNCTION auth.refresh_lookup(text) OWNER TO luka_auth;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth.login_lookup(public.citext), auth.create_user(uuid, public.citext, text, text), auth.refresh_lookup(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth.login_lookup(public.citext), auth.create_user(uuid, public.citext, text, text), auth.refresh_lookup(text) TO luka_app;
