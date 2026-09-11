import re
from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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

# Keep this list aligned with src/lib/shopping/categorize.ts. The longest matching
# phrase wins; tuple order breaks equal-length ties.
KEYWORDS: tuple[tuple[Category, tuple[str, ...]], ...] = (
    (
        "FROZEN",
        ("frozen", "ice cream", "popsicle", "frozen peas", "frozen corn", "frozen berries"),
    ),
    (
        "CANNED",
        (
            "canned",
            "can of",
            "crushed tomatoes",
            "tomato paste",
            "tomato sauce",
            "black beans",
            "kidney beans",
            "chickpeas",
            "garbanzo",
            "coconut milk",
            "broth",
            "chicken broth",
            "beef broth",
            "chicken stock",
            "beef stock",
            "stock",
            "soup",
        ),
    ),
    (
        "DAIRY",
        (
            "milk",
            "butter",
            "cheese",
            "cheddar",
            "mozzarella",
            "parmesan",
            "yogurt",
            "cream",
            "sour cream",
            "half and half",
            "egg",
            "eggs",
        ),
    ),
    (
        "MEAT_SEAFOOD",
        (
            "chicken",
            "beef",
            "pork",
            "turkey",
            "lamb",
            "bacon",
            "sausage",
            "ham",
            "ground beef",
            "steak",
            "fish",
            "salmon",
            "tuna",
            "shrimp",
            "cod",
            "tilapia",
        ),
    ),
    (
        "BAKERY",
        (
            "bread",
            "bagel",
            "bun",
            "buns",
            "roll",
            "rolls",
            "tortilla",
            "pita",
            "croissant",
            "baguette",
        ),
    ),
    (
        "PRODUCE",
        (
            "apple",
            "banana",
            "orange",
            "lemon",
            "lime",
            "berries",
            "strawberry",
            "blueberry",
            "grape",
            "avocado",
            "tomato",
            "potato",
            "onion",
            "garlic",
            "carrot",
            "celery",
            "lettuce",
            "spinach",
            "kale",
            "broccoli",
            "cauliflower",
            "pepper",
            "bell pepper",
            "cucumber",
            "zucchini",
            "squash",
            "butternut squash",
            "mushroom",
            "cilantro",
            "parsley",
            "basil",
            "ginger",
            "scallion",
            "green onion",
            "cabbage",
            "corn",
        ),
    ),
    (
        "PANTRY_STAPLES",
        (
            "flour",
            "sugar",
            "salt",
            "pepper flakes",
            "black pepper",
            "rice",
            "pasta",
            "spaghetti",
            "noodle",
            "oil",
            "olive oil",
            "vinegar",
            "soy sauce",
            "honey",
            "peanut butter",
            "cereal",
            "oats",
            "oatmeal",
            "spice",
            "cumin",
            "paprika",
            "cinnamon",
            "vanilla",
            "baking powder",
            "baking soda",
            "lentil",
            "quinoa",
            "dried",
        ),
    ),
)


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


def has_phrase(name: str, phrase: str) -> bool:
    return re.search(
        rf"(^|[^a-z0-9]){re.escape(phrase)}(?:s|es)?($|[^a-z0-9])",
        name,
    ) is not None


def categorize(name: str) -> Category:
    normalized = normalize(name)
    if not normalized:
        return "OTHER"

    best_category: Category = "OTHER"
    best_length = 0
    for category, phrases in KEYWORDS:
        for phrase in phrases:
            if len(phrase) > best_length and has_phrase(normalized, phrase):
                best_category = category
                best_length = len(phrase)
    return best_category


def merge_needed_for(
    existing: object,
    additions: Sequence[dict[str, str | None]],
) -> list[dict[str, str | None]]:
    merged: list[dict[str, str | None]] = []
    seen_titles: set[str] = set()
    candidates = [*(existing if isinstance(existing, list) else []), *additions]

    for attribution in candidates:
        if not isinstance(attribution, dict):
            continue
        title = attribution.get("title")
        recipe_id = attribution.get("recipeId")
        if (
            not isinstance(title, str)
            or not normalize(title)
            or (recipe_id is not None and not isinstance(recipe_id, str))
        ):
            continue
        normalized_title = normalize(title)
        if normalized_title in seen_titles:
            continue
        merged.append({"recipeId": recipe_id, "title": title})
        seen_titles.add(normalized_title)

    return merged


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
                category=categorize(item.name),
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
