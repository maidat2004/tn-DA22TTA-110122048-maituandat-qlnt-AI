import { useEffect, useMemo, useState } from 'react';
import { roomService, tenantService, requestService } from '../../services';
import { useAuth } from '../../hooks';
import { useNavigate } from 'react-router-dom';
import { vietnamProvinceOptions, occupationOptions } from '../../constants/profileOptions';
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  Home,
  Image as ImageIcon,
  MapPin,
  Ruler,
  Users,
  Wifi,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const statusConfig = {
  available: { label: 'Trống', className: 'bg-green-100 text-green-700 border-green-200' },
  occupied: { label: 'Đã thuê', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  maintenance: { label: 'Bảo trì', className: 'bg-orange-100 text-orange-700 border-orange-200' }
};

const defaultAmenities = ['WiFi', 'Chỗ để xe', 'An ninh', 'Gần trường'];

const normalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_ORIGIN}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

export default function RoomGalleryPage() {
  const maxDobDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  }, []);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRentModal, setShowRentModal] = useState(false);
  const [rentRoom, setRentRoom] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [userTenant, setUserTenant] = useState(null);
  const [checkingTenant, setCheckingTenant] = useState(false);
  const [rentForm, setRentForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    idCard: '',
    dateOfBirth: '',
    hometown: '',
    currentAddress: '',
    occupation: 'Sinh viên',
    school: '',
    emergencyContact: '',
    emergencyPhone: '',
    relationship: '',
    moveInDate: '',
    notes: ''
  });

  const checkUserTenant = async (userId) => {
    if (!userId) return null;
    try {
      const response = await tenantService.getTenantByUser(userId);
      const tenant = response?.data || response;
      setUserTenant(tenant);
      return tenant;
    } catch (error) {
      console.error('Error fetching tenant:', error);
      return null;
    }
  };

  useEffect(() => {
    if (user) {
      checkUserTenant(user._id || user.id);
    } else {
      setUserTenant(null);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && rooms.length > 0) {
      const pendingRentRoomId = sessionStorage.getItem('rentRoomId');
      if (pendingRentRoomId) {
        const foundRoom = rooms.find(r => r._id === pendingRentRoomId);
        if (foundRoom && foundRoom.status === 'available') {
          sessionStorage.removeItem('rentRoomId');
          sessionStorage.removeItem('rentRoomNumber');
          
          if (user) {
            if (user.role === 'admin') {
              toast.error('Tài khoản Admin không thể thực hiện chức năng thuê phòng.');
            } else {
              handleRentClick(foundRoom);
            }
          }
        }
      }
    }
  }, [loading, rooms, user]);

  const handleRentClick = async (room) => {
    if (!user) {
      sessionStorage.setItem('rentRoomId', room._id);
      sessionStorage.setItem('rentRoomNumber', room.roomNumber);
      toast.info('Vui lòng đăng ký hoặc đăng nhập tài khoản để thuê phòng.');
      setTimeout(() => {
        navigate('/login');
      }, 800);
      return;
    }

    if (user.role === 'admin') {
      toast.error('Tài khoản Admin không thể thuê phòng.');
      return;
    }

    setCheckingTenant(true);
    try {
      const tenant = await checkUserTenant(user._id || user.id);
      
      if (tenant && tenant.room) {
        toast.error(`Bạn đang thuê phòng ${tenant.room.roomNumber || tenant.room} rồi. Mỗi tài khoản chỉ được thuê 1 phòng.`);
        setCheckingTenant(false);
        return;
      }

      setRentRoom(room);
      setRentForm({
        fullName: tenant?.fullName || user.name || '',
        phone: tenant?.phone || user.phone || '',
        email: tenant?.email || user.email || '',
        idCard: tenant?.idCard || '',
        dateOfBirth: tenant?.dateOfBirth ? new Date(tenant.dateOfBirth).toISOString().split('T')[0] : '',
        hometown: tenant?.hometown || '',
        currentAddress: tenant?.currentAddress || '',
        occupation: tenant?.occupation || 'Sinh viên',
        school: tenant?.school || '',
        emergencyContact: tenant?.emergencyContact?.name || '',
        emergencyPhone: tenant?.emergencyContact?.phone || '',
        relationship: tenant?.emergencyContact?.relationship || '',
        moveInDate: '',
        notes: ''
      });
      setShowRentModal(true);
    } catch (err) {
      console.error(err);
      toast.error('Đã xảy ra lỗi khi kiểm tra thông tin.');
    } finally {
      setCheckingTenant(false);
    }
  };

  const handleRentSubmit = async (e) => {
    e.preventDefault();
    if (!rentRoom) return;

    const selectedDate = new Date(rentForm.moveInDate);
    selectedDate.setHours(0, 0, 0, 0);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 5);
    minDate.setHours(0, 0, 0, 0);
    
    // Validation
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(rentForm.phone)) {
      toast.error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.');
      return;
    }

    if (rentForm.emergencyPhone && !phoneRegex.test(rentForm.emergencyPhone)) {
      toast.error('Số điện thoại khẩn cấp phải gồm 10 chữ số và bắt đầu bằng số 0.');
      return;
    }

    if (rentForm.dateOfBirth) {
      const dob = new Date(rentForm.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      
      if (age < 18) {
        toast.error('Bạn phải từ đủ 18 tuổi trở lên mới được phép đăng ký thuê trọ.');
        return;
      }
    }

    if (selectedDate < minDate) {
      toast.error('Ngày chuyển vào không được trước quá 5 ngày so với ngày hiện tại.');
      return;
    }

    setSubmitting(true);
    try {
      let tenantId = userTenant?._id;

      if (!userTenant) {
        const tenantPayload = {
          fullName: rentForm.fullName,
          phone: rentForm.phone,
          idCard: rentForm.idCard,
          dateOfBirth: rentForm.dateOfBirth,
          hometown: rentForm.hometown,
          currentAddress: rentForm.currentAddress,
          occupation: rentForm.occupation,
          school: rentForm.school,
          emergencyContact: {
            name: rentForm.emergencyContact,
            phone: rentForm.emergencyPhone,
            relationship: rentForm.relationship
          }
        };

        const regResult = await tenantService.registerTenant(tenantPayload);
        const tenantData = regResult?.data || regResult;
        if (tenantData && tenantData._id) {
          tenantId = tenantData._id;
          setUserTenant(tenantData);
        } else {
          throw new Error(regResult?.message || 'Không thể đăng ký hồ sơ người thuê.');
        }
      }

      const requestPayload = {
        title: `Yêu cầu thuê phòng ${rentRoom.roomNumber}`,
        description: `Tôi muốn thuê phòng ${rentRoom.roomNumber}.\n- Ngày chuyển vào dự kiến: ${new Date(rentForm.moveInDate).toLocaleDateString('vi-VN')}\n- Ghi chú: ${rentForm.notes || 'Không có'}`,
        type: 'other',
        priority: 'medium',
        room: rentRoom._id,
        tenant: tenantId,
        status: 'pending'
      };

      await requestService.createRequest(requestPayload);

      toast.success(`Gửi yêu cầu thuê phòng ${rentRoom.roomNumber} thành công! Vui lòng chờ phản hồi từ quản lý.`);
      setShowRentModal(false);
      setRentRoom(null);
      closeRoomDetail();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Gửi yêu cầu thuê phòng thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await roomService.getRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Không thể tải danh sách phòng');
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getRoomImages = (room) => {
    const images = (room?.images || []).filter(Boolean).map(normalizeImageUrl);
    return images;
  };

  const openRoomDetail = (room) => {
    setSelectedRoom(room);
    setCurrentImageIndex(0);
  };

  const closeRoomDetail = () => {
    setSelectedRoom(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    const images = getRoomImages(selectedRoom);
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    const images = getRoomImages(selectedRoom);
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const selectedImages = useMemo(() => getRoomImages(selectedRoom), [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom || selectedImages.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setCurrentImageIndex((prev) => (prev === selectedImages.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => window.clearInterval(timer);
  }, [selectedRoom, selectedImages.length]);

  const formatMeasurement = (value) => {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return null;
    return Number.isInteger(number) ? String(number) : number.toFixed(1).replace('.', ',');
  };

  const getDimensionText = (room) => {
    const length = formatMeasurement(room?.length);
    const width = formatMeasurement(room?.width);
    return length && width ? `${length}m x ${width}m` : 'Chưa cập nhật dài x rộng';
  };

  const renderRoomImage = (room, className = '') => {
    const images = getRoomImages(room);
    if (images.length === 0) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500">
          <ImageIcon className="w-10 h-10 mb-2" />
          <span className="text-sm font-medium">Chưa có ảnh phòng</span>
        </div>
      );
    }

    return (
      <>
      <div className="relative h-full w-full overflow-hidden bg-slate-100">
        <img
          src={images[0]}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-45"
          aria-hidden="true"
        />
        <img
          src={images[0]}
          alt={`Phòng ${room.roomNumber}`}
          className={`relative z-10 w-full h-full object-contain ${className}`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
            const fallback = event.currentTarget.parentElement?.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      </div>
      <div className="hidden w-full h-full flex-col items-center justify-center bg-gray-100 text-gray-500">
        <ImageIcon className="w-10 h-10 mb-2" />
        <span className="text-sm font-medium">Ảnh phòng không tải được</span>
      </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Đang tải danh sách phòng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <style>
        {`
          @keyframes room-gallery-fade {
            from { opacity: 0.72; transform: scale(0.985); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-sm font-semibold text-blue-600" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Phòng trọ sinh viên
          </p>
          <h1 className="text-4xl font-bold text-gray-900 mt-2">Danh sách phòng trọ</h1>
          <p className="text-gray-600 mt-3 max-w-2xl">
            Xem trước hình ảnh, giá thuê, diện tích, sức chứa và tiện ích để chọn phòng phù hợp trước khi liên hệ.
          </p>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
            <Home className="w-14 h-14 text-blue-500 mx-auto mb-4" />
            <p className="text-2xl text-gray-700 font-semibold">Chưa có phòng trọ nào</p>
            <p className="text-gray-500 mt-2">Vui lòng quay lại sau</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const status = statusConfig[room.status] || statusConfig.maintenance;
              const amenities = room.amenities?.length ? room.amenities.slice(0, 4) : defaultAmenities;
              const imageCount = room.images?.length || 0;

              return (
                <article
                  key={room._id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => openRoomDetail(room)}
                    className="relative w-full bg-gray-100 overflow-hidden group"
                    style={{ aspectRatio: '16 / 10' }}
                    aria-label={`Xem chi tiết phòng ${room.roomNumber}`}
                  >
                    {renderRoomImage(room, 'group-hover:scale-105 transition-transform duration-300')}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                    <div className="absolute top-3 left-3 px-3 py-1.5 bg-white/95 text-blue-700 rounded-full text-sm font-semibold shadow-sm">
                      Phòng {room.roomNumber}
                    </div>
                    <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-sm font-semibold border ${status.className}`}>
                      {status.label}
                    </div>
                    {imageCount > 1 && (
                      <div className="absolute bottom-3 left-3 bg-black/50 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
                        <ImageIcon className="w-4 h-4" />
                        {imageCount} ảnh
                      </div>
                    )}
                  </button>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Phòng {room.roomNumber}</h2>
                        <p className="text-sm text-gray-500 mt-1">Tầng {room.floor || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Giá thuê</p>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(room.price)}</p>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mt-4 min-h-10">
                      {room.description || 'Phòng trọ sạch sẽ, phù hợp sinh viên và người đi làm.'}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                          <Ruler className="w-4 h-4" />
                          Diện tích
                        </div>
                        <p className="font-semibold text-gray-900 mt-1">{room.area || 0}m²</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                          <Users className="w-4 h-4" />
                          Sức chứa
                        </div>
                        <p className="font-semibold text-gray-900 mt-1">{room.capacity || 1} người</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {amenities.map((amenity) => (
                        <span key={amenity} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          {amenity}
                        </span>
                      ))}
                    </div>

                    {room.status === 'available' ? (
                      <div className="flex gap-2 mt-5">
                        <button
                          type="button"
                          onClick={() => openRoomDetail(room)}
                          className="flex-1 px-3 py-3 rounded-lg border border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 text-sm"
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRentClick(room)}
                          className="flex-1 px-3 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 text-sm shadow-sm"
                        >
                          Thuê phòng
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openRoomDetail(room)}
                        className="mt-5 w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        Xem chi tiết
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedRoom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Phòng {selectedRoom.roomNumber}</h2>
                <p className="text-sm text-gray-500">Thông tin chi tiết để người thuê tham khảo trước khi chọn phòng</p>
              </div>
              <button
                type="button"
                onClick={closeRoomDetail}
                className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                aria-label="Đóng chi tiết phòng"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-y-auto">
              <div className="bg-slate-50 p-4">
                <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" style={{ aspectRatio: '16 / 10' }}>
                  {selectedImages.length === 0 && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500">
                      <ImageIcon className="w-12 h-12 mb-3" />
                      <span className="font-medium">Phòng này chưa có ảnh</span>
                    </div>
                  )}
                  {selectedImages.length > 0 && (
                    <div
                      key={selectedImages[currentImageIndex]}
                      className="absolute inset-0 bg-slate-100"
                      style={{ animation: 'room-gallery-fade 280ms ease-out' }}
                    >
                      <img
                        src={selectedImages[currentImageIndex]}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl transition-opacity duration-500"
                        aria-hidden="true"
                      />
                      <img
                        src={selectedImages[currentImageIndex]}
                        alt={`Phòng ${selectedRoom.roomNumber}`}
                        className="relative z-10 h-full w-full object-contain transition-opacity duration-500"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent" />
                  {selectedImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center transition-transform hover:scale-105"
                        aria-label="Ảnh trước"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center transition-transform hover:scale-105"
                        aria-label="Ảnh sau"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-white shadow">
                        <span className="text-sm font-medium">{currentImageIndex + 1} / {selectedImages.length}</span>
                        <span className="h-1 w-1 rounded-full bg-white/70" />
                        <span className="text-xs text-white/80">Tự chuyển sau 5s</span>
                      </div>
                    </>
                  )}
                </div>

                {selectedImages.length > 1 && (
                  <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                    {selectedImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => setCurrentImageIndex(index)}
                        className={`rounded-lg overflow-hidden border-2 bg-white transition-all ${index === currentImageIndex ? 'border-blue-600 shadow-md scale-[1.02]' : 'border-transparent opacity-75 hover:opacity-100'}`}
                        style={{ aspectRatio: '16 / 10' }}
                      >
                        <img
                          src={image}
                          alt={`Ảnh ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <aside className="p-5 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Giá thuê</p>
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(selectedRoom.price)}</p>
                    <p className="text-sm text-gray-500">/ tháng</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${(statusConfig[selectedRoom.status] || statusConfig.maintenance).className}`}>
                    {(statusConfig[selectedRoom.status] || statusConfig.maintenance).label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <Users className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-500">Sức chứa</p>
                    <p className="font-semibold text-gray-900">{selectedRoom.capacity || 1} người</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <Ruler className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-500">Diện tích</p>
                    <p className="font-semibold text-gray-900">{selectedRoom.area || 0}m²</p>
                    <p className="mt-1 text-xs text-gray-500">{getDimensionText(selectedRoom)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <Building2 className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-500">Tầng</p>
                    <p className="font-semibold text-gray-900">{selectedRoom.floor || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <BedDouble className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-500">Mã phòng</p>
                    <p className="font-semibold text-gray-900">{selectedRoom.roomNumber}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Mô tả phòng</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {selectedRoom.description || 'Phòng trọ sạch sẽ, thoáng mát, phù hợp sinh viên. Người thuê có thể liên hệ để xem phòng trực tiếp.'}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Tiện ích</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(selectedRoom.amenities?.length ? selectedRoom.amenities : defaultAmenities).map((amenity) => (
                      <div key={amenity} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <Wifi className="w-4 h-4 text-green-600" />
                        {amenity}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Vị trí</h3>
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-3 text-sm text-gray-700">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                    {[selectedRoom.address, selectedRoom.ward, selectedRoom.district, selectedRoom.city].filter(Boolean).join(', ') ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          [selectedRoom.address, selectedRoom.ward, selectedRoom.district, selectedRoom.city]
                            .filter(Boolean)
                            .join(', ')
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
                      >
                        {[selectedRoom.address, selectedRoom.ward, selectedRoom.district, selectedRoom.city]
                          .filter(Boolean)
                          .join(', ')}
                      </a>
                    ) : (
                      <span>Liên hệ chủ trọ để biết địa chỉ xem phòng.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2 font-semibold text-green-800 mb-1">
                    <Bath className="w-5 h-5" />
                    Gợi ý trước khi chọn phòng
                  </div>
                  <p className="text-sm text-green-700">
                    Kiểm tra diện tích, sức chứa, tiện ích và trạng thái phòng. Nếu phòng còn trống, bạn có thể đăng nhập để gửi yêu cầu hoặc liên hệ trực tiếp.
                  </p>
                </div>

                {selectedRoom.status === 'available' && (
                  <button
                    type="button"
                    onClick={() => handleRentClick(selectedRoom)}
                    className="w-full px-4 py-3.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>Thuê phòng ngay</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <div className="h-6" />
              </aside>
            </div>
          </div>
        </div>
      )}

      {showRentModal && rentRoom && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm p-4 flex items-center justify-center" style={{ zIndex: 2000 }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-[room-gallery-fade_200ms_ease-out]" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Đăng ký thuê phòng - Phòng {rentRoom.roomNumber}</h2>
                <p className="text-xs text-gray-500 mt-1">Cung cấp thông tin của bạn để gửi yêu cầu thuê phòng</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowRentModal(false); setRentRoom(null); }}
                className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRentSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!userTenant ? (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider border-b pb-2">👤 Thông tin cá nhân</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Họ và tên đầy đủ *</label>
                          <input
                            type="text"
                            required
                            value={rentForm.fullName}
                            onChange={(e) => setRentForm({ ...rentForm, fullName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="Nguyễn Văn A"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Số điện thoại *</label>
                          <input
                            type="tel"
                            required
                            value={rentForm.phone}
                            onChange={(e) => setRentForm({ ...rentForm, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="0912345678"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email tài khoản</label>
                          <input
                            type="email"
                            disabled
                            value={rentForm.email}
                            className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">CMND/CCCD *</label>
                          <input
                            type="text"
                            required
                            value={rentForm.idCard}
                            onChange={(e) => setRentForm({ ...rentForm, idCard: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="Số CMND hoặc căn cước 12 số"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ngày sinh *</label>
                          <input
                            type="date"
                            required
                            value={rentForm.dateOfBirth}
                            onChange={(e) => setRentForm({ ...rentForm, dateOfBirth: e.target.value })}
                            max={maxDobDate}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quê quán *</label>
                          <select
                            required
                            value={rentForm.hometown}
                            onChange={(e) => setRentForm({ ...rentForm, hometown: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            <option value="">-- Chọn tỉnh/thành --</option>
                            {vietnamProvinceOptions.map((province) => (
                              <option key={province} value={province}>{province}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nghề nghiệp</label>
                          <select
                            value={rentForm.occupation}
                            onChange={(e) => setRentForm({ ...rentForm, occupation: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            {occupationOptions.map((occ) => (
                              <option key={occ} value={occ}>{occ}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trường học/Công ty</label>
                          <input
                            type="text"
                            value={rentForm.school}
                            onChange={(e) => setRentForm({ ...rentForm, school: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="Tên trường học hoặc nơi làm việc"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Địa chỉ hiện tại</label>
                        <input
                          type="text"
                          value={rentForm.currentAddress}
                          onChange={(e) => setRentForm({ ...rentForm, currentAddress: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Số nhà, đường, phường/xã, quận/huyện"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider border-b pb-2">🚨 Liên hệ khẩn cấp</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Họ tên người liên hệ</label>
                          <input
                            type="text"
                            value={rentForm.emergencyContact}
                            onChange={(e) => setRentForm({ ...rentForm, emergencyContact: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Người thân liên hệ"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Số điện thoại khẩn cấp</label>
                          <input
                            type="tel"
                            value={rentForm.emergencyPhone}
                            onChange={(e) => setRentForm({ ...rentForm, emergencyPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            placeholder="SĐT người liên hệ"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mối quan hệ</label>
                          <input
                            type="text"
                            value={rentForm.relationship}
                            onChange={(e) => setRentForm({ ...rentForm, relationship: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Bố/Mẹ/Anh/Chị/Em..."
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <h4 className="font-bold text-sm text-blue-800 font-semibold">Thông tin liên hệ của bạn:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-900">
                      <p><span className="font-semibold text-blue-700">Họ tên:</span> {userTenant.fullName}</p>
                      <p><span className="font-semibold text-blue-700">SĐT:</span> {userTenant.phone}</p>
                      <p><span className="font-semibold text-blue-700">Email:</span> {userTenant.email}</p>
                      <p><span className="font-semibold text-blue-700">CCCD:</span> {userTenant.idCard}</p>
                    </div>
                    <p className="text-[11px] text-blue-700/80 italic pt-1 border-t border-blue-200/50">
                      Để chỉnh sửa thông tin cá nhân, vui lòng cập nhật tại trang Cá nhân sau khi đăng nhập.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider border-b pb-2">📅 Thông tin chuyển vào</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ngày chuyển vào dự kiến *</label>
                      <input
                        type="date"
                        required
                        value={rentForm.moveInDate}
                        onChange={(e) => setRentForm({ ...rentForm, moveInDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Hệ thống chấp nhận ngày dọn vào tối thiểu trước 5 ngày so với hôm nay.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ghi chú gửi chủ nhà</label>
                    <textarea
                      value={rentForm.notes}
                      onChange={(e) => setRentForm({ ...rentForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      rows={3}
                      placeholder="Những yêu cầu hoặc lời nhắn thêm..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => { setShowRentModal(false); setRentRoom(null); }}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1px solid #d9d9d9',
                    backgroundColor: '#ffffff',
                    color: '#434343',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '90px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#d9d9d9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#d9d9d9';
                  }}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#1677ff',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(22, 119, 255, 0.2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4096ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1677ff';
                  }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Đang xử lý...
                    </>
                  ) : (
                    'Gửi yêu cầu thuê phòng'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Bạn quan tâm đến phòng nào?</h2>
          <p className="text-gray-600 mb-6">Đăng nhập hoặc liên hệ chủ trọ để được tư vấn và xem phòng trực tiếp.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/login" className="public-cta public-cta-primary px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Đăng nhập để chọn phòng
            </a>
            <a href="tel:0795473012" className="public-cta public-cta-success px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
              Gọi ngay: 0795 473 012
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
