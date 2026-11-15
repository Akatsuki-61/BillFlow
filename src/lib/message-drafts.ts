import { normalizeWhatsAppPhone } from "./whatsapp";

export type WhatsAppTarget = "desktop" | "web";

export function whatsAppDraft(
  phone: string | null | undefined,
  message: string,
  target: WhatsAppTarget,
) {
  const number = normalizeWhatsAppPhone(phone);
  const params = new URLSearchParams({ text: message });
  if (number) params.set("phone", number);
  return (
    (target === "desktop"
      ? "whatsapp://send?"
      : "https://web.whatsapp.com/send?") + params
  );
}

export function smsDraft(phone: string | null | undefined, message: string) {
  const number = normalizeWhatsAppPhone(phone);
  return number ? `sms:+${number}?body=${encodeURIComponent(message)}` : "";
}

export function isMessageDraftUrl(input: string) {
  if (!input || input.length > 16_000 || /[\r\n]/.test(input)) return false;
  try {
    const url = new URL(input);
    if (url.hash || url.username || url.password || url.port) return false;
    if (url.protocol === "sms:")
      return (
        /^\+\d{6,15}$/.test(url.pathname) &&
        !url.host &&
        [...url.searchParams.keys()].join() === "body"
      );
    if (
      url.protocol === "whatsapp:" ||
      (url.origin === "https://web.whatsapp.com" && url.pathname === "/send")
    ) {
      const keys = [...url.searchParams.keys()];
      return (
        (url.protocol === "https:" ||
          (url.hostname === "send" && ["", "/"].includes(url.pathname))) &&
        keys.includes("text") &&
        new Set(keys).size === keys.length &&
        keys.every((key) => key === "phone" || key === "text") &&
        (!url.searchParams.has("phone") ||
          /^\d{6,15}$/.test(url.searchParams.get("phone")!))
      );
    }
    return false;
  } catch {
    return false;
  }
}

export async function openMessageDraft(url: string) {
  if (!url) throw new Error("Add a phone number before opening a draft.");
  if (/^(sms|whatsapp):/i.test(url) && !isMessageDraftUrl(url))
    throw new Error("Enter a valid international phone number.");
  if (isMessageDraftUrl(url) && window.billflow?.files?.openDraft) {
    await window.billflow.files.openDraft(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
