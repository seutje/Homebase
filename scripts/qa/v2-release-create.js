async (page) => {
  await page.route(/^https?:\/\//,route=>['tauri.localhost','ipc.localhost','127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  const invoke=(cmd,args)=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
  const title='[Homebase QA v0.2.0]';const baseline=await invoke('list_tasks');
  if(baseline.tasks.some(t=>t.title===title))throw new Error('An earlier owned QA task exists; inspect before repeating');
  await page.getByRole('searchbox',{name:'Search',exact:true}).waitFor();
  await page.getByRole('button',{name:'⚙ Settings'}).click();await page.getByText('Homebase · 0.2.0',{exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog'}).click();
  const id=await invoke('save_task',{input:{id:null,title,categoryId:1,schedule:{kind:'relative',value:7,unit:'days'},trackingStartOn:'2026-10-01',initialCompletedOn:'2026-10-21',comingUpDays:5,graceDays:3,activeMonths:[11,12,1,2],notes:'Packaged v2 verification',links:['https://example.com/manual']}});
  await invoke('snooze_task',{id,until:'2026-11-03'});
  const completion=await invoke('record_completion',{taskId:id,completedOn:'2026-10-30'});await invoke('undo_completion',{id:completion.id});
  const data=await invoke('list_tasks');const task=data.tasks.find(t=>t.id===id);
  if(!task.isSnoozed||!task.isOutOfSeason||task.elapsedDays!==9||task.notes!=='Packaged v2 verification')throw new Error('Packaged v2 state is incorrect');
  await page.reload();await page.getByRole('searchbox',{name:'Search',exact:true}).fill(title);
  const row=page.locator('.task-row').filter({has:page.getByText(title,{exact:true})});await row.getByText('Out of season',{exact:true}).waitFor();await row.locator('.completion-value strong').waitFor();
  await row.getByRole('button',{name:'Snooze',exact:true}).click();await page.getByRole('button',{name:'Unsnooze',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  return {result:'v0.2.0 installed release passed; owned fixture retained for restart verification',taskId:id,baselineTasks:baseline.tasks.length};
}
