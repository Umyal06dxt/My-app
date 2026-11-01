import type { Metadata } from "next";
import Link from "next/link";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const body = Nunito({ variable: "--font-body", subsets: ["latin"] });
const display = Fredoka({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });

const SITE_NAME = process.env.SITE_NAME || "Little Live";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Lovely little live events. Grab your tickets!",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
          <div className="sticker mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full bg-paper px-5 hover:!transform-none hover:!shadow-[var(--shadow-sticker)]">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="wiggle inline-block text-2xl" aria-hidden>🎀</span>
              {SITE_NAME}
            </Link>
            <Link
              href="/#events"
              className="rounded-full bg-pink-soft px-4 py-2 text-sm font-bold text-cocoa transition hover:bg-pink hover:text-white"
            >
              Events ✨
            </Link>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-10 px-4 pb-10 text-center text-sm font-semibold text-cocoa-soft">
          <p>made with 💖 by {SITE_NAME}</p>
          <p className="mt-1 text-xs">tickets &amp; payments safely handled by Tunyt</p>
        </footer>
      </body>
    </html>
  );
}
