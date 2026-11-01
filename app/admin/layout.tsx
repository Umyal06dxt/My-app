import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">{children}</div>;
}
