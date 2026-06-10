<script lang="ts">
	// Minimal ambient interface for the native BarcodeDetector API.
	// This API is not yet in lib.dom.d.ts, so we declare it locally.
	interface BarcodeDetectorResult {
		rawValue: string;
	}
	interface BarcodeDetectorAPI {
		detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
	}
	interface BarcodeDetectorConstructor {
		new (options?: { formats?: string[] }): BarcodeDetectorAPI;
	}

	interface Props {
		onDetect: (barcode: string) => void;
		onClose: () => void;
	}

	let { onDetect, onClose }: Props = $props();

	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream = $state<MediaStream | null>(null);
	let error = $state<string | null>(null);
	let scanning = $state(false);
	let manualValue = $state('');
	let animFrame = $state(0);

	function stopStream() {
		if (animFrame) {
			cancelAnimationFrame(animFrame);
			animFrame = 0;
		}
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			stream = null;
		}
		scanning = false;
	}

	function handleClose() {
		stopStream();
		onClose();
	}

	function handleManualSubmit(e: Event) {
		e.preventDefault();
		const trimmed = manualValue.trim();
		if (!trimmed) return;
		stopStream();
		onDetect(trimmed);
	}

	function handleManualChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		manualValue = input.value;
	}

	async function startScanLoop(detector: BarcodeDetectorAPI, video: HTMLVideoElement) {
		const tick = async () => {
			if (!scanning) return;
			try {
				const results = await detector.detect(video);
				if (results.length > 0 && results[0].rawValue) {
					stopStream();
					onDetect(results[0].rawValue);
					return;
				}
			} catch {
				// Detection errors on individual frames are non-fatal; keep looping
			}
			if (scanning) {
				animFrame = requestAnimationFrame(tick);
			}
		};
		animFrame = requestAnimationFrame(tick);
	}

	$effect(() => {
		if (!videoEl) return;

		const el = videoEl;

		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: 'environment' } })
			.then((mediaStream) => {
				stream = mediaStream;
				el.srcObject = mediaStream;
				scanning = true;

				if ('BarcodeDetector' in window) {
					const BarcodeDetectorCtor = (
						window as Window & { BarcodeDetector: BarcodeDetectorConstructor }
					).BarcodeDetector;
					const detector = new BarcodeDetectorCtor({
						formats: [
							'ean_13',
							'ean_8',
							'upc_a',
							'upc_e',
							'code_128',
							'code_39',
							'qr_code',
							'data_matrix'
						]
					});
					el.onloadedmetadata = () => {
						startScanLoop(detector, el);
					};
				} else {
					// Native BarcodeDetector unavailable — fallback shown in template
					scanning = false;
				}
			})
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.includes('Permission') || msg.includes('NotAllowed')) {
					error = 'Camera access was denied. Enter the barcode below instead.';
				} else if (msg.includes('NotFound') || msg.includes('Devices')) {
					error = 'No camera found. Enter the barcode below instead.';
				} else {
					error = 'Could not start camera. Enter the barcode below instead.';
				}
			});

		return () => {
			stopStream();
		};
	});
</script>

<!-- Modal overlay -->
<div
	role="dialog"
	aria-modal="true"
	aria-label="Barcode scanner"
	class="fixed inset-0 z-50 flex flex-col"
	style="background: oklch(0 0 0 / 0.72);"
>
	<!-- Header bar -->
	<div
		class="flex items-center justify-between px-4"
		style="min-height: var(--tap-min); background: var(--surface); border-bottom: 1px solid var(--border);"
	>
		<span
			style="font-family: var(--font-sans); font-weight: var(--weight-semibold); font-size: var(--text-base); color: var(--text);"
		>
			Scan barcode
		</span>
		<button
			type="button"
			onclick={handleClose}
			aria-label="Close scanner"
			style="min-width: var(--tap-min); min-height: var(--tap-min); display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); border-radius: var(--radius-sm);"
		>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M18 6 6 18M6 6l12 12"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>

	<!-- Camera preview area -->
	<div class="relative flex-1 overflow-hidden" style="background: var(--oat-950);">
		{#if !error}
			<!-- Video feed -->
			<video
				bind:this={videoEl}
				autoplay
				playsinline
				muted
				class="h-full w-full object-cover"
				aria-label="Camera preview"
			></video>

			<!-- Targeting reticle -->
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 flex items-center justify-center"
			>
				<div
					style="
						width: min(72%, 320px);
						aspect-ratio: 3/2;
						border: 3px solid var(--primary);
						border-radius: var(--radius-md);
						box-shadow: 0 0 0 9999px oklch(0 0 0 / 0.45);
					"
				></div>
			</div>

			<!-- "No BarcodeDetector" fallback notice -->
			{#if !scanning && !stream}
				<div
					class="absolute inset-0 flex items-center justify-center"
					style="background: oklch(0 0 0 / 0.55);"
				>
					<p
						style="color: var(--text-on-accent); font-family: var(--font-sans); font-size: var(--text-sm); text-align: center; padding: 0 var(--space-6);"
					>
						Camera scanning not supported in this browser.
					</p>
				</div>
			{/if}
		{:else}
			<!-- Error state -->
			<div
				class="flex h-full flex-col items-center justify-center gap-4 px-6"
				style="color: var(--text-on-accent);"
			>
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<circle cx="12" cy="12" r="10" stroke="var(--attention)" stroke-width="1.5" fill="none" />
					<path
						d="M12 8v4M12 16h.01"
						stroke="var(--attention)"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
				<p
					style="font-family: var(--font-sans); font-size: var(--text-base); text-align: center; color: var(--oat-100);"
				>
					{error}
				</p>
			</div>
		{/if}
	</div>

	<!-- Manual fallback input -->
	<form
		onsubmit={handleManualSubmit}
		class="flex gap-3 px-4 py-3"
		style="background: var(--surface); border-top: 1px solid var(--border);"
	>
		<label for="manual-barcode" class="sr-only">Enter barcode manually</label>
		<input
			id="manual-barcode"
			type="text"
			placeholder="Enter barcode manually"
			value={manualValue}
			oninput={handleManualChange}
			autocomplete="off"
			style="
				flex: 1;
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid var(--border-strong);
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
			"
		/>
		<button
			type="submit"
			class="nk-btn nk-btn--primary"
			style="min-width: var(--tap-min);"
			aria-label="Use entered barcode"
		>
			Use
		</button>
	</form>
</div>
