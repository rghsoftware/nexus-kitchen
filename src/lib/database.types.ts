export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			meal_plans: {
				Row: {
					created_at: string;
					end_date: string;
					household_id: string | null;
					id: string;
					name: string | null;
					owner_id: string;
					start_date: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					end_date: string;
					household_id?: string | null;
					id?: string;
					name?: string | null;
					owner_id?: string;
					start_date: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					end_date?: string;
					household_id?: string | null;
					id?: string;
					name?: string | null;
					owner_id?: string;
					start_date?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			pantry_items: {
				Row: {
					barcode: string | null;
					created_at: string;
					custom_location: string | null;
					expiration_date: string | null;
					household_id: string | null;
					id: string;
					ingredient_id: string | null;
					minimum_quantity: number | null;
					name: string;
					opened_date: string | null;
					owner_id: string;
					photo_url: string | null;
					purchase_date: string | null;
					quantity: number;
					storage_location: Database['public']['Enums']['storage_location'];
					thumbnail_url: string | null;
					unit: string;
					updated_at: string;
				};
				Insert: {
					barcode?: string | null;
					created_at?: string;
					custom_location?: string | null;
					expiration_date?: string | null;
					household_id?: string | null;
					id?: string;
					ingredient_id?: string | null;
					minimum_quantity?: number | null;
					name: string;
					opened_date?: string | null;
					owner_id: string;
					photo_url?: string | null;
					purchase_date?: string | null;
					quantity?: number;
					storage_location?: Database['public']['Enums']['storage_location'];
					thumbnail_url?: string | null;
					unit: string;
					updated_at?: string;
				};
				Update: {
					barcode?: string | null;
					created_at?: string;
					custom_location?: string | null;
					expiration_date?: string | null;
					household_id?: string | null;
					id?: string;
					ingredient_id?: string | null;
					minimum_quantity?: number | null;
					name?: string;
					opened_date?: string | null;
					owner_id?: string;
					photo_url?: string | null;
					purchase_date?: string | null;
					quantity?: number;
					storage_location?: Database['public']['Enums']['storage_location'];
					thumbnail_url?: string | null;
					unit?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			planned_meals: {
				Row: {
					created_at: string;
					date: string;
					id: string;
					logged_at: string | null;
					meal_plan_id: string;
					meal_slot: Database['public']['Enums']['meal_slot'] | null;
					prepped_meal_id: string | null;
					prepped_name_snapshot: string | null;
					quick_meal_name: string | null;
					recipe_id: string | null;
					recipe_title_snapshot: string | null;
					servings: number;
					sort_order: number;
					source: Database['public']['Enums']['planned_meal_source'];
					status: Database['public']['Enums']['planned_meal_status'];
					store_bought_name: string | null;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					date: string;
					id?: string;
					logged_at?: string | null;
					meal_plan_id: string;
					meal_slot?: Database['public']['Enums']['meal_slot'] | null;
					prepped_meal_id?: string | null;
					prepped_name_snapshot?: string | null;
					quick_meal_name?: string | null;
					recipe_id?: string | null;
					recipe_title_snapshot?: string | null;
					servings?: number;
					sort_order?: number;
					source: Database['public']['Enums']['planned_meal_source'];
					status?: Database['public']['Enums']['planned_meal_status'];
					store_bought_name?: string | null;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					date?: string;
					id?: string;
					logged_at?: string | null;
					meal_plan_id?: string;
					meal_slot?: Database['public']['Enums']['meal_slot'] | null;
					prepped_meal_id?: string | null;
					prepped_name_snapshot?: string | null;
					quick_meal_name?: string | null;
					recipe_id?: string | null;
					recipe_title_snapshot?: string | null;
					servings?: number;
					sort_order?: number;
					source?: Database['public']['Enums']['planned_meal_source'];
					status?: Database['public']['Enums']['planned_meal_status'];
					store_bought_name?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'planned_meals_meal_plan_id_fkey';
						columns: ['meal_plan_id'];
						isOneToOne: false;
						referencedRelation: 'meal_plans';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'planned_meals_prepped_meal_id_fkey';
						columns: ['prepped_meal_id'];
						isOneToOne: false;
						referencedRelation: 'prepped_meals';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'planned_meals_recipe_id_fkey';
						columns: ['recipe_id'];
						isOneToOne: false;
						referencedRelation: 'recipes';
						referencedColumns: ['id'];
					}
				];
			};
			portion_events: {
				Row: {
					created_at: string;
					delta_portions: number;
					id: string;
					kind: Database['public']['Enums']['portion_event_kind'];
					prepped_meal_id: string;
					triggered_by: string | null;
				};
				Insert: {
					created_at?: string;
					delta_portions: number;
					id?: string;
					kind: Database['public']['Enums']['portion_event_kind'];
					prepped_meal_id: string;
					triggered_by?: string | null;
				};
				Update: {
					created_at?: string;
					delta_portions?: number;
					id?: string;
					kind?: Database['public']['Enums']['portion_event_kind'];
					prepped_meal_id?: string;
					triggered_by?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'portion_events_prepped_meal_id_fkey';
						columns: ['prepped_meal_id'];
						isOneToOne: false;
						referencedRelation: 'prepped_meals';
						referencedColumns: ['id'];
					}
				];
			};
			prepped_meals: {
				Row: {
					container_label: string | null;
					created_at: string;
					defrost_started_at: string | null;
					defrost_state: Database['public']['Enums']['defrost_state'];
					estimated_ready_at: string | null;
					expiration_date: string;
					household_id: string | null;
					id: string;
					meal_prep_session_id: string | null;
					name: string;
					origin: Database['public']['Enums']['prepped_meal_origin'];
					original_portions: number;
					owner_id: string;
					photo_url: string | null;
					portions_remaining: number;
					prepared_date: string;
					recipe_id: string | null;
					recipe_name: string | null;
					storage_location: Database['public']['Enums']['storage_location'];
					updated_at: string;
				};
				Insert: {
					container_label?: string | null;
					created_at?: string;
					defrost_started_at?: string | null;
					defrost_state?: Database['public']['Enums']['defrost_state'];
					estimated_ready_at?: string | null;
					expiration_date: string;
					household_id?: string | null;
					id?: string;
					meal_prep_session_id?: string | null;
					name: string;
					origin: Database['public']['Enums']['prepped_meal_origin'];
					original_portions: number;
					owner_id: string;
					photo_url?: string | null;
					portions_remaining: number;
					prepared_date: string;
					recipe_id?: string | null;
					recipe_name?: string | null;
					storage_location: Database['public']['Enums']['storage_location'];
					updated_at?: string;
				};
				Update: {
					container_label?: string | null;
					created_at?: string;
					defrost_started_at?: string | null;
					defrost_state?: Database['public']['Enums']['defrost_state'];
					estimated_ready_at?: string | null;
					expiration_date?: string;
					household_id?: string | null;
					id?: string;
					meal_prep_session_id?: string | null;
					name?: string;
					origin?: Database['public']['Enums']['prepped_meal_origin'];
					original_portions?: number;
					owner_id?: string;
					photo_url?: string | null;
					portions_remaining?: number;
					prepared_date?: string;
					recipe_id?: string | null;
					recipe_name?: string | null;
					storage_location?: Database['public']['Enums']['storage_location'];
					updated_at?: string;
				};
				Relationships: [];
			};
			recipe_ingredients: {
				Row: {
					id: string;
					ingredient_id: string | null;
					is_optional: boolean;
					name: string;
					preparation: string | null;
					quantity: number;
					recipe_id: string;
					sort_order: number;
					substitute_for: string | null;
					unit: string;
				};
				Insert: {
					id?: string;
					ingredient_id?: string | null;
					is_optional?: boolean;
					name: string;
					preparation?: string | null;
					quantity: number;
					recipe_id: string;
					sort_order: number;
					substitute_for?: string | null;
					unit: string;
				};
				Update: {
					id?: string;
					ingredient_id?: string | null;
					is_optional?: boolean;
					name?: string;
					preparation?: string | null;
					quantity?: number;
					recipe_id?: string;
					sort_order?: number;
					substitute_for?: string | null;
					unit?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'recipe_ingredients_recipe_id_fkey';
						columns: ['recipe_id'];
						isOneToOne: false;
						referencedRelation: 'recipes';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'recipe_ingredients_substitute_for_fkey';
						columns: ['substitute_for'];
						isOneToOne: false;
						referencedRelation: 'recipe_ingredients';
						referencedColumns: ['id'];
					}
				];
			};
			recipe_steps: {
				Row: {
					duration_minutes: number | null;
					id: string;
					image_url: string | null;
					instruction: string;
					recipe_id: string;
					sort_order: number;
					timer_label: string | null;
					timer_minutes: number | null;
				};
				Insert: {
					duration_minutes?: number | null;
					id?: string;
					image_url?: string | null;
					instruction: string;
					recipe_id: string;
					sort_order: number;
					timer_label?: string | null;
					timer_minutes?: number | null;
				};
				Update: {
					duration_minutes?: number | null;
					id?: string;
					image_url?: string | null;
					instruction?: string;
					recipe_id?: string;
					sort_order?: number;
					timer_label?: string | null;
					timer_minutes?: number | null;
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
					category: string;
					id: string;
					name: string;
					recipe_id: string;
				};
				Insert: {
					category: string;
					id?: string;
					name: string;
					recipe_id: string;
				};
				Update: {
					category?: string;
					id?: string;
					name?: string;
					recipe_id?: string;
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
			recipes: {
				Row: {
					active_time_minutes: number | null;
					cook_time_minutes: number | null;
					created_at: string;
					cuisine_type: string | null;
					description: string | null;
					household_id: string | null;
					id: string;
					image_url: string | null;
					meal_types: string[];
					notes: string | null;
					nutrition_per_serving: Json | null;
					nutrition_source: string;
					owner_id: string;
					prep_time_minutes: number | null;
					servings: number;
					source_url: string | null;
					title: string;
					total_time_minutes: number | null;
					updated_at: string;
				};
				Insert: {
					active_time_minutes?: number | null;
					cook_time_minutes?: number | null;
					created_at?: string;
					cuisine_type?: string | null;
					description?: string | null;
					household_id?: string | null;
					id?: string;
					image_url?: string | null;
					meal_types?: string[];
					notes?: string | null;
					nutrition_per_serving?: Json | null;
					nutrition_source?: string;
					owner_id?: string;
					prep_time_minutes?: number | null;
					servings: number;
					source_url?: string | null;
					title: string;
					total_time_minutes?: number | null;
					updated_at?: string;
				};
				Update: {
					active_time_minutes?: number | null;
					cook_time_minutes?: number | null;
					created_at?: string;
					cuisine_type?: string | null;
					description?: string | null;
					household_id?: string | null;
					id?: string;
					image_url?: string | null;
					meal_types?: string[];
					notes?: string | null;
					nutrition_per_serving?: Json | null;
					nutrition_source?: string;
					owner_id?: string;
					prep_time_minutes?: number | null;
					servings?: number;
					source_url?: string | null;
					title?: string;
					total_time_minutes?: number | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			shopping_list_items: {
				Row: {
					category: Database['public']['Enums']['shopping_category'];
					checked_at: string | null;
					checked_by_user_id: string | null;
					created_at: string;
					id: string;
					ingredient_id: string | null;
					name: string;
					needed_for: Json;
					quantity: number;
					shopping_list_id: string;
					sort_order: number;
					source_planned_meal_id: string | null;
					status: Database['public']['Enums']['shopping_item_status'];
					unit: string;
					updated_at: string;
				};
				Insert: {
					category?: Database['public']['Enums']['shopping_category'];
					checked_at?: string | null;
					checked_by_user_id?: string | null;
					created_at?: string;
					id?: string;
					ingredient_id?: string | null;
					name: string;
					needed_for?: Json;
					quantity?: number;
					shopping_list_id: string;
					sort_order?: number;
					source_planned_meal_id?: string | null;
					status?: Database['public']['Enums']['shopping_item_status'];
					unit?: string;
					updated_at?: string;
				};
				Update: {
					category?: Database['public']['Enums']['shopping_category'];
					checked_at?: string | null;
					checked_by_user_id?: string | null;
					created_at?: string;
					id?: string;
					ingredient_id?: string | null;
					name?: string;
					needed_for?: Json;
					quantity?: number;
					shopping_list_id?: string;
					sort_order?: number;
					source_planned_meal_id?: string | null;
					status?: Database['public']['Enums']['shopping_item_status'];
					unit?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'shopping_list_items_shopping_list_id_fkey';
						columns: ['shopping_list_id'];
						isOneToOne: false;
						referencedRelation: 'shopping_lists';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'shopping_list_items_source_planned_meal_id_fkey';
						columns: ['source_planned_meal_id'];
						isOneToOne: false;
						referencedRelation: 'planned_meals';
						referencedColumns: ['id'];
					}
				];
			};
			shopping_lists: {
				Row: {
					completed_at: string | null;
					created_at: string;
					generated_range_end: string | null;
					generated_range_start: string | null;
					household_id: string | null;
					id: string;
					name: string;
					owner_id: string;
					source_type: Database['public']['Enums']['shopping_list_source'];
					status: Database['public']['Enums']['shopping_list_status'];
					updated_at: string;
				};
				Insert: {
					completed_at?: string | null;
					created_at?: string;
					generated_range_end?: string | null;
					generated_range_start?: string | null;
					household_id?: string | null;
					id?: string;
					name: string;
					owner_id?: string;
					source_type?: Database['public']['Enums']['shopping_list_source'];
					status?: Database['public']['Enums']['shopping_list_status'];
					updated_at?: string;
				};
				Update: {
					completed_at?: string | null;
					created_at?: string;
					generated_range_end?: string | null;
					generated_range_start?: string | null;
					household_id?: string | null;
					id?: string;
					name?: string;
					owner_id?: string;
					source_type?: Database['public']['Enums']['shopping_list_source'];
					status?: Database['public']['Enums']['shopping_list_status'];
					updated_at?: string;
				};
				Relationships: [];
			};
			user_recipe_meta: {
				Row: {
					created_at: string;
					id: string;
					is_favorite: boolean;
					last_cooked_at: string | null;
					rating: number | null;
					recipe_id: string;
					times_cooked: number;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					is_favorite?: boolean;
					last_cooked_at?: string | null;
					rating?: number | null;
					recipe_id: string;
					times_cooked?: number;
					updated_at?: string;
					user_id?: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					is_favorite?: boolean;
					last_cooked_at?: string | null;
					rating?: number | null;
					recipe_id?: string;
					times_cooked?: number;
					updated_at?: string;
					user_id?: string;
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
		Views: {
			[_ in never]: never;
		};
		Functions: {
			seed_demo_data: { Args: { p_owner?: string }; Returns: Json };
		};
		Enums: {
			defrost_state: 'NOT_APPLICABLE' | 'FROZEN' | 'DEFROSTING' | 'READY';
			meal_slot: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
			planned_meal_source: 'RECIPE' | 'PREPPED' | 'STORE_BOUGHT' | 'QUICK';
			planned_meal_status: 'PLANNED' | 'LOGGED' | 'SKIPPED' | 'SWAPPED';
			portion_event_kind: 'INITIALIZED' | 'CONSUMED' | 'ADJUSTED';
			prepped_meal_origin: 'PREP_SESSION' | 'DIRECT_ENTRY' | 'STORE_BOUGHT';
			shopping_category:
				| 'PRODUCE'
				| 'DAIRY'
				| 'MEAT_SEAFOOD'
				| 'CANNED'
				| 'FROZEN'
				| 'BAKERY'
				| 'PANTRY_STAPLES'
				| 'OTHER';
			shopping_item_status: 'PENDING' | 'CHECKED' | 'UNAVAILABLE' | 'REMOVED';
			shopping_list_source: 'MANUAL' | 'FROM_PLAN';
			shopping_list_status: 'ACTIVE' | 'SHOPPING' | 'COMPLETED' | 'ARCHIVED';
			storage_location: 'PANTRY' | 'FRIDGE' | 'FREEZER' | 'OTHER';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {
			defrost_state: ['NOT_APPLICABLE', 'FROZEN', 'DEFROSTING', 'READY'],
			meal_slot: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'],
			planned_meal_source: ['RECIPE', 'PREPPED', 'STORE_BOUGHT', 'QUICK'],
			planned_meal_status: ['PLANNED', 'LOGGED', 'SKIPPED', 'SWAPPED'],
			portion_event_kind: ['INITIALIZED', 'CONSUMED', 'ADJUSTED'],
			prepped_meal_origin: ['PREP_SESSION', 'DIRECT_ENTRY', 'STORE_BOUGHT'],
			shopping_category: [
				'PRODUCE',
				'DAIRY',
				'MEAT_SEAFOOD',
				'CANNED',
				'FROZEN',
				'BAKERY',
				'PANTRY_STAPLES',
				'OTHER'
			],
			shopping_item_status: ['PENDING', 'CHECKED', 'UNAVAILABLE', 'REMOVED'],
			shopping_list_source: ['MANUAL', 'FROM_PLAN'],
			shopping_list_status: ['ACTIVE', 'SHOPPING', 'COMPLETED', 'ARCHIVED'],
			storage_location: ['PANTRY', 'FRIDGE', 'FREEZER', 'OTHER']
		}
	}
} as const;
