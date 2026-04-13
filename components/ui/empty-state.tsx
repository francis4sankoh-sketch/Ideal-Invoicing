import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[var(--color-primary)]" />
      </div>
      <h3
        className="text-lg font-bold text-[var(--color-text)] mb-1"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
      >
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}
