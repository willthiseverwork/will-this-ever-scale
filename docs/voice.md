# Voice input

Voice input uses Amazon Transcribe Streaming in `us-east-1`, through the same production Vercel OIDC role as Bedrock. It accepts one browser-captured 16 kHz mono PCM clip and immediately returns its text; audio and transcripts are not stored or logged.

The production flag is intentionally disabled until the role has this least-privilege policy in addition to its Bedrock permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "transcribe:StartStreamTranscription",
    "Resource": "*"
  }]
}
```

After that policy is attached to `WTES_BEDROCK_ROLE_ARN`, set `WTES_VOICE_ENABLED=true` in the WTES production environment. Keep it false until the per-user/day and monthly-use Blob counters have been production-tested.
