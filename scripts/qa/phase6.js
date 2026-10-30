async (page) => {
  await page.reload();
  const original=await page.evaluate(async()=>{
    const invoke=window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
    window.__qaInvoke=invoke;
    const directory=await invoke('get_data_directory');
    if(!directory.replaceAll('\\','/').includes('/.qa/')) throw new Error('Use isolated QA data only');
    window.__qaBackup=directory+'/ui-roundtrip.db';
    window.__qaPickerCancelled=false;
    window.__qaPickerHits=[];
    // Native file pickers are outside the WebView. Stub only their selected paths;
    // backup/restore, confirmation, persistence, and failure handling remain real.
    // Tauri's invoke method is immutable. Stub only the picker's HTTP transport.
    const nativeFetch=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      const command=decodeURIComponent(new URL(String(url),location.href).pathname).slice(1);
      if(command==='plugin:dialog|save'||command==='plugin:dialog|open') {
        window.__qaPickerHits.push(command);
        return Promise.resolve(new Response(JSON.stringify(window.__qaPickerCancelled?null:window.__qaBackup),{status:200,headers:{'Content-Type':'application/json','Tauri-Response':'ok'}}));
      }
      return nativeFetch(url,options);
    };
    return await invoke('list_tasks');
  });
  await page.getByRole('button',{name:'⚙ Settings'}).click();
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  await page.getByText('Backup saved.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.locator('.task-row').filter({has:page.getByText('Wash bedsheets',{exact:true})}).getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).waitFor();
  await page.getByRole('button',{name:'⚙ Settings'}).click();
  await page.getByRole('button',{name:'Restore backup…',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  const beforeCancel=await page.evaluate(()=>window.__qaInvoke('list_tasks'));
  if(beforeCancel.tasks.find(t=>t.title==='Wash bedsheets').elapsedDays!==0) throw new Error('Cancel changed the database');
  await page.getByRole('button',{name:'Restore backup…',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.getByText(/Backup restored. Previous data saved to/).waitFor();
  if(await page.getByRole('button',{name:'Undo',exact:true}).count()) throw new Error('Restore retained stale Undo');
  const restored=await page.evaluate(()=>window.__qaInvoke('list_tasks'));
  if(JSON.stringify(restored)!==JSON.stringify(original)) throw new Error('Restore differs from exported state');
  await page.evaluate(()=>{window.__qaPickerCancelled=true;});
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Export backup').disabled);
  if(await page.evaluate(()=>window.__qaPickerHits.length)!==4) throw new Error('Not all native picker calls were intercepted');
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.reload();
  await page.setViewportSize({width:900,height:600});
  const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  if(metrics.width>metrics.viewport) throw new Error('Horizontal overflow at minimum width');
  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride',{width:900,height:600,deviceScaleFactor:1.5,mobile:false});
  await page.screenshot({path:'.qa/v1-minimum-150percent.png'});
  await session.send('Emulation.clearDeviceMetricsOverride');
  await page.setViewportSize({width:1180,height:800});
  await page.screenshot({path:'.qa/v1-overview.png'});
  return 'Phase 6 passed: native backup round-trip, cancelled confirmation/picker, stale Undo cleared, minimum size and 150% rendering';
}
