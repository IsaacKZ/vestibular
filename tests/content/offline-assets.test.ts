import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getManifest } from "workbox-build";
import { expect, test } from "vitest";
import { offlineAssetPatterns } from "../../vite.config";

test("o cache offline inclui formatos de figuras renderizáveis conferidas", async () => {
  const directory = await mkdtemp(join(tmpdir(), "udesc-offline-assets-"));
  const files = [
    "plot.svg",
    "graph.png",
    "photo.jpg",
    "photo.jpeg",
    "diagram.webp",
    "diagram.avif",
    "drawing.gif",
    "PHOTO.JPG",
    "PHOTO.jPeG",
  ];
  try {
    await mkdir(join(directory, "content/assets"), { recursive: true });
    for (const file of files)
      await writeFile(
        join(directory, "content/assets", file),
        "test-only asset",
      );
    const manifest = await getManifest({
      globDirectory: directory,
      globPatterns: offlineAssetPatterns,
    });
    expect(manifest.manifestEntries.map((entry) => entry.url).sort()).toEqual(
      files.map((file) => `content/assets/${file}`).sort(),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("os PDFs de procedência do conteúdo ficam disponíveis offline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "udesc-offline-documents-"));
  try {
    await mkdir(join(directory, "content/documents/gabaritos"), { recursive: true });
    await writeFile(join(directory, "content/documents/gabaritos/oficial.pdf"), "test-only PDF");
    const manifest = await getManifest({
      globDirectory: directory, globPatterns: offlineAssetPatterns,
    });
    expect(manifest.manifestEntries.map((entry) => entry.url))
      .toContain("content/documents/gabaritos/oficial.pdf");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
