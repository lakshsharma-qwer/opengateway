import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cx } from "../lib/format";

/** Renders a QR as inline SVG. Optional centered badge (e.g. ₹ or logo initial). */
export function QR({ value, size = 220, className, color = "#1c1029", center }: { value: string; size?: number; className?: string; color?: string; center?: React.ReactNode }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: center ? "H" : "M", margin: 0, color: { dark: color, light: "#ffffff00" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value, color, center]);
  return (
    <div className={cx("relative", className)} style={{ width: size, height: size }} role="img" aria-label="UPI QR code">
      {svg ? <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="skeleton size-full" />}
      {center && svg && <div className="absolute inset-0 grid place-items-center">{center}</div>}
    </div>
  );
}
