async (page) => {
  const directory=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_data_directory'));
  if(!directory.replaceAll('\\','/').includes('/.qa/')) throw new Error('Use an isolated QA data directory');
  await page.getByRole('button', {name:'⚙ Settings'}).click();
  await page.getByRole('combobox', {name:'Show last completion as',exact:true}).selectOption('relative');
  await page.getByRole('button', {name:'Close dialog'}).click();
  await page.locator('.task-row').first().getByRole('button',{name:'Done',exact:true}).click();
  await page.getByText('Today',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByText('9 days ago',{exact:true}).waitFor();
  await page.locator('.task-row').first().getByRole('button',{name:'Complete on another date'}).click();
  await page.getByLabel('Completed on').fill('2026-10-27');
  await page.getByRole('button',{name:'Save completion'}).click();
  await page.getByText('3 days ago',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Wash bedsheets Every 7 days · Laundry'}).click();
  await page.locator('.history li').first().getByRole('button',{name:'Edit date',exact:true}).click();
  await page.getByLabel('Completed on').fill('2026-10-26');
  await page.getByRole('button',{name:'Save completion'}).click();
  await page.locator('.detail-panel').getByText('4 days ago',{exact:true}).waitFor();
  await page.locator('.history li').first().getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.locator('.detail-panel').getByText('9 days ago',{exact:true}).waitFor();
  await page.screenshot({path:'.qa/phase4-history.png'});
  await page.getByRole('button',{name:'Close details'}).click();
  await page.reload(); await page.getByText('9 days ago',{exact:true}).waitFor();
  return 'Phase 4 passed: Done, exact undo, backdate, history correction/deletion and reload persistence';
}
