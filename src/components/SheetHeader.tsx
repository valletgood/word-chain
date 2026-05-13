"use client";

export function SheetToolbar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-sheet-headerBorder bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="text-base font-medium text-[#5f6368]">{title}</div>
      </div>
      <div>{right}</div>
    </div>
  );
}
