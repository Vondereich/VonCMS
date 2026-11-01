// Isolated UI regression: real navigation/Extensions and editor-route ownership,
// with fixture-only records/transports. Never connects to an installed CMS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const useRealEditor = process.argv.includes('--real-editor');
const useExtensionLifecycle = process.argv.includes('--extensions-lifecycle');
const useAdsWorkspace = process.argv.includes('--ads-workspace');
const useCalendarInitialDate = process.argv.includes('--calendar-initial-date');
const useCalendar = process.argv.includes('--calendar') || useCalendarInitialDate;
const useDashboard = process.argv.includes('--dashboard');
const useSecurity = process.argv.includes('--security');
const useAuth = process.argv.includes('--auth');
const useUsers = process.argv.includes('--users');
const useWpBridge = process.argv.includes('--wp-bridge');
const useThemeHooks = process.argv.includes('--theme-hooks');
const legacyHeaderMutation = useThemeHooks && process.argv.includes('--legacy-header');
const chromePath =
  process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fs.existsSync(chromePath)) {
  console.error('NOT_RUN Admin navigation browser: set CHROME_BIN to a Chromium executable.');
  process.exit(2);
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { createServer } = await import('vite');
  let server, chrome, socket;
  let closeBrowser = async () => {};
  let calendarFixture = null;
  let calendarFault = '';
  let calendarDateProjection = null;
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const authModalWrapperClass = useAuth
    ? app
        .slice(app.indexOf('{/* Auth Modal */}'))
        .match(/<div className="[^"]+">\s*<div className="([^"]+)">/)?.[1]
    : '';
  if (useAuth) assert.ok(authModalWrapperClass, 'Actual public auth modal wrapper is required.');
  const start = app.indexOf('const PostEditorWrapper:');
  const end = app.indexOf('export default App;');
  assert.ok(start > 0 && end > start, 'Actual editor wrapper must be available.');
  const wrapper = `
    import React, {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
    import {useNavigate,useSearchParams,useLocation,Navigate} from 'react-router';
    import {createEmptyEditorItem} from '/src/hooks/useContent.ts';
    const API={getPages:'/fixture/pages',getPost:'/fixture/post'};
    const vonFetch=async()=>({json:async()=>({success:false})});
    ${
      useRealEditor
        ? "import PostEditor from '/src/components/PostEditor.tsx';"
        : `function PostEditor(props){
      const [title,setTitle]=useState(props.initialItem.title);
      return React.createElement('div',{},
        React.createElement('input',{id:'qa-editor-title',value:title,
          onInput:e=>{setTitle(e.target.value);props.onDirtyChange(true)}}),
        React.createElement('output',{id:'qa-editor-id'},props.initialItem.id),
        React.createElement('button',{onClick:props.onBack},'Editor Back'));
    }`
    }
    ${app.slice(start, end)}
    export default PostEditorWrapper;
  `;
  let fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {BrowserRouter,useLocation} from 'react-router';
    import {ThemeProvider} from '/src/plugins/von-core/features/themes/ThemeContext.tsx';
    ${useExtensionLifecycle ? "import {THEMES} from '/src/plugins/von-core/features/themes/themeRegistry.ts';" : ''}
    import AdminLayout from '/src/components/layouts/AdminLayout.tsx';
    import ExtensionsManager from '/src/plugins/von-core/features/extensions/ExtensionsManager.tsx';
    import Wrapper from '/__navigation-wrapper.tsx';
    ${useCalendar ? "import CalendarManager from '/src/plugins/von-core/features/calendar/CalendarManager.tsx'; import ProtectedRoute from '/src/components/ProtectedRoute.tsx';" : ''}
    ${useAdsWorkspace ? "import SettingsView from '/src/plugins/von-core/features/settings/SettingsManager.tsx';" : ''}
    ${useDashboard ? "import Dashboard from '/src/plugins/von-core/features/dashboard/Dashboard.tsx';" : ''}
    ${useSecurity ? "import SecurityDashboard from '/src/plugins/von-core/features/security/SecurityDashboard.tsx';" : ''}
    ${useAuth ? "import Login from '/src/plugins/von-core/features/auth/Login.tsx';" : ''}
    ${useUsers ? "import UserManager from '/src/plugins/von-core/features/users/UserManager.tsx';" : ''}
    ${useWpBridge ? "import {WPMigrator} from '/src/plugins/von-core/features/tools/WPMigrator.tsx';" : ''}
    ${useRealEditor ? "import {useContent} from '/src/hooks/useContent.ts';" : ''}
    import '/src/index.css';
    const params=new URLSearchParams(location.search);
    const avatar='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const settings={_settingsScope:'admin',categories:['Uncategorized'],siteName:'Navigation QA',activePlugins:[],pluginConfig:{},theme:{},adminPalette:params.get('palette')||'charcoal-blue'};
    ${
      useExtensionLifecycle
        ? `
    Object.assign(settings,JSON.parse(sessionStorage.getItem('qa-extension-settings')||'null')||{
      activeThemeId:'theme-default',activePlugins:['vp_promo_bar'],
      pluginConfig:{pluginStatus:{vp_promo_bar:'active'},vp_promo_bar:{text:'Retained fixture text'}},
      theme:{prism:{fontSize:'lg'}}
    });
    window.__extensionWrites=[];window.__extensionAccept=true;window.__extensionHold=false;
    window.__extensionNames=Object.fromEntries(Object.values(THEMES).map(theme=>[theme.id,theme.name]));
    `
        : ''
    }
    ${
      useAdsWorkspace
        ? `settings.ads={adsEnabled:false,popupEnabled:false,inFeedFrequency:6,
      headerAd:'<!-- Header sample -->',inFeedAd:'<!-- In-feed sample -->',popupAd:'<!-- Popup sample -->'};
    settings.navigation=[];settings.api={};settings._canManageSecrets=true;
    window.__adsFixtureSettings=settings;`
        : ''
    }
    const oldPost={id:'42',title:'Existing article',content:'Original',status:'draft',category:'News'};
    const noWrite=()=>{throw new Error('No fixture writes allowed')};
    ${
      useDashboard
        ? `
    window.__qaAnalyticsRequests=[];
    window.__qaPendingComments=[];
    window.__qaHoldComments=true;
    window.fetch=async(input,options={})=>{
      if(options.method && options.method!=='GET')throw new Error('Dashboard fixture forbids writes');
      const url=new URL(input,location.href);
      const result={success:true,posts:[],pages:[],logs:[],users:[],comments:[],meta:{total:0},storage:{used:'1 MB'},details:[]};
      if(url.pathname.endsWith('/get_comments.php')&&window.__qaHoldComments){
        await new Promise(resolve=>window.__qaPendingComments.push(resolve));
        result.meta.total=23;
      }
      if(url.pathname.endsWith('/track_visit.php')){
        window.__qaAnalyticsRequests.push(url.search);
        if(url.searchParams.get('report')==='articles')result.articleViews={articles:[],since:'2026-10-25',timeZone:'UTC'};
        else {
          const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
          result.analytics={daily:[{visit_date:day(-1),visits:17,unique_visitors:10},{visit_date:day(0),visits:20,unique_visitors:12}],totals:{total_views:37,unique_visitors:19},mode:url.searchParams.get('mode')};
        }
      }
      return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
    };`
        : ''
    }
    ${
      useSecurity
        ? `
    window.__qaSecurityRequests=[];
    window.fetch=async(input,options={})=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin||options.method&&options.method!=='GET')throw new Error('Security fixture forbids external requests and writes');
      window.__qaSecurityRequests.push(url.search);
      const types=['login_failed','honeypot_caught','login_rate_limited','remember_rotation_conflict'];
      const selected=url.searchParams.get('event_type');
      const logs=types.filter(type=>!selected||type===selected).map((type,index)=>({id:index+1,event_type:type,ip_address:'192.0.2.9',user_agent:'Fixture',endpoint:'/api/login.php',severity:'medium',details:'{}',blocked:type==='remember_rotation_conflict'?0:1,created_at:new Date().toISOString()}));
      return new Response(JSON.stringify({success:true,logs,pagination:{total_pages:1,total_items:logs.length},stats:{blocked_today:3,active_last_hour:4,high_severity_today:0,top_attacker:'192.0.2.9',trends:[],distribution:[],top_ips:[]}}),{headers:{'Content-Type':'application/json'}});
    };`
        : ''
    }
    ${
      useCalendar
        ? `settings.timeZone=params.get('zone')||'Asia/Kuala_Lumpur';
    const fixtureFetch=window.fetch.bind(window);
    window.__calendarPending=[];
    window.__qaResolveCalendar=()=>{const next=window.__calendarPending.shift();if(!next)throw new Error('No pending Calendar response');next();};
    window.fetch=(input,options={})=>{
      if(new URL(input,location.href).pathname.endsWith('/api/calendar.php')){
        const headers=new Headers(options.headers);headers.set('X-Fixture-Role',window.__calendarRole||'Admin');
        const request=fixtureFetch(input,{...options,headers});
        return window.__calendarHoldWrites && ['POST','DELETE'].includes(options.method)
          ? request.then(response=>new Promise(resolve=>window.__calendarPending.push(()=>resolve(response))))
          : request;
      }
      if(new URL(input,location.href).pathname.endsWith('/api.php'))return Promise.resolve(new Response(JSON.stringify({csrf_token:'fixture-token'}),{headers:{'Content-Type':'application/json'}}));
      return fixtureFetch(input,options);
    };`
        : ''
    }
    ${
      useRealEditor
        ? `
    const nativeNow=Date.now;let clockOffset=0;let savedId=100;
    Date.now=()=>nativeNow()+clockOffset;
    window.__qaJumpClock=()=>{clockOffset+=61000};
    window.__qaWrites=[];window.__qaPending=[];
    window.__qaSettle=(reject=false)=>{
      const next=window.__qaPending.shift();if(!next)throw new Error('No pending fixture save');next(reject);
    };
    window.fetch=async(input,options={})=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin)throw new Error('External fixture request forbidden');
      const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
      if(url.pathname.endsWith('/api.php'))return response({success:true,csrf_token:'isolated-navigation-token'});
      if(/save_(post|page)\\.php$/.test(url.pathname)){
        const body=JSON.parse(options.body);window.__qaWrites.push({url:url.pathname,body});
        return new Promise(resolve=>window.__qaPending.push(reject=>resolve(reject
          ? response({success:false,error:'Fixture validation rejection'},422)
          : response({success:true,id:/^\\d+$/.test(body.id)?body.id:String(savedId++),status:'draft',updated_at:'2026-10-24 12:01:00'}))));
      }
      if(url.pathname.endsWith('/get_post.php'))return response({success:true,post:oldPost});
      return response({success:true,posts:[],pages:[],logs:[],media:[],meta:{total:0},details:[],needsRepair:false});
    };
    `
        : ''
    }
    ${
      useAuth
        ? `
    window.__authRequests=[];window.__authRequestPaths=[];window.__authPending=[];window.__authLogins=[];
    window.fetch=async(input,options={})=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin)throw new Error('Auth fixture forbids external requests');
      if(url.pathname.endsWith('/api.php'))return new Response(JSON.stringify({success:true,csrf_token:'auth-fixture-token'}));
      if(!['/login.php','/register.php','/reset_password.php'].some(path=>url.pathname.endsWith(path)))throw new Error('Unexpected auth fixture endpoint');
      window.__authRequestPaths.push(url.pathname);
      window.__authRequests.push(JSON.parse(options.body));
      return new Promise(resolve=>window.__authPending.push((body,status)=>resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}))));
    };`
        : ''
    }
    ${
      useUsers
        ? `
    const userFixtures=[
      {id:'1',username:'fixture-owner',display_name:'Fixture Owner',email:'owner@example.invalid',role:'Admin',avatar},
      {id:'8',username:'fixture-admin',display_name:'Fixture Admin',email:'admin@example.invalid',role:'Admin',avatar},
      {id:'42',username:'fixture-writer',display_name:'Fixture Writer',email:'writer@example.invalid',role:'Writer',avatar}
    ];
    window.__userUpdates=[];window.__userUpdateResult=true;
    window.fetch=async(input)=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin||!url.pathname.endsWith('/get_users.php'))throw new Error('Unexpected User Manager fixture endpoint');
      return new Response(JSON.stringify({users:userFixtures,meta:{page:1,limit:20,total:3,totalPages:1,hasMore:false}}),{headers:{'Content-Type':'application/json'}});
    };`
        : ''
    }
    ${
      useWpBridge
        ? `
    window.__bridgeCalls=[];
    window.fetch=async(input,options={})=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin)throw new Error('Bridge fixture forbids external requests');
      if(url.pathname.endsWith('/api.php'))return new Response(JSON.stringify({csrf_token:'bridge-fixture-token'}));
      if(url.pathname.endsWith('/wp_scan.php'))return new Response(JSON.stringify({success:true,stats:{posts:2,pages:0,media:0,authors:[]},temp_file:'wp_import_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.xml',source_site_url:'https://source.invalid'}));
      if(!url.pathname.endsWith('/wp_import.php'))throw new Error('Unexpected Bridge fixture request');
      window.__bridgeCalls.push(JSON.parse(options.body));
      const index=Number(sessionStorage.getItem('qa-bridge-call')||'0');sessionStorage.setItem('qa-bridge-call',String(index+1));
      const common={success:true,has_more:true,processed_total:1,imported_total:1,skipped_total:0,next_batch_index:0,errors:[],warnings:[],warning_count:0};
      const replies=[{processed_in_batch:1,phase:'import'},{processed_in_batch:0,phase:'import',paused:true,errors:['Fixture database failure.']},{processed_in_batch:1,processed_total:2,imported_total:2,phase:'links'},{processed_in_batch:0,processed_total:2,imported_total:2,phase:'links'},{processed_in_batch:0,processed_total:2,imported_total:2,phase:'links',has_more:false,warning_count:1,warnings:['Protected fixture imported as Draft.']}];
      if(!replies[index])throw new Error('Bridge fixture requested beyond completion');
      return new Response(JSON.stringify({...common,...replies[index]}),{headers:{'Content-Type':'application/json'}});
    };`
        : ''
    }
    function Fixture(){
      const route=useLocation();
      ${
        useExtensionLifecycle
          ? `
      const [extensionSettings,setExtensionSettings]=React.useState(settings);
      React.useEffect(()=>{window.__extensionState=extensionSettings},[extensionSettings]);
      const saveExtensionSettings=async(next,options)=>{
        window.__extensionWrites.push({next,options});
        const accepted=window.__extensionHold?await new Promise(resolve=>{window.__extensionRelease=resolve}):window.__extensionAccept;
        if(!accepted)return false;
        sessionStorage.setItem('qa-extension-settings',JSON.stringify(next));
        setExtensionSettings(next);return true;
      };
      `
          : ''
      }
      ${useRealEditor ? 'const contentState=useContent();' : ''}
      const [user,setUser]=React.useState({id:params.get('owner')==='1'?'1':'8',role:params.get('role')||'Admin',username:'Navigation QA',avatar});
      const [dark,setDark]=React.useState(false);
      ${useCalendar ? "window.__calendarRole=user?.role||'Guest';" : ''}
      React.useEffect(()=>{window.__qaSetUser=setUser;window.__qaReady=true},[]);
      ${useWpBridge ? 'return React.createElement(WPMigrator);' : ''}
      ${
        useAuth
          ? `const auth=React.createElement(Login,{settings,onLogin:user=>window.__authLogins.push(user),isModal:params.get('modal')==='1'});
      return params.get('modal')==='1'
        ? React.createElement('div',{className:'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'},React.createElement('div',{className:${JSON.stringify(authModalWrapperClass)}},auth))
        : auth;`
          : ''
      }
      ${useUsers ? 'return React.createElement(UserManager,{users:[],currentUser:user,onAddUser:noWrite,onDeleteUser:noWrite,onUpdateUser:async value=>{window.__userUpdates.push(value);return window.__userUpdateResult;}});' : ''}
      ${useRealEditor ? 'React.useEffect(()=>{window.__qaSaved={posts:contentState.posts,pages:contentState.pages}},[contentState.posts,contentState.pages]);' : ''}
      const content=${useSecurity ? "route.pathname==='/admin/security' ? React.createElement(SecurityDashboard,{isPrimaryAdmin:false}) :" : ''} ${useDashboard ? "route.pathname==='/admin/dashboard' ? React.createElement(Dashboard,{posts:[],pages:[],users:[],comments:[],currentUser:user,timeZone:'UTC'}) :" : ''} ${useCalendar ? "route.pathname==='/admin/calendar' ? React.createElement(ProtectedRoute,{user,allowedRoles:['Admin','Moderator']},React.createElement(CalendarManager,{settings})) :" : ''} ${useAdsWorkspace ? "route.pathname==='/admin/settings' ? React.createElement(SettingsView,{settings,onUpdate:noWrite,notify:noWrite}) :" : ''} route.pathname==='/admin/extensions'
        ? React.createElement(ExtensionsManager,{settings:${useExtensionLifecycle ? 'extensionSettings' : 'settings'},onUpdateSettings:${useExtensionLifecycle ? 'saveExtensionSettings' : 'noWrite'}})
        : route.pathname==='/admin/editor'
          ? React.createElement(Wrapper,{editingItem:oldPost,isPage:false,user,settings,navigation:[],posts:[oldPost],pages:[],handleSaveContent:${useRealEditor ? 'contentState.handleSaveContent' : 'noWrite'},handleUpdateSettings:noWrite})
          : React.createElement('p',{},'Isolated fixture. No installed-site records accessed.');
      return React.createElement(AdminLayout,{settings,user,isDarkMode:dark,toggleDarkMode:()=>setDark(v=>!v),onLogout:noWrite},
        React.createElement('h1',{id:'qa-route',${useAdsWorkspace || useCalendar || useDashboard ? "style:{display:'none'}," : ''}},route.pathname+route.search),content);
    }
    createRoot(document.getElementById('root')).render(
      React.createElement(BrowserRouter,{basename:location.pathname.startsWith('/zangetsu/')?'/zangetsu':undefined},
        React.createElement(ThemeProvider,{},React.createElement(Fixture))));
  `;
  if (useThemeHooks)
    fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {BrowserRouter} from 'react-router';
    import TechPress from '/src/themes/techpress/Layout.tsx';
    import Newsletter from '/src/plugins/von-core/features/newsletter/NewsletterManager.tsx';
    import AdBlock from '/src/themes/shared/components/AdBlock.tsx';
    import {sanitizeHtml} from '/src/utils/security.ts';
    import '/src/index.css';
    const base=location.pathname.startsWith('/zangetsu/')?'/zangetsu':'';
    const avatar='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const user={id:'9',username:'fixture-reader',email:'qa@example.invalid',role:'Admin',avatar};
    const settings={siteName:'Hooks fixture',siteDescription:'Local UI only',siteUrl:location.origin+base,
      domainUrl:location.origin+base,postsPerPage:6,timeZone:'UTC',theme:{primaryColor:'#0066cc'},
      navigation:[{id:'home',label:'Home',url:'home',type:'internal'}],sidebarLayout:[],
      activePlugins:[],pluginConfig:{},ads:{adsEnabled:false,popupEnabled:false},api:{},media:{}};
    window.__qaReads=[];window.__qaActions=[];
    window.fetch=async(input,options={})=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin||options.method&&options.method!=='GET')throw new Error('Hooks fixture forbids external requests and writes');
      window.__qaReads.push(url.pathname+url.search);
      return new Response(JSON.stringify({success:true,posts:[],pages:[],subscribers:[],stats:{total:0,active:0,unsubscribed:0},pagination:{pages:1,total:0},meta:{total:0}}),{headers:{'Content-Type':'application/json'}});
    };
    const action=name=>(...args)=>window.__qaActions.push([name,...args]);
    function Fixture(){
      const [query,setQuery]=React.useState(''),[tick,setTick]=React.useState(0),[dark,setDark]=React.useState(false);
      const [ad,setAd]=React.useState('<script>document.body.textContent="QA frame"</script>');
      React.useEffect(()=>{window.__qaRerender=()=>setTick(v=>v+1);window.__qaSetAd=setAd;window.__qaSanitizeHtml=sanitizeHtml;window.__qaReplaceAd=()=>setAd('<span>QA replacement banner</span>');window.__qaReady=true},[]);
      return React.createElement(React.Fragment,{},React.createElement('output',{id:'qa-render'},tick),
        React.createElement(TechPress,{posts:[],pages:[],comments:[],allUsers:[user],settings,user,
          currentView:'home',selectedPost:null,selectedPage:null,selectedProfile:null,
          isDarkMode:dark,toggleDarkMode:()=>setDark(v=>!v),isAuthLoading:false,
          publicSearchQuery:query,onPublicSearchChange:setQuery,
          onPostClick:action('post'),onPageClick:action('page'),onBackToHome:action('home'),
          onCategoryClick:action('category'),onViewProfile:action('profile'),onNavigateAdmin:action('admin'),
          onLogin:action('login'),onLogout:action('logout'),onAddComment:action('comment'),
          onLikeComment:action('like'),onReplyComment:action('reply')}),
        React.createElement('section',{id:'qa-newsletter'},React.createElement(Newsletter,{settings,onUpdateSettings:()=>{throw new Error('No fixture save allowed')}})),
        React.createElement('section',{id:'qa-ad'},React.createElement(AdBlock,{content:ad,slotId:'hooks'})));
    }
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,{basename:base||undefined},React.createElement(Fixture)));
  `;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-navigation-'));
  try {
    calendarFixture = useCalendar ? require('./test-calendar.cjs').createCalendarFixture() : null;
    server = await createServer({
      root,
      server: { host: '127.0.0.1', port: 0 },
      plugins: [
        {
          name: 'isolated-navigation-fixture',
          enforce: 'pre',
          resolveId(id) {
            if (id === '/__navigation-fixture.js') return '\0navigation-fixture.js';
            if (id === '/__navigation-wrapper.tsx') return '\0navigation-wrapper.tsx';
          },
          load(id) {
            if (id === '\0navigation-fixture.js') return fixture;
            if (id === '\0navigation-wrapper.tsx') {
              return ts.transpileModule(wrapper, {
                fileName: 'navigation-wrapper.tsx',
                compilerOptions: {
                  module: ts.ModuleKind.ESNext,
                  target: ts.ScriptTarget.ES2022,
                  jsx: ts.JsxEmit.ReactJSX,
                },
              }).outputText;
            }
          },
          transform(code, id) {
            if (
              legacyHeaderMutation &&
              id.replaceAll('\\', '/').endsWith('/src/themes/techpress/Layout.tsx')
            ) {
              // Negative control: restore the old unstable nested-component pattern in memory only.
              const ast = ts.createSourceFile(
                id,
                code,
                ts.ScriptTarget.Latest,
                true,
                ts.ScriptKind.TSX
              );
              let header;
              function visit(node) {
                if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'header')
                  header = node;
                ts.forEachChild(node, visit);
              }
              visit(ast);
              assert.ok(
                header?.initializer,
                'Current header element is required for the negative control'
              );
              return (
                code.slice(0, header.initializer.getStart(ast)) +
                'useMemo(() => () => (' +
                header.initializer.getText(ast) +
                '), [colors, config])' +
                code
                  .slice(header.initializer.end)
                  .replaceAll('{header}', '{React.createElement(header)}')
              );
            }
            if (
              useAdsWorkspace &&
              id
                .replaceAll('\\', '/')
                .endsWith('/src/plugins/von-core/features/settings/SettingsManager.tsx')
            ) {
              const importLine = "import { vonFetch } from '../../../../utils/api';";
              assert.ok(code.includes(importLine) && code.includes(">('general');"));
              return code
                .replace(">('general');", ">('ads');")
                .replace(
                  importLine,
                  'const vonFetch=async()=>({json:async()=>window.__adsFixtureSettings});'
                );
            }
            if (!id.replaceAll('\\', '/').endsWith('/src/components/layouts/AdminLayout.tsx'))
              return;
            const importLine = "import { vonFetch } from '../../utils/api';";
            assert.ok(code.includes(importLine), 'Layout transport isolation must be applied.');
            return code.replace(
              importLine,
              'const vonFetch=async()=>({ok:true,json:async()=>({success:true,meta:{total:7},needsRepair:false,details:[]})});'
            );
          },
          configureServer(vite) {
            vite.middlewares.use(async (req, res, next) => {
              if (
                calendarFixture &&
                /^\/(?:zangetsu\/)?api\/calendar\.php(?:\?|$)/.test(req.url || '')
              ) {
                let raw = '';
                for await (const chunk of req) {
                  raw += chunk;
                  if (raw.length > 65536) {
                    res.statusCode = 413;
                    res.end();
                    return;
                  }
                }
                const url = new URL(req.url, 'http://fixture');
                if (calendarFault === 'read' && req.method === 'GET') {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({ success: false, error: 'Fixture Calendar read failure' })
                  );
                  return;
                }
                const result = calendarFixture.request(
                  req.method,
                  Object.fromEntries(url.searchParams),
                  raw ? JSON.parse(raw) : null,
                  {
                    role: req.headers['x-fixture-role'] || 'Admin',
                    csrf: req.headers['x-csrf-token'],
                    auditFailure: calendarFault === 'audit',
                  }
                );
                // Read-only UI clock controls; normal CRUD still uses the actual PHP service.
                if (calendarDateProjection && req.method === 'GET' && result.status === 200) {
                  Object.assign(result.body, calendarDateProjection);
                }
                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.body));
                return;
              }
              if (
                !/^\/(?:zangetsu\/)?admin(?:\/|\?|$)/.test(req.url || '') &&
                !(useAuth && /^\/(?:zangetsu\/)?login(?:\?|$)/.test(req.url || ''))
              )
                return next();
              const html = await vite.transformIndexHtml(
                req.url,
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root,.admin-shell{height:100%;margin:0}</style></head><body><div id="root"></div><script>window.VON_BASE=location.pathname.startsWith("/zangetsu/")?"/zangetsu/":"/"</script><script type="module" src="/__navigation-fixture.js"></script></body></html>'
              );
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            });
          },
        },
      ],
    });
    await server.listen();
    const port = server.httpServer.address().port;
    chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-background-networking',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
    );
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Chrome start timeout')), 15000);
      chrome.stderr.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      chrome.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const tabs = await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`).then((res) =>
      res.json()
    );
    socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    let sequence = 0,
      acceptDialog = false,
      dialogs = 0;
    const pending = new Map(),
      errors = [];
    const send = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    closeBrowser = () => send('Browser.close').catch(() => {});
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(item.timer);
        message.error
          ? item.reject(new Error(JSON.stringify(message.error)))
          : item.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown')
        errors.push(
          message.params.exceptionDetails.exception?.description ||
            message.params.exceptionDetails.text
        );
      if (message.method === 'Target.attachedToTarget') {
        const sessionId = message.params.sessionId;
        void (async () => {
          await send('Runtime.enable', {}, sessionId);
          await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, sessionId);
          await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
        })().catch((error) => errors.push(error.message));
      }
      if (message.method === 'Fetch.requestPaused') {
        const requestUrl = message.params.request.url;
        const isLocal =
          requestUrl.startsWith('http://127.0.0.1:') ||
          requestUrl.startsWith('data:') ||
          requestUrl === 'about:srcdoc' ||
          requestUrl === 'about:blank';
        void send(
          isLocal ? 'Fetch.continueRequest' : 'Fetch.failRequest',
          {
            requestId: message.params.requestId,
            ...(isLocal ? {} : { errorReason: 'BlockedByClient' }),
          },
          message.sessionId
        );
      }
      if (message.method === 'Page.javascriptDialogOpening') {
        dialogs += 1;
        void send('Page.handleJavaScriptDialog', { accept: acceptDialog });
      }
    };
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description || result.exceptionDetails.text
        );
      return result.result.value;
    };
    const wait = async (expression) => {
      const endTime = Date.now() + 20000;
      while (Date.now() < endTime) {
        if (await evaluate(expression)) return;
        await pause(100);
      }
      throw new Error(`Browser wait failed: ${expression}`);
    };
    const click = async (selector) => {
      assert.ok(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), selector);
      const point = await evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
        const box = element.getBoundingClientRect();
        return {x:box.x+box.width/2,y:box.y+box.height/2};
      })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      await pause(120);
    };
    const metrics = async (width, height) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await pause(350);
    };
    const screenshot = async (name) => {
      const directory = process.env.ADMIN_NAV_SCREENSHOT_DIR;
      if (!directory) return;
      await pause(350);
      fs.mkdirSync(directory, { recursive: true });
      const result = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(directory, name + '.png'), Buffer.from(result.data, 'base64'));
    };
    const checkActiveGroupToggle = async (name) => {
      const selector = `nav button[title="${name}"]`;
      const expanded = () =>
        evaluate(
          `document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-expanded')`
        );
      const activeLink = await evaluate(
        'document.querySelector("nav a[aria-current=page]").getAttribute("href")'
      );
      assert.equal(await expanded(), 'true', 'entering a child route must reveal its group');
      assert.equal(
        await evaluate(
          `document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-disabled')`
        ),
        null
      );
      await click(selector);
      assert.equal(await expanded(), 'false', 'the active group must close without changing route');
      assert.equal(
        await evaluate('document.querySelector("nav a[aria-current=page]").getAttribute("href")'),
        activeLink
      );
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      for (const [key, code, keyCode, expected] of [
        [' ', 'Space', 32, 'true'],
        ['Enter', 'Enter', 13, 'false'],
      ]) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key,
          code,
          windowsVirtualKeyCode: keyCode,
          text: key === 'Enter' ? '\r' : key,
          unmodifiedText: key === 'Enter' ? '\r' : key,
        });
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key,
          code,
          windowsVirtualKeyCode: keyCode,
        });
        assert.equal(await expanded(), expected, `${name} must toggle using ${code}`);
      }
      await click(selector);
      assert.equal(await expanded(), 'true');
    };
    await send('Page.enable');
    await send('Runtime.enable');
    if (useExtensionLifecycle) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const card = (name) =>
        `(Array.from(document.querySelectorAll('h3')).find(node=>node.textContent.trim()===${JSON.stringify(name)})?.closest('.group'))`;
      const action = async (name, label) => {
        await evaluate(
          `Array.from(${card(name)}.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`
        );
      };
      const uninstall = async (name) => {
        await evaluate(`${card(name)}.querySelector('button[aria-label^="Uninstall "]').click()`);
      };
      for (const base of ['', '/zangetsu']) {
        await metrics(base ? 390 : 1440, 1000);
        acceptDialog = true;
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/extensions?tab=themes`,
        });
        await wait('!!window.__extensionNames && !!window.__extensionState');
        const names = await evaluate('window.__extensionNames');
        const prism = names['theme-prism'],
          fallback = names['theme-default'];
        await wait(`!!window.__extensionState && !!${card(prism)}`);
        assert.equal(
          await evaluate(
            `${card(fallback)}.querySelector('button[aria-label^="Uninstall "]').disabled`
          ),
          true
        );
        assert.equal(
          await evaluate('document.body.textContent.includes("Uninstall keeps saved settings")'),
          true
        );
        await action(prism, 'Activate');
        await wait('window.__extensionState.activeThemeId==="theme-prism"');
        await wait(`${card(prism)}.textContent.includes('Active')`);
        await evaluate('window.__extensionAccept=false');
        await uninstall(prism);
        await wait('window.__extensionWrites.length===2');
        await wait(`!${card(prism)}.querySelector('button[title="Uninstall"]').disabled`);
        assert.equal(await evaluate('window.__extensionState.activeThemeId'), 'theme-prism');
        assert.equal(await evaluate('localStorage.getItem("von_active_theme_id")'), 'theme-prism');
        await evaluate('window.__extensionHold=true');
        await uninstall(prism);
        await wait('typeof window.__extensionRelease==="function"');
        assert.equal(await evaluate('window.__extensionState.activeThemeId'), 'theme-prism');
        assert.equal(
          await evaluate(`${card(prism)}.querySelector('button[title="Uninstall"]').disabled`),
          true
        );
        await evaluate('window.__extensionHold=false;window.__extensionRelease(true)');
        await wait(
          'window.__extensionState.activeThemeId==="theme-default" && window.__extensionState.pluginConfig.pluginStatus["theme-prism"]==="not_installed"'
        );
        await wait(`${card(prism)}.textContent.includes('Install')`);
        await wait('localStorage.getItem("von_active_theme_id")==="theme-default"');
        await send('Page.reload', { ignoreCache: true });
        await wait(
          'window.__extensionWrites?.length===0 && window.__extensionState?.pluginConfig?.pluginStatus["theme-prism"]==="not_installed"'
        );
        await wait(`!!${card(prism)}`);
        assert.equal(await evaluate(`${card(prism)}.textContent.includes('Install')`), true);
        assert.equal(await evaluate('window.__extensionState.theme.prism.fontSize'), 'lg');
        assert.equal(
          await evaluate('window.__extensionState.pluginConfig.vp_promo_bar.text'),
          'Retained fixture text'
        );
        await action(prism, 'Install');
        await wait('window.__extensionState.pluginConfig.pluginStatus["theme-prism"]==="inactive"');
        assert.equal(await evaluate('window.__extensionState.activeThemeId'), 'theme-default');
        await action(prism, 'Activate');
        await wait('window.__extensionState.activeThemeId==="theme-prism"');
        const writes = await evaluate('window.__extensionWrites.length');
        acceptDialog = false;
        await uninstall(prism);
        assert.equal(await evaluate('window.__extensionWrites.length'), writes);
        assert.equal(await evaluate('window.__extensionState.activeThemeId'), 'theme-prism');
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
        await evaluate(
          'sessionStorage.clear();localStorage.removeItem("von_active_theme_id");true'
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Extensions lifecycle browser: root/desktop and subfolder/phone uninstall, delayed/rejected acknowledgement, Default protection, reload, retained configuration, inactive reinstall and activation. Persistence uses fixture state/sessionStorage only; no installed CMS accessed.'
      );
      return;
    }
    if (useThemeHooks) {
      await send('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      });
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      for (const base of ['', '/zangetsu']) {
        await metrics(1440, 900);
        await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/hooks` });
        await wait('window.__qaReady && !!document.querySelector("#techpress-search")');
        await evaluate(
          `window.__qaHeader=document.querySelector('header');window.__qaMenu=document.querySelector('button[aria-label="User Menu"]');window.__qaMenu.focus();window.__qaRerender()`
        );
        await wait('document.querySelector("#qa-render").textContent==="1"');
        assert.equal(
          await evaluate('window.__qaHeader===document.querySelector("header")'),
          true,
          'Unrelated renders must retain the same header DOM'
        );
        assert.equal(
          await evaluate('document.activeElement===window.__qaMenu'),
          true,
          'Header button focus must survive parent renders'
        );
        await click('button[aria-label="User Menu"]');
        await wait('document.querySelector("header").textContent.includes("View Profile")');
        await evaluate('window.__qaRerender()');
        await wait('document.querySelector("#qa-render").textContent==="2"');
        assert.equal(
          await evaluate('document.querySelector("header").textContent.includes("View Profile")'),
          true
        );
        await click('#techpress-search');
        await evaluate('window.__qaSearch=document.activeElement; true');
        for (const character of 'voncms') {
          await send('Input.insertText', { text: character });
          assert.equal(
            await evaluate('document.activeElement===window.__qaSearch'),
            true,
            'Search focus must survive controlled updates'
          );
        }
        assert.equal(await evaluate('document.querySelector("#techpress-search").value'), 'voncms');
        await wait('!!document.querySelector("#qa-ad iframe")');
        await evaluate('window.__qaReplaceAd()');
        await wait(
          'document.querySelector("#qa-ad").textContent.includes("QA replacement banner")'
        );
        assert.equal(
          await evaluate('!!document.querySelector("#qa-ad iframe")'),
          false,
          'Old ad cleanup must preserve the replacement banner'
        );
        // Reproduce the supplied 728x90 sponsor banner, including its absolute decoration.
        const banner = `<a href="https://getvoncms.com/" target="_blank" rel="noopener noreferrer sponsored"
          aria-label="Visit VonCMS - Sponsored" style="display:block;width:728px;max-width:100%;height:90px;margin:0 auto;text-decoration:none;font-family:Arial,Helvetica,sans-serif">
          <div style="position:relative;box-sizing:border-box;width:100%;height:90px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap;gap:10px;overflow:hidden;background:linear-gradient(110deg,#1268ed,#2685ff);border:1px solid #5ba8ff;border-left:5px solid #ffd600;border-radius:8px">
            <div aria-hidden="true" style="position:absolute;right:-35px;top:-85px;width:200px;height:200px;border:25px solid rgba(255,255,255,0.07);border-radius:50%;pointer-events:none;box-sizing:border-box"></div>
            <div style="position:relative;z-index:1;flex:1 1 0;min-width:0;text-align:left">
              <div style="color:#ffd600;font-size:9px;font-weight:800;letter-spacing:1.2px;margin-bottom:4px;line-height:1.1">VONCMS &nbsp;·&nbsp; <span style="color:#dcecff">SPONSORED</span></div>
              <div style="color:#ffffff;font-size:clamp(13px,2.7vw,21px);font-weight:900;letter-spacing:-0.5px;line-height:1.1">Build fast. <span style="color:#ffd600">Publish faster.</span></div>
              <div style="color:#e1efff;font-size:10px;margin-top:4px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Modern open-source CMS powered by PHP + React.</div>
            </div>
            <div style="position:relative;z-index:1;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:#ffd600;color:#1251a5;padding:12px clamp(8px,1.8vw,15px);border-radius:5px;font-size:clamp(9px,1.4vw,11px);font-weight:900;white-space:nowrap;box-shadow:0 3px 0 #d5ac00">GET VONCMS &nbsp; ↗</div>
          </div></a>`;
        await evaluate(`window.__qaSetAd(${JSON.stringify(banner)})`);
        await wait('!!document.querySelector("#qa-ad iframe")');
        assert.equal(
          await evaluate(
            'document.querySelector("#qa-ad iframe").sandbox.contains("allow-same-origin")'
          ),
          false
        );
        const report = `<script>const reportLayout=()=>{try{
          const card=document.querySelector('a > div'),circle=card.children[0],copy=card.children[1];
          let parentReadable=false,storageReadable=false;
          try { parent.document.body.dataset.adEscape='bad';parentReadable=true } catch {}
          try { localStorage.getItem('ad-qa');storageReadable=true } catch {}
          parent.postMessage({type:'qaAdLayout',copyLeft:Math.round(copy.getBoundingClientRect().left),
            circlePosition:getComputedStyle(circle).position,circleWidth:circle.getBoundingClientRect().width,
            base:document.baseURI,rel:document.querySelector('a').rel,parentReadable,storageReadable},'*');
          }catch(error){parent.postMessage({type:'qaAdLayout',error:String(error)},'*')}};addEventListener('load',()=>requestAnimationFrame(reportLayout));setTimeout(reportLayout,100);setTimeout(reportLayout,500);
        </script>`;
        await evaluate(`window.__qaAdReports=[];window.addEventListener('message',event=>{
          if(event.source===document.querySelector('#qa-ad iframe')?.contentWindow && event.data?.type==='qaAdLayout')window.__qaAdReports.push(event.data)
        });true`);
        for (const width of [390, 820, 1440]) {
          await metrics(width, 900);
          await evaluate(
            `window.__qaAdReports=[];window.__qaSetAd(${JSON.stringify((banner + report).replace('<a ', `<a data-qa-width="${width}" `))})`
          );
          await wait('!!document.querySelector("#qa-ad iframe")');
          await evaluate(
            'document.querySelector("#qa-ad iframe").scrollIntoView({block:"center"})'
          );
          await wait('window.__qaAdReports.length>0');
          const layout = await evaluate('window.__qaAdReports.at(-1)');
          const frame = await evaluate(
            `(() => {const f=document.querySelector('#qa-ad iframe');return {width:f.getBoundingClientRect().width,title:f.title}})()`
          );
          assert.equal(layout.circlePosition, 'absolute', 'Decoration stays out of flex flow');
          assert.equal(layout.circleWidth, 200, 'Frame CSS must not resize decorative children');
          assert(Math.abs(layout.copyLeft - (Math.max(0, frame.width - 728) / 2 + 19)) <= 1);
          assert.equal(layout.base, `http://127.0.0.1:${port}${base}/`);
          assert.equal(layout.rel, 'noopener noreferrer sponsored');
          assert.equal(layout.parentReadable, false);
          assert.equal(layout.storageReadable, false);
          assert.equal(frame.title, 'Advertisement');
          await wait(
            'Math.abs(document.querySelector("#qa-ad iframe").getBoundingClientRect().height-90)<=1'
          );
          assert(frame.width <= width, 'Ad viewport stays within its outer slot');
        }
        assert.equal(
          await evaluate(
            `window.__qaSanitizeHtml('<div style="position:absolute;color:red" onclick="bad()">Text</div>',{preserveSandboxedAdStyles:true})`
          ),
          '<div style="color:red">Text</div>',
          'Public/editor styles stay restricted'
        );
        await evaluate(
          `window.dispatchEvent(new MessageEvent('message',{source:window,data:{type:'adHeight',height:50000}}));true`
        );
        assert.equal(
          await evaluate('document.querySelector("#qa-ad iframe").style.height'),
          '90px'
        );
        await evaluate(
          `window.__qaOldFrame=document.querySelector('#qa-ad iframe');window.dispatchEvent(new MessageEvent('message',{source:window.__qaOldFrame.contentWindow,data:{type:'adHeight',height:50000}}));true`
        );
        assert.equal(
          await evaluate('document.querySelector("#qa-ad iframe").style.height'),
          '10000px'
        );
        await evaluate(
          `window.__qaSetAd(${JSON.stringify(banner.replaceAll('height:90px', 'height:40px'))})`
        );
        await wait(
          'document.querySelector("#qa-ad iframe")!==window.__qaOldFrame && document.querySelector("#qa-ad iframe").style.height==="40px"'
        );
        assert.equal(await evaluate('window.__qaOldFrame.isConnected'), false);
        await evaluate(
          `window.__qaSetAd('<a href="java&#x73;cript:bad()"><img src="/qa.png" onerror="bad()"></a>')`
        );
        await wait('!!document.querySelector("#qa-ad img")');
        assert.equal(await evaluate('!!document.querySelector("#qa-ad iframe")'), false);
        assert.equal(
          await evaluate('document.querySelector("#qa-ad a").hasAttribute("href")'),
          false
        );
        assert.equal(
          await evaluate('document.querySelector("#qa-ad img").hasAttribute("onerror")'),
          false
        );
        await evaluate('window.__qaReplaceAd()');
        for (const width of [390, 820]) {
          await metrics(width, 850);
          const menuVisible = await evaluate(
            `document.querySelector('button[aria-label="Open Menu"]').offsetParent!==null`
          );
          if (!menuVisible) {
            assert(width >= 768, 'Only the tablet/desktop breakpoint may use inline navigation');
            assert.equal(
              await evaluate(`document.querySelector('header nav a').offsetParent!==null`),
              true
            );
            continue;
          }
          await click('button[aria-label="Open Menu"]');
          await wait(`!!document.querySelector('button[aria-label="Close Menu"]')`);
          await click('button[aria-label="Close Menu"]');
          assert.equal(
            await evaluate(`!!document.querySelector('button[aria-label="Open Menu"]')`),
            true
          );
        }
        await evaluate(
          `[...document.querySelectorAll('#qa-newsletter button')].find(button=>button.textContent.trim()==='Subscribers').click()`
        );
        await wait('window.__qaReads.some(url=>url.includes("newsletter_list.php"))');
        const beforeTyping = await evaluate(
          'window.__qaReads.filter(url=>url.includes("newsletter_list.php")).length'
        );
        await click('#search-email');
        await send('Input.insertText', { text: 'fixture' });
        await pause(150);
        assert.equal(
          await evaluate(
            'window.__qaReads.filter(url=>url.includes("newsletter_list.php")).length'
          ),
          beforeTyping,
          'Newsletter typing alone must not submit a search'
        );
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
        });
        await wait(
          'window.__qaReads.some(url=>url.includes("newsletter_list.php")&&url.includes("search=fixture"))'
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Theme Hooks browser: root/subfolder header/search/menu, responsive banner CSS, opaque ad origin, bounded resize, safe replacement, unchanged editor sanitizer and Newsletter manual search. Fixture reads only; no installed CMS or external writes.'
      );
      return;
    }
    await send('Page.enable');
    await send('Runtime.enable');
    if (useWpBridge) {
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/admin/settings` });
      await wait('!!window.__qaReady && !!document.querySelector("input[type=file]")');
      await evaluate('localStorage.clear();sessionStorage.clear()');
      await evaluate(
        `(() => {const input=document.querySelector('input[type=file]');const data=new DataTransfer();data.items.add(new File(['<rss/>'],'fixture.xml',{type:'text/xml'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`
      );
      await click('input[type=checkbox]');
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Start Scan').click()`
      );
      await wait(
        `[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Start Import'))`
      );
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start Import')).click()`
      );
      await wait(
        'sessionStorage.getItem("qa-bridge-call")==="2" && !!document.querySelector("input[type=file]")===false && [...document.querySelectorAll("button")].some(b=>b.textContent.includes("Start Import"))'
      );
      assert.equal(
        await evaluate('document.body.textContent.includes("Import completed.")'),
        false,
        'Failed item cannot show completion'
      );
      assert.equal(
        await evaluate(
          'JSON.parse(localStorage.getItem("voncms_wp_import_checkpoint:/")).processedCount'
        ),
        1
      );
      await send('Page.reload');
      await wait(
        '!!window.__qaReady && document.body.textContent.includes("Resume Previous Import")'
      );
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Resume').click()`
      );
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start Import')).click()`
      );
      await wait('document.body.textContent.includes("Import completed with 1 warning")');
      assert.equal(
        await evaluate('sessionStorage.getItem("qa-bridge-call")'),
        '5',
        'Zero-import link batches must continue'
      );
      assert.equal(
        await evaluate('localStorage.getItem("voncms_wp_import_checkpoint:/")'),
        null,
        'Only completion clears the browser checkpoint'
      );
      for (const width of [390, 820, 1440]) {
        await metrics(width, 850);
        assert.equal(
          await evaluate('document.documentElement.scrollWidth>innerWidth'),
          false,
          'Bridge summary must fit viewport'
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Browser WordPress Bridge: upload/scan, failed-item pause, reload/resume, zero-import finalization batches and warning completion.'
      );
      return;
    }
    if (useUsers) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const fill = (selector, value) =>
        evaluate(`(() => {
        const field=document.querySelector(${JSON.stringify(selector)});
        const proto=field.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(field,${JSON.stringify(value)});
        field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));
      })()`);
      const edit = async (name) => {
        await evaluate(`(() => {
          const row=[...document.querySelectorAll('tr')].find(r=>r.textContent.includes(${JSON.stringify(name)}));
          if(!row)throw new Error('Missing user fixture row');row.querySelector('button[title="Edit User"]')?.click();
        })()`);
        await wait(`!!document.querySelector('[role="dialog"][aria-label="Edit user"]')`);
      };
      for (const base of ['', '/zangetsu']) {
        await metrics(1440, 1000);
        await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/users?owner=1` });
        await wait('document.querySelectorAll("tr").length===4');
        await edit('fixture-writer');
        for (const dark of [false, true]) {
          await evaluate(
            `document.documentElement.classList.toggle('dark',${dark});document.querySelector('.admin-modal-layer').classList.toggle('dark',${dark})`
          );
          for (const width of [320, 390, 768, 1440]) {
            await metrics(width, 740);
            const box = await evaluate(`(() => {
              const d=document.querySelector('[role=dialog]'),r=d.getBoundingClientRect(),a=d.querySelector('#usermanager-455').getBoundingClientRect(),b=d.querySelector('#edit-display-name-pen-name').getBoundingClientRect(),save=d.querySelector('button[type=submit]').getBoundingClientRect();
              return {width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,saveTop:save.top,saveBottom:save.bottom,pair:Math.abs(a.top-b.top)<2,overflow:document.documentElement.scrollWidth>innerWidth};
            })()`);
            assert.equal(box.overflow, false);
            assert(box.left >= 0 && box.right <= width + 1);
            assert(box.top >= 0 && box.bottom <= 740, 'Dialog fits the viewport');
            assert(
              box.saveTop >= 0 && box.saveBottom <= 740,
              'Save remains reachable without body scrolling'
            );
            assert.equal(
              box.pair,
              width >= 640,
              'Profile fields reflow rather than shrink on phones'
            );
            if (width === 1440) assert(box.width >= 900, 'Desktop editor is genuinely wide');
            if (!dark && [390, 1440].includes(width)) await screenshot('edit-user-' + width);
          }
        }
        await fill('#usermanager-455', 'fixture-renamed');
        await fill('#edit-display-name-pen-name', 'R&D <Test>');
        await fill('#usermanager-466', 'changed@example.invalid');
        await fill('#edit-user-role', 'Moderator');
        const avatar =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        await fill('#https', avatar);
        await evaluate(
          `window.__userUpdateResult=false;document.querySelector('[role=dialog] form').requestSubmit()`
        );
        await wait(
          'window.__userUpdates.length===1 && !document.querySelector("[role=dialog] button[type=submit]").disabled'
        );
        const saved = await evaluate('window.__userUpdates[0]');
        assert.equal(saved.id, '42');
        assert.equal(saved.username, 'fixture-renamed');
        assert.equal(saved.display_name, 'R&D <Test>');
        assert.equal(saved.email, 'changed@example.invalid');
        assert.equal(saved.role, 'Moderator');
        assert.equal(saved.avatar, avatar);
        assert.equal('password' in saved, false, 'Blank password is omitted');
        assert(
          await evaluate('!!document.querySelector("[role=dialog]")'),
          'Failed save keeps editor open'
        );
        await fill('[id="8-chars-a-z-0-9"]', 'weak');
        await evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
        await pause(150);
        assert.equal(
          await evaluate('window.__userUpdates.length'),
          1,
          'Invalid password is blocked'
        );
        await fill('[id="8-chars-a-z-0-9"]', 'Fixture_123!');
        await evaluate(
          'window.__userUpdateResult=true;document.querySelector("[role=dialog] form").requestSubmit()'
        );
        await wait('!document.querySelector("[role=dialog]")');
        assert.equal(await evaluate('window.__userUpdates[1].password'), 'Fixture_123!');
        await edit('fixture-owner');
        assert.equal(
          await evaluate('document.querySelector("#edit-user-role").disabled'),
          true,
          'Own role remains locked'
        );
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Escape',
          code: 'Escape',
          windowsVirtualKeyCode: 27,
        });
        await wait('!document.querySelector("[role=dialog]")');
        assert.notEqual(
          await evaluate('document.body.style.overflow'),
          'hidden',
          'Closing restores page scrolling'
        );
        await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/users` });
        await wait('document.querySelectorAll("tr").length===4');
        await evaluate(
          `document.querySelector('tr button[title="System owner permission is required to edit this protected account"]').click()`
        );
        assert.equal(
          await evaluate('!!document.querySelector("[role=dialog]")'),
          false,
          'Appointed Admin cannot open protected account'
        );
        await edit('fixture-writer');
        assert.equal(
          await evaluate('!!document.querySelector("#edit-user-role option[value=Admin]")'),
          false,
          'Appointed Admin does not gain Admin role option'
        );
        await click('[aria-label="Close user editor"]');
        assert.equal(
          await evaluate('window.__userUpdates.length'),
          0,
          'Close performs no mutation'
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS User Manager browser: real wide editor/avatar, 320/390/768/1440 light/dark layout, reachable footer, exact update payload/blank password, rejected save retention, password validation, own/protected roles, close/Escape/scroll restoration and root/subfolder. Mutation callback and user reads are fixtures only.'
      );
      return;
    }
    if (useAuth) {
      const fill = (selector, value) =>
        evaluate(`(() => {
        const input=document.querySelector(${JSON.stringify(selector)});
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
        input.dispatchEvent(new Event('input',{bubbles:true}));
      })()`);
      const resendVisible = () =>
        evaluate(
          `!![...document.querySelectorAll('button')].find(b=>/Resend verification email|Sending verification email/.test(b.textContent))`
        );
      const respond = async (body, status = 200) => {
        await wait('window.__authPending.length===1');
        await evaluate(`window.__authPending.shift()(${JSON.stringify(body)},${status})`);
        await wait('!document.querySelector("form button[type=submit]")?.disabled');
      };
      const open = async (base = '', modal = false) => {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/auth-fixture?modal=${modal ? '1' : '0'}`,
        });
        await wait('!!document.querySelector("#login-374")');
      };
      const assertBlackSurface = async (view) => {
        const colors = await evaluate(`(() => {
          const card=document.querySelector('[data-auth-view="${view}"]');
          const action=card.querySelector('form button[type=submit]')||card.querySelector('button');
          const rgb=value=>{const context=document.createElement('canvas').getContext('2d');context.fillStyle=value;context.fillRect(0,0,1,1);return 'rgb('+[...context.getImageData(0,0,1,1).data].slice(0,3).join(', ')+')'};
          return {header:rgb(getComputedStyle(card.firstElementChild).backgroundColor),action:rgb(getComputedStyle(action).backgroundColor),text:rgb(getComputedStyle(action).color)};
        })()`);
        assert.equal(colors.header, 'rgb(0, 0, 0)', `${view} header stays black`);
        assert.equal(colors.action, 'rgb(0, 0, 0)', `${view} primary action stays black`);
        assert.equal(colors.text, 'rgb(255, 255, 255)', `${view} primary action remains readable`);
      };
      await open();
      await metrics(1440, 1100);
      assert.equal(await evaluate('!!document.querySelector("svg.lucide-key-round")'), true);
      await screenshot('auth-login-desktop');
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Account').click()`
      );
      await wait('!!document.querySelector("#login-514")');
      assert.equal(await evaluate('!!document.querySelector("svg.lucide-user-round-plus")'), true);
      assert.equal(
        await evaluate('document.querySelector("#login-483").placeholder'),
        'Choose a username',
        'Registration uses neutral guidance rather than a personal-style username example'
      );
      await screenshot('auth-register-desktop');
      for (const modal of [false, true]) {
        await open('', modal);
        await metrics(1440, 740);
        const originalLoginWidth = await evaluate(
          'document.querySelector("[data-auth-view=login]").getBoundingClientRect().width'
        );
        assert.equal(
          await evaluate(
            'getComputedStyle(document.querySelector("[data-auth-view=login] > div")).backgroundColor'
          ),
          'rgb(0, 0, 0)',
          'Login header uses the approved black accent'
        );
        assert.equal(
          await evaluate(
            'getComputedStyle(document.querySelector("form button[type=submit]")).backgroundColor'
          ),
          'rgb(0, 0, 0)',
          'Sign In uses the approved black accent'
        );
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Account').click()`
        );
        await wait('!!document.querySelector("#login-514")');
        for (const dark of [false, true]) {
          for (const width of [320, 390, 640, 768, 1440]) {
            await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
            await metrics(width, 740);
            const boxes = await evaluate(`(() => {
              const a=document.querySelector('#login-514').getBoundingClientRect(),b=document.querySelector('#login-525').getBoundingClientRect();
              const card=document.querySelector('[data-auth-view=register]').getBoundingClientRect();
              const labels=['login-483','login-500','login-514','login-525'].every(id=>document.querySelector('label[for="'+id+'"]'));
              return {width:a.width,otherWidth:b.width,stacked:b.top>=a.bottom,cardWidth:card.width,labels,primaryColor:getComputedStyle(document.querySelector('form button[type=submit]')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
            })()`);
            assert.equal(boxes.overflow, false, 'Registration must fit phone and desktop');
            assert.equal(
              boxes.stacked,
              width < 640,
              'Registration fields stack on phones and pair only in the wider desktop card'
            );
            assert(Math.abs(boxes.width - boxes.otherWidth) < 1);
            assert.equal(boxes.labels, true, 'Every registration field retains a persistent label');
            assert.equal(
              boxes.primaryColor,
              'rgb(0, 0, 0)',
              'Create Account uses the approved black accent'
            );
            if (width >= 640) assert(boxes.width >= 240, 'Paired fields must not be squeezed');
            if (width === 1440)
              assert.equal(boxes.cardWidth, 640, 'Registration is genuinely wider');
            if (!modal && !dark && width === 390) await screenshot('auth-register-phone');
            if (modal) {
              const card = await evaluate(
                `(() => {const r=document.querySelector('form').parentElement.parentElement.getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()`
              );
              assert(
                card.top >= 48 && card.bottom <= 724,
                'Auth modal remains reachable in a short viewport'
              );
              await evaluate(
                `document.querySelector('form button[type=submit]').scrollIntoView({block:'nearest'})`
              );
              assert(
                await evaluate(
                  `(() => {const r=document.querySelector('form button[type=submit]').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()`
                )
              );
            }
          }
        }
        await metrics(1440, 740);
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign In').click()`
        );
        assert.equal(
          await evaluate(
            'document.querySelector("[data-auth-view=login]").getBoundingClientRect().width'
          ),
          originalLoginWidth,
          'Returning to login restores its original narrow width'
        );
      }
      for (const base of ['', '/zangetsu']) {
        await open(base);
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Account').click()`
        );
        await fill('#login-483', 'fixture-user');
        await fill('#login-500', 'fixture@example.invalid');
        await fill('#login-514', 'Fixture_123!');
        await fill('#login-525', 'Mismatch_123!');
        await click('form button[type=submit]');
        assert.equal(
          await evaluate('window.__authRequests.length'),
          0,
          'Password mismatch remains blocked'
        );
        await fill('#login-525', 'Fixture_123!');
        await click('form button[type=submit]');
        await wait('window.__authRequests.length===1');
        assert.deepEqual(await evaluate('window.__authRequests[0]'), {
          username: 'fixture-user',
          email: 'fixture@example.invalid',
          password: 'Fixture_123!',
          confirmPassword: 'Fixture_123!',
          hp_field: '',
        });
        assert.equal(await evaluate('window.__authRequestPaths[0]'), `${base}/api/register.php`);
        await respond({ success: false, error: 'Fixture registration rejected.' }, 400);
        assert.equal(await evaluate('document.querySelector("#login-483").value'), 'fixture-user');
        assert.equal(await evaluate('document.querySelector("#login-514").value'), 'Fixture_123!');
        await click('form button[type=submit]');
        await respond({
          success: true,
          requiresVerification: true,
          emailSent: false,
          message: 'Fixture account created.',
        });
        await wait('!!document.querySelector("[data-auth-view=register-success]")');
        await assertBlackSurface('register-success');
        assert.equal(
          await evaluate('window.__authLogins.length'),
          0,
          'Unverified registration never logs in'
        );
        await open(base);
        assert.equal(await resendVisible(), false, 'Guest must not see resend');
        await fill('#login-374', 'fixture-user');
        await fill('#login-403', 'Fixture_123!');
        await click('form button[type=submit]');
        await respond({ success: false, error: 'Invalid username or password.' }, 401);
        assert.equal(await resendVisible(), false, 'Wrong credentials do not reveal resend');
        await click('form button[type=submit]');
        await respond(
          { success: false, error: 'Please verify your email before logging in.' },
          403
        );
        assert.equal(await resendVisible(), true, 'Unverified server verdict reveals resend');
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Resend verification email').click()`
        );
        await respond({ success: true, message: 'Fixture verification email accepted.' });
        assert.equal(await evaluate('window.__authLogins.length'), 0, 'Resend never logs in');
        assert.equal(await evaluate('window.__authRequests.at(-1).action'), 'resend_verification');
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Resend verification email').click()`
        );
        await fill('#login-403', 'Changed_123!');
        await respond({ success: true, message: 'Stale resend response must stay hidden.' });
        assert.equal(await resendVisible(), false, 'Password change clears verification state');
        assert.equal(
          await evaluate(
            'document.body.textContent.includes("Stale resend response must stay hidden.")'
          ),
          false,
          'Old resend feedback cannot apply to new credentials'
        );
        await click('form button[type=submit]');
        await fill('#login-374', 'another-fixture-user');
        await respond(
          { success: false, error: 'Please verify your email before logging in.' },
          403
        );
        assert.equal(
          await resendVisible(),
          false,
          'Stale verdict cannot reveal resend for new credentials'
        );
        await click('form button[type=submit]');
        await respond(
          { success: false, error: 'Please verify your email before logging in.' },
          403
        );
        assert.equal(await resendVisible(), true);
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Account').click()`
        );
        assert.equal(await resendVisible(), false, 'Create Account hides resend');
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign In').click()`
        );
        assert.equal(await resendVisible(), false, 'Returning from registration resets resend');
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Forgot?').click()`
        );
        await evaluate(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Back to Login').click()`
        );
        assert.equal(await resendVisible(), false, 'View changes reset resend state');
        await fill('#login-374', 'fixture-user');
        await fill('#login-403', 'Fixture_123!');
        await click('form button[type=submit]');
        await fill('#login-374', 'edited-during-login');
        await respond({
          success: true,
          user: { id: 'fixture-1' },
          csrf_token: 'fixture-next-token',
        });
        assert.equal(
          await evaluate('window.__authLogins.length'),
          1,
          'Successful server login must not be discarded after a field edit'
        );
      }
      for (const base of ['', '/zangetsu']) {
        for (const modal of [false, true]) {
          await open(base, modal);
          await evaluate(
            `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Forgot?').click()`
          );
          for (const dark of [false, true]) {
            for (const width of [320, 390, 768, 1440]) {
              await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
              await metrics(width, 740);
              await assertBlackSurface('forgot');
              assert.equal(
                await evaluate('document.documentElement.scrollWidth>innerWidth'),
                false
              );
            }
          }
          await fill('#login-600', 'fixture@example.invalid');
          await click('form button[type=submit]');
          await wait('window.__authPending.length===1');
          assert.equal(
            await evaluate('document.querySelector("form button[type=submit]").disabled'),
            true
          );
          assert.deepEqual(await evaluate('window.__authRequests[0]'), {
            action: 'request',
            email: 'fixture@example.invalid',
            hp_field: '',
          });
          assert.equal(
            await evaluate('window.__authRequestPaths[0]'),
            `${base}/api/reset_password.php`
          );
          await respond({ success: false, error: 'Fixture recovery unavailable.' }, 503);
          assert.equal(
            await evaluate('document.querySelector("#login-600").value'),
            'fixture@example.invalid'
          );
          assert.equal(
            await evaluate('document.body.textContent.includes("Fixture recovery unavailable.")'),
            true
          );
          await click('form button[type=submit]');
          await respond({
            success: true,
            message: 'If the account exists, recovery instructions have been sent.',
          });
          assert.equal(
            await evaluate('window.__authLogins.length'),
            0,
            'Recovery never creates a login'
          );
          await evaluate(
            `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Back to Login').click()`
          );
          assert.equal(await evaluate('document.querySelector("#login-403").value'), '');
          assert.equal(
            await evaluate(
              'document.body.textContent.includes("recovery instructions have been sent.")'
            ),
            false
          );

          await send('Page.navigate', {
            url: `http://127.0.0.1:${port}${base}/login?reset_token=fixture-reset-token&modal=${modal ? '1' : '0'}`,
          });
          await wait('!!document.querySelector("#login-640")');
          assert.equal(
            await evaluate('location.search.includes("reset_token")'),
            false,
            'Reset token leaves the address bar before passive work'
          );
          for (const dark of [false, true]) {
            for (const width of [320, 390, 768, 1440]) {
              await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
              await metrics(width, 740);
              await assertBlackSurface('reset');
              assert.equal(
                await evaluate('document.documentElement.scrollWidth>innerWidth'),
                false
              );
              if (modal) {
                await evaluate(
                  `document.querySelector('form button[type=submit]').scrollIntoView({block:'nearest'})`
                );
                assert.equal(
                  await evaluate(
                    `(() => {const r=document.querySelector('form button[type=submit]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`
                  ),
                  true
                );
              }
              if (base === '' && !modal && !dark && [390, 1440].includes(width))
                await screenshot('auth-reset-' + width);
            }
          }
          await fill('#login-640', 'Fixture_123!');
          await fill('#login-651', 'Mismatch_123!');
          await click('form button[type=submit]');
          assert.equal(
            await evaluate('window.__authRequests.length'),
            0,
            'Reset mismatch is blocked before transport'
          );
          await fill('#login-651', 'Fixture_123!');
          await click('form button[type=submit]');
          await wait('window.__authPending.length===1');
          assert.equal(
            await evaluate('document.querySelector("form button[type=submit]").disabled'),
            true
          );
          assert.deepEqual(await evaluate('window.__authRequests[0]'), {
            action: 'reset',
            token: 'fixture-reset-token',
            password: 'Fixture_123!',
          });
          await respond({ success: false, error: 'Reset link is invalid or has expired.' }, 400);
          assert.equal(
            await evaluate('document.querySelector("#login-640").value'),
            'Fixture_123!'
          );
          assert.equal(
            await evaluate(
              'document.body.textContent.includes("Reset link is invalid or has expired.")'
            ),
            true
          );
          await click('form button[type=submit]');
          await respond({ success: true });
          assert.equal(
            await evaluate('document.body.textContent.includes("redirecting to login")'),
            true
          );
          assert.equal(
            await evaluate('window.__authLogins.length'),
            0,
            'Password reset does not sign in automatically'
          );
          await wait(
            `location.pathname===${JSON.stringify(base + '/login')} && !!document.querySelector('#login-374')`
          );
          await assertBlackSurface('login');
          assert.equal(await evaluate('document.querySelector("#login-374").value'), '');
          assert.equal(await evaluate('document.querySelector("#login-403").value'), '');
          assert.equal(
            await resendVisible(),
            false,
            'Returned login does not inherit resend state'
          );
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Auth browser: actual Login component/CSS and public modal wrapper, responsive registration and neutral placeholder; shared black headers/actions across login/recovery/reset/account-created states; registration, recovery error/retry, token URL cleanup, reset mismatch/error/retry/success/return-to-login, guest/unverified/resend/stale-response and successful login controls at root/subfolder. Light/dark and popup/standalone checked. Transport is mocked; no accounts, passwords or mail changed on an installed site.'
      );
      return;
    }
    if (useSecurity) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      for (const base of ['', '/zangetsu']) {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/security?role=Admin`,
        });
        await wait(
          `document.body.textContent.includes('Too many login attempts') && document.body.textContent.includes('Bot trap triggered')`
        );
        assert.equal(
          await evaluate(
            `document.body.textContent.includes('Threats Blocked Today') || document.body.textContent.includes('Attack Distribution')`
          ),
          false
        );
        assert.equal(
          await evaluate(
            `document.body.textContent.includes('Patterns are clues, not accusations.')`
          ),
          true
        );
        for (const dark of [false, true]) {
          if (dark) await click('header button[aria-label="Use dark mode"]');
          for (const width of [320, 768, 1440]) {
            await metrics(width, 1000);
            assert.equal(
              await evaluate(`document.documentElement.scrollWidth>innerWidth`),
              false,
              `Security page overflow at ${width}px`
            );
            const content = await evaluate(
              `Array.from(document.querySelectorAll('article,tr')).filter(e=>e.getBoundingClientRect().height>0).map(e=>e.textContent)`
            );
            const pattern = content.filter((text) => text.includes('Possible brute force'));
            assert.equal(
              pattern.length,
              1,
              'Only the repeated-login event gets the qualified pattern label'
            );
            assert(
              pattern[0].includes('Too many login attempts') &&
                pattern[0].includes('shared connection')
            );
            assert(
              content.some(
                (text) => text.includes('Login failed') && text.includes('typing mistake')
              )
            );
          }
        }
        await evaluate(
          `(() => {const e=document.querySelector('#securitydashboard-470');e.value='login_rate_limited';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await wait(
          `window.__qaSecurityRequests.some(q=>q.includes('event_type=login_rate_limited')) && document.querySelectorAll('tbody tr').length===1`
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Security browser: plain-language explanations, qualified repeated-login pattern only, root/subfolder filter wiring, light/dark phone/tablet/desktop with no page overflow. Fixture data, no live writes.'
      );
      return;
    }
    if (useDashboard) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      await send('Page.navigate', {
        url: `http://127.0.0.1:${port}/zangetsu/admin/dashboard?role=Admin`,
      });
      await wait(
        '!!document.querySelector("#dashboard-analytics-mode") && window.__qaAnalyticsRequests.length>0'
      );
      await wait(`window.__qaPendingComments.length>0 &&
        document.querySelector('[aria-label="Analytics report"]').parentElement.textContent.includes('37') &&
        document.querySelector('[aria-label="Analytics report"]').parentElement.textContent.includes('19')`);
      assert(
        await evaluate(
          'document.body.textContent.includes("Daily unique IPs") && document.body.textContent.includes("Counted once across 7 days") && document.querySelector("#dashboard-traffic-counting-note").textContent.includes("selected 7-day period")'
        ),
        'Strict weekly totals and daily chart need distinct labels'
      );
      console.log(
        "PASS Dashboard independence: analytics totals render while the actual component's Comments request is deliberately held unresolved."
      );
      await evaluate(
        `window.__qaHoldComments=false;window.__qaPendingComments.splice(0).forEach(resolve=>resolve())`
      );
      await wait(
        `Array.from(document.querySelectorAll('h3')).some(e=>e.textContent==='Comments'&&e.parentElement.textContent.includes('23'))`
      );
      for (const dark of [false, true]) {
        if (dark) await click('header button[aria-label="Use dark mode"]');
        for (const width of [320, 390, 768, 1024, 1440, 1920]) {
          await metrics(width, 1000);
          const boxes = await evaluate(`(() => {
            const group=document.querySelector('[aria-label="Analytics report filters"]');
            const a=group.querySelector('#dashboard-traffic-range'),b=group.querySelector('#dashboard-analytics-mode');
            const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
            return {a:rect(a),b:rect(b),group:rect(group),sameStyle:getComputedStyle(a).backgroundColor===getComputedStyle(b).backgroundColor,
              labels:[...group.querySelectorAll('label')].map(e=>e.textContent.trim()),overflow:document.documentElement.scrollWidth>innerWidth};
          })()`);
          assert.equal(boxes.a.height, 44, 'Both filters retain touch-friendly height');
          assert.equal(boxes.a.height, boxes.b.height);
          assert.equal(boxes.a.y, boxes.b.y, 'Filters share one baseline');
          assert(boxes.a.right + 8 <= boxes.b.x, 'Filters must not overlap');
          assert(boxes.b.right <= boxes.group.right + 1, 'Mode stays inside its toolbar');
          assert.equal(boxes.sameStyle, true);
          assert.equal(boxes.overflow, false, `No horizontal overflow at ${width}px`);
          if (!dark && [390, 768, 1440].includes(width)) {
            await evaluate(
              'document.querySelector("#dashboard-traffic-counting-note").scrollIntoView({block:"center"})'
            );
            await screenshot('dashboard-filters-' + width);
            await evaluate('window.scrollTo(0,0)');
          }
        }
      }
      await evaluate(
        `(() => {const e=document.querySelector('#dashboard-traffic-range');e.value='30';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
      );
      await wait(
        'window.__qaAnalyticsRequests.some(q=>q.includes("days=30")&&q.includes("mode=strict"))'
      );
      await evaluate(
        `(() => {const e=document.querySelector('#dashboard-analytics-mode');e.value='balanced';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
      );
      await wait(
        'window.__qaAnalyticsRequests.some(q=>q.includes("days=30")&&q.includes("mode=balanced"))'
      );
      assert(
        await evaluate(
          'document.body.textContent.includes("Daily unique browsers") && document.body.textContent.includes("Counted once across 30 days") && document.querySelector("#dashboard-traffic-counting-note").textContent.includes("selected 30-day period")'
        ),
        'Balanced monthly totals must retain the correct unit and scope'
      );
      await evaluate(
        `Array.from(document.querySelectorAll('[aria-label="Analytics report"] button')).find(e=>e.textContent==='Top Articles').click()`
      );
      await wait(
        '!document.querySelector("#dashboard-analytics-mode") && window.__qaAnalyticsRequests.some(q=>q.includes("report=articles")&&q.includes("days=30"))'
      );
      await evaluate(
        `Array.from(document.querySelectorAll('[aria-label="Analytics report"] button')).find(e=>e.textContent==='Visitor Traffic').click()`
      );
      await wait('document.querySelector("#dashboard-analytics-mode")?.value==="balanced"');
      assert.equal(
        await evaluate('document.querySelector("#dashboard-traffic-range").value'),
        '30'
      );
      assert.deepEqual(errors, []);
      console.log(
        'PASS Dashboard browser: actual component/CSS at 320/390/768/1024/1440/1920px, light/dark aligned 44px filters, no page overflow, live 7/30-day and Strict/Balanced state/query wiring, Top Articles mode omission and state restoration; read-only fixture transport, not installed Zangetsu.'
      );
      return;
    }
    if (useCalendar) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const checkCalendarContrast = async (context) => {
        // Admin palette transitions last 300 ms; measure the settled appearance.
        await pause(350);
        const rows = await evaluate(`(() => {
          const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
          const background=element=>{if(!element)return [255,255,255];const c=rgba(getComputedStyle(element).backgroundColor),below=background(element.parentElement);return c.slice(0,3).map((v,i)=>v*c[3]/255+below[i]*(1-c[3]/255));};
          const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
          const names=['New event','Save event','Edit event','Delete event','Cancel','Today','Month','Agenda','All','Events / Agenda','Posts','Pages','Load more','Day details'];
          return [...document.querySelectorAll('section[aria-labelledby="calendar-heading"] button,[role="dialog"] button')].filter(b=>names.includes(b.textContent.trim())&&b.getClientRects().length&&!b.disabled).map(b=>{const fg=rgba(getComputedStyle(b).color),bg=background(b),a=luminance(fg.slice(0,3)),z=luminance(bg);return {label:b.textContent.trim(),ratio:(Math.max(a,z)+.05)/(Math.min(a,z)+.05),color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor};});
        })()`);
        assert(rows.length > 0, 'Calendar color check needs visible controls');
        for (const row of rows)
          assert(
            row.ratio >= 4.5,
            `${context}: ${row.label} contrast ${row.ratio.toFixed(2)} ${JSON.stringify(row)}`
          );
      };
      const fill = async (selector, value) => {
        await evaluate(
          `(() => {const f=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(f instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(f,${JSON.stringify(value)});f.dispatchEvent(new Event('input',{bubbles:true}));})()`
        );
        await pause(100);
      };
      const press = async (text, within = 'section[aria-labelledby="calendar-heading"]') => {
        await evaluate(
          `(() => {const b=Array.from(document.querySelectorAll(${JSON.stringify(within + ' button')})).find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing button '+${JSON.stringify(text)});b.setAttribute('data-qa-calendar-click','true');})()`
        );
        await click('[data-qa-calendar-click="true"]');
        await evaluate(
          'document.querySelector("[data-qa-calendar-click]")?.removeAttribute("data-qa-calendar-click")'
        );
      };
      const ready = () =>
        wait(
          '!!document.querySelector("#calendar-heading") && !document.querySelector("[aria-busy=true]")'
        );
      const createEvent = async () => {
        if (
          await evaluate(
            'document.querySelector("nav button[title=Create]").getAttribute("aria-expanded")==="false"'
          )
        )
          await click('nav button[title=Create]');
        await click('nav a[href$="/admin/calendar?new=event"]');
      };
      const before = calendarFixture.snapshot();
      await metrics(1440, 1000);
      const initialDateCases = [
        ['2026-10-24', '2026-10-25T00:30:00Z', 'Pacific/Honolulu'],
        ['2026-10-31', '2026-11-01T00:30:00Z', 'Pacific/Honolulu'],
        ['2026-12-31', '2027-01-01T00:30:00Z', 'Pacific/Honolulu'],
        ['2026-11-01', '2026-10-31T12:30:00Z', 'Pacific/Kiritimati'],
        ['2027-01-01', '2026-12-31T12:30:00Z', 'Pacific/Kiritimati'],
      ];
      for (const [today, utc, zone] of initialDateCases) {
        for (const brokenIntl of [false, true]) {
          calendarDateProjection = { today, now: `${today} 00:30:00`, timeZone: zone };
          const script = await send('Page.addScriptToEvaluateOnNewDocument', {
            source: `(() => {
              const NativeDate=Date, instant=NativeDate.parse(${JSON.stringify(utc)});
              window.Date=class extends NativeDate {
                constructor(...args){super(...(args.length?args:[instant]));}
                static now(){return instant;}
              };
              if(${brokenIntl}){
                const nativeFormat=Intl.DateTimeFormat;
                Intl.DateTimeFormat=function(locale,...args){
                  if(locale==='en-CA')throw new RangeError('Fixture Intl failure');
                  return new nativeFormat(locale,...args);
                };
              }
            })();`,
          });
          try {
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}/zangetsu/admin/calendar?new=event&zone=${encodeURIComponent(zone)}`,
            });
            await ready();
            await wait('!!document.querySelector("#calendar-event-start")');
            assert.equal(
              await evaluate('document.querySelector("#calendar-event-start").value'),
              `${today}T09:00`,
              `Initial Create uses server today ${today} (${zone}, brokenIntl=${brokenIntl})`
            );
            assert.equal(
              await evaluate(
                'document.querySelector("[data-calendar-day][aria-pressed=true]").dataset.calendarDay'
              ),
              today,
              'Initial Create and selected day agree after reconciliation'
            );
            // Deliberate future navigation must still win over the reconciled default.
            const future = new Date(new Date(`${today}T12:00:00Z`).getTime() + 2 * 86400000)
              .toISOString()
              .slice(0, 10);
            await press('Cancel');
            await fill('#calendar-month', future.slice(0, 7));
            await ready();
            await click(`[data-calendar-day="${future}"]`);
            await createEvent();
            await wait('!!document.querySelector("#calendar-event-start")');
            assert.equal(
              await evaluate('document.querySelector("#calendar-event-start").value.slice(0,10)'),
              future,
              'Query Create preserves deliberate future-date selection'
            );
          } finally {
            await send('Page.removeScriptToEvaluateOnNewDocument', {
              identifier: script.identifier,
            });
            calendarDateProjection = null;
          }
        }
      }
      assert.deepEqual(
        calendarFixture.snapshot(),
        before,
        'Initial-date UI regressions do not write records'
      );
      console.log(
        'PASS Calendar initial Create: actual component, controlled server-date metadata, Intl success/failure, UTC ahead/behind and month/year boundaries; deliberate future navigation preserved.'
      );
      if (useCalendarInitialDate) return;
      await send('Page.navigate', {
        url: `http://127.0.0.1:${port}/zangetsu/admin/calendar?role=Moderator`,
      });
      await ready();
      // New event must be immediately visible in Agenda, without selecting a day.
      await press('Agenda');
      await press('New event');
      await wait('document.activeElement?.id === "calendar-event-title"');
      assert(
        await evaluate(
          'document.querySelector("#calendar-event-title").getBoundingClientRect().top < innerHeight'
        ),
        'Agenda New event scrolls and focuses the visible form'
      );
      await press('Cancel');
      await fill('#calendar-month', '1987-09');
      await ready();
      await press('Month');
      await click('[data-calendar-day="1987-09-15"]');
      assert(
        await evaluate('document.querySelector("section aside button").disabled'),
        'Past day has no enabled contextual New event'
      );
      await press('Agenda');
      await press('New event');
      await ready();
      await wait('document.activeElement?.id === "calendar-event-title"');
      assert.equal(
        await evaluate('document.querySelector("#calendar-event-start").value.slice(0,10)'),
        calendarFixture.request('GET', { from: '2026-10-01', to: '2026-11-01' }).body.today,
        'Global New event clamps historical selection to site today'
      );
      await fill('#calendar-event-start', '1987-09-15T09:00');
      assert(
        await evaluate('document.querySelector("#calendar-event-start").validity.rangeUnderflow'),
        'New event date input rejects a past date'
      );
      acceptDialog = true;
      await press('Cancel');
      acceptDialog = false;
      await press('Month');
      await fill('#calendar-month', '2026-10');
      await ready();
      await checkCalendarContrast('Light Calendar controls');
      await click('button[aria-label="Previous month"]');
      await ready();
      assert.equal(await evaluate('document.querySelector("#calendar-month").value'), '2026-09');
      await click('button[aria-label="Next month"]');
      await ready();
      assert.equal(await evaluate('document.querySelector("#calendar-month").value'), '2026-10');
      await fill('#calendar-month', '2025-12');
      await ready();
      await click('button[aria-label="Next month"]');
      await ready();
      assert.equal(await evaluate('document.querySelector("#calendar-month").value'), '2026-01');
      await press('Today');
      await ready();
      const siteToday = calendarFixture.request('GET', { from: '2026-10-01', to: '2026-11-01' })
        .body.today;
      const nextSiteDay = new Date(new Date(siteToday + 'T12:00:00Z').getTime() + 86400000)
        .toISOString()
        .slice(0, 10);
      assert.equal(
        await evaluate('document.querySelector("#calendar-month").value'),
        siteToday.slice(0, 7)
      );
      assert.equal(
        await evaluate(
          'document.querySelector("[data-calendar-day][aria-pressed=true]").dataset.calendarDay'
        ),
        siteToday
      );
      await fill('#calendar-month', '2026-10');
      await ready();
      const loadedCount = () =>
        evaluate(
          'Number(document.querySelector("section footer").textContent.match(/(\\d+) loaded/)[1])'
        );
      await press('Events / Agenda');
      await ready();
      assert.equal(await loadedCount(), 0);
      assert.equal(await evaluate('document.querySelector("#calendar-author").disabled'), true);
      await press('Posts');
      await ready();
      assert.equal(await loadedCount(), 3);
      await evaluate(
        'document.querySelector("#calendar-author").value="9";document.querySelector("#calendar-author").dispatchEvent(new Event("change",{bubbles:true}));'
      );
      await ready();
      assert.equal(await loadedCount(), 1);
      await evaluate(
        'document.querySelector("#calendar-author").value="";document.querySelector("#calendar-author").dispatchEvent(new Event("change",{bubbles:true}));'
      );
      await ready();
      await press('Pages');
      await ready();
      assert.equal(await loadedCount(), 1);
      await press('All');
      await ready();
      assert.equal(await loadedCount(), 4);
      calendarFault = 'read';
      await click('button[aria-label="Refresh calendar"]');
      await wait('document.body.innerText.includes("Fixture Calendar read failure")');
      assert.equal(
        await evaluate('document.body.innerText.includes("No entries for this day.")'),
        false
      );
      calendarFault = '';
      await press('Retry');
      await ready();
      assert.equal(await loadedCount(), 4);
      assert.equal(await evaluate('document.querySelectorAll("[data-calendar-day]").length'), 42);
      assert.equal(
        await evaluate(`Array.from(document.querySelectorAll('[data-calendar-day]')).every(cell => {
          const offset=cell.firstElementChild.getBoundingClientRect().top-cell.getBoundingClientRect().top;
          return offset>=0 && offset<=12;
        })`),
        true,
        'All calendar dates stay top-aligned in empty and populated cells'
      );
      await click('[data-calendar-day="2026-10-24"]');
      await click('button[aria-label="Details: Published & safe"]');
      assert.equal(
        await evaluate(
          'document.querySelector("a[href*=\\"type=post&id=1\\"]")?.getAttribute("href")'
        ),
        '/zangetsu/admin/editor?type=post&id=1'
      );
      await press('New event');
      await checkCalendarContrast('Light event form');
      const title = 'Calendar UI <img src=x onerror=bad()> café 😀';
      await fill('#calendar-event-title', title);
      await fill('#calendar-event-notes', 'R&D\nAgenda <script>bad()</script>');
      await press('Save event');
      await wait('document.body.innerText.includes("Event saved.")');
      await ready();
      let saved = calendarFixture.snapshot().calendar_events.find((x) => x.title === title);
      assert(saved);
      await click(`[data-calendar-day="${siteToday}"]`);
      await click(`button[aria-label=${JSON.stringify('Details: ' + title)}]`);
      assert.equal(await evaluate('document.querySelector("section img[src=x]")'), null);
      await press('Edit event');
      await fill('#calendar-event-title', 'Calendar rejected update');
      calendarFault = 'audit';
      await press('Save event');
      await wait('!!document.querySelector("form [role=alert],section [role=alert]")');
      assert.equal(
        await evaluate('document.querySelector("#calendar-event-title").value'),
        'Calendar rejected update'
      );
      assert.equal(
        calendarFixture.snapshot().calendar_events.find((x) => x.id === saved.id).title,
        title
      );
      calendarFault = '';
      await press('Save event');
      await wait('document.querySelector("#calendar-event-title")===null');
      await ready();
      saved = calendarFixture.snapshot().calendar_events.find((x) => x.id === saved.id);
      assert.equal(saved.title, 'Calendar rejected update');
      await click('button[aria-label="Details: Calendar rejected update"]');
      await press('Delete event');
      await checkCalendarContrast('Light delete confirmation');
      await press('Cancel', '[aria-label="Delete calendar event"]');
      assert(calendarFixture.snapshot().calendar_events.some((x) => x.id === saved.id));
      await press('Delete event');
      await press('Delete event', '[aria-label="Delete calendar event"]');
      await wait('document.body.innerText.includes("Event deleted.")');
      await ready();
      assert(!calendarFixture.snapshot().calendar_events.some((x) => x.id === saved.id));
      await press('New event');
      await fill('#calendar-event-title', 'All-day R&amp;D');
      await click('#calendar-event-all-day');
      await fill('#calendar-event-start', nextSiteDay);
      await fill('#calendar-event-end', siteToday);
      await press('Save event');
      await wait('!!document.querySelector("section [role=alert]")');
      assert.equal(
        await evaluate('document.querySelector("#calendar-event-start").value'),
        nextSiteDay
      );
      await fill('#calendar-event-start', siteToday);
      await press('Save event');
      await wait('document.querySelector("#calendar-event-title")===null');
      await ready();
      const allDay = calendarFixture
        .snapshot()
        .calendar_events.find((row) => row.title === 'All-day R&amp;D');
      assert.equal(allDay.ends_at, nextSiteDay + ' 00:00:00');
      await click(`[data-calendar-day="${siteToday}"]`);
      await click('button[aria-label="Details: All-day R&amp;D"]');
      await press('Edit event');
      await fill('#calendar-event-title', 'Stale UI change');
      assert.equal(
        calendarFixture.request(
          'POST',
          {},
          {
            id: allDay.id,
            version: 1,
            title: 'Other editor won',
            notes: '',
            allDay: true,
            start: siteToday,
            end: siteToday,
          }
        ).status,
        200
      );
      await press('Save event');
      await wait('document.body.innerText.includes("This event changed or was deleted")');
      assert.equal(
        await evaluate('document.querySelector("#calendar-event-title").value'),
        'Stale UI change'
      );
      acceptDialog = true;
      await press('Cancel');
      acceptDialog = false;
      await click('button[aria-label="Refresh calendar"]');
      await ready();
      await press('Agenda');
      assert.equal(await evaluate('document.querySelectorAll("[data-calendar-day]").length'), 0);
      await press('Posts');
      await ready();
      assert(!(await evaluate('document.body.innerText.includes("Published page")')));
      await press('All');
      await ready();
      await press('Month');
      for (const width of [820, 390]) {
        await metrics(width, 900);
        await checkCalendarContrast('Light responsive Calendar controls');
        if (await evaluate('!!document.querySelector("[aria-label=\\"Calendar details\\"]")'))
          await click('[aria-label="Close calendar panel"]');
        await wait('!document.querySelector("[aria-label=\\"Calendar details\\"]")');
        await press('Day details');
        await wait('!!document.querySelector("[aria-label=\\"Calendar details\\"]")');
        await click('[aria-label="Close calendar panel"]');
        await click(`[data-calendar-day="${siteToday}"]`);
        await wait('!!document.querySelector("[aria-label=\\"Calendar details\\"]")');
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        assert.equal(await evaluate('document.body.style.overflow'), 'hidden');
        assert.equal(
          await evaluate(
            'document.querySelector("[aria-label=\\"Calendar details\\"]").contains(document.activeElement)'
          ),
          true
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
        await wait('!document.querySelector("[aria-label=\\"Calendar details\\"]")');
        assert.notEqual(await evaluate('document.body.style.overflow'), 'hidden');
        await click(`[data-calendar-day="${siteToday}"]`);
        await wait('!!document.querySelector("[aria-label=\\"Calendar details\\"]")');
        await click('[aria-label="Close calendar panel"]');
        assert.equal(
          await evaluate('!!document.querySelector("[aria-label=\\"Calendar details\\"]")'),
          false
        );
      }
      await metrics(1440, 1000);
      await click('button[aria-label="Use dark mode"]');
      await checkCalendarContrast('Dark Calendar controls');
      await metrics(1440, 1200);
      await evaluate('document.querySelector("#calendar-heading").scrollIntoView({block:"start"})');
      await screenshot('calendar-desktop');
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/admin/calendar?role=Admin` });
      await ready();
      await fill('#calendar-month', '2026-10');
      await ready();
      await click('[data-calendar-day="2026-10-24"]');
      await click('button[aria-label="Details: Published & safe"]');
      assert.equal(
        await evaluate(
          'document.querySelector("a[href*=\\"type=post&id=1\\"]")?.getAttribute("href")'
        ),
        '/admin/editor?type=post&id=1'
      );
      if (
        await evaluate(
          'document.querySelector("nav button[title=Create]").getAttribute("aria-expanded")==="false"'
        )
      )
        await click('nav button[title=Create]');
      await createEvent();
      await wait('!!document.querySelector("#calendar-event-title")');
      await fill('#calendar-event-title', 'Unsaved create control');
      acceptDialog = false;
      const beforeCancel = dialogs;
      await createEvent();
      assert.equal(dialogs, beforeCancel + 1);
      assert.equal(
        await evaluate('document.querySelector("#calendar-event-title").value'),
        'Unsaved create control'
      );
      acceptDialog = true;
      await createEvent();
      await wait('document.querySelector("#calendar-event-title").value===""');
      acceptDialog = false;
      await fill('#calendar-event-title', 'Unsaved search Create control');
      await fill('#admin-global-search', 'New Event');
      const beforeSearchCancel = dialogs;
      await click('header a[href="/admin/calendar?new=event"]');
      assert.equal(dialogs, beforeSearchCancel + 1, 'Search Create must ask before discarding');
      assert.equal(
        await evaluate('document.querySelector("#calendar-event-title").value'),
        'Unsaved search Create control'
      );
      acceptDialog = true;
      await click('header a[href="/admin/calendar?new=event"]');
      await wait('document.querySelector("#calendar-event-title").value===""');
      acceptDialog = false;
      for (const rejected of [false, true]) {
        const oldTitle = `Delayed old event ${rejected ? 'rejected' : 'saved'}`;
        const nextTitle = `Current entry after ${rejected ? 'rejection' : 'success'}`;
        await fill('#calendar-event-title', oldTitle);
        calendarFault = rejected ? 'audit' : '';
        await evaluate('window.__calendarHoldWrites=true');
        await press('Save event');
        await wait('window.__calendarPending.length===1');
        acceptDialog = true;
        await createEvent();
        await wait('document.querySelector("#calendar-event-title")?.value===""');
        acceptDialog = false;
        assert.equal(
          await evaluate('document.querySelector("#calendar-event-title").matches(":disabled")'),
          false,
          'An accepted new entry must not inherit the previous pending Save lock'
        );
        await fill('#calendar-event-title', nextTitle);
        calendarFault = '';
        await press('Save event');
        await wait('window.__calendarPending.length===2');
        await evaluate('window.__qaResolveCalendar()');
        await pause(150);
        assert.equal(
          await evaluate('document.querySelector("#calendar-event-title").value'),
          nextTitle
        );
        assert.equal(
          await evaluate('document.querySelector("#calendar-event-title").matches(":disabled")'),
          true,
          'An old response must not unlock the newer pending Save'
        );
        assert.equal(await evaluate('!!document.querySelector("section [role=alert]")'), false);
        await evaluate('window.__qaResolveCalendar()');
        await wait('document.querySelector("#calendar-event-title")===null');
        await ready();
        const persisted = calendarFixture.snapshot().calendar_events;
        assert.equal(
          persisted.some((row) => row.title === oldTitle),
          !rejected
        );
        assert(persisted.some((row) => row.title === nextTitle));
        await evaluate('window.__calendarHoldWrites=false');
        await createEvent();
        await wait('!!document.querySelector("#calendar-event-title")');
      }
      for (const palette of ['charcoal-blue', 'meadow-gold', 'harbour-amber']) {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}/admin/calendar?role=Admin&palette=${palette}`,
        });
        await ready();
        await fill('#calendar-month', siteToday.slice(0, 7));
        await ready();
        for (const dark of [false, true]) {
          if (dark) await click('button[aria-label="Use dark mode"]');
          await checkCalendarContrast(`${palette} ${dark ? 'dark' : 'light'} controls`);
          await press('New event');
          await checkCalendarContrast(`${palette} ${dark ? 'dark' : 'light'} form`);
          await press('Cancel');
          await click('button[aria-label="Details: Other editor won"]');
          await press('Delete event');
          await checkCalendarContrast(`${palette} ${dark ? 'dark' : 'light'} confirmation`);
          await press('Cancel', '[aria-label="Delete calendar event"]');
          await metrics(820, 900);
          await checkCalendarContrast(`${palette} ${dark ? 'dark' : 'light'} Day details`);
          if (await evaluate('!!document.querySelector("[aria-label=\\"Calendar details\\"]")'))
            await click('[aria-label="Close calendar panel"]');
          await wait('!document.querySelector("[aria-label=\\"Calendar details\\"]")');
          await press('Day details');
          await wait('!!document.querySelector("[aria-label=\\"Calendar details\\"]")');
          await checkCalendarContrast(`${palette} ${dark ? 'dark' : 'light'} day drawer`);
          await click('[aria-label="Close calendar panel"]');
          await metrics(1440, 1000);
        }
      }
      calendarFixture.seedPaginationEvents(201);
      await press('Events / Agenda');
      await ready();
      assert.equal(await loadedCount(), 200);
      calendarFault = 'read';
      await press('Load more');
      await wait('document.body.innerText.includes("Fixture Calendar read failure")');
      assert.equal(await loadedCount(), 200);
      calendarFault = '';
      await press('Load more');
      await ready();
      assert.equal(await loadedCount(), calendarFixture.snapshot().calendar_events.length);
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("section button")).some(b=>b.textContent.trim()==="Load more")'
        ),
        false
      );
      await evaluate('window.__qaSetUser({id:"8",role:"Writer",username:"Fixture writer"})');
      await wait('!document.querySelector("#calendar-heading")');
      assert.equal(await evaluate('!!document.querySelector("nav a[title=Calendar]")'), false);
      assert.deepEqual(calendarFixture.snapshot().posts, before.posts);
      assert.deepEqual(calendarFixture.snapshot().pages, before.pages);
      assert.deepEqual(errors, []);
      console.log(
        `PASS Calendar browser: real UI -> real PHP endpoint/service -> ${calendarFixture.useMysql ? 'MySQL' : 'SQLite'}; CRUD, all-day/invalid dates, stale saves, rollback, safe text, projections, all filters, month/year/Today, failed reads/retry, 200+ pagination/retry, root/subfolder links, fresh Create and delayed-response ownership, role revocation, responsive drawers/Escape/scroll unlock, and >=4.5:1 control contrast across three palettes in light/dark mode. Sessions/CSRF use fixture transport.`
      );
      return;
    }
    if (useAdsWorkspace) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const fields = ['Header ad code', 'In-feed ad code', 'Popup ad code'];
      const measure = () =>
        evaluate(`Array.from(document.querySelectorAll('textarea[aria-label$="ad code"]')).map(field=>{
          const box=field.getBoundingClientRect(),cell=field.parentElement.getBoundingClientRect();
          const guide=field.parentElement.nextElementSibling.getBoundingClientRect();
          return {label:field.getAttribute('aria-label'),height:box.height,width:box.width,
            cellHeight:cell.height,guidanceHeight:guide.height,top:box.top,guidanceTop:guide.top,
            left:box.left,right:box.right,resize:getComputedStyle(field).resize};
        })`);
      const cases = [];
      for (const width of [1920, 1440, 820, 390]) {
        await metrics(width, 1000);
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}/zangetsu/admin/settings?owner=1`,
        });
        await wait('window.__qaReady && document.querySelectorAll("textarea").length===3');
        await pause(600);
        const dimensions = await measure();
        assert.deepEqual(
          dimensions.map((item) => item.label),
          fields
        );
        for (const field of dimensions) {
          assert.equal(field.resize, 'vertical');
          assert.ok(field.width > 0 && field.left >= 0 && field.right <= width + 1);
          if (width >= 768) {
            assert.ok(field.height >= 255.9, 'Desktop code workspace has a 256px minimum');
            assert.ok(Math.abs(field.height - field.cellHeight) <= 1);
            assert.ok(Math.abs(field.height - field.guidanceHeight) <= 1);
          } else {
            assert.ok(field.height < 200, 'Phone keeps the compact row-based field height');
            assert.ok(
              field.guidanceTop >= field.top + field.height,
              'Phone guidance stacks below code'
            );
          }
        }
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        if (width >= 1440) {
          assert.ok(
            Math.abs(dimensions[0].width - 612) <= 1,
            'Settings code/help widths stay unchanged'
          );
          assert.ok(Math.abs(dimensions[1].width - 609.33) <= 1);
        }
        cases.push({ width, heights: dimensions.map((item) => Math.round(item.height)) });
        if (width === 1920) await screenshot('ads-desktop');
      }
      await metrics(1440, 1000);
      for (const [index, label] of fields.entries()) {
        const selector = `textarea[aria-label="${label}"]`;
        const code = `<!-- ${label} -->\n<script data-label="A & B">console.log("x<y");</script>\n`;
        await click(selector);
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'a',
          code: 'KeyA',
          windowsVirtualKeyCode: 65,
          modifiers: 2,
        });
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'a',
          code: 'KeyA',
          windowsVirtualKeyCode: 65,
          modifiers: 2,
        });
        await send('Input.insertText', { text: code });
        assert.equal(
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).value`),
          code
        );
        const others = await evaluate(
          `Array.from(document.querySelectorAll('textarea')).map(f=>f.value)`
        );
        if (index < 2)
          assert.equal(
            others[index + 1],
            index === 0 ? '<!-- In-feed sample -->' : '<!-- Popup sample -->'
          );
        const point = await evaluate(`(() => {
          const field=document.querySelector(${JSON.stringify(selector)});
          field.scrollIntoView({block:'center'});
          const box=field.getBoundingClientRect();
          return {x:box.right-4,y:box.bottom-4,height:box.height,width:box.width};
        })()`);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          clickCount: 1,
        });
        for (let step = 1; step <= 4; step++) {
          await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: point.x,
            y: point.y + step * 24,
            button: 'left',
            buttons: 1,
          });
          await pause(16);
          const motion = await evaluate(`(() => {
            const field=document.querySelector(${JSON.stringify(selector)});
            return {height:field.getBoundingClientRect().height,target:parseFloat(field.style.height),
              heightTransition:field.getAnimations().some(a=>a.transitionProperty==='height')};
          })()`);
          assert.ok(Number.isFinite(motion.target), 'Native resize must update an explicit height');
          assert.ok(
            Math.abs(motion.height - motion.target) <= 1 && !motion.heightTransition,
            `${label} must follow native drag immediately, without animating height: ${JSON.stringify(motion)}`
          );
        }
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x,
          y: point.y + 96,
          button: 'left',
          clickCount: 1,
        });
        await pause(400);
        const resized = (await measure())[index];
        assert.ok(
          resized.height > point.height + 40,
          `${label} must grow using its native resize handle`
        );
        assert.ok(
          Math.abs(resized.width - point.width) <= 1,
          'Vertical resize cannot change width'
        );
        assert.equal(
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).value`),
          code
        );
      }
      for (const selector of ['#adsettings-27', '#adsettings-196']) {
        // The actual toggle is visually hidden; its visible switch label receives the click.
        await click(`label:has(${selector})`);
        assert.equal(
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`),
          true
        );
      }
      await evaluate(`(() => {
        const frequency=document.querySelector('#adsettings-112');
        frequency.value='10';frequency.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      assert.equal(await evaluate('document.querySelector("#adsettings-112").value'), '10');
      assert.ok(await evaluate('document.body.innerText.includes("every 10 posts")'));
      await click('button[aria-label="Use dark mode"]');
      await pause(300);
      for (const field of await measure()) {
        assert.ok(field.height >= 255.9 && Math.abs(field.height - field.cellHeight) <= 1);
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Browser Ads workspace: desktop/tablet height, phone stacking, native vertical resize, exact code input and independent controls. ' +
          JSON.stringify(cases)
      );
      return;
    }
    if (useRealEditor) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const title = async (value) => {
        await evaluate(`(() => {
          const field=document.querySelector('#post-title');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});
          field.dispatchEvent(new Event('input',{bubbles:true}));
        })()`);
        await pause(150);
      };
      const open = async (base, type = 'post') => {
        acceptDialog = true;
        await metrics(1440, 1000);
        // Do not mistake the previous document's ready editor for the new hard load.
        await evaluate('window.__qaReady=false');
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/editor?type=${type}`,
        });
        await wait('window.__qaReady && !!document.querySelector("#post-title")');
      };
      const create = async (base, type) => {
        if (
          await evaluate(
            'document.querySelector("nav button[title=Create]").getAttribute("aria-expanded")==="false"'
          )
        )
          await click('nav button[title="Create"]');
        await click(`nav a[href="${base}/admin/editor?type=${type}"]`);
        await wait('document.querySelector("#post-title").value===""');
      };
      const assertProtected = async (expectedTitle, expectedRoute) => {
        const before = dialogs;
        acceptDialog = false;
        await evaluate('document.querySelector("nav a[title=Dashboard]").click()');
        await pause(100);
        assert.equal(dialogs, before + 1, 'new dirty draft must still require confirmation');
        assert.equal(await evaluate('document.querySelector("#post-title")?.value'), expectedTitle);
        assert.equal(
          await evaluate('document.querySelector("#qa-route").textContent'),
          expectedRoute
        );
      };
      for (const base of ['', '/zangetsu']) {
        for (const [autoSave, nextType, reject, leaveEditor] of [
          [false, 'post', false, false],
          [false, 'page', false, false],
          [true, 'post', false, false],
          [false, 'post', true, false],
          [false, 'post', false, true],
        ]) {
          console.log(
            `RUN Real-editor: ${base || '/'} auto=${autoSave} next=${nextType} reject=${reject} unmount=${leaveEditor}`
          );
          await open(base);
          await title('Submitted draft A');
          if (autoSave) await evaluate('window.__qaJumpClock()');
          else
            await evaluate(
              'Array.from(document.querySelectorAll("button")).find(el=>el.textContent.trim()==="Save Draft" && el.offsetParent!==null).click()'
            );
          await wait('window.__qaPending.length===1');
          assert.equal(await evaluate('window.__qaWrites[0].body.title'), 'Submitted draft A');
          acceptDialog = true;
          if (leaveEditor) {
            await evaluate('document.querySelector("nav a[title=Dashboard]").click()');
            await wait('document.querySelector("#qa-route").textContent==="/admin/dashboard"');
          } else {
            await create(base, nextType);
            await title('Unsaved draft B');
          }
          await evaluate(`window.__qaSettle(${reject})`);
          await pause(400);
          if (leaveEditor)
            assert.equal(
              await evaluate('document.querySelector("#qa-route").textContent'),
              '/admin/dashboard'
            );
          else await assertProtected('Unsaved draft B', `/admin/editor?type=${nextType}`);
          if (!reject) {
            assert.equal(
              await evaluate('window.__qaSaved.posts.some(post=>post.title==="Submitted draft A")'),
              true,
              'old successful save must still update its own collection'
            );
          } else assert.equal(await evaluate('window.__qaSaved.posts.length'), 0);
          assert.equal(
            await evaluate('window.__qaWrites.length'),
            1,
            'new draft must not be written by the old response'
          );
        }
        for (const originalType of ['post', 'page']) {
          await open(base, originalType);
          await title('Same-entry manual control');
          await evaluate(
            'Array.from(document.querySelectorAll("button")).find(el=>el.textContent.trim()==="Save Draft" && el.offsetParent!==null).click()'
          );
          await wait('window.__qaPending.length===1');
          await evaluate('window.__qaSettle()');
          await wait(
            `document.querySelector("#qa-route").textContent==="/admin/${originalType === 'page' ? 'pages' : 'posts'}"`
          );
        }
        for (const width of [390, 820]) {
          await open(base);
          await title('Phone/tablet draft');
          await metrics(width, 1000);
          await click('button[aria-label="Open admin navigation"]');
          await click('nav button[title="Create"]');
          acceptDialog = false;
          await click(`nav a[href="${base}/admin/editor?type=post"]`);
          assert.equal(
            await evaluate('document.querySelector("#post-title").value'),
            'Phone/tablet draft'
          );
          assert.equal(await evaluate('document.body.style.overflow'), 'hidden');
          assert.equal(
            await evaluate(
              `document.querySelector('header button[aria-label="Open admin navigation"]').getAttribute('aria-expanded')`
            ),
            'true'
          );
          acceptDialog = true;
          await click(`nav a[href="${base}/admin/editor?type=post"]`);
          await wait(
            'document.querySelector("#post-title").value==="" && document.body.style.overflow===""'
          );
          await wait('document.activeElement.getAttribute("aria-label")==="Open admin navigation"');
          assert.equal(
            await evaluate(
              `document.querySelector('header button[aria-label="Open admin navigation"]').getAttribute('aria-expanded')`
            ),
            'false'
          );
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Real-editor browser: root/subfolder deferred manual/autosave success, rejection, post-to-page, unmount, collection ownership and dirty draft protection; same-entry post/page saves; phone/tablet same-URL Create cancel/accept with focus and scroll-lock release. HTTP is fixture-only, not installed-site persistence.'
      );
      return;
    }
    await metrics(1440, 1000);
    await send('Page.navigate', {
      url: `http://127.0.0.1:${port}/zangetsu/admin/editor?type=post&id=42&owner=1`,
    });
    await wait('window.__qaReady && !!document.querySelector("#qa-editor-title")');
    assert.deepEqual(
      await evaluate(
        `Array.from(document.querySelector('aside nav').children).map(element=>(element.matches('a')?element:element.querySelector(':scope > button'))?.title).filter(Boolean).slice(0,2)`
      ),
      ['Dashboard', 'Create'],
      'Dashboard must lead the sidebar, followed by Create'
    );
    assert.equal(await evaluate('document.querySelectorAll("nav a[title=Dashboard]").length'), 1);
    await checkActiveGroupToggle('Content');
    assert.equal(
      await evaluate('document.querySelector("#qa-editor-title").value'),
      'Existing article'
    );
    await evaluate(
      'const field=document.querySelector("#qa-editor-title");field.value="Unsaved QA";field.dispatchEvent(new Event("input",{bubbles:true}))'
    );
    await click('nav button[title="Create"]');
    await click('nav a[href="/zangetsu/admin/editor?type=page"]');
    assert.equal(dialogs, 1);
    assert.equal(await evaluate('document.querySelector("#qa-editor-title").value'), 'Unsaved QA');
    assert.ok((await evaluate('location.search')).includes('id=42'));
    acceptDialog = true;
    await click('nav a[href="/zangetsu/admin/editor?type=page"]');
    await wait('document.querySelector("#qa-route").textContent==="/admin/editor?type=page"');
    assert.equal(await evaluate('document.querySelector("#qa-editor-title").value'), '');
    assert.equal(await evaluate('document.querySelector("#qa-editor-id").textContent'), '');
    assert.equal(
      await evaluate('document.querySelector("nav a[aria-current=page]").textContent.trim()'),
      'Pages'
    );
    assert.ok(
      await evaluate(
        'document.querySelector("nav button[title=Content]").getAttribute("aria-label").includes("7 posts waiting for review")'
      )
    );
    assert.equal(
      await evaluate(
        'document.querySelector("nav button[title=Create]").getAttribute("aria-expanded")'
      ),
      'false'
    );
    console.log(
      'PASS Browser: real editor wrapper cancels dirty navigation and opens an empty New Page only after confirmation.'
    );
    await evaluate(
      'const sameField=document.querySelector("#qa-editor-title");sameField.value="Same-URL draft";sameField.dispatchEvent(new Event("input",{bubbles:true}))'
    );
    await click('nav button[title="Create"]');
    acceptDialog = false;
    const beforeRepeatedCreate = dialogs;
    await click('nav a[href="/zangetsu/admin/editor?type=page"]');
    assert.equal(dialogs, beforeRepeatedCreate + 1);
    assert.equal(
      await evaluate('document.querySelector("#qa-editor-title").value'),
      'Same-URL draft'
    );
    acceptDialog = true;
    await click('nav a[href="/zangetsu/admin/editor?type=page"]');
    await wait('document.querySelector("#qa-editor-title").value===""');
    assert.equal(
      await evaluate('location.pathname+location.search'),
      '/zangetsu/admin/editor?type=page'
    );
    console.log(
      'PASS Browser: repeated same-URL Create retains a canceled draft and resets it only after confirmation; review badge is preserved.'
    );
    await click('nav button[title="Extensions"]');
    await click('nav a[href="/zangetsu/admin/extensions?tab=plugins"]');
    await wait(`!!document.querySelector('input[aria-label="Search plugins"]')`);
    await checkActiveGroupToggle('Extensions');
    await click('nav button[title="Extensions"]');
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(button=>button.textContent.trim()==="Themes").click()'
    );
    await wait(`!!document.querySelector('input[aria-label="Search themes"]')`);
    assert.equal(
      await evaluate(
        'document.querySelector("nav button[title=Extensions]").getAttribute("aria-expanded")'
      ),
      'true',
      'query-only tab navigation must reopen the relevant group'
    );
    await evaluate('history.back()');
    await wait(`!!document.querySelector('input[aria-label="Search plugins"]')`);
    assert.equal(
      await evaluate('document.querySelector("nav a[aria-current=page]").textContent.trim()'),
      'Plugins'
    );
    await evaluate('history.forward()');
    await wait(`!!document.querySelector('input[aria-label="Search themes"]')`);
    await click('header button[aria-label="Collapse admin navigation"]');
    await pause(350);
    assert.equal(
      await evaluate('Math.round(document.querySelector("aside").getBoundingClientRect().width)'),
      80
    );
    await click('nav button[title="Content"]');
    await pause(350);
    assert.equal(
      await evaluate('Math.round(document.querySelector("aside").getBoundingClientRect().width)'),
      256
    );
    console.log(
      'PASS Browser: actual Extensions tabs, query URLs, browser Back/Forward, and compact desktop expansion.'
    );
    await screenshot('desktop');
    await metrics(820, 1180);
    await click('header button[aria-label="Open admin navigation"]');
    await wait('document.activeElement.getAttribute("aria-label")==="Close admin navigation"');
    await checkActiveGroupToggle('Extensions');
    assert.equal(await evaluate('document.body.style.overflow'), 'hidden');
    await evaluate('document.querySelector("nav button[title=Create]").focus()');
    for (const [key, code, keyCode, expected] of [
      [' ', 'Space', 32, 'true'],
      ['Enter', 'Enter', 13, 'false'],
    ]) {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        text: key === 'Enter' ? '\r' : key,
        unmodifiedText: key === 'Enter' ? '\r' : key,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        windowsVirtualKeyCode: keyCode,
      });
      assert.equal(
        await evaluate(
          'document.querySelector("nav button[title=Create]").getAttribute("aria-expanded")'
        ),
        expected
      );
    }
    await screenshot('tablet');
    await evaluate(
      `document.querySelector('aside button[aria-label="Close admin navigation"]').focus()`
    );
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      modifiers: 8,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      modifiers: 8,
    });
    assert.equal(
      await evaluate('document.querySelector("aside").contains(document.activeElement)'),
      true
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
    await wait(
      `document.querySelector('header button[aria-label="Open admin navigation"]').getAttribute('aria-expanded')==='false'`
    );
    assert.equal(await evaluate('document.body.style.overflow'), '');
    assert.equal(
      await evaluate('document.activeElement.getAttribute("aria-label")'),
      'Open admin navigation'
    );
    await metrics(390, 844);
    await click('header button[aria-label="Open admin navigation"]');
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const touchPoint = await evaluate(
      '(() => {const button=document.querySelector("nav button[title=Create]");button.scrollIntoView();const box=button.getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2}})()'
    );
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(
      'document.querySelector("nav button[title=Create]").getAttribute("aria-expanded")==="true"'
    );
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await screenshot('phone');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    assert.equal(
      await evaluate(
        'Array.from(document.querySelectorAll("nav button,nav a")).filter(x=>x.getClientRects().length).every(x=>x.getBoundingClientRect().height>=44)'
      ),
      true
    );
    await click('nav a[href="/zangetsu/admin/editor?type=post"]');
    await wait('document.querySelector("#qa-route").textContent==="/admin/editor?type=post"');
    assert.equal(
      await evaluate(
        `document.querySelector('header button[aria-label="Open admin navigation"]').getAttribute('aria-expanded')`
      ),
      'false'
    );
    console.log(
      'PASS Browser: tablet Space/Enter disclosure, focus trap/Shift-Tab/Escape restore; phone tap sizes, no overflow, and query-only drawer close.'
    );
    await click('header button[aria-label="Open admin navigation"]');
    await checkActiveGroupToggle('Content');
    await click('aside button[aria-label="Close admin navigation"]');
    console.log(
      'PASS Browser: active Content/Extensions groups toggle by click, Space and Enter on desktop/tablet/phone; current destination remains selected and entering a child route opens its group.'
    );
    await evaluate(
      'window.__qaSetUser({id:"8",role:"Writer",username:"Writer QA",avatar:"data:image/gif;base64,R0lGODlhAQABAAAAACw="})'
    );
    await click('header button[aria-label="Open admin navigation"]');
    assert.equal(await evaluate('!!document.querySelector("nav button[title=Extensions]")'), false);
    assert.equal(
      await evaluate(`!!document.querySelector('nav a[href="/zangetsu/admin/editor?type=page"]')`),
      false
    );
    assert.equal(
      await evaluate(`!!document.querySelector('nav a[href="/zangetsu/admin/gallery"]')`),
      false
    );
    await click('aside button[aria-label="Close admin navigation"]');
    await pause(350);
    await click('header button[aria-label="Use dark mode"]');
    assert.equal(
      await evaluate('document.querySelector(".admin-shell").classList.contains("dark")'),
      true
    );
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/admin/posts?role=Moderator` });
    await wait('window.__qaReady && !!document.querySelector("nav button[title=Content]")');
    await click('header button[aria-label="Open admin navigation"]');
    await click('nav button[title="Create"]');
    assert.ok(await evaluate(`!!document.querySelector('nav a[href="/admin/editor?type=page"]')`));
    assert.equal(await evaluate('!!document.querySelector("nav button[title=Monitoring]")'), false);
    assert.deepEqual(errors, []);
    console.log(
      'PASS Browser: root/subfolder paths, role transitions, dark mode, and no uncaught JavaScript exceptions.'
    );
    const sampleNavigationColor = (selector) =>
      evaluate(`(() => {
      const element=document.querySelector(${JSON.stringify(selector)});
      const style=getComputedStyle(element),canvas=document.createElement('canvas');
      canvas.width=canvas.height=1;const context=canvas.getContext('2d');
      context.fillStyle=getComputedStyle(document.querySelector('aside')).backgroundColor;
      context.fillRect(0,0,1,1);context.fillStyle=style.backgroundColor;context.fillRect(0,0,1,1);
      const background=Array.from(context.getImageData(0,0,1,1).data).slice(0,3);
      context.fillStyle=style.color;context.fillRect(0,0,1,1);
      const foreground=Array.from(context.getImageData(0,0,1,1).data).slice(0,3);
      context.clearRect(0,0,1,1);context.fillStyle=style.backgroundColor;context.fillRect(0,0,1,1);
      const alpha=context.getImageData(0,0,1,1).data[3];
      const luminance=rgb=>rgb.map(value=>{value/=255;return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
      const bg=luminance(background),fg=luminance(foreground);
      return {background,luminance:bg,contrast:(Math.max(bg,fg)+0.05)/(Math.min(bg,fg)+0.05),alpha,border:parseFloat(style.borderTopWidth),shadow:style.boxShadow,blur:style.backdropFilter};
    })()`);
    const hoverNavigation = async (selector) => {
      const point = await evaluate(
        `(() => {const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView();const box=element.getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2}})()`
      );
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await pause(220);
      return sampleNavigationColor(selector);
    };
    const contrastCases = [];
    for (const palette of ['charcoal-blue', 'meadow-gold', 'harbour-amber']) {
      await metrics(1440, 1000);
      await evaluate('window.__qaReady=false');
      await send('Page.navigate', {
        url: `http://127.0.0.1:${port}/admin/posts?role=Admin&palette=${palette}`,
      });
      await wait(
        `window.__qaReady && document.documentElement.dataset.adminPalette===${JSON.stringify(palette)}`
      );
      for (const dark of [false, true]) {
        if (dark) await click('header button[aria-label="Use dark mode"]');
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1436, y: 2 });
        await pause(220);
        const parentSelector = 'nav button[title="Extensions"]';
        const pageSelector = 'nav a[title="Pages"]';
        const createSelector = 'nav button[title="Create"]';
        assert.equal(
          await evaluate(
            `(() => {const style=getComputedStyle(document.querySelector(${JSON.stringify(createSelector)}));const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.fillStyle=style.backgroundColor;context.fillRect(0,0,1,1);return context.getImageData(0,0,1,1).data[3]===255&&style.backdropFilter==='none'&&style.opacity==='1';})()`
          ),
          true,
          'Create must use an opaque solid background without glass blur'
        );
        const createDefault = await sampleNavigationColor(createSelector);
        const createHover = await hoverNavigation(createSelector);
        const normalParent = await sampleNavigationColor(parentSelector);
        const hoverParent = await hoverNavigation(parentSelector);
        const hoverPage = await hoverNavigation(pageSelector);
        await click(parentSelector);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1436, y: 2 });
        await pause(220);
        const openParent = await sampleNavigationColor(parentSelector);
        const active = await sampleNavigationColor('nav a[aria-current="page"]');
        assert(
          hoverParent.luminance > normalParent.luminance + 0.01,
          `${palette}/${dark}: hover should be visibly lighter`
        );
        for (const [state, sample] of Object.entries({
          createDefault,
          createHover,
          normalParent,
          hoverParent,
          hoverPage,
          openParent,
          active,
        })) {
          assert(
            sample.contrast >= 4.5,
            `${palette}/${dark}/${state}: navigation label contrast ${sample.contrast}`
          );
          assert.equal(sample.alpha, 255, `${palette}/${dark}/${state}: opaque fill`);
          assert.equal(sample.border, 0, `${palette}/${dark}/${state}: no decorative border`);
          // Tailwind's shadow-none can resolve to zero-length transparent layers in Chrome.
          const shadowLengths = sample.shadow.match(/-?\d+(?:\.\d+)?px/g) || [];
          assert(
            sample.shadow === 'none' ||
              (shadowLengths.length > 0 &&
                shadowLengths.every((length) => parseFloat(length) === 0)),
            `${palette}/${dark}/${state}: no decorative shadow`
          );
          assert.equal(sample.blur, 'none', `${palette}/${dark}/${state}: no glass blur`);
        }
        assert.notDeepEqual(
          openParent.background,
          normalParent.background,
          'opening an inactive parent must add a solid highlight'
        );
        assert.notDeepEqual(
          openParent.background,
          active.background,
          'parent highlight must differ from the current destination'
        );
        assert.notDeepEqual(
          hoverPage.background,
          active.background,
          'hover must not mimic the current destination'
        );
        contrastCases.push({
          palette,
          dark,
          ratios: Object.fromEntries(
            Object.entries({ hoverParent, hoverPage, openParent, active }).map(([key, value]) => [
              key,
              Number(value.contrast.toFixed(2)),
            ])
          ),
        });
        await click(parentSelector);
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS Browser: sidebar hover/open/current-item distinction and sampled label contrast across all three admin palettes in light/dark mode. ' +
        JSON.stringify(contrastCases)
    );
  } finally {
    await closeBrowser();
    socket?.close();
    if (chrome && chrome.exitCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        chrome.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (chrome && chrome.exitCode === null) {
      chrome.kill();
      await pause(1000);
    }
    if (server) await server.close();
    calendarFixture?.close();
    if (
      path.dirname(profile) === os.tmpdir() &&
      path.basename(profile).startsWith('voncms-navigation-')
    ) {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
    }
  }
}
main().catch((error) => {
  console.error(`FAIL Admin navigation browser: ${error.stack}`);
  process.exitCode = 1;
});
