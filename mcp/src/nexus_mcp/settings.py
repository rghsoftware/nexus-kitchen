import os
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator


AuthMode = Literal["supabase", "jwt-hs256"]


class Settings(BaseModel):
    supabase_url: str
    supabase_publishable_key: str
    base_url: str
    auth_mode: AuthMode = "supabase"
    jwt_algorithm: str = "ES256"
    jwt_secret: str | None = None
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)

    @field_validator("supabase_url", "base_url")
    @classmethod
    def normalize_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value.startswith(("http://", "https://")):
            raise ValueError("must be an http:// or https:// URL")
        return value


def load_settings() -> Settings:
    required = ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "MCP_BASE_URL")
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    auth_mode = os.environ.get("MCP_AUTH_MODE", "supabase").strip()
    if auth_mode == "jwt-hs256" and not os.environ.get("SUPABASE_JWT_SECRET", "").strip():
        missing.append("SUPABASE_JWT_SECRET")
    if missing:
        names = ", ".join(missing)
        raise RuntimeError(f"Missing required environment variable(s): {names}")

    try:
        return Settings(
            supabase_url=os.environ["SUPABASE_URL"],
            supabase_publishable_key=os.environ["SUPABASE_PUBLISHABLE_KEY"],
            base_url=os.environ["MCP_BASE_URL"],
            auth_mode=auth_mode,
            jwt_algorithm=os.environ.get("SUPABASE_JWT_ALGORITHM", "ES256"),
            jwt_secret=os.environ.get("SUPABASE_JWT_SECRET"),
            host=os.environ.get("MCP_HOST", "0.0.0.0"),
            port=os.environ.get("MCP_PORT", "8000"),
        )
    except ValidationError as error:
        raise RuntimeError(f"Invalid MCP configuration: {error}") from error
