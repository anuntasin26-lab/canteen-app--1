import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "โรงอาหาร",
  description: "ระบบสั่งอาหาร",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={sarabun.className}>
      <body style={{
        margin: 0,
        padding: 0,
        background: "#F5F3EE",
        WebkitTextSizeAdjust: "100%",
        color: "#1C1A17",
      }}>
        {children}
      </body>
    </html>
  );
}