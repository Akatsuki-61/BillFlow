import { expect, it } from "vitest";
import { isMessageDraftUrl, smsDraft, whatsAppDraft } from "../message-drafts";

it("encodes draft text and limits native dispatch to approved targets", () => {
  for (const link of [
    smsDraft("+94 77 123 4567", "Paid? Check & reply."),
    whatsAppDraft("+94 77 123 4567", "Paid? Check & reply.", "desktop"),
    whatsAppDraft("+94 77 123 4567", "Paid? Check & reply.", "web"),
  ]) {
    expect(isMessageDraftUrl(link)).toBe(true);
    expect(
      new URL(link).searchParams.get(link.startsWith("sms:") ? "body" : "text"),
    ).toBe("Paid? Check & reply.");
  }
  for (const link of [
    "https://web.whatsapp.com.evil.invalid/send?text=test",
    "https://web.whatsapp.com/send?redirect=https://example.invalid&text=test",
    "whatsapp://settings?text=test",
    "sms:+94771234567?body=test&body=again",
    "file:///Users/test",
  ])
    expect(isMessageDraftUrl(link)).toBe(false);
});
