import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Plus, Edit, Trash2, Search, Upload, X, Image as ImageIcon } from 'lucide-react';
import { roomService } from '../../services';
import { serviceService } from '../../services/serviceService';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const normalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_ORIGIN}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingRoom, setEditingRoom] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [services, setServices] = useState([]);

  useEffect(() => {
    loadRooms();

    // Reload rooms when window gets focus (user switches back to this page)
    const handleFocus = () => {
      loadRooms();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Also set up interval to refresh every 30 seconds
    const interval = setInterval(() => {
      loadRooms();
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const [data, serviceData] = await Promise.all([
        roomService.getRooms(),
        serviceService.getServices()
      ]);
      setRooms(data);
      setServices(serviceData);
    } catch (error) {
      toast.error('Không thể tải danh sách phòng');
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.ward?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || room.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getServiceByType = (type) => services.find((service) => service.type === type);

  const getStatusBadge = (status) => {
    const styles = {
      available: 'bg-green-100 text-green-700 border border-green-200',
      occupied: 'bg-blue-100 text-blue-700 border border-blue-200',
      maintenance: 'bg-red-100 text-red-700 border border-red-200',
      reserved: 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    };
    const labels = {
      available: '🟢 Trống',
      occupied: '👥 Đã thuê',
      maintenance: '🔧 Bảo trì',
      reserved: '📝 Đã đặt'
    };
    return (
      <Badge className={styles[status] || styles.available}>
        {labels[status] || status}
      </Badge>
    );
  };

  const handleAddRoom = () => {
    setEditingRoom({
      roomNumber: '',
      floor: 1,
      area: 0,
      length: 0,
      width: 0,
      price: 0,
      status: 'available',
      description: '',
      amenities: [],
      capacity: 2,
      electricPrice: 0,
      waterPrice: 0
    });
    setSelectedImages([null, null, null, null, null]);
    setIsDialogOpen(true);
  };

  const handleEditRoom = (room) => {
    setEditingRoom({ ...room });
    setSelectedImages([null, null, null, null, null]);
    setIsDialogOpen(true);
  };

  const handleImageSelect = (e, slot) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      e.target.value = '';
      return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      e.target.value = '';
      return;
    }
    
    // Update selectedImages at specific slot
    setSelectedImages(prev => {
      const newImages = [...prev];
      newImages[slot] = file;
      return newImages;
    });
  };

  const handleRemoveSelectedImage = (slot) => {
    setSelectedImages(prev => {
      const newImages = [...prev];
      newImages[slot] = null;
      return newImages;
    });
  };

  const handleDeleteExistingImage = async (imageUrl) => {
    if (!editingRoom?._id) return;
    
    if (!confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return;
    
    try {
      await roomService.deleteRoomImage(editingRoom._id, imageUrl);
      toast.success('Đã xóa ảnh thành công');
      
      // Update local state
      setEditingRoom(prev => ({
        ...prev,
        images: prev.images.filter(img => img !== imageUrl)
      }));
      
      await loadRooms();
    } catch (error) {
      toast.error('Không thể xóa ảnh');
      console.error('Error deleting image:', error);
    }
  };

  const handleUploadImages = async () => {
    if (!editingRoom?._id) return;
    
    const filesToUpload = selectedImages.filter(img => img !== null && img !== undefined);
    
    if (filesToUpload.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ảnh');
      return;
    }
    
    try {
      setUploadingImages(true);
      await roomService.uploadRoomImages(editingRoom._id, filesToUpload);
      toast.success('Upload ảnh thành công!');
      setSelectedImages([null, null, null, null, null]);
      await loadRooms();
      
      // Reload room data
      const updatedRoom = await roomService.getRoom(editingRoom._id);
      setEditingRoom(updatedRoom);
    } catch (error) {
      toast.error(error.message || 'Không thể upload ảnh');
      console.error('Error uploading images:', error);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!editingRoom) return;

    try {
      setUploadingImages(true);
      const filesToUpload = selectedImages.filter(img => img !== null && img !== undefined);
      
      if (editingRoom._id) {
        // Update existing room
        await roomService.updateRoom(editingRoom._id, editingRoom);
        
        // Upload images if selected
        if (filesToUpload.length > 0) {
          await roomService.uploadRoomImages(editingRoom._id, filesToUpload);
        }
        
        toast.success('✅ Cập nhật phòng và tải ảnh thành công!');
      } else {
        // Create new room
        const result = await roomService.createRoom(editingRoom);
        const newRoomId = result.data?._id;
        
        // Upload images if selected
        if (filesToUpload.length > 0 && newRoomId) {
          await roomService.uploadRoomImages(newRoomId, filesToUpload);
        }
        
        toast.success('🎉 Thêm phòng và tải ảnh thành công!');
      }
      
      setIsDialogOpen(false);
      setEditingRoom(null);
      setSelectedImages([null, null, null, null, null]);
      await loadRooms(); // Reload rooms
    } catch (error) {
      toast.error(error.message || 'Không thể lưu thông tin phòng');
      console.error('Error saving room:', error);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phòng này?')) return;
    
    try {
      await roomService.deleteRoom(roomId);
      toast.success('✅ Xóa phòng thành công!');
      await loadRooms();
    } catch (error) {
      toast.error(error.message || 'Không thể xóa phòng');
      console.error('Error deleting room:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản Lý Phòng</h1>
          <p className="text-gray-600">Quản lý thông tin các phòng trọ</p>
        </div>
        <Button 
          onClick={handleAddRoom}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm Phòng Mới
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoom?.roomNumber ? 'Chỉnh Sửa Phòng' : 'Thêm Phòng Mới'}
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin chi tiết của phòng trọ
            </DialogDescription>
          </DialogHeader>
            {editingRoom && (
              <form onSubmit={handleSaveRoom} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomNumber">Số Phòng *</Label>
                    <Input
                      id="roomNumber"
                      value={editingRoom.roomNumber || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, roomNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">Tầng *</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={editingRoom.floor || 1}
                      onChange={(e) => setEditingRoom({ ...editingRoom, floor: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area">Diện Tích (m²) *</Label>
                    <Input
                      id="area"
                      type="number"
                      value={editingRoom.area || 0}
                      onChange={(e) => setEditingRoom({ ...editingRoom, area: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Giá Thuê (VNĐ) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={editingRoom.price || 0}
                      onChange={(e) => setEditingRoom({ ...editingRoom, price: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length">Chiều Dài (m)</Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.1"
                      value={editingRoom.length || 0}
                      onChange={(e) => setEditingRoom({ ...editingRoom, length: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width">Chiều Rộng (m)</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.1"
                      value={editingRoom.width || 0}
                      onChange={(e) => setEditingRoom({ ...editingRoom, width: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Số Người Tối Đa *</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={editingRoom.capacity || 2}
                      onChange={(e) => setEditingRoom({ ...editingRoom, capacity: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Trạng Thái *</Label>
                    <Select
                      value={editingRoom.status || 'available'}
                      onValueChange={(value) => setEditingRoom({ ...editingRoom, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Trống</SelectItem>
                        <SelectItem value="occupied">Đã thuê</SelectItem>
                        <SelectItem value="maintenance">Bảo trì</SelectItem>
                        <SelectItem value="reserved">Đã đặt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="electricPrice">Giá Điện (VNĐ/kWh)</Label>
                    <Input
                      id="electricPrice"
                      type="number"
                      value={getServiceByType('electricity')?.unitPrice || 0}
                      disabled
                      className="bg-gray-50 text-gray-700"
                    />
                    <p className="text-xs text-gray-500">Gia lay tu trang Dich vu.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waterPrice">Giá Nước (VNĐ/m³)</Label>
                    <Input
                      id="waterPrice"
                      type="number"
                      value={getServiceByType('water')?.unitPrice || 0}
                      disabled
                      className="bg-gray-50 text-gray-700"
                    />
                    <p className="text-xs text-gray-500">Gia lay tu trang Dich vu.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Mô Tả</Label>
                  <Textarea
                    id="description"
                    value={editingRoom.description || ''}
                    onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Image Upload Section */}
                <div className="space-y-4 border-t pt-5">
                  <Label className="text-base font-semibold flex items-center gap-2 text-gray-900">
                    <ImageIcon className="w-5 h-5" />
                    Hình Ảnh Phòng (Tối đa 5 ảnh)
                  </Label>

                  <p className="text-sm text-gray-500">
                    Ảnh đầu tiên sẽ được dùng làm ảnh đại diện ngoài trang public. Tất cả ảnh được hiển thị trong khung cố định để UI luôn đều.
                  </p>

                  {/* Existing Images */}
                  {editingRoom?._id && editingRoom?.images?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Ảnh hiện có ({editingRoom.images.length}/5):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {editingRoom.images.map((imageUrl, index) => (
                          <div key={index} className="space-y-1">
                            <div className="rounded-lg border border-gray-200 bg-gray-100 shadow-sm overflow-hidden" style={{ aspectRatio: '16 / 10' }}>
                              <img
                                src={normalizeImageUrl(imageUrl)}
                                alt={`Room ${editingRoom.roomNumber} - ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-size="16" font-family="Arial" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E🏠%3C/text%3E%3C/svg%3E';
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs text-gray-500">{index === 0 ? '📌 Ảnh bìa' : `Ảnh ${index + 1}`}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteExistingImage(imageUrl)}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors font-medium"
                              >
                                <Trash2 className="w-3 h-3" />
                                Xóa
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {(!editingRoom?._id || (editingRoom?.images?.length || 0) < 5) && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-gray-700">
                        {editingRoom?._id 
                          ? `Thêm ảnh mới (${5 - (editingRoom?.images?.length || 0)} vị trí còn trống):`
                          : 'Chọn ảnh phòng (Tối đa 5 ảnh):'}
                      </p>
                      
                      {/* Image Upload Slots */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Array.from({ length: 5 - (editingRoom?.images?.length || 0) }, (_, slot) => slot).map((slot) => {
                          const hasSelectedImage = selectedImages[slot];
                          return (
                            <div key={slot} className="space-y-2">
                              <Label className="text-sm text-gray-600">Ảnh {slot + 1}</Label>
                              <div className="relative overflow-hidden rounded-lg bg-gray-50" style={{ aspectRatio: '16 / 10' }}>
                                {hasSelectedImage ? (
                                  <div className="relative group w-full h-full">
                                    <img
                                      src={URL.createObjectURL(hasSelectedImage)}
                                      alt={`Preview ${slot + 1}`}
                                      className="w-full h-full object-cover border-2 border-blue-400 rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSelectedImage(slot)}
                                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-all shadow-lg"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                      {(hasSelectedImage.size / 1024).toFixed(0)}KB
                                    </div>
                                  </div>
                                ) : (
                                  <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                      <p className="text-sm text-gray-500 font-medium">Chọn ảnh {slot + 1}</p>
                                      <p className="text-xs text-gray-400">PNG, JPG, GIF (Max 5MB)</p>
                                    </div>
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleImageSelect(e, slot)}
                                      className="hidden"
                                      disabled={uploadingImages}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Upload Button */}
                      {editingRoom?._id && selectedImages.some(img => img !== null && img !== undefined) && (
                        <div className="flex justify-center pt-2">
                          <Button
                            type="button"
                            onClick={handleUploadImages}
                            disabled={uploadingImages}
                            className="bg-green-600 hover:bg-green-700 text-white px-8 py-2"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploadingImages ? 'Đang tải...' : `Upload ${selectedImages.filter(img => img).length} ảnh`}
                          </Button>
                        </div>
                      )}

                      <p className="text-xs text-gray-500 text-center">
                        💡 Chấp nhận: JPG, PNG, GIF, WEBP • Tối đa: 5MB/ảnh • Tổng: 5 ảnh
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={uploadingImages}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={uploadingImages}>
                    {uploadingImages ? 'Đang lưu & tải ảnh...' : (editingRoom?._id ? 'Cập nhật' : 'Xác nhận')}
                  </Button>
                </div>
              </form>
            )}
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      {!loading && rooms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🏠</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tổng phòng</p>
                  <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phòng trống</p>
                  <p className="text-2xl font-bold text-green-600">
                    {rooms.filter(r => r.status === 'available').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Đã cho thuê</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {rooms.filter(r => r.status === 'occupied').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🔧</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bảo trì</p>
                  <p className="text-2xl font-bold text-red-600">
                    {rooms.filter(r => r.status === 'maintenance').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo số phòng hoặc mô tả..."
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
                <SelectItem value="available">Trống</SelectItem>
                <SelectItem value="occupied">Đã thuê</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
                <SelectItem value="reserved">Đã đặt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid */}
      {loading ? (
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
      ) : filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                <span className="text-6xl">🏠</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {rooms.length === 0 ? 'Chưa có phòng nào' : 'Không tìm thấy phòng'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {rooms.length === 0 
                    ? 'Hãy bắt đầu bằng cách thêm phòng trọ đầu tiên của bạn' 
                    : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'}
                </p>
              </div>
              {rooms.length === 0 && (
                <Button 
                  onClick={handleAddRoom}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg text-lg px-8 py-6"
                >
                  <Plus className="w-6 h-6 mr-2" />
                  Thêm Phòng Đầu Tiên
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => {
            const statusConfig = {
              available: { 
                gradient: 'from-green-400 to-green-500',
                bg: 'from-green-50 to-green-100',
                icon: '🏠',
                color: 'text-green-600'
              },
              occupied: { 
                gradient: 'from-blue-400 to-blue-500',
                bg: 'from-blue-50 to-blue-100',
                icon: '🏘️',
                color: 'text-blue-600'
              },
              maintenance: { 
                gradient: 'from-red-400 to-red-500',
                bg: 'from-red-50 to-red-100',
                icon: '🛠️',
                color: 'text-red-600'
              },
              reserved: { 
                gradient: 'from-yellow-400 to-yellow-500',
                bg: 'from-yellow-50 to-yellow-100',
                icon: '📋',
                color: 'text-yellow-600'
              }
            };
            
            const config = statusConfig[room.status] || statusConfig.available;
          
          return (
            <Card key={room._id || room.id} className="overflow-hidden border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
              <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />
              
              {/* Room Image */}
              {room.images && room.images.length > 0 ? (
                <div className="relative overflow-hidden bg-slate-100" style={{ aspectRatio: '16 / 9' }}>
                  <img
                    src={normalizeImageUrl(room.images[0])}
                    alt={`Phòng ${room.roomNumber}`}
                    className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="hidden absolute inset-0 flex-col items-center justify-center bg-slate-50 text-slate-500">
                    <ImageIcon className="w-9 h-9 mb-2" />
                    <span className="text-sm font-medium">Ảnh không tải được</span>
                  </div>
                  {room.images.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      {room.images.length}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-b border-dashed border-gray-200 bg-slate-50 text-slate-500" style={{ aspectRatio: '16 / 9' }}>
                  <ImageIcon className="w-10 h-10 mb-2 text-slate-400" />
                  <span className="text-sm font-medium">Chưa có ảnh phòng</span>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${config.bg} rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                      {config.icon}
                    </div>
                    <div>
                      <CardTitle className="text-xl">Phòng {room.roomNumber}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">🏢 Tầng {room.floor}</p>
                    </div>
                  </div>
                  {getStatusBadge(room.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">📐</span>
                      <span className="text-sm text-gray-600">Diện tích:</span>
                    </div>
                    <span className="text-right text-gray-900">
                      {room.area} m²
                      {room.length && room.width ? (
                        <span className="block text-xs text-gray-500">{room.length}m x {room.width}m</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">💰</span>
                      <span className="text-sm text-gray-600">Giá thuê:</span>
                    </div>
                    <span className={`${config.color}`}>{formatCurrency(room.price)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">👥</span>
                      <span className="text-sm text-gray-600">Sức chứa:</span>
                    </div>
                    <span className="text-gray-900">
                      {room.capacity} người
                    </span>
                  </div>
                </div>

                {room.description && (
                  <div className="p-3 bg-gradient-to-br from-gray-50 to-white rounded-lg border">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      💬 {room.description}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    onClick={() => handleEditRoom(room)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    onClick={() => handleDeleteRoom(room._id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
