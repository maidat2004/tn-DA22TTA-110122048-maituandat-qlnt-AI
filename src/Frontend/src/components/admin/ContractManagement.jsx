import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Plus, Edit, Trash2, Search, FileText, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { contractService, tenantService, roomService } from '../../services';
import { toast } from 'sonner';
import { BACKEND_URL } from '../../config/api';

export default function ContractManagement() {
  const [contracts, setContracts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingContract, setEditingContract] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsData, tenantsData, roomsData] = await Promise.all([
        contractService.getContracts(),
        tenantService.getTenants(),
        roomService.getRooms()
      ]);
      setContracts(contractsData);
      setTenants(tenantsData);
      setRooms(roomsData);
      console.log('Loaded rooms:', roomsData);
      console.log('Sample room with price:', roomsData[0]);
    } catch (error) {
      toast.error('Không thể tải dữ liệu');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter(contract => {
    const tenant = contract.tenant;
    const room = contract.room;
    const matchesSearch = tenant?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room?.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || contract.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      expired: 'bg-gray-100 text-gray-700',
      terminated: 'bg-red-100 text-red-700'
    };
    const labels = {
      active: 'Đang hoạt động',
      expired: 'Đã hết hạn',
      terminated: 'Đã hủy'
    };
    return (
      <Badge className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getTenantName = (tenant) => {
    if (!tenant) return 'N/A';
    return tenant.fullName || tenant.name || 'N/A';
  };

  const getRoomNumber = (room) => {
    if (!room) return 'N/A';
    return room.roomNumber || 'N/A';
  };

  const generateContractNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `HD-${year}${month}${day}-${random}`;
  };

  const handleAddContract = () => {
    setEditingContract({
      contractNumber: generateContractNumber(),
      tenant: '',
      room: '',
      startDate: '',
      endDate: '',
      deposit: 0,
      monthlyRent: 0,
      terms: 'Thanh toán trước ngày 5 hàng tháng.\nKhông được nuôi thú cưng.\nGiữ gìn vệ sinh chung.',
      status: 'active',
      signedDate: new Date().toISOString().split('T')[0],
      // Tự động đánh dấu đã ký khi upload file
      isSignedByTenant: true,
      isSignedByAdmin: true,
      confirmedAt: new Date().toISOString()
    });
    setIsDialogOpen(true);
  };

  const handleEditContract = (contract) => {
    setEditingContract({ 
      ...contract,
      // Đảm bảo trạng thái ký được giữ nguyên
      isSignedByTenant: contract.isSignedByTenant || (contract.contractFile ? true : false),
      isSignedByAdmin: contract.isSignedByAdmin || (contract.contractFile ? true : false),
      confirmedAt: contract.confirmedAt || (contract.contractFile ? new Date().toISOString() : null)
    });
    setIsDialogOpen(true);
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    if (!editingContract) return;

    // Validation cho hợp đồng mới
    if (!editingContract._id) {
      if (!editingContract.tenant) {
        toast.error('❌ Vui lòng chọn người thuê!');
        return;
      }
      if (!editingContract.room) {
        toast.error('❌ Vui lòng chọn phòng!');
        return;
      }
      if (!editingContract.contractFile || typeof editingContract.contractFile === 'string') {
        toast.error('❌ Vui lòng upload file hợp đồng!');
        return;
      }
    }

    try {
      let contractId;
      
      if (editingContract._id) {
        // Update existing contract
        await contractService.updateContract(editingContract._id, editingContract);
        contractId = editingContract._id;
        toast.success('✅ Cập nhật hợp đồng thành công!');
      } else {
        // Create new contract - Loại bỏ file object trước khi gửi
        const contractData = { ...editingContract };
        delete contractData.contractFile; // Xóa file object khỏi payload
        
        console.log('📝 Sending contract data to backend:', contractData);
        const newContract = await contractService.createContract(contractData);
        console.log('✅ Contract created:', newContract);
        contractId = newContract._id;
        toast.success('🎉 Thêm hợp đồng thành công!');
      }
      
      // Upload file if selected
      if (editingContract.contractFile && typeof editingContract.contractFile !== 'string') {
        const formData = new FormData();
        formData.append('contractFile', editingContract.contractFile);
        
        await contractService.uploadContractFile(contractId, formData);
        toast.success('📄 Upload file hợp đồng thành công!');
        
        // Tự động đánh dấu đã ký và xác nhận khi upload file
        await contractService.confirmContract(contractId);
        toast.success('✅ Hợp đồng đã được xác nhận!');
      }
      
      setIsDialogOpen(false);
      setEditingContract(null);
      await loadData(); // Reload data
    } catch (error) {
      toast.error(error.message || 'Không thể lưu thông tin hợp đồng');
      console.error('Error saving contract:', error);
    }
  };

  const handleDeleteContract = async (contractId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hợp đồng này?')) return;
    
    try {
      await contractService.deleteContract(contractId);
      toast.success('✅ Xóa hợp đồng thành công!');
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Không thể xóa hợp đồng');
      console.error('Error deleting contract:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Quản Lý Hợp Đồng</h1>
          <p className="text-gray-600">Quản lý hợp đồng thuê trọ</p>
        </div>
        <Button 
          onClick={handleAddContract}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm Hợp Đồng Mới
        </Button>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-blue-800">
                {editingContract && editingContract._id ? '✏️ Chỉnh Sửa Hợp Đồng' : '➕ Thêm Hợp Đồng Mới'}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                {editingContract && editingContract._id 
                  ? 'Chỉnh sửa thông tin hợp đồng thuê trọ'
                  : 'Chọn người thuê để tự động điền thông tin, sau đó upload file hợp đồng'
                }
              </DialogDescription>
            </DialogHeader>
            {editingContract && (
              <form onSubmit={handleSaveContract} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant">Người Thuê *</Label>
                    <Select
                      value={editingContract.tenant}
                      onValueChange={(value) => {
                        console.log('Tenant selected:', value);
                        const selectedTenant = tenants.find(t => t._id === value);
                        console.log('Selected tenant:', selectedTenant);
                        
                        let newContract = { ...editingContract, tenant: value };
                        
                        // Tự động điền thông tin từ tenant
                        if (selectedTenant) {
                          // Nếu tenant có phòng, tự động chọn phòng đó
                          if (selectedTenant.room) {
                            const tenantRoom = rooms.find(r => r._id === selectedTenant.room._id || r._id === selectedTenant.room);
                            if (tenantRoom) {
                              console.log('Auto-selecting room:', tenantRoom);
                              newContract.room = tenantRoom._id;
                              newContract.monthlyRent = tenantRoom.price || 0;
                            }
                          }
                          
                          // Tự động điền ngày bắt đầu từ moveInDate nếu có
                          if (selectedTenant.moveInDate && !editingContract.startDate) {
                            newContract.startDate = new Date(selectedTenant.moveInDate).toISOString().split('T')[0];
                          }
                          
                          // Tự động điền tiền cọc bằng 1 tháng thuê nếu chưa có
                          if (!editingContract.deposit && newContract.monthlyRent > 0) {
                            newContract.deposit = newContract.monthlyRent;
                          }
                          
                          // Tự động điền ngày kết thúc (1 năm sau ngày bắt đầu)
                          if (newContract.startDate && !editingContract.endDate) {
                            const startDate = new Date(newContract.startDate);
                            const endDate = new Date(startDate);
                            endDate.setFullYear(endDate.getFullYear() + 1);
                            newContract.endDate = endDate.toISOString().split('T')[0];
                          }
                        }
                        
                        setEditingContract(newContract);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn người thuê" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map(tenant => (
                          <SelectItem key={tenant._id} value={tenant._id}>
                            {tenant.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingContract.tenant && (
                      <p className="text-xs text-green-600 font-medium">
                        ✓ Đã chọn: {tenants.find(t => t._id === editingContract.tenant)?.fullName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room">Phòng *</Label>
                    <Select
                      value={editingContract.room}
                      onValueChange={(value) => {
                        console.log('=== ROOM SELECTION ===');
                        console.log('Selected room ID:', value);
                        const selectedRoom = rooms.find(r => r._id === value);
                        console.log('Found room:', selectedRoom);
                        const roomPrice = selectedRoom?.price || 0;
                        console.log('Room price:', roomPrice);
                        
                        const newContract = { 
                          ...editingContract, 
                          room: value,
                          monthlyRent: roomPrice
                        };
                        console.log('New contract state:', newContract);
                        setEditingContract(newContract);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn phòng" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.filter(r => r.status === 'available' || r._id === editingContract.room).map(room => (
                          <SelectItem key={room._id} value={room._id}>
                            Phòng {room.roomNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingContract.room && (
                      <p className="text-xs text-green-600 font-medium">
                        ✓ Đã chọn: Phòng {rooms.find(r => r._id === editingContract.room)?.roomNumber}
                        {editingContract.monthlyRent > 0 && ` - Giá: ${formatCurrency(editingContract.monthlyRent)}`}
                        {(() => {
                          const selectedTenant = tenants.find(t => t._id === editingContract.tenant);
                          if (selectedTenant && selectedTenant.room && (selectedTenant.room._id === editingContract.room || selectedTenant.room === editingContract.room)) {
                            return <span className="text-blue-600"> (Phòng hiện tại của người thuê)</span>;
                          }
                          return null;
                        })()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Ngày Bắt Đầu *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={editingContract.startDate || ''}
                      onChange={(e) => setEditingContract({ ...editingContract, startDate: e.target.value })}
                      required
                    />
                    {editingContract.startDate && (() => {
                      const selectedTenant = tenants.find(t => t._id === editingContract.tenant);
                      if (selectedTenant && selectedTenant.moveInDate) {
                        const tenantMoveInDate = new Date(selectedTenant.moveInDate).toISOString().split('T')[0];
                        if (editingContract.startDate === tenantMoveInDate) {
                          return <p className="text-xs text-blue-600 font-medium">📅 Từ ngày dọn vào của người thuê</p>;
                        }
                      }
                      return null;
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Ngày Kết Thúc *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={editingContract.endDate || ''}
                      onChange={(e) => setEditingContract({ ...editingContract, endDate: e.target.value })}
                      required
                    />
                    {editingContract.endDate && editingContract.startDate && (() => {
                      const startDate = new Date(editingContract.startDate);
                      const endDate = new Date(editingContract.endDate);
                      const diffTime = Math.abs(endDate - startDate);
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      if (diffDays === 365 || diffDays === 366) {
                        return <p className="text-xs text-blue-600 font-medium">📅 Tự động tính 1 năm hợp đồng</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deposit">Tiền Cọc (VNĐ) *</Label>
                    <Input
                      id="deposit"
                      type="number"
                      value={editingContract.deposit || 0}
                      onChange={(e) => setEditingContract({ ...editingContract, deposit: parseInt(e.target.value) })}
                      required
                    />
                    {editingContract.deposit > 0 && editingContract.deposit === editingContract.monthlyRent && (
                      <p className="text-xs text-blue-600 font-medium">
                        💰 Tự động điền bằng 1 tháng thuê
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRent">Tiền Thuê/Tháng (VNĐ) *</Label>
                    <Input
                      id="monthlyRent"
                      type="number"
                      value={editingContract.monthlyRent || ''}
                      onChange={(e) => setEditingContract({ ...editingContract, monthlyRent: parseInt(e.target.value) || 0 })}
                      placeholder="Giá sẽ tự động điền khi chọn phòng"
                      required
                    />
                    {editingContract.monthlyRent > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        💰 Giá thuê từ phòng đã chọn
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signedDate">Ngày Ký *</Label>
                    <Input
                      id="signedDate"
                      type="date"
                      value={editingContract.signedDate || ''}
                      onChange={(e) => setEditingContract({ ...editingContract, signedDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Trạng Thái *</Label>
                    <Select
                      value={editingContract.status || 'active'}
                      onValueChange={(value) => setEditingContract({ ...editingContract, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Đang hoạt động</SelectItem>
                        <SelectItem value="expired">Đã hết hạn</SelectItem>
                        <SelectItem value="terminated">Đã hủy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Điều Khoản</Label>
                  <Textarea
                    id="terms"
                    value={editingContract.terms || ''}
                    onChange={(e) => setEditingContract({ ...editingContract, terms: e.target.value })}
                    rows={5}
                  />
                </div>

                <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label htmlFor="contractFile" className="text-lg font-semibold text-blue-800">
                    📄 File Hợp Đồng (PDF) *
                  </Label>
                  <p className="text-sm text-blue-600 mb-2">
                    Bước cuối cùng: Upload file hợp đồng đã ký để hoàn tất
                  </p>
                  <Input
                    id="contractFile"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setEditingContract({ ...editingContract, contractFile: e.target.files[0] })}
                    className="border-blue-300 focus:border-blue-500"
                  />
                  {editingContract.contractFile && typeof editingContract.contractFile !== 'string' && (
                    <p className="text-sm text-green-600 font-medium">
                      ✓ Đã chọn file: {editingContract.contractFile.name}
                    </p>
                  )}
                  {editingContract.contractFile && typeof editingContract.contractFile === 'string' && (
                    <p className="text-sm text-gray-600">
                      File hiện tại: <a href={`${BACKEND_URL}${editingContract.contractFile}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Xem file</a>
                    </p>
                  )}
                  {!editingContract.contractFile && (
                    <p className="text-sm text-orange-600">
                      ⚠️ Vui lòng upload file hợp đồng để hoàn tất việc tạo hợp đồng
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Hủy
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                    disabled={!editingContract._id && (!editingContract.contractFile || typeof editingContract.contractFile === 'string')}
                  >
                    {editingContract?._id ? 'Cập nhật' : 
                     (editingContract.contractFile && typeof editingContract.contractFile !== 'string') ? 
                     '📄 Hoàn Tất Tạo Hợp Đồng' : '⏳ Chờ Upload File'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên người thuê hoặc số phòng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Lọc theo trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="expired">Đã hết hạn</SelectItem>
                <SelectItem value="terminated">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts List */}
      <div className="space-y-4">
        {filteredContracts.map((contract) => (
          <Card key={contract._id}>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-gray-900">{contract.tenant?.fullName || 'N/A'}</h3>
                      <p className="text-sm text-gray-500 mt-1">Phòng {contract.room?.roomNumber || 'N/A'}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {getStatusBadge(contract.status)}
                      {contract.contractFile && (
                        <Badge className="bg-blue-100 text-blue-700">
                          📄 Có file
                        </Badge>
                      )}
                      {contract.confirmedAt && (
                        <Badge className="bg-green-100 text-green-700">
                          ✅ Đã xác nhận
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600">Bắt đầu</p>
                        <p className="text-gray-900">
                          {new Date(contract.startDate).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600">Kết thúc</p>
                        <p className="text-gray-900">
                          {new Date(contract.endDate).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600">Tiền cọc</p>
                        <p className="text-gray-900">{formatCurrency(contract.deposit)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600">Tiền thuê</p>
                        <p className="text-gray-900">{formatCurrency(contract.monthlyRent)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex lg:flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 lg:flex-none"
                    onClick={() => handleEditContract(contract)}
                  >
                    <Edit className="w-4 h-4 lg:mr-2" />
                    <span className="hidden lg:inline">Sửa</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 lg:flex-none text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteContract(contract._id)}
                  >
                    <Trash2 className="w-4 h-4 lg:mr-2" />
                    <span className="hidden lg:inline">Xóa</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContracts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Không tìm thấy hợp đồng nào</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}