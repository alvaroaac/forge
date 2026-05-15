import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(new URL('..', import.meta.url).pathname);
const source = resolve(root, 'resources/icons/forge-source.svg');
const buildDir = resolve(root, 'build');
const iconset = resolve(buildDir, 'Forge.iconset');
const output = resolve(buildDir, 'icon.icns');

const sizes = [
  [16, 'icon_16x16.png', 'icp4'],
  [32, 'icon_16x16@2x.png', 'icp5'],
  [32, 'icon_32x32.png', 'icp5'],
  [64, 'icon_32x32@2x.png', 'icp6'],
  [128, 'icon_128x128.png', 'ic07'],
  [256, 'icon_128x128@2x.png', 'ic08'],
  [256, 'icon_256x256.png', 'ic08'],
  [512, 'icon_256x256@2x.png', 'ic09'],
  [512, 'icon_512x512.png', 'ic09'],
  [1024, 'icon_512x512@2x.png', 'ic10'],
];

await mkdir(buildDir, { recursive: true });
await rm(iconset, { force: true, recursive: true });
await mkdir(iconset, { recursive: true });

const pngs = await Promise.all(
  sizes.map(async ([size, filename, type]) => {
    const bytes = await sharp(source).resize(size, size).png().toBuffer();
    await writeFile(resolve(iconset, filename), bytes);
    return { type, bytes };
  }),
);

const uniquePngs = [...new Map(pngs.map((png) => [png.type, png])).values()];
const chunks = uniquePngs.map(({ type, bytes }) => {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32BE(bytes.length + 8, 4);
  return Buffer.concat([header, bytes]);
});
const header = Buffer.alloc(8);
header.write('icns', 0, 4, 'ascii');
header.writeUInt32BE(chunks.reduce((total, chunk) => total + chunk.length, 8), 4);

await writeFile(output, Buffer.concat([header, ...chunks]));
console.log(`Created ${output}`);
