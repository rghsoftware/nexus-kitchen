# Edge Functions

First introduced by Feature 007 (meal reminders). Conventions: one folder per
function, Deno 2, `npm:` specifiers for dependencies, service-role access only
here (the service key never reaches the client).

## send-meal-reminders

Delivery layer for meal reminders: pg_cron fires every minute →
`invoke_send_meal_reminders()` (SQL, no-ops until Vault is configured) →
`POST /functions/v1/send-meal-reminders` → `due_meal_reminders()` RPC →
Pushover. Dedup lives in `reminder_deliveries` (UNIQUE per occurrence), so the
function is safe to invoke as often as you like.

### Caller authorization

`verify_jwt` is **off** for this function: the anon key is a valid Supabase JWT
and public by design, so a JWT check gates nothing. The real credential is a
random shared secret sent as the `x-cron-secret` header and compared
constant-time inside the function. Fail-closed: without the header (or with
`CRON_SHARED_SECRET` unset) every request gets 401.

```bash
openssl rand -hex 32   # generate once per environment, use it in BOTH places below
```

### Secrets

Function env (`SUPABASE_URL` / service key are injected automatically when
deployed):

```bash
supabase secrets set CRON_SHARED_SECRET=<random secret> \
  PUSHOVER_APP_TOKEN=<app token> PUSHOVER_USER_KEY=<user key>
```

Vault (read by the cron invoker; per environment, via SQL editor):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<random secret>', 'send_meal_reminders_secret');
```

Until both Vault secrets exist the cron tick is a no-op, and until the Pushover
secrets exist the function replies `{"skipped": "pushover secrets not
configured"}` — nothing errors in an unconfigured environment.

### Local development

The local stack is normally started with `-x edge-runtime` (Windows port
exclusions), so serve the function explicitly:

```bash
printf 'CRON_SHARED_SECRET=...\nPUSHOVER_APP_TOKEN=...\nPUSHOVER_USER_KEY=...\n' \
  > supabase/functions/.env.local
supabase functions serve send-meal-reminders --env-file supabase/functions/.env.local
```

Invoke it manually:

```bash
curl -X POST http://127.0.0.1:56321/functions/v1/send-meal-reminders \
  -H "x-cron-secret: $CRON_SHARED_SECRET" -H "Content-Type: application/json" -d '{}'
```

### Deploy

```bash
supabase functions deploy send-meal-reminders
```
