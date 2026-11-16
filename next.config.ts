import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor / cloud port-forward often hits the app via 127.0.0.1 or a proxy host.
  // Without this, Next 16 blocks /_next/* and the page looks "unable to open".
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.sh",
    "*.cursor.com",
    "*.ngrok-free.app",
  ],
};

export default nextConfig;
