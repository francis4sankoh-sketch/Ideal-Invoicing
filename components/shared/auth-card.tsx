import { APP_NAME } from '@/lib/app-config';

// Shared frame for the sign-in, sign-up and business setup pages.
const [APP_WORD, ...APP_REST] = APP_NAME.split(' ');

export const authInputClass =
  'w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export const authButtonClass =
  'w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2';

export function AuthCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-light)] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1
              className="text-3xl font-bold text-[var(--color-primary)]"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              {APP_WORD}
            </h1>
            {APP_REST.length > 0 && (
              <p
                className="text-xs tracking-[0.3em] uppercase text-[var(--color-text-muted)] mt-1"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                {APP_REST.join(' ')}
              </p>
            )}
          </div>
          {children}
        </div>
        {footer && <div className="text-center text-sm text-[var(--color-text-muted)] mt-6">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{label}</label>
      {children}
    </div>
  );
}
