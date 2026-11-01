import { Suspense } from "react";
import { connection } from "next/server";
import { getLiveEvents } from "@/lib/tunyt";
import { EventCard } from "./event-card";

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="blob -left-20 top-10 h-72 w-72 bg-pink" />
        <div className="blob right-0 top-0 h-80 w-80 bg-lilac" />
        <div className="blob bottom-0 left-1/2 h-60 w-60 bg-butter" />

        <span className="float absolute left-[8%] top-24 hidden text-4xl sm:block" aria-hidden>⭐</span>
        <span className="float-slow absolute right-[10%] top-32 hidden text-5xl sm:block" aria-hidden>🎈</span>
        <span className="float absolute bottom-10 right-[22%] hidden text-3xl sm:block" aria-hidden>💫</span>
        <span className="float-slow absolute bottom-16 left-[18%] hidden text-3xl sm:block" aria-hidden>🌸</span>

        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <p className="sticker mx-auto mb-6 inline-flex -rotate-2 items-center gap-2 rounded-full bg-mint px-4 py-1.5 text-sm font-extrabold">
            ✿ tickets on sale now ✿
          </p>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            little moments,
            <br />
            <span className="squiggle text-pink">big memories</span> 💖
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg font-semibold text-cocoa-soft">
            Find a show you love, grab your tickets in a minute, and they&apos;ll pop straight into your inbox. Easy peasy!
          </p>
          <a
            href="#events"
            className="sticker mt-9 inline-block rounded-full bg-pink px-8 py-4 font-display text-lg font-semibold text-white"
          >
            see what&apos;s on ✨
          </a>
        </div>
      </section>

      <section id="events" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 sm:px-6">
        <h2 className="mb-10 text-center font-display text-4xl font-bold">
          upcoming events <span className="inline-block wiggle">🎟️</span>
        </h2>
        <Suspense fallback={<GridSkeleton />}>
          <EventGrid />
        </Suspense>
      </section>
    </>
  );
}

async function EventGrid() {
  await connection(); // load at request time, not at build time (results are still cached for a minute)
  let events;
  try {
    events = await getLiveEvents();
  } catch (e) {
    console.error(e);
    return <Notice emoji="🙈">Oops, we couldn&apos;t load the events. Give it a refresh in a moment?</Notice>;
  }
  if (events.length === 0) return <Notice emoji="🌙">Nothing on sale just yet. New shows are coming soon!</Notice>;

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e, i) => (
        <EventCard key={e.eventId} event={e} index={i} />
      ))}
    </div>
  );
}

function Notice({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="sticker mx-auto max-w-md rounded-[2rem] bg-paper p-10 text-center hover:!transform-none">
      <div className="float mb-3 text-5xl">{emoji}</div>
      <p className="font-semibold text-cocoa-soft">{children}</p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {["bg-pink-soft", "bg-lilac-soft", "bg-butter-soft"].map((c) => (
        <div key={c} className={`h-80 animate-pulse rounded-[2rem] border-2 border-cocoa/20 ${c}`} />
      ))}
    </div>
  );
}
