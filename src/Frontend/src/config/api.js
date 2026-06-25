import axios from 'axios';

// Base URL cho API
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Base URL của Backend (bỏ /api ở cuối)
export const BACKEND_URL = API_URL.replace(/\/api\/?$/, '');

// Tạo axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Thêm token vào header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Xử lý lỗi
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    const message = error.response?.data?.message || error.message || 'Đã có lỗi xảy ra';
    return Promise.reject(new Error(message));
  }
);

export default api;
