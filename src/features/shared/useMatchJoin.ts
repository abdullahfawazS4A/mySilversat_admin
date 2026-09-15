/**
 * Filling in the fixture behind a prediction.
 *
 * A prediction row carries `matchId` always. What it carries beyond that
 * depends on the endpoint: sometimes a fully joined `match`, sometimes a bare
 * one with nothing but team ids on it, sometimes nothing at all. The middle
 * case is the one that bit — a bare fixture is truthy, so a screen that checks
 * only `row.match` renders "— ضد —" and looks like it has the data.
 *
 * Two screens show the fixture — the predictions table and a subscriber's
 * prediction history — so the test for "usable" and the repair live here once,
 * rather than in each of them.
 */

import { useMemo } from 'react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync } from '@/app/useAsync';
import { isNamedMatch } from '@/data/repositories/http/matches';
import type { Id, Match } from '@/types';

/** The part of a prediction this needs; anything carrying a fixture id fits. */
interface HasMatch {
  matchId: Id;
  match?: Match;
}

/**
 * Returns a fixture that can be named, or `undefined` while one is being
 * fetched — so callers show a placeholder rather than a row of dashes.
 */
export function useMatchJoin<T extends HasMatch>(
  rows: T[] | undefined,
): (row: T) => Match | undefined {
  const unresolved = useMemo(
    () => (rows ?? []).filter((row) => row.matchId && !isNamedMatch(row.match)),
    [rows],
  );

  /*
   * Sorted and joined into one string, because this drives a read: the ids of
   * a page are a fresh array on every render, and a second page of the same
   * fixtures must not count as a different question from the first.
   */
  const ids = useMemo(
    () => [...new Set(unresolved.map((row) => row.matchId))].sort(),
    [unresolved],
  );
  const key = ids.join(',');

  const repos = useRepos();
  const joined = useAsync(
    () =>
      key
        ? // The bare fixtures go along as seeds: when a prediction already
          // carried one, only its two clubs are missing, and re-reading the
          // fixture to learn that would be a wasted round trip.
          repos.matches.matches.byIds(
            ids,
            unresolved.map((row) => row.match),
          )
        : Promise.resolve(new Map<Id, Match>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return (row: T) => {
    if (isNamedMatch(row.match)) return row.match;
    // Still out: the caller shows a placeholder rather than a bare fixture's
    // worth of dashes.
    if (!joined.data) return undefined;
    // Whatever was recovered, falling back to the bare fixture so the score and
    // status columns still render even if the clubs could not be read.
    return joined.data.get(row.matchId) ?? row.match;
  };
}
