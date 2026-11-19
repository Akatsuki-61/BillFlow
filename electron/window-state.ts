import fs from "node:fs";
import { z } from "zod";
import { atomicWrite } from "./managed-files";

export const DEFAULT_WINDOW_WIDTH = 1440;
export const DEFAULT_WINDOW_HEIGHT = 900;
export const MIN_WINDOW_WIDTH = 1100;
export const MIN_WINDOW_HEIGHT = 700;

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const persistedWindowStateSchema = z.object({
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  isMaximized: z.boolean().optional(),
});

function intersectionArea(a: WindowBounds, b: WindowBounds): number {
  const overlapX = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const overlapY = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return overlapX * overlapY;
}

function pickBestDisplay(
  rect: WindowBounds,
  displays: WindowBounds[],
  primaryWorkArea: WindowBounds,
): WindowBounds {
  let best = primaryWorkArea;
  let bestArea = 0;
  for (const display of displays) {
    const area = intersectionArea(rect, display);
    if (area > bestArea) {
      bestArea = area;
      best = display;
    }
  }
  return best;
}

function clampSize(
  requestedWidth: number,
  requestedHeight: number,
  workArea: WindowBounds,
): { width: number; height: number } {
  const minWidth = Math.min(MIN_WINDOW_WIDTH, workArea.width);
  const minHeight = Math.min(MIN_WINDOW_HEIGHT, workArea.height);
  return {
    width: Math.max(minWidth, Math.min(Math.round(requestedWidth), workArea.width)),
    height: Math.max(
      minHeight,
      Math.min(Math.round(requestedHeight), workArea.height),
    ),
  };
}

/** Clamps saved bounds to visible display work areas, falling back safely if a monitor was disconnected. */
export function clampWindowBounds(
  saved: Partial<WindowState> | null | undefined,
  displays: WindowBounds[],
  primaryWorkArea: WindowBounds,
): WindowState {
  if (
    !saved ||
    typeof saved.width !== "number" ||
    !Number.isFinite(saved.width) ||
    saved.width <= 0 ||
    typeof saved.height !== "number" ||
    !Number.isFinite(saved.height) ||
    saved.height <= 0
  ) {
    const { width, height } = clampSize(
      DEFAULT_WINDOW_WIDTH,
      DEFAULT_WINDOW_HEIGHT,
      primaryWorkArea,
    );
    return {
      width,
      height,
      isMaximized: Boolean(saved?.isMaximized),
    };
  }

  const hasOrigin =
    typeof saved.x === "number" &&
    Number.isFinite(saved.x) &&
    typeof saved.y === "number" &&
    Number.isFinite(saved.y);

  if (!hasOrigin) {
    const { width, height } = clampSize(
      saved.width,
      saved.height,
      primaryWorkArea,
    );
    return {
      width,
      height,
      isMaximized: Boolean(saved.isMaximized),
    };
  }

  const area = pickBestDisplay(
    {
      x: saved.x!,
      y: saved.y!,
      width: saved.width,
      height: saved.height,
    },
    displays,
    primaryWorkArea,
  );
  const { width, height } = clampSize(saved.width, saved.height, area);
  const maxX = Math.max(area.x, area.x + area.width - width);
  const maxY = Math.max(area.y, area.y + area.height - height);
  return {
    x: Math.max(area.x, Math.min(Math.round(saved.x!), maxX)),
    y: Math.max(area.y, Math.min(Math.round(saved.y!), maxY)),
    width,
    height,
    isMaximized: Boolean(saved.isMaximized),
  };
}

export function loadWindowState(
  filePath: string,
  displays: WindowBounds[],
  primaryWorkArea: WindowBounds,
): WindowState {
  try {
    if (!fs.existsSync(filePath)) {
      return clampWindowBounds(null, displays, primaryWorkArea);
    }
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return clampWindowBounds(null, displays, primaryWorkArea);
    }
    const parsed = persistedWindowStateSchema.safeParse(
      JSON.parse(fs.readFileSync(filePath, "utf8")),
    );
    if (!parsed.success) {
      return clampWindowBounds(null, displays, primaryWorkArea);
    }
    return clampWindowBounds(parsed.data, displays, primaryWorkArea);
  } catch {
    return clampWindowBounds(null, displays, primaryWorkArea);
  }
}

export function saveWindowState(filePath: string, state: WindowState): void {
  atomicWrite(filePath, JSON.stringify(state), 0o600);
}
