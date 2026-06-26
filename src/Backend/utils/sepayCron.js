import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import PaymentTransaction from '../models/PaymentTransaction.js';

// Đảm bảo load đúng file .env nằm ở thư mục cha của thư mục utils
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const extractInvoiceNumber = (textFields) => {
  for (const field of textFields) {
    if (field) {
      const text = String(field).toUpperCase();
      const match = text.match(/HD[0-9A-Z_-]{4,}/);
      if (match) {
        return match[0];
      }
    }
  }
  return null;
};

const parseTransactionDate = (value) => {
  if (!value) return undefined;
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const processTransaction = async (t) => {
  const transactionId = String(t.id);

  // 1. Kiểm tra xem giao dịch đã xử lý chưa (Chống trùng lặp)
  const existingLog = await PaymentTransaction.findOne({ sepayTransactionId: transactionId });
  if (existingLog) {
    return { status: 'duplicate', id: transactionId };
  }

  // 2. Trích xuất mã hóa đơn từ các trường nội dung chuyển khoản
  const textFields = [t.transaction_content, t.code, t.sub_account];
  let invoiceNumber = extractInvoiceNumber(textFields);

  // Fallback trực tiếp
  if (!invoiceNumber) {
    const directCode = String(t.code || t.sub_account || '').trim().toUpperCase();
    if (directCode) {
      invoiceNumber = directCode;
    }
  }

  // 3. Khởi tạo log giao dịch
  const transactionLog = new PaymentTransaction({
    sepayTransactionId: transactionId,
    invoiceNumber,
    gateway: 'SePay API Cron',
    accountNumber: '',
    subAccount: t.sub_account || '',
    code: t.code || '',
    content: t.transaction_content || '',
    description: t.transaction_content || '',
    transferType: t.amount_in > 0 ? 'in' : 'out',
    transferAmount: Number(t.amount_in || t.amount_out || 0),
    accumulated: 0,
    referenceCode: t.reference_number || '',
    transactionDate: parseTransactionDate(t.transaction_date),
    payload: t
  });

  // 4. Nếu không phải tiền vào, bỏ qua
  if (t.amount_in <= 0) {
    transactionLog.status = 'ignored';
    transactionLog.reason = 'Khong phai giao dich tien vao';
    await transactionLog.save();
    return { status: 'ignored', id: transactionId };
  }

  // 5. Nếu không trích xuất được mã hóa đơn
  if (!invoiceNumber) {
    transactionLog.status = 'unmatched';
    transactionLog.reason = 'Khong tim thay ma hoa don trong noi dung chuyen khoan';
    await transactionLog.save();
    return { status: 'unmatched', id: transactionId };
  }

  // 6. Tìm hóa đơn pending/overdue phù hợp và cập nhật trạng thái
  const transferAmount = Number(t.amount_in);
  const invoice = await Invoice.findOneAndUpdate(
    {
      invoiceNumber,
      status: { $in: ['pending', 'overdue', 'payment_submitted'] },
      totalAmount: { $lte: transferAmount }
    },
    {
      $set: {
        status: 'paid',
        paidDate: new Date(),
        paymentMethod: 'sepay',
        notes: `Thanh toan tu dong qua SePay API Cron. Ma GD: ${transactionId}`
      }
    },
    {
      new: true
    }
  );

  if (!invoice) {
    const existingInvoice = await Invoice.findOne({ invoiceNumber });
    transactionLog.status = 'unmatched';
    transactionLog.invoice = existingInvoice?._id;
    transactionLog.reason = existingInvoice
      ? 'Hoa don da thanh toan, da huy hoac so tien chuyen chua du'
      : 'Khong tim thay hoa don theo ma thanh toan';
    await transactionLog.save();
    return { status: 'unmatched_invoice', id: transactionId, invoiceNumber };
  }

  // 7. Đối soát thành công
  transactionLog.status = 'matched';
  transactionLog.invoice = invoice._id;
  transactionLog.reason = 'Da tu dong xac nhan hoa don thanh toan qua Cron';
  await transactionLog.save();

  return { status: 'matched', id: transactionId, invoiceNumber };
};

const syncTransactions = async () => {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) {
    console.error('[SePay Cron] Lỗi: SEPAY_API_TOKEN chưa được cấu hình trong file .env');
    return;
  }

  const baseUrl = process.env.SEPAY_API_URL || 'https://userapi.sepay.vn/v2';
  console.log(`[SePay Cron] [${new Date().toISOString()}] Bắt đầu quét giao dịch từ SePay API v2: ${baseUrl}...`);

  try {
    const response = await fetch(`${baseUrl}/transactions?per_page=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[SePay Cron] Lỗi kết nối API SePay: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await response.json();
    const transactions = result.data || [];
    console.log(`[SePay Cron] Đã lấy về ${transactions.length} giao dịch.`);

    let matchedCount = 0;
    let duplicateCount = 0;
    let ignoredCount = 0;
    let unmatchedCount = 0;

    for (const t of transactions) {
      const res = await processTransaction(t);
      if (res.status === 'matched') matchedCount++;
      else if (res.status === 'duplicate') duplicateCount++;
      else if (res.status === 'ignored') ignoredCount++;
      else unmatchedCount++;
    }

    console.log(`[SePay Cron] Kết quả đối soát: Thành công: ${matchedCount} | Trùng lặp: ${duplicateCount} | Bỏ qua: ${ignoredCount} | Không khớp hóa đơn: ${unmatchedCount}`);
  } catch (error) {
    console.error('[SePay Cron] Lỗi hệ thống khi quét giao dịch:', error);
  }
};

// Hàm khởi chạy lập lịch định kỳ (Dành cho việc import vào server.js)
export const startSepayCron = (intervalSeconds = 300) => {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) {
    console.log('[SePay Cron] SEPAY_API_TOKEN chưa được cấu hình. Bỏ qua tự động quét giao dịch.');
    return;
  }

  const displayTime = intervalSeconds >= 60 
    ? `${(intervalSeconds / 60).toFixed(1)} phút` 
    : `${intervalSeconds} giây`;

  console.log(`[SePay Cron] Đã kích hoạt quét giao dịch SePay tự động (Chu kỳ: ${displayTime}/lần).`);
  
  // Chạy ngay lần đầu tiên khi server start
  syncTransactions();

  // Lên lịch chạy định kỳ
  setInterval(async () => {
    await syncTransactions();
  }, intervalSeconds * 1000);
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[SePay Cron] Lỗi: MONGODB_URI chưa được cấu hình');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[SePay Cron] Kết nối MongoDB thành công.');
    
    await syncTransactions();
    
    // Đọc tham số từ dòng lệnh
    const args = process.argv.slice(2);
    const isDaemon = args.includes('--watch') || args.includes('--daemon');

    if (isDaemon) {
      const intervalMinutes = 5; // Đồng bộ mỗi 5 phút
      console.log(`[SePay Cron] Đang chạy chế độ Watch/Daemon độc lập. Sẽ quét lại mỗi ${intervalMinutes} phút...`);
      setInterval(async () => {
        await syncTransactions();
      }, intervalMinutes * 60 * 1000);
    } else {
      console.log('[SePay Cron] Hoàn tất quét giao dịch. Đang ngắt kết nối cơ sở dữ liệu...');
      await mongoose.connection.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('[SePay Cron] Lỗi khi chạy Cron:', error);
    process.exit(1);
  }
};

// Kiểm tra xem file được chạy trực tiếp (node sepayCron.js) hay được import
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
);

if (isMain) {
  run();
}
