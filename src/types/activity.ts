export interface WorkspaceActivity {
  id: string;
  kind:
    "communication" | "delivery" | "pdf-pending" | "pdf-saved" | "pdf-failed";
  recordId: string;
  label: string;
  detail: string;
  createdAt: string;
}
export type ActivityInput = Pick<
  WorkspaceActivity,
  "kind" | "recordId" | "label" | "detail"
>;
