const assert = require('node:assert/strict');

// Actual components and CSS in Chrome; all request responses and records are synthetic.
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {Toaster} from 'react-hot-toast';
import ContactSubmissions from '/src/pages/admin/contact/ContactSubmissions.tsx';
import {CategorySettings} from '/src/plugins/von-core/features/settings/components/CategorySettings.tsx';
import AdminLayout from '/src/components/layouts/AdminLayout.tsx';
import {VpComments} from '/src/plugins/von-core/features/public/components/Comments.tsx';
import {PromoBarPlugin} from '/src/plugins/von-core/features/plugins/built-in/promo-bar/index.tsx';
import {VonProviders} from '/src/plugins/von-core/providers/VonProviders.tsx';
import '/src/index.css';
const settings={timeZone:'Asia/Kuala_Lumpur',activeThemeId:'theme-default',activePlugins:[],pluginConfig:{},theme:{},discussionEnabled:true};
const area=new URLSearchParams(location.search).get('area');
if(area==='nav')settings.activePlugins=['von-designer'];
const categories=['Berita'];
window.__maintenance={fail:false,requests:[],commentFail:true,pages:2};
const qa=window.__maintenance;
window.fetch=async(input,options={})=>{
  const url=new URL(input,location.href);
  if(url.origin!==location.origin)throw Error('No external requests in maintenance QA');
  if(url.pathname.endsWith('/manage_categories.php')){
    let result={success:true,categories:categories.map(name=>({name,postCount:0}))};
    if(options.method==='POST'){
      const input=JSON.parse(options.body),name=input.category.trim().replace(/\\s+/g,' ');
      const existing=categories.find(label=>label.toLowerCase()===name.toLowerCase());
      if(!existing)categories.push(name);
      result={...result,added:!existing,category:existing||name,message:existing?'Category "'+existing+'" already exists.':'Category added.',categories:categories.map(name=>({name,postCount:0}))};
    }
    return new Response(JSON.stringify(result));
  }
  if(url.pathname.includes('/api/')){
    qa.requests.push(url.search);
    const page=Number(url.searchParams.get('page')||1);
    return new Response(JSON.stringify(qa.fail?{success:false,error:'QA receipt unavailable'}:{success:true,submissions:[{id:page===1?1:21,form_name:'QA Contact Form',created_at:'2026-11-19 10:00:00',data:JSON.stringify({message:'<img src=x onerror=window.__qaXss=true> '+('x'.repeat(1000))})}],pagination:{pages:qa.pages,total:qa.pages===2?21:1}}),{status:qa.fail?503:200});
  }
  return new Response(JSON.stringify({csrf_token:'fixture-only'}));
};
function Shell(){
  const [closed,setClosed]=useState(false);
  const [promo,setPromo]=useState({text:'Campaign A',linkUrl:'',linkText:'Read',allowDismiss:true,dismissHours:24,startsAt:'',endsAt:''});
  window.__setPromo=patch=>setPromo(old=>({...old,...patch}));
  const submit=async()=>{if(qa.hold)await new Promise(resolve=>qa.release=resolve);if(qa.commentFail)throw Error('QA comment rejected');};
  return <BrowserRouter><VonProviders settings={settings}><main className="p-4">
    {area==='nav'?<AdminLayout user={{id:'1',username:'QA Owner',role:'Root'}} settings={settings} onLogout={()=>{}} isDarkMode={false} toggleDarkMode={()=>{}}><p>Navigation QA</p></AdminLayout>:area==='categories'?<CategorySettings/>:area==='inbox'?(closed?<p>Forms QA</p>:<ContactSubmissions onBack={()=>setClosed(true)}/>):area==='comments'?<VpComments comments={[]} user={{id:'9',username:'QA Member',role:'Member'}} onAddComment={submit} onReplyComment={submit} onLikeComment={()=>true} onLogin={()=>{}} settings={settings}/>:<div id="qa-promo">{PromoBarPlugin.render('header_top',promo)}</div>}
  </main><Toaster/></VonProviders></BrowserRouter>;
}
localStorage.removeItem('voncms_promo_bar_dismissed');
createRoot(document.getElementById('root')).render(<Shell/>);
`;

async function verify({ send, evaluate, evaluateFunction, wait, metrics, port, errors }) {
  let checks = 0;
  const check = (value, message) => {
    assert.ok(value, message);
    checks++;
  };
  const click = (label) =>
    evaluateFunction(
      `function(label){const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label&&!e.disabled);if(!button)throw Error('Missing control '+label);button.click();}`,
      label
    );
  const type = (value) =>
    evaluateFunction(
      `function(value){const input=document.querySelector('textarea');if(!input)throw Error('Comment textarea missing');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}`,
      value
    );
  const submit = () =>
    evaluate(
      `document.querySelector('textarea').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`
    );
  for (const base of ['', '/zangetsu']) {
    const open = (area) =>
      send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/qa?area=${area}` });
    await open('categories');
    await wait(`document.body.innerText.includes('Berita')`);
    const categoryType = (value) =>
      evaluateFunction(
        `function(value){const input=document.querySelector('[aria-label="New category name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}`,
        value
      );
    await categoryType('bErItA');
    await click('Add Category');
    await wait(`document.body.innerText.includes('already exists')`);
    check(
      await evaluate(`document.querySelector('[aria-label="New category name"]').value===''`),
      'Duplicate feedback did not complete its UI state'
    );
    await categoryType('Teknologi');
    await click('Add Category');
    await wait(`document.body.innerText.includes('Category added.')`);
    check(
      await evaluate(
        `[...document.querySelectorAll('button')].some(e=>e.textContent.includes('Teknologi'))`
      ),
      'Normal category add stopped working'
    );
    await open('nav');
    await wait(`document.body.innerText.includes('Navigation QA')`);
    check(
      await evaluate(`!document.querySelector('a[href$="/admin/designer"]')`),
      'Unavailable Designer route is still advertised'
    );
    await open('inbox');
    await wait(`document.body.innerText.includes('QA Contact Form')`);
    check(
      await evaluate(
        `document.body.innerText.includes('<img src=x onerror=window.__qaXss=true>')&&!document.querySelector('article img')&&!window.__qaXss`
      ),
      'Receipt values must remain text'
    );
    for (const dark of [false, true])
      for (const width of [375, 768, 1440]) {
        await metrics(width, 1000);
        await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
        check(
          await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
          'Inbox long message overflow'
        );
      }
    await click('Next');
    await wait(`document.body.innerText.includes('#21')`);
    check(
      await evaluate(
        `window.__maintenance.requests.some(q=>q.includes('page=2')&&q.includes('limit=20'))`
      ),
      'Next must request a bounded server page'
    );
    await evaluate(`window.__maintenance.fail=true`);
    await click('Refresh');
    await wait(
      `document.querySelector('[role=alert]')?.textContent.includes('QA receipt unavailable')`
    );
    await evaluate(`window.__maintenance.fail=false;window.__maintenance.pages=1`);
    await click('Retry');
    await wait(`document.body.innerText.includes('Page 1 of 1')`);
    check(
      await evaluate(`document.body.innerText.includes('#1')`),
      'Retention must clamp stale last page'
    );
    await click('Back to Forms');
    await wait(`document.body.innerText.includes('Forms QA')`);
    await open('comments');
    await wait(`Boolean(document.querySelector('textarea'))`);
    await type('Retain this draft');
    await submit();
    await wait(`document.body.innerText.includes('QA comment rejected')`);
    check(
      await evaluate(`document.querySelector('textarea').value==='Retain this draft'`),
      'Rejected comment erased its draft'
    );
    await evaluate(`window.__maintenance.commentFail=false;window.__maintenance.hold=true`);
    await submit();
    await wait(`typeof window.__maintenance.release==='function'`);
    await type('New text during save');
    await evaluate(`window.__maintenance.release()`);
    await wait(`document.querySelector('textarea').value==='New text during save'`);
    check(
      await evaluate(`document.querySelector('textarea').value==='New text during save'`),
      'Delayed success erased newly typed text'
    );
    await evaluate(`window.__maintenance.hold=false`);
    await submit();
    await wait(`document.querySelector('textarea').value===''`);
    await open('promo');
    await wait(`document.querySelector('#qa-promo')?.textContent.includes('Campaign A')`);
    await evaluate(`document.querySelector('[aria-label="Dismiss announcement"]').click()`);
    await wait(`!document.querySelector('#qa-promo')?.textContent`);
    await evaluate(`window.__setPromo({text:'Campaign B'})`);
    await wait(`document.querySelector('#qa-promo')?.textContent.includes('Campaign B')`);
    check(
      await evaluate(
        `JSON.parse(localStorage.getItem('voncms_promo_bar_dismissed')).campaign.includes('Campaign A')`
      ),
      'Dismissal storage must remain campaign-bound'
    );
    await evaluate(`window.__setPromo({startsAt:'2026-02-30T12:00'})`);
    await wait(`!document.querySelector('#qa-promo')?.textContent`);
    await evaluate(`window.__setPromo({startsAt:'2999-01-01T12:00'})`);
    await wait(`!document.querySelector('#qa-promo')?.textContent`);
    await evaluate(`window.__setPromo({startsAt:'2000-01-01T12:00'})`);
    await wait(`document.querySelector('#qa-promo')?.textContent.includes('Campaign B')`);
    checks += 4;
  }
  check(errors.length === 0, errors.join('\n'));
  console.log(
    'PASS Maintenance Chrome: ' +
      checks +
      ' checks; actual category feedback/navigation/inbox/comment/promo components, root/subfolder, responsive inbox light/dark phone/tablet/desktop, synthetic transport only. No installed data.'
  );
}
module.exports = { fixture, verify };
