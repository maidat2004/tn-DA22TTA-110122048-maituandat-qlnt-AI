import mongoose from 'mongoose';

const paymentTransactionSchema = new mongoose.Schema({
  sepayTransactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  invoiceNumber: {
    type: String,
    index: true
  },
  gateway: String,
  accountNumber: String,
  subAccount: String,
  code: String,
  content: String,
  description: String,
  transferType: String,
  transferAmount: {
    type: Number,
    default: 0
  },
  accumulated: Number,
  referenceCode: String,
  transactionDate: Date,
  status: {
    type: String,
    enum: ['matched', 'duplicate', 'unmatched', 'ignored', 'failed'],
    default: 'unmatched',
    index: true
  },
  reason: String,
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);

export default PaymentTransaction;
