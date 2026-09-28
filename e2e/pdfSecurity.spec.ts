import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { PDFS, pickPdf, readDownload, readPdf } from './helpers/pdf';

test.beforeEach(() => {
  test.setTimeout(90_000);
});

const errorBanner = 'p.text-danger';

test.describe('/protect-pdf', () => {
  test('protects a PDF and the download really opens with the password, and only with it', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.multiPage10);
    await page.getByLabel('Password', { exact: true }).fill('MyStrongPw1');
    await page.getByRole('button', { name: 'Protect PDF' }).click();

    const bytes = await readDownload(page, /Download .*-protected\.pdf/);
    const pages = await readPdf(bytes, 'MyStrongPw1');
    expect(pages).toHaveLength(10);

    // Independent confirmation it's really encrypted, not just renamed: no password must fail.
    await expect(readPdf(bytes)).rejects.toThrow();
  });

  test('unchecking a permission is reflected in the summary line', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.singlePage);
    await page.getByLabel('Password', { exact: true }).fill('pw123456');
    await page.getByRole('checkbox', { name: 'Print' }).uncheck();
    await expect(page.locator('fieldset p').first()).toContainText('Printing is blocked');
  });

  // The summary line proves nothing about the FILE — this reads permission bits back out of the
  // produced bytes. Regression: "Edit" used to clear only /ModifyContents, not the rest.
  test('each checkbox clears every permission bit a reader files under that word', async ({ page }) => {
    const bits = (bytes: Buffer) => {
      const p = Number(/\/P\s+(-?\d+)/.exec(bytes.toString('latin1'))![1]);
      return {
        print: (p & 0b100) !== 0,
        modify: (p & 0b1000) !== 0,
        copy: (p & 0b1_0000) !== 0,
        annotate: (p & 0b10_0000) !== 0,
        fillForms: (p & 0b1_0000_0000) !== 0,
        accessibility: (p & 0b10_0000_0000) !== 0,
        assemble: (p & 0b100_0000_0000) !== 0,
      };
    };
    const protectWith = async (uncheck: string[]) => {
      await page.goto('/protect-pdf');
      await pickPdf(page, PDFS.singlePage);
      await page.getByLabel('Password', { exact: true }).fill('pw123456');
      for (const name of uncheck) await page.getByRole('checkbox', { name, exact: true }).uncheck();
      await page.getByRole('button', { name: 'Protect PDF' }).click();
      return bits(await readDownload(page, /Download .*-protected\.pdf/));
    };

    expect(await protectWith([])).toMatchObject({ print: true, modify: true, copy: true, annotate: true, fillForms: true, assemble: true, accessibility: true });

    expect(await protectWith(['Edit'])).toMatchObject({
      modify: false, annotate: false, fillForms: false, assemble: false, // everything "editing" means
      print: true, copy: true, // untouched by this checkbox
    });

    // Screen-reader text access is never revoked by any combination — it is an accessibility
    // affordance, not a copy-protection lever, and Acrobat keeps it separate for the same reason.
    expect(await protectWith(['Print', 'Copy text', 'Edit'])).toMatchObject({
      print: false, copy: false, modify: false, annotate: false, fillForms: false, assemble: false,
      accessibility: true,
    });
  });

  // regression: "Protect another" left the reveal toggle on, so the NEXT password — a different
  // secret entirely — was typed in plain text on screen with no deliberate act by the user.
  test('"Protect another" returns the password field to masked', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.singlePage);
    await page.getByLabel('Password', { exact: true }).fill('firstsecret');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Protect PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toBeVisible();
    await page.getByRole('button', { name: 'Protect another' }).click();

    await pickPdf(page, PDFS.singlePage);
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  });

  // regression: an unbroken 180-character file name rendered at its full intrinsic width, pushing
  // the document to 2081px wide inside a 375px viewport — the whole page scrolled sideways.
  test('a very long file name does not push the page sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/protect-pdf');
    await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
      name: `${'A'.repeat(180)}-very-long-filename.pdf`,
      mimeType: 'application/pdf',
      buffer: readFileSync(PDFS.singlePage),
    });
    await page.getByLabel('Password', { exact: true }).fill('longname1');
    await page.getByRole('button', { name: 'Protect PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('refuses to re-protect an already-protected PDF and links to Unlock', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.encryptedUserPassword);
    await expect(page.locator(errorBanner)).toContainText('already password-protected');
    await expect(page.getByRole('link', { name: 'unlock it first' })).toHaveAttribute('href', '/unlock-pdf');
  });

  test('the action is disabled until a password is entered', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.singlePage);
    await expect(page.getByRole('button', { name: 'Protect PDF' })).toBeDisabled();
    await page.getByLabel('Password', { exact: true }).fill('x');
    await expect(page.getByRole('button', { name: 'Protect PDF' })).toBeEnabled();
  });

  test('the success card echoes the password behind its own reveal toggle', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.singlePage);
    await page.getByLabel('Password', { exact: true }).fill('revealme1');
    await page.getByRole('button', { name: 'Protect PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toBeVisible();

    const echoed = page.locator('code');
    await expect(echoed).toHaveText('•'.repeat('revealme1'.length));
    await page.getByRole('button', { name: 'Show password' }).last().click();
    await expect(echoed).toHaveText('revealme1');
  });

  // regression: a stale download whose password no longer matches what's on screen is the worst
  // bug this tool can ship — any edit to the password must withdraw the previous result.
  test('withdraws the result as soon as the password changes', async ({ page }) => {
    await page.goto('/protect-pdf');
    await pickPdf(page, PDFS.singlePage);
    await page.getByLabel('Password', { exact: true }).fill('firstpass1');
    await page.getByRole('button', { name: 'Protect PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill('firstpass12');
    await expect(page.getByRole('link', { name: /^Download / })).toHaveCount(0);
  });
});

