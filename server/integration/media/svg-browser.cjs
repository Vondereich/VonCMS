const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const logoSources = Object.fromEntries(
  ['wide', 'tall'].map((ratio) => {
    const xml =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      (ratio === 'wide' ? '200 50' : '50 200') +
      '"><defs><style>.red{fill:#f00}.blue{fill:#00f}</style></defs><rect width="100" height="200" class="red"/><rect x="100" width="100" height="200" class="blue"/></svg>';
    const php =
      process.env.PHP_BIN ||
      (process.platform === 'win32'
        ? 'C:/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php.exe'
        : 'php');
    const result = spawnSync(
      php,
      [
        '-r',
        'define("VONCMS_CORE_LOADED",true);require $argv[1];echo SvgLogo::sanitize(stream_get_contents(STDIN));',
        path.join(root, 'public/api/media/SvgLogo.php'),
      ],
      { input: xml, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return [ratio, 'data:image/svg+xml,' + encodeURIComponent(result.stdout)];
  })
);
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import ThemeLogo from '/src/themes/shared/components/ThemeLogo.tsx';
import '/src/index.css';
const image=ratio=>(${JSON.stringify(logoSources)})[ratio];
function Fixture(){
  const [invert,setInvert]=React.useState(false);window.__qaLogoInvert=setInvert;
  return React.createElement('main',{style:{padding:8}},['wide','tall'].flatMap(ratio=>[false,true].map(title=>React.createElement('section',{key:ratio+title,'data-ratio':ratio,'data-title':String(title),style:{marginBottom:12}},React.createElement(ThemeLogo,{src:image(ratio),alt:'SVG logo '+ratio,useLogoAsTitle:title,invertLogoInDarkMode:invert})))));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`;
async function verify({ send, evaluate, wait, metrics, port, errors }) {
  let cases = 0;
  for (const base of ['', '/zangetsu']) {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/qa-svg-logo` });
    await wait(
      'document.querySelectorAll("section img").length===4 && Array.from(document.querySelectorAll("section img")).every(i=>i.complete&&i.naturalWidth>0)'
    );
    for (const width of [375, 768, 1440]) {
      await metrics(width, 1000);
      for (const dark of [false, true])
        for (const invert of [false, true]) {
          await evaluate(
            `document.documentElement.classList.toggle('dark',${dark});window.__qaLogoInvert(${invert});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`
          );
          const slots = await evaluate(
            `Array.from(document.querySelectorAll('section')).map(section=>{const img=section.querySelector('img'),r=img.getBoundingClientRect(),s=img.parentElement.getBoundingClientRect(),c=getComputedStyle(img);return{title:section.dataset.title==='true',width:r.width,height:r.height,slotWidth:s.width,slotHeight:s.height,objectFit:c.objectFit,filter:c.filter}})`
          );
          for (const value of slots) {
            const expected = value.title
              ? width < 640
                ? [150, 48]
                : [180, 56]
              : width < 640
                ? [112, 38]
                : [140, 45];
            assert.deepEqual(
              [value.slotWidth, value.slotHeight],
              expected,
              'Existing logo slot limits changed'
            );
            assert(
              value.width > 0 &&
                value.height > 0 &&
                value.width <= expected[0] + 0.1 &&
                value.height <= expected[1] + 0.1,
              'SVG escaped its original CSS box'
            );
            assert.equal(value.objectFit, 'contain');
            assert.equal(
              value.filter !== 'none',
              dark && invert,
              'Dark invert must remain opt-in and theme-aware'
            );
            cases++;
          }
          assert.equal(
            await evaluate('document.documentElement.scrollWidth>innerWidth'),
            false,
            'SVG logo widened the page'
          );
        }
    }
    const pixel = await evaluate(
      `(()=>{const i=document.querySelector('[data-ratio="wide"] img'),c=document.createElement('canvas');c.width=200;c.height=50;const ctx=c.getContext('2d');ctx.drawImage(i,0,0,200,50);return{left:[...ctx.getImageData(25,25,1,1).data],right:[...ctx.getImageData(175,25,1,1).data]}})()`
    );
    assert.deepEqual(pixel.left, [255, 0, 0, 255]);
    assert.deepEqual(pixel.right, [0, 0, 255, 255]);
  }
  const settings = fs.readFileSync(
    path.join(root, 'src/plugins/von-core/features/settings/components/GeneralSettings.tsx'),
    'utf8'
  );
  assert.equal(
    (settings.match(/accept="[^"]*\.svg/g) || []).length,
    1,
    'Only Site Logo picker may allow SVG'
  );
  for (const theme of ['default', 'prism', 'techpress', 'digest', 'portfolio', 'corporate-pro']) {
    const source = fs.readFileSync(path.join(root, `src/themes/${theme}/Layout.tsx`), 'utf8');
    assert(
      source.includes('<ThemeLogo') && source.includes('src={settings.logoUrl'),
      'All six themes must retain shared logo sizing'
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS SVG logo browser: ${cases} shared-component sizing/filter cases, root/subfolder phone/tablet/desktop light/dark, wide/tall and normal/title slots; rendered CSS colours match pixels, six-theme callers and logo-only picker contract retained.`
  );
}
module.exports = { fixture, verify };
