# Forge app icon

`forge-source.svg` is the temporary source icon for macOS packaging.

To replace it, update `forge-source.svg` with the final icon artwork, then run:

```bash
npm run icon:mac
```

The generated `build/icon.icns` is intentionally not committed; packaging scripts regenerate it before building `Forge.app` or the DMG.
