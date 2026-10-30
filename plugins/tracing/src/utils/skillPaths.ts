import { ABSOLUTE_PATH, HOME_PREFIX } from "../constants.js";

export function normalizedPath(path: string, home: string, cwd: string | undefined): string {
  const expanded = path.replaceAll("\\", "/").replace(HOME_PREFIX, home.replaceAll("\\", "/"));
  const anchored =
    ABSOLUTE_PATH.test(expanded) || cwd == null
      ? expanded
      : `${cwd.replaceAll("\\", "/")}/${expanded}`;
  const parts: string[] = [];
  for (const part of anchored.split("/")) {
    const rooted = parts[0] === "" || /^[A-Za-z]:$/.test(parts[0] ?? "");
    if (part === "..") {
      if (parts.length > (rooted ? 1 : 0)) parts.pop();
    } else if (part !== "." && (part !== "" || parts.length === 0)) {
      parts.push(part);
    }
  }
  return parts.join("/");
}
