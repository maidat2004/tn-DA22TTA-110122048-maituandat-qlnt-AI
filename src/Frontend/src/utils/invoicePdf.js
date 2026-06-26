import { getInvoiceStatusLabel } from './invoiceStatus';
import { paymentInfo, buildTransferContent, buildSepayQrUrl } from '../constants/paymentInfo';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND'
}).format(Number(amount || 0));

const formatDate = (date) => {
  const value = date ? new Date(date) : null;
  return value && !Number.isNaN(value.getTime()) ? value.toLocaleDateString('vi-VN') : 'Chưa có';
};

const getServiceName = (service) => service?.service?.name || service?.name || 'Dịch vụ khác';
const getServiceUnit = (service) => service?.service?.unit || service?.unit || 'lần';

export const printInvoicePdf = (invoice) => {
  if (!invoice) return;

  const services = invoice.services || [];
  const rows = [
    {
      name: 'Tiền phòng',
      detail: `Phòng ${invoice.room?.roomNumber || 'N/A'}`,
      amount: Number(invoice.roomRent || 0)
    },
    ...services.map((service) => ({
      name: getServiceName(service),
      detail: `${Number(service.quantity || 0)} ${getServiceUnit(service)} x ${formatCurrency(service.unitPrice || 0)}`,
      amount: Number(service.amount || 0)
    }))
  ];

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Hoa-don-${escapeHtml(invoice.invoiceNumber || `${invoice.month}-${invoice.year}`)}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #111827; background: #f3f4f6; }
          .invoice { max-width: 820px; margin: 0 auto; background: white; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb; }
          .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; }
          h1 { margin: 0; color: #1d4ed8; font-size: 22px; }
          .muted { color: #6b7280; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 12px 0; }
          .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; }
          .label { color: #6b7280; font-size: 11px; margin-bottom: 1px; }
          .value { font-weight: 700; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #e5e7eb; font-size: 14px; }
          th { background: #eff6ff; color: #1e3a8a; text-align: left; }
          th, td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
          td:last-child, th:last-child { text-align: right; }
          .total { 
            margin-top: 14px; 
            background: #eff6ff; 
            color: #1e3a8a; 
            border: 1.5px solid #3b82f6; 
            border-radius: 8px; 
            padding: 10px 16px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            font-size: 16px; 
            font-weight: 700; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .total-price { 
            font-size: 20px; 
            color: #dc2626; 
            font-weight: 800; 
          }
          .note { margin-top: 14px; padding: 10px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 12px; }
          .footer { margin-top: 16px; color: #6b7280; font-size: 11px; text-align: center; }
          @media print {
            @page {
              size: A4;
              margin: 12mm 15mm;
            }
            body { background: white; padding: 0; margin: 0; }
            .invoice { border: none; border-radius: 0; max-width: none; padding: 0; margin: 0; }
          }
        </style>
      </head>
      <body>
        <main class="invoice">
          <section class="header">
            <div>
              <h1>Hóa đơn nhà trọ</h1>
              <p class="muted">Nhà trọ Trang Thông</p>
            </div>
            <div>
              <p style="margin: 2px 0; font-size: 13px;"><strong>Mã hóa đơn:</strong> ${escapeHtml(invoice.invoiceNumber || 'N/A')}</p>
              <p style="margin: 2px 0; font-size: 13px;"><strong>Tháng:</strong> ${escapeHtml(invoice.month || 'N/A')}/${escapeHtml(invoice.year || new Date().getFullYear())}</p>
            </div>
          </section>

          <section class="grid">
            <div class="box">
              <div class="label">Người thuê</div>
              <div class="value">${escapeHtml(invoice.tenant?.fullName || 'N/A')}</div>
            </div>
            <div class="box">
              <div class="label">Phòng</div>
              <div class="value">${escapeHtml(invoice.room?.roomNumber || 'N/A')}</div>
            </div>
            <div class="box">
              <div class="label">Hạn thanh toán</div>
              <div class="value">${formatDate(invoice.dueDate)}</div>
            </div>
            <div class="box">
              <div class="label">Trạng thái</div>
              <div class="value">${escapeHtml(getInvoiceStatusLabel(invoice.status))}</div>
            </div>
            ${invoice.paidDate ? `
              <div class="box">
                <div class="label">Ngày thanh toán</div>
                <div class="value">${formatDate(invoice.paidDate)}</div>
              </div>
            ` : ''}
          </section>

          <table>
            <thead>
              <tr>
                <th>Khoản thu</th>
                <th>Chi tiết</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${escapeHtml(row.detail)}</td>
                  <td>${formatCurrency(row.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <section class="total">
            <span>Tổng cộng</span>
            <span class="total-price">${formatCurrency(invoice.totalAmount)}</span>
          </section>

          ${invoice.status !== 'paid' ? `
            <section class="payment-info" style="margin-top: 14px; border: 1px dashed #2563eb; border-radius: 8px; padding: 10px 14px; background: #f0f7ff; display: flex; gap: 16px; align-items: center;">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 15px;">💳 Thông tin chuyển khoản thanh toán:</h3>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Chủ tài khoản:</strong> ${escapeHtml(paymentInfo.accountName)}</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Ngân hàng:</strong> ${escapeHtml(paymentInfo.bankName)}</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Số tài khoản:</strong> ${escapeHtml(paymentInfo.accountNumber)}</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Nội dung:</strong> <span style="font-family: monospace; font-size: 13px; background: #e0f2fe; padding: 1px 5px; border-radius: 3px; font-weight: bold; color: #0369a1;">${escapeHtml(buildTransferContent(invoice))}</span></p>
              </div>
              ${buildSepayQrUrl(invoice) ? `
                <div style="text-align: center;">
                  <img src="${buildSepayQrUrl(invoice)}" alt="QR Code Thanh Toán" style="width: 100px; height: 100px; border: 1px solid #dbeafe; border-radius: 8px; padding: 2px; background: white;" />
                  <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280; font-weight: bold;">Quét mã VietQR để trả</p>
                </div>
              ` : ''}
            </section>
          ` : `
            <section class="payment-info" style="margin-top: 14px; border: 1.5px solid #16a34a; border-radius: 8px; padding: 10px 14px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; gap: 10px;">
              <span style="font-size: 20px;">✅</span>
              <div>
                <h3 style="margin: 0; color: #15803d; font-size: 14px; font-weight: bold;">HÓA ĐƠN ĐÃ THANH TOÁN</h3>
                <p style="margin: 2px 0 0 0; color: #166534; font-size: 11px;">Cảm ơn bạn đã thanh toán tiền trọ đúng hạn!</p>
              </div>
            </section>
          `}

          <section class="note">
            Hóa đơn thể hiện các khoản phát sinh trong tháng gồm tiền phòng, điện, nước và các dịch vụ được tính thêm nếu có.
          </section>

          <p class="footer">Xuất từ hệ thống quản lý Nhà trọ Trang Thông - ${formatDate(new Date())}</p>
        </main>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
