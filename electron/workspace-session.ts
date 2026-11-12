import {
  getActiveProfileId,
  getDatabasePath,
  getDb,
  getWorkspaceGeneration,
} from "./db";
let initializedProfile: string | null = null;
let initializedPath: string | null = null;
let unlockedProfile: string | null = null;
let sessionGeneration = 0;
export function initializeProfileSession(
  id: string,
  protectedProfile: boolean,
) {
  if (initializedProfile === id && initializedPath === getDatabasePath())
    return;
  initializedPath = getDatabasePath();
  initializedProfile = id;
  unlockedProfile = protectedProfile ? null : id;
  sessionGeneration++;
}
export function unlockProfileSession(id: string) {
  initializedPath = getDatabasePath();
  initializedProfile = id;
  unlockedProfile = id;
  sessionGeneration++;
}
export function lockProfileSession() {
  unlockedProfile = null;
  sessionGeneration++;
}
export function isWorkspaceUnlocked() {
  return unlockedProfile === getActiveProfileId();
}
export function captureWorkspace() {
  const context = {
    profileId: getActiveProfileId(),
    databasePath: getDatabasePath(),
    db: getDb(),
    generation: getWorkspaceGeneration(),
    session: sessionGeneration,
  };
  return {
    ...context,
    assertCurrent() {
      if (
        context.generation !== getWorkspaceGeneration() ||
        context.session !== sessionGeneration ||
        context.profileId !== getActiveProfileId() ||
        context.db !== getDb()
      ) {
        throw new Error(
          "WORKSPACE_CHANGED: The workspace changed. Please repeat this operation in the intended profile.",
        );
      }
    },
  };
}
