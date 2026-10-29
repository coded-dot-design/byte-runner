// The size budget (gzip), checked in CI. 1.0.0, the first build on Fizlet: dist/index.js is 33,694 B
// (0.10.2 on the DOM VIRUS core: 29,160 B). The Board UI kit's CSS (keys, readouts, toast, touch pad:
// the family's one button language) is 2,958 B of it; the same build without that CSS is 30,736 B.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const BUDGET = 34000;
for (const file of ["dist/index.js", "dist/react.js"]) {
  const bytes = readFileSync(file), gzip = gzipSync(bytes).length;
  console.log(`${file}: ${bytes.length} bytes / ${gzip} gzip (budget ${BUDGET})`);
  if (gzip > BUDGET) throw new Error(`${file}: ${gzip} B gzip is over the ${BUDGET} B budget`);
}
