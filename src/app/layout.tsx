import type { Metadata } from "next";
import "./globals.css";
import "./visual-styles.css";
export const metadata: Metadata = {
  title: "IdeaPrompt — Big ideas. Clear instructions.",
  description:
    "A private, local workspace to refine ideas, plan implementations and write actionable AI coding prompts.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/fonts/style-fonts.css" /></head>
      <body>{children}</body>
    </html>
  );
}
