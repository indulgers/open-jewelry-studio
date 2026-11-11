import { defineConfig } from 'vitest/config';
import {RING02_TEMPLATE} from './src/stone-first/ring02/assets.ts';
import {RING_CATALOG} from './src/stone-first/catalog.ts';
import {STUDIO_ENVIRONMENT} from './src/viewer/studioEnvironment.ts';

export default defineConfig({
  plugins: [{
    name:'jewelry-direct-entry-preload',
    apply:'build',
    transformIndexHtml:{
      order:'post',
      handler(_html,{bundle}){
        const routes=Object.fromEntries(RING_CATALOG.map(template=>{
          const suffix=template.kind==='parametric'?'/ring02/Ring02Studio.tsx':'/reference/SourceRingStudio.tsx';
          const editor=Object.values(bundle??{}).find(chunk=>chunk.type==='chunk'&&chunk.facadeModuleId?.endsWith(suffix));
          if(!editor||editor.type!=='chunk')return [template.editor,[]];
          return [template.editor,[
            [template.model,'fetch'],
            ...(template.kind==='parametric'?[[RING02_TEMPLATE.oval,'fetch']]:[]),
            [STUDIO_ENVIRONMENT.url,'fetch'],
            ...[editor.fileName,...editor.imports].map(file=>['/'+file,'module']),
          ]];
        }));
        // Download only the selected model as HTML arrives, before React evaluates the hash.
        return [{tag:'script',injectTo:'head-prepend',children:`
          for(const [href,type] of (${JSON.stringify(routes)}[location.hash]||[])){
            const link=document.createElement('link');
            link.rel=type==='module'?'modulepreload':'preload';
            if(type!=='module')link.as=type;
            link.crossOrigin='anonymous';
            link.href=href;
            document.head.append(link);
          }`},
          {tag:'script',injectTo:'body',children:`
            if(${JSON.stringify(RING_CATALOG.map(template=>template.editor))}.includes(location.hash)){
              const root=document.getElementById('root');
              if(!root.hasChildNodes())root.innerHTML='<div role="status" aria-label="正在加载三维预览" style="min-height:65vh;display:grid;place-items:center"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#8c6d1f" stroke-width="1.5" stroke-dasharray="38 19"/></svg></div>';
            }`},
        ];
      },
    },
  }],
  server: {
    watch:{usePolling:true,interval:400},
    allowedHosts:['terminal.local'],
    proxy:{'/api/forme':{target:process.env.FORME_API_ORIGIN||'http://127.0.0.1:8787'}},
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true },
});
