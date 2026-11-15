"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Button } from "@/components/ui/Workspace";

export function SignatureEditor({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const previous = useRef({ x: 0, y: 0 });
  const [hasInk, setHasInk] = useState(false);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x:
        ((event.clientX - bounds.left) * event.currentTarget.width) /
        bounds.width,
      y:
        ((event.clientY - bounds.top) * event.currentTarget.height) /
        bounds.height,
    };
  };
  const stop = () => {
    pointer.current = null;
  };

  return (
    <div className="space-y-3">
      <ImageUpload
        label="Invoice signature"
        signature
        value={value}
        onChange={onChange}
      />
      <canvas
        ref={canvas}
        width={640}
        height={180}
        aria-label="Draw invoice signature"
        className="h-28 w-full touch-none rounded-lg border border-line-neutral-300 bg-white"
        onPointerDown={(event) => {
          if (pointer.current !== null || event.button !== 0) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          previous.current = point(event);
        }}
        onPointerMove={(event) => {
          if (pointer.current !== event.pointerId) return;
          const next = point(event);
          const context = event.currentTarget.getContext("2d")!;
          context.strokeStyle = "#182532";
          context.lineCap = "round";
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(previous.current.x, previous.current.y);
          context.lineTo(next.x, next.y);
          context.stroke();
          previous.current = next;
          setHasInk(true);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="small"
          disabled={!hasInk}
          onClick={() => onChange(canvas.current!.toDataURL("image/png"))}
        >
          Use drawing
        </Button>
        <Button
          variant="ghost"
          size="small"
          disabled={!hasInk}
          onClick={() => {
            const element = canvas.current!;
            element
              .getContext("2d")!
              .clearRect(0, 0, element.width, element.height);
            setHasInk(false);
          }}
        >
          Clear drawing
        </Button>
      </div>
    </div>
  );
}
