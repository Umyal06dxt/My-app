import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="float mb-4 text-7xl">🦄</div>
      <h1 className="font-display text-3xl font-bold">oops, this page wandered off</h1>
      <Link href="/" className="sticker mt-8 inline-block rounded-full bg-pink px-7 py-3 font-display font-semibold text-white">
        take me home ✨
      </Link>
    </div>
  );
}
