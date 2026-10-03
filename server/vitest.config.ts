import { defineConfig } from "vitest/config";

// Database tests share one test database, so files run one at a time.
export default defineConfig({ test: { fileParallelism: false } });
