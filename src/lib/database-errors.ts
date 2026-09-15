import "server-only";

export function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const cause = "cause" in error ? error.cause : undefined;
  return (
    ("code" in error && error.code === "42P01") ||
    (cause !== null &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "42P01")
  );
}
