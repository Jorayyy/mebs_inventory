import QRCode from "qrcode";

const BASE_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Deep link that opens the asset profile when the QR code is scanned. */
export function assetDeepLink(assetTagOrId: string): string {
  return `${BASE_URL()}/scan?code=${encodeURIComponent(assetTagOrId)}`;
}

export async function assetQRDataUrl(assetTagOrId: string): Promise<string> {
  return QRCode.toDataURL(assetDeepLink(assetTagOrId), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#0b1220", light: "#ffffff" },
  });
}

export async function assetQRSvg(assetTagOrId: string): Promise<string> {
  return QRCode.toString(assetDeepLink(assetTagOrId), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0b1220", light: "#ffffff" },
  });
}
