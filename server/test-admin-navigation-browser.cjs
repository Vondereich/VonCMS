// Isolated UI regression: real navigation/Extensions and editor-route ownership,
// with fixture-only records/transports. Never connects to an installed CMS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const useEditorSpacing = process.argv.includes('--editor-spacing');
const useRealEditor = process.argv.includes('--real-editor') || useEditorSpacing;
const usePluginSelection = process.argv.includes('--plugin-selection');
const useExtensionLifecycle = process.argv.includes('--extensions-lifecycle') || usePluginSelection;
const useAdsWorkspace = process.argv.includes('--ads-workspace');
const useCalendarInitialDate = process.argv.includes('--calendar-initial-date');
const useCalendarSurfaces = process.argv.includes('--calendar-surfaces');
const useCalendar =
  process.argv.includes('--calendar') || useCalendarInitialDate || useCalendarSurfaces;
const useDashboardReports = process.argv.includes('--dashboard-reports');
const useDashboard = process.argv.includes('--dashboard') || useDashboardReports;
const useSecurity = process.argv.includes('--security');
const useAuth = process.argv.includes('--auth');
const useUsers = process.argv.includes('--users');
const useWpBridge = process.argv.includes('--wp-bridge');
const useThemeHooks = process.argv.includes('--theme-hooks');
const useRelatedPosts = process.argv.includes('--related-posts');
const useNativeTracking = process.argv.includes('--native-tracking');
const useDeletePreview = process.argv.includes('--delete-preview');
const useSeoTabs = process.argv.includes('--seo-tabs');
const useNewsSitemap = process.argv.includes('--news-sitemap') || useSeoTabs;
const usePublicSettings = process.argv.includes('--public-settings');
const useWarmActions = process.argv.includes('--warm-actions');
const useAiDisclosure = process.argv.includes('--ai-disclosure');
const useAdminQcFindings = process.argv.includes('--admin-qc-findings');
const useEditActions = process.argv.includes('--edit-actions');
const useTableRowHover = process.argv.includes('--table-row-hover');
const useAdminNeutral =
  process.argv.includes('--admin-neutral') || useWarmActions || useEditActions || useTableRowHover;
