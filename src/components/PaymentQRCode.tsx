'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import type { Locale } from '@/lib/locale';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';
import { isStripeType, getPaymentMeta, getPaymentIconSrc, getPaymentChannelLabel } from '@/lib/pay-utils';
import { isSepayType } from '@/lib/pay-utils';
import { buildOrderStatusUrl } from '@/lib/order/status-url';
import { TERMINAL_STATUSES } from '@/lib/constants';

interface PaymentQRCodeProps {
  orderId: string;
  token?: string;
  payUrl?: string | null;
  qrCode?: string | null;
  clientSecret?: string | null;
  stripePublishableKey?: string | null;
  paymentType?: string;
  amount: number;
  payAmount?: number;
  expiresAt: string;
  statusAccessToken?: string;
  onStatusChange: (status: PublicOrderStatusSnapshot) => void;
  onBack: () => void;
  dark?: boolean;
  isEmbedded?: boolean;
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
          ? dark
            ? 'bg-green-800 text-green-200'
            : 'bg-green-100 text-green-600'
          : dark
            ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
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
  locale,
  t,
  qrCodeUrl,
}: {
  bankInfo: { bankName: string; accountNumber: string; accountName: string; transferCode: string };
  displayAmount: number;
  dark: boolean;
  locale: string;
  t: Record<string, string>;
  qrCodeUrl?: string;
}) {
  const rows = [
    { label: t.bankName, value: bankInfo.bankName, copyable: false },
    { label: t.accountNumber, value: bankInfo.accountNumber, copyable: true },
    { label: t.accountName, value: bankInfo.accountName, copyable: true },
    { label: t.transferAmount, value: `${displayAmount.toFixed(0)} VND`, copyable: true, copyText: String(Math.round(displayAmount)) },
    { label: t.transferCode, value: bankInfo.transferCode, copyable: true, highlight: true },
  ];

  return (
    <div className="w-full max-w-md space-y-4">
      {qrCodeUrl && (
        <div className="flex justify-center">
          <div
            className={[
              'rounded-lg border p-3',
              dark ? 'border-slate-700 bg-white' : 'border-gray-200 bg-white',
            ].join(' ')}
          >
            <img src={qrCodeUrl} alt="Bank Transfer QR" className="h-56 w-56 rounded" />
          </div>
        </div>
      )}
      <div
        className={[
          'rounded-lg border p-4 space-y-3',
          dark ? 'border-blue-800 bg-blue-950/50' : 'border-blue-200 bg-blue-50',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-full bg-blue-600 p-1.5">
            <img src="/icons/bank.svg" alt="bank" className="h-4 w-4 brightness-0 invert" />
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
                    ? dark
                      ? 'font-bold text-yellow-300'
                      : 'font-bold text-blue-700'
                    : dark
                      ? 'text-slate-200'
                      : 'text-gray-900',
                ].join(' ')}
              >
                {row.value}
              </span>
              {row.copyable && (
                <CopyButton text={row.copyText ?? row.value} label={t.copy} dark={dark} />
              )}
            </div>
          </div>
        ))}
      </div>
      <p className={['text-center text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
        {t.transferHint}
      </p>
      <div className="flex items-center justify-center gap-2 py-2">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
        />
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
  payUrl,
  qrCode,
  clientSecret,
  stripePublishableKey,
  paymentType,
  amount,
  payAmount: payAmountProp,
  expiresAt,
  statusAccessToken,
  onStatusChange,
  onBack,
  dark = false,
  isEmbedded = false,
  isMobile = false,
  locale = 'en',
  sepayBankInfo,
}: PaymentQRCodeProps) {
  const displayAmount = payAmountProp ?? amount;
  const hasFeeDiff = payAmountProp !== undefined && payAmountProp !== amount;
  const [timeLeft, setTimeLeft] = useState('');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(Infinity);
  const [expired, setExpired] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [cancelBlocked, setCancelBlocked] = useState(false);
  const [redirected, setRedirected] = useState(false);

  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeSubmitting, setStripeSubmitting] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [stripeLib, setStripeLib] = useState<{
    stripe: import('@stripe/stripe-js').Stripe;
    elements: import('@stripe/stripe-js').StripeElements;
  } | null>(null);
  const [stripePaymentMethod, setStripePaymentMethod] = useState('card');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const paymentMethodListenerAdded = useRef(false);

  const t = {
    expired: locale === 'vi' ? 'Đơn hàng đã hết hạn' : 'Order Expired',
    remaining: locale === 'vi' ? 'Thời gian còn lại' : 'Time Remaining',
    scanPay: locale === 'vi' ? 'Vui lòng quét mã QR bằng ứng dụng thanh toán' : 'Please scan with your payment app',
    back: locale === 'vi' ? 'Quay lại' : 'Back',
    cancelOrder: locale === 'vi' ? 'Hủy đơn hàng' : 'Cancel Order',
    h5Hint:
      locale === 'vi'
        ? 'Sau khi thanh toán xong vui lòng quay lại trang này, hệ thống sẽ tự động xác nhận.'
        : 'After payment, please return to this page. The system will confirm automatically.',
    paid: locale === 'vi' ? 'Đơn hàng đã thanh toán' : 'Order Paid',
    paidCancelBlocked:
      locale === 'vi'
        ? 'Đơn hàng này đã thanh toán xong, không thể hủy. Tiền nạp sẽ được cập nhật tự động.'
        : 'This order has already been paid and cannot be cancelled. The recharge will be credited automatically.',
    backToRecharge: locale === 'vi' ? 'Quay lại nạp tiền' : 'Back to Recharge',
    credited: locale === 'vi' ? 'Cập nhật ¥' : 'Credited ¥',
    stripeLoadFailed:
      locale === 'vi'
        ? 'Không thể tải thành phần thanh toán. Vui lòng làm mới trang và thử lại.'
        : 'Failed to load payment component. Please refresh and try again.',
    initFailed:
      locale === 'vi' ? 'Khởi tạo thanh toán không thành công. Vui lòng quay lại và thử lại.' : 'Payment initialization failed. Please go back and try again.',
    loadingForm: locale === 'vi' ? 'Đang tải biểu mẫu thanh toán...' : 'Loading payment form...',
    payFailed: locale === 'vi' ? 'Thanh toán không thành công. Vui lòng thử lại.' : 'Payment failed. Please try again.',
    successProcessing: locale === 'vi' ? 'Thanh toán thành công, đang xử lý đơn hàng...' : 'Payment successful, processing your order...',
    processing: locale === 'vi' ? 'Đang xử lý...' : 'Processing...',
    payNow: locale === 'vi' ? 'Thanh toán' : 'Pay',
    popupBlocked:
      locale === 'vi'
        ? 'Cửa sổ bật lên đã bị trình duyệt chặn. Vui lòng cho phép cửa sổ bật lên cho trang này và thử lại.'
        : 'Popup was blocked by your browser. Please allow popups for this site and try again.',
    redirectingPrefix: locale === 'vi' ? 'Đang chuyển hướng đến ' : 'Redirecting to ',
    redirectingSuffix: locale === 'vi' ? '...' : '...',
    redirectRetryHint:
      locale === 'vi'
        ? 'Nếu ứng dụng thanh toán không mở tự động, hãy quay lại và thử lại.'
        : 'If the payment app does not open automatically, go back and try again.',
    notRedirectedPrefix: locale === 'vi' ? 'Chưa chuyển hướng? Nhấp để truy cập' : 'Not redirected? Open ',
    goPaySuffix: locale === 'vi' ? '' : '',
    gotoPrefix: locale === 'vi' ? 'Truy cập ' : 'Open ',
    gotoSuffix: locale === 'vi' ? ' để thanh toán' : ' to pay',
    openScanPrefix: locale === 'vi' ? 'Vui lòng mở' : 'Open ',
    openScanSuffix: locale === 'vi' ? ' và quét mã để thanh toán' : ' and scan to complete payment',
    // SePay bank transfer
    bankTransferTitle: locale === 'vi' ? 'Thông tin chuyển khoản' : 'Bank Transfer Info',
    bankName: locale === 'vi' ? 'Ngân hàng' : 'Bank',
    accountNumber: locale === 'vi' ? 'Số tài khoản' : 'Account',
    accountName: locale === 'vi' ? 'Chủ tài khoản' : 'Name',
    transferAmount: locale === 'vi' ? 'Số tiền' : 'Amount',
    transferCode: locale === 'vi' ? 'Nội dung chuyển khoản' : 'Memo / Note',
    copied: locale === 'vi' ? 'Đã sao chép' : 'Copied!',
    copy: locale === 'vi' ? 'Sao chép' : 'Copy',
    waitingTransfer: locale === 'vi' ? 'Đang chờ chuyển khoản ngân hàng...' : 'Waiting for bank transfer...',
    transferHint:
      locale === 'vi'
        ? 'Vui lòng chuyển khoản với số tiền chính xác và nội dung ghi chú bên dưới. Hệ thống sẽ tự động xác nhận sau khi nhận được chuyển khoản.'
        : 'Please transfer the exact amount with the memo code below. The system will confirm automatically after receiving the transfer.',
  };

  const shouldAutoRedirect = !expired && !isStripeType(paymentType) && !isSepayType(paymentType) && !!payUrl && (isMobile || !qrCode);

  useEffect(() => {
    if (!shouldAutoRedirect || redirected) return;
    setRedirected(true);
    if (isEmbedded) {
      window.open(payUrl!, '_blank');
    } else {
      window.location.replace(payUrl!);
    }
  }, [shouldAutoRedirect, redirected, payUrl, isEmbedded]);

  const qrPayload = useMemo(() => {
    return (qrCode || '').trim();
  }, [qrCode]);

  useEffect(() => {
    let cancelled = false;
    if (!qrPayload) {
      setQrDataUrl('');
      return;
    }

    setImageLoading(true);
    QRCode.toDataURL(qrPayload, {
      width: 224,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const isStripe = isStripeType(paymentType);
  const isSepay = isSepayType(paymentType);
  const formatCurrency = (n: number) => isSepay ? `${n.toLocaleString('en-US')} VND` : `¥${n.toFixed(2)}`;

  useEffect(() => {
    if (!isStripe || !clientSecret || !stripePublishableKey) return;
    let cancelled = false;

    import('@stripe/stripe-js').then(({ loadStripe }) => {
      loadStripe(stripePublishableKey).then((stripe) => {
        if (cancelled) return;
        if (!stripe) {
          setStripeError(t.stripeLoadFailed);
          setStripeLoaded(true);
          return;
        }
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: dark ? 'night' : 'stripe',
            variables: {
              borderRadius: '8px',
            },
          },
        });
        setStripeLib({ stripe, elements });
        setStripeLoaded(true);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isStripe, clientSecret, stripePublishableKey, dark, t.stripeLoadFailed]);

  const stripeContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !stripeLib) return;
      let pe = stripeLib.elements.getElement('payment');
      if (pe) {
        pe.mount(node);
      } else {
        pe = stripeLib.elements.create('payment', { layout: 'tabs' });
        pe.mount(node);
      }
      if (!paymentMethodListenerAdded.current) {
        paymentMethodListenerAdded.current = true;
        pe.on('change', (event: { value?: { type?: string } }) => {
          if (event.value?.type) {
            setStripePaymentMethod(event.value.type);
          }
        });
      }
    },
    [stripeLib],
  );

  const handleStripeSubmit = async () => {
    if (!stripeLib || stripeSubmitting) return;

    if (isEmbedded && stripePaymentMethod === 'alipay') {
      handleOpenPopup();
      return;
    }

    setStripeSubmitting(true);
    setStripeError('');

    const { stripe, elements } = stripeLib;
    const returnUrl = new URL(window.location.href);
    returnUrl.pathname = '/pay/result';
    returnUrl.search = '';
    returnUrl.searchParams.set('order_id', orderId);
    returnUrl.searchParams.set('status', 'success');
    if (statusAccessToken) {
      returnUrl.searchParams.set('access_token', statusAccessToken);
    }
    if (locale === 'vi') {
      returnUrl.searchParams.set('lang', 'vi');
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl.toString(),
      },
      redirect: 'if_required',
    });

    if (error) {
      setStripeError(error.message || t.payFailed);
      setStripeSubmitting(false);
    } else {
      setStripeSuccess(true);
      setStripeSubmitting(false);
    }
  };

  const handleOpenPopup = () => {
    if (!clientSecret || !stripePublishableKey) return;
    setPopupBlocked(false);
    const popupUrl = new URL(window.location.href);
    popupUrl.pathname = '/pay/stripe-popup';
    popupUrl.search = '';
    popupUrl.searchParams.set('order_id', orderId);
    popupUrl.searchParams.set('amount', String(amount));
    popupUrl.searchParams.set('theme', dark ? 'dark' : 'light');
    popupUrl.searchParams.set('method', stripePaymentMethod);
    if (statusAccessToken) {
      popupUrl.searchParams.set('access_token', statusAccessToken);
    }
    if (locale === 'vi') {
      popupUrl.searchParams.set('lang', 'vi');
    }

    const popup = window.open(popupUrl.toString(), 'stripe_payment', 'width=500,height=700,scrollbars=yes');
    if (!popup || popup.closed) {
      setPopupBlocked(true);
      return;
    }
    const onReady = (event: MessageEvent) => {
      if (event.source !== popup || event.data?.type !== 'STRIPE_POPUP_READY') return;
      window.removeEventListener('message', onReady);
      popup.postMessage(
        {
          type: 'STRIPE_POPUP_INIT',
          clientSecret,
          publishableKey: stripePublishableKey,
        },
        window.location.origin,
      );
    };
    window.addEventListener('message', onReady);
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

  const meta = getPaymentMeta(paymentType || 'alipay');
  const iconSrc = getPaymentIconSrc(paymentType || 'alipay');
  const channelLabel = getPaymentChannelLabel(paymentType || 'alipay', locale);
  const iconBgClass = meta.iconBg;

  if (cancelBlocked) {
    return (
      <div className="flex flex-col items-center space-y-4 py-8">
        <div className={dark ? 'text-6xl text-green-400' : 'text-6xl text-green-600'}>{'✓'}</div>
        <h2 className={['text-xl font-bold', dark ? 'text-green-400' : 'text-green-600'].join(' ')}>{t.paid}</h2>
        <p className={['text-center text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
          {t.paidCancelBlocked}
        </p>
        <button
          onClick={onBack}
          className={[
            'mt-4 w-full rounded-lg py-3 font-medium text-white',
            dark ? 'bg-blue-600/90 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700',
          ].join(' ')}
        >
          {t.backToRecharge}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-center">
        <div className={['text-4xl font-bold', dark ? 'text-blue-400' : 'text-blue-600'].join(' ')}>
          {formatCurrency(displayAmount)}
        </div>
        {hasFeeDiff && (
          <div className={['mt-1 text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
            {t.credited}
            {formatCurrency(amount)}
          </div>
        )}
        <div
          className={`mt-1 text-sm ${expired ? 'text-red-500' : !expired && timeLeftSeconds <= 60 ? 'text-red-500 animate-pulse' : dark ? 'text-slate-400' : 'text-gray-500'}`}
        >
          {expired ? t.expired : `${t.remaining}: ${timeLeft}`}
        </div>
      </div>

      {!expired && (
        <>
          {isStripe ? (
            <div className="w-full max-w-md space-y-4">
              {!clientSecret || !stripePublishableKey ? (
                <div
                  className={[
                    'rounded-lg border-2 border-dashed p-8 text-center',
                    dark ? 'border-slate-700' : 'border-gray-300',
                  ].join(' ')}
                >
                  <p className={['text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>{t.initFailed}</p>
                </div>
              ) : !stripeLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#635bff] border-t-transparent" />
                  <span className={['ml-3 text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
                    {t.loadingForm}
                  </span>
                </div>
              ) : stripeError && !stripeLib ? (
                <div
                  className={[
                    'rounded-lg border p-3 text-sm',
                    dark ? 'border-red-700 bg-red-900/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600',
                  ].join(' ')}
                >
                  {stripeError}
                </div>
              ) : (
                <>
                  <div
                    ref={stripeContainerRef}
                    className={[
                      'rounded-lg border p-4',
                      dark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white',
                    ].join(' ')}
                  />
                  {stripeError && (
                    <div
                      className={[
                        'rounded-lg border p-3 text-sm',
                        dark ? 'border-red-700/50 bg-red-900/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600',
                      ].join(' ')}
                    >
                      {stripeError}
                    </div>
                  )}
                  {stripeSuccess ? (
                    <div className="text-center">
                      <div className={dark ? 'text-4xl text-green-400' : 'text-4xl text-green-600'}>{'✓'}</div>
                      <p className={['mt-2 text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
                        {t.successProcessing}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={stripeSubmitting}
                      onClick={handleStripeSubmit}
                      className={[
                        'w-full rounded-lg py-3 font-medium text-white shadow-md transition-colors',
                        stripeSubmitting ? 'cursor-not-allowed bg-gray-400' : meta.buttonClass,
                      ].join(' ')}
                    >
                      {stripeSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {t.processing}
                        </span>
                      ) : (
                        `${t.payNow} ${formatCurrency(amount)}`
                      )}
                    </button>
                  )}
                  {popupBlocked && (
                    <div
                      className={[
                        'rounded-lg border p-3 text-sm',
                        dark
                          ? 'border-amber-700 bg-amber-900/30 text-amber-300'
                          : 'border-amber-200 bg-amber-50 text-amber-700',
                      ].join(' ')}
                    >
                      {t.popupBlocked}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : isSepay && sepayBankInfo ? (
            <BankTransferCard
              bankInfo={sepayBankInfo}
              displayAmount={displayAmount}
              dark={dark}
              locale={locale}
              t={t}
              qrCodeUrl={qrCode || undefined}
            />
          ) : shouldAutoRedirect ? (
            <>
              <div className="flex items-center justify-center py-6">
                <div
                  className={`h-8 w-8 animate-spin rounded-full border-2 border-t-transparent`}
                  style={{ borderColor: meta.color, borderTopColor: 'transparent' }}
                />
                <span className={['ml-3 text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
                  {`${t.redirectingPrefix}${channelLabel}${t.redirectingSuffix}`}
                </span>
              </div>
              <a
                href={payUrl!}
                target={isEmbedded ? '_blank' : '_self'}
                rel="noopener noreferrer"
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 font-medium text-white shadow-md ${meta.buttonClass}`}
              >
                {iconSrc && <img src={iconSrc} alt={channelLabel} className="h-5 w-5 brightness-0 invert" />}
                {redirected
                  ? `${t.notRedirectedPrefix}${channelLabel}`
                  : `${t.gotoPrefix}${channelLabel}${t.gotoSuffix}`}
              </a>
              <p className={['text-center text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>{t.h5Hint}</p>
            </>
          ) : (
            <>
              {qrDataUrl && (
                <div
                  className={[
                    'relative rounded-lg border p-4',
                    dark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white',
                  ].join(' ')}
                >
                  {imageLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/10">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  )}
                  <img src={qrDataUrl} alt="payment qrcode" className="h-56 w-56 rounded" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className={`rounded-full p-2 shadow ring-2 ring-white ${iconBgClass}`}>
                      <img src={iconSrc} alt={channelLabel} className="h-5 w-5 brightness-0 invert" />
                    </span>
                  </div>
                </div>
              )}

              {!qrDataUrl && (
                <div className="text-center">
                  <div
                    className={[
                      'rounded-lg border-2 border-dashed p-8',
                      dark ? 'border-slate-700' : 'border-gray-300',
                    ].join(' ')}
                  >
                    <p className={['text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>{t.scanPay}</p>
                  </div>
                </div>
              )}

              <p className={['text-center text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
                {`${t.openScanPrefix}${channelLabel}${t.openScanSuffix}`}
              </p>
            </>
          )}
        </>
      )}

      <div className="flex w-full gap-3">
        <button
          onClick={onBack}
          className={[
            'flex-1 rounded-lg border py-2 text-sm',
            dark
              ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50',
          ].join(' ')}
        >
          {t.back}
        </button>
        {!expired && token && (
          <button
            onClick={handleCancel}
            className={[
              'flex-1 rounded-lg border py-2 text-sm',
              dark ? 'border-red-700 text-red-400 hover:bg-red-900/30' : 'border-red-300 text-red-600 hover:bg-red-50',
            ].join(' ')}
          >
            {t.cancelOrder}
          </button>
        )}
      </div>
    </div>
  );
}
