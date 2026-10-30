async (page) => {
  const title='[Homebase QA 2026-10-30] Sunday chore';
  const invoke=(cmd,args)=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
  const data=await invoke('list_tasks');const fixture=data.tasks.find(t=>t.title===title);
  if(!fixture||fixture.lastCompletedOn!=='2026-10-27'||fixture.nextDue!=='2026-11-01') throw new Error('Restart/reinstall lost task state');
  const history=await invoke('list_completions',{taskId:fixture.id});
  if(history.length!==2) throw new Error('Restart/reinstall lost history');
  await page.locator('.task-row').filter({has:page.getByText(title,{exact:true})}).getByRole('button').first().click();
  await page.locator('.detail-panel').getByText('27 October 2026',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Delete task',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.locator('.detail-panel').waitFor({state:'hidden'});
  const cleaned=await invoke('list_tasks');if(cleaned.tasks.some(t=>t.id===fixture.id)) throw new Error('QA task cleanup failed');
  return 'Installed release retained task/history after reinstall and restart. Its owned QA task was removed through the UI.';
}
