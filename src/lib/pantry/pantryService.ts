import { supabase } from '$lib/supabaseClient';
import { toPantryItem, type NewPantryItem, type PantryItem, type PantryItemUpdate } from './types';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getPantryItems(householdId?: string | null): Promise<PantryItem[]> {
	let query = supabase.from('pantry_items').select('*').order('storage_location').order('name');

	if (householdId) {
		query = query.or(
			`owner_id.eq.${(await supabase.auth.getUser()).data.user?.id},household_id.eq.${householdId}`
		);
	}

	const { data, error } = await query;
	if (error) throw new PantryServiceError('Failed to load pantry items', error);
	return (data ?? []).map(toPantryItem);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function addPantryItem(item: NewPantryItem): Promise<PantryItem> {
	const { data, error } = await supabase.from('pantry_items').insert(item).select().single();
	if (error) throw new PantryServiceError('Failed to add pantry item', error);
	return toPantryItem(data);
}

export async function updatePantryItem(id: string, changes: PantryItemUpdate): Promise<PantryItem> {
	const { data, error } = await supabase
		.from('pantry_items')
		.update(changes)
		.eq('id', id)
		.select()
		.single();
	if (error) throw new PantryServiceError('Failed to update pantry item', error);
	return toPantryItem(data);
}

export async function deletePantryItem(id: string): Promise<void> {
	const { error } = await supabase.from('pantry_items').delete().eq('id', id);
	if (error) throw new PantryServiceError('Failed to delete pantry item', error);
}

// ---------------------------------------------------------------------------
// Photo upload
// ---------------------------------------------------------------------------

export async function uploadPantryPhoto(itemId: string, file: File): Promise<string> {
	const resized = await resizeImage(file, 800);
	const path = `${itemId}/${Date.now()}.webp`;

	const { error: uploadError } = await supabase.storage
		.from('pantry-photos')
		.upload(path, resized, { contentType: 'image/webp', upsert: true });
	if (uploadError) throw new PantryServiceError('Failed to upload photo', uploadError);

	const { data } = supabase.storage.from('pantry-photos').getPublicUrl(path);
	return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resizeImage(file: File, maxPx: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () => {
			const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(img.width * scale);
			canvas.height = Math.round(img.height * scale);
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error('Canvas toBlob failed'));
				},
				'image/webp',
				0.85
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Image load failed'));
		};
		img.src = url;
	});
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class PantryServiceError extends Error {
	constructor(
		message: string,
		public readonly cause: unknown
	) {
		super(message);
		this.name = 'PantryServiceError';
	}
}
