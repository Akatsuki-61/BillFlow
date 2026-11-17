import { activeProfileScope, profileStorageKey } from "./profile-scope";
export async function workspaceDraft(
  key: string,
  value?: string | null,
): Promise<string | null> {
  const profileId = activeProfileScope();
  if (window.billflow?.workspace?.draft) {
    const quarantine = window.billflow.workspace.quarantineDrafts;
    if (quarantine) {
      const legacy = Object.fromEntries(
        Object.keys(localStorage)
          .filter((name) =>
            /^billflow_draft_(?:client|expense|catalog|task|workorder|invoice)(?::[a-zA-Z0-9-]+)?$/.test(
              name,
            ),
          )
          .map((name) => [name, localStorage.getItem(name)!]),
      );
      if (Object.keys(legacy).length) {
        await quarantine(legacy);
        for (const name of Object.keys(legacy)) localStorage.removeItem(name);
      }
    }
    return window.billflow.workspace.draft(
      profileId,
      key.replace("billflow_draft_", ""),
      value,
    );
  }
  const storageKey = profileStorageKey(key);
  if (value === null) localStorage.removeItem(storageKey);
  else if (value !== undefined) localStorage.setItem(storageKey, value);
  return localStorage.getItem(storageKey);
}
