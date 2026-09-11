from nexus_mcp.items import ShoppingItemInput, merge_items, normalize


def test_normalize_collapses_case_and_whitespace() -> None:
    assert normalize("  Plain   Flour\t") == "plain flour"


def test_merge_items_sums_matching_units_and_preserves_order() -> None:
    merged = merge_items(
        [
            ShoppingItemInput(
                name="Flour",
                quantity=2,
                unit="cup",
                category="PANTRY_STAPLES",
                needed_for="Pancakes",
            ),
            ShoppingItemInput(
                name="flour ",
                quantity=1,
                unit=" cup ",
                category="OTHER",
                needed_for=" pancakes ",
            ),
            ShoppingItemInput(
                name="butter",
                quantity=200,
                unit="g",
                category="DAIRY",
                needed_for="Pancakes",
            ),
            ShoppingItemInput(
                name="Butter",
                quantity=1,
                unit="tbsp",
                category="OTHER",
                needed_for="Sauce",
            ),
            ShoppingItemInput(
                name="flour",
                quantity=0.1254,
                unit="cup",
                category="OTHER",
                needed_for="Bread",
            ),
        ]
    )

    assert [(item.name, item.quantity, item.unit, item.category) for item in merged] == [
        ("Flour", 3.125, "cup", "PANTRY_STAPLES"),
        ("butter", 200.0, "g", "DAIRY"),
        ("Butter", 1.0, "tbsp", "OTHER"),
    ]
    assert merged[0].needed_for == [
        {"recipeId": None, "title": "Pancakes"},
        {"recipeId": None, "title": "Bread"},
    ]
