"use client";
import { ChevronLeft } from "lucide-react";
import { IconButton } from "./Button";

export function TopBar({ title, onBack, right, subtitle }: { title?: React.ReactNode; subtitle?: React.ReactNode; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="safe-top sticky top-0 z-20 flex items-center gap-3 bg-bg/80 px-4 pb-3 backdrop-blur-md">
      {onBack && (
        <IconButton label="Back" variant="secondary" sound="back" onClick={onBack}>
          <ChevronLeft size={22} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate font-display text-2xl font-bold tracking-tight">{title}</h1>}
        {subtitle && <p className="truncate text-sm text-dim">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
