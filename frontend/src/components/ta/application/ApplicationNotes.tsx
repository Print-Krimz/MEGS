import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { notify } from "../../../lib/feedback";
import { formatDateTime } from "../../../lib/utils";
import { ErrorState } from "../../common";
import { NoteMarkdown } from "../../common/NoteMarkdown";
import { Button } from "../../ui";

const NOTE_MAX = 2000;

/**
 * Internal notes on one application. Write and Preview share one box so the recruiter sees the
 * formatted note before saving. Notes are kept as written; they are never shown to the applicant.
 */
export const ApplicationNotes: React.FC<{ applicationId: number | string }> = ({ applicationId }) => {
  const id = String(applicationId);
  const queryClient = useQueryClient();
  const notesKey = ["ta", "application", id, "notes"];
  const notesQuery = useQuery({ queryKey: notesKey, queryFn: () => taApi.listApplicationNotes(id) });
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const fieldId = `note-${id}`;

  const addMutation = useMutation({
    mutationFn: (body: string) => taApi.addApplicationNote(id, body),
    onSuccess: () => {
      setDraft("");
      setMode("write");
      void queryClient.invalidateQueries({ queryKey: notesKey });
      notify.success("Note saved");
    },
    onError: (err: unknown) => notify.error("Unable to save the note", err),
  });

  const trimmed = draft.trim();
  const notes = notesQuery.data ?? [];

  return (
    <section aria-labelledby={`${fieldId}-heading`} className="space-y-3">
      <h3 id={`${fieldId}-heading`} className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
        Notes
      </h3>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) addMutation.mutate(trimmed);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={fieldId} className="text-sm font-medium text-slate-800">
            Add a note
          </label>
          <div role="group" aria-label="Note view" className="inline-flex overflow-hidden rounded border border-slate-300 text-xs">
            {(["write", "preview"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
                className={`min-h-11 px-2.5 font-medium focus-ring md:min-h-7 ${
                  mode === option ? "bg-navy text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option === "write" ? "Write" : "Preview"}
              </button>
            ))}
          </div>
        </div>
        {mode === "write" ? (
          <textarea
            id={fieldId}
            value={draft}
            maxLength={NOTE_MAX}
            rows={4}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && trimmed) {
                event.preventDefault();
                addMutation.mutate(trimmed);
              }
            }}
            aria-describedby={`${fieldId}-help`}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-ring"
          />
        ) : (
          <div id={fieldId} className="min-h-[6.5rem] rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
            {trimmed ? <NoteMarkdown source={trimmed} /> : <p className="text-sm text-slate-600">Nothing to preview.</p>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${fieldId}-help`} className="text-xs text-slate-600">
            **bold**, *italic*, "- " for a list. Ctrl+Enter saves. {draft.length}/{NOTE_MAX}
          </p>
          <Button type="submit" size="sm" disabled={!trimmed} loading={addMutation.isPending} className="min-h-11 md:min-h-8">
            Save note
          </Button>
        </div>
      </form>

      {notesQuery.isError ? (
        <ErrorState compact subject="notes" error={notesQuery.error as Error} onRetry={() => void notesQuery.refetch()} />
      ) : notesQuery.isPending ? (
        <p role="status" className="text-sm text-slate-600">Loading notes</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-600">No notes yet.</p>
      ) : (
        <ol className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-white">
          {notes.map((note) => (
            <li key={note.id} className="space-y-1 px-3 py-2.5">
              <p className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{note.authorName}</span> ·{" "}
                <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
              </p>
              <NoteMarkdown source={note.body} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
