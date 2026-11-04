import {limits} from '../forme/design-policy.js';
const $=id=>document.getElementById(id);
const root=$('concept'),frame=$('model');
const looks={
  gallery:{title:'A · 铂纸画廊',note:'衬线字与纸白画布，右侧参数像一张珠宝作品签。'},
  noir:{title:'B · 夜色展柜',note:'炭黑全景与底部工具台，把视线留给金属反光。'},
  celadon:{title:'C · 青瓷工坊',note:'青灰画布与左侧编辑栏，适合持续打磨模型。'},
};
const metalNames={silver:'银色',gold:'金色',rose:'玫瑰金',graphite:'石墨色'};
let api=null;
function updateLocation(){const params=new URLSearchParams({look:root.dataset.look});if($('device').getAttribute('aria-pressed')==='true')params.set('device','phone');history.replaceState(null,'','?'+params);}
function syncCanvasTheme(){if(api)frame.contentDocument.documentElement.style.setProperty('--study-background',({gallery:'#f5f3ee',noir:'#171717',celadon:'#e4ece5'})[root.dataset.look]);}
function fitView(){const doc=frame.contentDocument;doc.getElementById('resetView').click();$('orientation').value='free';}
function setLook(look){if(!looks[look])look='gallery';root.dataset.look=look;document.querySelectorAll('[data-look]').forEach(el=>{if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(el.dataset.look===look));});$('lookTitle').textContent=looks[look].title;$('lookNote').textContent=looks[look].note;syncCanvasTheme();updateLocation();}
function setPhone(phone){document.querySelector('.preview-surround').classList.toggle('phone',phone);$('device').setAttribute('aria-pressed',String(phone));$('device').textContent=phone?'桌面预览':'手机预览';updateLocation();}
const params=new URLSearchParams(location.search),initialLook=params.get('look'),initialPhone=params.get('device')==='phone';
setLook(initialLook);setPhone(initialPhone);
document.querySelectorAll('button[data-look]').forEach(b=>b.onclick=()=>setLook(b.dataset.look));
$('device').onclick=()=>setPhone($('device').getAttribute('aria-pressed')!=='true');
function openResearch(open){$('research').hidden=!open;$('about').setAttribute('aria-expanded',String(open));if(open)$('closeResearch').focus();else $('about').focus();}
$('about').onclick=()=>openResearch($('research').hidden);$('closeResearch').onclick=()=>openResearch(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('research').hidden)openResearch(false);});
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-panel]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));document.querySelectorAll('[data-content]').forEach(p=>p.hidden=p.dataset.content!==b.dataset.panel);});
const fields=[{key:'bloom',name:'花瓣开合',unit:'%',group:'shape'},{key:'twist',name:'花瓣扭转',unit:'°',group:'shape'}, {key:'boreDiameter',name:'戒指内径',unit:' mm',group:'size'},{key:'band',name:'花纹宽度',unit:' mm',group:'size'}];
const format=(field,value)=> (field.unit===' mm'?Number(value).toFixed(1):Number(value))+field.unit;
for(const f of fields){const [min,max,step]=limits[f.key];const wrapper=document.createElement('div');wrapper.className='control';wrapper.innerHTML=`<label for="edit-${f.key}">${f.name}<output id="value-${f.key}" for="edit-${f.key}"></output></label><input id="edit-${f.key}" type="range" min="${min}" max="${max}" step="${step}" disabled><div class="endpoints"><span>${format(f,min)}</span><span>${format(f,max)}</span></div>`;$(f.group+'Controls').append(wrapper);const input=$('edit-'+f.key);input.oninput=()=>{$('value-'+f.key).textContent=format(f,input.value);};input.onchange=()=>{api?.setParam(f.key,Number(input.value));sync();};}
function sync(){if(!api)return;const s=api.getState(),doc=frame.contentDocument;for(const f of fields){$('edit-'+f.key).value=s[f.key];$('value-'+f.key).textContent=format(f,s[f.key]);}
  document.querySelectorAll('[data-material]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.material===s.material)));
  document.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.finish===s.finish)));
  $('metalName').textContent=metalNames[s.material];$('spec').textContent=`${metalNames[s.material]} · 内径 ${s.boreDiameter.toFixed(1)} mm · ${s.count} 枚花形`;
  $('summaryCount').textContent=s.count+' 枚花形';$('summaryDiameter').textContent=s.boreDiameter.toFixed(1)+' mm';$('stripCount').textContent=s.count+' 枚 · 环形排列';
  $('undo').disabled=doc.getElementById('undoBtn').disabled;$('redo').disabled=doc.getElementById('redoBtn').disabled;
  $('feedback').textContent=doc.getElementById('editFeedback').textContent;
}
for(const key of ['material','finish'])document.querySelectorAll('[data-'+key+']').forEach(b=>b.onclick=()=>{api?.setParam(key,b.dataset[key]);sync();});
function press(id){frame.contentDocument.getElementById(id).click();sync();}
$('undo').onclick=()=>press('undoBtn');$('redo').onclick=()=>press('redoBtn');$('reset').onclick=()=>{press('resetDesignBtn');fitView();};
$('center').onclick=fitView;
$('wire').onclick=()=>{const next=$('wire').getAttribute('aria-pressed')!=='true';press(next?'wireBtn':'solidBtn');$('wire').setAttribute('aria-pressed',String(next));};
for(const id of ['projection','orientation'])$(id).onchange=()=>{const el=frame.contentDocument.getElementById(id);el.value=$(id).value;el.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));if(id==='orientation'&&el.value==='free')fitView();};
function enable(ready){for(const el of root.querySelectorAll('.editor button,.editor input,.history button,.stage-actions button,.view-options select'))el.disabled=!ready;}
enable(false);
const canvasStyle=`html,body{color-scheme:normal!important;background:var(--study-background,#f5f3ee)!important;width:100%;height:100%;overflow:hidden}body{display:block!important}.topbar,.inspector,.statusbar,.stage-header,.view-nav,.stage-side-tools,.stage-actions,.stage-bottom{display:none!important}.workspace{display:block!important;position:absolute!important;inset:0!important;padding:0!important;margin:0!important}.stage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important;background:var(--study-background,#f5f3ee)!important}.canvas-3d{inset:0!important;width:100%!important;height:100%!important}.error{background:#fff!important;color:#222!important}`;
async function loadModel(){try{
  const response=await fetch('/forme/index.html');if(!response.ok)throw new Error('模型页面暂不可用');
  const html=await response.text();
  // Preview-only adapter: use the existing renderer and editing constraints, without changing the shipping editor.
  frame.srcdoc=html.replace("material:'silver',finish:'polished'","material:'gold',finish:'polished'").replace('<head>','<head><base href="/forme/">').replace('</head>',`<style>${canvasStyle}</style></head>`);
  await new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if(frame.contentWindow?.__FORME__){clearInterval(timer);resolve();}else if(++count>150){clearInterval(timer);reject(new Error('模型加载超时'));}},100);});
  api=frame.contentWindow.__FORME__;syncCanvasTheme();fitView();
  frame.contentDocument.getElementById('glCanvas').addEventListener('pointermove',e=>{if(e.buttons)$('orientation').value='free';});
  root.dataset.ready='true';$('loading').hidden=true;enable(true);sync();$('feedback').textContent='模型已就绪 · 编辑仅在当前页面有效';
}catch(error){$('loading').innerHTML='';const p=document.createElement('p');p.textContent=error.message+'，请刷新重试。';$('loading').append(p);$('feedback').textContent='模型未就绪';}}
loadModel();
