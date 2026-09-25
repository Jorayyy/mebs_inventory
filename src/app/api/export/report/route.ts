import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, can, getClientIp } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { toCSV, downloadFilename } from "@/lib/utils";
import { buildScope, getReport, reportCsvRows } from "@/components/reports/registry";
import { parseReportParams } from "@/lib/validations/report";

const EXPORT_PAGE_SIZE = 100_000;

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  const report = getReport(slug);
  if (!report) return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  if (!can(user, PERMISSIONS.REPORTS_EXPORT) || !can(user, report.permission)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: slug,
      description: `Denied export of report "${report.title}"`,
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const query = parseReportParams(Object.fromEntries(request.nextUrl.searchParams));
    const scope = buildScope(user, query);
    const result = await report.run({ ...query, page: 1, pageSize: EXPORT_PAGE_SIZE }, scope);

    await recordAudit({
      userId: user.id,
      action: "EXPORT_GENERATED",
      entityType: "Report",
      entityId: report.slug,
      description: `Exported report "${report.title}" to CSV (${result.rows.length} rows)`,
      newValue: {
        count: result.rows.length,
        slug: report.slug,
        filters: Object.fromEntries(request.nextUrl.searchParams),
      },
      ip: await getClientIp(),
    });

    return new NextResponse(toCSV(reportCsvRows(report, result.rows)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${downloadFilename(report.slug)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    throw error;
  }
}
