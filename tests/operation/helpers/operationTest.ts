import { expect, test, type Page } from 'playwright/test';

import { getChecklistCase } from '../checklist';

export { expect, test };

export const describeChecklistCase = (id: string): string => {
  const checklistCase = getChecklistCase(id);
  return `${checklistCase.id} ${checklistCase.title}`;
};

export const expectAppShellReady = async (page: Page): Promise<void> => {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
};

export const gotoAppPath = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await expectAppShellReady(page);
};
