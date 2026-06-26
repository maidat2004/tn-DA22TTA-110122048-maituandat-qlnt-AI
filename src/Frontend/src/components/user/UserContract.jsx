import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar, FileText, DollarSign, User, Home, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { contractService } from '../../services/contractService';
import { tenantService } from '../../services/tenantService';
import { toast } from 'sonner';
import { BACKEND_URL } from '../../config/api';

export default function UserContract() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContract();
  }, []);

  const loadContract = async () => {
    try {
      setLoading(true);
      
      // Lấy user từ localStorage
      const userStr = localStorage.getItem('user');
      console.log('UserContract - localStorage user string:', userStr);
      
      if (!userStr) {
        toast.error('Vui lòng đăng nhập');
        return;
      }
      
      const user = JSON.parse(userStr);
      console.log('UserContract - Parsed user object:', user);
      
      // Support both _id and id
      const userId = user._id || user.id;
      console.log('UserContract - User ID:', userId);
      console.log('UserContract - User email:', user.email);
      
      if (!userId) {
        console.error('UserContract - No user ID found in user object');
        toast.error('Lỗi: Không tìm thấy ID người dùng');
        return;
      }

      // Lấy thông tin tenant của user hiện tại
      console.log('UserContract - Fetching tenant for user ID:', userId);
      const tenantResponse = await tenantService.getTenantByUser(userId);
      console.log('UserContract - Tenant response:', tenantResponse);
      
      // Kiểm tra response structure
      const tenant = tenantResponse?.data || tenantResponse;
      console.log('UserContract - Tenant data:', tenant);
      
      if (tenant && tenant._id) {
        console.log('UserContract - Found tenant ID:', tenant._id);
        
        // Lấy hợp đồng của tenant này
        const contractsResponse = await contractService.getContractsByTenant(tenant._id);
        console.log('UserContract - Contracts response:', contractsResponse);
        
        // Kiểm tra response structure
        const contracts = contractsResponse?.data || contractsResponse;
        console.log('UserContract - Contracts data:', contracts);
        
        // Lấy hợp đồng đầu tiên (thường chỉ có 1 hợp đồng active)
        const userContract = Array.isArray(contracts) && contracts.length > 0 ? contracts[0] : null;
        console.log('UserContract - Selected contract:', userContract);
        setContract(userContract);
      } else {
        console.log('UserContract - No tenant found for user');
        console.log('UserContract - User needs to be linked to a tenant in admin panel');
        // User chưa có tenant record
        setContract(null);
      }
    } catch (error) {
      console.error('UserContract - Error loading contract:', error);
      console.error('UserContract - Error details:', error.response?.data || error.message);
      toast.error('Không thể tải thông tin hợp đồng');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700 border-green-300',
      expired: 'bg-red-100 text-red-700 border-red-300',
      terminated: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    const labels = {
      active: 'Đang hoạt động',
      expired: 'Đã hết hạn',
      terminated: 'Đã hủy'
    };
    const icons = {
      active: CheckCircle,
      expired: AlertCircle,
      terminated: Clock
    };
    const Icon = icons[status] || CheckCircle;
    return (
      <Badge className={`${styles[status]} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {labels[status]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Hợp Đồng Của Tôi</h2>
        <Card>
          <CardContent className="p-12">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Đang tải...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) {
    let user = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        user = JSON.parse(userStr);
      }
    } catch (e) {
      console.error('Error parsing user:', e);
    }
    
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Hợp Đồng Của Tôi</h2>
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có hợp đồng</h3>
            <p className="text-gray-600">Bạn chưa có hợp đồng nào. Vui lòng liên hệ quản lý để được ký hợp đồng.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Hợp Đồng Của Tôi</h2>
        <p className="text-gray-600">Xem chi tiết hợp đồng thuê trọ</p>
      </div>

      {/* Contract Header */}
      <Card className="border-2 border-blue-200">
        <CardContent className="p-6">
          {contract.contractFile && contract.confirmedAt && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Hợp đồng đã được ký và xác nhận</span>
              </div>
              <p className="text-green-700 text-sm mt-1">
                File hợp đồng của bạn đã được upload và xác nhận bởi quản lý.
              </p>
            </div>
          )}

          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Hợp Đồng Thuê Phòng</h3>
                <p className="text-gray-600">Phòng {contract.room?.roomNumber || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-2">
                {getStatusBadge(contract.status)}
                {contract.contractFile && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-300 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Có file
                  </Badge>
                )}
                {contract.confirmedAt && (
                  <Badge className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Đã xác nhận
                  </Badge>
                )}
              </div>
              {contract.contractFile && (
                <Button
                  onClick={() => window.open(`${BACKEND_URL}${contract.contractFile}`, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Xem File Hợp Đồng
                </Button>
              )}
            </div>
          </div>

          {/* Contract Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Người thuê</p>
                <p className="font-semibold text-gray-900">{contract.tenant?.fullName || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Home className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Phòng</p>
                <p className="font-semibold text-gray-900">Phòng {contract.room?.roomNumber || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Ngày bắt đầu</p>
                <p className="font-semibold text-gray-900">
                  {contract.startDate ? new Date(contract.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Ngày kết thúc</p>
                <p className="font-semibold text-gray-900">
                  {contract.endDate ? new Date(contract.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Tiền cọc</p>
                <p className="font-semibold text-gray-900">{formatCurrency(contract.deposit || 0)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Tiền thuê hàng tháng</p>
                <p className="font-semibold text-gray-900">{formatCurrency(contract.monthlyRent || 0)}</p>
              </div>
            </div>

            {contract.signedDate && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Ngày ký hợp đồng</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(contract.signedDate).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contract Terms */}
      {contract.terms && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Điều Khoản Hợp Đồng
            </h3>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{contract.terms}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract File Download */}
      {contract.contractFile && (
        <Card className="border-2 border-green-200">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              File Hợp Đồng
            </h3>
            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Hợp đồng thuê phòng.pdf</p>
                    <p className="text-sm text-gray-600">File PDF hợp đồng đã ký</p>
                  </div>
                </div>
                <a
                  href={`${BACKEND_URL}${contract.contractFile}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Xem File
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Duration */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Thời Hạn Hợp Đồng</h3>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Bắt đầu</p>
                <p className="text-2xl font-bold text-gray-900">
                  {contract.startDate ? new Date(contract.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-blue-500 rounded"></div>
                <Calendar className="w-8 h-8 text-blue-500" />
                <div className="w-16 h-1 bg-blue-500 rounded"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Kết thúc</p>
                <p className="text-2xl font-bold text-gray-900">
                  {contract.endDate ? new Date(contract.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                </p>
              </div>
            </div>
            {contract.startDate && contract.endDate && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Thời gian hợp đồng:{' '}
                  <span className="font-semibold text-gray-900">
                    {Math.ceil(
                      (new Date(contract.endDate) - new Date(contract.startDate)) / (1000 * 60 * 60 * 24 * 30)
                    )}{' '}
                    tháng
                  </span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contract File Section */}
      {contract.contractFile && (
        <Card className="border-2 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">File Hợp Đồng</h3>
                  <p className="text-sm text-gray-600">Hợp đồng thuê trọ đã được ký và xác nhận</p>
                </div>
              </div>
              <Button
                onClick={() => window.open(`${BACKEND_URL}${contract.contractFile}`, '_blank')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                Xem File Hợp Đồng
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Notice */}
      <Card className="border-2 border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Lưu Ý Quan Trọng</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Vui lòng đọc kỹ các điều khoản hợp đồng</li>
                <li>• Thanh toán tiền thuê đúng hạn để tránh phát sinh chi phí</li>
                <li>• Liên hệ quản lý khi có thắc mắc về hợp đồng</li>
                <li>• Báo trước ít nhất 1 tháng nếu muốn chấm dứt hợp đồng</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
