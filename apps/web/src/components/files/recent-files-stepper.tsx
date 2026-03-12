"use client";

import * as React from "react";
import { LogoStepper } from "@/components/ui/logo-stepper";
import { RecentFile } from "@/lib/mock-recent-files";
import { FileTypeIcon } from "@/components/files/file-icon-map";

type RecentFilesStepperProps = {
  files: RecentFile[];
  paused?: boolean;
};

export function RecentFilesStepper({
  files,
  paused = false,
}: RecentFilesStepperProps) {
  const logos = React.useMemo(
    () =>
      files.map((file) => ({
        icon: <FileTypeIcon extension={file.extension} className="h-5 w-5" />,
        label: file.label,
      })),
    [files]
  );

  if (!files.length) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        No recent files to display.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Recent Files</h3>
        <p className="text-sm text-muted-foreground">
          Recently uploaded or used files in the platform.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-3">
        <LogoStepper
          logos={logos}
          direction="loop"
          animationDelay={paused ? 999999 : 1.2}
          animationDuration={0.6}
          visibleCount={5}
        />
      </div>
    </div>
  );
}