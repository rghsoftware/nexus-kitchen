# Data Model: Recipe Management (001-recipes)

Canonical recipe table set (per `invariants §1.2`, `logical-arch line 120`), scoped to v1:
`recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`, `user_recipe_meta`.
The `ingredients` master table is **out of scope** ([Q2]).

**Global rules (constitution P7–P9):** UUID PKs (`gen_random_uuid()`), `timestamptz` UTC
timestamps, RLS enabled default-deny on **every** table before exposure. No `serial`.

---

## Enums

```
recipe_tag_category : 'DIETARY' | 'CUISINE' | 'MEAL_TYPE' | 'COOKING_METHOD' | 'CUSTOM'
nutrition_source    : 'COMPUTED' | 'MANUAL' | 'EXTERNAL'
```

(Implemented as Postgres `CHECK` constraints or `CREATE TYPE` enums; CHECK chosen for easier
future extension.)

---

## Table: `recipes`

Owner-scoped parent record.

| Column                  | Type          | Constraints                                                                                 | Notes                                          |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `id`                    | `uuid`        | PK, default `gen_random_uuid()`                                                             | INV-DB-001                                     |
| `owner_id`              | `uuid`        | NOT NULL, default `auth.uid()`, FK→`auth.users(id)` ON DELETE CASCADE                       | session owner                                  |
| `household_id`          | `uuid`        | NULL                                                                                        | reserved for sharing (REQ-HH-007); no FK in v1 |
| `title`                 | `text`        | NOT NULL, `CHECK (char_length(title) BETWEEN 1 AND 500)`                                    | domain-spec §2.2                               |
| `description`           | `text`        | NULL, `CHECK (char_length(description) <= 2000)`                                            |                                                |
| `servings`              | `integer`     | NOT NULL, `CHECK (servings BETWEEN 1 AND 100)`                                              | INV-RC-003                                     |
| `prep_time_minutes`     | `integer`     | NULL, `CHECK (prep_time_minutes >= 0)`                                                      |                                                |
| `cook_time_minutes`     | `integer`     | NULL, `CHECK (cook_time_minutes >= 0)`                                                      |                                                |
| `active_time_minutes`   | `integer`     | NULL, `CHECK (active_time_minutes >= 0)`                                                    | INV-RC-008 (see table check)                   |
| `total_time_minutes`    | `integer`     | GENERATED ALWAYS AS (`coalesce(prep_time_minutes,0)+coalesce(cook_time_minutes,0)`) STORED  | domain-spec computed                           |
| `cuisine_type`          | `text`        | NULL, `CHECK (char_length(cuisine_type) <= 100)`                                            |                                                |
| `meal_types`            | `text[]`      | NOT NULL default `'{}'`                                                                     | what the recipe IS                             |
| `notes`                 | `text`        | NULL, `CHECK (char_length(notes) <= 5000)`                                                  |                                                |
| `image_url`             | `text`        | NULL                                                                                        | single primary image ([Q3])                    |
| `source_url`            | `text`        | NULL                                                                                        | for future imports                             |
| `nutrition_per_serving` | `jsonb`       | NULL                                                                                        | stored, not computed (MANUAL)                  |
| `nutrition_source`      | `text`        | NOT NULL default `'MANUAL'`, `CHECK (nutrition_source IN ('COMPUTED','MANUAL','EXTERNAL'))` |                                                |
| `created_at`            | `timestamptz` | NOT NULL default `now()`                                                                    | immutable (P9)                                 |
| `updated_at`            | `timestamptz` | NOT NULL default `now()`                                                                    | trigger-maintained                             |

**Table-level checks:**

- `CHECK (active_time_minutes IS NULL OR total_time_minutes IS NULL OR active_time_minutes <= total_time_minutes)` — INV-RC-008. (Note: `total_time_minutes` is generated, so reference base columns: `active_time_minutes <= coalesce(prep_time_minutes,0)+coalesce(cook_time_minutes,0)` OR either part NULL.)

**Indexes:** `(owner_id)`, `(owner_id, created_at DESC)` for library listing, GIN on
`to_tsvector('simple', title)` optional (search is primarily client-side over the cache per SC-002).

**Trigger:** `set_updated_at` BEFORE UPDATE sets `updated_at = now()`.

---

## Table: `recipe_ingredients`

Ordered children of a recipe (INV-RC-001 ≥1, enforced in app + tests; see note).

