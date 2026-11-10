import test from 'node:test';
import assert from 'node:assert/strict';
import {BlobPreconditionFailedError} from '@vercel/blob';
import {reserveRefresh} from '../lib/demo-snapshot';

test('overlapping immutable refresh locks guard boundary and concurrent attempts',async()=>{
 const seen=new Set<string>();const create=async(path:string)=>{if(seen.has(path))throw new BlobPreconditionFailedError();seen.add(path)};
 assert.equal(await reserveRefresh(899_999,create),true);
 assert.equal(await reserveRefresh(900_000,create),false);
 assert.equal(await reserveRefresh(1_800_000,create),true);
 const fresh=new Set<string>();const concurrent=async(path:string)=>{if(fresh.has(path))throw new BlobPreconditionFailedError();fresh.add(path)};
 assert.deepEqual((await Promise.all([reserveRefresh(1_000_000,concurrent),reserveRefresh(1_000_000,concurrent)])).sort(),[false,true]);
});
