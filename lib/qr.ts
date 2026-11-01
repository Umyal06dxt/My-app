import "server-only";
import QRCode from "qrcode";

/**
 * Tunyt's ticket `qrCode` may be an image (data: URL or image link) or the text to encode.
 * Returns something an <img src> can show.
 */
export async function qrImageSrc(qr: string): Promise<string> {
  if (qr.startsWith("data:image/")) return qr;
  if (/^https:\/\/\S+\.(png|jpe?g|svg|webp|gif)(\?\S*)?$/i.test(qr)) return qr;
  const svg = await QRCode.toString(qr, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#3b2a3f", light: "#ffffff" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
