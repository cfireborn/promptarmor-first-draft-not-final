import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  approveReview, checkCreative, createReview, current, loadReviews, makeSeed,
  requestChanges, saveReviews, storageKey, submitRevision, updateFinding,
} from './model';
import type { Creative } from './model';

afterEach(() => vi.unstubAllGlobals());

function resolveFirstReview() {
  let review = makeSeed()[0];
  for (const finding of current(review).findings) review = updateFinding(review, finding.id, 'verified', 'Checked the revised creative and offer terms.');
  return review;
}

function mockStorage(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[storageKey, initial]]);
  const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('review decisions', () => {
  it('starts the revised demonstration with two findings still requiring human verification', () => {
    const review = makeSeed()[0];
    expect(review.id).toBe('CP-1042');
    expect(review.versions).toHaveLength(2);
    expect(current(review).findings).toHaveLength(2);
    expect(current(review).findings.every((finding) => finding.status === 'open')).toBe(true);
    expect(checkCreative(current(review).creative)).toEqual([]);
    expect(() => approveReview(review, true)).toThrow(/every open finding/);
  });

  it('requires both explicit disposition of findings and a full-review attestation', () => {
    const resolved = resolveFirstReview();
    expect(() => approveReview(resolved, false)).toThrow(/Confirm/);
    const approved = approveReview(resolved, true);
    expect(approved.status).toBe('approved');
    expect(approved.approval).toMatchObject({ version: 2, by: 'You' });
    expect(approved.approval?.scope).toContain('BrightNest');
    expect(approved.approval?.scope).toContain('Instagram feed');
    expect(resolved.status).toBe('ready');
    expect(resolved.approval).toBeUndefined();
  });

  it('requires full-review attestation even when no text checks trigger', () => {
    const review = makeSeed()[1];
    expect(current(review).findings).toEqual([]);
    expect(() => approveReview(review, false)).toThrow(/Confirm/);
    expect(approveReview(review, true).status).toBe('approved');
  });

  it('does not mutate a submitted version or its existing event history', () => {
    const review = makeSeed()[0];
    const before = structuredClone(review);
    const findingId = current(review).findings[0].id;
    const updated = updateFinding(review, findingId, 'verified', 'Reviewed the qualification.');
    expect(review).toEqual(before);
    expect(updated.versions[0]).toEqual(before.versions[0]);
    expect(current(updated).findings[0].status).toBe('verified');
    expect(updated.events).toHaveLength(review.events.length + 1);
    expect(() => updateFinding(review, 'unknown-finding', 'verified')).toThrow(/current version/);
  });

  it('keeps approved reviews immutable through the public mutation functions', () => {
    const approved = approveReview(resolveFirstReview(), true);
    expect(() => updateFinding(approved, current(approved).findings[0].id, 'open')).toThrow(/ready/);
    expect(() => requestChanges(approved, 'Try something else.')).toThrow(/ready/);
    expect(() => submitRevision(approved, current(approved).creative, 'Changed it.')).toThrow(/requested/);
    expect(() => approveReview(approved, true)).toThrow(/ready/);
  });
});

describe('marketer revision loop', () => {
  it('requires an actionable open finding and a handoff note', () => {
    expect(() => requestChanges(resolveFirstReview(), 'Update the copy.')).toThrow(/at least one/);
    expect(() => requestChanges(makeSeed()[0], ' ')).toThrow(/note/);
    const waiting = requestChanges(makeSeed()[0], 'Please verify the offer range.');
    expect(waiting.status).toBe('changes_requested');
    expect(() => approveReview(waiting, true)).toThrow(/ready/);
    expect(() => requestChanges(waiting, 'Again.')).toThrow(/ready/);
  });

  it('preserves old versions and reopens every carried finding for explicit verification', () => {
    let review = makeSeed()[0];
    review = updateFinding(review, current(review).findings[0].id, 'dismissed', 'Reviewed in context.');
    const waiting = requestChanges(review, 'Update the rate terms.');
    const snapshot = structuredClone(waiting);
    const revised = submitRevision(waiting, { ...current(waiting).creative, body: 'Explore a personal loan. Check your options with ClearPath.' }, 'Removed the rate claim and simplified the offer.');
    expect(waiting).toEqual(snapshot);
    expect(revised.versions).toHaveLength(3);
    expect(revised.versions.slice(0, 2)).toEqual(snapshot.versions);
    expect(revised.status).toBe('ready');
    expect(revised.approval).toBeUndefined();
    expect(current(revised).findings.every((finding) => finding.status === 'open' && finding.note === undefined)).toBe(true);
    expect(() => approveReview(revised, true)).toThrow(/every open finding/);
  });

  it('rejects empty submissions and changes limited to whitespace or letter case', () => {
    const waiting = makeSeed()[4];
    const creative = current(waiting).creative;
    expect(() => submitRevision(waiting, creative, 'Done.')).toThrow(/Change the creative/);
    expect(() => submitRevision(waiting, { ...creative, body: `  ${creative.body.toUpperCase()}  ` }, 'Done.')).toThrow(/Change the creative/);
    expect(() => submitRevision(waiting, { ...creative, headline: '' }, 'Done.')).toThrow(/Complete/);
    expect(() => submitRevision(waiting, { ...creative, headline: 'A different headline' }, ' ')).toThrow(/Explain/);
    expect(() => submitRevision(makeSeed()[0], creative, 'Done.')).toThrow(/requested/);
  });

  it('adds newly introduced flags without duplicating inherited findings', () => {
    const waiting = makeSeed()[4];
    const revised = submitRevision(waiting, {
      ...current(waiting).creative, headline: 'Guaranteed approval', body: 'Get guaranteed approval. Rates from 8.99%.', disclosure: 'Subject to eligibility. Terms apply.',
    }, 'Updated the headline and rate.');
    expect(current(revised).findings.map((finding) => finding.id).sort()).toEqual(['claim-body', 'claim-headline', 'rate-body']);
  });
});

