import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Bell,
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users
} from 'lucide-react';
import ManagementLayout from '../layout/ManagementLayout';
import { requestService } from '../../services';

export default function AdminLayout({ user, onLogout, children }) {
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const navigate = useNavigate();
  const knownPendingIds = useRef(null);

  useEffect(() => {
    const loadPendingCount = async () => {
      try {
        const data = await requestService.getRequests();
        const pending = (Array.isArray(data) ? data : data?.data || []).filter(
          (req) => req.status === 'pending'
        );

        // Check if there are new pending requests
        if (knownPendingIds.current !== null) {
          const newRequests = pending.filter(
            (req) => !knownPendingIds.current.has(req._id)
          );

          if (newRequests.length > 0) {
            newRequests.forEach((req) => {
              toast.info('🔔 Yêu cầu mới cần xử lý', {
                description: `${req.tenant?.fullName || 'Khách thuê'} gửi yêu cầu: "${req.title}"`,
                action: {
                  label: 'Xem ngay',
                  onClick: () => navigate('/admin/yeu-cau')
                },
                duration: 10000
              });
            });
          }
        }

        // Initialize or update the set of known pending IDs
        knownPendingIds.current = new Set(pending.map((req) => req._id));
        setPendingRequestsCount(pending.length);
      } catch (error) {
        console.error('Error loading pending requests count:', error);
      }
    };

    loadPendingCount();
    const interval = setInterval(loadPendingCount, 15000); // refresh every 15 seconds
    return () => clearInterval(interval);
  }, [navigate]);

  const navigation = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, accent: '#2563eb', exact: true },
    { label: 'Phòng trọ', href: '/admin/phong', icon: Building2, accent: '#7c3aed' },
    { label: 'Người thuê', href: '/admin/nguoi-thue', icon: Users, accent: '#16a34a' },
    { label: 'Tài khoản', href: '/admin/tai-khoan', icon: Users, accent: '#0f766e' },
    { label: 'Hợp đồng', href: '/admin/hop-dong', icon: FileText, accent: '#ea580c' },
    { label: 'Hóa đơn', href: '/admin/hoa-don', icon: Receipt, accent: '#db2777' },
    { label: 'Yêu cầu', href: '/admin/yeu-cau', icon: Bell, accent: '#dc2626', badge: pendingRequestsCount },
    { label: 'Dịch vụ', href: '/admin/dich-vu', icon: Settings, accent: '#4f46e5' },
  ];

  return (
    <ManagementLayout
      user={user}
      title="Quản lý nhà trọ"
      subtitle="Khu quản trị"
      roleLabel="Admin"
      navigation={navigation}
      settingsHref="/admin/settings"
      onLogout={onLogout}
    >
      {children}
    </ManagementLayout>
  );
}
