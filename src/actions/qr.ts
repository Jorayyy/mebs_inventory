"use server";

import { requirePermission, assertSiteAccess, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { assetQRDataUrl, assetDeepLink } from "@/lib/qr";
import { prisma } from "@/lib/prisma";

export type LabelPayload = {
  id: string;
  assetTag: string;
  name: string;
  serialNumber: string | null;
  siteCode: string;
  qrDataUrl: string;
  deepLink: string;
};

/** Returns print-ready QR payloads for the requested assets (site-scoped). */
export async function getAssetLabels(assetIds: string[]): Promise<LabelPayload[]> {
  const user = await requirePermission(PERMISSIONS.ASSETS_PRINT_LABELS);
  if (assetIds.length === 0) return [];
  if (assetIds.length > 200) {
    throw new AppError("You can print at most 200 labels at once.", { status: 400 });
  }

  const assets = await prisma.asset.findMany({
    where: {
      id: { in: assetIds },
      deletedAt: null,
      ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
    },
    select: { id: true, assetTag: true, name: true, serialNumber: true, siteId: true, site: { select: { code: true } } },
    orderBy: { assetTag: "asc" },
  });

  if (assets.length === 0) throw new AppError("No matching assets found.", { status: 404 });
  assets.forEach((a) => assertSiteAccess(user, a.siteId));

  return Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      serialNumber: asset.serialNumber,
      siteCode: asset.site.code,
      qrDataUrl: await assetQRDataUrl(asset.assetTag),
      deepLink: assetDeepLink(asset.assetTag),
    }))
  );
}

export async function getAssetQr(assetId: string) {
  const user = await requirePermission(PERMISSIONS.ASSETS_VIEW);
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, assetTag: true, siteId: true },
  });
  if (!asset) throw new AppError("Asset not found.", { status: 404 });
  assertSiteAccess(user, asset.siteId);
  return { qrDataUrl: await assetQRDataUrl(asset.assetTag), deepLink: assetDeepLink(asset.assetTag) };
}
