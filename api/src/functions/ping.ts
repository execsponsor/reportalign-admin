import { app } from '@azure/functions';

app.http('ping', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ping',
  handler: async () => ({ jsonBody: { pong: true } }),
});
