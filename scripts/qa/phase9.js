async (page) => {
  await page.reload();
  const directory=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_data_directory'));
  if(!directory.replaceAll('\\','/').includes('/.qa/v2-data')) throw new Error('Use isolated v2 QA data');
  const row=page.locator('.task-row').filter({has:page.getByText('V2 sheets',{exact:true})});
  await row.getByRole('button').first().click();
  await page.getByRole('button',{name:'Edit task',exact:true}).click();
  await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('2');
  await page.getByRole('dialog').getByText('Notes and links',{exact:true}).click();
  await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Use Affresh tablet.\nModel HM-42');
  await page.getByLabel('Links (one per line)').fill('file:///C:/not-allowed');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await page.getByRole('alert').filter({hasText:/HTTP/}).waitFor();
  if(await page.getByRole('textbox',{name:'Notes',exact:true}).inputValue()!=='Use Affresh tablet.\nModel HM-42') throw new Error('Failed save lost notes');
  await page.getByLabel('Links (one per line)').fill('https://example.com/manual\nhttps://example.org/parts');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.locator('.plain-notes').filter({hasText:'Model HM-42'}).waitFor();
  await page.evaluate(()=>{
    window.__qaOpenedLinks=[];const nativeFetch=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      const cmd=decodeURIComponent(new URL(String(url),location.href).pathname).slice(1);
      if(cmd==='open_task_link') {window.__qaOpenedLinks.push(JSON.parse(options.body));return Promise.resolve(new Response('null',{status:200,headers:{'Content-Type':'application/json','Tauri-Response':'ok'}}));}
      return nativeFetch(url,options);
    };
  });
  if(await page.evaluate(()=>window.__qaOpenedLinks.length)!==0) throw new Error('A link opened without a click');
  await page.getByRole('button',{name:'https://example.com/manual ↗',exact:true}).click();
  await page.waitForFunction(()=>window.__qaOpenedLinks.length===1);
  const opened=await page.evaluate(()=>window.__qaOpenedLinks[0]);if(opened.index!==0) throw new Error('Wrong link index');
  await page.getByRole('button',{name:'Close details'}).click();
  await page.getByRole('searchbox',{name:'Search',exact:true}).fill('HM-42');
  await page.getByText('Nothing here right now.',{exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'Include notes',exact:true}).check();
  await row.getByText('9 days ago',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Laundry 1',exact:true}).click();
  await page.getByRole('button',{name:'1 Needs attention',exact:true}).click();
  if(await page.locator('.task-row').count()!==1) throw new Error('Combined filters failed');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.getByRole('combobox',{name:'Sort by',exact:true}).selectOption('elapsed');
  await page.locator('.task-row').first().getByText('Winter taps',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Sort by',exact:true}).selectOption('alpha');
  await page.locator('.task-row').first().getByText('V2 sheets',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Sort by',exact:true}).selectOption('category');
  await page.getByRole('combobox',{name:'Sort by',exact:true}).selectOption('overdue');
  await page.locator('.task-row').first().getByText('Winter taps',{exact:true}).waitFor();
  await page.reload();
  await row.getByRole('button').first().click();
  await page.locator('.plain-notes').filter({hasText:'HM-42'}).waitFor();
  if(await page.locator('.task-link').count()!==2) throw new Error('Links did not persist');
  await page.screenshot({path:'.qa/phase9-detail.png'});
  await page.getByRole('button',{name:'Close details'}).click();
  await page.setViewportSize({width:900,height:600});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Minimum-width horizontal overflow');
  await page.screenshot({path:'.qa/v2-minimum.png'});await page.setViewportSize({width:1180,height:800});await page.screenshot({path:'.qa/v2-overview.png'});
  return 'Phase 9 passed: notes/multiple links, invalid URL feedback, click-only link opening, notes search, combined filters, sorting, persistence and narrow layout';
}
