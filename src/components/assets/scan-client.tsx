"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine, Search, Loader2, Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ScanClient({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState(initialCode);
  const [resolving, setResolving] = React.useState(false);
  const [cameraOn, setCameraOn] = React.useState(false);
  const [scannerError, setScannerError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scannerRef = React.useRef<{ clear: () => void } | null>(null);

  async function resolve(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setResolving(true);
    try {
      const { globalSearch } = await import("@/actions/search");
      const hits = await globalSearch(trimmed);
      const exact =
        hits.find((h) => h.type === "asset" && h.title.toLowerCase() === trimmed.toLowerCase()) ??
        hits.find((h) => h.type === "asset");
      if (exact) {
        router.push(`/scan/${encodeURIComponent(exact.id)}`);
        return;
      }
      toast.error(`No asset found for "${trimmed}"`);
    } catch {
      toast.error("Lookup failed");
    } finally {
      setResolving(false);
    }
  }

  // Barcode scanners emit keystrokes quickly then press Enter — submit on Enter.
  React.useEffect(() => {
    if (initialCode) void resolve(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleCamera() {
    if (cameraOn) {
      scannerRef.current?.clear();
      scannerRef.current = null;
      setCameraOn(false);
      return;
    }
    setScannerError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          setCode(decoded);
          void resolve(decoded);
        },
        () => undefined
      );
      scannerRef.current = { clear: () => void scanner.stop().catch(() => undefined) };
      setCameraOn(true);
    } catch (error) {
      setScannerError(
        error instanceof Error ? error.message : "Camera unavailable on this device."
      );
    }
  }

  React.useEffect(() => {
    return () => scannerRef.current?.clear();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" /> Manual entry
          </CardTitle>
          <CardDescription>
            Point a USB barcode scanner at the label and it will type the code here automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resolve(code);
            }}
            className="flex gap-2"
          >
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. PC-MNL-00001"
              className="font-mono"
            />
            <Button type="submit" disabled={resolving || !code.trim()}>
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Look up
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {cameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />} Camera scanner
          </CardTitle>
          <CardDescription>Uses the device camera to read QR codes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div id="qr-reader" ref={containerRef} className="overflow-hidden rounded-lg" />
          {scannerError && <p className="text-sm text-destructive">{scannerError}</p>}
          <Button variant="outline" onClick={() => void toggleCamera()}>
            {cameraOn ? "Stop camera" : "Start camera"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
