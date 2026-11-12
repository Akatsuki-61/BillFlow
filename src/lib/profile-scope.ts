export function activeProfileScope(): string {
  if (typeof window === "undefined") return "default";
  return sessionStorage.getItem("billflow_active_profile_scope") || "default";
}
export function profileStorageKey(key: string): string {
  return `${key}:${activeProfileScope()}`;
}
