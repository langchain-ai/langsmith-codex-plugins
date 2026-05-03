import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    alwaysBundle: ["langsmith", "zod"],
    onlyBundle: false,
  },
  clean: true,
});
