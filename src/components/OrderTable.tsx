'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/locale';
import {
  formatStatus,
  formatCreatedAt,
  getStatusBadgeClass,
  type MyOrder,
} from '@/lib/pay-utils';

interface OrderTableProps {
  isDark: boolean;
  locale: Locale;
  loading: boolean;
  error: string;
  orders: MyOrder[];
  userBalance: number;
  onRefundRequest: (orderId: string, amount: number, reason: string) => Promise<void>;
}

function formatCups(amount: number, locale: string): string {
  const n = Math.round(amount);
  return locale === 'vi' ? `${n.toLocaleString('vi-VN')} Coffee Cup` : `${n.toLocaleString('en-US')} Coffee Cup`;
}

function formatVND(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
}

export default function OrderTable({ isDark, locale, loading, error, orders, userBalance, onRefundRequest }: OrderTableProps) {
  const t = locale === 'vi'
    ? {
        empty: 'Không tìm thấy đơn hàng',
        refundRequest: 'Hoàn tiền',
        requested: 'Đã yêu cầu',
        partialRefunded: 'Hoàn một phần',
        dialogTitle: 'Yêu cầu hoàn tiền',
        refundAmount: 'Số tiền hoàn',
        refundReason: 'Lý do',
        refundReasonPlaceholder: 'Nhập lý do (tùy chọn)',
        currentBalance: 'Số dư',
        orderAmount: 'Đơn hàng',
        cancel: 'Hủy',
        submit: 'Gửi',
        submitting: 'Đang gửi...',
        refundAmountInvalid: 'Số tiền phải lớn hơn 0',
        refundAmountExceedOrder: 'Vượt quá số tiền đơn hàng',
        refundAmountExceedBalance: 'Vượt quá số dư',
      }
    : {
        empty: 'No orders found',
        refundRequest: 'Refund',
        requested: 'Requested',
        partialRefunded: 'Partial refund',
        dialogTitle: 'Refund Request',
        refundAmount: 'Refund Amount',
        refundReason: 'Reason',
        refundReasonPlaceholder: 'Enter reason (optional)',
        currentBalance: 'Balance',
        orderAmount: 'Order',
        cancel: 'Cancel',
        submit: 'Submit',
        submitting: 'Submitting...',
        refundAmountInvalid: 'Amount must be greater than 0',
        refundAmountExceedOrder: 'Exceeds order amount',
        refundAmountExceedBalance: 'Exceeds balance',
      };

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [refundOrder, setRefundOrder] = useState<MyOrder | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    if (!refundOrder) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && submittingId !== refundOrder.id) {
        setRefundOrder(null);
        setRefundAmount('');
        setRefundReason('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [refundOrder, submittingId]);

  const parsedRefundAmount = Number(refundAmount);
  const amountError = !refundOrder
    ? ''
    : !Number.isFinite(parsedRefundAmount) || parsedRefundAmount <= 0
      ? t.refundAmountInvalid
      : parsedRefundAmount > refundOrder.amount
        ? t.refundAmountExceedOrder
        : parsedRefundAmount > userBalance
          ? t.refundAmountExceedBalance
          : '';

  const openRefundDialog = (order: MyOrder) => {
    setRefundOrder(order);
    setRefundAmount(String(Math.round(order.refundAmount ?? order.amount)));
    setRefundReason(order.refundRequestReason ?? '');
  };

  const closeRefundDialog = () => {
    if (refundOrder && submittingId === refundOrder.id) return;
    setRefundOrder(null);
    setRefundAmount('');
    setRefundReason('');
  };

  const handleRefundSubmit = async () => {
    if (!refundOrder || amountError) return;
    setSubmittingId(refundOrder.id);
    try {
      await onRefundRequest(refundOrder.id, parsedRefundAmount, refundReason);
      setRefundOrder(null);
      setRefundAmount('');
      setRefundReason('');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className={['h-6 w-6 animate-spin rounded-full border-2 border-t-transparent', isDark ? 'border-slate-400' : 'border-slate-500'].join(' ')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={['rounded-xl border border-dashed px-4 py-10 text-center text-sm', isDark ? 'border-amber-500/40 text-amber-200' : 'border-amber-300 text-amber-700'].join(' ')}>
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={['rounded-xl border border-dashed px-4 py-10 text-center text-sm', isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'].join(' ')}>
        {t.empty}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className={[
              'rounded-xl border p-3 transition-colors',
              isDark ? 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/70' : 'border-slate-100 bg-white hover:bg-slate-50/80',
            ].join(' ')}
          >
            {/* Row 1: ID + Status */}
            <div className="flex items-center justify-between gap-2">
              <span className={['truncate font-mono text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
                #{order.id.slice(0, 13)}
              </span>
              <span className={['shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', getStatusBadgeClass(order.status, isDark)].join(' ')}>
                {formatStatus(order.status, locale)}
              </span>
            </div>

            {/* Row 2: Amount + Date + Action */}
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <div className={['text-lg font-bold leading-tight', isDark ? 'text-slate-100' : 'text-slate-800'].join(' ')}>
                  {formatCups(order.amount, locale)}
                </div>
                <div className={['text-[11px]', isDark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
                  {formatCreatedAt(order.createdAt, locale)}
                </div>
                {(order.status === 'PARTIALLY_REFUNDED' || order.status === 'REFUND_REQUESTED') && order.refundAmount != null && (
                  <div className={['text-[11px] mt-0.5', isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'].join(' ')}>
                    {order.status === 'PARTIALLY_REFUNDED' ? t.partialRefunded : t.requested}: {formatVND(order.refundAmount)}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {order.canRefundRequest ? (
                  <button
                    type="button"
                    disabled={submittingId === order.id}
                    onClick={() => openRefundDialog(order)}
                    className={[
                      'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                      isDark
                        ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50'
                        : 'bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50',
                    ].join(' ')}
                  >
                    {submittingId === order.id ? '...' : t.refundRequest}
                  </button>
                ) : order.status === 'REFUND_REQUESTED' ? (
                  <span className={['text-[11px]', isDark ? 'text-violet-300' : 'text-violet-600'].join(' ')}>{t.requested}</span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Refund Dialog */}
      {refundOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={['w-full max-w-sm rounded-xl p-5 shadow-xl', isDark ? 'bg-slate-900' : 'bg-white'].join(' ')}>
            <h3 className={['text-base font-bold', isDark ? 'text-slate-100' : 'text-gray-900'].join(' ')}>{t.dialogTitle}</h3>

            <div className="mt-3 space-y-3">
              <div className={['grid grid-cols-2 gap-2 text-sm', isDark ? 'text-slate-300' : 'text-gray-700'].join(' ')}>
                <div className={['rounded-lg p-2.5', isDark ? 'bg-slate-800' : 'bg-gray-50'].join(' ')}>
                  <div className={['text-[11px]', isDark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>{t.orderAmount}</div>
                  <div className="mt-0.5 font-semibold">{formatCups(refundOrder.amount, locale)}</div>
                </div>
                <div className={['rounded-lg p-2.5', isDark ? 'bg-slate-800' : 'bg-gray-50'].join(' ')}>
                  <div className={['text-[11px]', isDark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>{t.currentBalance}</div>
                  <div className="mt-0.5 font-semibold">{formatVND(userBalance)}</div>
                </div>
              </div>

              <div>
                <label className={['mb-1 block text-xs font-medium', isDark ? 'text-slate-300' : 'text-gray-700'].join(' ')}>{t.refundAmount}</label>
                <input
                  type="number"
                  min="1"
                  max={Math.min(refundOrder.amount, userBalance)}
                  step="1"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className={['w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none', isDark ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-gray-300 bg-white text-gray-900'].join(' ')}
                />
                {amountError && <div className={['mt-1 text-[11px]', isDark ? 'text-red-400' : 'text-red-600'].join(' ')}>{amountError}</div>}
              </div>

              <div>
                <label className={['mb-1 block text-xs font-medium', isDark ? 'text-slate-300' : 'text-gray-700'].join(' ')}>{t.refundReason}</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={t.refundReasonPlaceholder}
                  rows={2}
                  className={['w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none', isDark ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-gray-300 bg-white text-gray-900'].join(' ')}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={closeRefundDialog} disabled={submittingId === refundOrder.id}
                className={['flex-1 rounded-lg border py-2 text-sm', isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'].join(' ')}>
                {t.cancel}
              </button>
              <button type="button" onClick={handleRefundSubmit} disabled={submittingId === refundOrder.id || !!amountError}
                className={['flex-1 rounded-lg py-2 text-sm font-medium text-white disabled:cursor-not-allowed', isDark ? 'bg-red-600/90 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500' : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-400'].join(' ')}>
                {submittingId === refundOrder.id ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
