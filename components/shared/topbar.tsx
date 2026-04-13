'use client';

import { usePathname } from 'next/navigation';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/shared/theme-provider';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/quotes': 'Quotes',
  '/invoices': 'Invoices',
  '/calendar': 'Calendar',
  '/products': 'Products',
  '/expenses': 'Expenses',
  '/purchase-orders': 'Purchase Orders',
  '/settings': 'Settings',
};

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const getTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (path === '/' && pathname === '/') return title;
      if (path !== '/' && pathname.startsWith(path)) return title;
    }
    return 'Ideal Invoicing';
  };

  return (
    <header className="h-16 bg-white dark:bg-[#1a1a1a] border-b border-[var(--color-accent)] flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2
          className="text-xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {getTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-light)] transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
