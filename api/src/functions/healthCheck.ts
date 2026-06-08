import { app, HttpRequest, HttpResponseInit } from '@azure/functions';

async function healthCheck(_req: HttpRequest): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: { status: 'ok', timestamp: new Date().toISOString() },
  };
}

app.http('healthCheck', { methods: ['GET'], authLevel: 'anonymous', route: 'health', handler: healthCheck });
