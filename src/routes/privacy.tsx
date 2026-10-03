import { createFileRoute } from '@tanstack/react-router';
import Legal from '@/components/pages/Legal';

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy Policy | GNG' }] }),
  component: () => <Legal document="privacy" />,
});
