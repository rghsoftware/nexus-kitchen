.PHONY: install build dev-web dev-server dev-android generate clean

# Install all dependencies
install:
	cd apps/web && pnpm install
	cd apps/mobile && ./gradlew --refresh-dependencies
	cd server && ./gradlew --refresh-dependencies

# Generate shared artifacts
generate: generate-tokens

generate-tokens:
	@echo "TODO: implement token generation"

# Development servers
dev-web:
	cd apps/web && pnpm dev

dev-server:
	cd server && ./gradlew run

dev-android:
	cd apps/mobile && ./gradlew :composeApp:installDebug

# Build all
build:
	cd apps/web && pnpm build
	cd server && ./gradlew build
	cd apps/mobile && ./gradlew assembleDebug

# Clean
clean:
	cd apps/web && rm -rf .svelte-kit node_modules
	cd apps/mobile && ./gradlew clean
	cd server && ./gradlew clean
