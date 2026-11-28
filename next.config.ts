import type { NextConfig } from "next";
import os from "node:os";

/**
 * Next.js (15+/16) blocks dev-only resources (JS chunks, HMR websocket) when
 * the page is opened from any host other than localhost. On a LAN this makes
 * the app hang forever on the "در حال بارگذاری..." screen. We allow:
 *  - private LAN ranges (192.168.x.x, 10.x.x.x, 172.x.x.x)
 *  - this machine's own hostname and IPs
 *  - anything listed in ALLOWED_DEV_ORIGINS (comma separated, e.g. "loan.local,pc-12")
 * This only affects `next dev`; production (`next start`) has no such check.
 */
function lanDevOrigins(): string[] {
  const origins = new Set<string>(["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"]);
  try {
    origins.add(os.hostname().toLowerCase());
    for (const list of Object.values(os.networkInterfaces())) {
      for (const net of list ?? []) {
        if (net.family === "IPv4" && !net.internal) origins.add(net.address);
      }
    }
  } catch {
    // Interface lookup is best-effort only.
  }
  for (const extra of (process.env.ALLOWED_DEV_ORIGINS || "").split(",")) {
    const value = extra.trim().toLowerCase();
    if (value) origins.add(value);
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
};

export default nextConfig;
