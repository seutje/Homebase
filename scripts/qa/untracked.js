async (page) => {
  await page.reload();
  const directory = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('get_data_directory'),
  );
  if (!directory.replaceAll('\\', '/').includes('/.qa/v2-data'))
    throw new Error('Use isolated QA data');
  const title = 'QA untracked category feature';
  const all = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('list_tasks'),
  );
  if (all.tasks.some((t) => t.title === title))
    throw new Error('Fixture already exists');
  await page.getByRole('button', { name: /^Laundry\s*\d+$/ }).click();
  await page.getByRole('button', { name: '+ Add task', exact: true }).click();
  if ((await page.getByRole('combobox', { name: 'Category', exact: true }).inputValue()) !== '2')
    throw new Error('Category not preselected');
  await page.getByLabel('Task name', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const row = page
    .locator('.task-row')
    .filter({ has: page.getByText(title, { exact: true }) });
  await row.getByText('Not yet tracked', { exact: true }).waitFor();
  await row.getByText('Never completed', { exact: true }).waitFor();
  const id = await page.evaluate(
    async (title) =>
      (await window.__TAURI_INTERNALS__.invoke('list_tasks')).tasks.find(
        (t) => t.title === title,
      ).id,
    title,
  );
  await page.reload();
  await row.getByText('Not yet tracked', { exact: true }).waitFor();
  for (const width of [1180, 900]) {
    await page.setViewportSize({ width, height: width === 900 ? 600 : 800 });
    await row.scrollIntoViewIfNeeded();
    const bounds = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const age = el.querySelector('.completion-value').getBoundingClientRect();
      const done = el
        .querySelector('.completion-actions button')
        .getBoundingClientRect();
      return {
        right: r.right,
        age: age.right,
        done: done.right,
        viewport: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (
      bounds.overflow ||
      bounds.done > bounds.viewport ||
      bounds.age > bounds.viewport
    )
      throw new Error('Layout overflow: ' + JSON.stringify(bounds));
    await page.screenshot({ path: `.qa/untracked-${width}.png` });
  }
  await row.locator('.task-title').click();
  await page
    .getByText(/Record a completion to start tracking due dates\./)
    .waitFor();
  if (await page.getByText(/Next due:/).count())
    throw new Error('Untracked due date visible');
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: /^Not yet tracked ·/ }).click();
  await row.getByRole('button', { name: 'Done', exact: true }).click();
  await row.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await row.getByText('Not yet tracked', { exact: true }).waitFor();
  await page.evaluate(
    (id) => window.__TAURI_INTERNALS__.invoke('delete_task', { id }),
    id,
  );
  await page.reload();
  console.log(
    'PASS: native creation/category, untracked restart, completion/Undo, details, 1180/900 layouts',
  );
}
