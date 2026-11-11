import { defineConfig } from 'vitest/config';
import {RING02_TEMPLATE} from './src/stone-first/ring02/assets.ts';
import {STUDIO_ENVIRONMENT} from './src/viewer/studioEnvironment.ts';

export default defineConfig({
  plugins: [{
    name:'ring02-direct-entry-preload',
    apply:'build',
    transformIndexHtml:{
      order:'post',
      handler(_html,{bundle}){
        const editor=Object.values(bundle??{}).find(
          chunk=>chunk.type==='chunk'&&chunk.facadeModuleId?.endsWith('/ring02/Ring02Studio.tsx'),
        );
        if(!editor||editor.type!=='chunk')return;
        const assets=[
          [RING02_TEMPLATE.image,'image'],
          [RING02_TEMPLATE.model,'fetch'],
          [RING02_TEMPLATE.oval,'fetch'],
          [STUDIO_ENVIRONMENT.url,'fetch'],
          ...[editor.fileName,...editor.imports].map(file=>['/'+file,'module']),
        ];
        // Start route-specific downloads as HTML arrives, before React evaluates the hash.
        const pendingPreview=`<figure class="ring02-boot-preview" role="status" style="margin:0;padding:clamp(64px,8vw,110px) 16px 0;text-align:center;color:#635f5b">
          <img src="${RING02_TEMPLATE.image}" alt="银色围钻戒指原款" width="822" height="598" style="display:block;margin:0 auto;width:min(100%,690px);height:min(49dvh,450px);object-fit:contain;mix-blend-mode:multiply">
          <figcaption style="margin-top:10px;font-size:13px">原款参考 · 正在加载 3D</figcaption>
        </figure>`;
        return [{tag:'script',injectTo:'head-prepend',children:`
          if(location.hash===${JSON.stringify(RING02_TEMPLATE.editor)}){
            for(const [href,type] of ${JSON.stringify(assets)}){
              const link=document.createElement('link');
              link.rel=type==='module'?'modulepreload':'preload';
              if(type!=='module')link.as=type;
              if(type!=='image')link.crossOrigin='anonymous';
              link.href=href;
              document.head.append(link);
            }
          }`},
          {tag:'script',injectTo:'body',children:`
            if(location.hash===${JSON.stringify(RING02_TEMPLATE.editor)}){
              const root=document.getElementById('root');
              if(!root.hasChildNodes())root.insertAdjacentHTML('afterbegin',${JSON.stringify(pendingPreview)});
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