| Column           | Type      | Constraints                                             | Notes                                        |
| ---------------- | --------- | ------------------------------------------------------- | -------------------------------------------- |
| `id`             | `uuid`    | PK default `gen_random_uuid()`                          |                                              |
| `recipe_id`      | `uuid`    | NOT NULL, FK→`recipes(id)` ON DELETE CASCADE            | INV-DB-008                                   |
| `ingredient_id`  | `uuid`    | NULL                                                    | reserved for master link ([Q2]); no FK in v1 |
| `name`           | `text`    | NOT NULL, `CHECK (char_length(name) BETWEEN 1 AND 200)` | free-text display                            |
| `quantity`       | `numeric` | NOT NULL, `CHECK (quantity > 0)`                        | INV-RC-005                                   |
| `unit`           | `text`    | NOT NULL, `CHECK (char_length(unit) BETWEEN 1 AND 50)`  | measurement unit                             |
| `preparation`    | `text`    | NULL, `CHECK (char_length(preparation) <= 200)`         | e.g. "diced"                                 |
| `is_optional`    | `boolean` | NOT NULL default `false`                                |                                              |
| `substitute_for` | `uuid`    | NULL, FK→`recipe_ingredients(id)` ON DELETE SET NULL    | INV-RC-011 (same recipe — app-enforced)      |
| `sort_order`     | `integer` | NOT NULL, `CHECK (sort_order >= 0)`                     |                                              |

**Constraints:** `UNIQUE (recipe_id, sort_order)` — INV-RC-007 (unique ordering within recipe).

**Indexes:** `(recipe_id, sort_order)`.

---

## Table: `recipe_steps`

Ordered preparation steps (INV-RC-002 ≥1, app + tests).

| Column             | Type      | Constraints                                                     | Notes      |
| ------------------ | --------- | --------------------------------------------------------------- | ---------- |
| `id`               | `uuid`    | PK default `gen_random_uuid()`                                  |            |
| `recipe_id`        | `uuid`    | NOT NULL, FK→`recipes(id)` ON DELETE CASCADE                    | INV-DB-008 |
| `instruction`      | `text`    | NOT NULL, `CHECK (char_length(instruction) BETWEEN 1 AND 2000)` |            |
| `duration_minutes` | `integer` | NULL, `CHECK (duration_minutes >= 0)`                           |            |
| `timer_minutes`    | `integer` | NULL, `CHECK (timer_minutes >= 0)`                              |            |
| `timer_label`      | `text`    | NULL, `CHECK (char_length(timer_label) <= 100)`                 |            |
| `image_url`        | `text`    | NULL                                                            |            |
| `sort_order`       | `integer` | NOT NULL, `CHECK (sort_order >= 0)`                             |            |

**Constraints:** `UNIQUE (recipe_id, sort_order)` — INV-RC-006.

**Indexes:** `(recipe_id, sort_order)`.

---

## Table: `recipe_tags`

Tags attached to a recipe.

| Column      | Type   | Constraints                                                                                 | Notes     |
| ----------- | ------ | ------------------------------------------------------------------------------------------- | --------- |
| `id`        | `uuid` | PK default `gen_random_uuid()`                                                              |           |
| `recipe_id` | `uuid` | NOT NULL, FK→`recipes(id)` ON DELETE CASCADE                                                |           |
| `name`      | `text` | NOT NULL, `CHECK (name = lower(name) AND char_length(name) BETWEEN 1 AND 50)`               | lowercase |
| `category`  | `text` | NOT NULL, `CHECK (category IN ('DIETARY','CUISINE','MEAL_TYPE','COOKING_METHOD','CUSTOM'))` |           |

**Constraints:** `UNIQUE (recipe_id, name, category)`.
**Indexes:** `(recipe_id)`, `(name)`.

---

## Table: `user_recipe_meta`

Per-user state, separate from the shared recipe (INV-RC-009, INV-RC-012).

