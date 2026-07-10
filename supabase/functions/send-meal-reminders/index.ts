// send-meal-reminders — the delivery layer for Feature 007 (issue #15).
//
// Invoked every minute by pg_cron (see 0010_meal_reminders.sql). All calendar,
// timezone and day-of-week logic lives in the due_meal_reminders() SQL function
// where pgTAP proves it; this function is only the dispatch loop:
//
//   due occurrences → claim each via the deliveries UNIQUE key → Pushover →
//   record SENT / FAILED.
//
// The claim step (upsert with ignoreDuplicates) is what makes overlapping or
// retried cron runs safe: only the run that inserts the delivery row sends.
// There is no retry of failures — a nudge that didn't make it is dropped, never
// re-sent late (REQ-MR-005), and stays visible in reminder_deliveries.
//
// Copy rules (REQ-MR-004/005, REQ-UX-006..011): soft, no urgency, no guilt.
// Tone reference: design/screens/mobile-reminder.html.

import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Caller gate. verify_jwt is off for this function (the anon key is a valid
 * JWT and public by design, so it gates nothing) — the real credential is a
 * random shared secret known only to the cron invoker (Vault) and this
 * function's env. Compared via SHA-256 digests so the comparison is
 * constant-time and length-independent. Fails closed: no secret configured
 * means no caller is authorized.
 */
async function authorized(req: Request): Promise<boolean> {
	const secret = Deno.env.get('CRON_SHARED_SECRET');
	if (!secret) return false;
	const encoder = new TextEncoder();
	const [given, expected] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(req.headers.get('x-cron-secret') ?? '')),
		crypto.subtle.digest('SHA-256', encoder.encode(secret))
	]);
	const a = new Uint8Array(given);
	const b = new Uint8Array(expected);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

type DueReminder = {
	reminder_id: string;
	owner_id: string;
	kind: 'MAIN' | 'PRE_ALERT';
	name: string;
	meal_slot: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
	reminder_time: string;
	pre_alert_minutes: number | null;
	local_date: string;
	planned_meal_name: string | null;
	planned_meal_source: 'RECIPE' | 'PREPPED' | 'STORE_BOUGHT' | 'QUICK' | null;
};

const SLOT_LABEL: Record<DueReminder['meal_slot'], string> = {
	BREAKFAST: 'breakfast',
	LUNCH: 'lunch',
	DINNER: 'dinner',
	SNACK: 'a snack'
};

const MAIN_TITLE: Record<DueReminder['meal_slot'], string> = {
	BREAKFAST: "It's around breakfast time",
	LUNCH: "It's around lunchtime",
	DINNER: "It's around dinnertime",
	SNACK: 'A little something?'
};

function composeMessage(due: DueReminder): { title: string; message: string } {
	const meal = due.planned_meal_name;
	const readyPhrase =
		due.planned_meal_source === 'PREPPED' ? 'is prepped and ready' : 'is ready to happen';

	if (due.kind === 'PRE_ALERT') {
		const mins = due.pre_alert_minutes ?? 30;
		return {
			title: `${SLOT_LABEL[due.meal_slot][0].toUpperCase()}${SLOT_LABEL[due.meal_slot].slice(1)} is coming up`,
			message: meal
				? `${meal} in about ${mins} minutes. If you feel like getting started, now's a nice moment — no pressure.`
				: `In about ${mins} minutes, if you feel like it. A head start is nice, skipping it is fine too.`
		};
	}

	return {
		title: MAIN_TITLE[due.meal_slot],
		message: meal
			? `Your ${meal} ${readyPhrase} whenever you are. No rush — just a gentle nudge.`
			: `Whenever you're ready — something small counts too. No rush, just a gentle nudge.`
	};
}

async function sendPushover(
	token: string,
	user: string,
	title: string,
	message: string
): Promise<{ ok: boolean; detail: string }> {
	const body = new URLSearchParams({ token, user, title, message });
	try {
		const res = await fetch('https://api.pushover.net/1/messages.json', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body
		});
		const text = await res.text();
		return { ok: res.ok, detail: res.ok ? 'pushover accepted' : `HTTP ${res.status}: ${text}` };
	} catch (err) {
		return {
			ok: false,
			detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`
		};
	}
}

Deno.serve(async (req) => {
	if (!(await authorized(req))) {
		return Response.json({ error: 'unauthorized' }, { status: 401 });
	}

	const pushoverToken = Deno.env.get('PUSHOVER_APP_TOKEN');
	const pushoverUser = Deno.env.get('PUSHOVER_USER_KEY');
	if (!pushoverToken || !pushoverUser) {
		// Not an error: the cron fires in every environment; only configured
		// ones deliver. The skip is visible in the function logs.
		return Response.json({ due: 0, sent: 0, skipped: 'pushover secrets not configured' });
	}

	const supabase = createClient(
		Deno.env.get('SUPABASE_URL')!,
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
		{ auth: { persistSession: false } }
	);

	const { data: due, error: dueError } = await supabase.rpc('due_meal_reminders');
	if (dueError) {
		console.error('due_meal_reminders failed:', dueError.message);
		return Response.json({ error: dueError.message }, { status: 500 });
	}
	const dueRows = (due ?? []) as DueReminder[];
	if (dueRows.length === 0) {
		return Response.json({ due: 0, sent: 0 });
	}

	// Claim occurrences: ignoreDuplicates means the returned rows are exactly
	// the ones THIS run inserted — anything already claimed elsewhere drops out.
	const { data: claimed, error: claimError } = await supabase
		.from('reminder_deliveries')
		.upsert(
			dueRows.map((d) => ({
				reminder_id: d.reminder_id,
				owner_id: d.owner_id,
				kind: d.kind,
				local_date: d.local_date
			})),
			{ onConflict: 'reminder_id,kind,local_date', ignoreDuplicates: true }
		)
		.select('id, reminder_id, kind, local_date');
	if (claimError) {
		console.error('claiming deliveries failed:', claimError.message);
		return Response.json({ error: claimError.message }, { status: 500 });
	}

	let sent = 0;
	let failed = 0;
	for (const claim of claimed ?? []) {
		const row = dueRows.find(
			(d) =>
				d.reminder_id === claim.reminder_id &&
				d.kind === claim.kind &&
				d.local_date === claim.local_date
		);
		if (!row) continue;

		const { title, message } = composeMessage(row);
		const result = await sendPushover(pushoverToken, pushoverUser, title, message);
		if (result.ok) {
			sent++;
		} else {
			failed++;
			console.error(`delivery ${claim.id} failed: ${result.detail}`);
		}

		const { error: markError } = await supabase
			.from('reminder_deliveries')
			.update({
				status: result.ok ? 'SENT' : 'FAILED',
				detail: result.detail.slice(0, 500),
				sent_at: result.ok ? new Date().toISOString() : null
			})
			.eq('id', claim.id);
		if (markError) console.error(`marking delivery ${claim.id} failed: ${markError.message}`);
	}

	return Response.json({ due: dueRows.length, claimed: (claimed ?? []).length, sent, failed });
});
