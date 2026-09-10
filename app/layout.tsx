import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overlay Studio · 直播动态贴片工作台",
  description: "编辑直播优惠条、大促标题和图片贴片，添加扫光、星芒与循环动效，导出透明 GIF、APNG 和 OBS 动态 HTML。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
