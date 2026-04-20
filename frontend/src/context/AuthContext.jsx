import { createContext, useEffect, useMemo, useState } from 'react';
import { getProfile, loginRequest, registerRequest, updateUserLanguage } from '../services/api';

export const AuthContext = createContext(null);

const TOKEN_KEY = 'expenseapp_token';
const USER_KEY = 'expenseapp_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!token) {
      setIsBootstrapping(false);
      return;
    }

    let ignore = false;

    async function bootstrap() {
      try {
        const profile = await getProfile(token);
        if (!ignore) {
          setUser(profile);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
        }
      } catch (error) {
        if (!ignore) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isBootstrapping,
      async login(credentials) {
        const response = await loginRequest(credentials);
        setToken(response.access_token);
        setUser(response.user);
        localStorage.setItem(TOKEN_KEY, response.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      },
      async register(payload) {
        const response = await registerRequest(payload);
        setToken(response.access_token);
        setUser(response.user);
        localStorage.setItem(TOKEN_KEY, response.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      },
      async updateLanguage(language) {
        if (!token) {
          return;
        }
        const profile = await updateUserLanguage(token, { language });
        setUser(profile);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
      },
    }),
    [isBootstrapping, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
