import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertCircle,
  Banknote,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  Receipt,
  Users
} from 'lucide-react';
import { invoiceService, requestService, roomService, tenantService } from '../../services';
import { getInvoiceStatusLabel, normalizeInvoiceStatus } from '../../utils/invoiceStatus';

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const statusLabels = {
  available: 'Phòng trống',
  occupied: 'Đã thuê',
  maintenance: 'Bảo trì',
  paid: 'Đã thu',
  pending: 'Chờ thu',
  overdue: 'Quá hạn',
  cancelled: 'Đã hủy',
  'in-progress': 'Đang xử lý',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối'
};

const roomStatusColors = {
  available: '#16a34a',
  occupied: '#2563eb',
  maintenance: '#f97316'
};

const invoiceStatusColors = {
  paid: '#16a34a',
  pending: '#f59e0b',
  payment_submitted: '#2563eb',
  overdue: '#dc2626',
  cancelled: '#64748b'
};

const requestStatusColors = {
  pending: '#f59e0b',
  'in-progress': '#2563eb',
  resolved: '#16a34a',
  rejected: '#dc2626'
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const formatCurrency = (value = 0) => currencyFormatter.format(Number(value) || 0);

const getInvoiceStatus = (invoice) => normalizeInvoiceStatus(invoice?.status);

const getInvoiceAmount = (invoice) => Number(invoice?.totalAmount || invoice?.total || 0);

const getInvoiceMonthKey = (invoice) => {
  if (typeof invoice?.month === 'string' && invoice.month.includes('-')) {
    return invoice.month.slice(0, 7);
  }

  if (invoice?.year && invoice?.month) {
    return `${invoice.year}-${String(invoice.month).padStart(2, '0')}`;
  }

  const date = new Date(invoice?.paidDate || invoice?.dueDate || invoice?.createdAt || Date.now());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getRecentMonths = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: `T${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`,
      amount: 0
    };
  });
};

