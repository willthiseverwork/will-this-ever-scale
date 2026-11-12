/** Fixed, non-sensitive categories only. Never log provider messages or audio. */
export function voiceFailureReason(error:unknown):'access_denied'|'authentication'|'throttled'|'timeout'|'provider_error' {
 const name=error instanceof Error?error.name:'';
 if(name==='AccessDeniedException'||name==='AccessDenied')return 'access_denied';
 if(['CredentialsProviderError','UnrecognizedClientException','InvalidClientTokenId','ExpiredTokenException'].includes(name))return 'authentication';
 if(['ThrottlingException','TooManyRequestsException','LimitExceededException'].includes(name))return 'throttled';
 if(['TimeoutError','AbortError'].includes(name))return 'timeout';
 return 'provider_error';
}
