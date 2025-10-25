/**
 * Authentication hook
 */

import { useState, useEffect } from 'react';
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';

export function useAuthenticator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const session = await fetchAuthSession();
      setIsAuthenticated(!!session.tokens);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password: string) {
    try {
      await signIn({ username, password });
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
