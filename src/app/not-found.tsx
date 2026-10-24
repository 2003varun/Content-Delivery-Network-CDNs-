import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Page Not Found</h2>
      <p className="mt-2 text-sm text-muted-foreground">The requested resource could not be found.</p>
      <Button asChild className="mt-4">
        <Link href="/">Return to Simulator</Link>
      </Button>
    </div>
  );
}
