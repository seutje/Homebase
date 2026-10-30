async (page) => {
  await page.reload();
  const directory=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_data_directory'));
  if(!directory.replaceAll('\\','/').includes('/.qa/'))throw new Error('Use isolated QA data');
  await page.evaluate(()=>{
    window.__qaUpdateMode='offline';window.__qaClosedUpdates=0;window.__qaInstallCalls=0;
    const nativeFetch=window.fetch.bind(window);
    const response=(data,ok=true)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Tauri-Response':ok?'ok':'error'}});
    window.fetch=(url,options)=>{
      const cmd=decodeURIComponent(new URL(String(url),location.href).pathname).slice(1);
      const payload=options?.body ? JSON.parse(options.body):{};
      if(cmd==='plugin:updater|check')return Promise.resolve(window.__qaUpdateMode==='offline'?response('offline',false):window.__qaUpdateMode==='none'?response(null):response({rid:990001,currentVersion:'0.2.0',version:'0.3.0',body:'A helpful Homebase update.',rawJson:{}}));
      if(cmd.includes('resources') && payload.rid===990001){window.__qaClosedUpdates++;return Promise.resolve(response(null));}
      if(cmd==='plugin:updater|download_and_install'){
        window.__qaInstallCalls++;const channel=Number(String(payload.onEvent).replace('__CHANNEL__:',''));
        window.__TAURI_INTERNALS__.runCallback(channel,{index:0,message:{event:'Started',data:{contentLength:100}}});
        window.__TAURI_INTERNALS__.runCallback(channel,{index:1,message:{event:'Progress',data:{chunkLength:40}}});
        return new Promise(resolve=>{window.__qaFailInstall=()=>{window.__TAURI_INTERNALS__.runCallback(channel,{index:2,end:true});resolve(response('Invalid signature',false));};});
      }
      return nativeFetch(url,options);
    };
  });
  await page.getByRole('button',{name:'⚙ Settings'}).click();
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await page.getByText('Could not check for updates. Check your connection and try again.',{exact:true}).waitFor();
  await page.evaluate(()=>{window.__qaUpdateMode='available';});
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await page.getByText(/Version 0.3.0 is available/).waitFor();
  if(await page.evaluate(()=>window.__qaInstallCalls)!==0)throw new Error('Update installed without a click');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Later',exact:true}).click();
  await page.waitForFunction(()=>window.__qaClosedUpdates===1);
  await page.getByRole('button',{name:'⚙ Settings'}).click();await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Install update',exact:true}).click();
  await page.getByRole('heading',{name:'Updating Homebase',exact:true}).waitFor();
  if(await page.getByRole('progressbar').getAttribute('value')!=='40')throw new Error('Download progress did not update');
  await page.screenshot({path:'.qa/update-progress.png'});
  await page.evaluate(()=>window.__qaFailInstall());
  await page.getByRole('progressbar').waitFor({state:'hidden'});
  await page.getByRole('dialog').getByRole('alert').filter({hasText:'could not be installed'}).waitFor();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'Later',exact:true}).click();
  await page.evaluate(()=>{window.__qaUpdateMode='none';});
  await page.getByRole('button',{name:'⚙ Settings'}).click();await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await page.getByText('You are up to date.',{exact:true}).waitFor();await page.screenshot({path:'.qa/update-settings.png'});
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('heading',{name:'All tasks',exact:true}).waitFor();
  return 'Updater UI passed: offline/manual feedback, later/resource cleanup, explicit install, progress, verification failure recovery and no-update state';
}
