// The size budget (gzip), checked in CI. 1.0.0, the first build on Fizlet: dist/index.js is 33,868 B
// (0.10.2 on the DOM VIRUS core: 29,160 B). The Board UI kit's CSS (keys, readouts, toast, touch pad:
// the family's one button language) is 2,962 B of it; the same build without that CSS is 30,906 B.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
// 1.0.2, Fizlet 0.20.0: 35,363 B (+504 B over 1.0.1's 34,859 B: the arcade touch lock +178 B, the
// kit's touch CSS +78 B, the rest of 0.20.0 +248 B). Inside the budget.
const BUDGET = 35500;
for (const file of ["dist/index.js", "dist/react.js"]) {
  const bytes = readFileSync(file), gzip = gzipSync(bytes).length;
  console.log(`${file}: ${bytes.length} bytes / ${gzip} gzip (budget ${BUDGET})`);
  if (gzip > BUDGET) throw new Error(`${file}: ${gzip} B gzip is over the ${BUDGET} B budget`);
}
