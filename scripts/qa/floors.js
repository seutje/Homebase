async (page) => {
  await page.reload();
  const directory = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('get_data_directory'),
  );
  if (!directory.replaceAll('\\', '/').includes('/.qa/v2-data'))
    throw new Error('Use isolated QA data');
  const title = 'QA floor feature';
  const read = () =>
    page.evaluate(() => window.__TAURI_INTERNALS__.invoke('list_tasks'));
  if ((await read()).tasks.some((t) => t.title === title))
    throw new Error('Fixture already exists');
  await page.getByRole('button', { name: '+ Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (
    (await dialog
      .getByRole('combobox', { name: 'Floor', exact: true })
      .inputValue()) !== '1st floor'
  )
    throw new Error('Wrong default');
  await dialog.getByLabel('Task name', { exact: true }).fill(title);
  await dialog
    .getByRole('combobox', { name: 'Floor', exact: true })
    .selectOption('Garage');
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const row = page
    .locator('.task-row')
    .filter({ has: page.getByText(title, { exact: true }) });
  await row.getByText('Never completed', { exact: true }).waitFor();
  const task = (await read()).tasks.find((t) => t.title === title);
  if (task.floor !== 'Garage') throw new Error('Floor not saved');
  await page.reload();
  await page
    .getByRole('combobox', { name: 'Floor', exact: true })
    .selectOption('Outside');
  await row.waitFor({ state: 'hidden' });
  await page
    .getByRole('combobox', { name: 'Floor', exact: true })
    .selectOption('Garage');
  await row.getByText('Never completed', { exact: true }).waitFor();
  await page
    .getByRole('searchbox', { name: 'Search', exact: true })
    .fill(title);
  await page.getByRole('button', { name: /^Uncategorized\s*\d+$/ }).click();
  await page.getByRole('button', { name: /^Not yet tracked ·/ }).click();
  await row.getByText('Never completed', { exact: true }).waitFor();
  for (const width of [1180, 900]) {
    await page.setViewportSize({ width, height: width === 900 ? 600 : 800 });
    await row.scrollIntoViewIfNeeded();
    const overflow = await row.evaluate((el) => {
      const age = el.querySelector('.completion-value').getBoundingClientRect();
      const done = el
        .querySelector('.completion-actions button')
        .getBoundingClientRect();
      return (
        document.documentElement.scrollWidth > innerWidth ||
        age.right > innerWidth ||
        done.right > innerWidth
      );
    });
    if (overflow) throw new Error('Layout overflow');
    await page.screenshot({ path: `.qa/floors-${width}.png` });
  }
  await row.locator('.task-title').click();
  await page.getByRole('button', { name: 'Edit task', exact: true }).click();
  if (
    (await dialog
      .getByRole('combobox', { name: 'Floor', exact: true })
      .inputValue()) !== 'Garage'
  )
    throw new Error('Edit lost floor');
  await dialog
    .getByRole('combobox', { name: 'Floor', exact: true })
    .selectOption('Basement');
  await page.screenshot({ path: '.qa/floors-editor-900.png' });
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page
    .getByRole('button', { name: 'Close details', exact: true })
    .click();
  await row.waitFor({ state: 'hidden' });
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  if (
    (await page
      .getByRole('combobox', { name: 'Floor', exact: true })
      .inputValue()) !== ''
  )
    throw new Error('Floor not cleared');
  await row.getByText(/Basement/).waitFor();
  await page.reload();
  if ((await read()).tasks.find((t) => t.id === task.id).floor !== 'Basement')
    throw new Error('Edit not persisted');
  await page.evaluate(
    (id) => window.__TAURI_INTERNALS__.invoke('delete_task', { id }),
    task.id,
  );
  await page.reload();
  console.log(
    'PASS: floor default, create/edit, persisted reload, combined filters, clear, and 1180/900 layouts',
  );
}
