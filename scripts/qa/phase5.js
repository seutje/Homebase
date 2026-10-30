async (page) => {
  await page.reload();
  // This session uses the isolated .qa/native-data database.
  await page.evaluate(async () => {const result=await window.__TAURI_INTERNALS__.invoke('list_tasks'); for(const task of result.tasks) if(task.sourceTemplateKey) await window.__TAURI_INTERNALS__.invoke('delete_task',{id:task.id});});
  await page.reload();
  await page.getByRole('button', {name:'Browse suggested chores',exact:true}).click();
  await page.getByRole('combobox', {name:'Browse category',exact:true}).selectOption('Laundry');
  const towels=page.locator('.library-row').filter({has:page.getByText('Wash towels',{exact:true})});
  await towels.getByRole('checkbox').click();
  await page.getByLabel('Interval for Wash towels').fill('2');
  await page.getByRole('combobox', {name:'Browse category',exact:true}).selectOption('Kitchen');
  const dishwasher=page.locator('.library-row').filter({has:page.getByText('Clean dishwasher',{exact:true})});
  await dishwasher.getByRole('checkbox').click();
  await page.getByRole('combobox',{name:'Unit for Clean dishwasher',exact:true}).selectOption('days');
  await page.getByLabel('Interval for Clean dishwasher').fill('45');
  await page.screenshot({path:'.qa/phase5-library.png'});
  await page.getByRole('button',{name:'Add selected chores',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Wash towels Every 2 weeks · Laundry'}).waitFor();
  await page.getByRole('button',{name:'Clean dishwasher Every 45 days · Kitchen'}).waitFor();
  if(await page.getByText('Never completed',{exact:true}).count() !== 2) throw new Error('Templates invented completion history');
  await page.getByRole('button', {name:'Browse suggested chores',exact:true}).click();
  const copy=page.locator('.library-row').filter({has:page.getByText('Wash towels',{exact:true})});
  await copy.getByRole('checkbox').click();
  await page.getByText(/was already added. Add another independent copy/).waitFor();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.getByRole('button',{name:'Add selected chores',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  if(await page.locator('.task-row').count() !== 4) throw new Error('Wrong task count after explicit duplicate');
  return 'Phase 5 passed: category browsing, multi-select, customized intervals, empty history, duplicate confirmation';
}
