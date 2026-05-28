# Release Process

## 1. Validate

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

## 2. Scan for Secrets

```bash
rg -n "xai-|sk-|AIza|api_key|apiKey|Bearer" . \
  --glob '!node_modules/**' \
  --glob '!src-tauri/target/**' \
  --glob '!dist/**' \
  --glob '!release/**' \
  --glob '!.git/**'
```

Any real credential must be removed before publishing.

## 3. Build Assets

Tauri writes the macOS DMG to:

```text
src-tauri/target/release/bundle/dmg/
```

Create a clean source ZIP from the Desktop parent folder:

```bash
cd "$HOME/Desktop"
zip -qr Aro-open-source-v0.2.0.zip Aro \
  -x 'Aro/.git/*' \
  -x 'Aro/node_modules/*' \
  -x 'Aro/dist/*' \
  -x 'Aro/release/*' \
  -x 'Aro/src-tauri/target/*' \
  -x 'Aro/src-tauri/gen/*' \
  -x 'Aro/.claude/*' \
  -x 'Aro/.env*' \
  -x 'Aro/settings.json' \
  -x 'Aro/*.zip' \
  -x 'Aro/*.dmg'
```

## 4. Tag

```bash
git tag v0.2.0
git push origin main
git push origin v0.2.0
```

## 5. Create GitHub Release

Upload:

- `Aro_0.2.0_aarch64.dmg`
- `Aro-open-source-v0.2.0.zip`

Release notes should include:

- user-visible changes
- security changes
- known limitations
- whether the app is signed/notarized

## 6. Post-Release Check

Confirm:

- repository is public
- GitHub shows MIT license
- release assets download correctly
- no local API keys are included in source ZIP
