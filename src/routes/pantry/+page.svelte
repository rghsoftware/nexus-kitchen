<script lang="ts">
	import PantryTab from '$lib/components/pantry/PantryTab.svelte';
	import { loadPantryItems } from '$lib/pantry/pantryStore.svelte';
	import { loadPreppedMeals } from '$lib/pantry/preppedMealStore.svelte';

	$effect(() => {
		loadPantryItems();
		loadPreppedMeals();
	});
</script>

<PantryTab />
