/**
 * Entry point.
 *
 * The provider order is the dependency order: repositories first (auth reads
 * them), then auth, then toasts, then the router that gates on auth.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RepositoryProvider } from '@/app/RepositoryContext';
import { AuthProvider } from '@/app/AuthContext';
import { ToastProvider } from '@/app/ToastContext';
import { AppRouter } from '@/app/AppRouter';
import '@/styles/global.css';
import '@/styles/layout.css';
import '@/styles/components.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <RepositoryProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </RepositoryProvider>
  </StrictMode>,
);
