import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider, MsalAuthenticationTemplate } from '@azure/msal-react';
import { InteractionType } from '@azure/msal-browser';
import { msalInstance, loginRequest } from './lib/auth';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

function LoadingComponent() {
  return (
    <div className="flex items-center justify-center h-screen bg-admin-bg">
      <div className="text-center">
        <div className="w-12 h-12 rounded-lg bg-admin-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <p className="text-admin-muted text-sm">Authenticating with Entra ID...</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: unknown }) {
  return (
    <div className="flex items-center justify-center h-screen bg-admin-bg">
      <div className="text-center max-w-md">
        <p className="text-red-400 text-lg font-semibold mb-2">Authentication Failed</p>
        <p className="text-admin-muted text-sm">{error instanceof Error ? error.message : 'Unable to authenticate. Please try again.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-admin-accent text-white rounded-lg text-sm hover:bg-admin-accent-hover transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// Initialize MSAL before rendering
msalInstance.initialize().then(() => {
  // Handle redirect response
  msalInstance.handleRedirectPromise().then(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <MsalAuthenticationTemplate
            interactionType={InteractionType.Redirect}
            authenticationRequest={loginRequest}
            loadingComponent={LoadingComponent}
            errorComponent={ErrorComponent}
          >
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </QueryClientProvider>
          </MsalAuthenticationTemplate>
        </MsalProvider>
      </React.StrictMode>
    );
  });
});
