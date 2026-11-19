import type * as React from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 pb-8 sm:flex-row sm:items-end">
      <div className="max-w-2xl">
        {eyebrow ? <p className="label-mono">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl tracking-[-0.025em] sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
