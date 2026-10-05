import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { RouterProvider } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { CHUNK_RELOAD_GUARD_KEY } from './components/ErrorPage';
import { AuthProvider } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import './index.css';

// A successful boot (including one right after RouteErrorBoundary's own auto-reload) means
// the chunk manifest is current again — reset the guard so a later, unrelated deploy can still
// self-heal once more instead of staying tripped for the rest of this tab's session.
sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
