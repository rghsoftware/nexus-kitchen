from typing import Annotated, Any, Literal

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from starlette.requests import Request
from starlette.responses import JSONResponse

from nexus_mcp.auth import build_auth
from nexus_mcp.items import ShoppingItemInput, merge_items, normalize
from nexus_mcp.postgrest import Postgrest, caller_token
from nexus_mcp.settings import load_settings


class IngredientInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=50)
    preparation: str | None = Field(default=None, max_length=200)
    is_optional: bool = False


class StepInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    instruction: str = Field(min_length=1, max_length=2000)
    duration_minutes: int | None = Field(default=None, ge=0)


def require_shopping_items(value: list[Any]) -> list[Any]:
    if not value:
        raise ValueError("Add at least one item.")
    return value


ListStatus = Literal["ACTIVE", "SHOPPING", "COMPLETED", "ARCHIVED"]
LimitedResultCount = Annotated[int, Field(ge=1, le=100)]
ListName = Annotated[str, Field(min_length=1, max_length=100)]
RecipeTitle = Annotated[str, Field(min_length=1, max_length=500)]
RecipeServings = Annotated[int, Field(ge=1, le=100)]
RequiredShoppingItems = Annotated[
    list[ShoppingItemInput],
    BeforeValidator(require_shopping_items),
    Field(min_length=1),
]
RequiredIngredients = Annotated[list[IngredientInput], Field(min_length=1)]
RequiredSteps = Annotated[list[StepInput], Field(min_length=1)]

settings = load_settings()
mcp = FastMCP(
    name="Nexus Kitchen",
    version="0.1.0",
    instructions=(
        "Nexus Kitchen is the user's meal-planning app. Use it to save recipes extracted from "
        "this conversation and to build their shopping lists. To add to an existing list, call "
        "list_shopping_lists first and pass that list's id to add_shopping_items; use "
        "create_shopping_list for a new one. Units are free text: pass the unit the recipe uses "
        "('g', 'cup', 'x' when countable). Never invent ingredients the user did not provide."
    ),
    auth=build_auth(settings),
)


def postgrest() -> Postgrest:
    return Postgrest(
        base_url=settings.supabase_url,
        apikey=settings.supabase_publishable_key,
        token=caller_token(),
    )


