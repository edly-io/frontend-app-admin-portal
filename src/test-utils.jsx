/* eslint-disable import/no-extraneous-dependencies */
// Test-only helper: pulls in RTL and react-intl (test/transitive deps).
import React from 'react';
import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient } from './data/queryClient';

/**
 * Render a component wrapped in the providers Paragon/our pages need:
 * QueryClientProvider (all data fetching goes through React Query),
 * IntlProvider (Paragon ModalDialog/Toast use react-intl) and a Router.
 *
 * The client is built per render — a module-level one would leak cached
 * responses from one test into the next. It is the same factory the app uses,
 * so tests exercise the production defaults (notably `retry: false`, without
 * which the fail-closed gate tests would sit through 1s/2s/4s of backoff).
 */
export const renderWithProviders = (ui, { route = '/' } = {}) => render(
  <QueryClientProvider client={createQueryClient({ gcTime: 0 })}>
    <IntlProvider locale="en" messages={{}}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </IntlProvider>
  </QueryClientProvider>,
);

// Re-export everything from RTL so tests import from one place.
export * from '@testing-library/react';
