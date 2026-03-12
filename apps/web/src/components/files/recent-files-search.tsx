"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { RecentFile } from "@/lib/mock-recent-files";
import { FileTypeIcon } from "@/components/files/file-icon-map";

type RecentFilesSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: RecentFile[];
};

export function RecentFilesSearch({
  query,
  onQueryChange,
  results,
}: RecentFilesSearchProps) {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Find Recent File</h3>
        <p className="text-sm text-muted-foreground">
          Search uploaded or recently used files. Typing pauses the stepper.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="recent-file-search">Search files</FieldLabel>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            id="recent-file-search"
            type="text"
            placeholder="Search by file name or extension..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-10 pr-10"
          />

          {hasQuery && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <FieldDescription>
          Matching files appear below. Clear search to resume animation.
        </FieldDescription>
      </Field>

      <div className="mt-4 rounded-lg border bg-background p-3">
        {hasQuery ? (
          results.length > 0 ? (
            <div className="space-y-2">
              {results.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 transition hover:bg-muted/30"
                >
                  <div className="shrink-0 rounded-md border bg-background p-2">
                    <FileTypeIcon extension={file.extension} className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Last used: {new Date(file.lastOpenedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border px-3 py-3 text-sm text-muted-foreground">
              No recent file found for{" "}
              <span className="font-medium text-foreground">"{query}"</span>.
            </div>
          )
        ) : (
          <div className="rounded-lg border px-3 py-3 text-sm text-muted-foreground">
            Start typing to search recent files.
          </div>
        )}
      </div>
    </div>
  );
}