@mcp.custom_route("/health", methods=["GET"])
async def health(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


@mcp.tool(
    annotations={
        "readOnlyHint": True,
        "destructiveHint": False,
        "openWorldHint": False,
    }
)
async def list_shopping_lists(
    status: ListStatus | None = None,
    limit: LimitedResultCount = 20,
) -> dict[str, Any]:
    """List the user's shopping lists, newest first."""
    params = {
        "select": "id,name,status,source_type,created_at",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if status is not None:
        params["status"] = f"eq.{status}"

    async with postgrest() as db:
        rows = await db.select("shopping_lists", params)
    return {"lists": rows}


@mcp.tool(
    annotations={
        "readOnlyHint": False,
        "destructiveHint": False,
        "openWorldHint": False,
    }
)
async def create_shopping_list(
    name: ListName,
    items: RequiredShoppingItems,
) -> dict[str, Any]:
    """Create a manual shopping list populated with one or more ingredients."""
    if not items:
        raise ToolError("Add at least one item.")

    merged = merge_items(items)
    async with postgrest() as db:
        created_rows = await db.insert("shopping_lists", [{"name": name}])
        if not created_rows:
            raise ToolError("The shopping list could not be created.")
        created = created_rows[0]
        list_id = str(created["id"])
        item_rows = [
            {
                "shopping_list_id": list_id,
                "name": item.name,
                "quantity": item.quantity,
                "unit": item.unit,
                "category": item.category,
                "needed_for": item.needed_for,
            }
            for item in merged
        ]
        try:
            await db.insert("shopping_list_items", item_rows)
        except Exception:
            await db.delete("shopping_lists", {"id": f"eq.{list_id}"})
            raise

    return {
        "list_id": list_id,
        "name": created["name"],
        "item_count": len(merged),
        "items": [
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit": item.unit,
                "category": item.category,
            }
            for item in merged
        ],
    }


@mcp.tool(
    annotations={
        "readOnlyHint": False,
        "destructiveHint": False,
        "openWorldHint": False,
    }
)
async def add_shopping_items(
    list_id: str,
    items: RequiredShoppingItems,
) -> dict[str, Any]:
    """Add ingredients to a shopping list, merging matching pending items."""
    if not items:
        raise ToolError("Add at least one item.")

    merged = merge_items(items)
    async with postgrest() as db:
        lists = await db.select(
            "shopping_lists",
            {"id": f"eq.{list_id}", "select": "id,name,status"},
        )
        if not lists:
            raise ToolError("No shopping list with that id — call list_shopping_lists first.")

        existing_rows = await db.select(
            "shopping_list_items",
            {
                "shopping_list_id": f"eq.{list_id}",
                "status": "eq.PENDING",
                "select": "id,name,unit,quantity",
            },
        )
        existing_by_key = {
            (normalize(str(row["name"])), normalize(str(row["unit"]))): row
            for row in existing_rows
        }

        added_rows: list[dict[str, Any]] = []
        results: list[dict[str, Any]] = []
        added = 0
        updated = 0
        for item in merged:
            key = (normalize(item.name), normalize(item.unit))
            existing = existing_by_key.get(key)
            if existing is not None:
                quantity = round(float(existing["quantity"]) + item.quantity, 3)
                await db.patch(
                    "shopping_list_items",
                    {"id": f"eq.{existing['id']}"},
                    {"quantity": quantity},
                )
                updated += 1
                results.append(
                    {
                        "name": existing["name"],
                        "quantity": quantity,
                        "unit": existing["unit"],
                        "action": "updated",
                    }
                )
                continue

            added += 1
            added_rows.append(
                {
                    "shopping_list_id": list_id,
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "category": item.category,
                    "needed_for": item.needed_for,
                }
            )
            results.append(
                {
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "action": "added",
                }
            )

        if added_rows:
            await db.insert("shopping_list_items", added_rows)

    return {
        "list_id": list_id,
        "added": added,
        "updated": updated,
        "items": results,
    }


@mcp.tool(
    annotations={
        "readOnlyHint": True,
        "destructiveHint": False,
        "openWorldHint": False,
    }
)
async def search_recipes(
    query: str = "",
    limit: LimitedResultCount = 20,
) -> dict[str, Any]:
    """Search the user's recipes by title before saving a possible duplicate."""
    params = {
        "select": "id,title,servings,total_time_minutes,cuisine_type",
        "order": "title.asc",
        "limit": str(limit),
    }
    if stripped_query := query.strip():
        params["title"] = f"ilike.*{stripped_query}*"

    async with postgrest() as db:
        rows = await db.select("recipes", params)
    return {"recipes": rows}


@mcp.tool(
    annotations={
        "readOnlyHint": False,
        "destructiveHint": False,
        "openWorldHint": False,
    }
)
async def save_recipe(
    title: RecipeTitle,
    servings: RecipeServings,
    ingredients: RequiredIngredients,
    steps: RequiredSteps,
    description: Annotated[str | None, Field(max_length=2000)] = None,
    prep_time_minutes: Annotated[int | None, Field(ge=0)] = None,
    cook_time_minutes: Annotated[int | None, Field(ge=0)] = None,
    cuisine_type: Annotated[str | None, Field(max_length=100)] = None,
    source_url: str | None = None,
    notes: Annotated[str | None, Field(max_length=5000)] = None,
) -> dict[str, Any]:
    """Save a complete recipe extracted from the conversation."""
    if not ingredients or not steps:
        raise ToolError("Add at least one ingredient and one step.")

    recipe_values = {
        "title": title,
        "servings": servings,
        "description": description,
        "prep_time_minutes": prep_time_minutes,
        "cook_time_minutes": cook_time_minutes,
        "cuisine_type": cuisine_type,
        "source_url": source_url,
        "notes": notes,
    }
    async with postgrest() as db:
        created_rows = await db.insert("recipes", [recipe_values])
        if not created_rows:
            raise ToolError("The recipe could not be created.")
        recipe_id = str(created_rows[0]["id"])

        ingredient_rows = [
            {
                "recipe_id": recipe_id,
                "name": ingredient.name,
                "quantity": ingredient.quantity,
                "unit": ingredient.unit,
                "preparation": ingredient.preparation,
                "is_optional": ingredient.is_optional,
                "sort_order": index,
            }
            for index, ingredient in enumerate(ingredients)
        ]
        step_rows = [
            {
                "recipe_id": recipe_id,
                "instruction": step.instruction,
                "duration_minutes": step.duration_minutes,
                "sort_order": index,
            }
            for index, step in enumerate(steps)
        ]
        try:
            await db.insert("recipe_ingredients", ingredient_rows)
            await db.insert("recipe_steps", step_rows)
        except Exception:
            await db.delete("recipes", {"id": f"eq.{recipe_id}"})
            raise

    return {
        "recipe_id": recipe_id,
        "title": title,
        "ingredient_count": len(ingredients),
        "step_count": len(steps),
    }


def main() -> None:
    mcp.run(
        transport="http",
        host=settings.host,
        port=settings.port,
        path="/mcp",
    )
