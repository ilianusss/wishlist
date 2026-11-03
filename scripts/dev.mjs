import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { listPhotos, writePhotoManifest } from "./photos.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8000);
const MANIFEST_URL = "/data/photos.json";
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

const server = createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  } catch {
    return send(response, 400, "Bad request");
  }

  const filePath = join(ROOT, pathname.endsWith("/") ? `${pathname}index.html` : pathname);
  if (!filePath.startsWith(ROOT) || filePath.split(sep).includes("..")) return send(response, 403, "Forbidden");

  try {
    // The manifest is rebuilt on every request so photos dropped into assets/items show up on reload.
    if (pathname === MANIFEST_URL) {
      const manifest = await listPhotos();
      await writePhotoManifest(manifest);
      return send(response, 200, JSON.stringify(manifest), CONTENT_TYPES[".json"]);
    }

    const body = await readFile(filePath);
    send(response, 200, body, CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return send(response, 404, "Not found");
    console.error(`Failed to serve ${pathname}:`, error);
    send(response, 500, "Internal error");
  }
});

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

server.listen(PORT, HOST, () => console.log(`Wishlist: http://${HOST}:${PORT}`));
