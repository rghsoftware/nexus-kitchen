from nexus_mcp.items import ShoppingItemInput, categorize, merge_items, merge_needed_for, normalize


def test_normalize_collapses_case_and_whitespace() -> None:
    assert normalize("  Plain   Flour\t") == "plain flour"


def test_merge_items_sums_matching_units_and_preserves_order() -> None:
    merged = merge_items(
        [
            ShoppingItemInput(
                name="Flour",
                quantity=2,
                unit="cup",
                needed_for="Pancakes",
            ),
            ShoppingItemInput(
                name="flour ",
                quantity=1,
                unit=" cup ",
                needed_for=" pancakes ",
            ),
            ShoppingItemInput(
                name="butter",
                quantity=200,
                unit="g",
                needed_for="Pancakes",
            ),
            ShoppingItemInput(
                name="Butter",
                quantity=1,
                unit="tbsp",
                needed_for="Sauce",
            ),
            ShoppingItemInput(
                name="flour",
                quantity=0.1254,
                unit="cup",
                needed_for="Bread",
            ),
        ]
    )

    assert [(item.name, item.quantity, item.unit, item.category) for item in merged] == [
        ("Flour", 3.125, "cup", "PANTRY_STAPLES"),
        ("butter", 200.0, "g", "DAIRY"),
        ("Butter", 1.0, "tbsp", "DAIRY"),
    ]
    assert merged[0].needed_for == [
        {"recipeId": None, "title": "Pancakes"},
        {"recipeId": None, "title": "Bread"},
    ]


def test_categorize_matches_the_app_rules() -> None:
    assert categorize("butternut squash") == "PRODUCE"
    assert categorize("chicken broth") == "CANNED"
    assert categorize("yellow onions") == "PRODUCE"
    assert categorize("buttery spread") == "OTHER"
    assert categorize("dragon fruit") == "OTHER"


def test_merge_needed_for_preserves_valid_existing_attribution_and_deduplicates_titles() -> None:
    merged = merge_needed_for(
        [
            {"recipeId": "recipe-1", "title": "Pancakes"},
            {"recipeId": None, "title": ""},
            "invalid",
        ],
        [
            {"recipeId": None, "title": " pancakes "},
            {"recipeId": None, "title": "Bread"},
        ],
    )

    assert merged == [
        {"recipeId": "recipe-1", "title": "Pancakes"},
        {"recipeId": None, "title": "Bread"},
    ]
