export const paymentInfo = {
  accountName: import.meta.env.VITE_PAYMENT_ACCOUNT_NAME || 'MAI TUAN DAT',
  accountNumber: import.meta.env.VITE_PAYMENT_ACCOUNT_NUMBER || '070136420729',
  bankName: import.meta.env.VITE_PAYMENT_BANK_NAME || 'Sacombank',
  bankCode: import.meta.env.VITE_PAYMENT_BANK_CODE || import.meta.env.VITE_PAYMENT_BANK_BIN || 'Vietcombank',
  zaloPhone: import.meta.env.VITE_PAYMENT_ZALO || '0795473012'
};

export const buildTransferContent = (invoice) => {
  return `${invoice?.invoiceNumber || invoice?._id?.slice(-8) || 'HOADON'}`.toUpperCase();
};

export const buildSepayQrUrl = (invoice) => {
  if (!paymentInfo.bankCode || !paymentInfo.accountNumber) return '';

  const params = new URLSearchParams({
    acc: paymentInfo.accountNumber,
    bank: paymentInfo.bankCode,
    amount: String(Math.round(invoice?.totalAmount || 0)),
    des: buildTransferContent(invoice)
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
};

export const buildVietQrUrl = buildSepayQrUrl;