describe('illustrative checks and intake', () => {
  it('flags a guarantee, an unidentified borrowing rate, and missing disclosure', () => {
    const creative: Creative = { headline: 'Guaranteed approval', body: 'Rates from 7.99%', cta: 'Apply', disclosure: '' };
    expect(checkCreative(creative).map((finding) => finding.policyId)).toEqual(['CP-01', 'CP-02', 'CP-03']);
    expect(checkCreative(creative)).toEqual(checkCreative(creative));
  });

  it('does not label cash-back percentages as borrowing rates', () => {
    const creative: Creative = { headline: 'Earn 2% cash back', body: 'Earn rewards on eligible purchases.', cta: 'Learn more', disclosure: 'See card terms.' };
    expect(checkCreative(creative)).toEqual([]);
  });

  it('creates a validated submission with context and derived findings', () => {
    const input = { title: 'Test campaign', product: 'Personal loans' as const, channel: 'Email', placement: 'Email body', audience: 'US adults 18+', partner: 'ClearPath direct', owner: 'Jordan Lee', creative: current(makeSeed()[1]).creative };
    const review = createReview(input);
    expect(review.initials).toBe('JL');
    expect(review.status).toBe('ready');
    expect(current(review).number).toBe(1);
    expect(review.events).toHaveLength(1);
    expect(() => createReview({ ...input, audience: ' ' })).toThrow(/audience/);
    expect(() => createReview({ ...input, creative: { ...input.creative, disclosure: '' } })).toThrow(/Complete/);
    expect(createReview(input).id).not.toBe(review.id);
  });
});

describe('local persistence', () => {
  it('round-trips the complete seven-review demonstration', () => {
    const storage = mockStorage();
    const seed = makeSeed();
    expect(saveReviews(seed)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(loadReviews()).toEqual(seed);
  });

  it('falls back safely for malformed JSON and malformed or duplicate review data', () => {
    for (const malformed of ['not JSON', '{}', '[]', '[{"id":"CP-1042"}]', JSON.stringify([makeSeed()[0], makeSeed()[0]])]) {
      mockStorage(malformed);
      expect(loadReviews()).toHaveLength(7);
      expect(loadReviews()[0].id).toBe('CP-1042');
    }
  });

  it('rejects approvals for an old version or with unresolved findings', () => {
    const seed = makeSeed();
    const approved = approveReview(resolveFirstReview(), true);
    seed[0] = { ...approved, approval: { ...approved.approval!, version: 1 } };
    mockStorage(JSON.stringify(seed));
    expect(loadReviews()[0].status).toBe('ready');
    expect(saveReviews(seed)).toBe(false);
    seed[0] = { ...approved, versions: makeSeed()[0].versions };
    expect(saveReviews(seed)).toBe(false);
    seed[0] = { ...approved, partner: 'A different affiliate' };
    expect(saveReviews(seed)).toBe(false);
  });

  it('never throws if storage is unavailable or full', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadReviews()).toHaveLength(7);
    expect(saveReviews(makeSeed())).toBe(false);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Unavailable'); }, setItem: () => { throw new Error('Quota'); } });
    expect(loadReviews()).toHaveLength(7);
    expect(saveReviews(makeSeed())).toBe(false);
  });
});
