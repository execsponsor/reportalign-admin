/**
 * MSAL (Microsoft Authentication Library) configuration for Entra ID SSO
 */

import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const authority = import.meta.env.VITE_ENTRA_AUTHORITY;
const apiAppId = import.meta.env.VITE_ENTRA_API_APP_ID;

if (!clientId || !authority || !apiAppId) {
  throw new Error('Missing required Entra ID environment variables: VITE_ENTRA_CLIENT_ID, VITE_ENTRA_AUTHORITY, VITE_ENTRA_API_APP_ID');
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) console.error('[MSAL]', message);
      },
    },
  },
};

export const loginRequest = {
  scopes: [`api://${apiAppId}/access_as_admin`],
  domainHint: 'organizations',
};

export const msalInstance = new PublicClientApplication(msalConfig);
