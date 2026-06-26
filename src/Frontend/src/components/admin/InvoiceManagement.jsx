import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Plus, Search, Eye, CheckCircle, Receipt as ReceiptIcon, Mail, Bell, Printer } from 'lucide-react';
import { invoiceService } from '../../services/invoiceService';
import { tenantService } from '../../services/tenantService';
import { roomService } from '../../services/roomService';
import { serviceService } from '../../services/serviceService';
import { printInvoicePdf } from '../../utils/invoicePdf';
import { getInvoiceStatusClassName, getInvoiceStatusLabel, normalizeInvoiceStatus } from '../../utils/invoiceStatus';
import { toast } from 'sonner';

export default function InvoiceManagement() {
  const [invoices, setInvoices] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newInvoice, setNewInvoice] = useState(null);
  const [reminders, setReminders] = useState([]);

  // Fetch all data from API
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoicesData, tenantsData, roomsData, servicesData] = await Promise.all([
        invoiceService.getInvoices(),
        tenantService.getTenants(),
        roomService.getRooms(),
        serviceService.getServices()
      ]);
      setInvoices(invoicesData);
      setTenants(tenantsData);
      setRooms(roomsData);
      setServices(servicesData);
      
      // Calculate reminders
      calculateReminders(tenantsData, invoicesData);
    } catch (error) {
      toast.error('Không thể tải dữ liệu');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateReminders = (tenantsData, invoicesData) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const today = now.getDate();
    
    const reminderList = [];
    
    // Filter tenants with rooms
    const activeTenants = tenantsData.filter(t => t.room && t.room._id);
    
    console.log('Calculating reminders:', { activeTenants: activeTenants.length, currentMonth, currentYear });
    
    for (const tenant of activeTenants) {
      // Check if invoice exists for current month
      const hasInvoiceThisMonth = invoicesData.some(
        inv => inv.tenant?._id === tenant._id && inv.month === currentMonth && inv.year === currentYear
      );
      
      console.log(`Tenant ${tenant.fullName}:`, { hasInvoiceThisMonth });
      
      if (hasInvoiceThisMonth) continue;
      
      // Check if this is the first month for this tenant
      const hasAnyInvoice = invoicesData.some(inv => inv.tenant?._id === tenant._id);
      const moveIn = tenant.moveInDate ? new Date(tenant.moveInDate) : null;
      const isFirstMonth = !hasAnyInvoice && moveIn && 
        moveIn.getFullYear() === currentYear && 
        (moveIn.getMonth() + 1) === currentMonth;

      let dueDate;
      let reason;
      let priority = 'medium';

      if (isFirstMonth) {
        const dueDateObj = new Date(moveIn);
        dueDateObj.setDate(dueDateObj.getDate() + 3);
        
        dueDate = dueDateObj.getDate();
        const dueDateStr = `${dueDateObj.getDate()}/${dueDateObj.getMonth() + 1}`;
        priority = today >= dueDate ? 'high' : 'medium';
        reason = priority === 'high'
          ? `⏰ Đến hạn tạo HĐ (3 ngày sau dọn vào: ${dueDateStr})`
          : `Hạn thanh toán tháng đầu: ${dueDateStr}`;
      } else {
        dueDate = 5;
        priority = today >= dueDate ? 'high' : 'medium';
        reason = priority === 'high'
          ? 'Đến hạn tạo hóa đơn theo quy định ngày 5 hàng tháng'
          : 'Hạn thanh toán cố định ngày 5 hàng tháng';
      }

      // Always add if no invoice this month
      reminderList.push({
        tenant,
        dueDate,
        reason,
        priority
      });
    }
    
    console.log('Reminders:', reminderList);
    
    // Sort: high priority first
    setReminders(reminderList.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0;
    }));
  };

  const fetchInvoices = async () => {
    try {
      const data = await invoiceService.getInvoices();
      setInvoices(data);
    } catch (error) {
      toast.error('Không thể tải danh sách hóa đơn');
      console.error('Error fetching invoices:', error);
    }
  };

  const uniqueMonths = Array.from(new Set(invoices.filter(inv => inv.month).map(inv => inv.month))).sort((a, b) => b - a);

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.tenant?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.room?.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    const matchesMonth = filterMonth === 'all' || invoice.month === parseInt(filterMonth);
    return matchesSearch && matchesStatus && matchesMonth;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeInvoiceStatus(status);
    return (
      <Badge className={getInvoiceStatusClassName(normalized)}>
        {getInvoiceStatusLabel(normalized)}
      </Badge>
    );
  };
  const getTenantName = (invoice) => {
    return invoice?.tenant?.fullName || 'N/A';
  };

  const getRoomNumber = (invoice) => {
    return invoice?.room?.roomNumber || 'N/A';
  };

  const getInvoiceServiceLine = (invoice, type, keyword) => {
    return invoice?.services?.find((service) => {
      const serviceType = service.service?.type;
      const serviceName = `${service.service?.name || service.name || ''}`.toLowerCase();
      return serviceType === type || serviceName.includes(keyword);
    });
  };

  const getOtherServiceLines = (invoice) => {
    return (invoice?.services || []).filter((service) => {
      const serviceName = `${service.service?.name || service.name || ''}`.toLowerCase();
      const serviceType = service.service?.type;
      return serviceType !== 'electricity' &&
        serviceType !== 'water' &&
        !serviceName.includes('điện') &&
        !serviceName.includes('nước');
    });
  };

  const formatDateInput = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseInvoiceMonth = (monthValue) => {
    const match = `${monthValue || ''}`.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      return {
        year: Number(match[1]),
        monthIndex: Number(match[2]) - 1
      };
    }

    const now = new Date();
    return {
      year: now.getFullYear(),
      monthIndex: now.getMonth()
    };
  };

  const getDaysInMonth = (year, monthIndex) => {
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  const getDefaultDueDate = (tenantId, monthValue) => {
    const { year, monthIndex } = parseInvoiceMonth(monthValue);
    const tenant = tenants.find((item) => item._id === tenantId);
    const isFirstInvoice = tenantId && !hasPaidInvoiceForTenant(tenantId);
    const moveIn = tenant?.moveInDate ? new Date(tenant.moveInDate) : null;

    if (
      isFirstInvoice &&
      moveIn &&
      !Number.isNaN(moveIn.getTime()) &&
      moveIn.getFullYear() === year &&
      moveIn.getMonth() === monthIndex
    ) {
      const dueDateObj = new Date(moveIn);
      dueDateObj.setDate(dueDateObj.getDate() + 3);
      return formatDateInput(dueDateObj);
    }

    const dueDay = Math.min(5, getDaysInMonth(year, monthIndex));
    return formatDateInput(new Date(year, monthIndex, dueDay));
  };

  const formatMonthInput = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return new Date().toISOString().slice(0, 7);
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const getDefaultInvoiceMonth = (tenant = null) => {
    if (!tenant?._id || !tenant?.moveInDate) return new Date().toISOString().slice(0, 7);

    const hasPaidInvoice = invoices.some((invoice) => {
      const invoiceTenantId = invoice.tenant?._id || invoice.tenant;
      return invoiceTenantId === tenant._id && invoice.status === 'paid';
    });

    return hasPaidInvoice ? new Date().toISOString().slice(0, 7) : formatMonthInput(new Date(tenant.moveInDate));
  };

  const calculateFirstMonthRoomPrice = (monthlyPrice, moveInDate, monthValue) => {
    const moveIn = new Date(moveInDate);
    if (Number.isNaN(moveIn.getTime())) return monthlyPrice;

    const { year, monthIndex } = parseInvoiceMonth(monthValue);
    const moveInMonth = moveIn.getMonth();
    const moveInYear = moveIn.getFullYear();

    if (year < moveInYear || (year === moveInYear && monthIndex < moveInMonth)) return 0;
    if (year !== moveInYear || monthIndex !== moveInMonth) return monthlyPrice;

    const daysInMonth = getDaysInMonth(year, monthIndex);
    const billableDays = Math.max(daysInMonth - moveIn.getDate() + 1, 1);
    return Math.round((monthlyPrice / daysInMonth) * billableDays);
  };

  const hasPaidInvoiceForTenant = (tenantId) => {
    return invoices.some((invoice) => {
      const invoiceTenantId = invoice.tenant?._id || invoice.tenant;
      return invoiceTenantId === tenantId && invoice.status === 'paid';
    });
  };

  const calculateInvoiceRoomPrice = (tenant, monthlyPrice, monthValue) => {
    if (!tenant?._id || !tenant?.moveInDate || hasPaidInvoiceForTenant(tenant._id)) {
      return monthlyPrice;
    }

    return calculateFirstMonthRoomPrice(monthlyPrice, tenant.moveInDate, monthValue);
  };

  const billableExtraServices = services.filter((service) => (
    service.type !== 'electricity' &&
    service.type !== 'water' &&
    service.isActive !== false
  ));

  const calculateAdditionalServicesTotal = (items = []) => {
    return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  };

  const calculateNewInvoiceTotal = (invoice = newInvoice) => {
    if (!invoice) return 0;
    return Number(invoice.roomPrice || 0) +
      Number(invoice.electricUsage || 0) * Number(invoice.electricPrice || 0) +
      Number(invoice.waterUsage || 0) * Number(invoice.waterPrice || 0) +
      calculateAdditionalServicesTotal(invoice.additionalServices || []);
  };

  const isExtraServiceSelected = (serviceId) => {
    return (newInvoice?.additionalServices || []).some((item) => item.service === serviceId);
  };

  const toggleAdditionalService = (service) => {
    if (!newInvoice) return;

    const current = newInvoice.additionalServices || [];
    const exists = current.some((item) => item.service === service._id);

    setNewInvoice({
      ...newInvoice,
      additionalServices: exists
        ? current.filter((item) => item.service !== service._id)
        : [
            ...current,
            {
              service: service._id,
              name: service.name,
              quantity: 1,
              unitPrice: Number(service.unitPrice || 0),
              amount: Number(service.unitPrice || 0)
            }
          ]
    });
  };

  const updateAdditionalServiceQuantity = (serviceId, quantity) => {
    const safeQuantity = Math.max(Number(quantity || 0), 0);
    setNewInvoice({
      ...newInvoice,
      additionalServices: (newInvoice.additionalServices || []).map((item) => (
        item.service === serviceId
          ? {
              ...item,
              quantity: safeQuantity,
              amount: safeQuantity * Number(item.unitPrice || 0)
            }
          : item
      ))
    });
  };

  const handleViewDetail = (invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  const canConfirmPayment = (status) => ['pending', 'unpaid', 'overdue', 'payment_submitted'].includes(status);

  const handleMarkPaid = async (invoiceOrId) => {
    const invoiceId = typeof invoiceOrId === 'object' ? invoiceOrId._id : invoiceOrId;
    const invoice = typeof invoiceOrId === 'object'
      ? invoiceOrId
      : invoices.find((item) => item._id === invoiceId) || selectedInvoice;

    if (!invoice || invoice.status === 'paid') {
      toast.info('Hóa đơn này đã được xác nhận thanh toán');
      return false;
    }

    const confirmed = window.confirm(
      `Xác nhận hóa đơn của ${getTenantName(invoice)} - phòng ${getRoomNumber(invoice)} đã thanh toán?\n\nSau khi xác nhận, hóa đơn sẽ được chốt và không thể chuyển lại thành chưa thanh toán.`
    );

    if (!confirmed) return false;
    try {
      await invoiceService.payInvoice(invoiceId);
      await fetchInvoices(); // Reload danh sách
      toast.success('Đã xác nhận hóa đơn đã thanh toán');
      return true;
    } catch (error) {
      toast.error('Không thể cập nhật trạng thái hóa đơn');
      console.error('Error marking invoice as paid:', error);
      return false;
    }
  };

  const handleRejectPayment = async (invoiceOrId) => {
    const invoiceId = typeof invoiceOrId === 'object' ? invoiceOrId._id : invoiceOrId;
    const invoice = typeof invoiceOrId === 'object'
      ? invoiceOrId
      : invoices.find((item) => item._id === invoiceId) || selectedInvoice;

    const reason = window.prompt(
      `Nhập lý do từ chối xác nhận chuyển khoản của ${getTenantName(invoice)}:\nVD: Chưa nhận được tiền, Sai nội dung chuyển khoản, Chuyển thiếu tiền`,
      'Chưa nhận được tiền hoặc thông tin chuyển khoản chưa đúng'
    );

    if (!reason || !reason.trim()) return false;

    try {
      await invoiceService.rejectPayment(invoiceId, reason.trim());
      await fetchInvoices();
      toast.success('Đã từ chối xác nhận chuyển khoản và gửi lý do cho người thuê');
      return true;
    } catch (error) {
      toast.error(error.message || 'Không thể từ chối xác nhận chuyển khoản');
      console.error('Error rejecting payment:', error);
      return false;
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    try {
      await invoiceService.sendInvoice(invoiceId);
      await fetchInvoices(); // Reload danh sách
      toast.success('Đã gửi hóa đơn qua email thành công');
    } catch (error) {
      toast.error('Không thể gửi hóa đơn qua email');
      console.error('Error sending invoice:', error);
    }
  };

  const getDefaultInvoiceDraft = (tenant = null) => {
    const electricService = services.find(s => s.type === 'electricity');
    const waterService = services.find(s => s.type === 'water');
    const roomId = tenant?.room?._id || tenant?.room || '';
    const roomPrice = tenant?.room?.price || rooms.find((room) => room._id === roomId)?.price || 0;
    const month = getDefaultInvoiceMonth(tenant);
    const tenantId = tenant?._id || '';
    const calculatedRoomPrice = calculateInvoiceRoomPrice(tenant, roomPrice, month);

    return {
      tenant: tenantId,
      room: roomId,
      month,
      roomPrice: calculatedRoomPrice,
      electricUsage: 0,
      electricPrice: electricService?.unitPrice || 3500,
      waterUsage: 0,
      waterPrice: waterService?.unitPrice || 20000,
      additionalServices: [],
      dueDate: getDefaultDueDate(tenantId, month),
      status: 'pending'
    };
  };

  const handleQuickCreateInvoice = (tenant) => {
    setNewInvoice(getDefaultInvoiceDraft(tenant));
    setIsCreateOpen(true);
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice) {
      setNewInvoice(getDefaultInvoiceDraft());
      setIsCreateOpen(true);
      return;
    }

    // Save invoice
    try {
      if (!newInvoice.tenant || !newInvoice.room) {
        toast.error('Vui lòng chọn người thuê và phòng');
        return;
      }

      const result = await invoiceService.createInvoice(newInvoice);
      toast.success('Tạo hóa đơn thành công');
      setIsCreateOpen(false);
      setNewInvoice(null);
      await loadData();
    } catch (error) {
      toast.error('Không thể tạo hóa đơn');
      console.error('Error creating invoice:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Quản Lý Hoá Đơn</h1>
          <p className="text-gray-600">Quản lý hoá đơn và thanh toán</p>
        </div>
        <Button 
          onClick={handleCreateInvoice}
          className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tạo Hoá Đơn Mới
        </Button>
      </div>

      {/* Reminders Section */}
      {reminders.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-gray-900">Nhắc Nhở Tạo Hóa Đơn ({reminders.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reminders.map((reminder, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200 shadow-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{reminder.tenant.fullName}</p>
                    <p className="text-sm text-gray-600">
                      Phòng {reminder.tenant.room?.roomNumber || 'N/A'} - {reminder.reason}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      {reminder.priority === 'high' ? '🔴 Đã tới ngày thanh toán' : '⚠️ Sắp tới ngày thanh toán'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleQuickCreateInvoice(reminder.tenant)}
                    className="bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tạo HĐ
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-white border border-gray-200 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên người thuê hoặc số phòng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Lọc theo tháng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tháng</SelectItem>
                {uniqueMonths.map(month => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Lọc theo trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="paid">Đã thanh toán</SelectItem>
                <SelectItem value="pending">Chưa thanh toán</SelectItem>
                <SelectItem value="payment_submitted">Chờ chủ trọ xác nhận</SelectItem>
                <SelectItem value="overdue">Quá hạn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      {loading ? (
        <Card className="bg-white border border-gray-200 shadow-md">
          <CardContent className="p-12">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Đang tải...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border border-gray-200 shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left text-xs text-gray-600 px-6 py-3">Tháng</th>
                    <th className="text-left text-xs text-gray-600 px-6 py-3">Người Thuê</th>
                    <th className="text-left text-xs text-gray-600 px-6 py-3">Phòng</th>
                    <th className="text-right text-xs text-gray-600 px-6 py-3">Tổng Tiền</th>
                    <th className="text-left text-xs text-gray-600 px-6 py-3">Hạn Thanh Toán</th>
                    <th className="text-center text-xs text-gray-600 px-6 py-3">Trạng Thái</th>
                    <th className="text-center text-xs text-gray-600 px-6 py-3">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{invoice.month}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {getTenantName(invoice)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        Phòng {getRoomNumber(invoice)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(invoice.dueDate).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetail(invoice)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => handleSendInvoice(invoice._id)}
                            title="Gửi hóa đơn qua email"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          {canConfirmPayment(invoice.status) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleMarkPaid(invoice)}
                              title="Xác nhận đã thanh toán"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          ) : invoice.status === 'paid' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 bg-green-50 border-green-200 cursor-not-allowed"
                              disabled
                              title="Hóa đơn đã chốt thanh toán"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          ) : null}
                          {invoice.status === 'payment_submitted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleRejectPayment(invoice)}
                              title="Từ chối xác nhận chuyển khoản"
                            >
                              !
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredInvoices.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-md">
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Không tìm thấy hoá đơn nào</p>
          </CardContent>
        </Card>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi Tiết Hoá Đơn</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết về hoá đơn
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl text-gray-900">{getTenantName(selectedInvoice)}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Phòng {getRoomNumber(selectedInvoice)} - Tháng {selectedInvoice.month}
                  </p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tiền phòng:</span>
                  <span className="text-gray-900">{formatCurrency(selectedInvoice.roomRent || 0)}</span>
                </div>
                {(() => {
                  const electricLine = getInvoiceServiceLine(selectedInvoice, 'electricity', 'điện');
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Tiền điện ({electricLine?.quantity || 0} kWh):
                      </span>
                      <span className="text-gray-900">{formatCurrency(electricLine?.amount || 0)}</span>
                    </div>
                  );
                })()}
                {(() => {
                  const waterLine = getInvoiceServiceLine(selectedInvoice, 'water', 'nước');
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Tiền nước ({waterLine?.quantity || 0} m³):
                      </span>
                      <span className="text-gray-900">{formatCurrency(waterLine?.amount || 0)}</span>
                    </div>
                  );
                })()}
                {getOtherServiceLines(selectedInvoice).map((service, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{service.service?.name || service.name}:</span>
                    <span className="text-gray-900">{formatCurrency(service.amount || 0)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-gray-900">Tổng cộng:</span>
                  <span className="text-gray-900">{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hạn thanh toán:</span>
                  <span className="text-gray-900">
                    {new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                {selectedInvoice.paidDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ngày thanh toán:</span>
                    <span className="text-gray-900">
                      {new Date(selectedInvoice.paidDate).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                )}
              </div>

              {(selectedInvoice.paymentSubmittedAt || selectedInvoice.paymentRejectionReason) && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm">
                  {selectedInvoice.paymentSubmittedAt && selectedInvoice.status !== 'paid' && (
                    <p className="font-medium text-blue-800">
                      Người thuê báo đã chuyển: {new Date(selectedInvoice.paymentSubmittedAt).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                  {selectedInvoice.paymentRejectionReason && (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
                      Lý do từ chối gần nhất: {selectedInvoice.paymentRejectionReason}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => printInvoicePdf(selectedInvoice)}>
                  <Printer className="w-4 h-4 mr-2" />
                  Xuất PDF
                </Button>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Đóng
                </Button>
                {canConfirmPayment(selectedInvoice.status) ? (
                  <Button onClick={async () => {
                    const updated = await handleMarkPaid(selectedInvoice);
                    if (updated) setIsDetailOpen(false);
                  }}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Đánh Dấu Đã Thanh Toán
                  </Button>
                ) : selectedInvoice.status === 'paid' ? (
                  <Button variant="outline" disabled className="text-green-700 bg-green-50 border-green-200">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Đã chốt thanh toán
                  </Button>
                ) : null}
                {selectedInvoice.status === 'payment_submitted' && (
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={async () => {
                      const updated = await handleRejectPayment(selectedInvoice);
                      if (updated) setIsDetailOpen(false);
                    }}
                  >
                    Từ chối xác nhận
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo Hóa Đơn Mới</DialogTitle>
            <DialogDescription>
              Nhập thông tin chi tiết để tạo hóa đơn mới
            </DialogDescription>
          </DialogHeader>
          {newInvoice && (
            <form onSubmit={(e) => { e.preventDefault(); handleCreateInvoice(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Người thuê *</Label>
                  <Select
                    value={newInvoice.tenant}
                    onValueChange={async (value) => {
                      const tenant = tenants.find(t => t._id === value);
                      console.log('Selected tenant:', tenant);
                      
                      // Get room from tenant's room field (which might be an object or just an ID)
                      const roomId = tenant?.room?._id || tenant?.room;
                      console.log('Room ID:', roomId);
                      
                      // Try multiple ways to get room price
                      let roomPrice = 0;
                      
                      // Method 1: From tenant.room if populated with price
                      if (tenant?.room?.price) {
                        roomPrice = tenant.room.price;
                        console.log('Got price from tenant.room.price:', roomPrice);
                      }
                      // Method 2: From rooms array
                      else if (roomId) {
                        const room = rooms.find(r => r._id === roomId);
                        if (room?.price) {
                          roomPrice = room.price;
                          console.log('Got price from rooms array:', roomPrice);
                        }
                        // Method 3: Fetch room details from API
                        else {
                          try {
                            const roomData = await roomService.getRoom(roomId);
                            if (roomData?.price) {
                              roomPrice = roomData.price;
                              console.log('Got price from API:', roomPrice);
                            }
                          } catch (error) {
                            console.error('Failed to fetch room price:', error);
                          }
                        }
                      }
                      
                      console.log('Base room price:', roomPrice);
                      
                      // Calculate actual room price based on days
                      let actualRoomPrice = roomPrice;
                      let daysInfo = '';
                      
                      try {
                        // Get previous invoices for this tenant
                        const tenantInvoices = await invoiceService.getInvoicesByTenant(value);
                        console.log('Tenant invoices:', tenantInvoices);
                        
                        // Sort by date descending to get the latest paid invoice
                        const paidInvoices = tenantInvoices
                          .filter(inv => inv.status === 'paid' && inv.paidDate)
                          .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
                        
                        const today = new Date();
                        let startDate;
                        
                        if (paidInvoices.length > 0) {
                          // Calculate from last paid date
                          startDate = new Date(paidInvoices[0].paidDate);
                          daysInfo = 'Tính từ ngày thanh toán hóa đơn trước';
                        } else if (tenant?.moveInDate) {
                          // First invoice - calculate from move-in date
                          startDate = new Date(tenant.moveInDate);
                          daysInfo = 'Tháng đầu tiên - tính từ ngày vào';
                        } else {
                          // Default: full month
                          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                          daysInfo = 'Tính theo tháng đầy đủ';
                        }
                        
                        // Calculate days
                        const diffTime = Math.abs(today - startDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        // Calculate price per day (assume 30 days per month)
                        const pricePerDay = roomPrice / 30;
                        actualRoomPrice = Math.round(pricePerDay * diffDays);
                        
                        console.log('Days calculation:', {
                          startDate: startDate.toLocaleDateString('vi-VN'),
                          today: today.toLocaleDateString('vi-VN'),
                          diffDays,
                          pricePerDay,
                          actualRoomPrice,
                          info: daysInfo
                        });
                        
                        // Show notification
                        console.log('Legacy room price estimate:', {
                          daysInfo,
                          diffDays,
                          pricePerDay,
                          actualRoomPrice
                        });
                      } catch (error) {
                        console.error('Error calculating room price:', error);
                        actualRoomPrice = roomPrice;
                      }
                      
                      const invoiceMonth = getDefaultInvoiceMonth(tenant);
                      actualRoomPrice = calculateInvoiceRoomPrice(tenant, roomPrice, invoiceMonth);
                      if (tenant?.moveInDate && !hasPaidInvoiceForTenant(value) && actualRoomPrice !== roomPrice) {
                        const { year, monthIndex } = parseInvoiceMonth(invoiceMonth);
                        const daysInMonth = getDaysInMonth(year, monthIndex);
                        const moveIn = new Date(tenant.moveInDate);
                        const billableDays = Math.max(daysInMonth - moveIn.getDate() + 1, 1);
                        toast.info(`Tiền phòng tháng đầu: ${billableDays}/${daysInMonth} ngày = ${formatCurrency(actualRoomPrice)}`, {
                          duration: 5000
                        });
                      }
                      console.log('Final room price:', actualRoomPrice);
                      
                      setNewInvoice({ 
                        ...newInvoice, 
                        tenant: value,
                        room: roomId || '',
                        roomPrice: actualRoomPrice,
                        month: invoiceMonth,
                        dueDate: getDefaultDueDate(value, invoiceMonth)
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người thuê" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.filter(t => t.room).map(tenant => (
                        <SelectItem key={tenant._id} value={tenant._id}>
                          {tenant.fullName} - Phòng {tenant.room?.roomNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="month">Tháng *</Label>
                  <Input
                    id="month"
                    type="month"
                    value={newInvoice.month || ''}
                    onChange={(e) => {
                      const month = e.target.value;
                      const tenant = tenants.find((item) => item._id === newInvoice.tenant);
                      const monthlyRoomPrice = tenant?.room?.price ||
                        rooms.find((room) => room._id === (tenant?.room?._id || tenant?.room))?.price ||
                        newInvoice.roomPrice ||
                        0;
                      setNewInvoice({
                        ...newInvoice,
                        month,
                        roomPrice: calculateInvoiceRoomPrice(tenant, monthlyRoomPrice, month),
                        dueDate: getDefaultDueDate(newInvoice.tenant, month)
                      });
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roomPrice">Tiền phòng (VNĐ) *</Label>
                  <Input
                    id="roomPrice"
                    type="number"
                    value={newInvoice.roomPrice || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, roomPrice: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Hạn thanh toán *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newInvoice.dueDate || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="electricUsage">Số điện (kWh)</Label>
                  <Input
                    id="electricUsage"
                    type="number"
                    step="0.01"
                    value={newInvoice.electricUsage || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, electricUsage: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="electricPrice">Giá điện (VNĐ/kWh)</Label>
                  <Input
                    id="electricPrice"
                    type="number"
                    step="0.01"
                    value={newInvoice.electricPrice || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, electricPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="waterUsage">Số nước (m³)</Label>
                  <Input
                    id="waterUsage"
                    type="number"
                    step="0.01"
                    value={newInvoice.waterUsage || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, waterUsage: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waterPrice">Giá nước (VNĐ/m³)</Label>
                  <Input
                    id="waterPrice"
                    type="number"
                    step="0.01"
                    value={newInvoice.waterPrice || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, waterPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="font-semibold text-gray-900">Dịch vụ khác</p>
                  <p className="text-sm text-gray-500">Chọn các khoản cố định cần tính thêm cho người thuê trong tháng này.</p>
                </div>

                {billableExtraServices.length === 0 ? (
                  <p className="rounded-lg bg-white p-3 text-sm text-gray-500">
                    Chưa có dịch vụ cố định nào. Hãy thêm trong trang Dịch vụ trước.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {billableExtraServices.map((service) => {
                      const selectedItem = (newInvoice.additionalServices || []).find((item) => item.service === service._id);
                      const selected = Boolean(selectedItem);

                      return (
                        <div key={service._id} className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleAdditionalService(service)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="min-w-0">
                                <span className="block font-medium text-gray-900">{service.name}</span>
                                <span className="block text-sm text-gray-500">
                                  {formatCurrency(service.unitPrice || 0)} / {service.unit || 'lần'}
                                </span>
                              </span>
                            </label>

                            {selected && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={selectedItem?.quantity ?? 1}
                                  onChange={(e) => updateAdditionalServiceQuantity(service._id, e.target.value)}
                                  className="w-20"
                                  aria-label={`Số lượng ${service.name}`}
                                />
                                <span className="w-28 text-right text-sm font-semibold text-gray-900">
                                  {formatCurrency(selectedItem?.amount || 0)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-600 mb-2">Tổng tiền dự kiến:</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(calculateNewInvoiceTotal())}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  setNewInvoice(null);
                }}>
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 font-semibold px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo Hóa Đơn
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
