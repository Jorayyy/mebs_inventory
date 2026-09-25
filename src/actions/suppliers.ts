"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit, snapshot } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { supplierCreateSchema, supplierUpdateSchema } from "@/lib/validations/inventory";
import type { Supplier } from "@/generated/prisma";

export type SupplierResult = { id: string };

async function assertUniqueName(name: string, ignoreId?: string): Promise<void> {
  const existing = await prisma.supplier.findFirst({
    where: {
      deletedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new AppError("A supplier with that name already exists.", { code: "DUPLICATE_NAME" });
}

export async function createSupplier(raw: unknown): Promise<ActionResult<SupplierResult>> {
  return withAction(
    async () => {
      const input = supplierCreateSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);
      await assertUniqueName(input.name);

      const supplier = await prisma.supplier.create({
        data: {
          name: input.name,
          contactPerson: input.contactPerson || null,
          email: input.email || null,
          phone: input.phone || null,
          website: input.website || null,
          address: input.address || null,
          taxId: input.taxId || null,
          productsSupplied: input.productsSupplied || null,
          notes: input.notes || null,
          status: input.status,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "SUPPLIER_CREATED",
        entityType: "Supplier",
        entityId: supplier.id,
        description: `Created supplier ${supplier.name}`,
        newValue: snapshot(supplier, ["name", "contactPerson", "email", "phone", "status", "productsSupplied"]),
        ip: await getClientIp(),
      });

      revalidatePath("/suppliers");
      return { id: supplier.id };
    },
    { action: "createSupplier" }
  );
}

export async function updateSupplier(raw: unknown): Promise<ActionResult<SupplierResult>> {
  return withAction(
    async () => {
      const input = supplierUpdateSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);

      const existing = await prisma.supplier.findUnique({ where: { id: input.id } });
      if (!existing || existing.deletedAt) {
        throw new AppError("Supplier not found.", { status: 404, code: "NOT_FOUND" });
      }
      if (input.name) await assertUniqueName(input.name, existing.id);

      const supplier: Supplier = await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? undefined,
          contactPerson: input.contactPerson !== undefined ? input.contactPerson || null : undefined,
          email: input.email !== undefined ? input.email || null : undefined,
          phone: input.phone !== undefined ? input.phone || null : undefined,
          website: input.website !== undefined ? input.website || null : undefined,
          address: input.address !== undefined ? input.address || null : undefined,
          taxId: input.taxId !== undefined ? input.taxId || null : undefined,
          productsSupplied:
            input.productsSupplied !== undefined ? input.productsSupplied || null : undefined,
          notes: input.notes !== undefined ? input.notes || null : undefined,
          status: input.status ?? undefined,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "SUPPLIER_UPDATED",
        entityType: "Supplier",
        entityId: supplier.id,
        description: `Updated supplier ${supplier.name}`,
        previousValue: snapshot(existing, [
          "name",
          "contactPerson",
          "email",
          "phone",
          "status",
          "productsSupplied",
          "notes",
        ]),
        newValue: snapshot(supplier, [
          "name",
          "contactPerson",
          "email",
          "phone",
          "status",
          "productsSupplied",
          "notes",
        ]),
        ip: await getClientIp(),
      });

      revalidatePath("/suppliers");
      revalidatePath(`/suppliers/${supplier.id}`);
      return { id: supplier.id };
    },
    { action: "updateSupplier", supplierId: String((raw as { id?: string })?.id ?? "") }
  );
}

/** Soft-deletes a supplier: purchase orders and receipts keep their history. */
export async function archiveSupplier(id: string): Promise<ActionResult<SupplierResult>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);
      const existing = await prisma.supplier.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) {
        throw new AppError("Supplier not found.", { status: 404, code: "NOT_FOUND" });
      }

      const openOrders = await prisma.purchaseOrder.count({
        where: { supplierId: id, status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } },
      });
      if (openOrders > 0) {
        throw new AppError(
          `This supplier has ${openOrders} open purchase order${openOrders === 1 ? "" : "s"}. Cancel or receive them first.`,
          { code: "SUPPLIER_IN_USE" }
        );
      }

      await prisma.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), status: "INACTIVE" },
      });

      await recordAudit({
        userId: user.id,
        action: "SUPPLIER_UPDATED",
        entityType: "Supplier",
        entityId: id,
        description: `Archived supplier ${existing.name}`,
        previousValue: { status: existing.status, deletedAt: null },
        newValue: { status: "INACTIVE", deletedAt: new Date().toISOString() },
        ip: await getClientIp(),
      });

      revalidatePath("/suppliers");
      revalidatePath(`/suppliers/${id}`);
      return { id };
    },
    { action: "archiveSupplier", supplierId: id }
  );
}

export async function restoreSupplier(id: string): Promise<ActionResult<SupplierResult>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);
      const existing = await prisma.supplier.findUnique({ where: { id } });
      if (!existing) throw new AppError("Supplier not found.", { status: 404, code: "NOT_FOUND" });

      await prisma.supplier.update({
        where: { id },
        data: { deletedAt: null, status: "ACTIVE" },
      });

      await recordAudit({
        userId: user.id,
        action: "SUPPLIER_UPDATED",
        entityType: "Supplier",
        entityId: id,
        description: `Restored supplier ${existing.name}`,
        previousValue: { status: existing.status, deletedAt: existing.deletedAt },
        newValue: { status: "ACTIVE", deletedAt: null },
        ip: await getClientIp(),
      });

      revalidatePath("/suppliers");
      revalidatePath(`/suppliers/${id}`);
      return { id };
    },
    { action: "restoreSupplier", supplierId: id }
  );
}
