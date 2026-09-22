import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkBuiltArch,
  machOArch,
  outputPath,
  requestedArches,
} from "../../../scripts/build.bun.ts";
import { BINARY_NAME, PUBLISHED_ARCHES } from "../src/binary-constants.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const binDirectory = join(root, "plugins", "tracing", "bin");
const otherArch = PUBLISHED_ARCHES.find((arch) => arch !== process.arch) as string;

describe("requestedArches", () => {
  it("builds this machine's architecture when nothing is asked for", () => {
    expect(requestedArches([])).toEqual([process.arch]);
  });

  it("builds every published architecture for --arch=all", () => {
    expect(requestedArches(["--arch=all"])).toEqual(PUBLISHED_ARCHES);
  });

  it.each(PUBLISHED_ARCHES)("builds only %s when it is the one named", (arch) => {
    expect(requestedArches(["--arch=" + arch])).toEqual([arch]);
  });

  it("refuses an architecture nothing is published for", () => {
    expect(() => requestedArches(["--arch=ia32"])).toThrow(
      `Unsupported architecture ia32, expected one of ${PUBLISHED_ARCHES.join(", ")}, all`,
    );
  });
});

describe("outputPath", () => {
  it("writes this machine's binary where the tests and the signer look for it", () => {
    expect(outputPath(process.arch)).toBe(join(binDirectory, BINARY_NAME));
  });

  it("writes a cross compiled binary into a directory of its own, under the same name", () => {
    expect(outputPath(otherArch)).toBe(join(binDirectory, `darwin-${otherArch}`, BINARY_NAME));
  });
});

describe("machOArch", () => {
  it("names the Mach-O architecture lipo reports for each published one", () => {
    expect(machOArch("arm64")).toBe("arm64");
    expect(machOArch("x64")).toBe("x86_64");
  });

  it("refuses an architecture it has no name for", () => {
    expect(() => machOArch("ia32")).toThrow("No Mach-O architecture is known for ia32");
  });
});

describe.runIf(PUBLISHED_ARCHES.every((arch) => existsSync(outputPath(arch))))(
  "the built binaries",
  () => {
    it("each hold the architecture they were asked for", () => {
      for (const arch of PUBLISHED_ARCHES) {
        expect(() => checkBuiltArch(outputPath(arch), arch), arch).not.toThrow();
      }
    });

    it("are refused when the other architecture's name is asked of them", () => {
      for (const arch of PUBLISHED_ARCHES) {
        const other = PUBLISHED_ARCHES.find((candidate) => candidate !== arch) as string;

        expect(() => checkBuiltArch(outputPath(arch), other), arch).toThrow(
          `produced ${machOArch(arch)}, not ${machOArch(other)}`,
        );
      }
    });
  },
);
