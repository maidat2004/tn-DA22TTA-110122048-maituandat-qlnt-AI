import nodemailer from 'nodemailer';

// Cấu hình transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });
};

const paymentInfo = {
  accountName: process.env.PAYMENT_ACCOUNT_NAME || 'MAI TUAN DAT',
  accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || '070136420729',
  bankName: process.env.PAYMENT_BANK_NAME || 'Sacombank',
  zaloPhone: process.env.PAYMENT_ZALO || '0795473012'
};

const buildTransferContent = (invoiceData) => {
  return `${invoiceData.invoiceNumber || 'HOADON'}`.toUpperCase();
};

/**
 * Gửi email thông báo tài khoản mới
 * @param {string} toEmail - Email người nhận
 * @param {string} fullName - Tên người dùng
 * @param {string} password - Mật khẩu mặc định
 */
const sendAccountEmail = async (toEmail, fullName, password) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Quản Lý Nhà Trọ" <${process.env.EMAIL_USER || 'admin@gmail.com'}>`,
      to: toEmail,
      subject: '🏠 Thông tin tài khoản đăng nhập - Quản Lý Nhà Trọ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">🏠 Quản Lý Nhà Trọ</h2>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>Xin chào <strong>${fullName}</strong>,</p>
          
          <p>Tài khoản của bạn đã được tạo thành công trên hệ thống Quản Lý Nhà Trọ.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📧 Email đăng nhập:</strong> ${toEmail}</p>
            <p style="margin: 5px 0;"><strong>🔑 Mật khẩu mặc định:</strong> ${password}</p>
          </div>
          
          <p style="color: #dc2626; font-weight: bold;">⚠️ Vui lòng đăng nhập và đổi mật khẩu ngay lập tức để bảo mật tài khoản.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            Đây là email tự động, vui lòng không trả lời email này.<br>
            © ${new Date().getFullYear()} Quản Lý Nhà Trọ
          </p>
        </div>
      `,
      text: `
Xin chào ${fullName},

Tài khoản của bạn đã được tạo thành công.

Email đăng nhập: ${toEmail}
Mật khẩu mặc định: ${password}

Vui lòng đăng nhập và đổi mật khẩu ngay lập tức để bảo mật tài khoản.

Trân trọng,
Admin - Quản Lý Nhà Trọ
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Không throw error để không làm gián đoạn quá trình tạo tài khoản
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email thông báo đổi mật khẩu thành công
 */
