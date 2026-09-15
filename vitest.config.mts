import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    deps: {
      optimizer: {
        // barrel ของ Hugeicons มีหลายพันไอคอน — pre-bundle ครั้งเดียวแทนการ transform ทุกรอบ
        client: { enabled: true, include: ["@hugeicons/core-free-icons", "@hugeicons/react"] },
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
});
