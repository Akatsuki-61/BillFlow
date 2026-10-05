import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { vendors, clients } from "../db/schema";
import { newVendorSchema, vendorPatchSchema } from "../validation";
import { AppError, formatError } from "./errors";
import {
  VendorItem,
  NewVendorInput,
  VendorPatchInput,
} from "../../src/types/outsourcing";

export function listVendors(): VendorItem[] {
  const db = getDb();
  const allVendors = db
    .select()
    .from(vendors)
    .orderBy(desc(vendors.createdAt))
    .all();

  const allClients = db.select({ id: clients.id, name: clients.name }).from(clients).all();
  const clientMap = new Map<string, string>();
  for (const c of allClients) {
    clientMap.set(c.id, c.name);
  }

  return allVendors.map((v) => ({
    id: v.id,
    name: v.name,
    service: v.service,
    currentBalance: Math.round(v.balanceCents / 100),
    status: v.status as "PENDING" | "PAID",
    iconType: v.iconType as "design" | "devops" | "legal" | "development",
    email: v.email,
    phone: v.phone,
    linkedClientId: v.linkedClientId,
    linkedClientName:
      v.linkedClientName ||
      (v.linkedClientId ? clientMap.get(v.linkedClientId) || null : null),
    payoutDueDate: v.payoutDueDate,
    notes: v.notes,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }));
}

export function registerVendorHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("vendors:list", async () => {
    try {
      return listVendors();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("vendors:create", async (_event, input: NewVendorInput) => {
    try {
      const balanceCents =
        typeof input.balanceCents === "number"
          ? input.balanceCents
          : typeof input.currentBalance === "number"
            ? Math.round(input.currentBalance * 100)
            : 0;

      const validated = newVendorSchema.parse({
        ...input,
        balanceCents,
      });

      const db = getDb();
      const id = `vnd-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

      db.insert(vendors)
        .values({
          id,
          name: validated.name,
          service: validated.service,
          balanceCents: validated.balanceCents,
          status: validated.status,
          iconType: validated.iconType,
          email: validated.email || null,
          phone: validated.phone || null,
          linkedClientId: validated.linkedClientId || null,
          linkedClientName: validated.linkedClientName || null,
          payoutDueDate: validated.payoutDueDate || null,
          notes: validated.notes || null,
        })
        .run();

      broadcastDataChanged();
      const created = listVendors().find((v) => v.id === id);
      return created!;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "vendors:update",
    async (_event, id: string, patch: VendorPatchInput) => {
      try {
        const balanceCents =
          typeof patch.balanceCents === "number"
            ? patch.balanceCents
            : typeof patch.currentBalance === "number"
              ? Math.round(patch.currentBalance * 100)
              : undefined;

        const validated = vendorPatchSchema.parse({
          ...patch,
          balanceCents,
        });

        const db = getDb();
        const existing = db
          .select()
          .from(vendors)
          .where(eq(vendors.id, id))
          .get();
        if (!existing) throw new AppError("NOT_FOUND", "Vendor not found");

        const updateData: Record<string, unknown> = {};
        if (validated.name !== undefined) updateData.name = validated.name;
        if (validated.service !== undefined)
          updateData.service = validated.service;
        if (validated.balanceCents !== undefined)
          updateData.balanceCents = validated.balanceCents;
        if (validated.status !== undefined)
          updateData.status = validated.status;
        if (validated.iconType !== undefined)
          updateData.iconType = validated.iconType;
        if (validated.email !== undefined) updateData.email = validated.email;
        if (validated.phone !== undefined) updateData.phone = validated.phone;
        if (validated.linkedClientId !== undefined)
          updateData.linkedClientId = validated.linkedClientId;
        if (validated.linkedClientName !== undefined)
          updateData.linkedClientName = validated.linkedClientName;
        if (validated.payoutDueDate !== undefined)
          updateData.payoutDueDate = validated.payoutDueDate;
        if (validated.notes !== undefined) updateData.notes = validated.notes;
        updateData.updatedAt = new Date().toISOString();

        db.update(vendors)
          .set(updateData)
          .where(eq(vendors.id, id))
          .run();

        broadcastDataChanged();
        const updated = listVendors().find((v) => v.id === id);
        return updated!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "vendors:setStatus",
    async (_event, id: string, status: "PENDING" | "PAID") => {
      try {
        if (status !== "PENDING" && status !== "PAID") {
          throw new AppError("VALIDATION_ERROR", "Invalid vendor status");
        }

        const db = getDb();
        const existing = db
          .select()
          .from(vendors)
          .where(eq(vendors.id, id))
          .get();
        if (!existing) throw new AppError("NOT_FOUND", "Vendor not found");

        db.update(vendors)
          .set({ status, updatedAt: new Date().toISOString() })
          .where(eq(vendors.id, id))
          .run();

        broadcastDataChanged();
        const updated = listVendors().find((v) => v.id === id);
        return updated!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("vendors:remove", async (_event, id: string) => {
    try {
      const db = getDb();
      const existing = db
        .select()
        .from(vendors)
        .where(eq(vendors.id, id))
        .get();
      if (!existing) throw new AppError("NOT_FOUND", "Vendor not found");

      db.delete(vendors)
        .where(eq(vendors.id, id))
        .run();

      broadcastDataChanged();
      return { success: true };
    } catch (err) {
      throw formatError(err);
    }
  });
}
