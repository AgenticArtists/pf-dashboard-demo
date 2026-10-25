import { readFileSync } from "fs";
import path from "path";
import { money, num, EXCLUDED_SPEND, isSpend } from "./format";

const cache = {};
export function data(name) {
  if (!(name in cache)) {
    const raw = readFileSync(path.join(process.cwd(), "data", name), "utf8");
    cache[name] = JSON.parse(raw);
  }
  return cache[name];
}

export { money, num, EXCLUDED_SPEND, isSpend };
