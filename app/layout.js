export const metadata = {
  title: "Rescue SSH MCP",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 32 }}>{children}</body>
    </html>
  );
}
