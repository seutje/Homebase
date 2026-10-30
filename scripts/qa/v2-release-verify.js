async (page) => {
  const title='[Homebase QA v0.2.0]';const invoke=(cmd,args)=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
  const data=await invoke('list_tasks');const task=data.tasks.find(t=>t.title===title);
  if(!task||task.notes!=='Packaged v2 verification'||task.links[0]!=='https://example.com/manual'||task.graceDays!==3||task.comingUpDays!==5||task.activeMonths.length!==4||task.isSnoozed)throw new Error('Packaged restart lost v2 fields');
  const history=await invoke('list_completions',{taskId:task.id});if(history.length!==1||history[0].completedOn!=='2026-10-21')throw new Error('Completion Undo/history did not persist');
  await page.getByRole('searchbox',{name:'Search',exact:true}).fill(title);await page.locator('.task-row').getByRole('button').first().click();
  await page.getByText('Packaged v2 verification',{exact:true}).waitFor();await page.getByRole('button',{name:'Delete task',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.locator('.detail-panel').waitFor({state:'hidden'});const cleaned=await invoke('list_tasks');if(cleaned.tasks.some(t=>t.id===task.id))throw new Error('Owned fixture cleanup failed');
  return 'Installed v0.2.0 retained all v2 fields after restart/reinstall; its owned fixture was removed through the UI.';
}
