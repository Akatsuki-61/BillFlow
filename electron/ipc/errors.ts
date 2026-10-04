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

export function formatError(err: unknown) {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      fieldErrors: err.fieldErrors,
    };
  }
  if (err && typeof err === "object" && "issues" in err) {
    // Zod error
    const issues = (err as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) {
      const field = issue.path.join(".");
      if (field) fieldErrors[field] = issue.message;
    }
    return {
      code: "VALIDATION_ERROR",
      message: issues[0]?.message || "Validation failed",
      fieldErrors,
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: err instanceof Error ? err.message : String(err),
  };
}
