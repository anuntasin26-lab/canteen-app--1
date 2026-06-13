import "./globals.css";

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
    <html lang="th">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        background: "#F5F3EE",
        fontFamily: "'Sarabun', sans-serif",
        WebkitTextSizeAdjust: "100%",
        color: "#1C1A17",
      }}>
        {children}
      </body>
    </html>
  );
}