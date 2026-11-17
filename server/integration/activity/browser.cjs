const assert = require('node:assert/strict');

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useNavigate,useLocation} from 'react-router';
import {ThemeProvider} from '/src/plugins/von-core/features/themes/ThemeContext.tsx';
import AdminLayout from '/src/components/layouts/AdminLayout.tsx';
import ProtectedRoute from '/src/components/ProtectedRoute.tsx';
import ActivityLog from '/src/plugins/von-core/features/activity/ActivityLog.tsx';
import '/src/index.css';
const params=new URLSearchParams(location.search);
const user={id:params.get('id')||'1',username:'Owner QA',role:params.get('role')||'Admin',email:'qa@example.invalid'};
const primary=user.id==='1'||user.role.toLowerCase()==='root';
const settings={_settingsScope:'admin',siteName:'Activity QA',categories:[],activePlugins:[],pluginConfig:{},theme:{},timeZone:'Asia/Kuala_Lumpur',adminPalette:'charcoal-blue'};
window.__qaActivityRequests=[];window.__qaActivityPending=[];window.__qaActivityHold=false;
window.__qaActivityFailure=params.get('mode')==='error';window.__qaPurgeFail=false;
window.fetch=async(input,options={})=>{
  const url=new URL(input,location.href);
  if(url.origin!==location.origin)throw new Error('External request denied in Activity QA');
  if(!url.pathname.endsWith('/api/activity/index.php'))return new Response(JSON.stringify({success:true,csrf_token:'qa-csrf',token:'qa-csrf',logs:[],users:[],posts:[],details:[],stats:{}}));
  const body=options.body?JSON.parse(options.body):null;
  window.__qaActivityRequests.push({path:url.pathname,query:Object.fromEntries(url.searchParams),body});
  let data,status=200;
  if(body?.action==='preview')data={success:true,before:'2026-08-01 12:00:00',eligible:501,token:'qa-preview',batchSize:500};
  else if(body?.action==='purge'){
    if(window.__qaPurgeFail){status=503;data={success:false,error:'QA purge failed; retry same preview'};window.__qaPurgeFail=false;}
    else data={success:true,removed:500};
  }else if(window.__qaActivityFailure){status=503;data={success:false,error:'Run Database Repair - QA missing Activity storage'};}
  else {
    const second=url.searchParams.get('cursor')==='page2';
    const logs=Array.from({length:second?2:20},(_,i)=>({key:'content:'+String(i+(second?21:1)),source:'content',at:'2026-11-15 12:00:00',actorId:'7',actorUsername:'Writer snapshot',actorRole:'writer',action:'delete',targetType:'post',targetId:String(i+1),targetLabel:i===0&&!second?'<img src=x onerror=window.__qaXss=true>':(second?'Second page ':'Article ')+(i+1),outcome:i===2?'partial':'success',details:{old_status:'draft'}}));
    data={success:true,logs,nextCursor:second?null:'page2',unavailableSources:[],pageSize:20};
  }
  const response=new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(window.__qaActivityHold)await new Promise(resolve=>window.__qaActivityPending.push(resolve));
  return response;
};
function Shell(){
  const location=useLocation(),navigate=useNavigate();window.__qaActivityNavigate=navigate;
  return <ThemeProvider><AdminLayout settings={settings} user={user} onLogout={()=>{}} isDarkMode={false} toggleDarkMode={()=>{}}>
    {location.pathname==='/admin/activity'?<ProtectedRoute user={user} allowedRoles={['Admin']}>{primary?<ActivityLog key={user.id} timeZone={settings.timeZone}/>:<p>Denied Activity QA</p>}</ProtectedRoute>:<p>Other destination QA</p>}
  </AdminLayout></ThemeProvider>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter basename={window.VON_BASE.replace(/\\/$/,'')||'/'}><Shell/></BrowserRouter>);
