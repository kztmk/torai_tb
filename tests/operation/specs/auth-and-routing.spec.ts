import { describeChecklistCase, expect, gotoAppPath, test } from '../helpers/operationTest';

test.describe('operation checklist: auth and routing', () => {
  test(describeChecklistCase('1-1'), async ({ page }) => {
    await gotoAppPath(page, '/auth/signin');

    await expect(page.getByRole('heading', { name: /虎威へサインイン/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Googleアカウントでサインイン/ })).toBeVisible();
  });

  test(describeChecklistCase('2-1'), async ({ page }) => {
    await gotoAppPath(page, '/dashboard');

    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.getByRole('button', { name: /Googleアカウントでサインイン/ })).toBeVisible();
  });
});
