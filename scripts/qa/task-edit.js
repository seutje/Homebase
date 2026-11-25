async (page) => {
  await page.goto('http://127.0.0.1:1437');
  const invoke = (command, args) =>
    page.evaluate(
      ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
      { command, args },
    );
  const directory = await invoke('get_data_directory');
  if (!directory.replaceAll('\\', '/').includes('/.qa/v2-data'))
    throw new Error('Use isolated QA data');
  const title = 'QA task edit button';
  const editedTitle = `${title} updated`;
  const read = () => invoke('list_tasks');
  if ((await read()).tasks.some((t) => t.title.startsWith(title)))
    throw new Error('Fixture already exists');
  await page.getByRole('button', { name: '+ Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task name', { exact: true }).fill(title);
  await dialog.getByRole('combobox', { name: 'Floor', exact: true }).selectOption('Garage');
  await dialog.getByText('Notes and links', { exact: true }).click();
  await dialog
    .getByLabel('Notes', { exact: true })
    .fill('Retain these instructions');
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const original = (await read()).tasks.find((t) => t.title === title);
  const count = (await read()).tasks.length;
  const row = page
    .locator('.task-row')
    .filter({ has: page.getByText(title, { exact: true }) });
  await row.locator('.task-title').click();
  const detail = page.getByLabel('Task details', { exact: true });
  for (const width of [1180, 900]) {
    await page.setViewportSize({ width, height: width === 900 ? 600 : 800 });
    const edit = detail.getByRole('button', { name: 'Edit task', exact: true });
    await edit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.qa/task-edit-detail-${width}.png` });
    await edit.click();
    if (
      (await dialog.getByLabel('Task name', { exact: true }).inputValue()) !==
      title
    )
      throw new Error('Title not prefilled');
    if (
      (await dialog.getByRole('combobox', { name: 'Floor', exact: true }).inputValue()) !==
      'Garage'
    )
      throw new Error('Floor not prefilled');
    await page.screenshot({ path: `.qa/task-edit-dialog-${width}.png` });
    if (width === 1180) {
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    } else {
      await dialog.getByLabel('Task name', { exact: true }).fill(editedTitle);
      await dialog
        .getByRole('combobox', { name: 'Floor', exact: true })
        .selectOption('Basement');
      await dialog.getByLabel('Interval', { exact: true }).fill('14');
      await dialog
        .getByRole('button', { name: 'Save task', exact: true })
        .click();
    }
    await dialog.waitFor({ state: 'hidden' });
  }
  await detail
    .getByRole('heading', { name: editedTitle, exact: true })
    .waitFor();
  await page.reload();
  const tasks = (await read()).tasks;
  const edited = tasks.find((t) => t.id === original.id);
  if (
    tasks.length !== count ||
    edited.title !== editedTitle ||
    edited.floor !== 'Basement' ||
    edited.schedule.value !== 14 ||
    edited.notes !== original.notes ||
    edited.lastCompletedOn !== original.lastCompletedOn
  )
    throw new Error('Edit did not persist correctly');
  await invoke('delete_task', { id: original.id });
  await page.reload();
  console.log(
    'PASS: visible edit button, prefilled dialog, cancel, same-task save, reload persistence, preserved notes/completion, and 1180/900 layouts',
  );
}
