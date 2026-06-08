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
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
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
		Enums: {}
	}
} as const;
