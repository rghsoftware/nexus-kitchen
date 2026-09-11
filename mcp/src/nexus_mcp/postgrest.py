from types import TracebackType
from typing import Any, Self

import httpx
from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_access_token, get_http_headers


class Postgrest:
    def __init__(self, base_url: str, apikey: str, token: str) -> None:
        self._base_url = f"{base_url.rstrip('/')}/rest/v1"
        self._headers = {
            "apikey": apikey,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> Self:
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._headers,
            timeout=httpx.Timeout(15.0),
        )
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _active_client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("Postgrest must be used as an async context manager")
        return self._client

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.is_success:
            return
        try:
            body: Any = response.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            message = body.get("message") or response.text or f"PostgREST returned {response.status_code}"
            hint = body.get("hint")
            if hint:
                message = f"{message} Hint: {hint}"
        else:
            message = response.text or f"PostgREST returned {response.status_code}"
        raise ToolError(str(message))

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            response = await self._active_client().request(method, path, **kwargs)
        except httpx.RequestError as error:
            raise ToolError(
                "Nexus Kitchen could not reach its data service. Please try again."
            ) from error
        self._raise_for_status(response)
        return response


    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = await self._request("GET", f"/{table}", params=params)
        return response.json()

    async def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        response = await self._request(
            "POST",
            f"/{table}",
            json=rows,
            headers={"Prefer": "return=representation"},
        )
        return response.json()

    async def patch(
        self,
        table: str,
        params: dict[str, str],
        values: dict[str, Any],
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "PATCH",
            f"/{table}",
            params=params,
            json=values,
            headers={"Prefer": "return=representation"},
        )
        return response.json()

    async def delete(self, table: str, params: dict[str, str]) -> None:
        await self._request("DELETE", f"/{table}", params=params)


def caller_token() -> str:
    access_token = get_access_token()
    if access_token is None:
        raise ToolError("Not authenticated.")

    token = getattr(access_token, "token", None)
    if isinstance(token, str) and token.strip():
        return token.strip()

    headers = get_http_headers(include={"authorization"})
    authorization = headers.get("authorization") or headers.get("Authorization")
    if not authorization:
        raise ToolError("Not authenticated.")
    scheme, separator, value = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not value.strip():
        raise ToolError("Not authenticated.")
    return value.strip()