`;

async function verify({ send, evaluate, wait, metrics, port, errors }) {
  let scenarios = 0;
  const navigate = async (base, query = '') => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/activity${query}` });
  };
  const clickText = async (text) =>
    evaluate(
      `Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`
    );
  for (const base of ['', '/zangetsu']) {
    await navigate(base);
    await wait(
      `document.querySelectorAll('section[aria-label="Recorded activity"] li').length===20`
    );
    assert.equal(
      await evaluate(
        `document.querySelector('nav a[href="${base}/admin/activity"]').getAttribute('aria-current')`
      ),
      'page'
    );
    for (const dark of [false, true])
      for (const width of [375, 768, 1440]) {
        await metrics(width, 1000);
        await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
        assert.equal(
          await evaluate('document.documentElement.scrollWidth>innerWidth'),
          false,
          `Activity overflow ${base}/${dark}/${width}`
        );
        scenarios++;
      }
    await evaluate(
      `document.querySelector('section[aria-label="Recorded activity"] button').click()`
    );
    await wait(`document.querySelector('[role="dialog"]')!==null`);
    assert.equal(
      await evaluate('Boolean(window.__qaXss)'),
      false,
      'Activity labels must remain text'
    );
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await wait(`document.querySelector('[role="dialog"]')===null`);
    await clickText('Next');
    await wait(`document.body.textContent.includes('Second page 1')`);
    assert.equal(
      await evaluate(
        `document.querySelectorAll('section[aria-label="Recorded activity"] li').length`
      ),
      2
    );
    await clickText('Previous');
    await wait(
      `document.querySelectorAll('section[aria-label="Recorded activity"] li').length===20`
    );
    await evaluate(`document.querySelector('form').requestSubmit()`);
    await wait(`document.querySelector('section').getAttribute('aria-busy')==='false'`);
    assert(
      await evaluate(
        `window.__qaActivityRequests.every(r=>r.path==='${base}/api/activity/index.php')`
      ),
      'Base path must be retained'
    );
    await clickText('Preview purge');
    await wait(`document.body.textContent.includes('Purge old activity records?')`);
    await clickText('Cancel');
    assert.equal(
      await evaluate(`window.__qaActivityRequests.filter(r=>r.body?.action==='purge').length`),
      0,
      'Cancel must not purge'
    );
    await clickText('Preview purge');
    await wait(`document.body.textContent.includes('Purge old activity records?')`);
    await evaluate('window.__qaPurgeFail=true');
    await clickText('Confirm purge');
    await wait(`document.body.textContent.includes('QA purge failed; retry same preview')`);
    await evaluate('window.__qaActivityHold=true');
    await evaluate(
      `(()=>{const b=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Confirm purge');b.click();b.click()})()`
    );
    await wait('window.__qaActivityPending.length===1');
    assert.equal(
      await evaluate(`window.__qaActivityRequests.filter(r=>r.body?.action==='purge').length`),
      2,
      'Double click must issue only one retry'
    );
    await evaluate(`window.__qaActivityHold=false;window.__qaActivityPending.shift()()`);
    await wait(`document.body.textContent.includes('500 activity records purged.')`);
    await wait(`document.querySelector('section').getAttribute('aria-busy')==='false'`);
    await evaluate(`window.__qaActivityHold=true`);
    await clickText('Refresh');
    await wait('window.__qaActivityPending.length===1');
    await evaluate(`window.__qaActivityNavigate('/admin/dashboard')`);
    await wait(`document.body.textContent.includes('Other destination QA')`);
    await evaluate('window.__qaActivityPending.shift()()');
    assert.equal(
      await evaluate(`document.body.textContent.includes('Activity details')`),
      false,
      'Stale response must not reopen private view'
    );
    scenarios += 7;
    for (const [role, id] of [
      ['Admin', '2'],
      ['Writer', '3'],
      ['Moderator', '4'],
      ['Member', '5'],
    ]) {
      await navigate(base, `?role=${role}&id=${id}`);
      await wait(
        `window.__qaActivityRequests!==undefined && document.body.textContent.includes('QA')`
      );
      assert.equal(
        await evaluate(`Boolean(document.querySelector('nav a[href="${base}/admin/activity"]'))`),
        false,
        'Non-owner menu leaked'
      );
      assert.equal(
        await evaluate('window.__qaActivityRequests.length'),
        0,
        'Non-owner requested Activity data'
      );
      scenarios++;
    }
    await navigate(base, '?role=root&id=9');
    await wait(
      `document.querySelectorAll('section[aria-label="Recorded activity"] li').length===20`
    );
    scenarios++;
    await navigate(base, '?mode=error');
    await wait(
      `document.body.textContent.includes('Run Database Repair - QA missing Activity storage')`
    );
    assert.equal(
      await evaluate(
        `document.querySelectorAll('section[aria-label="Recorded activity"] li').length`
      ),
      0
    );
    scenarios++;
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS Activity browser: ${scenarios} root/subfolder UI scenarios; actual AdminLayout/ProtectedRoute/Activity component, phone/tablet/desktop light/dark, roles, safe text, details/Escape, pagination, filters, purge cancel/failure/retry/double-click, stale navigation and Repair error. API transport mocked; no installed data.`
  );
}
module.exports = { fixture, verify };
