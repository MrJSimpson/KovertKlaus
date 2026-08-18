import { notFound } from 'next/navigation';
import { IS_SAAS } from '@/lib/config/mode';

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  // In SaaS mode or production builds, test harness routes return 404 to avoid exposing internal benches
  if (IS_SAAS) {
    notFound();
  }

  return <>{children}</>;
}
