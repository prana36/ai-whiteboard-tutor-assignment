import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumio — A little curiosity. A lot of clarity.",
  description:
    "Your personal AI whiteboard tutor. Understand any topic with visual lessons, synchronized narration, and a conversation that follows your curiosity.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
