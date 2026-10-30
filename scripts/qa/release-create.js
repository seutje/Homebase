async (page) => {
  await page.route(/^https?:\/\//, route => {
    const host=new URL(route.request().url()).hostname;
    return ['tauri.localhost','ipc.localhost','127.0.0.1','localhost'].includes(host)?route.continue():route.abort();
  });
  const baseline=await page.evaluate(async()=>({data:await window.__TAURI_INTERNALS__.invoke('list_tasks'),directory:await window.__TAURI_INTERNALS__.invoke('get_data_directory')}));
  const title='[Homebase QA 2026-10-30] Sunday chore';
  if(baseline.data.tasks.some(t=>t.title===title)) throw new Error('An earlier QA fixture already exists; inspect it before repeating');
  await page.getByRole('button',{name:'+ Add task',exact:true}).click();
  await page.getByLabel('Task name').fill(title);
  await page.getByRole('combobox',{name:'Repeat',exact:true}).selectOption('weekly');
  await page.getByRole('combobox',{name:'Weekday',exact:true}).selectOption('7');
  await page.getByLabel('Last completed').fill('2026-10-20');
  await page.getByText('Tracking start date',{exact:true}).click();
  await page.getByLabel('First due / start tracking').fill('2026-10-01');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const row=page.locator('.task-row').filter({has:page.getByText(title,{exact:true})});
  await row.getByText('5 days overdue',{exact:true}).waitFor();
  await row.getByRole('button',{name:'Done',exact:true}).click();
  await row.getByText('Due in 2 days',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await row.getByText('5 days overdue',{exact:true}).waitFor();
  await row.getByRole('button',{name:'Complete on another date'}).click();
  await page.getByLabel('Completed on').fill('2026-10-27');
  await page.getByRole('button',{name:'Save completion',exact:true}).click();
  await row.getByText('Due in 2 days',{exact:true}).waitFor();
  const data=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('list_tasks'));
  const task=data.tasks.find(t=>t.title===title);
  if(task.lastCompletedOn!=='2026-10-27'||task.nextDue!=='2026-11-01') throw new Error('Packaged calendar schedule is incorrect');
  await page.screenshot({path:'.qa/installed-release.png'});
  return {result:'Installed release works with external network requests blocked; fixture retained for restart/reinstall check',taskId:task.id,baselineTasks:baseline.data.tasks.length,directory:baseline.directory};
}
