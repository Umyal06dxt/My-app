/* eslint-disable @next/next/no-img-element -- banners live on the host's own CDN */
import Link from "next/link";
import type { TunytEvent } from "@/lib/tunyt";
import { eventDateParts, eventTime, rupees } from "@/lib/format";
import { currentPrice } from "@/lib/tickets";

const TINTS = ["bg-pink-soft", "bg-lilac-soft", "bg-butter-soft", "bg-mint-soft"];
const TILTS = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.7deg]"];

export function EventCard({ event, index }: { event: TunytEvent; index: number }) {
  const { day, month } = eventDateParts(event.time, event.timezoneOffsetMinutes);
  const img = event.banner?.horizontal || event.thumbnail || event.banner?.square;
  const prices = (event.ticketTypes ?? []).map((t) => currentPrice(t).price);
  const from = prices.length ? Math.min(...prices) : null;

  return (
    <Link
      href={`/events/${encodeURIComponent(event.eventId)}`}
      style={{ animationDelay: `${index * 80}ms` }}
      className={`sticker pop-in group flex flex-col overflow-hidden rounded-[2rem] ${TINTS[index % 4]} ${TILTS[index % 4]}`}
    >
      <div className="relative m-3 mb-0 aspect-[16/10] overflow-hidden rounded-[1.5rem] border-2 border-cocoa bg-paper">
        {img ? (
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-6xl">🎪</div>
        )}
        <div className="absolute right-3 top-3 flex -rotate-6 flex-col items-center rounded-2xl border-2 border-cocoa bg-butter px-3 py-1.5 leading-none shadow-[2px_3px_0_0_var(--cocoa)]">
          <span className="font-display text-2xl font-bold">{day}</span>
          <span className="text-[11px] font-extrabold tracking-widest">{month}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="font-display text-xl font-semibold leading-tight">{event.title}</h3>
        <p className="text-sm font-semibold text-cocoa-soft">
          🕗 {eventTime(event.time, event.timezoneOffsetMinutes)} · 📍 {event.location}
        </p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="rounded-full bg-paper px-3 py-1 text-sm font-extrabold">
            {from == null ? "🎟️ tickets" : from === 0 ? "free! 🎉" : `from ${rupees(from)}`}
          </span>
          <span className="font-display font-semibold text-cocoa transition group-hover:translate-x-1">
            let&apos;s go →
          </span>
        </div>
      </div>
    </Link>
  );
}
