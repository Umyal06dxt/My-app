"use client";

import { useActionState } from "react";
import { login, refund, resend, type ActionState } from "./actions";

function Message({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${state.ok ? "bg-mint-soft" : "bg-pink-soft"}`}>
      {state.ok ? "✅ " : "🙈 "}
      {state.message}
    </p>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm font-bold" htmlFor="password">password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className="rounded-2xl border-2 border-cocoa bg-paper px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-pink/40"
      />
      <button disabled={pending} className="sticker rounded-full bg-pink px-6 py-3 font-display text-lg font-semibold text-white">
        {pending ? "checking…" : "let me in 🔐"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function RefundForm({
  bookingId,
  ticketIds,
  label,
  available = true,
}: {
  bookingId: string;
  ticketIds?: string[];
  label: string;
  available?: boolean;
}) {
  const [state, action, pending] = useActionState(refund, null);
  // Stay mounted after a refund so the confirmation stays visible once the page refreshes.
  if (!available) return state ? <Message state={state} /> : null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-full border-2 border-cocoa bg-paper px-3 py-1 text-xs font-extrabold hover:bg-pink-soft">
        {label}
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-dashed border-cocoa/40 bg-paper p-3">
        <input type="hidden" name="bookingId" value={bookingId} />
        {ticketIds?.map((id) => <input key={id} type="hidden" name="ticketId" value={id} />)}
        <select name="reason" className="rounded-xl border-2 border-cocoa bg-paper px-3 py-2 text-sm font-semibold">
          <option>Attendee request</option>
          <option>Duplicate</option>
          <option>Event issue</option>
          <option>Other</option>
        </select>
        <input
          name="details"
          maxLength={1000}
          placeholder="note (optional)"
          className="rounded-xl border-2 border-cocoa bg-paper px-3 py-2 text-sm font-semibold"
        />
        <button
          disabled={pending || state?.ok}
          className="sticker rounded-full bg-pink px-4 py-2 text-sm font-extrabold text-white"
        >
          {pending ? "refunding…" : state?.ok ? "done ✓" : "yes, refund 💸"}
        </button>
        <Message state={state} />
      </form>
    </details>
  );
}

export function ResendButton({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(resend, null);
  return (
    <form action={action}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <button
        disabled={pending}
        className="rounded-full border-2 border-cocoa bg-paper px-3 py-1 text-xs font-extrabold hover:bg-lilac-soft disabled:opacity-50"
      >
        {pending ? "sending…" : "resend 💌"}
      </button>
      <Message state={state} />
    </form>
  );
}
