import React from "react";

interface SectionDividerProps {
  id?: string;
  icon: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

export function SectionDivider({ id, icon, title, subtitle, badge }: SectionDividerProps) {
  return (
    <div id={id} className="pt-8 pb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-lacquer-red shadow-sm">
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-headline-md text-headline-md font-bold text-ink-charcoal uppercase tracking-tight">
                {title}
              </h2>
              {badge && (
                <span className="text-[10px] font-label-caps font-bold px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant uppercase tracking-wider">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs font-mono text-on-surface-variant mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-outline-variant/80 via-outline-variant/40 to-transparent ml-2" />
      </div>
    </div>
  );
}
