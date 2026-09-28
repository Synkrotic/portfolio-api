import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readdir } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const COLLECTIONS = new Map(
  ["repositories", "images"].map((name) => [name, path.join(PUBLIC_DIR, name)]),
);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

for (const [name, dir] of COLLECTIONS) {
  app.use(`/api/${name}`, express.static(dir));
}

class NotFoundError extends Error {}

async function getFiles(
  collection: string,
  program: string,
): Promise<string[]> {
  const root = COLLECTIONS.get(collection);
  if (!root) throw new NotFoundError(`Unknown collection "${collection}"`);

  const dir = path.resolve(root, program);
  const rel = path.relative(root, dir);
  if (
    !rel ||
    rel === ".." ||
    rel.startsWith(".." + path.sep) ||
    path.isAbsolute(rel)
  ) {
    throw new NotFoundError(`"${program}" not found in "${collection}"`);
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      throw new NotFoundError(`"${program}" not found in "${collection}"`);
    }
    throw err;
  }
}

app.get("/api/newest//:program", async (req, res) => {
  const { program } = req.params;
  try {
    const files = await getFiles("repositories", program);

    if (files.length === 0) {
      res.status(404).json({ error: `No files for "${program}"` });
      return;
    }

    const newest = files
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .at(-1);

    res.json(newest);
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", async (_, res) => {
  res.status(200).json({ test: "Succeeded!" });
});

const PORT = 3001;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
