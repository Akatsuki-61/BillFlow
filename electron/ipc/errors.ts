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
  if (err instanceof AppError) return err;
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as {issues: {path:(string|number)[];message:string}[]}).issues;
    return new AppError("VALIDATION_ERROR", issues[0]?.message || "Validation failed", Object.fromEntries(issues.map(issue=>[issue.path.join("."),issue.message])));
  }
  return new AppError("INTERNAL_ERROR", err instanceof Error ? err.message : String(err));
}
