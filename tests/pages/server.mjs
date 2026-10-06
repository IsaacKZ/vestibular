import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../dist/", import.meta.url));
const types = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};

// Serve a strict subdirectory, without Vite's SPA fallback masking missing paths.
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith("/vestibular/")) throw new Error("Outside mount");
    const relative = pathname.slice("/vestibular/".length) || "index.html";
    const file = resolve(root, relative);
    if (!file.startsWith(resolve(root) + sep) || !(await stat(file)).isFile())
      throw new Error("Missing file");
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(4174, "127.0.0.1");
