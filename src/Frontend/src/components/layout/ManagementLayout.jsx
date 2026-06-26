import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  Settings,
  User,
  X
} from 'lucide-react';

export default function ManagementLayout({
  user,
  title,
  subtitle,
  roleLabel,
  navigation,
  settingsHref,
  onLogout,
  children
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  const isActive = (href, exact = false, aliases = []) => {
    if (aliases.includes(location.pathname)) return true;
    if (exact) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const activeItem = useMemo(
    () => navigation.find((item) => isActive(item.href, item.exact, item.aliases || [])) || navigation[0],
    [location.pathname, navigation]
  );

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  useEffect(() => {
    function handleClickOutside(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-72 bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-lg
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br from-blue-500 to-purple-600">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-gray-900 text-lg font-semibold truncate">{title}</h2>
                <p className="text-xs text-gray-500 truncate">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              className="lg:hidden text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact, item.aliases || []);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${active
                      ? 'bg-gray-50 text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  {active && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                      style={{ backgroundColor: item.accent }}
                    />
                  )}

                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      active ? 'shadow-md text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                    }`}
                    style={active ? { backgroundColor: item.accent } : undefined}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mr-2 shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 transition-all duration-200 ${
                      active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-lg border-b border-gray-200 flex items-center px-4 lg:px-8 shadow-sm">
          <button
            type="button"
            className="lg:hidden mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: activeItem?.accent || '#2563eb' }}
            >
              {activeItem?.icon && <activeItem.icon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {activeItem?.label || 'Bảng điều khiển'}
              </h1>
              <p className="hidden sm:block text-xs text-gray-500 truncate">
                {roleLabel} đang quản lý hệ thống nhà trọ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
            >
              <Home className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Trang web</span>
            </Link>

            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  {initial}
                </div>
                <div className="hidden sm:block text-left min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate" style={{ maxWidth: '10rem' }}>{user?.name || roleLabel}</p>
                  <p className="text-xs text-gray-500 truncate" style={{ maxWidth: '10rem' }}>{user?.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Đăng nhập với vai trò</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{roleLabel}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      navigate(settingsHref);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">Cập nhật thông tin</span>
                  </button>

                  <div className="border-t border-gray-100 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
