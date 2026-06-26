import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts';
import { useAuth } from './hooks';

// Import pages
import LoginPage from './components/LoginPage';

// Public Pages with Layout
import PublicLayout from './components/public/PublicLayout';
import RulesPage from './components/public/ArticlePage';
import RoomGalleryPage from './components/public/RoomGalleryPage';
import ContactPage from './components/public/ContactPage';

// Admin Pages
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import RoomManagement from './components/admin/RoomManagement';
import TenantManagement from './components/admin/TenantManagement';
import ContractManagement from './components/admin/ContractManagement';
import InvoiceManagement from './components/admin/InvoiceManagement';
import ServiceManagement from './components/admin/ServiceManagement';
import SettingsPage from './components/admin/SettingsPage';
import RequestManagement from './components/admin/RequestManagement';

// User Pages
import UserLayout from './components/user/UserLayout';
import UserProfile from './components/user/UserProfile';
import UserRoom from './components/user/UserRoom';
import UserContract from './components/user/UserContract';
import UserInvoices from './components/user/UserInvoices';
import UserRequests from './components/user/UserRequests';
import ForceChangePassword from './components/user/ForceChangePassword';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />;
  }

  return <>{children}</>;
}

// App Routes Component
function AppRoutes() {
  const { user, logout } = useAuth();
  const [mustChangePassword, setMustChangePassword] = useState(user?.mustChangePassword || false);

  // Cập nhật mustChangePassword khi user thay đổi
  useEffect(() => {
    setMustChangePassword(user?.mustChangePassword || false);
  }, [user]);

  // Nếu user cần đổi mật khẩu, hiện trang đổi mật khẩu bắt buộc
  if (user && mustChangePassword) {
    return (
      <ForceChangePassword 
        user={user} 
        onPasswordChanged={() => setMustChangePassword(false)} 
      />
    );
  }

  return (
    <Routes>
      {/* Public Routes with Layout */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<RoomGalleryPage />} />
        <Route path="noi-quy" element={<RulesPage />} />
        <Route path="phong-tro" element={<RoomGalleryPage />} />
        <Route path="lien-he" element={<ContactPage />} />
      </Route>
      
      {/* Login Route */}
      <Route 
        path="/login" 
        element={
          user ? (
            <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />
          ) : (
            <LoginPage onLogin={() => {}} />
          )
        } 
      />

      {/* Admin Routes */}
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout user={user} onLogout={logout}>
              <Routes>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="nguoi-dung" element={<UserManagement />} />
                <Route path="tai-khoan" element={<UserManagement />} />
                <Route path="phong" element={<RoomManagement />} />
                <Route path="nguoi-thue" element={<TenantManagement />} />
                <Route path="hop-dong" element={<ContractManagement />} />
                <Route path="hoa-don" element={<InvoiceManagement />} />
                <Route path="dich-vu" element={<ServiceManagement />} />
                <Route path="settings" element={<SettingsPage user={user} />} />
                <Route path="yeu-cau" element={<RequestManagement />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        } 
      />

      {/* User Routes */}
      <Route 
        path="/user/*" 
        element={
          <ProtectedRoute requiredRole="user">
            <UserLayout user={user} onLogout={logout}>
              <Routes>
                <Route index element={<UserRoom />} />
                <Route path="profile" element={<UserProfile />} />
                <Route path="phong" element={<UserRoom />} />
                <Route path="hop-dong" element={<UserContract />} />
                <Route path="hoa-don" element={<UserInvoices />} />
                <Route path="yeu-cau" element={<UserRequests />} />
              </Routes>
            </UserLayout>
          </ProtectedRoute>
        } 
      />

      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" richColors />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
