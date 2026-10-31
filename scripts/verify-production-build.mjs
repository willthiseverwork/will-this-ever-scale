import {spawnSync} from 'node:child_process';
// This runs in the hosted production build. Unit fixtures get no provider credentials.
const env={...process.env};
for(const key of Object.keys(env))if(/^(PAYPAL_|WTES_|AWS_|BLOB_|ANTHROPIC_|AI_PROVIDER$)/.test(key))delete env[key];
const result=spawnSync('npm',['test'],{stdio:'inherit',env});
if(result.error)process.exit(1);
process.exit(result.status??1);
