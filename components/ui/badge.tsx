import { getStatusColor, getStatusLabel } from '@/lib/utils/format';

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className = '' }: BadgeProps) {
  const { bg, text } = getStatusColor(status);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text} ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}
