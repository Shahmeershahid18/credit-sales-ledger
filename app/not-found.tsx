import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { buttonClass } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-zinc-50">
      <LogoMark className="w-10 h-10" />
      <h1 className="mt-5 text-xl font-semibold text-zinc-900">Page not found</h1>
      <p className="mt-1 text-sm text-zinc-500">The customer or page you are looking for does not exist.</p>
      <Link href="/dashboard" className={buttonClass('primary', 'mt-6')}>
        Back to dashboard
      </Link>
    </div>
  );
}
