"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "./Workspace";

export async function readLocalImage(
  file: File,
  width: number,
  height: number,
) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Choose an image smaller than 15 MB.");
  const image = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, width / image.width, height / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.88);
  } finally {
    image.close();
  }
}

export function ImageUpload({
  label,
  value,
  onChange,
  signature = false,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void | Promise<void>;
  signature?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const change = async (file: File | null) => {
    setError("");
    setBusy(true);
    try {
      await onChange(
        file
          ? await readLocalImage(
              file,
              signature ? 640 : 360,
              signature ? 200 : 360,
            )
          : null,
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save the image.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      onDragOver={(event) => {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
          if (!busy) setIsDraggingOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setIsDraggingOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingOver(false);
        if (busy) return;
        const file = event.dataTransfer.files?.[0];
        if (!file) {
          setError("Drop a PNG, JPEG, or WebP image file.");
          return;
        }
        void change(file);
      }}
      className={`space-y-2 rounded-xl border p-2.5 transition-colors ${
        isDraggingOver
          ? "border-accent bg-accent-faint/40 border-dashed"
          : "border-transparent p-0"
      }`}
    >
      <p className="text-xs font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {value && (
          <Image
            src={value}
            alt={label}
            width={signature ? 168 : 48}
            height={48}
            unoptimized
            className={
              signature
                ? "rounded border border-line-neutral-200 bg-white object-contain"
                : "size-12 rounded-lg object-cover"
            }
          />
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void change(file);
            event.target.value = "";
          }}
        />
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {isDraggingOver
            ? `Drop ${signature ? "signature" : "image"} here`
            : `Upload ${signature ? "signature" : "photo"}`}
        </Button>
        {value && (
          <Button
            size="small"
            variant="ghost"
            disabled={busy}
            onClick={() => void change(null)}
          >
            Remove
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-content-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
