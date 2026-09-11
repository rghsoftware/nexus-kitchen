from fastmcp.server.auth import AuthProvider
from fastmcp.server.auth.providers.jwt import JWTVerifier
from fastmcp.server.auth.providers.supabase import SupabaseProvider

from nexus_mcp.settings import Settings


def build_auth(settings: Settings) -> AuthProvider:
    if settings.auth_mode == "jwt-hs256":
        if settings.jwt_secret is None:
            raise RuntimeError("SUPABASE_JWT_SECRET is required when MCP_AUTH_MODE=jwt-hs256")
        return JWTVerifier(
            public_key=settings.jwt_secret,
            issuer=f"{settings.supabase_url}/auth/v1",
            algorithm="HS256",
            base_url=settings.base_url,
        )
    return SupabaseProvider(
        project_url=settings.supabase_url,
        base_url=settings.base_url,
        algorithm=settings.jwt_algorithm,
    )
