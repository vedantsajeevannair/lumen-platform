import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "../src/lib/db.js";

/** Fingerprint the photographs that predate the sha256 column. */
const UPLOADS = path.join(process.cwd(), "uploads");

async function main() {
const rows = await db.complaintImage.findMany({ where: { sha256: null }, select: { id: true, path: true } });
let done = 0, missing = 0;
for (const r of rows) {
  try {
    const buf = await readFile(path.join(UPLOADS, path.basename(r.path)));
    await db.complaintImage.update({
      where: { id: r.id }, data: { sha256: createHash("sha256").update(buf).digest("hex") },
    });
    done++;
  } catch { missing++; }
}
console.log(`fingerprinted ${done}, file missing for ${missing}, of ${rows.length}`);
}

main();
