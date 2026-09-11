# Nexus Kitchen MCP connector

FastMCP 4 service for saving chat-extracted recipes and shopping lists into the signed-in user's Nexus Kitchen account. Each request uses the caller's Supabase access token against PostgREST, so the existing row-level security policies remain the authorization boundary. No secret or service-role key is deployed.

## Supabase OAuth server

Configure the hosted project in the Supabase dashboard:

1. Open **Authentication → OAuth Server** and enable the OAuth server.
2. Set **Authorization Path** to `/oauth/consent`.
3. Enable dynamic client registration.
4. Open **Authentication → URL Configuration** and set **Site URL** to the deployed app origin, for example `https://kitchen.example.com`.

The repository's `supabase/config.toml` contains the equivalent local configuration. The feature requires Supabase CLI 2.54.11 or newer. Restart local Supabase after auth configuration changes with `supabase stop && supabase start`; a plain start does not reload them.

## Configure the service

```sh
cd mcp
cp .env.example .env
```

Set `SUPABASE_URL`, the public `SUPABASE_PUBLISHABLE_KEY`, and the public `MCP_BASE_URL`. Hosted projects and current local stacks use `MCP_AUTH_MODE=supabase` with the project's asymmetric JWT algorithm. `MCP_AUTH_MODE=jwt-hs256` and `SUPABASE_JWT_SECRET` remain available only for legacy local stacks that still issue HS256 access tokens.

`SUPABASE_PUBLISHABLE_KEY` is intentionally public. Do not put a Supabase secret key, legacy service-role key, or any other privileged credential in this service.

## Run with Docker

```sh
cd mcp
docker compose up -d --build
```

The container listens through `127.0.0.1:8787`; expose it with Caddy:

```caddyfile
mcp.example.com {
	reverse_proxy 127.0.0.1:8787
}
```

FastMCP serves `/.well-known/oauth-protected-resource*` on the MCP origin, so Caddy needs no additional routes or rewrites.

## Add a connector

- **Claude:** Settings → Connectors → Add custom connector → `https://mcp.example.com/mcp`
- **ChatGPT:** Settings → Connectors → add `https://mcp.example.com/mcp`

Both clients register through Supabase dynamic client registration; nothing is pre-registered.

## Local development

```sh
uv lock
uv sync
uv run pytest
MCP_AUTH_MODE=supabase \
SUPABASE_JWT_ALGORITHM=ES256 \
SUPABASE_URL=http://127.0.0.1:56321 \
SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" \
MCP_BASE_URL=http://127.0.0.1:8000 \
uv run nexus-mcp
```

With a user access token, run the end-to-end harness:

```sh
uv run python scripts/smoke.py "$TOKEN"
```
