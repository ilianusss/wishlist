import { readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PHOTOS_DIR = join(ROOT, "assets", "items");
const MANIFEST_PATH = join(ROOT, "data", "photos.json");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]);

export async function listPhotos() {
  const folders = await readEntries(PHOTOS_DIR);
  const manifest = {};
  for (const folder of folders.filter((entry) => entry.isDirectory()).sort(byName)) {
    const files = (await readEntries(join(PHOTOS_DIR, folder.name)))
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .sort(byName)
      .map((entry) => entry.name);
    if (files.length > 0) manifest[folder.name] = files;
  }
  return manifest;
}

export async function writePhotoManifest(manifest) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readEntries(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function byName(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

if (import.meta.main) {
  const manifest = await listPhotos();
  await writePhotoManifest(manifest);
  console.log(`data/photos.json: ${Object.keys(manifest).length} item(s) with photos`);
}