function StatCard({ title, value, hint, icon: Icon, accent }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-500">{hint}</p>
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="h-72 flex items-center justify-center text-sm text-gray-500 border border-gray-200 rounded-lg" style={{ borderStyle: 'dashed' }}>
      {message}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState({
    rooms: [],
    tenants: [],
    invoices: [],
    requests: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchDashboardData() {
      setLoading(true);
      setError('');

      const results = await Promise.allSettled([
        roomService.getRooms(),
        tenantService.getTenants(),
        invoiceService.getInvoices(),
        requestService.getRequests()
      ]);

      if (!mounted) return;

      const [roomsResult, tenantsResult, invoicesResult, requestsResult] = results;
      const failed = results.filter((result) => result.status === 'rejected');

      setRawData({
        rooms: roomsResult.status === 'fulfilled' ? toArray(roomsResult.value) : [],
        tenants: tenantsResult.status === 'fulfilled' ? toArray(tenantsResult.value) : [],
        invoices: invoicesResult.status === 'fulfilled' ? toArray(invoicesResult.value) : [],
        requests: requestsResult.status === 'fulfilled' ? toArray(requestsResult.value) : []
      });

      if (failed.length > 0) {
        setError('Một số dữ liệu chưa tải được. Kiểm tra lại API hoặc quyền đăng nhập admin.');
      }

      setLoading(false);
    }

    fetchDashboardData();

    return () => {
      mounted = false;
    };
  }, []);

  const dashboard = useMemo(() => {
    const rooms = rawData.rooms;
    const tenants = rawData.tenants;
    const invoices = rawData.invoices;
    const requests = rawData.requests;

    const availableRooms = rooms.filter((room) => room.status === 'available');
    const occupiedRooms = rooms.filter((room) => room.status === 'occupied');
    const maintenanceRooms = rooms.filter((room) => room.status === 'maintenance');
    const activeTenants = tenants.filter((tenant) => tenant.status === 'active');
    const paidInvoices = invoices.filter((invoice) => getInvoiceStatus(invoice) === 'paid');
    const pendingInvoices = invoices.filter((invoice) => ['pending', 'payment_submitted', 'overdue'].includes(getInvoiceStatus(invoice)));
    const pendingRequests = requests.filter((request) => ['pending', 'in-progress'].includes(request.status));

    const months = getRecentMonths();
    const monthMap = new Map(months.map((month) => [month.key, month]));
    paidInvoices.forEach((invoice) => {
      const key = getInvoiceMonthKey(invoice);
      if (monthMap.has(key)) {
        monthMap.get(key).amount += getInvoiceAmount(invoice);
      }
    });

    const roomStatusData = ['available', 'occupied', 'maintenance'].map((status) => ({
      name: statusLabels[status],
      value: status === 'available' ? availableRooms.length : status === 'occupied' ? occupiedRooms.length : maintenanceRooms.length,
      color: roomStatusColors[status]
    }));

    const invoiceStatusData = ['paid', 'pending', 'payment_submitted', 'overdue', 'cancelled'].map((status) => ({
      name: getInvoiceStatusLabel(status),
      value: invoices.filter((invoice) => getInvoiceStatus(invoice) === status).length,
      color: invoiceStatusColors[status]
    }));

    const requestStatusData = ['pending', 'in-progress', 'resolved', 'rejected'].map((status) => ({
      name: statusLabels[status],
      value: requests.filter((request) => request.status === status).length,
      color: requestStatusColors[status]
    }));

    const floorMap = rooms.reduce((map, room) => {
      const floor = room.floor || 'Khác';
      const key = `Tầng ${floor}`;
      const current = map.get(key) || { name: key, total: 0, occupied: 0, available: 0 };
      current.total += 1;
      if (room.status === 'occupied') current.occupied += 1;
      if (room.status === 'available') current.available += 1;
      map.set(key, current);
      return map;
    }, new Map());

    const recentRequests = [...requests]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    const upcomingInvoices = [...pendingInvoices]
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
      .slice(0, 5);

    const totalRevenue = paidInvoices.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0);
    const pendingAmount = pendingInvoices.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0);
    const occupancyRate = rooms.length > 0 ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0;
    const averageRent = rooms.length > 0
      ? Math.round(rooms.reduce((total, room) => total + Number(room.price || 0), 0) / rooms.length)
      : 0;

    return {
      totalRevenue,
      pendingAmount,
      occupancyRate,
      averageRent,
      totalRooms: rooms.length,
      availableRooms: availableRooms.length,
      occupiedRooms: occupiedRooms.length,
      activeTenants: activeTenants.length,
      pendingRequests: pendingRequests.length,
      revenueByMonth: months,
      roomStatusData,
      invoiceStatusData,
      requestStatusData,
      floorData: Array.from(floorMap.values()),
      recentRequests,
      upcomingInvoices
    };
  }, [rawData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-blue-600">Tổng quan nhà trọ</p>
        <h2 className="text-3xl font-semibold text-gray-900">Dashboard quản trị</h2>
        <p className="text-gray-500">
          Theo dõi doanh thu, tỷ lệ lấp đầy phòng, hóa đơn cần thu và yêu cầu từ người thuê.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Doanh thu đã thu"
          value={loading ? 'Đang tải...' : formatCurrency(dashboard.totalRevenue)}
          hint={`Còn cần thu: ${formatCurrency(dashboard.pendingAmount)}`}
          icon={Banknote}
          accent="#16a34a"
        />
        <StatCard
          title="Tỷ lệ lấp đầy"
          value={loading ? 'Đang tải...' : `${dashboard.occupancyRate}%`}
          hint={`${dashboard.occupiedRooms}/${dashboard.totalRooms} phòng đã thuê`}
          icon={BedDouble}
          accent="#2563eb"
        />
        <StatCard
          title="Phòng trống"
          value={loading ? 'Đang tải...' : numberFormatter.format(dashboard.availableRooms)}
          hint={`Giá TB: ${formatCurrency(dashboard.averageRent)}`}
          icon={Building2}
          accent="#7c3aed"
        />
        <StatCard
          title="Người thuê đang ở"
          value={loading ? 'Đang tải...' : numberFormatter.format(dashboard.activeTenants)}
          hint={`${dashboard.pendingRequests} yêu cầu đang chờ xử lý`}
          icon={Users}
          accent="#ea580c"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Doanh thu 6 tháng gần đây</h3>
              <p className="text-sm text-gray-500">Tính theo các hóa đơn đã thanh toán.</p>
            </div>
            <Receipt className="w-5 h-5 text-blue-600" />
          </div>
          {dashboard.revenueByMonth.some((item) => item.amount > 0) ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" name="Doanh thu" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có hóa đơn đã thanh toán để vẽ biểu đồ doanh thu." />
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Tình trạng phòng</h3>
              <p className="text-sm text-gray-500">Phòng trống, đã thuê và bảo trì.</p>
            </div>
            <BedDouble className="w-5 h-5 text-purple-600" />
          </div>
          {dashboard.totalRooms > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboard.roomStatusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                    {dashboard.roomStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có dữ liệu phòng." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hóa đơn theo trạng thái</h3>
          {rawData.invoices.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.invoiceStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Số hóa đơn" radius={[6, 6, 0, 0]}>
                    {dashboard.invoiceStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có hóa đơn." />
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phòng theo tầng</h3>
          {dashboard.floorData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.floorData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="available" name="Trống" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="occupied" name="Đã thuê" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có dữ liệu tầng/phòng." />
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Yêu cầu hỗ trợ</h3>
          {rawData.requests.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboard.requestStatusData} dataKey="value" nameKey="name" outerRadius={92}>
                    {dashboard.requestStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có yêu cầu hỗ trợ." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Hóa đơn cần xử lý</h3>
          </div>
          {dashboard.upcomingInvoices.length > 0 ? (
            <div className="space-y-3">
              {dashboard.upcomingInvoices.map((invoice) => (
                <div key={invoice._id} className="flex items-center justify-between gap-4 border border-gray-100 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{invoice.invoiceNumber || 'Hóa đơn'}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {invoice.room?.roomNumber || invoice.room?.name || 'Chưa rõ phòng'} - {getInvoiceStatusLabel(getInvoiceStatus(invoice))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(getInvoiceAmount(invoice))}</p>
                    <p className="text-xs text-gray-500">
                      Hạn: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('vi-VN') : 'Chưa có'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Không có hóa đơn đang chờ thu.
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Yêu cầu mới gần đây</h3>
          </div>
          {dashboard.recentRequests.length > 0 ? (
            <div className="space-y-3">
              {dashboard.recentRequests.map((request) => (
                <div
                  key={request._id}
                  onClick={() => navigate('/admin/yeu-cau')}
                  className="flex items-center justify-between gap-4 border border-gray-100 rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:border-blue-200 transition-all duration-200"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{request.title}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {request.room?.roomNumber || 'Chưa rõ phòng'} - {statusLabels[request.status] || request.status}
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      color: requestStatusColors[request.status] || '#475569',
                      backgroundColor: `${requestStatusColors[request.status] || '#64748b'}1A`
                    }}
                  >
                    {request.priority || 'medium'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Chưa có yêu cầu mới.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
