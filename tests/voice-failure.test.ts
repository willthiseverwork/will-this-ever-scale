import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceFailureReason} from '../lib/voice/failure';
test('transcription diagnostics classify known failures without exposing provider messages',()=>{
 for(const [name,expected] of [['AccessDeniedException','access_denied'],['CredentialsProviderError','authentication'],['ThrottlingException','throttled'],['TimeoutError','timeout'],['Unknown','provider_error']]){
  const error=new Error('sensitive provider detail');error.name=name;assert.equal(voiceFailureReason(error),expected);
 }
 assert.equal(voiceFailureReason('sensitive provider detail'),'provider_error');
});
