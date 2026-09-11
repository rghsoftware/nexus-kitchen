import os
from collections.abc import Callable

import httpx
import pytest
from fastmcp.exceptions import ToolError

os.environ.setdefault("SUPABASE_URL", "https://project.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "publishable-key")
os.environ.setdefault("MCP_BASE_URL", "https://mcp.example.com")

import nexus_mcp.postgrest as postgrest_module
import nexus_mcp.server as server
from nexus_mcp.postgrest import Postgrest


TIMEOUT_MESSAGE = "Nexus Kitchen could not reach its data service. Please try again."


def use_mock_postgrest(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> None:
    async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)

    def client_factory(**kwargs: object) -> httpx.AsyncClient:
        return async_client(transport=transport, **kwargs)

    monkeypatch.setattr(postgrest_module.httpx, "AsyncClient", client_factory)
    monkeypatch.setattr(
        server,
        "postgrest",
        lambda: Postgrest("https://project.supabase.co", "publishable-key", "caller-token"),
    )


@pytest.mark.asyncio
async def test_create_shopping_list_deletes_parent_after_child_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deleted_ids: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path.endswith("/shopping_lists"):
            return httpx.Response(201, json=[{"id": "list-1", "name": "From chat"}])
        if request.method == "POST" and request.url.path.endswith("/shopping_list_items"):
            raise httpx.ReadTimeout("Authorization: Bearer caller-token", request=request)
        if request.method == "DELETE" and request.url.path.endswith("/shopping_lists"):
            deleted_ids.append(request.url.params["id"])
            return httpx.Response(204)
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    use_mock_postgrest(monkeypatch, handler)

    with pytest.raises(ToolError) as caught:
        await server.create_shopping_list(
            "From chat",
            [server.ShoppingItemInput(name="flour", quantity=2, unit="cup")],
        )

    assert str(caught.value) == TIMEOUT_MESSAGE
    assert "caller-token" not in str(caught.value)
    assert deleted_ids == ["eq.list-1"]


@pytest.mark.asyncio
async def test_save_recipe_deletes_parent_after_child_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deleted_ids: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path.endswith("/recipes"):
            return httpx.Response(201, json=[{"id": "recipe-1", "title": "Pancakes"}])
        if request.method == "POST" and request.url.path.endswith("/recipe_ingredients"):
            raise httpx.ReadTimeout("Authorization: Bearer caller-token", request=request)
        if request.method == "DELETE" and request.url.path.endswith("/recipes"):
            deleted_ids.append(request.url.params["id"])
            return httpx.Response(204)
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    use_mock_postgrest(monkeypatch, handler)

    with pytest.raises(ToolError) as caught:
        await server.save_recipe(
            title="Pancakes",
            servings=4,
            ingredients=[server.IngredientInput(name="flour", quantity=2, unit="cup")],
            steps=[server.StepInput(instruction="Mix the batter.")],
        )

    assert str(caught.value) == TIMEOUT_MESSAGE
    assert "caller-token" not in str(caught.value)
    assert deleted_ids == ["eq.recipe-1"]
