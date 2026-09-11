import re
from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CATEGORIES = (
    "PRODUCE",
    "DAIRY",
    "MEAT_SEAFOOD",
    "CANNED",
    "FROZEN",
    "BAKERY",
    "PANTRY_STAPLES",
    "OTHER",
)
Category = Literal[
    "PRODUCE",
    "DAIRY",
    "MEAT_SEAFOOD",
    "CANNED",
    "FROZEN",
    "BAKERY",
    "PANTRY_STAPLES",
    "OTHER",
]


class ShoppingItemInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        min_length=1,
        max_length=200,
        description="Ingredient as it should appear on the list, e.g. 'plain flour'",
    )
    quantity: float = Field(default=1, gt=0)
    unit: str = Field(
        default="x",
        min_length=1,
        max_length=50,
        description="Free text unit: 'g', 'cup', 'tbsp', or 'x' for countable items",
    )
    category: Category = "OTHER"
    needed_for: str | None = Field(
        default=None,
        description="Recipe title this ingredient is for",
    )


class MergedItem(BaseModel):
    name: str
    quantity: float
    unit: str
    category: Category
    needed_for: list[dict[str, str | None]]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def merge_items(items: Sequence[ShoppingItemInput]) -> list[MergedItem]:
    merged: dict[tuple[str, str], MergedItem] = {}
    seen_titles: dict[tuple[str, str], set[str]] = {}

    for item in items:
        key = (normalize(item.name), normalize(item.unit))
        existing = merged.get(key)
        if existing is None:
            existing = MergedItem(
                name=item.name,
                quantity=round(item.quantity, 3),
                unit=item.unit,
                category=item.category,
                needed_for=[],
            )
            merged[key] = existing
            seen_titles[key] = set()
        else:
            existing.quantity = round(existing.quantity + item.quantity, 3)

        if item.needed_for:
            normalized_title = normalize(item.needed_for)
            if normalized_title not in seen_titles[key]:
                existing.needed_for.append({"recipeId": None, "title": item.needed_for})
                seen_titles[key].add(normalized_title)

    return list(merged.values())
