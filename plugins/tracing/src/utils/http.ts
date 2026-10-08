export function normalizedEndpoint(apiUrl: string) {
  const url = new URL(apiUrl);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export function errorStatus(error: unknown) {
  if (error == null || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}