const sendPasswordChangedEmail = async (toEmail, fullName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Quản Lý Nhà Trọ" <${process.env.EMAIL_USER || 'admin@gmail.com'}>`,
      to: toEmail,
      subject: '🔒 Mật khẩu đã được thay đổi - Quản Lý Nhà Trọ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">🏠 Quản Lý Nhà Trọ</h2>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>Xin chào <strong>${fullName}</strong>,</p>
          
          <p>Mật khẩu tài khoản của bạn đã được thay đổi thành công.</p>
          
          <p>Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ admin ngay lập tức.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Quản Lý Nhà Trọ
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Không throw error để không làm gián đoạn quá trình tạo tài khoản
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email thông báo hóa đơn thanh toán
 * @param {string} toEmail - Email người nhận
 * @param {string} fullName - Tên người thuê
 * @param {Object} invoiceData - Thông tin hóa đơn
 */
const sendInvoiceEmail = async (toEmail, fullName, invoiceData) => {
  try {
    const transporter = createTransporter();

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(amount);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('vi-VN');
    };

    const mailOptions = {
      from: `"Quản Lý Nhà Trọ" <${process.env.EMAIL_USER || 'admin@gmail.com'}>`,
      to: toEmail,
      subject: `💰 Hóa đơn thanh toán ${invoiceData.month}/${invoiceData.year} - Quản Lý Nhà Trọ`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">🏠 Quản Lý Nhà Trọ</h2>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>Xin chào <strong>${fullName}</strong>,</p>
          
          <p>Hóa đơn thanh toán cho phòng <strong>${invoiceData.room?.roomNumber || 'N/A'}</strong> tháng <strong>${invoiceData.month}/${invoiceData.year}</strong> đã được tạo.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">📋 Chi tiết hóa đơn:</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                ${invoiceData.services && invoiceData.services.length > 0 ?
          invoiceData.services.map(service => `
                    <tr>
                      <td style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                        ${service.service?.name || 'Dịch vụ'} (${service.quantity} ${service.service?.unit || 'đơn vị'})
                      </td>
                      <td style="padding: 5px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">
                        ${formatCurrency(service.amount)}
                      </td>
                    </tr>
                  `).join('') : ''
        }
                <tr style="font-weight: bold; background-color: #e5e7eb;">
                  <td style="padding: 10px 0;">Tổng cộng</td>
                  <td style="padding: 10px 0; text-align: right;">${formatCurrency(invoiceData.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              <strong>⏰ Hạn thanh toán:</strong> ${formatDate(invoiceData.dueDate)}<br>
              <strong>💳 Phương thức thanh toán:</strong> Tiền mặt hoặc chuyển khoản
            </p>
          </div>
          
          <p>Vui lòng thanh toán đúng hạn để tránh phí phạt. Bạn có thể xem chi tiết hóa đơn và thanh toán trực tuyến trên hệ thống.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              🏠 Đăng nhập để xem hóa đơn
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            Đây là email tự động, vui lòng không trả lời email này.<br>
            Nếu có thắc mắc, vui lòng liên hệ admin qua số điện thoại hoặc email.<br>
            © ${new Date().getFullYear()} Quản Lý Nhà Trọ
          </p>
        </div>
      `,
      text: `
Xin chào ${fullName},

Hóa đơn thanh toán cho phòng ${invoiceData.room?.roomNumber || 'N/A'} tháng ${invoiceData.month}/${invoiceData.year} đã được tạo.

Chi tiết hóa đơn:
${invoiceData.services && invoiceData.services.length > 0 ?
          invoiceData.services.map(service =>
            `- ${service.service?.name || 'Dịch vụ'}: ${formatCurrency(service.amount)}`
          ).join('\n') : ''
        }

Tổng cộng: ${formatCurrency(invoiceData.totalAmount)}
Hạn thanh toán: ${formatDate(invoiceData.dueDate)}

Vui lòng thanh toán đúng hạn để tránh phí phạt.

Trân trọng,
Admin - Quản Lý Nhà Trọ
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Invoice email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending invoice email:', error);
    return { success: false, error: error.message };
  }
};

const getServiceName = (service) => service.service?.name || service.name || 'Dịch vụ khác';
const getServiceUnit = (service) => service.service?.unit || service.unit || 'lần';

const sendDetailedInvoiceEmail = async (toEmail, fullName, invoiceData) => {
  try {
    const transporter = createTransporter();
    const recipients = Array.isArray(toEmail)
      ? [...new Set(toEmail.filter(Boolean))]
      : [toEmail].filter(Boolean);

    if (!recipients.length) {
      return { success: false, error: 'Không có email người nhận' };
    }

    const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(Number(amount || 0));

    const formatDate = (date) => {
      const value = date ? new Date(date) : null;
      return value && !Number.isNaN(value.getTime()) ? value.toLocaleDateString('vi-VN') : 'Chưa có';
    };

    const transferContent = buildTransferContent(invoiceData);
    const serviceRows = (invoiceData.services || []).map((service) => ({
      name: getServiceName(service),
      quantity: Number(service.quantity || 0),
      unit: getServiceUnit(service),
      unitPrice: Number(service.unitPrice || 0),
      amount: Number(service.amount || 0)
    }));

    const htmlRows = [
      {
        name: 'Tiền phòng',
        detail: `Phòng ${invoiceData.room?.roomNumber || 'N/A'}`,
        amount: Number(invoiceData.roomRent || 0)
      },
      ...serviceRows.map((service) => ({
        name: service.name,
        detail: `${service.quantity} ${service.unit} x ${formatCurrency(service.unitPrice)}`,
        amount: service.amount
      }))
    ];

    const mailOptions = {
      from: `"Nhà trọ Trang Thông" <${process.env.EMAIL_USER || 'admin@gmail.com'}>`,
      to: recipients,
      subject: `Hóa đơn tháng ${invoiceData.month}/${invoiceData.year} - Phòng ${invoiceData.room?.roomNumber || 'N/A'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #111827; line-height: 1.5;">
          <div style="padding: 24px; border: 1px solid #dbeafe; border-radius: 14px; background: #ffffff;">
            <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #1d4ed8;">Hóa đơn nhà trọ</h2>
              <p style="margin: 6px 0 0; color: #6b7280;">Nhà trọ Trang Thông</p>
            </div>

            <p>Xin chào <strong>${fullName}</strong>,</p>
            <p>Hóa đơn tháng <strong>${invoiceData.month}/${invoiceData.year}</strong> của phòng <strong>${invoiceData.room?.roomNumber || 'N/A'}</strong> đã được tạo trên hệ thống.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; overflow: hidden; border: 1px solid #e5e7eb;">
              <thead>
                <tr style="background: #eff6ff;">
                  <th style="text-align: left; padding: 12px; border-bottom: 1px solid #dbeafe;">Khoản thu</th>
                  <th style="text-align: left; padding: 12px; border-bottom: 1px solid #dbeafe;">Chi tiết</th>
                  <th style="text-align: right; padding: 12px; border-bottom: 1px solid #dbeafe;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows.map((row) => `
                  <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${row.name}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${row.detail}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${formatCurrency(row.amount)}</td>
                  </tr>
                `).join('')}
                <tr style="background: #2563eb; color: #ffffff;">
                  <td colspan="2" style="padding: 14px; font-size: 16px; font-weight: 700;">Tổng cộng</td>
                  <td style="padding: 14px; text-align: right; font-size: 18px; font-weight: 700;">${formatCurrency(invoiceData.totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 10px; padding: 14px; margin: 18px 0;">
              <p style="margin: 0;"><strong>Hạn thanh toán:</strong> ${formatDate(invoiceData.dueDate)}</p>
              <p style="margin: 6px 0 0;"><strong>Nội dung chuyển khoản:</strong> ${transferContent}</p>
            </div>

            <div style="background: #f9fafb; border-radius: 10px; padding: 14px; margin: 18px 0;">
              <p style="margin: 0;"><strong>Người nhận:</strong> ${paymentInfo.accountName}</p>
              <p style="margin: 6px 0 0;"><strong>Ngân hàng:</strong> ${paymentInfo.bankName}</p>
              <p style="margin: 6px 0 0;"><strong>Số tài khoản:</strong> ${paymentInfo.accountNumber}</p>
            </div>

            <p>Bạn có thể đăng nhập vào hệ thống để xem chi tiết, quét QR thanh toán và xuất hóa đơn PDF.</p>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/hoa-don"
                 style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 700;">
                Xem hóa đơn trên web
              </a>
            </div>

            <p style="font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 14px;">
              Đây là email tự động từ hệ thống Nhà trọ Trang Thông.
            </p>
          </div>
        </div>
      `,
      text: `
Hóa đơn tháng ${invoiceData.month}/${invoiceData.year} - Phòng ${invoiceData.room?.roomNumber || 'N/A'}

Người thuê: ${fullName}
Hạn thanh toán: ${formatDate(invoiceData.dueDate)}

Chi tiết:
- Tiền phòng: ${formatCurrency(invoiceData.roomRent || 0)}
${serviceRows.map((service) => `- ${service.name}: ${service.quantity} ${service.unit} x ${formatCurrency(service.unitPrice)} = ${formatCurrency(service.amount)}`).join('\n')}

Tổng cộng: ${formatCurrency(invoiceData.totalAmount)}
Nội dung chuyển khoản: ${transferContent}
Tài khoản nhận: ${paymentInfo.accountName} - ${paymentInfo.bankName} - ${paymentInfo.accountNumber}
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Invoice email sent:', info.messageId);
    return { success: true, messageId: info.messageId, recipients };
  } catch (error) {
    console.error('Error sending detailed invoice email:', error);
    return { success: false, error: error.message };
  }
};

export { sendAccountEmail, sendPasswordChangedEmail, sendDetailedInvoiceEmail as sendInvoiceEmail };
