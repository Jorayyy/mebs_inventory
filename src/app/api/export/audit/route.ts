import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, can, getClientIp } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { queryAuditLogs } from "@/actions/audit";
import { parseAuditQuery } from "@/lib/validations/report";
import { toCSV, downloadFilename, formatDate } from "@/lib/utils";

const EXPORT_PAGE_SIZE = 100_000;

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!can(user, PERMISSIONS.AUDIT_VIEW)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: "audit-trail",
      description: "Denied audit trail export",
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = parseAuditQuery(searchParams);
  const { rows, total } = await queryAuditLogs({
    filters: {
      action: query.action,
      entityType: query.entityType,
      userId: query.userId,
      site: query.site,
      from: query.from,
      to: query.to,
      q: query.q,
    },
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
    sort: query.sort,
    dir: query.dir,
  });

  const header = [
    "Timestamp",
    "Action",
    "Actor",
    "Actor Email",
    "Entity Type",
    "Entity ID",
    "Description",
    "Site",
    "IP Address",
    "Request ID",
  ];

  const body = rows.map((row) => [
    formatDate(row.createdAt, true),
    row.action,
    row.user?.name ?? "System",
    row.user?.email ?? "",
    row.entityType,
    row.entityId ?? "",
    row.description ?? "",
    row.siteName ?? "Global",
    row.ip ?? "",
    row.requestId ?? "",
  ]);

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "AuditLog",
    entityId: "audit-trail",
    description: `Exported ${rows.length} audit entr${rows.length === 1 ? "y" : "ies"} to CSV`,
    newValue: { count: rows.length, total, filters: searchParams },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...body]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("audit-trail")}"`,
      "Cache-Control": "no-store",
    },
  });
}
