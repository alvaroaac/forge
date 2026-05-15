# Forge app icon

`forge-source.svg` is the source icon for macOS packaging. The current artwork is
the `03·C Tile F` concept from `resources/design/Forge Logo Concepts v2.html`.

To replace it, update `forge-source.svg` with the final icon artwork, then run:

```bash
npm run icon:mac
```

The generated `build/icon.icns` is intentionally not committed; packaging scripts regenerate it before building `Forge.app` or the DMG.
