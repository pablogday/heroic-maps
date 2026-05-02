"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/profile";

export function SettingsForm({
  initial,
}: {
  initial: { username: string; bio: string };
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateProfile(username, bio);
      if (!res.ok) setError(res.error);
      else {
        setSuccess(true);
        router.push(`/${username.toLowerCase()}`);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-display text-sm text-ink">Username</span>
          <span className="text-xs text-ink-soft/70">
            2–30 chars · a–z, 0–9, _ -
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-soft">@</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={2}
            maxLength={30}
            required
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink"
          />
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Your profile lives at <code>/{username || "your-username"}</code>.
        </p>
      </label>

      <label className="block">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-display text-sm text-ink">Bio</span>
          <span className="text-xs text-ink-soft/70">
            Optional · max 500 chars
          </span>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={4}
          className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm text-ink"
          placeholder="A line about yourself, your favorite faction, your most-feared opponent…"
        />
      </label>

      {error && (
        <div className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-emerald/40 bg-emerald/10 px-3 py-2 text-sm text-emerald">
          Saved. Redirecting to your profile…
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="btn-brass rounded px-5 py-2 text-sm font-display disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
