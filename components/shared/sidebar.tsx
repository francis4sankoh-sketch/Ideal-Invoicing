'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Calendar,
  Package,
  CreditCard,
  ShoppingCart,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/expenses', label: 'Expenses', icon: CreditCard },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ userEmail, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-[#800020] text-white flex flex-col z-50 transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Ideal
            </h1>
            <p
              className="text-[10px] tracking-[0.25em] uppercase text-white/70"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Invoicing
            </p>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#4a0012] text-white'
                    : 'text-white/80 hover:bg-[#4a0012]/50 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          {userEmail && (
            <p className="text-xs text-white/60 truncate px-3 mb-2">{userEmail}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/80 hover:bg-[#4a0012]/50 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
