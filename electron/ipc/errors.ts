export class AppError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function formatError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) {
      const field = issue.path.join(".");
      if (field) fieldErrors[field] = issue.message;
    }
    return new AppError("VALIDATION_ERROR", issues[0]?.message || "Validation failed", fieldErrors);
  }
  // Electron serializes an Error's message across invoke(); thrown plain objects
  // otherwise lose the actionable validation/storage message in the renderer.
  return new AppError("INTERNAL_ERROR", err instanceof Error ? err.message : String(err));
}
