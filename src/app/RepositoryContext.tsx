/**
 * Repository injection.
 *
 * Every screen reads its data through `useRepos()`. Nothing imports a concrete
 * repository, which is what keeps the mock swappable — and also what makes the
 * screens testable by wrapping them in this provider with fakes.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createRepositories } from '@/data/repositories';
import type { Repositories } from '@/data/repositories/types';

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({
  children,
  value,
}: {
  children: ReactNode;
  /** Overridable so tests can inject fakes. */
  value?: Repositories;
}) {
  const repos = useMemo(() => value ?? createRepositories(), [value]);
  return <RepositoryContext.Provider value={repos}>{children}</RepositoryContext.Provider>;
}

export function useRepos(): Repositories {
  const repos = useContext(RepositoryContext);
  if (!repos) throw new Error('useRepos must be used inside RepositoryProvider');
  return repos;
}
