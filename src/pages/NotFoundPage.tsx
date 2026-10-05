import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Compass className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-5xl font-bold tracking-tight">404</p>
      <p className="mt-2 text-base font-medium">Page not found</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        This page doesn't exist or you don't have access to it.
      </p>
      <Button className="mt-6" onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </Button>
    </div>
  );
}
