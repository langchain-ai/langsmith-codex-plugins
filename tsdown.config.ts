import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/hooks/UserPromptSubmit.ts", "./src/hooks/Stop.ts"],
  clean: true,
});
