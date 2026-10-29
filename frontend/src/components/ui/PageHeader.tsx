import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, subtitle, action }: PageHeaderProps) {
  const desc = description || subtitle;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white/95">{title}</h1>
        {desc && <p className="mt-1 text-sm text-white/40">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
