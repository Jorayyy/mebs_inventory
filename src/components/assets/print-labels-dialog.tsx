"use client";

import * as React from "react";
import { toast } from "sonner";
import { Printer, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getAssetLabels, type LabelPayload } from "@/actions/qr";
import { toCSV, downloadFilename } from "@/lib/utils";

export function PrintLabelsDialog({
  open: controlledOpen,
  onOpenChange,
  defaultOpen,
  assetIds,
  defaults,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  assetIds: string[];
  defaults?: { copies?: number };
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [labels, setLabels] = React.useState<LabelPayload[]>([]);
  const [copies, setCopies] = React.useState(defaults?.copies ?? 1);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || assetIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await getAssetLabels(assetIds);
        if (!cancelled) setLabels(rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load labels");
        handleOpenChange(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetIds.join(",")]);

  function downloadCsv() {
    const rows: (string | number)[][] = [["Asset Tag", "Name", "Serial", "Site", "QR Link"]];
    labels.forEach((label) => {
      for (let i = 0; i < copies; i += 1) {
        rows.push([label.assetTag, label.name, label.serialNumber ?? "", label.siteCode, label.deepLink]);
      }
    });
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadFilename("asset-labels");
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const expanded = labels.flatMap((label) => Array.from({ length: copies }, () => label));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Print QR labels</DialogTitle>
          <DialogDescription>
            {labels.length} asset{labels.length === 1 ? "" : "s"} · {expanded.length} label
            {expanded.length === 1 ? "" : "s"} in this sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Label htmlFor="copies" className="whitespace-nowrap">
            Copies per asset
          </Label>
          <Input
            id="copies"
            type="number"
            min={1}
            max={20}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-20"
          />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={labels.length === 0}>
              <Download /> Download CSV
            </Button>
            <Button size="sm" onClick={() => window.print()} disabled={labels.length === 0}>
              <Printer /> Print
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating QR codes…
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {expanded.map((label, index) => (
                <div
                  key={`${label.id}-${index}`}
                  className="rounded border bg-white p-2 text-black shadow-sm print:break-inside-avoid"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={label.qrDataUrl} alt="" className="mx-auto h-24 w-24" />
                  <p className="mt-1 truncate text-center font-mono text-[11px] font-bold">
                    {label.assetTag}
                  </p>
                  <p className="truncate text-center text-[10px]">{label.name}</p>
                  {label.serialNumber && (
                    <p className="truncate text-center font-mono text-[9px]">{label.serialNumber}</p>
                  )}
                  <p className="truncate text-center text-[9px] uppercase">{label.siteCode}</p>
                </div>
              ))}
            </div>
            {expanded.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No labels to print.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
