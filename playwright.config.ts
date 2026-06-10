import { defineConfig, devices } from '@playwright/test';

// E2E runs against the built static SPA served by `vite preview`.
// The build imports Supabase config via `$env/static/public`, so the PUBLIC_*
// vars MUST be present for `bun run build` to succeed. We inject deterministic
// stub values: no live backend is required because the data stores swallow
// load failures and render empty states, which is exactly what these specs
// assert. See tests/pantry.e2e.ts.
const STUB_ENV = {
	PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stub'
};

const PORT = 4173;

export default defineConfig({
	testDir: 'tests',
	// Keep e2e specs (`*.e2e.ts`) distinct from vitest's `src/**/*.spec.ts`.
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'bun run build && bun run preview',
		port: PORT,
		env: STUB_ENV,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
