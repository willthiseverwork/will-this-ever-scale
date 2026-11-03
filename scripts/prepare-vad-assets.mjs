/** Install pinned voice packages during a production build and serve their runtime assets locally. */
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
if(process.env.VERCEL_ENV==='production'){
 const temp=mkdtempSync(join(tmpdir(),'wtes-vad-'));
 try{
  copyFileSync(resolve('voice-assets/package.json'),join(temp,'package.json'));
  const lock=resolve('voice-assets/package-lock.json');if(existsSync(lock))copyFileSync(lock,join(temp,'package-lock.json'));
  const run=spawnSync('npm',[existsSync(lock)?'ci':'install','--ignore-scripts','--no-audit','--no-fund'],{cwd:temp,stdio:'inherit'});if(run.status!==0)throw new Error('Voice dependency installation failed');
  const component=spawnSync(process.execPath,['--import','tsx','--test','tests/voice-fallback.component.test.ts'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',WTES_JSDOM_PATH:join(temp,'node_modules/jsdom')}});if(component.status!==0)throw new Error('Voice fallback component test failed');
  const target=resolve('public/voice-assets');mkdirSync(target,{recursive:true});
  const vad=join(temp,'node_modules/@ricky0123/vad-web/dist'),ort=join(temp,'node_modules/onnxruntime-web/dist');
  for(const file of ['bundle.min.js','vad.worklet.bundle.min.js','silero_vad_legacy.onnx','silero_vad_v5.onnx','silero_vad_v6.onnx'])copyFileSync(join(vad,file),join(target,file));
  const ortFiles=readdirSync(ort).filter(x=>x==='ort.wasm.min.js'||x.endsWith('.wasm')||x.endsWith('.mjs'));if(!ortFiles.includes('ort.wasm.min.js')||!ortFiles.some(x=>x.endsWith('.wasm'))||!ortFiles.some(x=>x.endsWith('.mjs')))throw new Error('Voice runtime assets are incomplete');
  for(const file of ortFiles)copyFileSync(join(ort,file),join(target,file));
  copyFileSync(join(temp,'package-lock.json'),join(target,'dependency-lock.json'));
 }finally{rmSync(temp,{recursive:true,force:true})}
}
