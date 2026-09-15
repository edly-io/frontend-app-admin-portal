import 'core-js/stable';
import 'regenerator-runtime/runtime';

import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize, getConfig,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage } from '@edx/frontend-platform/react';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import App from './App';
import { createQueryClient } from './data/queryClient';
import messages from './i18n';

// Bundle the brand theme from the app's OWN origin. Indigo swaps @edx/brand to
// the edly brand-openedx fork at build time, so this is the edly theme in the
// tutor image (and the default brand when built standalone). Bundling avoids
// the CORB block the browser applies to indigo's cross-origin
// PARAGON_THEME_URLS on raw.githubusercontent.com.
import '@openedx/paragon/dist/core.css';
import '@openedx/paragon/dist/light.css';
import './index.scss';

// One client for the lifetime of the page. App itself gates on a query, so
// the provider has to sit outside <App/>, and it is created out here so a
// re-entrant APP_READY could never swap the cache out from under it.
const queryClient = createQueryClient();

const render = (children) => {
  const root = createRoot(document.getElementById('root'));
  root.render(children);
};

subscribe(APP_READY, () => {
  // frontend-platform's AppProvider sets the React Router basename to the full
  // PUBLIC_PATH *including* its trailing slash (e.g. "/admin-portal/"). React
  // Router v6 then refuses to match the slash-less "/admin-portal" URL, so the
  // bare path renders blank. Supply our own router with a trailing-slash-trimmed
  // basename, which matches BOTH "/admin-portal" and "/admin-portal/".
  const basename = (getConfig().PUBLIC_PATH || '/').replace(/\/+$/, '') || '/';
  render(
    <QueryClientProvider client={queryClient}>
      <AppProvider wrapWithRouter={false}>
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>,
  );
});

subscribe(APP_INIT_ERROR, (error) => {
  render(<ErrorPage message={error.message} />);
});

initialize({
  messages,
  requireAuthenticatedUser: true,
});