const useGallerySpacing = process.argv.includes('--gallery-spacing');
const legacyPublicSettings = usePublicSettings && process.argv.includes('--legacy-public-settings');
const legacyDeletePreview = useDeletePreview && process.argv.includes('--legacy-delete');
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
  let publicSettingsFixture = null;
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
  let wrapper = `
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
    settings.navigation=[];settings.api={};settings._canManageSecrets=params.get('appointed')!=='1';
    window.__adsFixtureSettings=settings;`
        : ''
    }
    const oldPost={id:'42',title:'Existing article',content:'Original',status:'draft',category:'News'};
    const noWrite=()=>{${useDashboard ? 'window.__qaDashboardWrites += 1;' : ''}throw new Error('No fixture writes allowed')};
    ${
      useDashboard
        ? `
    window.__qaAnalyticsRequests=[];
    window.__qaDashboardWrites=0;
    window.__qaDashboardRequests=[];
    settings.timeZone=params.get('zone')||'UTC';
    const dashboardPosts=Array.from({length:params.has('total')?0:6},(_,index)=>({id:String(50+index),title:'Dashboard fixture article '+(index+1),content:'Fixture',status:'published',category:'News',createdAt:'2026-11-08T00:00:00Z'}));
    if(params.has('clock')){
      const NativeDate=window.Date;let fixtureNow=NativeDate.parse(params.get('clock'));
      window.Date=class extends NativeDate{
        constructor(...args){if(args.length)super(...args);else super(fixtureNow);}
        static now(){return fixtureNow;}
      };
      window.__qaSetClock=value=>{fixtureNow=NativeDate.parse(value)};
      const nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
      window.__qaClockTimers=new Set();
      window.setInterval=(callback,delay,...args)=>{const id=nativeSetInterval(callback,delay,...args);if(delay===1000)window.__qaClockTimers.add(id);return id};
      window.clearInterval=id=>{window.__qaClockTimers.delete(id);return nativeClearInterval(id)};
    }
    settings._canManageSecrets=params.get('owner')==='1'||params.get('role')==='Root';
    window.__qaPendingComments=[];
    window.__qaHoldComments=!params.has('total');
    window.fetch=async(input,options={})=>{
      if(options.method && options.method!=='GET')throw new Error('Dashboard fixture forbids writes');
      const url=new URL(input,location.href);
      window.__qaDashboardRequests.push(url.pathname+url.search);
      const result={success:true,posts:[],pages:[],logs:[],users:[],comments:[],meta:{total:Number(params.get('total')||0)},storage:{used:'1 MB'},details:[]};
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
          const scenario=params.get('traffic');
          if(scenario==='empty'||scenario==='repair')result.analytics={...result.analytics,daily:[],totals:{total_views:0,unique_visitors:0},needsRepair:scenario==='repair'};
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
      ${useDashboard ? "window.__qaSetDashboardCollection=mode=>{params.set('collection',mode);setUser(value=>({...value}));};" : ''}
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
      const content=${useSecurity ? "route.pathname==='/admin/security' ? React.createElement(SecurityDashboard,{isPrimaryAdmin:false}) :" : ''} ${useDashboard ? "route.pathname==='/admin/dashboard' ? React.createElement(Dashboard,{posts:dashboardPosts,pages:[],users:[],comments:[],currentUser:user,serverInfo:params.has('php')?{phpVersion:params.get('php')}:undefined,timeZone:settings.timeZone,analyticsMode:params.get('collection')||'strict',analyticsEnabled:params.get('analytics')!=='off',canManageAnalytics:settings._canManageSecrets===true}) :" : ''} ${useCalendar ? "route.pathname==='/admin/calendar' ? React.createElement(ProtectedRoute,{user,allowedRoles:['Admin','Moderator']},React.createElement(CalendarManager,{settings})) :" : ''} ${useAdsWorkspace ? "route.pathname==='/admin/settings' ? React.createElement(SettingsView,{settings,onUpdate:noWrite,notify:noWrite}) :" : ''} route.pathname==='/admin/extensions'
        ? React.createElement(ExtensionsManager,{settings:${useExtensionLifecycle ? 'extensionSettings' : 'settings'},onUpdateSettings:${useExtensionLifecycle ? 'saveExtensionSettings' : 'noWrite'}})
        : route.pathname==='/admin/editor'
          ? React.createElement(Wrapper,{editingItem:${useEditorSpacing ? "params.get('fresh')==='1'?null:oldPost" : 'oldPost'},isPage:${useEditorSpacing ? "params.get('type')==='page'" : 'false'},user,settings,navigation:[],posts:[oldPost],pages:[],handleSaveContent:${useRealEditor ? 'contentState.handleSaveContent' : 'noWrite'},handleUpdateSettings:noWrite})
          : React.createElement('p',{},'Isolated fixture. No installed-site records accessed.');
      return React.createElement(AdminLayout,{settings,user,isDarkMode:dark,toggleDarkMode:()=>setDark(v=>!v),onLogout:noWrite},
        React.createElement('h1',{id:'qa-route',${useAdsWorkspace || useCalendar || useDashboard ? "style:{display:'none'}," : ''}},route.pathname+route.search),content);
    }
    createRoot(document.getElementById('root')).render(
      React.createElement(BrowserRouter,{basename:location.pathname.startsWith('/zangetsu/')?'/zangetsu':undefined},
        React.createElement(ThemeProvider,{},React.createElement(Fixture))));
  `;
  if (useNewsSitemap)
    fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {BrowserRouter} from 'react-router';
    import {VonSEOSettings} from '/src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx';
    import '/src/index.css';
    const base=location.pathname.startsWith('/zangetsu/')?'/zangetsu':'';
    const params=new URLSearchParams(location.search);
    document.documentElement.classList.toggle('dark',params.get('dark')==='1');
    const settings={siteName:'News QA',site_language:'ms-MY',domainUrl:location.origin+base,
      categories:['Berita','Sukan'],seo:{sitemapEnabled:true},theme:{},pluginConfig:{}};
    window.__newsWrites=[];window.__newsAccept=false;window.__newsClosed=0;
    window.fetch=async()=>new Response(JSON.stringify({success:true,robots:'User-agent: *'}),{headers:{'Content-Type':'application/json'}});
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,{},
      React.createElement(VonSEOSettings,{settings,onUpdate:async value=>{window.__newsWrites.push(value);return window.__newsAccept;},onClose:()=>{window.__newsClosed++;}})));
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
  if (useRelatedPosts)
    fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {BrowserRouter,Link,useLocation,useNavigate} from 'react-router';
    import {useRelatedPosts} from '/src/hooks/usePlugins.tsx';
    import '/src/index.css';
    const base=location.pathname.startsWith('/zangetsu/')?'/zangetsu':'';
    const params=new URLSearchParams(location.search);
    const record=(id,fields={})=>({id,title:'Article '+id,slug:'qa-'+id.toLowerCase(),content:'QA',excerpt:'QA excerpt',status:'published',category:'Sports',keywords:'football',publishedAt:'2026-11-02T00:00:00Z',views:0,...fields});
    const articles=['A','B','C','D',...Array.from({length:24},(_,i)=>'E'+i)].map((id,index)=>record(id,{views:index+1}));
    const local=Array.from({length:25},(_,i)=>record('local'+i,{category:'Business'}));
    const settings={siteName:'Related fixture',domainUrl:location.origin+base,permalinkStructure:'slug',timeZone:'UTC',activePlugins:['vp_related_posts'],pluginConfig:{vp_related_posts:{enabled:true,count:Number(params.get('count')||6),orderBy:params.get('sort')||'relevance',layout:'grid',showImage:false,showExcerpt:true,showDate:true,titleText:'Related Posts'}}};
    window.__qaRelatedRequests=[];
    window.fetch=async(input,options={})=>{
      const url=new URL(input,location.href);
      if(url.origin!==location.origin||options.method&&options.method!=='GET')throw new Error('Related fixture forbids writes and external requests');
      if(!url.pathname.endsWith('/api/get_posts.php'))throw new Error('Unexpected Related fixture endpoint');
      window.__qaRelatedRequests.push(url.pathname+url.search);
      const failed=params.get('fault')==='all'||params.get('fault')==='global'&&!url.searchParams.has('category');
      return new Response(JSON.stringify(failed?{error:'Fixture candidate failure'}:{posts:articles.slice(0,Number(url.searchParams.get('limit')))}),{status:failed?503:200,headers:{'Content-Type':'application/json'}});
    };
    function Fixture(){
      const route=useLocation(),navigate=useNavigate();
      const id=route.pathname.split('/').at(-1).replace('qa-','').toUpperCase();
      const selected=articles.find(post=>post.id===id)||null;
      const related=useRelatedPosts(settings,selected,local,post=>navigate('/'+post.slug+route.search));
      return React.createElement('main',{style:{maxWidth:1100,margin:'0 auto',padding:16}},
        React.createElement('h1',{id:'qa-related-title'},selected?.title||'Homepage'),
        React.createElement(Link,{id:'qa-related-entry',to:'/qa-a'+route.search},'Open article A'),related);
    }
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,{basename:base||undefined},React.createElement(Fixture)));
  `;
  let nativeCrawlerMeta = '';
  if (useNativeTracking) {
    const php = require('./lint-php.cjs').findPhpBinary();
    assert.ok(php, 'Native tracking browser regression requires PHP for the real document marker');
    const marker = spawnSync(
      php,
      [
        '-r',
        `
      $_SERVER['HTTP_USER_AGENT']='Mozilla/5.0 (compatible; ExaSearchBot/1.0)';
      require ${JSON.stringify(path.join(root, 'public/api/analytics_consent_helper.php'))};
      echo voncms_tracking_document_meta();
    `,
      ],
      { encoding: 'utf8' }
    );
    assert.equal(marker.status, 0, marker.stderr);
    nativeCrawlerMeta = marker.stdout.trim();
    assert.equal(nativeCrawlerMeta, '<meta name="voncms-tracking" content="excluded">');
    fixture = `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {BrowserRouter,useLocation,useNavigate} from 'react-router';
      import {ThemeProvider} from '/src/plugins/von-core/features/themes/ThemeContext.tsx';
      import PublicSite from '/src/plugins/von-core/features/public/PublicSite.tsx';
      import '/src/index.css';
      const params=new URLSearchParams(location.search),base=location.pathname.startsWith('/zangetsu/')?'/zangetsu':'';
      const article={id:'7',slug:'qa-article',title:'Public QA article',excerpt:'QA excerpt',content:'<p>Public QA content</p>',category:'News',status:'published',author:'qa',publishedAt:'2026-11-04T00:00:00Z'};
      const page={...article,id:'8',slug:'qa-page',title:'Public QA page'};
      const settings={siteName:'Native tracking QA',domainUrl:location.origin+base,postsPerPage:10,activePlugins:['vp_analytics','vp_von_seo'],pluginConfig:{},analytics:{measurementMode:params.get('mode')||'strict',cookieConsent:false},theme:{},navigation:[],sidebarLayout:[],ads:{adsEnabled:false}};
      window.__qaNativeCalls=[];
      window.fetch=async(input,options={})=>{
        const url=new URL(input,location.href);
        if(url.origin!==location.origin)throw new Error('Native tracking fixture forbids external requests');
        if(url.pathname.endsWith('/api/track_monolithic.php')){
          window.__qaNativeCalls.push({path:url.pathname,payload:JSON.parse(options.body)});
          return new Response(JSON.stringify({success:true,visit:true,retry:false,view:true}),{headers:{'Content-Type':'application/json'}});
        }
        if(options.method&&options.method!=='GET')throw new Error('Unexpected native fixture mutation');
        return new Response(JSON.stringify({success:true,csrf_token:'qa-native-tracking-token',posts:[article],pages:[page],comments:[],meta:{total:1}}),{headers:{'Content-Type':'application/json'}});
      };
      const noop=()=>{};
      function Fixture(){
        const route=useLocation(),navigate=useNavigate();
        window.__qaNativeNavigate=path=>navigate(path+route.search);
        const view=route.pathname.endsWith('/article')?'single-post':route.pathname.endsWith('/page')?'page':'home';
        React.useEffect(()=>{window.__qaNativeReady=true},[]);
        return React.createElement(PublicSite,{posts:[article],pages:[page],settings,user:null,comments:[],allUsers:[],currentView:view,selectedPost:view==='single-post'?article:null,selectedPage:view==='page'?page:null,selectedProfile:null,onAddComment:noop,onLikeComment:noop,onReplyComment:noop,onNavigateAdmin:noop,onLogin:noop,onLogout:noop,isDarkMode:false,toggleDarkMode:noop,onPostClick:noop,onViewProfile:noop,onBackToHome:noop});
      }
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,{basename:base||undefined},React.createElement(ThemeProvider,{initialThemeId:'theme-default'},React.createElement(Fixture))));
    `;
  }
  if (usePublicSettings) {
    const keys = {
      'theme-default': 'default',
      'theme-prism': 'prism',
      'theme-techpress': 'techpress',
      'theme-portfolio': 'portfolio',
      'theme-digest': 'digest',
      'theme-corporate-pro': 'corporatePro',
    };
    const saved = {
      _settingsScope: 'admin',
      siteName: 'Public settings QA',
      siteTagline: 'Saved tagline',
      activeThemeId: 'theme-digest',
      theme: {
        primaryColor: '#135790',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '0.5rem',
        customCss: '',
        ...Object.fromEntries(
          Object.values(keys).map((key) => [
            key,
            { title: key, enabled: false, items: [], count: 0, text: '' },
          ])
        ),
      },
      discussionEnabled: false,
      sidebarLayout: [],
      navigation: [],
      activePlugins: [],
      pluginConfig: {},
      ads: { adsEnabled: false, popupEnabled: false, headerAd: 'DORMANT_AD', inFeedFrequency: 0 },
      newsletter: { enabled: false, title: 'DORMANT_NEWSLETTER' },
    };
    const php = require('./lint-php.cjs').findPhpBinary();
    assert.ok(php, 'Public settings browser fixture requires the real PHP projection');
    const projection = spawnSync(
      php,
      [path.join(root, 'server/integration/public-plugin-settings.php'), '--project-json'],
      {
        encoding: 'utf8',
        input: JSON.stringify(
          Object.keys(keys).map((activeThemeId) => ({
            ...saved,
            _settingsScope: 'public',
            activeThemeId,
          }))
        ),
      }
    );
    assert.equal(projection.status, 0, projection.stderr || projection.stdout);
    publicSettingsFixture = { saved, keys, snapshots: JSON.parse(projection.stdout) };
    fixture = `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      const data=await fetch('/__public-settings-data.json').then(response=>response.json());
      const ids=Object.keys(data.keys),themeId=new URLSearchParams(location.search).get('theme');
      const initial=data.snapshots[ids.indexOf(themeId)];
      if(!initial)throw new Error('Unknown public settings fixture theme');
      window.__INITIAL_SETTINGS__=initial;
      const {useSettings}=await import('/src/hooks/useSettings.ts');
      let next=initial;
      window.__settingsWrites=[];
      window.__settingsReads=[];
      window.fetch=async(input,options={})=>{
        const url=new URL(input,location.href);
        if(url.origin!==location.origin)throw new Error('Public settings fixture forbids external requests');
        let body;
        if(url.pathname.endsWith('/api/get_settings.php')){
          window.__settingsReads.push(url.pathname);
          return new Response(JSON.stringify(next),{status:next===null?503:200});
        }
        if(url.pathname.endsWith('/api.php')&&url.searchParams.get('action')==='get_csrf_token')body={csrf_token:'qa-public-settings-token'};
        else if(url.pathname.endsWith('/api/save_settings.php')){
          window.__settingsWrites.push({path:url.pathname,patch:JSON.parse(options.body)});
          body={success:true};
        }else throw new Error('Unexpected public settings fixture request: '+url.pathname);
        return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
      };
      function Fixture(){
        const api=useSettings();
        React.useEffect(()=>{window.__settingsQA={...api,refresh:async(scope,id)=>{
          if(scope==='admin-empty-array'||scope==='admin-empty-object'){
            const empty=scope==='admin-empty-array'?[]:{};
            next={...data.saved,ads:empty,theme:empty,newsletter:empty};
          }else if(scope==='admin-omitted'){
            next={...data.saved};delete next.ads;delete next.theme;
          }else next=scope==='failure'?null:scope==='admin'?data.saved:data.snapshots[ids.indexOf(id)];
          return api.loadSettings(true,scope.startsWith('admin'));
        }}});
        return React.createElement('pre',{id:'qa-settings'},JSON.stringify(api.settings));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    `;
  }
  if (useAdminNeutral) {
    const secondaryWarmActions = [
      [
        'schema-repair',
        'src/plugins/von-core/features/database/DatabaseManager.tsx',
        'handleRepairClick',
      ],
      ['featured-image', 'src/components/editor/EditorBubbleMenus.tsx', 'setAsFeaturedIndex'],
    ].map(([id, file, handler]) => {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      const match = source.match(
        new RegExp('onClick=\\{' + handler + '\\}\\s+className="([^"]+)"')
      );
      assert.ok(match, 'Read actual action classes: ' + id);
      return { id, className: match[1] };
    });
    fixture = `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {BrowserRouter} from 'react-router';
      import {MediaManager} from '/src/plugins/von-core/features/media/MediaManager.tsx';
      import {MediaSettings} from '/src/plugins/von-core/features/settings/components/MediaSettings.tsx';
      import SettingsView from '/src/plugins/von-core/features/settings/SettingsManager.tsx';
      import ContactManager from '/src/pages/admin/ContactManager.tsx';
      import DiscussionManager from '/src/plugins/von-core/features/discussion/DiscussionManager.tsx';
      import AdminModal from '/src/components/admin/AdminModal.tsx';
      import {EditorSurfaceStyles} from '/src/components/editor/EditorSurfaceStyles.tsx';
      import {EDITOR_SURFACE_CLASS} from '/src/components/editor/editorExtensions.ts';
      import '/src/index.css';
      const params=new URLSearchParams(location.search),dark=params.get('dark')==='1';
      document.documentElement.classList.toggle('dark',dark);
      document.documentElement.dataset.adminPalette=params.get('palette')||'charcoal-blue';
      const image={id:'qa-image',name:'Neutral QA image',type:'image',size:'1 KB',uploadedAt:'2026-11-07',url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'};
      const settings={_settingsScope:'admin',_canManageSecrets:true,siteName:'Neutral QA',categories:[],navigation:[],activePlugins:[],pluginConfig:{},theme:{},api:{},ads:{},media:{defaultView:'grid'}};
      const secondaryWarmActions=${JSON.stringify(secondaryWarmActions)};
      window.__neutralWrites=[];
      window.fetch=async(input,options={})=>{
        const url=new URL(input,location.href);
        if(url.origin!==location.origin||(options.method&&options.method!=='GET'))throw new Error('Neutral fixture forbids external requests and writes');
        if(url.pathname.endsWith('/api/get_comments.php')){
          const status=url.searchParams.get('status')||'pending';
          return new Response(JSON.stringify({success:true,comments:[{id:'qa-'+status,postId:'qa-post',username:'QA reader',userAvatar:image.url,content:'Warning action appearance',createdAt:'2026-11-09T12:00:00Z',status}],meta:{page:1,limit:20,total:1,totalPages:1,hasMore:false}}),{headers:{'Content-Type':'application/json'}});
        }
        const body=url.pathname.endsWith('/api/list_media.php')?{success:true,files:[image],currentPage:Number(url.searchParams.get('page')||1),totalPages:3,totalItems:73}:url.pathname.endsWith('/api/contact/get_forms.php')?{success:true,forms:[]}:url.pathname.endsWith('/api/get_settings.php')?settings:url.pathname.endsWith('/api/manage_categories.php')?{success:true,categories:[]}:null;
        if(!body)throw new Error('Unexpected neutral fixture request: '+url.pathname);
        return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
      };
      function SurfaceDialog(){const [open,setOpen]=React.useState(false);return React.createElement(React.Fragment,null,
        React.createElement('button',{id:'qa-open-surface',onClick:()=>setOpen(true)},'Open surface dialog'),
        React.createElement(AdminModal,{isOpen:open,onClose:()=>setOpen(false),ariaLabel:'Surface test dialog',className:'bg-white border border-slate-200 rounded-xl p-6'},
          React.createElement('p',{id:'qa-surface-muted',className:'text-gray-500'},'Muted dialog description'),
          React.createElement('input',{id:'qa-surface-input',className:'bg-slate-50 border border-slate-200 text-slate-500',defaultValue:'Fixture input'}),
          React.createElement('button',{id:'qa-dialog-edit',className:'admin-action-edit p-2 text-blue-600 hover:bg-blue-50 dark:bg-admin-panel dark:text-gray-200 dark:hover:bg-admin-hover-strong/30'},'Edit probe'),
          React.createElement('button',{id:'qa-dialog-delete',className:'admin-action-delete p-2 text-red-600 hover:bg-red-50'},'Delete probe')))}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(React.Fragment,null,
        React.createElement('div',{className:'admin-shell '+(dark?'dark':'')},React.createElement('main',{className:'min-h-screen w-full overflow-auto bg-slate-50 p-6 dark:bg-admin-canvas'},
          React.createElement('section',{id:'qa-gallery'},React.createElement(MediaManager,{settings})),
          React.createElement('section',{id:'qa-media-settings',className:'mt-8'},React.createElement(MediaSettings,{settings,onChange:(...args)=>window.__neutralWrites.push(args)})),
          React.createElement('section',{id:'qa-settings',className:'mt-8'},React.createElement(SettingsView,{settings,onUpdate:(...args)=>window.__neutralWrites.push(args),notify:()=>{}})),
          React.createElement('section',{id:'qa-contact',className:'mt-8'},React.createElement(ContactManager)),
          React.createElement('section',{id:'qa-discussion',className:'mt-8'},React.createElement(DiscussionManager,{comments:[],posts:[],settings,onUpdateCommentStatus:(...args)=>{window.__neutralWrites.push(args);return true},onDeleteComment:(...args)=>window.__neutralWrites.push(args)})),
          React.createElement('section',{id:'qa-warm-actions',className:'mt-8 flex gap-2'},...secondaryWarmActions.map(action=>React.createElement('button',{key:action.id,id:'qa-'+action.id,className:action.className,onClick:()=>window.__neutralWrites.push(action.id)},action.id))),
          React.createElement(SurfaceDialog),React.createElement('button',{id:'qa-surface-hover',className:'bg-white hover:bg-blue-50 border border-slate-200 p-3'},'Surface hover'),React.createElement(EditorSurfaceStyles),
          React.createElement('div',{id:'qa-action-probes',className:'flex gap-2'},
            ...['edit','delete'].map(kind=>React.createElement('button',{key:kind,id:'qa-action-'+kind,className:'admin-action-'+kind+' p-2 text-slate-600 hover:bg-primary-50 dark:text-slate-200 dark:hover:bg-admin-hover'},kind)),
            React.createElement('a',{id:'qa-action-edit-link',href:'#fixture-editor',className:'admin-action-edit border border-zinc-300 bg-zinc-50 p-2 text-zinc-700 hover:bg-zinc-100 dark:border-admin-border dark:bg-admin-canvas dark:text-gray-200 dark:hover:bg-admin-hover'},'Open editor'),
            React.createElement('button',{id:'qa-action-disabled',disabled:true,className:'admin-action-edit admin-action-delete bg-slate-100 p-2 text-slate-400'},'Disabled'),
            React.createElement('button',{id:'qa-action-aria-disabled','aria-disabled':'true',className:'admin-action-edit bg-slate-100 p-2 text-slate-400'},'Unavailable'),
            React.createElement('button',{id:'qa-action-protected',className:'admin-action-edit cursor-not-allowed bg-slate-100 p-2 text-slate-400'},'Protected')),
          React.createElement('div',{className:'editor-content',id:'qa-editor-surfaces'},React.createElement('div',{className:EDITOR_SURFACE_CLASS},
            React.createElement('code',null,'Example'),React.createElement('table',null,React.createElement('tbody',null,React.createElement('tr',null,React.createElement('th',null,'Heading'),React.createElement('td',null,'Cell'))))))
        )),React.createElement('section',{id:'qa-public-surface',className:'bg-white border border-slate-200 text-white'},'Outside admin',
          React.createElement('p',{id:'qa-public-muted',className:'text-gray-500'},'Public muted description'),
          React.createElement('button',{id:'qa-public-edit',className:'admin-action-edit bg-white text-blue-600 hover:bg-blue-50'},'Public edit probe'),
          React.createElement('button',{id:'qa-public-action',className:'admin-action-delete bg-white text-slate-600'},'Public probe'))
      )));
    `;
  }
  if (useAdminQcFindings) {
    fixture = `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {Toaster} from 'react-hot-toast';
      import Newsletter from '/src/plugins/von-core/features/newsletter/NewsletterManager.tsx';
      import {MediaManager} from '/src/plugins/von-core/features/media/MediaManager.tsx';
      import Contact from '/src/pages/admin/ContactManager.tsx';
      import Database from '/src/plugins/von-core/features/database/DatabaseManager.tsx';
      import {PrismSettings} from '/src/plugins/von-core/features/extensions/components/PrismSettings.tsx';
      import {MediaSettings} from '/src/plugins/von-core/features/settings/components/MediaSettings.tsx';
      import '/src/index.css';
      const params=new URLSearchParams(location.search),dark=params.get('dark')==='1',area=params.get('area');
      document.documentElement.classList.toggle('dark',dark);
      document.documentElement.dataset.adminPalette=params.get('palette')||'charcoal-blue';
      const settings={theme:{},_canManageSecrets:true,media:{defaultView:'list'}};
      const stamp='2026-11-10T00:00:00Z';
      const image=(name,id)=>({id,name,path:name,type:'image',size:'1 KB',uploadedAt:stamp,url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'});
      const files=[image('original.png','1')];
      let forms=[{id:'qa-form',title:'QA Contact form',createdAt:stamp}];
      let subscribers=Array.from({length:Number(params.get('count')||21)},(_,i)=>({id:i+1,email:'qa-'+(i+1)+'@example.invalid',status:'active',subscribed_at:stamp,source:'fixture'}));
      const qa=window.__adminQc={reads:[],deletes:[],uploads:[],contactReads:0,deleteOutcome:'ok',uploadOutcomes:[]};
      const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
      window.fetch=async(input,options={})=>{
        const url=new URL(input,location.href),method=options.method||'GET';
        if(url.origin!==location.origin)throw Error('QC fixture forbids remote requests');
        if(url.pathname.endsWith('/api.php')&&url.searchParams.get('action')==='get_csrf_token')return reply({csrf_token:'qc-fixture'});
        if(url.pathname.endsWith('/newsletter_list.php')){
          if(method==='DELETE'){
            const {id}=JSON.parse(options.body);qa.deletes.push(id);
            if(qa.deleteOutcome==='reject')return reply({success:false,message:'Subscriber delete rejected'},400);
            if(qa.deleteOutcome==='hold')await new Promise(resolve=>{qa.releaseDelete=resolve;});
            subscribers=subscribers.filter(sub=>sub.id!==id);return reply({success:true});
          }
          if(method==='GET'){
            const page=Number(url.searchParams.get('page')),status=url.searchParams.get('status'),search=url.searchParams.get('search');
            qa.reads.push([page,status,search]);
            const matches=subscribers.filter(row=>(status==='all'||row.status===status)&&row.email.includes(search));
            if(qa.holdRead){qa.holdRead=false;await new Promise(resolve=>{qa.releaseRead=resolve;});}
            return reply({success:true,subscribers:matches.slice((page-1)*20,page*20),pagination:{total:matches.length,pages:Math.ceil(matches.length/20)}});
          }
        }
        if(url.pathname.endsWith('/list_media.php')&&method==='GET')return reply({success:true,files,currentPage:1,totalPages:1,totalItems:files.length});
        if(url.pathname.endsWith('/upload_file.php')&&method==='POST'){
          const name=options.body.get('file').name;qa.uploads.push(name);
          const outcome=qa.uploadOutcomes.shift();
          if(outcome==='http')return reply({success:false,error:'QA upload rejected'},400);
          if(outcome==='network')throw Error('QA network interruption');
          if(outcome!=='ok')throw Error('Unexpected upload attempt');
          files.push(image(name,String(files.length+1)));return reply({success:true,filename:name});
        }
        if(url.pathname.endsWith('/contact/get_forms.php')&&method==='GET'){qa.contactReads++;return reply({success:true,forms});}
        if(url.pathname.endsWith('/contact/delete_form.php')&&method==='POST'){
          qa.deletes.push(JSON.parse(options.body).id);
          if(qa.deleteOutcome==='http')return reply({success:false,error:'QA contact rejected'},500);
          if(qa.deleteOutcome==='json')return reply({success:false,message:'QA form still in use'});
          if(qa.deleteOutcome==='malformed')return new Response('not JSON',{status:502});
          forms=[];return reply({success:true});
        }
        if(url.pathname.endsWith('/db_query.php')&&method==='POST'){
          const {query}=JSON.parse(options.body);
          return reply({success:true,headers:['QA result'],data:query==='SELECT DATABASE() as name'?[['fixture']]:query==='SHOW TABLES'?[['fixture_rows']]:[[null]]});
        }
        throw Error('Unexpected admin QC request: '+method+' '+url.pathname);
      };
      const noWrite=()=>{throw Error('Unexpected settings action');};
      const views={newsletter:[Newsletter,{settings,onUpdateSettings:noWrite}],gallery:[MediaManager,{settings}],contact:[Contact,{}],database:[Database,{}],prism:[PrismSettings,{settings,onClose:noWrite,onUpdate:noWrite}],media:[MediaSettings,{settings,onChange:noWrite}]};
      const [View,props]=views[area];
      createRoot(document.getElementById('root')).render(React.createElement('div',{className:'admin-shell '+(dark?'dark':'')},React.createElement('main',{className:'min-h-screen bg-slate-50 p-6 dark:bg-admin-canvas'},React.createElement(View,props),React.createElement(Toaster))));
    `;
  }
  if (useAiDisclosure) {
    fixture = `
      import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import AiWritingPanel from '/src/components/editor/AiWritingPanel.tsx';
      import '/src/index.css';
      const dark=new URLSearchParams(location.search).get('dark')==='1';
      document.documentElement.classList.toggle('dark',dark);
      window.__aiCalls=[];window.__aiSubmits=0;
      window.fetch=async()=>{throw Error('AI disclosure fixture forbids API/provider requests')};
      function Fixture(){
        const [mode,setMode]=useState('write'),[prompt,setPrompt]=useState(''),[result,setResult]=useState(null);
        const [generating,setGenerating]=useState(false),[checking,setChecking]=useState(false),[body,setBody]=useState('Original article');
        const [saving,setSaving]=useState(false);
        window.__aiFinish=()=>{setGenerating(false);setChecking(false);setResult({mode,html:'<p>Retained result</p>',plainText:'Retained result',generatedAt:'2026-11-10T00:00:00Z'})};
        window.__aiSetSaving=setSaving;
        const record=name=>window.__aiCalls.push(name);
        return React.createElement('div',{className:'admin-shell '+(dark?'dark':'')},React.createElement('main',{className:'min-h-screen bg-slate-50 p-4 dark:bg-admin-canvas'},
          React.createElement('form',{onSubmit:e=>{e.preventDefault();window.__aiSubmits++}},
            React.createElement('output',{id:'qa-writing-body'},body),
            React.createElement('fieldset',{disabled:saving},React.createElement(AiWritingPanel,{
              title:'Draft title',hasContent:true,activeModel:'gemini-2.5-flash',isSharedModel:true,mode,writePrompt:prompt,pendingResult:result,isGenerating:generating,isChecking:checking,isSaving:saving,
              onModeChange:setMode,onWritePromptChange:setPrompt,
              onGenerate:()=>{record('generate');setGenerating(true)},onCheck:()=>{record('check');setChecking(true)},
              onApplyAppend:()=>{record('append');setBody(value=>value+' '+result.plainText);setResult(null)},
              onApplyReplace:()=>{record('replace');setBody(result.plainText);setResult(null)},onDiscard:()=>{record('discard');setResult(null)}
            })))));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    `;
  }
  let legacyDeleteSource;
  if (useDeletePreview) {
    // Preserve the real route ancestry: Page's permission guard changes wrapper lifetime.
    const appAst = ts.createSourceFile(
      'App.tsx',
      app,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const contentRouteElements = new Map();
    function collectContentRoutes(node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(appAst) === 'Route') {
        const routePath = node.attributes.properties.find(
          (prop) => ts.isJsxAttribute(prop) && prop.name.getText(appAst) === 'path'
        );
        if (
          routePath?.initializer &&
          ts.isStringLiteral(routePath.initializer) &&
          ['posts', 'pages'].includes(routePath.initializer.text)
        ) {
          const element = node.attributes.properties.find(
            (prop) => ts.isJsxAttribute(prop) && prop.name.getText(appAst) === 'element'
          );
          assert.ok(
            element?.initializer &&
              ts.isJsxExpression(element.initializer) &&
              element.initializer.expression
          );
          const source = element.initializer.expression
            .getText(appAst)
            .replaceAll('ContentManagerWrapper', 'Wrapper');
          const code = ts.transpileModule('const element = ' + source + ';', {
            fileName: 'content-route.tsx',
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
              jsx: ts.JsxEmit.React,
            },
          }).outputText;
          const compiled = ts.createSourceFile(
            'content-route.js',
            code,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.JS
          );
          const statement = compiled.statements.find((candidate) =>
            ts.isVariableStatement(candidate)
          );
          const declaration = statement?.declarationList.declarations.find(
            (candidate) => candidate.name.getText(compiled) === 'element'
          );
          assert.ok(
            declaration?.initializer && !contentRouteElements.has(routePath.initializer.text)
          );
          contentRouteElements.set(
            routePath.initializer.text,
            declaration.initializer.getText(compiled)
          );
        }
      }
      ts.forEachChild(node, collectContentRoutes);
    }
    collectContentRoutes(appAst);
    assert.equal(
      contentRouteElements.size,
      2,
      'Both actual App content route elements are required'
    );
    const contentStart = app.indexOf('const ContentManagerWrapper:');
    const contentEnd = app.indexOf('interface PostEditorWrapperProps');
    assert.ok(contentStart > 0 && contentEnd > contentStart);
    wrapper = `
      import React from 'react';
      import {useNavigate} from 'react-router';
      import ContentManager from '/src/plugins/von-core/features/content/ContentManager.tsx';
      import {API} from '/src/config/site.config.ts';
      import {vonFetch} from '/src/utils/api.ts';
      const toast={error:message=>window.__deleteErrors.push(message)};
      ${app.slice(contentStart, contentEnd)}
      export default ContentManagerWrapper;
    `;
    if (legacyDeletePreview) {
      const zip = require('./zip-archive-helper.cjs');
      legacyDeleteSource = zip
        .inflateZipArchive(
          zip.parseZipArchive(fs.readFileSync(path.join(root, 'VonCMS_v1.28.1_Source.zip')))
        )
        .get('src/plugins/von-core/features/content/ContentManager.tsx')
        .toString();
      assert.ok(
        legacyDeleteSource.includes("confirm('Delete this item?')"),
        'Counterfactual requires the preceding ZIP implementation'
      );
    }
    fixture = `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {BrowserRouter,Routes,Route} from 'react-router';
      import {ThemeProvider} from '/src/plugins/von-core/features/themes/ThemeContext.tsx';
      import ProtectedRoute from '/src/components/ProtectedRoute.tsx';
      import {useContent} from '/src/hooks/useContent.ts';
      import Wrapper from '/__navigation-wrapper.tsx';
      import '/src/index.css';
      const base=window.VON_BASE;
      const params=new URLSearchParams(location.search);
      const sample={title:'R&D <img src=x onerror=bad()> - Nur\\'Aini',excerpt:'Text x<y & punctuation. No HTML execution.',slug:'sample-post',author:'QA Writer',createdAt:'2026-11-04T08:00:00Z',updatedAt:'2026-11-04T08:00:00Z'};
      window.__deleteRecords={post:[{...sample,id:'801',status:'published'},{...sample,id:'802',title:'Draft record',status:'draft'},{...sample,id:'803',title:'Scheduled record',status:'scheduled'}],page:[{...sample,id:'901',status:'published'},{...sample,id:'902',title:'Draft page',status:'draft'}]};
      window.__deleteCalls=[];window.__deleteReadCalls=[];window.__deleteReadRequests=[];window.__deleteErrors=[];window.__deleteFailId=null;window.__deleteFault='';window.__deleteHold=false;window.__deleteReleases=[];window.__deleteInvalidations=[];
      window.fetch=async(input,options={})=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
        if(url.origin!==location.origin)throw Error('External request forbidden');
        if(url.pathname===base+'api.php'&&url.searchParams.get('action')==='get_csrf_token')return reply({success:true,csrf_token:'fixture-only-token'});
        const kind=url.pathname.includes('page')?'page':'post';
        if(url.pathname===base+'api/get_posts.php'||url.pathname===base+'api/get_pages.php'){
          window.__deleteReadCalls.push(kind);
          const records=window.__deleteRecords[kind];
          const page=Number(url.searchParams.get('page')||1),limit=20,totalPages=Math.max(1,Math.ceil(records.length/limit));
          window.__deleteReadRequests.push({kind,page});
          return reply({success:true,[kind==='page'?'pages':'posts']:records.slice((page-1)*limit,page*limit),meta:{page,limit,total:records.length,totalPages,hasMore:page<totalPages}});
        }
        if(url.pathname===base+'api/delete_post.php'||url.pathname===base+'api/delete_page.php'){
          const body=JSON.parse(options.body||'{}');
          window.__deleteCalls.push({kind,id:body.id,method:options.method,csrf:options.headers?.['X-CSRF-TOKEN']});
          if(window.__deleteHold)await new Promise(resolve=>window.__deleteReleases.push(resolve));
          if(window.__deleteFault==='network')throw Error('Fixture network failure');
          if(window.__deleteFault==='json')return new Response('invalid-json');
          if(window.__deleteFault==='http')return reply({success:true},503);
          if(window.__deleteFault==='session')return reply({success:false,error:'Fixture expired session'},401);
          if(window.__deleteFailId===body.id)return reply({success:false,error:'Fixture deletion rejected'},403);
          window.__deleteRecords[kind]=window.__deleteRecords[kind].filter(item=>item.id!==body.id);
          return reply({success:true,id:body.id});
        }
        throw Error('Unexpected fixture request '+url.pathname);
      };
      function Fixture(){
        const content=useContent();
        const {posts,pages,setPosts,setPages,contentRefreshKeys}=content;
        const settings={siteName:'Delete preview QA',timeZone:'UTC',navigation:[]};
        const handleEdit=()=>{},onToggleNav=()=>{};
        const invalidateContentLoadCoverage=kind=>{window.__deleteInvalidations.push(kind);content.invalidateContentLoadCoverage(kind)};
        React.useEffect(()=>{window.__deleteRevision=contentRefreshKeys},[contentRefreshKeys]);
        React.useEffect(()=>{document.documentElement.classList.toggle('dark',params.get('dark')==='1');window.__deleteReady=true},[]);
        const user={id:'1',role:params.get('role')||'Admin'};
        return React.createElement(Routes,null,
          React.createElement(Route,{path:'/admin/posts',element:${contentRouteElements.get('posts')}}),
          React.createElement(Route,{path:'/admin/pages',element:${contentRouteElements.get('pages')}}));
      }
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,{basename:base==='/'?undefined:base.slice(0,-1)},React.createElement(ThemeProvider,{},React.createElement(Fixture))));
    `;
  }
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
              legacyPublicSettings &&
              id.replaceAll('\\', '/').endsWith('/src/hooks/useSettings.ts')
            ) {
              const baseline = "data._settingsScope === 'admin' ? prev : DEFAULT_SETTINGS";
              assert.ok(
                code.includes(baseline),
                'Public snapshot baseline is required for the negative control'
              );
              // Restore the old snapshot and nested-group merges only in this negative control.
              return code
                .replace(baseline, 'prev')
                .replace(
                  "Object.hasOwn(data, 'ads') ? DEFAULT_SETTINGS.ads : baseline.ads",
                  'baseline.ads'
                )
                .replace(
                  "Object.hasOwn(data, 'theme') ? DEFAULT_SETTINGS.theme : baseline.theme",
                  'baseline.theme'
                );
            }
            if (
              legacyDeleteSource &&
              id
                .replaceAll('\\', '/')
                .endsWith('/src/plugins/von-core/features/content/ContentManager.tsx')
            )
              return legacyDeleteSource;
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
              if (publicSettingsFixture && req.url === '/__public-settings-data.json') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(publicSettingsFixture));
                return;
              }
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
                !(useAuth && /^\/(?:zangetsu\/)?login(?:\?|$)/.test(req.url || '')) &&
                !(useRelatedPosts && /^\/(?:zangetsu\/)?qa-[a-z0-9-]+(?:\?|$)/.test(req.url || ''))
              )
                return next();
              const html = await vite.transformIndexHtml(
                req.url,
                '<!doctype html><html><head>' +
                  (useNativeTracking &&
                  new URL(req.url, 'http://fixture').searchParams.get('crawler') === '1'
                    ? nativeCrawlerMeta
                    : '') +
                  '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root,.admin-shell{height:100%;margin:0}</style></head><body><div id="root"></div><script>window.VON_BASE=location.pathname.startsWith("/zangetsu/")?"/zangetsu/":"/"</script><script type="module" src="/__navigation-fixture.js"></script></body></html>'
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
    // Keep fixture data separate from JavaScript source, including </script> text.
    const evaluateFunction = async (functionDeclaration, ...values) => {
      const target = await send('Runtime.evaluate', { expression: 'globalThis' });
      assert.ok(target.result.objectId, 'Browser evaluation needs its current context');
      try {
        const result = await send('Runtime.callFunctionOn', {
          objectId: target.result.objectId,
          functionDeclaration,
          arguments: values.map((value) => ({ value })),
          returnByValue: true,
          awaitPromise: true,
          userGesture: true,
        });
        if (result.exceptionDetails)
          throw new Error(
            result.exceptionDetails.exception?.description || result.exceptionDetails.text
          );
        return result.result.value;
      } finally {
        // Navigation can destroy the old context before its handle is released.
        await send('Runtime.releaseObject', { objectId: target.result.objectId }).catch(() => {});
      }
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
      const point = await evaluateFunction(
        `function(selector) {
        const element = document.querySelector(selector);
        element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
        const box = element.getBoundingClientRect();
        return {x:box.x+box.width/2,y:box.y+box.height/2};
      }`,
        selector
      );
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
    const argumentCases = [
      'nav button[title="Create"]',
      "R&D <Test> - Nur'Aini",
      '</script><script>globalThis.__qaArgumentExecuted=true</script>',
      '");globalThis.__qaArgumentExecuted=true;//',
      'quote" slash\\ newline\n\u2028\u2029 emoji \u{1F642}',
    ];
    assert.deepEqual(
      await evaluateFunction('function(value) { return value; }', argumentCases),
      argumentCases,
      'CDP must preserve exact fixture text without parsing it as JavaScript or HTML'
    );
    assert.equal(await evaluate('globalThis.__qaArgumentExecuted'), undefined);
    console.log('PASS CDP argument transport: selectors and hostile/Unicode text remain data.');
    if (useSeoTabs) {
      let cases = 0;
      for (const base of ['', '/zangetsu'])
        for (const dark of [false, true])
          for (const width of [390, 1440]) {
            await metrics(width, 1000);
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}${base}/admin/extensions?dark=${dark ? 1 : 0}`,
            });
            await wait(
              "!![...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Advanced')"
            );
            for (const label of [
              'General SEO',
              'Social Media',
              'Advanced',
              'Redirects',
              'IndexNow',
            ]) {
              await evaluateFunction(
                `function(label){[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===label).click()}`,
                label
              );
              await pause(220);
              if (dark) {
                const contrast = await evaluateFunction(
                  `function(label){
              const names=['General SEO','Social Media','Advanced','Redirects','IndexNow'];
              const buttons=[...document.querySelectorAll('button')].filter(button=>names.includes(button.textContent.trim()));
              const active=buttons.find(button=>button.textContent.trim()===label),idle=buttons.find(button=>button!==active);
              const context=document.createElement('canvas').getContext('2d');
              const rgb=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};
              const luminance=values=>values.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0);
              const surface=item=>{for(let owner=item;owner;owner=owner.parentElement){const color=getComputedStyle(owner).backgroundColor;if(color!=='rgba(0, 0, 0, 0)')return rgb(color);}return [0,0,0]};
              const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
              const background=surface(active);
              return {state:ratio(background,surface(idle)),text:ratio(background,rgb(getComputedStyle(active).color))};
            }`,
                  label
                );
                assert.ok(
                  contrast.state >= 3 && contrast.text >= 4.5,
                  `VonSEO active tab ${label}: ${JSON.stringify(contrast)}`
                );
              }
              assert.equal(await evaluate('window.__newsWrites.length'), 0);
              cases++;
            }
          }
      assert.deepEqual(errors, []);
      console.log(
        `PASS VonSEO tabs: ${cases} actual General/Social/Advanced/Redirects/IndexNow selections, root/subfolder, phone/desktop and light/dark; dark active-state contrast >=3:1 and text >=4.5:1. No saves.`
      );
      return;
    }
    if (useNewsSitemap) {
      const field = (selector, value) =>
        evaluateFunction(
          `function(selector,value){const input=document.querySelector(selector);const proto=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));}`,
          selector,
          value
        );
      const save = () =>
        evaluate(
          "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save SEO Settings').click()"
        );
      for (const base of ['', '/zangetsu']) {
        for (const dark of [false, true]) {
          await metrics(1280, 900);
          await send('Page.navigate', {
            url: `http://127.0.0.1:${port}${base}/admin/extensions?dark=${dark ? 1 : 0}`,
          });
          await wait(
            "!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Advanced')"
          );
          await evaluate(
            "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Advanced').click()"
          );
          await wait("!!document.querySelector('#news-sitemap-enabled')");
          assert.equal(
            await evaluate("document.querySelector('#news-sitemap-enabled').checked"),
            false
          );
          assert.equal(
            await evaluate("document.querySelector('#news-sitemap-language').matches(':disabled')"),
            true
          );
          await click('#news-sitemap-enabled');
          await field('#news-sitemap-scope', 'categories');
          await pause(100);
          await save();
          assert.equal(
            await evaluate('window.__newsWrites.length'),
            0,
            'Empty selection must not save as all categories'
          );
          await evaluate(
            "[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Berita').querySelector('input').click()"
          );
          await field('#news-sitemap-publication', 'Édition & Dunia');
          await field('#news-sitemap-language', 'ms');
          await save();
          await wait('window.__newsWrites.length===1');
          assert.equal(
            await evaluate('window.__newsClosed'),
            0,
            'Rejected save must keep the dialog open'
          );
          assert.equal(
            await evaluate("document.querySelector('#news-sitemap-publication').value"),
            'Édition & Dunia'
          );
          assert.deepEqual(await evaluate('window.__newsWrites[0].seo.newsSitemap'), {
            enabled: true,
            publicationName: 'Édition & Dunia',
            language: 'ms',
            scope: 'categories',
            categories: ['Berita'],
          });
          assert.equal(
            await evaluate(
              "[...document.querySelectorAll('a')].find(a=>a.textContent.includes('View News Sitemap')).getAttribute('href')"
            ),
            `http://127.0.0.1:${port}${base}/sitemap-news.xml`
          );
          await evaluate('window.__newsAccept=true');
          await save();
          await wait('window.__newsClosed===1');
          assert.equal(
            await evaluate('window.__newsWrites.length'),
            2,
            'Retry must save the retained draft'
          );
          await evaluate("document.querySelector('#vonseosettings-374').click()");
          await pause(100);
          assert.equal(
            await evaluate("document.querySelector('#news-sitemap-enabled').matches(':disabled')"),
            true
          );
          assert.equal(
            await evaluate("document.querySelector('#news-sitemap-enabled').checked"),
            true,
            'Master OFF must retain News settings'
          );
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS News settings browser: default OFF, master switch, category validation, Unicode draft, failed-save/retry and root/subfolder feed links in light/dark mode.'
      );
      return;
    }
    if (useAdminQcFindings) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const open = (base, area, params = '') =>
        send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/qa?area=${area}${params}`,
        });
      const press = (selector) =>
        evaluateFunction(
          `function(selector){
          const button=[...document.querySelectorAll(selector)].find(e=>e.getClientRects().length&&!e.disabled);
          if(!button)throw Error('No visible enabled control: '+selector);
          button.click();
        }`,
          selector
        );
      const byText = `function(label){
        const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label&&e.getClientRects().length&&!e.disabled);
        if(!button)throw Error('No visible enabled button: '+label);
        return button;
      }`;
      const pressText = (label) =>
        evaluateFunction(`function(label){(${byText})(label).click();}`, label);
      const visible = (label) => wait(`document.body.innerText.includes(${JSON.stringify(label)})`);
      for (const base of ['', '/zangetsu']) {
        await metrics(base ? 390 : 1440, 1000);
        for (const [count, page, resultPage] of [
          [21, 2, 1],
          [41, 3, 2],
          [45, 2, 2],
          [1, 1, 1],
        ]) {
          await open(base, 'newsletter', `&count=${count}`);
          await visible('Manage newsletter subscriptions');
          await pressText('Subscribers');
          await visible('qa-1@example.invalid');
          await evaluate(`(()=>{
            const input=document.querySelector('[aria-label="Search email..."]');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'@example.invalid');
            input.dispatchEvent(new Event('input',{bubbles:true}));
          })()`);
          await evaluate(
            `(()=>{const e=document.querySelector('select');e.value='active';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
          );
          await wait(`window.__adminQc.reads.some(q=>q[1]==='active'&&q[2]==='@example.invalid')`);
          await visible('qa-1@example.invalid');
          for (let step = 1; step < page; step++) {
            await press('button[title="Next Page"]');
            await visible(`qa-${step * 20 + 1}@example.invalid`);
          }
          await evaluate('window.__adminQc.reads.length=0;window.__adminQc.deleteOutcome="reject"');
          acceptDialog = true;
          await press('.admin-action-delete');
          await visible('Subscriber delete rejected');
          assert.deepEqual(await evaluate('window.__adminQc.reads'), []);
          await visible(`qa-${(page - 1) * 20 + 1}@example.invalid`);
          await evaluate('window.__adminQc.deleteOutcome="ok"');
          await press('.admin-action-delete');
          await visible(
            count === 1
              ? 'No subscribers yet'
              : `qa-${resultPage === page ? (page - 1) * 20 + 2 : (resultPage - 1) * 20 + 1}@example.invalid`
          );
          assert.deepEqual(
            await evaluate('window.__adminQc.reads'),
            (resultPage === page ? [page] : [page, resultPage]).map((p) => [
              p,
              'active',
              '@example.invalid',
            ]),
            'Newsletter must refetch only the valid page with the same filters'
          );
        }
        await open(base, 'newsletter');
        await visible('Manage newsletter subscriptions');
        await pressText('Subscribers');
        await visible('qa-1@example.invalid');
        await evaluate('window.__adminQc.holdRead=true');
        await pressText('Refresh');
        await wait('!!window.__adminQc.releaseRead');
        await evaluate(
          `(()=>{const e=document.querySelector('select');e.value='unsubscribed';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await visible('No subscribers yet');
        await evaluate('window.__adminQc.releaseRead()');
        await pause(150);
        assert.equal(
          await evaluate(`document.body.innerText.includes('qa-1@example.invalid')`),
          false
        );
        await evaluate(
          `(()=>{const e=document.querySelector('select');e.value='active';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await visible('qa-1@example.invalid');
        await evaluate('window.__adminQc.deleteOutcome="hold"');
        await press('.admin-action-delete');
        await wait('!!window.__adminQc.releaseDelete');
        await evaluate(
          `(()=>{const e=document.querySelector('select');e.value='unsubscribed';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await visible('No subscribers yet');
        await evaluate('window.__adminQc.reads.length=0;window.__adminQc.releaseDelete()');
        await wait('window.__adminQc.reads.length===1');
        assert.deepEqual(await evaluate('window.__adminQc.reads'), [[1, 'unsubscribed', '']]);

        await open(base, 'gallery');
        await visible('original.png');
        const selectFiles = (names, outcomes, drop = false) =>
          evaluateFunction(
            `function(batch){
          const input=document.querySelector('input[type=file]'),transfer=new DataTransfer();
          window.__adminQc.uploadOutcomes=batch.outcomes;
          batch.names.forEach(name=>transfer.items.add(new File(['fixture'],name,{type:'image/png'})));
          if(batch.drop)document.querySelector('[class~="lg:grid-cols-4"]').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
          else {input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
          return input.value;
        }`,
            { names, outcomes, drop }
          );
        assert.equal(await selectFiles(['rejected.png'], ['http']), '');
        await visible('QA upload rejected');
        await visible('original.png');
        assert.equal(
          await evaluate(`document.body.innerText.includes('Uploaded: rejected.png')`),
          false
        );
        await selectFiles(['rejected.png', 'accepted.png'], ['network', 'ok'], true);
        await visible('QA network interruption');
        const mediaRow = (name) =>
          wait(
            `[...document.querySelectorAll('main span')].some(e=>e.textContent===${JSON.stringify(name)}&&e.getClientRects().length>0)`
          );
        await mediaRow('accepted.png');
        assert.equal(
          await evaluate(`document.querySelector('[role=alert]').textContent.includes('1 of 2')`),
          true
        );
        await selectFiles(['rejected.png'], ['ok']);
        await mediaRow('rejected.png');
        assert.equal(
          await evaluate(`!!document.querySelector('[aria-label="Dismiss upload error"]')`),
          false
        );
        assert.deepEqual(await evaluate('window.__adminQc.uploads'), [
          'rejected.png',
          'rejected.png',
          'accepted.png',
          'rejected.png',
        ]);

        await open(base, 'contact');
        await visible('QA Contact form');
        acceptDialog = false;
        await press('.admin-action-delete');
        assert.deepEqual(await evaluate('window.__adminQc.deletes'), []);
        acceptDialog = true;
        for (const [outcome, message] of [
          ['http', 'QA contact rejected'],
          ['json', 'QA form still in use'],
          ['malformed', 'Failed to delete form'],
        ]) {
          await evaluateFunction(
            `function(outcome){window.__adminQc.deleteOutcome=outcome;}`,
            outcome
          );
          await press('.admin-action-delete');
          await visible(message);
          await visible('QA Contact form');
          assert.equal(await evaluate('window.__adminQc.contactReads'), 1);
          assert.equal(
            await evaluate(`document.body.innerText.includes('Contact form deleted')`),
            false
          );
        }
        await evaluate('window.__adminQc.deleteOutcome="ok"');
        await press('.admin-action-delete');
        await visible('Contact form deleted');
        await wait(`!document.body.innerText.includes('QA Contact form')`);
        assert.equal(await evaluate('window.__adminQc.contactReads'), 2);
      }
      acceptDialog = false;
      console.log(
        'PASS Admin QC flows: Newsletter last/middle/sole pages, filters and stale reads; Gallery HTTP/network/mixed failure and same-file retry; Contact cancel, rejected/malformed responses and success; root/subfolder fixtures only.'
      );

      const measure = `function({tag,label}){
        const node=[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===label&&e.getClientRects().length);
        if(!node)throw Error('Missing contrast target: '+label);
        const c=document.createElement('canvas');c.width=c.height=1;
        const ctx=c.getContext('2d',{willReadFrequently:true});
        const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
        const blend=(color,bg)=>color.slice(0,3).map((v,i)=>v*color[3]/255+bg[i]*(1-color[3]/255));
        const background=e=>e?blend(rgba(getComputedStyle(e).backgroundColor),background(e.parentElement)):[255,255,255];
        const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        const bg=background(node),a=luminance(blend(rgba(getComputedStyle(node).color),bg)),b=luminance(bg);
        node.scrollIntoView({block:'center',behavior:'instant'});const r=node.getBoundingClientRect();
        return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),x:r.x+r.width/2,y:r.y+r.height/2,hovered:node.matches(':hover')};
      }`;
      let checks = 0;
      for (const [base, width] of [
        ['', 1440],
        ['/zangetsu', 390],
      ]) {
        await metrics(width, 1000);
        for (const dark of [false, true]) {
          for (const [area, palette] of [
            ['database', 'charcoal-blue'],
            ['database', 'meadow-gold'],
            ['database', 'harbour-amber'],
            ['prism', 'charcoal-blue'],
            ['media', 'charcoal-blue'],
          ]) {
            await open(base, area, `&dark=${Number(dark)}&palette=${palette}`);
            if (area === 'database') {
              await visible('READY TO EXECUTE');
              await pressText('Run Query');
              await visible('QA RESULT');
            }
            if (area === 'media') {
              await visible('Media Settings');
              if (width < 640) {
                await evaluate(
                  `(()=>{const e=document.querySelector('#media-settings-section');e.value='tools';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
                );
              } else {
                await pressText('Tools');
              }
            }
            if (area === 'prism') await visible('EXECUTE_SAVE');
            const targets =
              area === 'database'
                ? [
                    ['button', 'Run Query'],
                    ['button', 'Backup'],
                    ['p', 'Ready to execute'],
                    ['th', 'QA result'],
                    ['td span', 'NULL'],
                  ]
                : area === 'prism'
                  ? [
                      ['button', 'EXECUTE_SAVE'],
                      ['p', 'Enable/Disable global glowing effects and animations.'],
                    ]
                  : [
                      'Clean Old Variant Rows',
                      'Preview Generated Variants Only',
                      'Scan Untracked Files',
                    ].map((label) => ['button', label]);
            for (const [tag, label] of targets) {
              await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
              await pause(200);
              const point = await evaluateFunction(measure, { tag, label });
              assert.ok(
                point.ratio >= 4.5,
                `${area}/${palette}/${dark} ${label}: normal ${point.ratio.toFixed(2)}:1`
              );
              checks++;
              if (tag === 'button') {
                await send('Input.dispatchMouseEvent', {
                  type: 'mouseMoved',
                  x: point.x,
                  y: point.y,
                });
                await pause(220);
                const hover = await evaluateFunction(measure, { tag, label });
                assert.ok(
                  hover.hovered,
                  `Pointer did not reach ${area}/${palette}/${dark} ${label}`
                );
                assert.ok(
                  hover.ratio >= 4.5,
                  `${area}/${palette}/${dark} ${label}: hover ${hover.ratio.toFixed(2)}:1`
                );
                checks++;
              }
            }
          }
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS Admin QC contrast: ${checks} actual controls/labels, normal and hover; root/desktop and subfolder/phone, light/dark, three Database palettes. No maintenance actions invoked.`
      );
      return;
    }
    if (useAiDisclosure) {
      const toggle = 'button[aria-controls][aria-expanded]';
      const button = (label) =>
        evaluateFunction(
          `function(label){const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label);if(!button)throw Error('Missing AI action '+label);button.click()}`,
          label
        );
      let cases = 0;
      for (const base of ['', '/zangetsu'])
        for (const width of [320, 1440])
          for (const dark of [false, true]) {
            await metrics(width, 1000);
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}${base}/admin/editor?dark=${dark ? 1 : 0}`,
            });
            await wait('!!document.querySelector("#ai-writing-prompt")');
            assert.equal(
              await evaluate(`!!document.querySelector('${toggle}')`),
              true,
              'AI has a disclosure control'
            );
            const folded = await evaluate(
              `(()=>{const t=document.querySelector('${toggle}'),body=document.getElementById(t.getAttribute('aria-controls'));return {expanded:t.getAttribute('aria-expanded'),hidden:body.hidden,promptVisible:document.querySelector('#ai-writing-prompt').getClientRects().length>0,height:t.closest('section').getBoundingClientRect().height}})()`
            );
            assert.equal(folded.expanded, 'false');
            assert.equal(folded.hidden, true);
            assert.equal(folded.promptVisible, false);
            await evaluate(`document.querySelector('${toggle}').focus()`);
            for (const type of ['keyDown', 'keyUp'])
              await send('Input.dispatchKeyEvent', {
                type,
                key: 'Enter',
                code: 'Enter',
                windowsVirtualKeyCode: 13,
                // Chromium needs the keypress text for native Enter activation.
                text: type === 'keyDown' ? '\r' : undefined,
                unmodifiedText: type === 'keyDown' ? '\r' : undefined,
              });
            await wait(
              `document.querySelector('${toggle}').getAttribute('aria-expanded')==='true'`
            );
            assert.ok(
              (await evaluate(
                `document.querySelector('${toggle}').closest('section').getBoundingClientRect().height`
              )) >
                folded.height + 100
            );
            const prompt = 'R&D <text> - keep my draft';
            await evaluateFunction(
              `function(value){const input=document.querySelector('#ai-writing-prompt');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}`,
              prompt
            );
            await button('Generate Draft');
            await wait('document.body.textContent.includes("Generating Draft...")');
            await click(toggle);
            await evaluate('window.__aiFinish()');
            await wait('document.body.textContent.includes("Retained result")');
            assert.equal(
              await evaluate(`document.querySelector('${toggle}').getAttribute('aria-expanded')`),
              'false'
            );
            assert.equal(
              await evaluate('document.querySelector("#qa-writing-body").textContent'),
              'Original article',
              'A folded result cannot apply itself'
            );
            await click(toggle);
            assert.equal(
              await evaluate('document.querySelector("#ai-writing-prompt").value'),
              prompt
            );
            await button('Append to Article');
            await wait(
              'document.querySelector("#qa-writing-body").textContent==="Original article Retained result"'
            );
            await button('Review Copy');
            await click(toggle);
            await click(toggle);
            assert.ok(
              await evaluate(
                '!![...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="Run Grammar and Style Check"&&e.getClientRects().length)'
              )
            );
            await button('Run Grammar and Style Check');
            await click(toggle);
            await evaluate('window.__aiFinish()');
            await click(toggle);
            await button('Apply Reviewed Copy');
            await wait(
              'document.querySelector("#qa-writing-body").textContent==="Retained result"'
            );
            await button('Write Draft');
            await button('Generate Draft');
            await evaluate('window.__aiFinish()');
            await wait(
              '!![...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="Discard")'
            );
            await button('Discard');
            assert.equal(
              await evaluate('document.querySelector("#ai-writing-prompt").value'),
              prompt
            );
            assert.deepEqual(await evaluate('window.__aiCalls'), [
              'generate',
              'append',
              'check',
              'replace',
              'generate',
              'discard',
            ]);
            assert.equal(
              await evaluate('window.__aiSubmits'),
              0,
              'Disclosure never submits the editor form'
            );
            await evaluate('window.__aiSetSaving(true)');
            await wait(`document.querySelector('${toggle}').matches(':disabled')`);
            await evaluate('window.__aiSetSaving(false)');
            await evaluate(`document.querySelector('${toggle}').focus()`);
            for (const type of ['keyDown', 'keyUp'])
              await send('Input.dispatchKeyEvent', {
                type,
                key: ' ',
                code: 'Space',
                windowsVirtualKeyCode: 32,
                text: type === 'keyDown' ? ' ' : undefined,
                unmodifiedText: type === 'keyDown' ? ' ' : undefined,
              });
            await wait(
              `document.querySelector('${toggle}').getAttribute('aria-expanded')==='false'`
            );
            assert.equal(
              await evaluate('document.documentElement.scrollWidth>innerWidth+1'),
              false
            );
            cases++;
          }
      assert.deepEqual(errors, []);
      console.log(
        `PASS AI disclosure: ${cases} root/subfolder, 320/1440px and light/dark cases; default folded, Enter/Space, prompt/mode retention, completion while folded, explicit append/replace/discard, save guard, no form submits or API/provider requests. Actual AiWritingPanel with controlled parent callbacks.`
      );
      return;
    }
    if (useDeletePreview) {
      let cases = 0;
      const dialog = '[role="dialog"][aria-label="Review content deletion"]';
      const confirm = dialog + ' button:last-child';
      const cancel = dialog + ' button:first-child';
      for (const base of ['', '/zangetsu']) {
        for (const type of ['post', 'page']) {
          for (const width of [390, 768, 1440]) {
            for (const dark of [false, true]) {
              await metrics(width, 900);
              await send('Page.navigate', {
                url: `http://127.0.0.1:${port}${base}/admin/${type === 'post' ? 'posts' : 'pages'}?dark=${dark ? '1' : '0'}`,
              });
              const area = width >= 1024 ? 'table' : 'article';
              const target = area + ` button[aria-label^="Delete ${type}:"]`;
              await wait(
                `window.__deleteReady && !!document.querySelector(${JSON.stringify(target)})`
              );
              await click(target);
              assert.equal(
                await evaluateFunction(
                  'function(selector){return !!document.querySelector(selector)}',
                  dialog
                ),
                true,
                'Delete must open a real preview before any mutation'
              );
              assert.equal(await evaluate('window.__deleteCalls.length'), 0);
              assert.equal(
                await evaluateFunction(
                  'function(selector){return document.querySelector(selector).textContent.includes("R&D <img src=x onerror=bad()> - Nur\'Aini") && !document.querySelector(selector+" img")}',
                  dialog
                ),
                true,
                'Hostile-looking titles stay plain text'
              );
              assert.equal(await evaluate('document.activeElement.textContent'), 'Cancel');
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
                await evaluate('document.activeElement.textContent'),
                'Delete permanently',
                'Focus stays inside the preview'
              );
              assert.equal(
                await evaluateFunction(
                  'function(selector){const el=document.querySelector(selector);const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth}',
                  dialog
                ),
                true,
                'Dialog fits desktop/tablet/phone'
              );
              await click(cancel);
              assert.equal(await evaluate('window.__deleteCalls.length'), 0);
              await click(target);
              await send('Input.dispatchMouseEvent', {
                type: 'mousePressed',
                x: 2,
                y: 2,
                button: 'left',
                clickCount: 1,
              });
              await send('Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x: 2,
                y: 2,
                button: 'left',
                clickCount: 1,
              });
              await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
              assert.equal(
                await evaluate('window.__deleteCalls.length'),
                0,
                'Backdrop dismissal cannot delete'
              );
              await click(target);
              await send('Input.dispatchKeyEvent', {
                type: 'keyDown',
                key: 'Escape',
                code: 'Escape',
                windowsVirtualKeyCode: 27,
              });
              await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
              assert.equal(await evaluate('window.__deleteCalls.length'), 0);
              await click(target);
              if (!base && type === 'post' && width === 390 && !dark)
                await screenshot('delete-preview-phone');
              if (!base && type === 'post' && width === 1440 && dark)
                await screenshot('delete-preview-desktop-dark');
              const readsBeforeDelete = await evaluate('window.__deleteReadCalls.length');
              await click(confirm);
              await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
              await pause(150);
              assert.equal(
                await evaluate('window.__deleteReadCalls.length'),
                readsBeforeDelete + 1,
                'One successful mounted deletion requires exactly one listing refresh'
              );
              const calls = await evaluate('window.__deleteCalls');
              assert.deepEqual(calls, [
                {
                  kind: type,
                  id: type === 'post' ? '801' : '901',
                  method: 'POST',
                  csrf: 'fixture-only-token',
                },
              ]);
              assert.equal(
                await evaluateFunction(
                  'function(kind){return window.__deleteRecords[kind].some(item=>item.id===(kind==="post"?"801":"901"))}',
                  type
                ),
                false
              );
              if (width === 1440 && !dark) {
                await evaluate(
                  'window.__deleteFailId=' + JSON.stringify(type === 'post' ? '803' : '902')
                );
                await click('table thead button');
                await click('button[title="Delete selected items"]');
                const before = await evaluate('window.__deleteCalls.length');
                const readsBeforePartial = await evaluate('window.__deleteReadCalls.length');
                await click(confirm);
                await wait(
                  `!!document.querySelector(${JSON.stringify(dialog + ' [role="alert"]')})`
                );
                assert.equal(
                  await evaluateFunction(
                    'function(selector){return document.querySelector(selector).querySelectorAll("article").length}',
                    dialog
                  ),
                  1,
                  'Partial failure keeps only unconfirmed records'
                );
                assert.equal(
                  await evaluate('window.__deleteCalls.length'),
                  before + (type === 'post' ? 2 : 1)
                );
                await pause(150);
                assert.equal(
                  await evaluate('window.__deleteReadCalls.length'),
                  readsBeforePartial + (type === 'post' ? 1 : 0),
                  'Partial bulk failure refreshes once only when a deletion succeeded'
                );
                await evaluate('window.__deleteFailId=null');
                const readsBeforeRetry = await evaluate('window.__deleteReadCalls.length');
                await click(confirm);
                await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
                await pause(150);
                assert.equal(
                  await evaluate('window.__deleteReadCalls.length'),
                  readsBeforeRetry + 1,
                  'A successful retry has one listing refresh'
                );
                assert.equal(
                  await evaluateFunction(
                    'function(kind){return window.__deleteRecords[kind].length}',
                    type
                  ),
                  0
                );
                assert.deepEqual(
                  await evaluate('window.__deleteCalls.map(call=>call.id)'),
                  type === 'post' ? ['801', '802', '803', '803'] : ['901', '902', '902'],
                  'Retry must not repeat earlier successful deletions'
                );
              }
              if (width === 1440 && dark) {
                await evaluate('window.__deleteHold=true');
                await click('table thead button');
                await click('button[title="Delete selected items"]');
                const before = await evaluate('window.__deleteCalls.length');
                await evaluateFunction(
                  'function(selector){const button=document.querySelector(selector);button.click();button.click()}',
                  confirm
                );
                await wait('window.__deleteReleases.length===1');
                assert.equal(
                  await evaluate('window.__deleteCalls.length'),
                  before + 1,
                  'Synchronous double click sends one request'
                );
                assert.equal(
                  await evaluateFunction(
                    'function(selector){return document.querySelector(selector).disabled}',
                    cancel
                  ),
                  true
                );
                await send('Input.dispatchKeyEvent', {
                  type: 'keyDown',
                  key: 'Escape',
                  code: 'Escape',
                  windowsVirtualKeyCode: 27,
                });
                assert.equal(
                  await evaluateFunction(
                    'function(selector){return !!document.querySelector(selector)}',
                    dialog
                  ),
                  true,
                  'Pending deletion cannot be dismissed as cancelled'
                );
                const other = type === 'post' ? 'page' : 'post';
                await evaluateFunction(
                  'function(url){history.pushState({},"",url);dispatchEvent(new PopStateEvent("popstate"))}',
                  `${base}/admin/${other === 'post' ? 'posts' : 'pages'}`
                );
                const nextTarget = `table button[aria-label^="Delete ${other}:"]`;
                await wait(
                  `!document.querySelector(${JSON.stringify(dialog)}) && !!document.querySelector(${JSON.stringify(nextTarget)})`
                );
                await click(nextTarget);
                await evaluate(
                  'window.__deleteHold=false;window.__deleteReleases.splice(0).forEach(resolve=>resolve())'
                );
                await pause(250);
                assert.equal(
                  await evaluate('window.__deleteCalls.length'),
                  before + 1,
                  'Leaving a bulk operation stops later deletions'
                );
                assert.equal(
                  await evaluateFunction(
                    'function(selector){return document.querySelector(selector)?.textContent.includes("#"+(location.pathname.endsWith("/pages")?"901":"801"))}',
                    dialog
                  ),
                  true,
                  'Earlier completion cannot close or replace a new preview'
                );
                await click(cancel);
              }
              cases++;
            }
          }
        }
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/posts?role=Writer`,
        });
        await wait(
          'window.__deleteReady && !!document.querySelector("table button[aria-label^=\\"Delete post:\\"]")'
        );
        assert.equal(
          await evaluate(
            'Array.from(document.querySelectorAll("table button[aria-label^=\\"Delete post:\\"]")).length'
          ),
          1,
          'Writer retains only draft deletion'
        );
        for (const fault of ['network', 'json', 'http', 'session']) {
          await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/posts` });
          await wait(
            'window.__deleteReady && !!document.querySelector("table button[aria-label^=\\"Delete post:\\"]")'
          );
          await evaluateFunction('function(fault){window.__deleteFault=fault}', fault);
          await click('table button[aria-label^="Delete post:"]');
          await click(confirm);
          await wait(`!!document.querySelector(${JSON.stringify(dialog + ' [role="alert"]')})`);
          assert.equal(
            await evaluate('window.__deleteRecords.post.length'),
            3,
            'Unconfirmed response cannot be treated as successful deletion'
          );
          assert.deepEqual(await evaluate('window.__deleteInvalidations'), []);
          assert.deepEqual(
            await evaluate('window.__deleteRevision'),
            { post: 0, page: 0 },
            'Rejected deletion cannot advance either collection revision'
          );
          await evaluate('window.__deleteFault=""');
          await click(confirm);
          await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
          assert.equal(await evaluate('window.__deleteRecords.post.length'), 2);
          cases++;
        }
        const changeManager = async (kind) => {
          await evaluateFunction(
            'function(url){history.pushState({},"",url);dispatchEvent(new PopStateEvent("popstate"))}',
            `${base}/admin/${kind === 'post' ? 'posts' : 'pages'}`
          );
          await wait(
            '!!document.querySelector(\'table button[aria-label^="Delete ' + kind + ':"]\')'
          );
        };
        for (const kind of ['post', 'page'])
          for (const timing of ['ordinary', 'after-response', 'before-response']) {
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}${base}/admin/${kind === 'post' ? 'posts' : 'pages'}`,
            });
            const target = `table button[aria-label^="Delete ${kind}: R&D"]`;
            await wait(
              `window.__deleteReady && !!document.querySelector(${JSON.stringify(target)})`
            );
            const other = kind === 'post' ? 'page' : 'post';
            const readsBeforeDelete = await evaluateFunction(
              'function(kind){return window.__deleteReadCalls.filter(value=>value===kind).length}',
              kind
            );
            if (timing !== 'ordinary') await evaluate('window.__deleteHold=true');
            await click(target);
            await click(confirm);
            let otherReads;
            if (timing !== 'ordinary') {
              await wait('window.__deleteReleases.length===1');
              await changeManager(other);
              otherReads = await evaluateFunction(
                'function(kind){return window.__deleteReadCalls.filter(value=>value===kind).length}',
                other
              );
              if (timing === 'before-response') {
                await changeManager(kind);
                assert.equal(
                  await evaluateFunction(
                    'function(selector){return !!document.querySelector(selector)}',
                    target
                  ),
                  true,
                  'Return must happen while the record still exists'
                );
              }
              await evaluate(
                'window.__deleteHold=false;window.__deleteReleases.splice(0).forEach(resolve=>resolve())'
              );
            }
            const id = kind === 'post' ? '801' : '901';
            await wait(
              '!window.__deleteRecords[' +
                JSON.stringify(kind) +
                '].some(item=>item.id===' +
                JSON.stringify(id) +
                ')'
            );
            if (timing === 'after-response') {
              await pause(200);
              assert.equal(
                await evaluateFunction(
                  'function(kind){return window.__deleteReadCalls.filter(value=>value===kind).length}',
                  other
                ),
                otherReads,
                'An inactive collection cannot refresh the other manager'
              );
              await changeManager(kind);
            }
            await wait(`!document.querySelector(${JSON.stringify(target)})`);
            await pause(150);
            assert.equal(
              await evaluateFunction(
                'function(kind){return window.__deleteReadCalls.filter(value=>value===kind).length}',
                kind
              ),
              readsBeforeDelete + (timing === 'before-response' ? 2 : 1),
              'Route changes add only the necessary mount and completion reads'
            );
            const calls = await evaluate('window.__deleteCalls');
            assert.equal(calls.length, 1);
            assert.equal(calls[0].kind, kind);
            assert.equal(calls[0].id, id);
            assert.deepEqual(
              await evaluate('window.__deleteRevision'),
              kind === 'post' ? { post: 1, page: 0 } : { post: 0, page: 1 },
              'Only the accepted collection advances its persistent revision'
            );
            cases++;
          }
        // Two unmounted route owners may complete in either order without losing either revision.
        await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/posts` });
        await wait(
          'window.__deleteReady && !!document.querySelector(\'table button[aria-label^="Delete post: R&D"]\')'
        );
        await evaluate('window.__deleteHold=true');
        await click('table button[aria-label^="Delete post: R&D"]');
        await click(confirm);
        await wait('window.__deleteReleases.length===1');
        await changeManager('page');
        await click('table button[aria-label^="Delete page: R&D"]');
        await click(confirm);
        await wait('window.__deleteReleases.length===2');
        await changeManager('post');
        const postReads = await evaluate(
          'window.__deleteReadCalls.filter(kind=>kind==="post").length'
        );
        await evaluate('window.__deleteReleases.splice(1,1)[0]()');
        await wait(
          '!window.__deleteRecords.page.some(item=>item.id==="901") && window.__deleteRevision.page===1'
        );
        assert.equal(
          await evaluate('window.__deleteReadCalls.filter(kind=>kind==="post").length'),
          postReads
        );
        assert.equal(
          await evaluate(
            '!!document.querySelector(\'table button[aria-label^="Delete post: R&D"]\')'
          ),
          true
        );
        await evaluate('window.__deleteHold=false;window.__deleteReleases.shift()()');
        await wait('!document.querySelector(\'table button[aria-label^="Delete post: R&D"]\')');
        assert.deepEqual(await evaluate('window.__deleteCalls.map(({kind,id})=>({kind,id}))'), [
          { kind: 'post', id: '801' },
          { kind: 'page', id: '901' },
        ]);
        assert.deepEqual(await evaluate('window.__deleteRevision'), { post: 1, page: 1 });
        cases++;
        for (const kind of ['post', 'page']) {
          await send('Page.navigate', {
            url: `http://127.0.0.1:${port}${base}/admin/${kind === 'post' ? 'posts' : 'pages'}`,
          });
          await wait('window.__deleteReady && !!document.querySelector("table")');
          const readsBeforeBulk = await evaluate('window.__deleteReadCalls.length');
          await click('table thead button');
          await click('button[title="Delete selected items"]');
          await click(confirm);
          await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
          await pause(150);
          assert.equal(await evaluate('window.__deleteCalls.length'), kind === 'post' ? 3 : 2);
          assert.equal(
            await evaluate('window.__deleteReadCalls.length'),
            readsBeforeBulk + 1,
            'A mounted successful bulk deletion refreshes once, not once per item'
          );
          cases++;

          await send('Page.navigate', {
            url: `http://127.0.0.1:${port}${base}/admin/${kind === 'post' ? 'posts' : 'pages'}`,
          });
          await wait('window.__deleteReady && !!document.querySelector("table")');
          await evaluateFunction(
            'function(kind){window.__deleteRecords[kind]=Array.from({length:22},(_,index)=>({...window.__deleteRecords[kind][0],id:String(1001+index),title:"Paged record "+(index+1)}))}',
            kind
          );
          await changeManager(kind === 'post' ? 'page' : 'post');
          await changeManager(kind);
          await wait('!!document.querySelector("button[title=\\"Next Page\\"]")');
          await click('button[title="Next Page"]');
          const pagedTarget = (number) =>
            `table button[aria-label="Delete ${kind}: Paged record ${number}"]`;
          await wait(`!!document.querySelector(${JSON.stringify(pagedTarget(21))})`);
          const readsBeforeFirst = await evaluate('window.__deleteReadRequests.length');
          await click(pagedTarget(21));
          await click(confirm);
          await wait(`!document.querySelector(${JSON.stringify(dialog)})`);
          await wait(`!!document.querySelector(${JSON.stringify(pagedTarget(22))})`);
          await pause(150);
          assert.deepEqual(
            await evaluate(`window.__deleteReadRequests.slice(${readsBeforeFirst})`),
            [{ kind, page: 2 }],
            'One refresh retains a later page that still contains a row'
          );
          assert.equal(
            await evaluateFunction(
              'function(selector){return !!document.querySelector(selector)}',
              pagedTarget(1)
            ),
            false,
            'A deletion refresh keeps the current page when it still exists'
          );
          const readsBeforeLast = await evaluate('window.__deleteReadRequests.length');
          await click(pagedTarget(22));
          await click(confirm);
          await wait(
            `!document.querySelector(${JSON.stringify(dialog)}) && !!document.querySelector(${JSON.stringify(pagedTarget(1))})`
          );
          await pause(150);
          assert.deepEqual(
            await evaluate(`window.__deleteReadRequests.slice(${readsBeforeLast})`),
            [{ kind, page: 1 }],
            'Last-row deletion refreshes only the preceding page, not an out-of-range page'
          );
          assert.equal(
            await evaluate('document.querySelectorAll("table tbody tr").length'),
            20,
            'Deleting the last item returns to an existing page'
          );
          cases++;
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Content deletion preview browser: ' +
          cases +
          ' root/subfolder, Post/Page, light/dark and phone/tablet/desktop cases; actual App route elements/guards, content hook and callback, plain-text preview, focus/cancel/Escape/backdrop, exact endpoint, CSRF transport, partial-failure retry, double-click and real route unmount/remount. Single/bulk operations use one settled-list refresh; both collections retain or fall back from later pages without redundant reads. Timing controls and out-of-order completions preserve per-type revisions. Writer draft-only UI retained. Fixture responses only; no installed data deleted.'
      );
      return;
    }
    if (useAdminNeutral) {
      const sample = () =>
        evaluate(`(()=>{
          const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
          const context=canvas.getContext('2d');
          const rgb=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};
          const background=item=>{
            for(let owner=item;owner;owner=owner.parentElement){
              context.clearRect(0,0,1,1);context.fillStyle=getComputedStyle(owner).backgroundColor;context.fillRect(0,0,1,1);
              const rgba=[...context.getImageData(0,0,1,1).data];if(rgba[3]===255)return rgba.slice(0,3);
            }
            return [255,255,255];
          };
          const contactMuted=[document.querySelector('#qa-contact h1+p'),...[...document.querySelectorAll('#qa-contact div,#qa-contact td')].filter(item=>item.children.length===0 && item.getClientRects().length && item.textContent.trim()==='No contact forms found. Create one to get started.')];
          const button=(root,text)=>[...document.querySelectorAll(root+' button')].find(item=>item.textContent.trim()===text);
          const upload=button('#qa-gallery','Upload Media'),reference=button('#qa-contact','Add New');
          const tab=button('#qa-media-settings','Optimization')||button('#qa-media-settings','Image Gallery');
          const card=document.querySelector('#qa-gallery img[alt="Neutral QA image"]')?.closest('.group');
          const row=document.querySelector('#qa-gallery tbody tr');
          const previous=document.querySelector('#qa-gallery button[title="Previous Page"]');
          const pagination=previous.parentElement.parentElement;
          const pages=[...pagination.querySelectorAll('button')].filter(button=>/^\\d+$/.test(button.textContent.trim()));
          const active=pages.find(button=>button.classList.contains('bg-primary-600')),idle=pages.find(button=>button!==active);
          return {
            upload:rgb(getComputedStyle(upload).backgroundColor),uploadText:rgb(getComputedStyle(upload).color),
            reference:rgb(getComputedStyle(reference).backgroundColor),
            description:rgb(getComputedStyle(document.querySelector('#qa-gallery h2+p')).color),
            tabText:rgb(getComputedStyle(tab).color),tabBorder:rgb(getComputedStyle(tab).borderBottomColor),
            selectedBorder:card?rgb(getComputedStyle(card).borderTopColor):null,
            rowBackground:row?rgb(getComputedStyle(row).backgroundColor):null,
            paginationBorder:rgb(getComputedStyle(pagination).borderTopColor),
            paginationText:rgb(getComputedStyle(pagination.firstElementChild).color),
            pageActive:rgb(getComputedStyle(active).backgroundColor),pageActiveText:rgb(getComputedStyle(active).color),pageIdle:rgb(getComputedStyle(idle).backgroundColor),
            pageBorder:rgb(getComputedStyle(idle).borderTopColor),
            galleryGap:pagination.getBoundingClientRect().top-pagination.previousElementSibling.getBoundingClientRect().bottom,
            contactMuted:contactMuted.map(item=>({text:item.textContent.trim(),color:rgb(getComputedStyle(item).color),background:background(item)})),
            publicMuted:rgb(getComputedStyle(document.querySelector('#qa-public-muted')).color),
            grayToken:getComputedStyle(document.querySelector('.admin-shell > main')).getPropertyValue('--color-gray-500').trim(),
            rootGrayToken:getComputedStyle(document.documentElement).getPropertyValue('--color-gray-500').trim(),
            writes:window.__neutralWrites.length
          };
        })()`);
      const neutral = (rgb, label) =>
        assert.ok(Math.max(...rgb) - Math.min(...rgb) <= 24, label + ': neutral dark tone ' + rgb);
      const ratio = (a, b) => {
        const light = (values) =>
          values
            .map((value) => {
              value /= 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        return (Math.max(light(a), light(b)) + 0.05) / (Math.min(light(a), light(b)) + 0.05);
      };
      const checkAction = async (selector, kind, dark, focus = false) => {
        const point = await evaluateFunction(
          `function(selector) {
          const button=document.querySelector(selector);button.scrollIntoView({block:'center'});
          const r=button.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
        }`,
          selector
        );
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        if (focus) {
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
          for (const type of ['keyDown', 'keyUp'])
            await send('Input.dispatchKeyEvent', {
              type,
              key: 'Tab',
              code: 'Tab',
              windowsVirtualKeyCode: 9,
            });
          await evaluateFunction(
            'function(selector){document.querySelector(selector).focus()}',
            selector
          );
        }
        await pause(250);
        const state = await evaluateFunction(
          `function(selector) {
          const button=document.querySelector(selector),previousTransition=button.style.transition;
          button.style.transition='none';const style=getComputedStyle(button);
          const read=()=>({bg:style.backgroundColor,color:style.color});const actual=read();
          const outline={outlineColor:style.outlineColor,outlineWidth:style.outlineWidth,outlineOffset:style.outlineOffset,shadow:style.boxShadow};
          const markers=[...button.classList].filter(c=>c.startsWith('admin-action-'));
          button.classList.remove(...markers);const without=read();button.classList.add(...markers);
          button.style.transition=previousTransition;
          return {actual,without,...outline,focusVisible:button.matches(':focus-visible')};
        }`,
          selector
        );
        if (focus) assert.equal(state.focusVisible, true, 'Keyboard focus is visible: ' + selector);
        if (focus && kind === 'edit') {
          assert.equal(state.outlineWidth, '2px');
          assert.equal(state.outlineOffset, '2px');
          assert.equal(state.outlineColor, dark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)');
        }
        if (kind === 'edit') {
          assert.ok(
            state.shadow.includes('inset') && state.shadow.includes('1px'),
            'Edit hover has a visible boundary without layout changes'
          );
          assert.ok(
            ratio(
              dark ? [156, 163, 175] : [107, 114, 128],
              dark ? [32, 33, 36] : [253, 253, 253]
            ) >= 3,
            'Neutral boundary is distinct from its panel'
          );
        }
        if (kind === 'edit' || (!dark && kind)) {
          const background = kind === 'edit' ? (dark ? [69, 69, 77] : [48, 52, 59]) : [185, 28, 28];
          assert.equal(state.actual.bg, `rgb(${background.join(', ')})`, selector);
          assert.equal(state.actual.color, 'rgb(255, 255, 255)', selector);
          assert.notDeepEqual(
            state.actual,
            state.without,
            'Removing the marker restores the per-component state'
          );
          assert.ok(ratio([255, 255, 255], background) >= 4.5);
        } else
          assert.deepEqual(
            state.actual,
            state.without,
            'Unchanged Delete/disabled/protected/public controls: ' + selector
          );
        await evaluateFunction(
          'function(selector){document.querySelector(selector).blur()}',
          selector
        );
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
      };
      const checkIdleEdit = async (selector, dark, enabled = true) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
        const state = await evaluateFunction(
          `function(selector){
            const button=document.querySelector(selector);button.blur();button.style.transition='none';
            const read=()=>getComputedStyle(button).color,actual=read();
            button.classList.remove('admin-action-edit');const without=read();button.classList.add('admin-action-edit');
            button.style.transition='';return {actual,without};
          }`,
          selector
        );
        if (enabled)
          assert.equal(state.actual, dark ? 'rgb(229, 231, 235)' : 'rgb(55, 65, 81)', selector);
        else
          assert.equal(
            state.actual,
            state.without,
            'Inactive/public Edit is unchanged: ' + selector
          );
      };
      const checkWarning = async (
        focus,
        selector = '#qa-discussion button[title="Mark as Spam"]'
      ) => {
        await wait(`!!document.querySelector('${selector}')`);
        const point = await evaluateFunction(
          `function(selector){const button=document.querySelector(selector);button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}`,
          selector
        );
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        if (focus) {
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
          for (const type of ['keyDown', 'keyUp'])
            await send('Input.dispatchKeyEvent', {
              type,
              key: 'Tab',
              code: 'Tab',
              windowsVirtualKeyCode: 9,
            });
          await evaluateFunction(
            'function(selector){document.querySelector(selector).focus()}',
            selector
          );
        }
        await pause(250);
        const state = await evaluateFunction(
          `function(selector){
            const button=document.querySelector(selector),style=getComputedStyle(button),canvas=document.createElement('canvas'),context=canvas.getContext('2d');
            const rgba=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);const values=[...context.getImageData(0,0,1,1).data];values[3]/=255;return values};
            let background=[0,0,0,0];
            for(let owner=button;owner;owner=owner.parentElement){
              const layer=rgba(getComputedStyle(owner).backgroundColor),alpha=background[3]+layer[3]*(1-background[3]);
              if(alpha)background=[...background.slice(0,3).map((value,i)=>(value*background[3]+layer[i]*layer[3]*(1-background[3]))/alpha),alpha];
              if(alpha===1)break;
            }
            return {background:background.slice(0,3).map(Math.round),color:rgba(style.color).slice(0,3),dark:!!button.closest('.dark'),focused:button.matches(':focus-visible'),hovered:button.matches(':hover')};
          }`,
          selector
        );
        assert.equal(
          focus ? state.focused : state.hovered,
          true,
          'Warning action state is exercised'
        );
        if (state.dark) {
          assert.ok(Math.max(...state.background) < 110, 'Dark warning hover stays subdued');
          assert.ok(
            state.color[1] > state.color[2] + 45,
            'The dark warning icon stays golden, not white'
          );
        } else {
          assert.ok(
            state.background[0] >= 200 && state.background[1] >= 170 && state.background[2] < 200,
            'Warning hover is amber/gold, not brick red'
          );
          assert.ok(Math.max(...state.color) < 130, 'Light warning text is dark and readable');
        }
        assert.ok(ratio(state.color, state.background) >= 4.5, 'Warning action contrast');
        await evaluateFunction(
          'function(selector){document.querySelector(selector).blur()}',
          selector
        );
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
      };
      let cases = 0;
      let settingsCases = 0;
      for (const [base, width] of ['', '/zangetsu'].flatMap((base) =>
        [390, 1440].map((width) => [base, width])
      )) {
        await metrics(width, 1000);
        for (const palette of useGallerySpacing
          ? ['charcoal-blue']
          : ['charcoal-blue', 'meadow-gold', 'harbour-amber']) {
          for (const dark of [false, true]) {
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}${base}/admin/neutral?palette=${palette}&dark=${dark ? 1 : 0}`,
            });
            await wait('!!document.querySelector("#qa-gallery img")');
            await pause(80);
            const initial = await sample();
            const restored = await evaluate(`(() => {
              const main=document.querySelector('.admin-shell > main');
              const panel=document.querySelector('#qa-gallery .bg-white');
              const icon=document.querySelector('#qa-media-settings [class~="text-blue-600"]');
              if(!icon)throw new Error('Actual Media Settings accent is required');
              const probe=document.createElement('span');
              probe.className='text-blue-600 dark:text-blue-400';icon.parentElement.append(probe);
              const expected=getComputedStyle(probe).color,foreground=getComputedStyle(icon).color;
              probe.remove();
              const panelColor=getComputedStyle(panel).backgroundColor;
              const priorPanel=main.style.getPropertyValue('--admin-light-panel');
              main.style.setProperty('--admin-light-panel','#f3f4f5');
              const oldPanel=getComputedStyle(panel).backgroundColor;
              if(priorPanel)main.style.setProperty('--admin-light-panel',priorPanel);
              else main.style.removeProperty('--admin-light-panel');
              const hadGrey=icon.classList.contains('dark:text-gray-200');
              icon.classList.add('dark:text-gray-200');
              const oldForeground=getComputedStyle(icon).color;
              if(!hadGrey)icon.classList.remove('dark:text-gray-200');
              return {expected,foreground,panelColor,oldPanel,oldForeground};
            })()`);
            assert.equal(
              restored.foreground,
              restored.expected,
              'Media Settings retains its v1.28.1 foreground accent'
            );
            if (dark) {
              assert.notEqual(
                restored.oldForeground,
                restored.foreground,
                'Reintroducing the grey override reproduces the lost accent'
              );
              assert.equal(restored.panelColor, 'rgb(32, 33, 36)', 'Charcoal panels are unchanged');
            } else {
              assert.equal(
                restored.panelColor,
                'rgb(253, 253, 253)',
                'Near-white panels use the requested #fdfdfd, not pure white'
              );
              assert.equal(
                restored.oldPanel,
                'rgb(243, 244, 245)',
                'Restoring the old token reproduces the previous grey panel'
              );
              assert.notEqual(restored.oldPanel, restored.panelColor);
            }
            if (useTableRowHover) {
              await evaluate(
                'document.querySelectorAll("#qa-gallery .self-end button")[1].click()'
              );
              await wait('!!document.querySelector("#qa-gallery tbody tr")');
              const point = await evaluate(`(() => {
                const row=document.querySelector('#qa-gallery tbody tr');row.scrollIntoView({block:'center'});
                const r=row.getBoundingClientRect();return {x:r.left+16,y:r.top+r.height/2};
              })()`);
              await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
              await pause(250);
              const readRow = () =>
                evaluate(`(() => {
                const row=document.querySelector('#qa-gallery tbody tr'),header=document.querySelector('#qa-gallery thead');
                const action=row.querySelector('.admin-action-edit');
                return {hovered:row.matches(':hover'),background:getComputedStyle(row).backgroundColor,
                  header:getComputedStyle(header).backgroundColor,action:getComputedStyle(action).color,
                  canvas:getComputedStyle(document.querySelector('.admin-shell')).backgroundColor,
                  token:getComputedStyle(document.querySelector('.admin-shell > main')).getPropertyValue('--admin-table-row-hover').trim(),
                  publicToken:getComputedStyle(document.querySelector('#qa-public-surface')).getPropertyValue('--admin-table-row-hover').trim()};
              })()`);
              const current = await readRow();
              assert.equal(current.hovered, true, 'The actual Gallery row receives mouse hover');
              assert.equal(current.publicToken, '', 'The row token is scoped to admin content');
              if (!dark) {
                assert.equal(
                  current.canvas,
                  'rgb(236, 238, 240)',
                  'Only the light admin canvas uses #eceef0'
                );
                assert.equal(current.token, '#e2e6e9');
                assert.equal(current.background, 'rgb(226, 230, 233)');
                assert.notEqual(
                  current.background,
                  current.header,
                  'Row hover differs from the header'
                );
              }
              await evaluate(
                "document.querySelector('.admin-shell > main').style.setProperty('--admin-table-row-hover','#d2d8df')"
              );
              await pause(250);
              const counterexample = await readRow();
              assert.equal(
                counterexample.background,
                dark ? current.background : 'rgb(210, 216, 223)',
                'Changing the master token recolors light rows but cannot override dark hover'
              );
              assert.equal(
                counterexample.header,
                current.header,
                'The token cannot recolor the header'
              );
              assert.equal(
                counterexample.action,
                current.action,
                'The token cannot recolor action controls'
              );
              await evaluate(
                "document.querySelector('.admin-shell > main').style.removeProperty('--admin-table-row-hover')"
              );
              assert.equal((await sample()).writes, 0, 'Hover checks never invoke an action');
              cases++;
              continue;
            }
            if (useEditActions) {
              await evaluate(
                'document.querySelectorAll("#qa-gallery .self-end button")[1].click()'
              );
              await wait('!!document.querySelector("#qa-gallery tbody .admin-action-edit")');
              for (const selector of [
                '#qa-gallery tbody .admin-action-edit',
                '#qa-action-edit',
                '#qa-action-edit-link',
              ]) {
                await checkIdleEdit(selector, dark);
                await checkAction(selector, 'edit', dark);
                await checkAction(selector, 'edit', dark, true);
              }
              for (const selector of [
                '#qa-action-disabled',
                '#qa-action-aria-disabled',
                '#qa-action-protected',
                '#qa-public-edit',
              ]) {
                await checkIdleEdit(selector, dark, false);
                await checkAction(selector, null, dark);
              }
              await evaluate('document.querySelector("#qa-open-surface").click()');
              await wait('!!document.querySelector("#qa-dialog-edit")');
              await checkIdleEdit('#qa-dialog-edit', dark);
              await checkAction('#qa-dialog-edit', 'edit', dark);
              await checkAction('#qa-dialog-edit', 'edit', dark, true);
              await checkAction('#qa-dialog-delete', 'delete', dark);
              await evaluate(
                'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'
              );
              await wait('!document.querySelector("#qa-dialog-edit")');
              await checkAction('#qa-action-delete', 'delete', dark);
              await checkWarning(false);
              await checkWarning(true);
              const final = await sample();
              assert.deepEqual(final.upload, initial.upload, 'Primary button fill is unchanged');
              assert.deepEqual(final.uploadText, initial.uploadText, 'Primary text is unchanged');
              assert.equal(final.writes, 0, 'Appearance checks must not invoke an action');
              cases++;
              continue;
            }
            if (!useGallerySpacing) {
              await checkWarning(false);
              await checkWarning(true);
              for (const selector of ['#qa-schema-repair', '#qa-featured-image']) {
                await checkWarning(false, selector);
                await checkWarning(true, selector);
              }
              await evaluate(
                `(()=>{[...document.querySelectorAll('#qa-discussion button')].find(button=>button.textContent.includes('Approved')).click()})()`
              );
              await wait(
                `!!document.querySelector('#qa-discussion button[title="Mark as Spam"]') && document.querySelector('#qa-discussion').textContent.includes('Approved') && !document.querySelector('#qa-discussion .animate-spin')`
              );
              await checkWarning(false);
              await checkWarning(true);
            }
            if (useWarmActions) {
              assert.equal(
                (await sample()).writes,
                0,
                'Warning appearance checks must not trigger actions'
              );
              cases++;
              continue;
            }
            assert.equal(
              initial.contactMuted.length,
              2,
              'Contrast checks include actual Contact Forms description and the visible empty state'
            );
            assert.deepEqual(
              initial.publicMuted,
              [106, 114, 130],
              'Public gray-500 text retains its original color'
            );
            if (dark)
              assert.equal(
                initial.grayToken,
                initial.rootGrayToken,
                'The light-only gray token does not enter dark admin'
              );
            else
              for (const muted of initial.contactMuted)
                assert.ok(
                  ratio(muted.color, muted.background) >= 4.5,
                  'Contact Forms light muted contrast: ' +
                    muted.text +
                    ' (' +
                    ratio(muted.color, muted.background).toFixed(2) +
                    ':1)'
                );
            const surfaces = await evaluate(`(() => {
              const style=selector=>getComputedStyle(document.querySelector(selector));
              return {canvas:style('.admin-shell').backgroundColor,
                panel:style('#qa-gallery .bg-white').backgroundColor,
                publicPanel:style('#qa-public-surface').backgroundColor,publicText:style('#qa-public-surface').color,
                code:style('#qa-editor-surfaces code').backgroundColor,table:style('#qa-editor-surfaces th').backgroundColor,
                tableBorder:style('#qa-editor-surfaces td').borderTopColor,
                token:style('.admin-shell > main').getPropertyValue('--admin-light-panel').trim()};
            })()`);
            assert.equal(
              surfaces.publicPanel,
              'rgb(255, 255, 255)',
              'Public white surfaces remain white'
            );
            assert.equal(
              surfaces.publicText,
              'rgb(255, 255, 255)',
              'Foreground white is never remapped'
            );
            if (!dark) {
              assert.equal(surfaces.canvas, 'rgb(236, 238, 240)');
              assert.equal(surfaces.panel, 'rgb(253, 253, 253)');
              assert.equal(surfaces.code, 'rgb(233, 236, 239)');
              assert.equal(surfaces.table, 'rgb(233, 236, 239)');
              assert.equal(surfaces.tableBorder, 'rgb(203, 208, 213)');
              assert.deepEqual(initial.paginationBorder, [203, 208, 213]);
              assert.ok(
                ratio(initial.description, [253, 253, 253]) >= 4.5,
                'Muted light text remains readable'
              );
            } else {
              assert.equal(surfaces.token, '', 'Soft Grey tokens do not enter dark mode');
              assert.equal(
                surfaces.panel,
                'rgb(32, 33, 36)',
                'Existing charcoal panels remain unchanged'
              );
            }
            await evaluate('document.querySelector("#qa-open-surface").click()');
            await wait('!!document.querySelector("#qa-surface-input")');
            await checkAction('#qa-dialog-delete', 'delete', dark);
            const dialog = await evaluate(`(() => {
              const panel=getComputedStyle(document.querySelector('[aria-label="Surface test dialog"]'));
              const input=getComputedStyle(document.querySelector('#qa-surface-input'));
              return {panel:panel.backgroundColor,border:panel.borderTopColor,input:input.backgroundColor};
            })()`);
            if (!dark) {
              assert.equal(
                await evaluate(
                  `getComputedStyle(document.querySelector('#qa-surface-muted')).color`
                ),
                await evaluate(
                  `getComputedStyle(document.querySelector('#qa-contact h1+p')).color`
                ),
                'Light portal muted text follows the same corrected token as Contact Forms'
              );
              assert.deepEqual(
                dialog,
                {
                  panel: 'rgb(253, 253, 253)',
                  border: 'rgb(203, 208, 213)',
                  input: 'rgb(233, 236, 239)',
                },
                'Actual body-portal dialog inherits light admin surfaces'
              );
              const outside = await evaluate(`(() => {
                const shell=document.querySelector('.admin-shell');shell.classList.remove('admin-shell');
                const bg=getComputedStyle(document.querySelector('[aria-label="Surface test dialog"]')).backgroundColor;
                shell.classList.add('admin-shell');return bg;
              })()`);
              assert.equal(
                outside,
                'rgb(255, 255, 255)',
                'The same public dialog stays unchanged without an admin shell'
              );
            } else
              assert.equal(
                dialog.panel,
                'rgb(255, 255, 255)',
                'CSS never replaces an explicit dark-context white control'
              );
            await evaluate(
              'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'
            );
            await wait('!document.querySelector("#qa-surface-input")');
            if (!dark) {
              const hoverPoint = await evaluate(`(() => {
                const button=document.querySelector('#qa-surface-hover');button.scrollIntoView({block:'center'});
                const r=button.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
              })()`);
              await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hoverPoint });
              await pause(50);
              assert(
                await evaluate(`(() => {
                const button=document.querySelector('#qa-surface-hover'),sample=document.createElement('span');
                sample.className='bg-blue-50';button.parentElement.append(sample);
                const actual=getComputedStyle(button).backgroundColor,expected=getComputedStyle(sample).backgroundColor;sample.remove();
                return actual===expected&&actual!=='rgb(253, 253, 253)';
              })()`),
                'The soft base surface cannot mask an accent hover state'
              );
              await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
            }
            assert.ok(
              Math.abs(initial.galleryGap - 24) < 1,
              `Gallery grid/footer gap: ${initial.galleryGap}px`
            );
            if (dark) {
              for (const field of [
                'upload',
                'description',
                'tabText',
                'tabBorder',
                'paginationBorder',
                'paginationText',
                'pageActive',
                'pageIdle',
                'pageBorder',
              ])
                neutral(initial[field], field);
              assert.deepEqual(initial.upload, initial.reference, 'Gallery follows Contact Forms');
              assert.ok(
                ratio(initial.pageActive, initial.pageIdle) >= 3 &&
                  ratio(initial.pageActive, initial.pageActiveText) >= 4.5,
                'Pagination selection is distinct and readable'
              );
            } else {
              const [r, g, b] = initial.upload;
              assert.ok(
                palette === 'charcoal-blue'
                  ? b > r && b > g
                  : palette === 'meadow-gold'
                    ? g > r && g > b
                    : r > g && r > b,
                'Light palette remains colored: ' + palette
              );
            }
            await evaluate('document.querySelector("#qa-gallery img").closest(".group").click()');
            await pause(60);
            if (dark) neutral((await sample()).selectedBorder, 'Selected image border');
            await evaluate('document.querySelectorAll("#qa-gallery .self-end button")[1].click()');
            await wait('!!document.querySelector("#qa-gallery tbody tr")');
            assert.ok(
              Math.abs((await sample()).galleryGap - 24) < 1,
              'Gallery list/footer retains the same gap'
            );
            if (dark) neutral((await sample()).rowBackground, 'Selected list row');
            for (const kind of ['edit', 'delete']) {
              await checkAction('#qa-gallery tbody .admin-action-' + kind, kind, dark);
              await checkAction('#qa-action-' + kind, kind, dark, true);
            }
            for (const selector of [
              '#qa-action-disabled',
              '#qa-action-protected',
              '#qa-public-action',
            ])
              await checkAction(selector, null, dark);
            for (const tab of useGallerySpacing
              ? []
              : ['general', 'google', 'profile', 'permalinks', 'categories', 'ads', 'api']) {
              await evaluateFunction(
                `function(tab){
                const select=document.querySelector('#qa-settings select#settings-section');
                Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,tab);
                select.dispatchEvent(new Event('change',{bubbles:true}));
              }`,
                tab
              );
              await pause(250);
              if (dark) {
                const tinted = await evaluate(`(()=>{
                  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
                  const context=canvas.getContext('2d'),issues=[];
                  for(const item of document.querySelectorAll('#qa-settings *')){
                    if(!(item instanceof HTMLElement)||!item.getClientRects().length)continue;
                    const classes=[...item.classList],style=getComputedStyle(item);
                    for(const [token,property] of [['bg','backgroundColor'],['border','borderTopColor']]){
                      if(!classes.some(value=>new RegExp('(?:^|:)'+token+'-(?:blue|sky|cyan|indigo)-').test(value)))continue;
                      context.clearRect(0,0,1,1);context.fillStyle=style[property];context.fillRect(0,0,1,1);
                      const rgb=[...context.getImageData(0,0,1,1).data].slice(0,3);
                      if(Math.max(...rgb)-Math.min(...rgb)>24)issues.push({tag:item.tagName,property,rgb,text:item.textContent.trim().slice(0,60)});
                    }
                  }
                  return issues;
                })()`);
                assert.deepEqual(
                  tinted,
                  [],
                  `Neutral settings surfaces: ${tab}, ${width}px, ${palette}`
                );
              }
              settingsCases++;
            }
            for (const page of [2, 3, 1]) {
              await evaluateFunction(
                `function(page){[...document.querySelectorAll('#qa-gallery button')].find(button=>button.textContent.trim()===String(page)).click()}`,
                page
              );
              await wait(
                `!![...document.querySelectorAll('#qa-gallery button')].find(button=>button.textContent.trim()==='${page}'&&button.classList.contains('bg-primary-600'))`
              );
            }
            const point = await evaluate(
              `(()=>{const button=[...document.querySelectorAll('#qa-gallery button')].find(button=>button.textContent.trim()==='2');button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`
            );
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
            await pause(250);
            if (dark) {
              const hovered = await sample();
              neutral(hovered.pageIdle, 'Pagination hover background');
              neutral(hovered.pageBorder, 'Pagination hover border');
              assert.ok(ratio(hovered.pageActive, hovered.pageIdle) >= 3);
            }
            assert.equal((await sample()).writes, 0, 'Visual checks must not save settings');
            cases++;
          }
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        useTableRowHover
          ? `PASS Table row hover: ${cases} root/subfolder, phone/desktop, three-palette and light/dark cases. Actual Gallery rows follow the shared light token; changing it reproduces the previous shade without changing headers/actions, dark hover or public scope. Fixture only; no installed data changed.`
          : useEditActions
            ? `PASS Edit actions browser: ${cases} root/subfolder, 390/1440px, three palettes and light/dark cases; real Gallery and portal plus shared button/link probes retain neutral normal/hover/keyboard-focus states. Delete, warnings, primary, disabled/protected and public controls stay unchanged. Fixture transport only; no installed data changed.`
            : useWarmActions
              ? `PASS Warm action browser: ${cases * 8} hover/keyboard-focus checks across root/subfolder, 390/1440px, three palettes and light/dark; actual Comments pending/approved actions and source-class Schema Repair/featured-image controls retain readable amber/gold states. No action invoked or installed data changed.`
              : useGallerySpacing
                ? `PASS Gallery spacing: ${cases * 2} grid/list checks retain a 24px gap above pagination at root/subfolder, 390/1440px and light/dark; page changes and hover remain functional. Read-only fixture, no installed data changed.`
                : `PASS Admin surfaces browser: ${cases} actual Gallery/Media Settings/Contact Forms comparisons and ${settingsCases} General/Google/Profile/Permalinks/Categories/Ads/API panels at root/subfolder and 390/1440px; near-white light panels, neutral dark backgrounds/borders and retained foreground accents. Read-only fixture transport; no installed data changed.`
      );
      return;
    }
    if (usePublicSettings) {
      let cases = 0;
      let emptyGroupCases = 0;
      const read = () => evaluate('window.__settingsQA.settings');
      const refresh = async (scope, id) => {
        const result = await evaluateFunction(
          'async function(scope,id){return window.__settingsQA.refresh(scope,id)}',
          scope,
          id
        );
        await pause(40);
        return result;
      };
      const assertPublic = (state, id) => {
        const key = publicSettingsFixture.keys[id];
        assert.equal(state._settingsScope, 'public');
        assert.deepEqual(
          Object.keys(state.theme).filter((key) =>
            Object.values(publicSettingsFixture.keys).includes(key)
          ),
          [key]
        );
        assert.deepEqual(state.theme[key], publicSettingsFixture.saved.theme[key]);
        assert.equal(state.discussionEnabled, false);
        assert.deepEqual(state.navigation, []);
        assert.deepEqual(state.sidebarLayout, []);
        assert.equal(state.ads.adsEnabled, false);
        assert.equal(state.ads.inFeedFrequency, 0);
        assert.equal(state.ads.headerAd, '');
        assert.deepEqual(state.newsletter, { enabled: false });
      };
      for (const base of ['', '/zangetsu']) {
        for (const id of Object.keys(publicSettingsFixture.keys)) {
          await send('Page.navigate', {
            url: `http://127.0.0.1:${port}${base}/admin/public-settings?theme=${id}`,
          });
          await wait('!!window.__settingsQA && !!document.querySelector("#qa-settings")');
          assertPublic(await read(), id);
          assert.equal(await refresh('admin', id), true);
          assert.deepEqual((await read()).theme, publicSettingsFixture.saved.theme);
          assert.equal(await refresh('public', id), true);
          assertPublic(await read(), id);
          assert.equal(
            await evaluate(
              'window.__settingsQA.handleUpdateSettings({...window.__settingsQA.settings,siteTagline:"Rejected public draft"})'
            ),
            false
          );
          assert.equal(await evaluate('window.__settingsWrites.length'), 0);
          const other = id === 'theme-default' ? 'theme-digest' : 'theme-default';
          assert.equal(await refresh('public', other), true);
          assertPublic(await read(), other);
          const beforeFailure = await read();
          assert.equal(await refresh('failure', id), false);
          assert.deepEqual(
            await read(),
            beforeFailure,
            'Failed reads must preserve the current snapshot'
          );
          assert.equal(await refresh('admin', id), true);
          assert.equal(
            await evaluate(
              'window.__settingsQA.handleUpdateSettings({...window.__settingsQA.settings,siteTagline:"Accepted admin draft"})'
            ),
            true
          );
          await pause(40);
          assert.deepEqual(await evaluate('window.__settingsWrites'), [
            {
              path: base + '/api/save_settings.php',
              patch: { siteTagline: 'Accepted admin draft' },
            },
          ]);
          assert.deepEqual(
            (await read()).theme,
            publicSettingsFixture.saved.theme,
            'Unrelated Save must retain all inactive configuration'
          );
          assert.equal(
            await evaluateFunction(
              'function(expected){return window.__settingsReads.every(path=>path===expected)}',
              base + '/api/get_settings.php'
            ),
            true
          );
          for (const kind of ['array', 'object']) {
            assert.equal(await refresh('admin', id), true);
            assert.equal((await read()).ads.headerAd, 'DORMANT_AD');
            assert.equal(await refresh('admin-empty-' + kind, id), true);
            const cleared = await read();
            assert.equal(cleared._settingsScope, 'admin');
            assert.equal(
              cleared.ads.headerAd,
              '',
              'Explicit empty Admin Ads must clear the previously loaded snippet'
            );
            assert.deepEqual(
              Object.keys(cleared.theme).filter((key) =>
                Object.values(publicSettingsFixture.keys).includes(key)
              ),
              [],
              'Explicit empty Admin theme must clear previously loaded namespaces'
            );
            assert.deepEqual(cleared.newsletter, kind === 'array' ? [] : {});
            await evaluate('window.__settingsWrites=[]');
            assert.equal(
              await evaluate(
                'window.__settingsQA.handleUpdateSettings({...window.__settingsQA.settings,ads:{...window.__settingsQA.settings.ads,inFeedFrequency:7}})'
              ),
              true
            );
            await pause(40);
            assert.deepEqual(await evaluate('window.__settingsWrites'), [
              {
                path: base + '/api/save_settings.php',
                patch: { ads: { ...cleared.ads, inFeedFrequency: 7 } },
              },
            ]);
            assert.equal((await read()).ads.headerAd, '');
            await evaluate('window.__settingsWrites=[]');
            assert.equal(
              await evaluate(
                'window.__settingsQA.handleUpdateSettings({...window.__settingsQA.settings,theme:{...window.__settingsQA.settings.theme,primaryColor:"#2468ac"}})'
              ),
              true
            );
            await pause(40);
            assert.deepEqual(await evaluate('window.__settingsWrites'), [
              {
                path: base + '/api/save_settings.php',
                patch: { theme: { ...cleared.theme, primaryColor: '#2468ac' } },
              },
            ]);
            emptyGroupCases++;
          }
          // An omitted group is not an explicit reset; retain the Admin compatibility baseline.
          assert.equal(await refresh('admin', id), true);
          const beforeOmitted = await read();
          assert.equal(await refresh('admin-omitted', id), true);
          assert.deepEqual((await read()).ads, beforeOmitted.ads);
          assert.deepEqual((await read()).theme, beforeOmitted.theme);
          assert.equal((await read()).ads.inFeedFrequency, 0);
          assert.equal((await read()).ads.adsEnabled, false);
          await send('Page.reload', { ignoreCache: true });
          await wait(
            '!!window.__settingsQA && window.__settingsQA.settings._settingsScope==="public"'
          );
          assertPublic(await read(), id);
          cases++;
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS Lean Public Settings browser: ${cases} six-theme/root/subfolder hydration, full-admin/public transitions, theme switches, failed-read preservation, public Save rejection, exact admin patch and hard reload cases; ${emptyGroupCases} full-Admin populated -> empty array/object -> Ads/theme Save regressions, with omitted-group and false/zero controls. Real useSettings/CSRF transport; fixture responses only, no installed data changed.`
      );
      return;
    }
    if (useNativeTracking) {
      let cases = 0;
      for (const base of ['', '/zangetsu']) {
        for (const mode of ['strict', 'balanced', 'hybrid']) {
          for (const crawler of [true, false]) {
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}${base}/admin/native-tracking?mode=${mode}&crawler=${crawler ? '1' : '0'}`,
            });
            await wait(
              'window.__qaNativeReady===true && document.querySelector("#root").textContent.length>0'
            );
            await pause(300);
            assert.equal(await evaluate('navigator.userAgent.includes("Chrome")'), true);
            assert.equal(await evaluate('navigator.userAgent.includes("ExaSearchBot")'), false);
            assert.equal(
              await evaluate('document.querySelector("meta[name=voncms-tracking]")?.content||""'),
              crawler ? 'excluded' : ''
            );
            assert.equal(await evaluate('window.__qaNativeCalls.length'), crawler ? 0 : 1);
            for (const [route, key, id] of [
              ['article', 'postId', '7'],
              ['page', 'pageId', '8'],
            ]) {
              const before = await evaluate('window.__qaNativeCalls.length');
              await evaluateFunction(
                'function(route){window.__qaNativeNavigate(route)}',
                `/admin/${route}`
              );
              await wait(`location.pathname.endsWith('/${route}')`);
              await pause(200);
              assert.equal(
                await evaluate('window.__qaNativeCalls.length'),
                before + (crawler ? 0 : 1)
              );
              if (!crawler)
                assert.equal(
                  await evaluateFunction(
                    'function(key){return window.__qaNativeCalls.at(-1).payload[key]}',
                    key
                  ),
                  id
                );
            }
            await send('Page.reload', {});
            await wait(
              'window.__qaNativeReady===true && document.querySelector("#root").textContent.length>0'
            );
            await pause(250);
            assert.equal(await evaluate('window.__qaNativeCalls.length'), crawler ? 0 : 1);
            cases++;
          }
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS Native tracking browser: ${cases} real Chrome root/subfolder and collection-mode cases preserve PHP crawler markers through homepage/article/Page SPA changes and reload; ordinary Chrome/Linux still sends tracking. Fixture transport, no live CMS or external requests.`
      );
      return;
    }

    if (useRelatedPosts) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      for (const base of ['', '/zangetsu']) {
        await metrics(base ? 390 : 1440, 1000);
        await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/qa-home` });
        await wait('document.querySelector("#qa-related-title")?.textContent==="Homepage"');
        assert.equal(await evaluate('window.__qaRelatedRequests.length'), 0);
        await click('#qa-related-entry');
        for (const next of ['b', 'c', 'd']) {
          await wait('document.querySelectorAll(".related-posts a").length===6');
          assert.equal(
            await evaluate(
              'Array.from(document.querySelectorAll(".related-posts a")).some(a=>a.textContent.includes("local"))'
            ),
            false,
            'Unrelated hydration must not bypass category retrieval'
          );
          await click(`.related-posts a[href$="/qa-${next}"]`);
          await wait(
            `document.querySelector("#qa-related-title")?.textContent==="Article ${next.toUpperCase()}"`
          );
        }
        await wait('document.querySelectorAll(".related-posts a").length===6');
        assert.equal(
          await evaluate('window.__qaRelatedRequests.length'),
          8,
          'A/B/C/D each use at most the two existing batches'
        );
        await send('Page.reload');
        await wait(
          'document.querySelector("#qa-related-title")?.textContent==="Article D" && document.querySelectorAll(".related-posts a").length===6'
        );
        for (const [query, count] of [
          ['count=3&fault=global', 3],
          ['count=6&fault=all', 6],
          ['count=6&sort=views', 6],
        ]) {
          await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/qa-a?${query}` });
          await wait(`document.querySelectorAll(".related-posts a").length===${count}`);
          if (query.includes('sort=views'))
            assert.equal(
              await evaluate('document.querySelector(".related-posts a h4").textContent'),
              'Article E19'
            );
          assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false);
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Related Posts browser: actual hook/cards navigate homepage->A->B->C->D and reload at root/subfolder, recover partial/total candidate failures, keep3/6 cards and Most Viewed order, and avoid horizontal overflow at390/1440px. Fixture-only transport; no installed-site data accessed.'
      );
      return;
    }
    if (usePluginSelection) {
      let cases = 0;
      const selected = async (active, idle) => {
        const contrast = await evaluateFunction(
          `function(active,idle){
          const buttons=[...document.querySelectorAll('button')];
          const current=buttons.find(button=>button.textContent.trim()===active),other=buttons.find(button=>button.textContent.trim()===idle);
          const context=document.createElement('canvas').getContext('2d');
          const rgb=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};
          const luminance=values=>values.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0);
          const surface=item=>{for(let owner=item;owner;owner=owner.parentElement){const color=getComputedStyle(owner).backgroundColor;if(color!=='rgba(0, 0, 0, 0)')return rgb(color);}return [0,0,0]};
          const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
          const bg=surface(current);return {state:ratio(bg,surface(other)),text:ratio(bg,rgb(getComputedStyle(current).color))};
        }`,
          active,
          idle
        );
        assert.ok(
          contrast.state >= 3 && contrast.text >= 4.5,
          active + ': ' + JSON.stringify(contrast)
        );
      };
      for (const base of ['', '/zangetsu'])
        for (const width of [390, 1440]) {
          await metrics(width, 1000);
          await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/extensions` });
          await wait(
            "!![...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Themes')"
          );
          await click('button[aria-label="Use dark mode"]');
          await pause(250);
          await selected('Themes', 'Plugins');
          await evaluate(
            "[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Plugins').click()"
          );
          await pause(250);
          await selected('Plugins', 'Themes');
          await evaluate(
            `(()=>{const card=[...document.querySelectorAll('h3')].find(item=>item.textContent.trim()==='AI Summary').parentElement.parentElement;card.querySelector('button[title="Settings"]').click();})()`
          );
          await wait(
            "!![...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Above Content (Top)')"
          );
          await selected('Above Content (Top)', 'Below Content (Bottom)');
          await selected('5 points', '3 points');
          await evaluate(
            "[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Below Content (Bottom)').click()"
          );
          await pause(250);
          await selected('Below Content (Bottom)', 'Above Content (Top)');
          assert.equal(await evaluate('window.__extensionWrites.length'), 0);
          cases += 5;
        }
      assert.deepEqual(errors, []);
      console.log(
        `PASS Plugin selection: ${cases} actual Extensions tabs and AI Summary choices at root/subfolder and phone/desktop; active surface >=3:1, active text >=4.5:1. Local draft changes only, no saves.`
      );
      return;
    }
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

        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/extensions?tab=plugins`,
        });
        const promo = card('Top Announcement Bar');
        const dismissToggle = 'document.querySelector(\'input[name="promoBarAllowDismiss"]\')';
        const dismissHours = 'document.querySelector(\'input[aria-label="dismissHours value"]\')';
        await wait(`!!${promo}`);
        const openPromo = async () => {
          await evaluate(`${promo}.querySelector('button[title="Settings"]').click()`);
          await wait(`!!${dismissToggle}`);
        };
        await openPromo();
        assert.equal(await evaluate(`${dismissToggle}.checked && ${dismissHours}.value`), '24');
        await evaluate(`${dismissToggle}.click()`);
        await wait(`!${dismissHours}`);
        await evaluate(
          "[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='Save Changes').click()"
        );
        await wait('window.__extensionState.pluginConfig.vp_promo_bar.allowDismiss===false');
        await wait(`!${dismissToggle}`);
        assert.equal(
          await evaluate('window.__extensionState.pluginConfig.vp_promo_bar.dismissHours'),
          24
        );
        await openPromo();
        assert.equal(await evaluate(`${dismissToggle}.checked || !!${dismissHours}`), false);
        await evaluate(`${dismissToggle}.click()`);
        await wait(`!!${dismissHours}`);
        assert.equal(await evaluate(`${dismissHours}.value`), '24');
        await evaluate(
          'sessionStorage.clear();localStorage.removeItem("von_active_theme_id");true'
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Extensions lifecycle browser: root/desktop and subfolder/phone uninstall, delayed/rejected acknowledgement, Default protection, reload, retained configuration, inactive reinstall, activation and Promo Bar dismissal settings. Persistence uses fixture state/sessionStorage only; no installed CMS accessed.'
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
        evaluateFunction(
          `function(selector,value) {
        const field=document.querySelector(selector);
        const proto=field.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(field,value);
        field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));
      }`,
          selector,
          value
        );
      const edit = async (name) => {
        await evaluateFunction(
          `function(name) {
          const row=[...document.querySelectorAll('tr')].find(r=>r.textContent.includes(name));
          if(!row)throw new Error('Missing user fixture row');row.querySelector('button[title="Edit User"]')?.click();
        }`,
          name
        );
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
        evaluateFunction(
          `function(selector,value) {
        const input=document.querySelector(selector);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }`,
          selector,
          value
        );
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
      const assertNeutralAuth = async () => {
        // Theme transitions must settle; the hidden honeypot is not a visible control.
        await pause(250);
        const issues = await evaluate(`(()=>{
          if(!document.documentElement.classList.contains('dark'))return [];
          const card=document.querySelector('[data-auth-view]'),issues=[];
          const context=document.createElement('canvas').getContext('2d');
          const check=(item,property,value)=>{
            context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);
            const rgb=[...context.getImageData(0,0,1,1).data].slice(0,3);
            if(Math.max(...rgb)-Math.min(...rgb)>24)issues.push({tag:item.tagName,property,rgb});
          };
          for(const item of card.querySelectorAll('input,label,button,p,span')){
            if(!item.getClientRects().length||item.type==='hidden'||item.closest('[aria-hidden="true"]'))continue;
            let status=false;
            for(let owner=item;owner&&owner!==card;owner=owner.parentElement){
              if([...owner.classList].some(value=>/(?:text|bg)-(?:red|emerald|green|amber)-/.test(value))){status=true;break;}
            }
            if(status)continue;
            const style=getComputedStyle(item);
            check(item,'color',style.color);
            if(item.tagName==='INPUT'){
              check(item,'border',style.borderTopColor);
              if(item.type==='checkbox'){
                if(style.accentColor==='auto')issues.push({property:'accent',value:'auto'});
                else check(item,'accent',style.accentColor);
              }else check(item,'placeholder',getComputedStyle(item,'::placeholder').color);
            }
          }
          return issues;
        })()`);
        assert.deepEqual(
          issues,
          [],
          'Dark auth text, borders, placeholders and Remember me are neutral'
        );
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
        await assertNeutralAuth();
      };
      const assertLoginBrand = async (dark) => {
        const brand = await evaluate(`(() => {
          const svg=document.querySelector('[data-auth-view=login] svg[viewBox="0 0 256 256"]');
          if(!svg)return null;
          const rgb=value=>{const context=document.createElement('canvas').getContext('2d');context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};
          const size=svg.getBoundingClientRect();
          return {paths:svg.querySelectorAll('path').length,fill:rgb(getComputedStyle(svg.querySelector('path')).fill),background:rgb(getComputedStyle(svg.parentElement.parentElement).backgroundColor),width:size.width,height:size.height};
        })()`);
        assert.ok(brand, 'Login uses the supplied vector brand, not the old key icon');
        assert.equal(brand.paths, 4, 'All four supplied paths are retained');
        assert.deepEqual(brand.fill, dark ? [255, 255, 255] : [0, 0, 0]);
        assert.deepEqual(brand.background, dark ? [23, 23, 23] : [255, 255, 255]);
        assert.equal(brand.width, 40);
        assert.equal(brand.height, 40);
        await assertNeutralAuth();
      };
      await open();
      await metrics(1440, 1100);
      await assertLoginBrand(false);
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
        for (const dark of [false, true]) {
          await evaluateFunction(
            'function(dark) {document.documentElement.classList.toggle("dark",dark)}',
            dark
          );
          for (const width of [320, 390, 1440]) {
            await metrics(width, 740);
            await assertLoginBrand(dark);
            const canvas = await evaluate(`(() => {
              const card=document.querySelector('[data-auth-view=login]');
              const style=getComputedStyle(card.parentElement);
              const probe=document.createElement('span');
              probe.style.backgroundColor='var(--admin-palette-inset)';
              document.body.appendChild(probe);
              const darkColor=getComputedStyle(probe).backgroundColor;
              probe.remove();
              return {actual:style.backgroundColor,darkColor};
            })()`);
            assert.equal(
              canvas.actual,
              modal ? 'rgba(0, 0, 0, 0)' : dark ? canvas.darkColor : 'rgb(231, 233, 235)',
              'Only the standalone light login canvas becomes soft grey'
            );
            assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false);
            if (width === 390 || width === 1440)
              await screenshot(
                `auth-brand-${modal ? 'modal' : 'standalone'}-${dark ? 'dark' : 'light'}-${width}`
              );
          }
        }
        await metrics(1440, 740);
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
            await assertNeutralAuth();
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
        for (const dark of [false, true]) {
          await evaluateFunction(
            'function(dark) {document.documentElement.classList.toggle("dark",dark)}',
            dark
          );
          await assertLoginBrand(dark);
        }
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
        await assertNeutralAuth();
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
        'PASS Auth browser: supplied four-path brand is black on light and white on dark at phone/desktop sizes in popup/standalone and root/subfolder; actual Login component/CSS, responsive registration and neutral placeholder; shared black headers/actions across login/recovery/reset/account-created states; registration, recovery error/retry, token URL cleanup, reset mismatch/error/retry/success/return-to-login, guest/unverified/resend/stale-response and successful login controls remain intact. Transport is mocked; no accounts, passwords or mail changed on an installed site.'
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
      for (const base of ['', '/zangetsu']) {
        for (const collection of ['strict', 'balanced', 'hybrid']) {
          const expected = collection === 'strict' ? 'strict' : 'balanced';
          const alternative = expected === 'strict' ? 'balanced' : 'strict';
          await send('Page.navigate', {
            url: `http://127.0.0.1:${port}${base}/admin/dashboard?collection=${collection}`,
          });
          await wait(
            `document.querySelector('#dashboard-analytics-mode')?.value==='${expected}' && window.__qaAnalyticsRequests.some(q=>q.includes('mode=${expected}'))`
          );
          assert.deepEqual(
            await evaluate(
              `Array.from(document.querySelector('#dashboard-analytics-mode').options,option=>option.value)`
            ),
            ['balanced', 'strict'],
            'Balanced precedes Strict without changing the selected report'
          );
          await evaluateFunction(
            `function(mode){const select=document.querySelector('#dashboard-analytics-mode');select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}));}`,
            alternative
          );
          await wait(
            `document.querySelector('#dashboard-analytics-mode')?.value==='${alternative}' && window.__qaAnalyticsRequests.some(q=>q.includes('mode=${alternative}'))`
          );
          assert.equal(await evaluate('window.__qaDashboardWrites'), 0);
        }
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/dashboard?collection=strict`,
        });
        await wait('document.querySelector("#dashboard-analytics-mode")?.value==="strict"');
        await evaluate('window.__qaSetDashboardCollection("hybrid")');
        await wait('document.querySelector("#dashboard-analytics-mode")?.value==="balanced"');
        await evaluate(
          `(()=>{const select=document.querySelector('#dashboard-analytics-mode');select.value='strict';select.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await wait('document.querySelector("#dashboard-analytics-mode")?.value==="strict"');
        await evaluate('window.__qaSetDashboardCollection("hybrid")');
        await evaluate(
          'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'
        );
        assert.equal(
          await evaluate('document.querySelector("#dashboard-analytics-mode").value'),
          'strict',
          'An unrelated rerender must retain the manually selected report'
        );
        assert.equal(await evaluate('window.__qaDashboardWrites'), 0);
      }
      console.log(
        'PASS Dashboard report defaults: root/subfolder Strict-only, Balanced and Hybrid starts, both dropdown choices, late Hybrid settings and manual-choice retention. No writes.'
      );
      if (useDashboardReports) {
        assert.deepEqual(errors, []);
        return;
      }
      for (const scenario of [
        {
          base: '',
          role: 'Admin',
          zone: 'Asia/Kuala_Lumpur',
          effective: 'Asia/Kuala_Lumpur',
          stamp: '2026-11-07T16:30:00Z',
        },
        {
          base: '/zangetsu',
          role: 'Moderator',
          zone: 'UTC',
          effective: 'UTC',
          stamp: '2026-11-07T16:30:00Z',
        },
        {
          base: '',
          role: 'Root',
          zone: 'America/New_York',
          effective: 'America/New_York',
          stamp: '2026-11-01T05:30:00Z',
        },
        {
          base: '/zangetsu',
          role: 'Admin',
          zone: 'America/New_York',
          effective: 'America/New_York',
          stamp: '2026-11-01T06:30:00Z',
        },
        {
          base: '',
          role: 'Writer',
          zone: 'Invalid/Zone',
          effective: 'UTC',
          stamp: '2026-11-07T23:59:00Z',
        },
        {
          base: '/zangetsu',
          role: 'Admin',
          zone: 'Pacific/Kiritimati',
          effective: 'Pacific/Kiritimati',
          stamp: '2026-11-07T12:15:00Z',
        },
      ]) {
        const params = new URLSearchParams({
          role: scenario.role,
          zone: scenario.zone,
          clock: scenario.stamp,
        });
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${scenario.base}/admin/dashboard?${params}`,
        });
        await wait(
          '!!document.querySelector("[data-clock-hand=minute]") && window.__qaAnalyticsRequests.length>0'
        );
        assert.equal(
          await evaluate(
            `[...document.querySelectorAll('h1')].find(e=>e.textContent==='Dashboard')?.nextElementSibling?.textContent.trim()`
          ),
          'Your content, audience and system at a glance.',
          'The Dashboard heading retains its short explanatory subtitle'
        );
        const clock = await evaluateFunction(
          `function(scenario) {
          const card=document.querySelector('[aria-label="Dashboard clock"]');
          const now=new Date(scenario.stamp),time=card.querySelector('time');
          const formatter=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:scenario.effective});
          const parts=Object.fromEntries(formatter.formatToParts(now).map(p=>[p.type,p.value]));
          const hour=Number(parts.hour),minute=Number(parts.minute),second=Number(parts.second);
          const date=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:scenario.effective}).format(now);
          const rotation=kind=>Number(card.querySelector('[data-clock-hand="'+kind+'"]').style.transform.match(/rotate\\(([^d]+)deg\\)/)[1]);
          const activity=[...document.querySelectorAll('h3')].find(e=>e.textContent==='Recent Activity').nextElementSibling;
          return {actual:time.textContent,expected:formatter.format(now),stamp:time.dateTime,datePresent:card.textContent.includes(date),
            zonePresent:card.textContent.includes(scenario.effective),shortcut:[...card.querySelectorAll('button')].some(e=>e.textContent==='Change timezone'),
            hour:rotation('hour'),minute:rotation('minute'),expectedHour:(hour%12)*30+minute*0.5+second/120,expectedMinute:minute*6+second*0.1,
            activity:[...activity.children].map(e=>e.querySelector('p').textContent)};
        }`,
          scenario
        );
        assert.equal(clock.actual, clock.expected, 'Digital clock follows the configured zone');
        assert.equal(clock.stamp, new Date(scenario.stamp).toISOString());
        assert(clock.datePresent && clock.zonePresent, 'Date and displayed zone match the hands');
        assert.equal(clock.hour, clock.expectedHour);
        assert.equal(clock.minute, clock.expectedMinute);
        assert.equal(
          clock.shortcut,
          ['Admin', 'Root'].includes(scenario.role),
          'Existing timezone-role visibility is retained'
        );
        assert.deepEqual(
          clock.activity,
          Array.from({ length: 5 }, (_, i) => 'Dashboard fixture article ' + (i + 1)),
          'Exactly five actual articles are shown, not the sixth record or the system note'
        );
        const cards = await evaluate(`(() => {
          const stats=document.querySelector('[aria-label="Dashboard overview"]').lastElementChild;
          return [...stats.children].map(card=>({label:card.getAttribute('aria-label'),nestedCards:card.querySelectorAll('[role="group"]').length}));
        })()`);
        assert.deepEqual(
          cards,
          [
            ...['Articles', 'Pages', 'Comments', 'Active Users', 'Media Usage'].map((title) => ({
              label: title + ' statistic',
              nestedCards: 0,
            })),
            { label: 'System information', nestedCards: 0 },
          ],
          'Five statistics and system information have six separate surfaces without grouped panels'
        );
        for (const dark of [false, true]) {
          if (
            (await evaluate(
              'document.querySelector(".admin-shell").classList.contains("dark")'
            )) !== dark
          )
            await click('header button[aria-label="Use ' + (dark ? 'dark' : 'light') + ' mode"]');
          for (const width of [320, 390, 768, 1024, 1440, 1920]) {
            await metrics(width, 1000);
            const layout = await evaluate(`(() => {
              const overview=document.querySelector('[aria-label="Dashboard overview"]'),clock=overview.firstElementChild,stats=overview.lastElementChild;
              const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
              return {clock:rect(clock),stats:rect(stats),labels:[...stats.querySelectorAll('h3')].map(e=>e.textContent),
                overflow:document.documentElement.scrollWidth>innerWidth,
                cardsFit:[...stats.children].every(e=>e.scrollWidth<=e.clientWidth+1),faceWidth:overview.querySelector('[data-clock-hand="minute"]').parentElement.getBoundingClientRect().width,handWidth:getComputedStyle(overview.querySelector('[data-clock-hand="minute"]')).width,
                systemRows:[...overview.querySelectorAll('.dashboard-system-details > dt')].map(label=>{const end=[...label.firstElementChild.getClientRects()].at(-1);return {label:rect(label),colon:rect(label.lastElementChild),value:rect(label.nextElementSibling),textEnd:{x:end.right,y:end.y}}})};
            })()`);
            assert.equal(
              layout.overflow,
              false,
              `${scenario.base}/${dark}/${width}: no page overflow`
            );
            assert.equal(layout.cardsFit, true, 'Stat values and labels stay inside their cards');
            if (width >= 768) {
              assert(
                layout.systemRows.every((row) => row.value.x - row.label.x <= 176),
                'System versions stay close to their labels instead of stretching across the card'
              );
            } else {
              assert(
                layout.systemRows.every(
                  (row) =>
                    row.colon.x - row.textEnd.x >= 0 &&
                    row.colon.x - row.textEnd.x <= 8 &&
                    Math.abs(row.colon.y - row.textEnd.y) <= 2 &&
                    row.value.y >= row.label.bottom - 1
                ),
                'Small-screen colons follow the final label word while each version stays below'
              );
            }
            assert.equal(
              layout.faceWidth,
              width >= 768 ? 112 : 144,
              'Desktop clock becomes compact while the phone face retains its size'
            );
            assert.deepEqual(layout.labels, [
              'Articles',
              'Pages',
              'Comments',
              'Active Users',
              'Media Usage',
              'System',
            ]);
            assert.equal(
              layout.handWidth,
              '3px',
              'The minute hand is visible, not an ungenerated utility'
            );
            if (width >= 768) {
              assert.equal(
                layout.clock.width,
                240,
                'Desktop Bento reserves 240px for the compact clock card'
              );
              assert(
                layout.stats.right + 15 <= layout.clock.x,
                'Desktop clock stays to the right of the six information cards'
              );
              assert(
                layout.clock.height <= (width >= 1024 ? 288 : 304) &&
                  layout.stats.height <= (width >= 1024 ? 288 : 304),
                'Compact desktop Bento leaves more vertical space for analytics'
              );
            } else
              assert(
                layout.clock.bottom + 15 <= layout.stats.y,
                'Phone clock and all stats stack without overlap'
              );
            if (scenario.zone === 'Asia/Kuala_Lumpur' && [390, 1440].includes(width))
              await screenshot(`bento-${dark ? 'dark' : 'light'}-${width}`);
          }
        }
        const requestsBefore = await evaluate('window.__qaDashboardRequests.length');
        await pause(1250);
        assert.equal(
          await evaluate('window.__qaDashboardRequests.length'),
          requestsBefore,
          'Clock ticks must not request data'
        );
        if (scenario.zone === 'Asia/Kuala_Lumpur') {
          await evaluate(`window.__qaSetClock('2026-11-07T16:31:30Z')`);
          await wait(
            `document.querySelector('[aria-label="Dashboard clock"] time').textContent==='00:31:30'`
          );
          await evaluate(
            `window.__qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden});document.dispatchEvent(new Event('visibilitychange'));window.__qaSetClock('2026-11-07T16:32:00Z')`
          );
          await pause(1250);
          assert.equal(
            await evaluate(
              `document.querySelector('[aria-label="Dashboard clock"] time').textContent`
            ),
            '00:31:30',
            'Hidden documents stop the clock timer'
          );
          await evaluate(
            `window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))`
          );
          await wait(
            `document.querySelector('[aria-label="Dashboard clock"] time').textContent==='00:32:00'`
          );
          await wait('window.__qaClockTimers.size===1');
          await evaluate(`document.querySelector('[aria-label="Dashboard clock"] button').click()`);
          await wait('!document.querySelector("[data-clock-hand]")');
          assert.equal(await evaluate('location.pathname'), scenario.base + '/admin/settings');
          assert.equal(
            await evaluate('window.__qaClockTimers.size'),
            0,
            'Route exit cleans up the clock interval'
          );
        } else if (clock.shortcut) {
          await evaluate(`document.querySelector('[aria-label="Dashboard clock"] button').click()`);
          await wait('!document.querySelector("[data-clock-hand]")');
          assert.equal(await evaluate('location.pathname'), scenario.base + '/admin/settings');
        }
        assert.equal(await evaluate('window.__qaDashboardWrites'), 0);
      }
      console.log(
        'PASS Bento Dashboard: root/subfolder, all five statistics and five article activities, midnight/date rollover, repeated DST hour, invalid-zone fallback, Admin/Root versus Moderator/Writer shortcut, 72 light/dark viewport cases, ticking without requests, hidden-tab pause and route timer cleanup. Controlled browser fixtures, no installed-site writes.'
      );
      for (const [total, visible] of [
        [0, '0'],
        [997, '997'],
        [10000, '10,000'],
        [100000, '100,000'],
        [999999, '999,999'],
        [1090000, '1.09M'],
      ]) {
        const php =
          total === 0 ? '' : total === 997 ? '8.2.30' : total === 10000 ? '8.3.36' : '8.5.12';
        const params = new URLSearchParams({ role: 'Admin', total: String(total) });
        if (php) params.set('php', php);
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}/zangetsu/admin/dashboard?${params}`,
        });
        await wait(
          `document.querySelector('[aria-label="Articles statistic"] p')?.title === ${JSON.stringify(total.toLocaleString('en-US'))} && document.querySelector('[aria-label="Comments statistic"] p')?.title === ${JSON.stringify(total.toLocaleString('en-US'))}`
        );
        const values = await evaluate(`(() => {
          const overview=document.querySelector('[aria-label="Dashboard overview"]');
          return {counts:['Articles','Pages','Comments','Active Users'].map(title=>{
            const p=overview.querySelector('[aria-label="'+title+' statistic"] p');
            return {visible:p.querySelector('[aria-hidden="true"]').textContent,exact:p.title,accessible:p.querySelector('.sr-only').textContent};
          }),media:overview.querySelector('[aria-label="Media Usage statistic"] p').title,
          system:[...overview.querySelectorAll('.dashboard-system-details > dt')].map(e=>({label:e.firstElementChild.textContent.trim(),value:e.nextElementSibling.textContent.trim()})),
          systemFont:getComputedStyle(overview.querySelector('.dashboard-system-details')).fontSize,
          separators:overview.querySelectorAll('.dashboard-system-details > dt > span[aria-hidden="true"]').length,
          pipe:overview.querySelector('.dashboard-system-details').textContent.includes('|'),
          phpNotice:[...document.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('PHP 8.3+ is recommended'))};
        })()`);
        assert.deepEqual(
          values.counts,
          Array.from({ length: 4 }, () => ({
            visible,
            exact: total.toLocaleString('en-US'),
            accessible: total.toLocaleString('en-US'),
          })),
          'Displayed counts retain an exact accessible value without changing their source'
        );
        assert.equal(values.media, '1 MB', 'Storage text is not parsed as a count');
        assert.equal(values.systemFont, '16px', 'System versions use larger 16px text');
        assert.equal(
          values.separators,
          php ? 2 : 1,
          'Each present version has one labelled row and colon'
        );
        assert.equal(
          values.pipe,
          false,
          'System versions are separate rows, not a pipe-delimited line'
        );
        assert.deepEqual(
          values.system,
          [
            { label: 'VonCMS Version', value: require('../package.json').version },
            ...(php ? [{ label: 'PHP Version', value: php }] : []),
          ],
          'Labelled versions retain their live package/runtime values without a readiness label'
        );
        assert.equal(
          values.phpNotice,
          php.startsWith('8.2.'),
          'Existing PHP 8.2 guidance is retained'
        );
        for (const dark of [false, true]) {
          if (
            (await evaluate(
              'document.querySelector(".admin-shell").classList.contains("dark")'
            )) !== dark
          )
            await click('header button[aria-label="Use ' + (dark ? 'dark' : 'light') + ' mode"]');
          for (const width of [320, 390, 1440]) {
            await metrics(width, 1000);
            if (width >= 768) {
              const positions =
                await evaluate(`(()=>[...document.querySelectorAll('.dashboard-system-details > dt')].map(label=>{
                const value=label.nextElementSibling.getBoundingClientRect(),colon=label.lastElementChild.getBoundingClientRect(),text=label.getBoundingClientRect();
                return {label:text.x,colon:colon.x,value:value.x};
              }))()`);
              assert(
                positions.every((row) => row.value - row.label <= 176),
                'System versions stay close to their labels instead of stretching across the card'
              );
              assert(
                positions.every(
                  (row) =>
                    Math.abs(row.colon - positions[0].colon) <= 1 &&
                    Math.abs(row.value - positions[0].value) <= 1
                ),
                'System colons and values align across both rows'
              );
            }
            assert(
              await evaluate(`(() => {
              const stats=document.querySelector('[aria-label="Dashboard overview"]').lastElementChild;
              return document.documentElement.scrollWidth<=innerWidth && [...stats.children].every(card=>{
                const r=card.getBoundingClientRect();
                return card.scrollWidth<=card.clientWidth+1 && [...card.querySelectorAll('p,dt,dd')].every(p=>{const pr=p.getBoundingClientRect();return pr.left>=r.left&&pr.right<=r.right&&pr.bottom<=r.bottom});
              });
            })()`),
              `${total}/${dark}/${width}: large values and system text fit each independent card`
            );
            if (total === 100000 && [390, 1440].includes(width))
              await screenshot(`bento-count-${dark ? 'dark' : 'light'}-${width}`);
          }
        }
        assert.equal(await evaluate('window.__qaDashboardWrites'), 0);
      }
      console.log(
        'PASS Bento counts/system: 0, 997, 10k, 100k, 999,999 and 1.09M retain exact values; 36 light/dark phone/desktop layouts fit; live PHP props, missing PHP and existing 8.2 notice remain correct.'
      );
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
        `document.querySelector('[aria-label="Comments statistic"]').textContent.includes('23')`
      );
      const lightAccents = new Set();
      for (const palette of ['charcoal-blue', 'meadow-gold', 'harbour-amber']) {
        await evaluateFunction(
          `function(palette) {document.documentElement.dataset.adminPalette=palette;}`,
          palette
        );
        for (const dark of [false, true]) {
          if (
            (await evaluate(
              'document.querySelector(".admin-shell").classList.contains("dark")'
            )) !== dark
          )
            await click('header button[aria-label="Use ' + (dark ? 'dark' : 'light') + ' mode"]');
          await metrics(1440, 1000);
          const accent = await evaluate(`(() => {
            const overview=document.querySelector('[aria-label="Dashboard overview"]');
            const sample=document.createElement('span');sample.className='bg-blue-600 dark:bg-blue-400';overview.append(sample);
            const expected=getComputedStyle(sample).backgroundColor;sample.remove();
            const originalIconClasses=['text-sky-600','text-emerald-600','text-purple-600','text-blue-600','text-amber-600','text-blue-600 dark:text-blue-400'];
            const expectedIcons=originalIconClasses.map(className=>{const probe=document.createElement('span');probe.className=className;overview.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color;});
            return {expected,expectedIcons,hands:[...overview.querySelectorAll('[data-clock-hand]')].map(e=>getComputedStyle(e).backgroundColor),
              icons:[...overview.lastElementChild.querySelectorAll('svg')].map(e=>getComputedStyle(e).color)};
          })()`);
          assert(
            accent.hands.every((color) => color === accent.expected),
            'Both clock hands follow the active admin accent'
          );
          assert.deepEqual(
            accent.icons,
            accent.expectedIcons,
            'Statistics retain v1.28.1 individual accents while System follows the active palette'
          );
          if (!dark) lightAccents.add(accent.expected);
          const point = await evaluateFunction(`function() {
            const bar=[...document.querySelectorAll('.recharts-bar-rectangle path')].findLast(e=>e.getBoundingClientRect().height>1);
            if(!bar)throw new Error('Traffic contrast check needs a real data bar');
            bar.scrollIntoView({block:'center',behavior:'instant'});
            const r=bar.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
          }`);
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
          await wait(
            `!![...document.querySelectorAll('.recharts-default-tooltip')].find(e=>getComputedStyle(e).visibility==='visible')`
          );
          const colors = await evaluateFunction(`function() {
            const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});
            const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
            const background=e=>{if(!e)return [255,255,255];const c=rgba(getComputedStyle(e).backgroundColor),below=background(e.parentElement);return c.slice(0,3).map((v,i)=>v*c[3]/255+below[i]*(1-c[3]/255));};
            const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
            const sample=e=>{const c=rgba(getComputedStyle(e).color),bg=background(e),fg=c.slice(0,3).map((v,i)=>v*c[3]/255+bg[i]*(1-c[3]/255)),a=luminance(fg),b=luminance(bg);return {label:e.textContent.trim(),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};};
            const tooltip=[...document.querySelectorAll('.recharts-default-tooltip')].find(e=>getComputedStyle(e).visibility==='visible');
            const selects=[...document.querySelectorAll('[aria-label="Analytics report filters"] select')];
            return {schemes:selects.map(e=>getComputedStyle(e).colorScheme),rows:[...selects,...selects.flatMap(e=>[...e.options]),...tooltip.querySelectorAll('.recharts-tooltip-label,.recharts-tooltip-item')].map(sample),tooltipBackground:getComputedStyle(tooltip).backgroundColor};
          }`);
          assert.equal(
            colors.rows.length,
            9,
            'Contrast checks cover both selects, four options and tooltip label/values'
          );
          for (const row of colors.rows)
            assert(
              row.ratio >= 4.5,
              `${palette}/${dark}: ${row.label} contrast ${row.ratio.toFixed(2)}`
            );
          if (dark)
            assert(
              colors.schemes.every((scheme) => scheme === 'dark'),
              `${palette}: native dropdowns need the dark color scheme`
            );
          for (const selector of ['#dashboard-traffic-range', '#dashboard-analytics-mode']) {
            const value = await evaluateFunction(
              `function(selector) {return document.querySelector(selector).value;}`,
              selector
            );
            await click(selector);
            for (const type of ['keyDown', 'keyUp'])
              await send('Input.dispatchKeyEvent', {
                type,
                key: 'Escape',
                code: 'Escape',
                windowsVirtualKeyCode: 27,
              });
            assert.equal(
              await evaluateFunction(
                `function(selector) {return document.querySelector(selector).value;}`,
                selector
              ),
              value,
              'Opening/dismissing native options must not change the report'
            );
          }
          console.log(
            `PASS Dashboard contrast: ${palette}/${dark ? 'dark' : 'light'}, native option scheme, open/dismiss and tooltip text >=4.5:1.`
          );
        }
      }
      assert.equal(
        lightAccents.size,
        3,
        'The three admin presets must produce three actual accent colors'
      );
      await evaluate('document.documentElement.dataset.adminPalette="charcoal-blue"');
      await click('header button[aria-label="Use light mode"]');
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
          const activity = await evaluate(`(() => {
            const title=[...document.querySelectorAll('h3')].find(e=>e.textContent==='Recent Activity');
            const card=title.parentElement,list=title.nextElementSibling,button=card.querySelector('button');
            const a=list.getBoundingClientRect(),b=button.getBoundingClientRect(),c=card.getBoundingClientRect();
            return {alignment:getComputedStyle(card).alignSelf,growth:getComputedStyle(list).flexGrow,
              gap:b.top-a.bottom,bottom:c.bottom-b.bottom};
          })()`);
          assert.equal(
            activity.alignment,
            'flex-start',
            'Recent Activity keeps its own content height'
          );
          assert.equal(
            activity.growth,
            '0',
            'The short activity list must not fill the chart height'
          );
          assert(activity.gap >= 15 && activity.gap <= 17, 'History sits directly below the list');
          assert(activity.bottom >= 19 && activity.bottom <= 22, 'No large blank footer space');
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
      for (const scenario of [
        {
          query: 'collection=hybrid',
          text: 'Configured collection: Hybrid (Strict + Balanced)',
          empty: false,
        },
        {
          query: 'collection=hybrid&traffic=empty',
          text: 'A newly enabled mode has no earlier history.',
          empty: true,
        },
        {
          query: 'collection=strict&traffic=empty',
          text: 'collection for this report is currently off.',
          empty: true,
        },
        {
          query: 'collection=hybrid&analytics=off&traffic=empty',
          text: 'Configured collection: Off',
          empty: true,
        },
        {
          query: 'collection=hybrid&traffic=repair',
          text: 'Run Database Schema Repair to enable storage for this report.',
          repair: true,
        },
      ]) {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}/zangetsu/admin/dashboard?role=Admin&${scenario.query}`,
        });
        await wait(
          '!!document.querySelector("#dashboard-analytics-mode") && !document.body.textContent.includes("Loading the selected report...")'
        );
        await evaluate(
          `(() => {const e=document.querySelector('#dashboard-analytics-mode');e.value='balanced';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await wait(
          'window.__qaAnalyticsRequests.some(q=>q.includes("mode=balanced")) && !document.body.textContent.includes("Loading the selected report...")'
        );
        assert.equal(
          await evaluateFunction(
            `function(text){return document.body.textContent.includes(text);}`,
            scenario.text
          ),
          true,
          scenario.query
        );
        assert.deepEqual(
          await evaluate(
            `Array.from(document.querySelector('#dashboard-analytics-mode').options,e=>e.value)`
          ),
          ['balanced', 'strict'],
          'Hybrid is collection policy, never a third report'
        );
        assert.equal(
          await evaluate('window.__qaAnalyticsRequests.some(q=>q.includes("mode=hybrid"))'),
          false
        );
        if (scenario.repair)
          assert.equal(
            await evaluate(
              'document.body.textContent.includes("A newly enabled mode has no earlier history.")'
            ),
            false,
            'Unavailable storage is not a healthy zero report'
          );
      }
      for (const role of ['Admin', 'Moderator']) {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}/zangetsu/admin/dashboard?role=${role}&collection=strict`,
        });
        await wait('!!document.querySelector("#dashboard-analytics-mode")');
        assert.equal(
          await evaluate('!!document.querySelector("#dashboard-analytics-settings")'),
          false,
          `${role} without the server capability must not receive a settings shortcut`
        );
        await evaluate(
          `(() => {const e=document.querySelector('#dashboard-analytics-mode');e.value='balanced';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await wait(
          'document.body.textContent.includes("Ask the Primary Admin to choose Balanced or Hybrid")'
        );
      }
      for (const [base, actor] of [
        ['', 'role=Root'],
        ['/zangetsu', 'role=Admin&owner=1'],
      ]) {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/dashboard?${actor}&collection=strict`,
        });
        await wait('!!document.querySelector("#dashboard-analytics-settings")');
        await evaluate(
          `(() => {const e=document.querySelector('#dashboard-analytics-mode');e.value='balanced';e.dispatchEvent(new Event('change',{bubbles:true}));})()`
        );
        await wait('document.body.textContent.includes("Choose Balanced or Hybrid")');
        await metrics(base ? 390 : 1440, 1000);
        assert.equal(
          await evaluate('document.documentElement.scrollWidth>innerWidth'),
          false,
          'Collection guidance and the owner shortcut must wrap without horizontal overflow'
        );
        await click('#dashboard-analytics-settings');
        await wait(
          `!!document.querySelector('[role=dialog][aria-label="Analytics and privacy settings"]')`
        );
        assert.equal(
          await evaluate('location.pathname+location.search'),
          `${base}/admin/extensions?tab=plugins&configure=vp_analytics`,
          'The shortcut must honor the router basename and open the actual analytics panel'
        );
        await click('[aria-label="Close analytics settings"]');
        await wait('!document.querySelector("[role=dialog]")');
        assert.equal(await evaluate('window.__qaDashboardWrites'), 0);
        assert.equal(
          await evaluate('location.pathname+location.search'),
          `${base}/admin/extensions?tab=plugins`,
          'Closing the panel removes only its configuration request'
        );
        await evaluate('history.back()');
        await wait('!!document.querySelector("#dashboard-analytics-mode")');
      }
      for (const query of [
        'owner=1&tab=plugins&configure=unknown',
        'role=Admin&tab=plugins&configure=vp_analytics',
        'owner=1&tab=themes&configure=vp_analytics',
      ]) {
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}/zangetsu/admin/extensions?${query}`,
        });
        await wait('window.__qaReady===true');
        assert.equal(
          await evaluate('!!document.querySelector("[role=dialog]")'),
          false,
          'Unknown configuration requests and missing capabilities must not auto-open a panel'
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Dashboard browser: actual component/CSS at 320/390/768/1024/1440/1920px, three palettes/light-dark contrast; 7/30-day reports, Hybrid collection/report separation, historical/off/empty/repair states and Top Articles restoration; Primary Admin settings shortcut opens/closes the real plugin panel at root/subfolder, with capability-gated hints and no writes. Read-only fixture transport, not installed Zangetsu.'
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
        await evaluateFunction(
          `function(selector,value) {const f=document.querySelector(selector);Object.getOwnPropertyDescriptor(f instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(f,value);f.dispatchEvent(new Event('input',{bubbles:true}));}`,
          selector,
          value
        );
        await pause(100);
      };
      const press = async (text, within = 'section[aria-labelledby="calendar-heading"]') => {
        await evaluateFunction(
          `function(within,text) {const b=Array.from(document.querySelectorAll(within+' button')).find(b=>b.textContent.trim()===text);if(!b)throw new Error('Missing button '+text);b.setAttribute('data-qa-calendar-click','true');}`,
          within,
          text
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
      if (useCalendarSurfaces) {
        let cases = 0;
        for (const base of ['', '/zangetsu']) {
          for (const palette of ['charcoal-blue', 'meadow-gold', 'harbour-amber']) {
            await send('Page.navigate', {
              url: `http://127.0.0.1:${port}${base}/admin/calendar?role=Admin&palette=${palette}`,
            });
            await ready();
            for (const dark of [false, true]) {
              if (
                (await evaluate(
                  'document.querySelector(".admin-shell").classList.contains("dark")'
                )) !== dark
              )
                await click('button[aria-label="Use ' + (dark ? 'dark' : 'light') + ' mode"]');
              for (const width of [390, 820, 1440]) {
                await metrics(width, 1000);
                const surface = await evaluate(`(() => {
                  const root=document.querySelector('section[aria-labelledby="calendar-heading"]');
                  const panel=root.querySelector('[aria-busy]'),toolbar=root.querySelector('#calendar-month').closest('.rounded-2xl');
                  const active=root.querySelector('[data-calendar-day][aria-pressed="true"]');
                  return {canvas:getComputedStyle(document.querySelector('.admin-shell')).backgroundColor,
                    panel:getComputedStyle(panel).backgroundColor,toolbar:getComputedStyle(toolbar).backgroundColor,
                    border:getComputedStyle(panel).borderTopColor,active:getComputedStyle(active).backgroundColor,
                    overflow:document.documentElement.scrollWidth>innerWidth};
                })()`);
                assert.equal(surface.overflow, false, 'Calendar retains phone/desktop layout');
                assert.equal(
                  surface.panel,
                  dark ? 'rgb(32, 33, 36)' : 'rgb(253, 253, 253)',
                  'Calendar uses the same card surface as other admin panels'
                );
                assert.equal(
                  surface.toolbar,
                  surface.panel,
                  'Calendar toolbar and grid share the panel surface'
                );
                assert.notEqual(
                  surface.panel,
                  surface.canvas,
                  'Calendar panel remains distinct from the page canvas'
                );
                assert.notEqual(
                  surface.active,
                  surface.panel,
                  'Selected day keeps its own accent surface'
                );
                if (!dark) assert.equal(surface.border, 'rgb(203, 208, 213)');
                cases++;
                if (base === '' && palette === 'charcoal-blue' && [390, 1440].includes(width))
                  await screenshot(`calendar-surface-${dark ? 'dark' : 'light'}-${width}`);
              }
              await checkCalendarContrast(`${base}/${palette}/${dark ? 'dark' : 'light'} surfaces`);
              await press('New event');
              await wait('!!document.querySelector("#calendar-event-title")');
              await metrics(390, 1000);
              await wait(`!!document.querySelector('[aria-label="Calendar details"]')`);
              assert.equal(
                await evaluate(
                  `getComputedStyle(document.querySelector('[aria-label="Calendar details"]')).backgroundColor`
                ),
                dark ? 'rgb(32, 33, 36)' : 'rgb(253, 253, 253)',
                'Calendar drawer shares the panel surface'
              );
              await press('Cancel', '[aria-label="Calendar details"]');
              await click('[aria-label="Close calendar panel"]');
              await wait(`!document.querySelector('[aria-label="Calendar details"]')`);
              await metrics(1440, 1000);
            }
          }
        }
        assert.deepEqual(
          calendarFixture.snapshot(),
          before,
          'Surface checks never write Calendar records'
        );
        assert.deepEqual(errors, []);
        console.log(
          `PASS Calendar surfaces: ${cases} root/subfolder, three-palette, light/dark and phone/tablet/desktop cases retain distinct panel/canvas, selected dates, borders and control contrast. No fixture or installed records changed.`
        );
        return;
      }
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
      const checkVisibilityNotice = async (label, expected) => {
        const notice = await evaluateFunction(
          `function(label) {const node=document.querySelector('aside[aria-label="'+label+'"]');
          return node && {text:node.innerText,visible:node.getClientRects().length>0};}`,
          label
        );
        assert.ok(notice?.visible, `${label}: the notice must remain visible`);
        for (const text of expected) assert.ok(notice.text.includes(text), `${label}: ${text}`);
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      };
      const chooseSection = async (section, label) => {
        await evaluateFunction(
          `function(section,label) {
          const select=document.querySelector('#settings-section');
          if(select.getClientRects().length){select.value=section;select.dispatchEvent(new Event('change',{bubbles:true}));return;}
          const button=Array.from(document.querySelectorAll('.settings-tab-strip button')).find(node=>node.textContent.trim()===label);
          if(!button)throw new Error('Missing settings section '+section);button.click();}`,
          section,
          label
        );
      };
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
        await checkVisibilityNotice('Settings visibility', ['Public fields', 'private API keys']);
        await checkVisibilityNotice('Public ad code', [
          'even when an ad slot is disabled',
          'AdSense publisher IDs are public identifiers, not secret keys',
        ]);
        assert.equal(
          await evaluate(
            `Array.from(document.querySelectorAll('textarea')).every(field=>field.getAttribute('aria-describedby')==='adsettings-public-notice')`
          ),
          true
        );
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
        const point = await evaluateFunction(
          `function(selector) {
          const field=document.querySelector(selector);
          field.scrollIntoView({block:'center'});
          const box=field.getBoundingClientRect();
          return {x:box.right-4,y:box.bottom-4,height:box.height,width:box.width};
        }`,
          selector
        );
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
          const motion = await evaluateFunction(
            `function(selector) {
            const field=document.querySelector(selector);
            return {height:field.getBoundingClientRect().height,target:parseFloat(field.style.height),
              heightTransition:field.getAnimations().some(a=>a.transitionProperty==='height')};
          }`,
            selector
          );
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
      for (const base of ['', '/zangetsu']) {
        await metrics(base ? 390 : 1440, 1000);
        await send('Page.navigate', {
          url: `http://127.0.0.1:${port}${base}/admin/settings?owner=1`,
        });
        await wait('window.__qaReady && document.querySelectorAll("textarea").length===3');
        for (const dark of [false, true]) {
          if (dark) await click('button[aria-label="Use dark mode"]');
          await chooseSection('profile', 'Profile');
          await wait('!!document.querySelector("#profilesettings-public-notice")');
          await checkVisibilityNotice('Public profile information', [
            'even if no widget displays them',
            'email address you are willing to publish',
            'not your account',
          ]);
          assert.equal(
            await evaluate(
              `Array.from(document.querySelectorAll('#profilesettings-30,#profilesettings-42,#profilesettings-avatar-url,#profilesettings-54')).filter(field=>field.getAttribute('aria-describedby')==='profilesettings-public-notice'&&!field.disabled).length`
            ),
            4
          );
          await chooseSection('google', 'Google');
          await wait(
            'Array.from(document.querySelectorAll("aside")).some(node=>node.getAttribute("aria-label")==="Public Google identifiers")'
          );
          await checkVisibilityNotice('Public Google identifiers', [
            'not private API keys',
            'Analytics measurement IDs',
            'AdSense publisher IDs',
          ]);
          await chooseSection('api', 'API');
          await wait('!!document.querySelector("#api-ai-key-privacy")');
          assert.equal(await evaluate('document.querySelector("#api-ai-key").type'), 'password');
          assert.equal(
            await evaluate(
              'document.querySelector("#api-ai-key").getAttribute("aria-describedby")'
            ),
            'api-ai-key-privacy api-ai-key-help'
          );
          assert.ok(
            await evaluate(
              'document.querySelector("#api-ai-key-privacy").innerText.includes("newly typed values")'
            )
          );
          assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
          await chooseSection('ads', 'Ads');
          await wait('document.querySelectorAll("textarea").length===3');
          await checkVisibilityNotice('Public ad code', ['even when an ad slot is disabled']);
        }
      }
      await send('Page.navigate', {
        url: `http://127.0.0.1:${port}/zangetsu/admin/settings?appointed=1`,
      });
      await wait('window.__qaReady && document.querySelectorAll("textarea").length===3');
      await checkVisibilityNotice('Settings visibility', ['protected credential fields']);
      assert.equal(
        await evaluate('!!document.querySelector("#settings-section option[value=api]")'),
        false
      );
      await chooseSection('profile', 'Profile');
      await wait('!!document.querySelector("#profilesettings-public-notice")');
      assert.equal(await evaluate('document.querySelector("#profilesettings-42").disabled'), true);
      await checkVisibilityNotice('Public profile information', ['public site data']);
      assert.deepEqual(errors, []);
      console.log(
        'PASS Browser Ads workspace: desktop/tablet height, phone stacking, native vertical resize, exact code input and independent controls; public/profile/ad/Google and protected-key guidance at root/subfolder in light/dark mode, with unchanged appointed-admin restrictions. Fixture transport only, no installed-site writes. ' +
          JSON.stringify(cases)
      );
      return;
    }
    if (useEditorSpacing) {
      let cases = 0;
      for (const base of ['', '/zangetsu'])
        for (const type of ['post', 'page'])
          for (const fresh of [false, true])
            for (const dark of [false, true])
              for (const width of [390, 1440]) {
                await metrics(width, 1000);
                await evaluate('window.__qaReady=false');
                await send('Page.navigate', {
                  url: `http://127.0.0.1:${port}${base}/admin/editor?type=${type}&fresh=${fresh ? 1 : 0}`,
                });
                await wait('window.__qaReady && !!document.querySelector("#post-title")');
                if (dark) await click('button[aria-label="Use dark mode"]');
                if (width < 1280)
                  await evaluate(
                    `[...document.querySelectorAll('[aria-label="Editor sections"] button')].find(button=>button.textContent.includes('Publish & SEO')).click()`
                  );
                await pause(100);
                const gaps = await evaluate(`(()=>{
          const publishing=document.querySelector('#post-status').closest('fieldset').firstElementChild;
          const audit=[...document.querySelectorAll('h3')].find(item=>item.textContent.trim()==='Edit Log').parentElement.parentElement;
          const seo=document.querySelector('#post-meta-desc').closest('fieldset').firstElementChild;
          const [p,a,s]=[publishing,audit,seo].map(item=>item.getBoundingClientRect());
          const colors={audit:getComputedStyle(audit).backgroundColor,publishing:getComputedStyle(publishing).backgroundColor,seo:getComputedStyle(seo).backgroundColor,
            canvas:getComputedStyle(document.querySelector('.admin-shell')).backgroundColor};
          const original=audit.className;
          audit.classList.remove('bg-white','dark:bg-admin-panel');
          audit.classList.add('bg-slate-50/50','dark:bg-admin-panel/50');
          colors.legacy=getComputedStyle(audit).backgroundColor;
          audit.className=original;
          return {before:a.top-p.bottom,after:s.top-a.bottom,aligned:Math.abs(p.left-a.left)<1&&Math.abs(a.left-s.left)<1,writes:window.__qaWrites.length,colors};
        })()`);
                assert.ok(
                  Math.abs(gaps.before - 24) < 1 && Math.abs(gaps.after - 24) < 1,
                  `Editor card gaps: ${type}, fresh=${fresh}, dark=${dark}, ${width}px: ${JSON.stringify(gaps)}`
                );
                assert.ok(gaps.aligned);
                assert.equal(
                  gaps.colors.audit,
                  dark ? 'rgb(32, 33, 36)' : 'rgb(253, 253, 253)',
                  'Edit Log uses the shared solid card surface'
                );
                assert.equal(
                  gaps.colors.audit,
                  gaps.colors.publishing,
                  'Edit Log matches Publishing'
                );
                assert.equal(gaps.colors.audit, gaps.colors.seo, 'Edit Log matches SEO Settings');
                assert.notEqual(
                  gaps.colors.audit,
                  gaps.colors.canvas,
                  'The card stays distinct from the page'
                );
                assert.notEqual(
                  gaps.colors.audit,
                  gaps.colors.legacy,
                  'Restoring the translucent classes reproduces the old surface'
                );
                assert.equal(gaps.writes, 0);
                cases++;
              }
      assert.deepEqual(errors, []);
      console.log(
        `PASS Editor cards: ${cases} actual Post/Page new/existing, root/subfolder, phone/desktop and light/dark cases retain 24px spacing. Edit Log matches the solid Publishing/SEO surfaces and stays distinct from the canvas; the original translucent classes reproduce the old surface. No saves.`
      );
      return;
    }
    if (useRealEditor) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const title = async (value) => {
        await evaluateFunction(
          `function(value) {
          const field=document.querySelector('#post-title');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);
          field.dispatchEvent(new Event('input',{bubbles:true}));
        }`,
          value
        );
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
      evaluateFunction(
        `function(selector) {
      const element=document.querySelector(selector);
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
    }`,
        selector
      );
    const hoverNavigation = async (selector) => {
      const point = await evaluateFunction(
        `function(selector) {const element=document.querySelector(selector);element.scrollIntoView();const box=element.getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2}}`,
        selector
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
        for (const collapsed of [false, true]) {
          if (collapsed) await click('header button[aria-label="Collapse admin navigation"]');
          const brand = await evaluate(`(() => {
            const svg=[...document.querySelectorAll('aside svg[viewBox="0 0 256 256"]')].find(element=>element.getBoundingClientRect().width>0);
            if(!svg)return null;
            const context=document.createElement('canvas').getContext('2d');context.fillStyle=getComputedStyle(svg.querySelector('path')).fill;context.fillRect(0,0,1,1);
            return {fill:[...context.getImageData(0,0,1,1).data].slice(0,3),paths:svg.querySelectorAll('path').length,width:svg.getBoundingClientRect().width};
          })()`);
          assert.ok(brand, 'Admin uses the supplied vector in both sidebar states');
          assert.equal(brand.paths, 4);
          assert.deepEqual(brand.fill, [255, 255, 255], 'Admin brand stays white in both modes');
          assert.equal(brand.width, collapsed ? 28 : 32, 'Vector follows the actual sidebar slot');
          if (collapsed) await click('header button[aria-label="Expand admin navigation"]');
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1436, y: 2 });
        await pause(220);
        const parentSelector = 'nav button[title="Extensions"]';
        const pageSelector = 'nav a[title="Pages"]';
        const createSelector = 'nav button[title="Create"]';
        assert.equal(
          await evaluateFunction(
            `function(selector) {const style=getComputedStyle(document.querySelector(selector));const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.fillStyle=style.backgroundColor;context.fillRect(0,0,1,1);return context.getImageData(0,0,1,1).data[3]===255&&style.backdropFilter==='none'&&style.opacity==='1';}`,
            createSelector
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