test.describe('/unlock-pdf', () => {
  test('detects protection on drop and unlocks with the right password — real content survives', async ({ page }) => {
    await page.goto('/unlock-pdf');
    await pickPdf(page, PDFS.encryptedUserPassword);
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();

    await page.getByLabel('Password', { exact: true }).fill('test1234');
    await page.getByRole('button', { name: 'Unlock PDF' }).click();

    const bytes = await readDownload(page, /Download .*-unlocked\.pdf/);
    const pages = await readPdf(bytes); // no password needed — really unlocked
    expect(pages[0]!.items.map((i) => i.str).join(' ')).toContain('Encrypted fixture');
  });

  // regression: a wrong password used to require re-uploading the file to try again.
  test('a wrong password keeps the file loaded, clears only the password, and explains itself', async ({ page }) => {
    await page.goto('/unlock-pdf');
    await pickPdf(page, PDFS.encryptedUserPassword);
    await page.getByLabel('Password', { exact: true }).fill('nope-wrong');
    await page.getByRole('button', { name: 'Unlock PDF' }).click();

    await expect(page.locator(errorBanner)).toContainText("didn't open this file");
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();

    await page.getByLabel('Password', { exact: true }).fill('test1234');
    await page.getByRole('button', { name: 'Unlock PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toBeVisible();
  });

  // regression: the Unlock button must not be disabled on an empty password — that's the correct
  // password for an owner-only-protected PDF, which has no open password at all.
  test('unlocks an owner-only-protected PDF with an empty password field', async ({ page }) => {
    await page.goto('/unlock-pdf');
    await pickPdf(page, PDFS.encryptedOwnerOnly);
    await expect(page.getByRole('button', { name: 'Unlock PDF' })).toBeEnabled();
    await page.getByRole('button', { name: 'Unlock PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toBeVisible();
  });

  test('a PDF that is not protected gets a neutral message, not an error', async ({ page }) => {
    await page.goto('/unlock-pdf');
    await pickPdf(page, PDFS.singlePage);
    await expect(page.getByText("isn't password-protected")).toBeVisible();
    await expect(page.locator(errorBanner)).toHaveCount(0);
  });

  // regression: this fixture parses with zero pages and reports isEncrypted false, so it used to
  // be waved through as "nothing to unlock" — a confident, wrong answer about a broken file.
  test('a corrupt PDF is called corrupt, not "not protected"', async ({ page }) => {
    await page.goto('/unlock-pdf');
    await pickPdf(page, PDFS.truncated);
    await expect(page.locator(errorBanner)).toContainText('could not be read as a PDF');
    await expect(page.getByText("isn't password-protected")).toHaveCount(0);
  });
});
