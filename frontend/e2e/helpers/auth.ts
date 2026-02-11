import { Page } from '@playwright/test';

/**
 * Sets auth state in localStorage so the app thinks we're logged in.
 * The app uses zustand persist with key 'mixmodel-auth'.
 * Tokens must be valid JWT format because App.tsx calls checkTokenExpiry() on mount,
 * which parses the JWT payload and checks the exp field.
 */
export async function setAuthState(page: Page) {
  await page.addInitScript(() => {
    // Create JWT-format tokens with far-future expiry
    function makeJWT(payload: object): string {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = btoa(JSON.stringify(payload));
      return `${header}.${body}.mock-signature`;
    }

    const accessToken = makeJWT({
      sub: 'usr_test_001',
      exp: Math.floor(Date.now() / 1000) + 86400,
    });
    const refreshToken = makeJWT({
      sub: 'usr_test_001',
      exp: Math.floor(Date.now() / 1000) + 604800,
    });

    const authState = {
      state: {
        user: {
          id: 'usr_test_001',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'admin',
          workspace_id: 'ws_test_001',
          created_at: '2025-01-01T00:00:00Z',
        },
        accessToken,
        refreshToken,
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem('mixmodel-auth', JSON.stringify(authState));
  });
}

export async function clearAuthState(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('mixmodel-auth');
  });
}
