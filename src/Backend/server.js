import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import connectDB from './config/database.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import updateRequestRoutes from './routes/updateRequestRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import sepayWebhookRoutes from './routes/sepayWebhookRoutes.js';
import { startSepayCron } from './utils/sepayCron.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Khởi chạy tiến trình tự động đồng bộ giao dịch SePay (chạy nền mỗi 15 giây, chỉ chạy ở local/development)
if (process.env.NODE_ENV === 'development') {
  startSepayCron(15);
}

// Middleware
app.use(cors());
app.use('/api/webhooks/sepay', express.raw({ type: '*/*' }), sepayWebhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/update-requests', updateRequestRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Get local IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, HOST, () => {
  const localIP = getLocalIPAddress();
  console.log(`\n🚀 Server is running!`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📡 Access URLs:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}`);
  console.log(`\n📱 To access from mobile:`);
  console.log(`   Make sure your phone is on the same WiFi network`);
  console.log(`   Then open: http://${localIP}:${PORT}\n`);
});
