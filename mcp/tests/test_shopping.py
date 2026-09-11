import asyncio
import os
from typing import Any, Self

import pytest
from fastmcp.exceptions import ToolError

os.environ.setdefault("SUPABASE_URL", "https://project.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "publishable-key")
os.environ.setdefault("MCP_BASE_URL", "https://mcp.example.com")

import nexus_mcp.server as server


@pytest.mark.asyncio
async def test_add_shopping_items_merges_attribution_and_updates_matches_concurrently(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakePostgrest:
        def __init__(self) -> None:
            self.patches: list[tuple[str, dict[str, Any]]] = []
            self.all_patches_started = asyncio.Event()

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def select(
            self,
            table: str,
            params: dict[str, str],
        ) -> list[dict[str, Any]]:
            if table == "shopping_lists":
                return [{"id": "list-1", "name": "Groceries", "status": "ACTIVE"}]
            assert table == "shopping_list_items"
            assert params["select"] == "id,name,unit,quantity,category,needed_for"
            return [
                {
                    "id": "item-1",
                    "name": "Flour",
                    "unit": "cup",
                    "quantity": 2,
                    "category": "PANTRY_STAPLES",
                    "needed_for": [{"recipeId": "recipe-1", "title": "Pancakes"}],
                },
                {
                    "id": "item-2",
                    "name": "Butter",
                    "unit": "g",
                    "quantity": 100,
                    "category": "DAIRY",
                    "needed_for": [],
                },
            ]

        async def patch(
            self,
            table: str,
            params: dict[str, str],
            values: dict[str, Any],
        ) -> list[dict[str, Any]]:
            assert table == "shopping_list_items"
            self.patches.append((params["id"], values))
            if len(self.patches) == 2:
                self.all_patches_started.set()
            await asyncio.wait_for(self.all_patches_started.wait(), timeout=0.5)
            return []

        async def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
            raise AssertionError(f"Unexpected insert into {table}: {rows!r}")

    db = FakePostgrest()
    monkeypatch.setattr(server, "postgrest", lambda: db)

    result = await server.add_shopping_items(
        "list-1",
        [
            server.ShoppingItemInput(
                name="flour",
                quantity=1,
                unit="cup",
                needed_for="Bread",
            ),
            server.ShoppingItemInput(
                name="butter",
                quantity=50,
                unit="g",
                needed_for="Pancakes",
            ),
        ],
    )

    patches = dict(db.patches)
    assert patches == {
        "eq.item-1": {
            "quantity": 3.0,
            "needed_for": [
                {"recipeId": "recipe-1", "title": "Pancakes"},
                {"recipeId": None, "title": "Bread"},
            ],
        },
        "eq.item-2": {
            "quantity": 150.0,
            "needed_for": [{"recipeId": None, "title": "Pancakes"}],
        },
    }
    assert result["added"] == 0
    assert result["updated"] == 2


@pytest.mark.asyncio
async def test_add_shopping_items_rejects_closed_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakePostgrest:
        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def select(
            self,
            table: str,
            params: dict[str, str],
        ) -> list[dict[str, Any]]:
            assert table == "shopping_lists"
            return [{"id": "list-1", "name": "Done", "status": "COMPLETED"}]

    monkeypatch.setattr(server, "postgrest", FakePostgrest)

    with pytest.raises(ToolError, match="active shopping list"):
        await server.add_shopping_items(
            "list-1",
            [server.ShoppingItemInput(name="flour", quantity=1, unit="cup")],
        )


@pytest.mark.asyncio
async def test_add_shopping_items_drains_delayed_patch_before_reraising_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakePostgrest:
        def __init__(self) -> None:
            self.started: list[str] = []
            self.all_patches_started = asyncio.Event()
            self.delayed_finished = False
            self.closed_before_delayed_finished = False

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *args: object) -> None:
            self.closed_before_delayed_finished = not self.delayed_finished

        async def select(
            self,
            table: str,
            params: dict[str, str],
        ) -> list[dict[str, Any]]:
            if table == "shopping_lists":
                return [{"id": "list-1", "name": "Groceries", "status": "ACTIVE"}]
            assert table == "shopping_list_items"
            return [
                {
                    "id": "item-1",
                    "name": "Flour",
                    "unit": "cup",
                    "quantity": 1,
                    "category": "PANTRY_STAPLES",
                    "needed_for": [],
                },
                {
                    "id": "item-2",
                    "name": "Butter",
                    "unit": "g",
                    "quantity": 1,
                    "category": "DAIRY",
                    "needed_for": [],
                },
            ]

        async def patch(
            self,
            table: str,
            params: dict[str, str],
            values: dict[str, Any],
        ) -> list[dict[str, Any]]:
            assert table == "shopping_list_items"
            item_id = params["id"]
            self.started.append(item_id)
            if len(self.started) == 2:
                self.all_patches_started.set()
            await asyncio.wait_for(self.all_patches_started.wait(), timeout=0.5)

            if item_id == "eq.item-1":
                raise ToolError("First PATCH failed.")

            await asyncio.sleep(0.01)
            self.delayed_finished = True
            return []

        async def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
            raise AssertionError(f"Unexpected insert into {table}: {rows!r}")

    db = FakePostgrest()
    monkeypatch.setattr(server, "postgrest", lambda: db)

    with pytest.raises(ToolError, match="First PATCH failed"):
        await server.add_shopping_items(
            "list-1",
            [
                server.ShoppingItemInput(name="flour", quantity=1, unit="cup"),
                server.ShoppingItemInput(name="butter", quantity=1, unit="g"),
            ],
        )

    assert db.delayed_finished
    assert not db.closed_before_delayed_finished
