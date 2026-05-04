"use client";

import { useState, useTransition } from "react";
import { uploadMap } from "@/app/actions/uploads";
import { toast } from "@/lib/toast";
import { FACTIONS, FACTION_LABEL } from "@/lib/factions";
import {
  VERSIONS,
  VERSION_LABEL,
  SIZES,
  SIZE_LABEL,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
} from "@/lib/map-constants";
import { parseH3m, unwrapMapFile } from "@/lib/h3m";

const MAX_BYTES = 8 * 1024 * 1024;

type AutoFillSummary = {
  filledFields: string[];
  warnings: string[];
} | null;

export function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [autoFill, setAutoFill] = useState<AutoFillSummary>(null);
  const [pending, startTransition] = useTransition();

  // Controlled state for the fields the parser can fill.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("SoD");
  const [size, setSize] = useState("M");
  const [humanPlayers, setHumanPlayers] = useState("2");
  const [aiPlayers, setAiPlayers] = useState("2");
  const [difficulty, setDifficulty] = useState("");
  const [hasUnderground, setHasUnderground] = useState(false);
  const [selectedFactions, setSelectedFactions] = useState<Set<string>>(
    new Set()
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setAutoFill(null);
    if (!f) {
      setFileName(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("File is over 8 MB.");
      e.target.value = "";
      setFileName(null);
      return;
    }
    setError(null);
    setFileName(f.name);

    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const unwrapped = unwrapMapFile(buf);
      if (!unwrapped.ok) return;
      const parsed = parseH3m(unwrapped.bytes);
      if (parsed.confidence === "failed" || !parsed.header) return;

      const filled: string[] = [];

      if (parsed.header.name) {
        setName(parsed.header.name);
        filled.push("name");
      }
      // Description: only fill if user hasn't typed anything yet.
      if (parsed.header.description && description.trim() === "") {
        setDescription(parsed.header.description);
        filled.push("description");
      }
      if (parsed.mapVersion && parsed.mapVersion !== "Other") {
        setVersion(parsed.mapVersion);
        filled.push("version");
      }
      if (parsed.header.size) {
        setSize(parsed.header.size);
        filled.push("size");
      }
      if (parsed.header.difficulty) {
        setDifficulty(parsed.header.difficulty);
        filled.push("difficulty");
      }
      setHasUnderground(parsed.header.hasUnderground);
      filled.push("underground");
      if (parsed.humanPlayers !== null && parsed.aiPlayers !== null) {
        setHumanPlayers(String(parsed.humanPlayers));
        setAiPlayers(String(parsed.aiPlayers));
        filled.push("players");
      }
      if (parsed.factions && parsed.factions.length > 0) {
        setSelectedFactions(new Set(parsed.factions));
        filled.push("factions");
      }

      setAutoFill({ filledFields: filled, warnings: parsed.warnings });
    } catch {
      // Parsing is best-effort; silently skip auto-fill on any error.
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadMap(fd);
      if (res && !res.ok) {
        setError(res.error);
        toast.error(res.error);
      }
      // Success path redirects server-side, so no toast needed —
      // the user lands on the new map's detail page directly.
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      encType="multipart/form-data"
    >
      <Field label="Map file" hint=".h3m, .h3c, or .zip — up to 8 MB">
        <input
          type="file"
          name="file"
          accept=".h3m,.h3c,.zip"
          required
          onChange={handleFile}
          className="block w-full text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-ink/10 file:px-3 file:py-2 file:font-display file:text-sm file:text-ink hover:file:bg-ink/15"
        />
        {fileName && (
          <p className="mt-1 text-xs text-ink-soft">Selected: {fileName}</p>
        )}
        {autoFill && autoFill.filledFields.length > 0 && (
          <p className="mt-2 rounded border border-brass/40 bg-brass/10 px-2 py-1 text-xs text-ink">
            ✨ Read from your file:{" "}
            {autoFill.filledFields.join(", ")}. Edit anything that&apos;s
            wrong.
          </p>
        )}
      </Field>

      <Field label="Name" hint="3–200 characters">
        <input
          name="name"
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Description" hint="Optional. Lore, hints, credits…">
        <textarea
          name="description"
          maxLength={4000}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Version">
          <select
            name="version"
            required
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
          >
            {VERSIONS.map((v) => (
              <option key={v} value={v}>
                {VERSION_LABEL[v]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Size">
          <select
            name="size"
            required
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {SIZE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Human players" hint="1–8">
          <input
            name="humanPlayers"
            type="number"
            min={1}
            max={8}
            value={humanPlayers}
            onChange={(e) => setHumanPlayers(e.target.value)}
            required
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
          />
        </Field>

        <Field label="AI players" hint="0–7">
          <input
            name="aiPlayers"
            type="number"
            min={0}
            max={7}
            value={aiPlayers}
            onChange={(e) => setAiPlayers(e.target.value)}
            required
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Difficulty" hint="Optional">
          <select
            name="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full rounded border border-brass/50 bg-parchment px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Underground" hint="Two-level map?">
          <label className="flex h-[38px] items-center gap-2 text-sm text-ink-soft">
            <input
              name="hasUnderground"
              type="checkbox"
              checked={hasUnderground}
              onChange={(e) => setHasUnderground(e.target.checked)}
              className="h-4 w-4 accent-blood"
            />
            Has underground
          </label>
        </Field>
      </div>

      <Field label="Factions" hint="Towns playable on this map">
        <div className="grid grid-cols-3 gap-2">
          {FACTIONS.map((f) => (
            <label
              key={f}
              className="flex items-center gap-2 rounded border border-ink/15 bg-ink/5 px-2 py-1.5 text-sm text-ink-soft hover:bg-ink/10"
            >
              <input
                type="checkbox"
                name="factions"
                value={f}
                checked={selectedFactions.has(f)}
                onChange={(e) => {
                  setSelectedFactions((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(f);
                    else next.delete(f);
                    return next;
                  });
                }}
                className="h-4 w-4 accent-blood"
              />
              {FACTION_LABEL[f]}
            </label>
          ))}
        </div>
      </Field>

      {error && (
        <div className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-soft/80">
          By uploading you confirm you have rights to share this map.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="btn-brass rounded px-5 py-2 text-sm font-display disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload map"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-sm text-ink">{label}</span>
        {hint && <span className="text-xs text-ink-soft/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
