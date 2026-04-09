'use client';

import { useEffect } from 'react';
import { getPaymentDisplayInfo, formatCreatedAt, formatStatus } from '@/lib/pay-utils';
import type { Locale } from '@/lib/locale';

interface AuditLog {
  id: string;
  action: string;
  detail: string | null;
  operator: string | null;
  createdAt: string;
}

interface OrderDetailProps {
  order: {
    id: string;
    userId: number;
    userName: string | null;
    userEmail: string | null;
    amount: number;
    status: string;
    paymentType: string;
    rechargeCode: string;
    paymentTradeNo: string | null;
    refundAmount: number | null;
    refundReason: string | null;
    refundAt: string | null;
    forceRefund: boolean;
    refundRequestedAt?: string | null;
    refundRequestReason?: string | null;
    refundRequestedBy?: number | null;
    expiresAt: string;
    paidAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    failedReason: string | null;
    createdAt: string;
    updatedAt: string;
    clientIp: string | null;
    srcHost: string | null;
    srcUrl: string | null;
    paymentSuccess?: boolean;
    rechargeSuccess?: boolean;
    rechargeStatus?: string;
    orderType?: string;
    planId?: string | null;
    subscriptionGroupId?: number | null;
    subscriptionDays?: number | null;
    auditLogs: AuditLog[];
  };
  onClose: () => void;
  dark?: boolean;
  locale?: Locale;
}

