import asyncio
import json
import sys
from typing import Any

from fastmcp import Client
from fastmcp.client.auth import BearerAuth


async def call(client: Client, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    result = await client.call_tool(name, arguments)
    if result.is_error:
        raise RuntimeError(f"{name} failed: {result.content}")
    if not isinstance(result.data, dict):
        raise RuntimeError(f"{name} returned an unexpected result: {result.data!r}")
    print(f"{name}: {json.dumps(result.data, sort_keys=True)}")
    return result.data


async def main(token: str) -> None:
    async with Client(
        "http://127.0.0.1:8000/mcp",
        auth=BearerAuth(token),
    ) as client:
        await call(
            client,
            "save_recipe",
            {
                "title": "Weeknight Pancakes",
                "servings": 4,
                "ingredients": [
                    {"name": "plain flour", "quantity": 2, "unit": "cup"},
                    {"name": "eggs", "quantity": 3, "unit": "x"},
                    {"name": "milk", "quantity": 1.5, "unit": "cup"},
                ],
                "steps": [
                    {"instruction": "Whisk the ingredients into a smooth batter."},
                    {"instruction": "Cook spoonfuls in a warm pan until golden."},
                ],
            },
        )
        created = await call(
            client,
            "create_shopping_list",
            {
                "name": "From chat",
                "items": [
                    {
                        "name": "Flour",
                        "quantity": 2,
                        "unit": "cup",
                        "needed_for": "Weeknight Pancakes",
                    },
                    {
                        "name": "flour",
                        "quantity": 1,
                        "unit": "cup",
                        "needed_for": "Weeknight Pancakes",
                    },
                    {
                        "name": "eggs",
                        "quantity": 3,
                        "unit": "x",
                        "needed_for": "Weeknight Pancakes",
                    },
                ],
            },
        )
        await call(client, "list_shopping_lists", {})
        await call(
            client,
            "add_shopping_items",
            {
                "list_id": created["list_id"],
                "items": [
                    {
                        "name": "flour",
                        "quantity": 1,
                        "unit": "cup",
                        "needed_for": "Weeknight Pancakes",
                    },
                    {
                        "name": "butter",
                        "quantity": 200,
                        "unit": "g",
                        "needed_for": "Weeknight Pancakes",
                    },
                ],
            },
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: uv run python scripts/smoke.py <access-token>")
    asyncio.run(main(sys.argv[1]))
