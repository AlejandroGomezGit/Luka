ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_id" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_id" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_id" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_same_user" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_same_user" FOREIGN KEY ("user_id","parent_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_same_user" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."accounts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_same_user" FOREIGN KEY ("user_id","to_account_id") REFERENCES "public"."accounts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_same_user" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- AM-03 (T-026). Rol de la API: sin superusuario ni BYPASSRLS; su contraseña la pone cada entorno, nunca
-- esta migración. El dueño de las tablas solo migra.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'luka_app') THEN
    CREATE ROLE luka_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;--> statement-breakpoint
CREATE SCHEMA app;--> statement-breakpoint
-- Usuario de la transacción, fijado con set_config local por la API (withUser). STABLE para que la
-- condición use los índices por user_id; la cadena vacía cuenta como sin contexto (NULL: cero filas).
CREATE FUNCTION app.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO luka_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_user_id() TO luka_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "users", "devices", "consents", "accounts", "categories", "transactions", "attachments" TO luka_app;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "users" TO luka_app USING ("id" = app.current_user_id()) WITH CHECK ("id" = app.current_user_id());--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "devices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "devices" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "consents" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "accounts" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "categories" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "transactions" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "aislamiento" ON "attachments" TO luka_app USING ("user_id" = app.current_user_id()) WITH CHECK ("user_id" = app.current_user_id());