export default function OrderDetail({ order, onClose, dark, locale = 'en' }: OrderDetailProps) {
  const currency = locale === 'vi' ? 'VND' : '$';
  const text =
    locale === 'vi'
      ? {
          title: 'Chi tiết đơn hàng',
          auditLogs: 'Nhật ký kiểm tra',
          operator: 'Nhà điều hành',
          emptyLogs: 'Không có nhật ký',
          close: 'Đóng',
          yes: 'Có',
          no: 'Không',
          orderId: 'Mã đơn hàng',
          userId: 'ID người dùng',
          userName: 'Tên người dùng',
          email: 'Email',
          amount: 'Số tiền',
          status: 'Trạng thái',
          paymentSuccess: 'Thanh toán thành công',
          rechargeSuccess: 'Nạp tiền thành công',
          rechargeStatus: 'Trạng thái nạp tiền',
          paymentChannel: 'Kênh thanh toán',
          provider: 'Nhà cung cấp',
          rechargeCode: 'Mã nạp tiền',
          paymentTradeNo: 'Số giao dịch thanh toán',
          clientIp: 'IP máy khách',
          sourceHost: 'Tên miền nguồn',
          sourcePage: 'Trang nguồn',
          createdAt: 'Tạo lúc',
          expiresAt: 'Hết hạn lúc',
          paidAt: 'Thanh toán lúc',
          completedAt: 'Hoàn thành lúc',
          failedAt: 'Thất bại lúc',
          failedReason: 'Lý do thất bại',
          refundRequestedAt: 'Yêu cầu hoàn tiền lúc',
          refundRequestReason: 'Lý do yêu cầu hoàn tiền',
          refundRequestedBy: 'Yêu cầu hoàn tiền bởi',
          refundAmount: 'Số tiền hoàn',
          refundReason: 'Lý do hoàn tiền',
          refundAt: 'Hoàn tiền lúc',
          forceRefund: 'Hoàn tiền bắt buộc',
          orderType: 'Loại đơn hàng',
          planId: 'ID gói',
          subscriptionGroupId: 'ID nhóm đăng ký',
          subscriptionDays: 'Ngày đăng ký',
        }
      : {
          title: 'Order Details',
          auditLogs: 'Audit Logs',
          operator: 'Operator',
          emptyLogs: 'No logs',
          close: 'Close',
          yes: 'Yes',
          no: 'No',
          orderId: 'Order ID',
          userId: 'User ID',
          userName: 'Username',
          email: 'Email',
          amount: 'Amount',
          status: 'Status',
          paymentSuccess: 'Payment Success',
          rechargeSuccess: 'Recharge Success',
          rechargeStatus: 'Recharge Status',
          paymentChannel: 'Payment Channel',
          provider: 'Provider',
          rechargeCode: 'Recharge Code',
          paymentTradeNo: 'Payment Trade No.',
          clientIp: 'Client IP',
          sourceHost: 'Source Host',
          sourcePage: 'Source Page',
          createdAt: 'Created At',
          expiresAt: 'Expires At',
          paidAt: 'Paid At',
          completedAt: 'Completed At',
          failedAt: 'Failed At',
          failedReason: 'Failure Reason',
          refundRequestedAt: 'Refund Requested At',
          refundRequestReason: 'Refund Request Reason',
          refundRequestedBy: 'Refund Requested By',
          refundAmount: 'Refund Amount',
          refundReason: 'Refund Reason',
          refundAt: 'Refunded At',
          forceRefund: 'Force Refund',
          orderType: 'Order Type',
          planId: 'Plan ID',
          subscriptionGroupId: 'Subscription Group ID',
          subscriptionDays: 'Subscription Days',
        };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const paymentInfo = getPaymentDisplayInfo(order.paymentType, locale);

  const fields = [
    { label: text.orderId, value: order.id },
    { label: text.userId, value: order.userId },
    { label: text.userName, value: order.userName || '-' },
    { label: text.email, value: order.userEmail || '-' },
    { label: text.amount, value: `${currency}${order.amount.toFixed(2)}` },
    { label: text.status, value: formatStatus(order.status, locale) },
    {
      label: text.orderType,
      value:
        order.orderType === 'subscription'
          ? locale === 'vi'
            ? 'Đăng ký'
            : 'Subscription'
          : locale === 'vi'
            ? 'Nạp tiền số dư'
            : 'Balance Recharge',
    },
    { label: text.paymentSuccess, value: order.paymentSuccess ? text.yes : text.no },
    { label: text.rechargeSuccess, value: order.rechargeSuccess ? text.yes : text.no },
    { label: text.rechargeStatus, value: order.rechargeStatus || '-' },
    { label: text.paymentChannel, value: paymentInfo.channel },
    { label: text.provider, value: paymentInfo.provider || '-' },
    { label: text.rechargeCode, value: order.rechargeCode },
    { label: text.paymentTradeNo, value: order.paymentTradeNo || '-' },
    { label: text.clientIp, value: order.clientIp || '-' },
    { label: text.sourceHost, value: order.srcHost || '-' },
    { label: text.sourcePage, value: order.srcUrl || '-' },
    { label: text.createdAt, value: formatCreatedAt(order.createdAt, locale) },
    { label: text.expiresAt, value: formatCreatedAt(order.expiresAt, locale) },
    { label: text.paidAt, value: order.paidAt ? formatCreatedAt(order.paidAt, locale) : '-' },
    { label: text.completedAt, value: order.completedAt ? formatCreatedAt(order.completedAt, locale) : '-' },
    { label: text.failedAt, value: order.failedAt ? formatCreatedAt(order.failedAt, locale) : '-' },
    { label: text.failedReason, value: order.failedReason || '-' },
  ];

  if (order.refundRequestedAt || order.refundRequestReason || order.refundRequestedBy != null) {
    fields.push(
      { label: text.refundRequestedAt, value: order.refundRequestedAt ? formatCreatedAt(order.refundRequestedAt, locale) : '-' },
      { label: text.refundRequestReason, value: order.refundRequestReason || '-' },
      { label: text.refundRequestedBy, value: order.refundRequestedBy != null ? String(order.refundRequestedBy) : '-' },
    );
  }

  if (order.orderType === 'subscription') {
    fields.push(
      { label: text.planId, value: order.planId || '-' },
      { label: text.subscriptionGroupId, value: order.subscriptionGroupId != null ? String(order.subscriptionGroupId) : '-' },
      { label: text.subscriptionDays, value: order.subscriptionDays != null ? String(order.subscriptionDays) : '-' },
    );
  }

  if (order.refundAmount != null) {
    fields.push(
      { label: text.refundAmount, value: `${currency}${order.refundAmount.toFixed(2)}` },
      { label: text.refundReason, value: order.refundReason || '-' },
      { label: text.refundAt, value: order.refundAt ? formatCreatedAt(order.refundAt, locale) : '-' },
      { label: text.forceRefund, value: order.forceRefund ? text.yes : text.no },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl p-6 shadow-xl ${dark ? 'bg-slate-800 text-slate-100' : 'bg-white'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{text.title}</h3>
          <button onClick={onClose} className={dark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ label, value }) => (
            <div key={label} className={`rounded-lg p-3 ${dark ? 'bg-slate-700/60' : 'bg-gray-50'}`}>
              <div className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</div>
              <div className={`mt-1 break-all text-sm font-medium ${dark ? 'text-slate-200' : ''}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h4 className={`mb-3 font-medium ${dark ? 'text-slate-100' : 'text-gray-900'}`}>{text.auditLogs}</h4>
          <div className="space-y-2">
            {order.auditLogs.map((log) => (
              <div key={log.id} className={`rounded-lg border p-3 ${dark ? 'border-slate-600 bg-slate-700/60' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{log.action}</span>
                  <span className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{formatCreatedAt(log.createdAt, locale)}</span>
                </div>
                {log.detail && <div className={`mt-1 break-all text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{log.detail}</div>}
                {log.operator && <div className={`mt-1 text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{text.operator}: {log.operator}</div>}
              </div>
            ))}
            {order.auditLogs.length === 0 && <div className={`text-center text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{text.emptyLogs}</div>}
          </div>
        </div>

        <button onClick={onClose} className={`mt-6 w-full rounded-lg border py-2 text-sm ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          {text.close}
        </button>
      </div>
    </div>
  );
}
