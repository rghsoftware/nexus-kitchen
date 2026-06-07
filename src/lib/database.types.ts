// HAND-AUTHORED STAND-IN for `supabase gen types typescript`.
//
// This file mirrors supabase/migrations/0001_recipes.sql exactly. It exists because the
// feature build authors migrations without applying them, and `supabase gen types` needs a
// live/linked database. Once the migration is applied, REGENERATE this file to stay in sync:
//
//   supabase gen types typescript --linked > src/lib/database.types.ts
//
// Keep this file and the migration changing together — they must not drift.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type NutritionSource = 'COMPUTED' | 'MANUAL' | 'EXTERNAL';
export type TagCategory = 'DIETARY' | 'CUISINE' | 'MEAL_TYPE' | 'COOKING_METHOD' | 'CUSTOM';

export interface Database {
	public: {
		Tables: {
			recipes: {
				Row: {
					id: string;
					owner_id: string;
					household_id: string | null;
					title: string;
					description: string | null;
					servings: number;
					prep_time_minutes: number | null;
					cook_time_minutes: number | null;
					active_time_minutes: number | null;
					total_time_minutes: number; // generated, read-only
					cuisine_type: string | null;
					meal_types: string[];
					notes: string | null;
					image_url: string | null;
					source_url: string | null;
					nutrition_per_serving: Json | null;
					nutrition_source: NutritionSource;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					owner_id?: string; // defaults to auth.uid()
					household_id?: string | null;
					title: string;
					description?: string | null;
					servings: number;
					prep_time_minutes?: number | null;
					cook_time_minutes?: number | null;
					active_time_minutes?: number | null;
					// total_time_minutes is generated — never inserted
					cuisine_type?: string | null;
					meal_types?: string[];
					notes?: string | null;
					image_url?: string | null;
					source_url?: string | null;
					nutrition_per_serving?: Json | null;
					nutrition_source?: NutritionSource;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					owner_id?: string;
					household_id?: string | null;
					title?: string;
					description?: string | null;
					servings?: number;
					prep_time_minutes?: number | null;
					cook_time_minutes?: number | null;
					active_time_minutes?: number | null;
					cuisine_type?: string | null;
					meal_types?: string[];
					notes?: string | null;
					image_url?: string | null;
					source_url?: string | null;
					nutrition_per_serving?: Json | null;
					nutrition_source?: NutritionSource;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			recipe_ingredients: {
				Row: {
					id: string;
					recipe_id: string;
					ingredient_id: string | null;
					name: string;
					quantity: number;
					unit: string;
					preparation: string | null;
					is_optional: boolean;
					substitute_for: string | null;
					sort_order: number;
				};
				Insert: {
					id?: string;
					recipe_id: string;
					ingredient_id?: string | null;
					name: string;
					quantity: number;
					unit: string;
					preparation?: string | null;
					is_optional?: boolean;
					substitute_for?: string | null;
					sort_order: number;
				};
				Update: {
					id?: string;
					recipe_id?: string;
					ingredient_id?: string | null;
					name?: string;
					quantity?: number;
					unit?: string;
					preparation?: string | null;
					is_optional?: boolean;
					substitute_for?: string | null;
					sort_order?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'recipe_ingredients_recipe_id_fkey';
						columns: ['recipe_id'];
						isOneToOne: false;
						referencedRelation: 'recipes';
						referencedColumns: ['id'];
					}
				];
			};
			recipe_steps: {
				Row: {
					id: string;
					recipe_id: string;
					instruction: string;
					duration_minutes: number | null;
					timer_minutes: number | null;
					timer_label: string | null;
					image_url: string | null;
					sort_order: number;
				};
				Insert: {
					id?: string;
					recipe_id: string;
					instruction: string;
					duration_minutes?: number | null;
					timer_minutes?: number | null;
					timer_label?: string | null;
					image_url?: string | null;
					sort_order: number;
				};
				Update: {
					id?: string;
					recipe_id?: string;
					instruction?: string;
					duration_minutes?: number | null;
					timer_minutes?: number | null;
					timer_label?: string | null;
					image_url?: string | null;
					sort_order?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'recipe_steps_recipe_id_fkey';
						columns: ['recipe_id'];
						isOneToOne: false;
						referencedRelation: 'recipes';
						referencedColumns: ['id'];
					}
				];
			};
			recipe_tags: {
				Row: {
					id: string;
					recipe_id: string;
					name: string;
					category: TagCategory;
				};
				Insert: {
					id?: string;
					recipe_id: string;
					name: string;
					category: TagCategory;
				};
				Update: {
					id?: string;
					recipe_id?: string;
					name?: string;
					category?: TagCategory;
				};
				Relationships: [
					{
						foreignKeyName: 'recipe_tags_recipe_id_fkey';
						columns: ['recipe_id'];
						isOneToOne: false;
						referencedRelation: 'recipes';
						referencedColumns: ['id'];
					}
				];
			};
			user_recipe_meta: {
				Row: {
					id: string;
					user_id: string;
					recipe_id: string;
					is_favorite: boolean;
					rating: number | null;
					times_cooked: number;
					last_cooked_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id?: string; // defaults to auth.uid()
					recipe_id: string;
					is_favorite?: boolean;
					rating?: number | null;
					times_cooked?: number;
					last_cooked_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					recipe_id?: string;
					is_favorite?: boolean;
					rating?: number | null;
					times_cooked?: number;
					last_cooked_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'user_recipe_meta_recipe_id_fkey';
						columns: ['recipe_id'];
						isOneToOne: false;
						referencedRelation: 'recipes';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

// Convenience row aliases
export type RecipeRow = Database['public']['Tables']['recipes']['Row'];
export type RecipeInsert = Database['public']['Tables']['recipes']['Insert'];
export type RecipeUpdate = Database['public']['Tables']['recipes']['Update'];
export type RecipeIngredientRow = Database['public']['Tables']['recipe_ingredients']['Row'];
export type RecipeIngredientInsert = Database['public']['Tables']['recipe_ingredients']['Insert'];
export type RecipeStepRow = Database['public']['Tables']['recipe_steps']['Row'];
export type RecipeStepInsert = Database['public']['Tables']['recipe_steps']['Insert'];
export type RecipeTagRow = Database['public']['Tables']['recipe_tags']['Row'];
export type RecipeTagInsert = Database['public']['Tables']['recipe_tags']['Insert'];
export type UserRecipeMetaRow = Database['public']['Tables']['user_recipe_meta']['Row'];
export type UserRecipeMetaInsert = Database['public']['Tables']['user_recipe_meta']['Insert'];
