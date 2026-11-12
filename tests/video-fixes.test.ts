import {test} from 'node:test';
import assert from 'node:assert/strict';
import {latestAnalysisMonth,reminderPreviewReady,VOICE_UI_ENABLED} from '../lib/video-fixes';

test('voice controls are available subject to service and access checks',()=>assert.equal(VOICE_UI_ENABLED,true));
test('reminder review waits for both actual message and subject',()=>{
 assert.equal(reminderPreviewReady(null),false);
 assert.equal(reminderPreviewReady({input:{subject:'A friendly reminder'}}),false);
 assert.equal(reminderPreviewReady({input:{subject:' ',note:'Text'}}),false);
 assert.equal(reminderPreviewReady({input:{subject:'A friendly reminder',note:'Please pay'}}),true);
});
test('plan label uses the latest analysis month including a partial current month',()=>{
 assert.equal(latestAnalysisMonth([{month:'2026-10'},{month:'2026-11'}]),'2026-11');
 assert.equal(latestAnalysisMonth([]),undefined);
});
