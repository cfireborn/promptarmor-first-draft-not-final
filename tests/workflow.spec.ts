import { expect, test, type Page } from '@playwright/test';
import type { Review } from '../src/model';

// Each test gets an isolated browser context; all writes happen through the UI.
// Storage is read only to verify exact versions, immutable history, and persistence.
async function storedReview(page: Page, id: string): Promise<Review> {
  return page.evaluate((reviewId) => {
    const records = JSON.parse(localStorage.getItem('clearpath-review-v1') ?? '[]');
    return records.find((review: { id: string }) => review.id === reviewId);
  }, id);
}

async function openReview(page: Page, id = 'CP-1042') {
  await page.goto(`/#review/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('seeded v2 requires every finding and explicit full-copy attestation before exact-version approval', async ({ page }) => {
  await openReview(page);
  const original = await storedReview(page, 'CP-1042');
  const approve = page.getByRole('button', { name: 'Approve version 2', exact: true });
  await expect(approve).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Verify fix', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Verify fix', exact: true }).first().click();
  await expect(approve).toBeDisabled();
  await page.getByRole('button', { name: 'Verify fix', exact: true }).click();
  await expect(approve).toBeEnabled();
  await page.getByRole('button', { name: 'Inspect the full current creative' }).click();
  await expect(page.getByRole('button', { name: /Inspect Body copy/ })).toContainText('subject to credit approval');
  await approve.click();
  const dialog = page.getByRole('dialog', { name: 'Approve version 2' });
  await expect(dialog).toContainText('Instagram feed');
  await expect(dialog).toContainText('BrightNest');
  await expect(dialog.getByRole('button', { name: 'Confirm approval' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /I reviewed the full copy/ }).check();
  await dialog.getByRole('button', { name: 'Confirm approval' }).click();
  await expect(page.getByText('Copy review complete.', { exact: true })).toBeVisible();
  const approved = await storedReview(page, 'CP-1042');
  expect(approved.status).toBe('approved');
  expect(approved.approval?.version).toBe(2);
  expect(approved.approval?.scope).toContain('BrightNest');
  expect(approved.versions[0]).toEqual(original.versions[0]);
  expect(approved.versions[1].creative).toEqual(original.versions[1].creative);
  await page.reload();
  await expect(page.getByText('Copy review complete.', { exact: true })).toBeVisible();
  expect(await storedReview(page, 'CP-1042')).toEqual(approved);
  await expect(page.getByRole('button', { name: 'Verify fix', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download approval record' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('CP-1042-v2-review-record.txt');
});

test('request changes hands off to marketer and a revision resets findings without changing old versions', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Verify fix', exact: true }).first().click();
  await page.getByRole('button', { name: 'Request changes', exact: true }).click();
  const request = page.getByRole('dialog', { name: 'Request changes to version 2' });
  await request.getByLabel('Note to the marketer').fill('Please clarify the accurate rate range in the body and keep the full eligibility disclosure.');
  await request.getByRole('button', { name: 'Request changes', exact: true }).click();
  await expect(page.getByText('Waiting for a revision', { exact: true })).toBeVisible();
  const waiting = await storedReview(page, 'CP-1042');
  expect(waiting.status).toBe('changes_requested');
  await page.getByRole('button', { name: 'Prepare revision', exact: true }).first().click();
  const revision = page.getByRole('dialog', { name: 'Prepare version 3' });
  await expect(revision).toContainText('Please clarify the accurate rate range');
  await revision.getByRole('textbox', { name: 'Body copy', exact: true }).fill('Explore a personal loan with APRs from 9.99% to 29.99%, subject to eligibility and credit approval.');
  await revision.getByLabel('What changed for your reviewer?').fill('Added the full APR range to the body and retained the eligibility disclosure.');
  await revision.getByRole('button', { name: 'Submit version 3' }).click();
  await expect(page.getByRole('button', { name: 'Approve version 3', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: '2 findings to resolve' })).toBeVisible();
  const revised = await storedReview(page, 'CP-1042');
  expect(revised.status).toBe('ready');
  expect(revised.approval).toBeUndefined();
  expect(revised.versions).toHaveLength(3);
  expect(revised.versions.slice(0, 2)).toEqual(waiting.versions);
  expect(revised.versions[2].findings.every((finding) => finding.status === 'open')).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '2 findings to resolve' })).toBeVisible();
  expect(await storedReview(page, 'CP-1042')).toEqual(revised);
});

test('new submission preserves an explicitly chosen launch target and complete example context', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New submission', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New submission' });
  await dialog.getByRole('button', { name: 'Use example' }).click();
  await dialog.getByLabel('Campaign name', { exact: true }).fill('Browser test launch campaign');
  await dialog.getByLabel(/^Requested launch/).fill('2027-01-15T14:30');
  await dialog.getByRole('button', { name: 'Continue to creative' }).click();
  await expect(dialog.getByLabel('Headline', { exact: true })).toHaveValue('Make room for your next chapter');
  await expect(dialog).toContainText('Jan 15');
  await dialog.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByRole('heading', { name: 'Browser test launch campaign', exact: true })).toBeVisible();
  const id = new URL(page.url()).hash.replace('#review/', '');
  const submitted = await storedReview(page, id);
  expect(submitted.due).toBe('2027-01-15T22:30:00.000Z');
  expect(submitted.placement).toBe('Instagram feed · mobile');
  expect(submitted.status).toBe('ready');
  expect(submitted.versions).toHaveLength(1);
  expect(submitted.versions[0].creative.disclosure).toContain('9.99%');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Browser test launch campaign', exact: true })).toBeVisible();
  expect(await storedReview(page, id)).toEqual(submitted);
});

test('a manual finding blocks approval and resolution requires a recorded rationale', async ({ page }) => {
  await openReview(page, 'CP-1047');
  await expect(page.getByRole('button', { name: 'Approve version 1', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add a reviewer finding' }).click();
  const add = page.getByRole('dialog', { name: 'Add a reviewer finding' });
  await add.getByLabel('Finding title').fill('Confirm offer availability');
  await add.getByLabel('Creative section').selectOption('disclosure');
  await add.getByLabel('Why it matters').fill('The offer may not be available in every targeted state.');
  await add.getByLabel('Requested change').fill('Verify the targeting against the approved offer geography.');
  await add.getByRole('button', { name: 'Add finding', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve version 1', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resolve with note' }).click();
  const resolve = page.getByRole('dialog', { name: 'Record your review rationale' });
  await resolve.getByRole('button', { name: 'Resolve with rationale' }).click();
  await expect(resolve).toBeVisible();
  expect((await storedReview(page, 'CP-1047')).versions[0].findings[0].status).toBe('open');
  const rationale = 'Checked the fictional offer geography against this audience; all targeted states are included.';
  await resolve.getByLabel('Review rationale').fill(rationale);
  await resolve.getByRole('button', { name: 'Resolve with rationale' }).click();
  await expect(page.getByText(rationale, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve version 1', exact: true })).toBeEnabled();
  const resolved = await storedReview(page, 'CP-1047');
  expect(resolved.versions[0].findings[0]).toMatchObject({ status: 'verified', note: rationale });
  expect(resolved.events.at(-1)?.message).toContain(rationale);
});

test('dismissal requires a reason and reopening preserves the approval gate', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Dismiss', exact: true }).first().click();
  const dismiss = page.getByRole('dialog', { name: 'Dismiss this finding' });
  await dismiss.getByRole('button', { name: 'Dismiss with reason' }).click();
  await expect(dismiss).toBeVisible();
  expect((await storedReview(page, 'CP-1042')).versions[1].findings[0].status).toBe('open');
  await dismiss.getByLabel('Reason for dismissal').fill('The current copy contains no unconditional promise; reviewed in context.');
  await dismiss.getByRole('button', { name: 'Dismiss with reason' }).click();
  await expect(page.getByText('Dismissed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 findings to resolve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve version 2', exact: true })).toBeDisabled();
});

test('search and product/status filters recover from an empty result', async ({ page }) => {
  await page.goto('/');
  const filters = page.getByRole('group', { name: 'Filter by status' });
  await filters.getByRole('button', { name: /^All/ }).click();
  await page.getByLabel('Filter by product').selectOption('Mortgage');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search submissions' }).fill('no-such-campaign-123');
  await expect(page.getByRole('heading', { name: 'No matching submissions' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all submissions' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(7);
  await expect(page.getByRole('textbox', { name: 'Search submissions' })).toHaveValue('');
  await expect(page.getByLabel('Filter by product')).toHaveValue('All products');
  await filters.getByRole('button', { name: /^Approved/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search submissions' }).fill('CP-1039');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Meet your everyday card');
});

test('dirty submission dismissal can be cancelled without losing the draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New submission', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'New submission' });
  await form.getByLabel('Campaign name', { exact: true }).fill('Keep this draft');
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Discard your unsaved changes');
    await dialog.dismiss();
  });
  await form.getByRole('button', { name: 'Close dialog' }).click();
  await expect(form.getByLabel('Campaign name', { exact: true })).toHaveValue('Keep this draft');
  page.once('dialog', (dialog) => dialog.accept());
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form).not.toBeVisible();
});

test('390px mobile queue, review, and submission stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const assertNoOverflow = async () => {
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  };
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await assertNoOverflow();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve version 2', exact: true })).toBeDisabled();
  await assertNoOverflow();
  await page.getByRole('button', { name: 'Creative', exact: true }).click();
  await assertNoOverflow();
  await page.goto('/#queue');
  await page.getByRole('button', { name: 'New submission', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New submission' })).toBeVisible();
  await assertNoOverflow();
  const dialogWidth = await page.getByRole('dialog', { name: 'New submission' }).evaluate((dialog) => ({ width: dialog.clientWidth, scroll: dialog.scrollWidth }));
  expect(dialogWidth.scroll).toBeLessThanOrEqual(dialogWidth.width + 1);
});
