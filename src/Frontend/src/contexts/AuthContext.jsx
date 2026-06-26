import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const initAuth = async () => {
      const session = authService.getSession();
      if (session) {
        setUser(session);
        try {
          const freshUser = await authService.getMe();
          if (freshUser) {
            // Ensure user has _id property (for backward compatibility)
            if (freshUser.id && !freshUser._id) {
              freshUser._id = freshUser.id;
            }
            setUser(freshUser);
          }
        } catch (err) {
          console.warn('Không thể đồng bộ thông tin user từ server:', err);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const session = await authService.login(credentials);
      setUser(session);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const refreshUser = (nextUser) => {
    if (!nextUser) return;

    localStorage.setItem('user', JSON.stringify(nextUser));
    if (nextUser.role) {
      localStorage.setItem('userRole', nextUser.role);
    }
    setUser(nextUser);
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    refreshUser,
    isAuthenticated: user !== null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
