/* eslint-disable @next/next/no-img-element -- banners live on the host's own CDN */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/tunyt";
import { eventDay, eventTime } from "@/lib/format";
import { TicketPicker } from "./ticket-picker";

export default function EventPage({ params, searchParams }: PageProps<"/events/[eventId]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">
      <Link href="/#events" className="mb-6 inline-block rounded-full px-2 py-1 font-bold text-cocoa-soft hover:text-pink">
        ← all events
      </Link>
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-[2rem] bg-pink-soft" />}>
        <EventDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EventDetail({
  params,
  searchParams,
}: Pick<PageProps<"/events/[eventId]">, "params" | "searchParams">) {
  const { eventId } = await params;
  const { cancelled } = await searchParams;
  const event = await getEvent(eventId);
  if (!event || event.status !== "APPROVED") notFound();

  const img = event.banner?.horizontal || event.thumbnail || event.banner?.square;
  const tz = event.timezoneOffsetMinutes;

  return (
    <article className="pop-in">
      <title>{event.title}</title>

      {cancelled && (
        <p className="sticker mb-6 rounded-2xl bg-butter-soft px-5 py-3 font-bold hover:!transform-none">
          No worries, nothing was charged 🌷 Your tickets are still waiting below whenever you&apos;re ready.
        </p>
      )}

      <div className="sticker relative mb-10 aspect-[16/9] overflow-hidden rounded-[2rem] bg-lilac-soft hover:!transform-none sm:aspect-[21/9]">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-8xl">🎪</div>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{event.title}</h1>

          <div className="mt-6 flex flex-wrap gap-3">
            <Chip tint="bg-pink-soft">📅 {eventDay(event.time, tz)}</Chip>
            <Chip tint="bg-lilac-soft">
              🕗 {eventTime(event.time, tz)}
              {event.endsAt && <> – {eventTime(event.endsAt, tz)}</>}
            </Chip>
            <Chip tint="bg-mint-soft">📍 {event.location}</Chip>
          </div>

          {event.description && (
            <div className="mt-8 rounded-[2rem] bg-paper/80 p-6 text-lg leading-relaxed">
              <h2 className="mb-3 font-display text-2xl font-semibold">about this event 💭</h2>
              <p className="whitespace-pre-line text-cocoa/90">{event.description}</p>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <TicketPicker event={event} />
        </aside>
      </div>
    </article>
  );
}

function Chip({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full border-2 border-cocoa px-4 py-2 text-sm font-bold ${tint}`}>{children}</span>
  );
}
