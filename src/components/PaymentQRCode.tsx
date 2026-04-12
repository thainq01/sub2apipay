'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Locale } from '@/lib/locale';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';
import { buildOrderStatusUrl } from '@/lib/order/status-url';
import { TERMINAL_STATUSES } from '@/lib/constants';

interface PaymentQRCodeProps {
  orderId: string;
  token?: string;
  qrCode?: string | null;
  paymentType?: string;
  amount: number;
  payAmount?: number;
  expiresAt: string;
  statusAccessToken?: string;
  onStatusChange: (status: PublicOrderStatusSnapshot) => void;
  onBack: () => void;
  dark?: boolean;
  isIframe?: boolean;
  isMobile?: boolean;
  locale?: Locale;
  sepayBankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferCode: string;
  } | null;
}

function isVisibleOrderOutcome(data: PublicOrderStatusSnapshot): boolean {
  return data.paymentSuccess || TERMINAL_STATUSES.has(data.status);
}

function CopyButton({ text, dark }: { text: string; label?: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy'}
      className={[
        'ml-2 inline-flex shrink-0 items-center justify-center rounded p-1 transition-colors',
        copied
          ? dark ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-600'
          : dark ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
      ].join(' ')}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function BankTransferCard({
  bankInfo,
  displayAmount,
  dark,
  t,
  qrCodeUrl,
}: {
  bankInfo: { bankName: string; accountNumber: string; accountName: string; transferCode: string };
  displayAmount: number;
  dark: boolean;
  t: Record<string, string>;
  qrCodeUrl?: string;
}) {
  const rows = [
    { label: t.bankName, value: bankInfo.bankName, copyable: false },
    { label: t.accountNumber, value: bankInfo.accountNumber, copyable: true },
    { label: t.accountName, value: bankInfo.accountName, copyable: true },
    { label: t.transferAmount, value: `${displayAmount.toLocaleString('vi-VN')} VND`, copyable: true, copyText: String(Math.round(displayAmount)) },
    { label: t.transferCode, value: bankInfo.transferCode, copyable: true, highlight: true },
  ];

  return (
    <div className="w-full space-y-4">
      {/* QR Code */}
      {qrCodeUrl && (
        <div className="flex justify-center">
          <div className={['overflow-hidden rounded-xl border p-3', dark ? 'border-slate-700 bg-white' : 'border-gray-200 bg-white'].join(' ')}>
            <img src={qrCodeUrl} alt="Bank Transfer QR" className="h-52 w-52 rounded" />
          </div>
        </div>
      )}

      {/* Bank info */}
      <div className={['rounded-xl border p-4 space-y-3', dark ? 'border-blue-800 bg-blue-950/50' : 'border-blue-200 bg-blue-50'].join(' ')}>
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-full bg-blue-600 p-1.5">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="6" width="22" height="15" rx="2" />
              <path d="M1 10h22" />
              <path d="M12 2L2 6h20L12 2z" />
            </svg>
          </div>
          <span className={['font-medium', dark ? 'text-blue-300' : 'text-blue-700'].join(' ')}>
            {t.bankTransferTitle}
          </span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className={['text-sm shrink-0', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
              {row.label}
            </span>
            <div className="flex items-center min-w-0 ml-3">
              <span
                className={[
                  'text-sm font-mono truncate',
                  row.highlight
                    ? dark ? 'font-bold text-yellow-300' : 'font-bold text-blue-700'
                    : dark ? 'text-slate-200' : 'text-gray-900',
                ].join(' ')}
              >
                {row.value}
              </span>
              {row.copyable && <CopyButton text={row.copyText ?? row.value} dark={dark} />}
            </div>
          </div>
        ))}
      </div>

      <p className={['text-center text-xs', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
        {t.transferHint}
      </p>

      <div className="flex items-center justify-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className={['text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
          {t.waitingTransfer}
        </span>
      </div>
    </div>
  );
}

export default function PaymentQRCode({
  orderId,
  token,
  qrCode,
  amount,
  payAmount: payAmountProp,
  expiresAt,
  statusAccessToken,
  onStatusChange,
  onBack,
  dark = false,
  isIframe = false,
  locale = 'vi',
  sepayBankInfo,
}: PaymentQRCodeProps) {
  const displayAmount = payAmountProp ?? amount;
  const hasFeeDiff = payAmountProp !== undefined && payAmountProp !== amount;
  const [timeLeft, setTimeLeft] = useState('');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(Infinity);
  const [expired, setExpired] = useState(false);
  const [cancelBlocked, setCancelBlocked] = useState(false);

  const lang = locale === 'vi' ? 'vi' : 'en';

  const t = {
    expired: lang === 'vi' ? 'Đơn hàng đã hết hạn' : 'Order Expired',
    remaining: lang === 'vi' ? 'Thời gian còn lại' : 'Time Remaining',
    back: lang === 'vi' ? 'Quay lại' : 'Back',
    cancelOrder: lang === 'vi' ? 'Hủy đơn hàng' : 'Cancel Order',
    paid: lang === 'vi' ? 'Đơn hàng đã thanh toán' : 'Order Paid',
    paidCancelBlocked: lang === 'vi'
      ? 'Đơn hàng này đã thanh toán xong, không thể hủy. Tiền nạp sẽ được cập nhật tự động.'
      : 'This order has already been paid and cannot be cancelled. The recharge will be credited automatically.',
    backToRecharge: lang === 'vi' ? 'Quay lại nạp tiền' : 'Back to Recharge',
    credited: lang === 'vi' ? 'Bạn sẽ nhận được' : 'You will receive',
    bankTransferTitle: lang === 'vi' ? 'Thông tin chuyển khoản' : 'Bank Transfer Info',
    bankName: lang === 'vi' ? 'Ngân hàng' : 'Bank',
    accountNumber: lang === 'vi' ? 'Số tài khoản' : 'Account',
    accountName: lang === 'vi' ? 'Chủ tài khoản' : 'Name',
    transferAmount: lang === 'vi' ? 'Số tiền' : 'Amount',
    transferCode: lang === 'vi' ? 'Nội dung CK' : 'Memo / Note',
    copy: lang === 'vi' ? 'Sao chép' : 'Copy',
    waitingTransfer: lang === 'vi' ? 'Đang chờ chuyển khoản...' : 'Waiting for bank transfer...',
    transferHint: lang === 'vi'
      ? 'Vui lòng chuyển khoản chính xác số tiền và nội dung bên trên.'
      : 'Please transfer the exact amount with the memo code above.',
  };

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft(t.expired);
        setTimeLeftSeconds(0);
        setExpired(true);
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      setTimeLeftSeconds(totalSeconds);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, t.expired]);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(buildOrderStatusUrl(orderId, statusAccessToken));
      if (res.ok) {
        const data = (await res.json()) as PublicOrderStatusSnapshot;
        if (isVisibleOrderOutcome(data)) {
          onStatusChange(data);
        }
      }
    } catch {}
  }, [orderId, onStatusChange, statusAccessToken]);

  useEffect(() => {
    if (expired) return;
    pollStatus();
    const timer = setInterval(pollStatus, 2000);
    return () => clearInterval(timer);
  }, [pollStatus, expired]);

  const handleCancel = async () => {
    if (!token) return;
    try {
      const res = await fetch(buildOrderStatusUrl(orderId, statusAccessToken));
      if (!res.ok) return;
      const data = (await res.json()) as PublicOrderStatusSnapshot;

      if (data.paymentSuccess || TERMINAL_STATUSES.has(data.status)) {
        onStatusChange(data);
        return;
      }

      const cancelRes = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (cancelRes.ok) {
        const cancelData = await cancelRes.json();
        if (cancelData.status === 'PAID') {
          setCancelBlocked(true);
          return;
        }
        onStatusChange({
          id: orderId,
          status: 'CANCELLED',
          expiresAt,
          paymentSuccess: false,
          rechargeSuccess: false,
          rechargeStatus: 'closed',
        });
      } else {
        await pollStatus();
      }
    } catch {}
  };

  if (cancelBlocked) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 py-8">
        <div className={dark ? 'text-6xl text-green-400' : 'text-6xl text-green-600'}>{'✓'}</div>
        <h2 className={['text-xl font-bold', dark ? 'text-green-400' : 'text-green-600'].join(' ')}>{t.paid}</h2>
        <p className={['text-center text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
          {t.paidCancelBlocked}
        </p>
        <button
          onClick={onBack}
          className={['mt-4 w-full rounded-lg py-3 font-medium text-white', dark ? 'bg-blue-600/90 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'].join(' ')}
        >
          {t.backToRecharge}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-5">
      {/* Amount + Timer */}
      <div className="text-center">
        <div className={['text-4xl font-bold', dark ? 'text-blue-400' : 'text-blue-600'].join(' ')}>
          {displayAmount.toLocaleString('vi-VN')} VND
        </div>
        {hasFeeDiff && (
          <div className={['mt-1 text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
            {t.credited} {Math.round(amount)} ☕
          </div>
        )}
        <div
          className={`mt-2 text-sm font-medium ${expired ? 'text-red-500' : timeLeftSeconds <= 60 ? 'text-red-500 animate-pulse' : dark ? 'text-slate-400' : 'text-gray-500'}`}
        >
          {expired ? t.expired : `${t.remaining}: ${timeLeft}`}
        </div>
      </div>

      {/* Bank Transfer Card with QR */}
      {!expired && sepayBankInfo && (
        <BankTransferCard
          bankInfo={sepayBankInfo}
          displayAmount={displayAmount}
          dark={dark}
          t={t}
          qrCodeUrl={qrCode || undefined}
        />
      )}

      {/* Actions */}
      <div className="w-full">
        {!isIframe && !expired && token && (
          <button
            onClick={handleCancel}
            className={['w-full rounded-lg border py-2.5 text-sm font-medium', dark ? 'border-red-700 text-red-400 hover:bg-red-900/30' : 'border-red-300 text-red-600 hover:bg-red-50'].join(' ')}
          >
            {t.cancelOrder}
          </button>
        )}
      </div>
    </div>
  );
}