| Column           | Type          | Constraints                                                          | Notes                 |
| ---------------- | ------------- | -------------------------------------------------------------------- | --------------------- |
| `id`             | `uuid`        | PK default `gen_random_uuid()`                                       |                       |
| `user_id`        | `uuid`        | NOT NULL default `auth.uid()`, FK→`auth.users(id)` ON DELETE CASCADE |                       |
| `recipe_id`      | `uuid`        | NOT NULL, FK→`recipes(id)` ON DELETE CASCADE                         |                       |
| `is_favorite`    | `boolean`     | NOT NULL default `false`                                             | REQ-RC-004            |
| `rating`         | `integer`     | NULL, `CHECK (rating BETWEEN 1 AND 5)`                               | INV-RC-009            |
| `times_cooked`   | `integer`     | NOT NULL default `0`, `CHECK (times_cooked >= 0)`                    | not incremented in v1 |
| `last_cooked_at` | `timestamptz` | NULL                                                                 |                       |
| `created_at`     | `timestamptz` | NOT NULL default `now()`                                             |                       |
| `updated_at`     | `timestamptz` | NOT NULL default `now()`                                             | trigger-maintained    |

**Constraints:** `UNIQUE (user_id, recipe_id)` — INV-RC-012 (one meta per user+recipe).

---

## Row-Level Security (constitution P7 — `severity: block`)

Every table gets `ENABLE ROW LEVEL SECURITY` in the **same** `CREATE TABLE` migration. Default
deny; explicit policies grant access. All policies require `auth.uid()` (real, from anon sign-in).

### `recipes` (owner-scoped, direct)

```sql
-- SELECT / INSERT / UPDATE / DELETE limited to owner
CREATE POLICY recipes_select ON recipes FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY recipes_insert ON recipes FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY recipes_update ON recipes FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY recipes_delete ON recipes FOR DELETE USING (owner_id = auth.uid());
```

### Child tables (`recipe_ingredients`, `recipe_steps`, `recipe_tags`) — keyed through parent

```sql
-- Pattern (repeat per child, per command). Example for recipe_ingredients:
CREATE POLICY ri_all ON recipe_ingredients FOR ALL
  USING     (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.owner_id = auth.uid()));
```

> ⚠️ Forgetting RLS on a child table silently exposes data. All three children MUST have policies.
> `supabase-rls-reviewer` must review this migration.

### `user_recipe_meta` (user-scoped)

```sql
CREATE POLICY urm_all ON user_recipe_meta FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- plus: the referenced recipe must be visible to the user (owner) — enforced via FK + recipes RLS.
```

### Storage: bucket `recipe-images` (private)

```sql
-- Files stored under '{auth.uid()}/...'; access scoped to owner prefix.
CREATE POLICY recipe_images_rw ON storage.objects FOR ALL
  USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## Relationships

```
auth.users 1───* recipes 1───* recipe_ingredients (substitute_for → self, same recipe)
                         1───* recipe_steps
                         1───* recipe_tags
auth.users 1───* user_recipe_meta *───1 recipes   (UNIQUE user_id+recipe_id)
```

All children `ON DELETE CASCADE` from `recipes` (INV-DB-008 — no orphaned children).

---

## Invariant → enforcement map

| Invariant                            | Enforcement                                                            |
| ------------------------------------ | ---------------------------------------------------------------------- |
| INV-RC-001 ≥1 ingredient             | App validation + repository (insert recipe+children atomically) + test |
| INV-RC-002 ≥1 step                   | App validation + repository + test                                     |
| INV-RC-003 servings >0               | `CHECK (servings BETWEEN 1 AND 100)`                                   |
| INV-RC-005 quantity >0               | `CHECK (quantity > 0)`                                                 |
| INV-RC-006 unique step order         | `UNIQUE (recipe_id, sort_order)`                                       |
| INV-RC-007 unique ingr order         | `UNIQUE (recipe_id, sort_order)`                                       |
| INV-RC-008 active ≤ total            | table `CHECK`                                                          |
| INV-RC-009 rating 1–5                | `CHECK (rating BETWEEN 1 AND 5)`                                       |
| INV-RC-011 substitute in same recipe | app validation + test (cross-row, not a single CHECK)                  |
| INV-RC-012 one meta per user+recipe  | `UNIQUE (user_id, recipe_id)`                                          |
| INV-DB-001 UUID PKs                  | `uuid` + `gen_random_uuid()`                                           |
| INV-DB-002 timestamptz UTC           | all timestamps `timestamptz`                                           |
| INV-DB-008 no orphans                | FK `ON DELETE CASCADE`                                                 |
| INV-DB-011 RLS default-deny          | `ENABLE ROW LEVEL SECURITY` + policies on all tables                   |
