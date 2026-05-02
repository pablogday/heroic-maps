"use client";

import { useState, useTransition } from "react";
import { MapActions } from "./MapActions";
import {
  logPlaySession,
  updatePlaySession,
  deletePlaySession,
  type PlayedOutcome,
} from "@/app/actions/playSessions";
import { FACTIONS, FACTION_LABEL, type Faction } from "@/lib/factions";
import { confirmDialog } from "@/components/ConfirmDialog";

export interface JournalSession {
  id: number;
  playedAt: Date;
  faction: string | null;
  outcome: PlayedOutcome;
  durationDays: number | null;
  notes: string | null;
  isPublic: boolean;
}

const OUTCOME_LABEL: Record<PlayedOutcome, string> = {
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};
const OUTCOME_TINT: Record<PlayedOutcome, string> = {
  won: "text-emerald",
  lost: "text-blood",
  abandoned: "text-ink-soft",
};

interface FormState {
  faction: string;
  outcome: PlayedOutcome;
  durationDays: string;
  notes: string;
  isPublic: boolean;
}

const EMPTY_FORM: FormState = {
  faction: "",
  outcome: "won",
  durationDays: "",
  notes: "",
  isPublic: true,
};

export function PlayJournal({
  mapId,
  slug,
  signedIn,
  initial,
  mapFactions,
  initialLibrary,
}: {
  mapId: number;
  slug: string;
  signedIn: boolean;
  initial: JournalSession[];
  /** The factions the map allows — limits the dropdown when present. */
  mapFactions: string[] | null;
  initialLibrary: { favorited: boolean; bookmarked: boolean };
}) {
  const [sessions, setSessions] = useState(initial);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const factionOptions =
    mapFactions && mapFactions.length > 0
      ? (mapFactions as Faction[])
      : (FACTIONS as readonly Faction[]).slice();

  const startNew = () => {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setError(null);
  };
  const startEdit = (s: JournalSession) => {
    setEditingId(s.id);
    setForm({
      faction: s.faction ?? "",
      outcome: s.outcome,
      durationDays: s.durationDays?.toString() ?? "",
      notes: s.notes ?? "",
      isPublic: s.isPublic,
    });
    setError(null);
  };
  const cancel = () => {
    setEditingId(null);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const durationDays =
      form.durationDays.trim() === "" ? null : Number(form.durationDays);
    const payload = {
      mapId,
      slug,
      faction: form.faction || null,
      outcome: form.outcome,
      durationDays,
      notes: form.notes,
      isPublic: form.isPublic,
    };
    startTransition(async () => {
      if (editingId === "new") {
        const res = await logPlaySession(payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const optimistic: JournalSession = {
          id: res.data.id,
          playedAt: new Date(),
          faction: payload.faction,
          outcome: payload.outcome,
          durationDays: payload.durationDays,
          notes: payload.notes.trim() || null,
          isPublic: payload.isPublic,
        };
        setSessions((prev) => [optimistic, ...prev]);
      } else if (editingId !== null) {
        const res = await updatePlaySession(editingId, slug, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  faction: payload.faction,
                  outcome: payload.outcome,
                  durationDays: payload.durationDays,
                  notes: payload.notes.trim() || null,
                  isPublic: payload.isPublic,
                }
              : s
          )
        );
      }
      setEditingId(null);
    });
  };

  const remove = async (id: number) => {
    const ok = await confirmDialog({
      title: "Delete this playthrough?",
      body: "It'll disappear from your history and the map's stats.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deletePlaySession(id, slug);
      if (!res.ok) return;
      setSessions((prev) => prev.filter((s) => s.id !== id));
    });
  };

  return (
    <>
      <MapActions
        mapId={mapId}
        slug={slug}
        initial={initialLibrary}
        hasPlayed={sessions.length > 0}
        onLogClick={signedIn ? startNew : () => undefined}
      />

      {editingId !== null && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-3 rounded border border-brass/40 bg-parchment-dark/30 p-3 text-sm"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-ink-soft">
                Faction
              </span>
              <select
                value={form.faction}
                onChange={(e) =>
                  setForm((f) => ({ ...f, faction: e.target.value }))
                }
                className="w-full rounded border border-brass/50 bg-parchment px-2 py-1 text-sm text-ink"
              >
                <option value="">—</option>
                {factionOptions.map((f) => (
                  <option key={f} value={f}>
                    {FACTION_LABEL[f as Faction]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-ink-soft">
                Outcome
              </span>
              <select
                value={form.outcome}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    outcome: e.target.value as PlayedOutcome,
                  }))
                }
                className="w-full rounded border border-brass/50 bg-parchment px-2 py-1 text-sm text-ink"
              >
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </label>
            <label className="block col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wider text-ink-soft">
                In-game days <span className="text-ink-soft/60">(optional)</span>
              </span>
              <input
                type="number"
                min={0}
                max={9999}
                value={form.durationDays}
                onChange={(e) =>
                  setForm((f) => ({ ...f, durationDays: e.target.value }))
                }
                className="w-full rounded border border-brass/50 bg-parchment px-2 py-1 text-sm text-ink"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-ink-soft">
              Notes <span className="text-ink-soft/60">(optional)</span>
            </span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              maxLength={4000}
              placeholder="How did it go? Strategies that worked, twists, regrets…"
              className="w-full rounded border border-brass/50 bg-parchment px-2 py-1 text-sm text-ink"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) =>
                setForm((f) => ({ ...f, isPublic: e.target.checked }))
              }
              className="h-4 w-4 accent-blood"
            />
            Public — counts toward map stats and shows on your profile
          </label>
          {error && <p className="text-xs text-blood">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded border border-brass/40 px-3 py-1 text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-brass rounded px-3 py-1 text-xs font-display disabled:opacity-50"
            >
              {pending ? "Saving…" : editingId === "new" ? "Log it" : "Save"}
            </button>
          </div>
        </form>
      )}

      {sessions.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs uppercase tracking-wider text-ink-soft">
            Your history with this map
          </h4>
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded border border-brass/30 bg-parchment-dark/20 p-2"
              >
                <div className="flex items-baseline gap-2">
                  <span className={`font-medium ${OUTCOME_TINT[s.outcome]}`}>
                    {OUTCOME_LABEL[s.outcome]}
                  </span>
                  {s.faction && (
                    <span className="text-ink-soft">
                      as {FACTION_LABEL[s.faction as Faction] ?? s.faction}
                    </span>
                  )}
                  {s.durationDays !== null && (
                    <span className="text-ink-soft">
                      · {s.durationDays} day{s.durationDays === 1 ? "" : "s"}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-ink-soft">
                    {new Date(s.playedAt).toLocaleDateString()}
                  </span>
                </div>
                {s.notes && (
                  <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">
                    {s.notes}
                  </p>
                )}
                <div className="mt-1 flex gap-3 text-xs">
                  {!s.isPublic && (
                    <span className="text-ink-soft/60" title="Only you see this">
                      🔒 private
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="ml-auto text-ink-soft hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="text-blood hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
