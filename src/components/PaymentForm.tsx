'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/locale';
import { PAYMENT_TYPE_META, getPaymentIconType, getPaymentMeta, getPaymentDisplayInfo, isSepayType } from '@/lib/pay-utils';

export interface MethodLimitInfo {
  available: boolean;
  remaining: number | null;
  singleMin?: number;
  singleMax?: number;
  feeRate?: number;
}

interface PaymentFormProps {
  userId: number;
  userName?: string;
  userBalance?: number;
  enabledPaymentTypes: string[];
  methodLimits?: Record<string, MethodLimitInfo>;
  minAmount: number;
  maxAmount: number;
  onSubmit: (amount: number, paymentType: string) => Promise<void>;
  loading?: boolean;
  dark?: boolean;
  locale?: Locale;
  fixedAmount?: number;
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2000];
const QUICK_AMOUNTS_VND = [50000, 100000, 200000, 500000, 1000000, 2000000];
const AMOUNT_TEXT_PATTERN = /^\d*(\.\d{0,2})?$/;
const AMOUNT_TEXT_PATTERN_VND = /^\d*$/;

function hasValidCentPrecision(num: number): boolean {
  return Math.abs(Math.round(num * 100) - num * 100) < 1e-8;
}

export default function PaymentForm({
  userId,
  userName,
  userBalance,
  enabledPaymentTypes,
  methodLimits,
  minAmount,
  maxAmount,
  onSubmit,
  loading,
  dark = false,
  locale = 'en',
  fixedAmount,
}: PaymentFormProps) {
  const [amount, setAmount] = useState<number | ''>(fixedAmount ?? '');
  const [paymentType, setPaymentType] = useState(enabledPaymentTypes[0] || 'alipay');
  const [customAmount, setCustomAmount] = useState(fixedAmount ? String(fixedAmount) : '');

  const effectivePaymentType = enabledPaymentTypes.includes(paymentType)
    ? paymentType
    : enabledPaymentTypes[0] || 'stripe';

  const isVND = isSepayType(effectivePaymentType);
  const currencySymbol = isVND ? '' : '¥';
  const currencySuffix = isVND ? ' VND' : '';
  const formatAmount = (n: number) => isVND ? `${n.toLocaleString('en-US')}${currencySuffix}` : `¥${n.toFixed(2)}`;
  const activeQuickAmounts = isVND ? QUICK_AMOUNTS_VND : QUICK_AMOUNTS;
  const activeAmountPattern = isVND ? AMOUNT_TEXT_PATTERN_VND : AMOUNT_TEXT_PATTERN;

  const handleQuickAmount = (val: number) => {
    setAmount(val);
    setCustomAmount(String(val));
  };

  const handleCustomAmountChange = (val: string) => {
    if (!activeAmountPattern.test(val)) return;
    setCustomAmount(val);
    if (val === '') { setAmount(''); return; }
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && (isVND ? Number.isInteger(num) : hasValidCentPrecision(num))) {
      setAmount(num);
    } else {
      setAmount('');
    }
  };

  const selectedAmount = amount || 0;
  const isMethodAvailable = !methodLimits || methodLimits[effectivePaymentType]?.available !== false;
  const methodSingleMax = methodLimits?.[effectivePaymentType]?.singleMax;
  const methodSingleMin = methodLimits?.[effectivePaymentType]?.singleMin;
  const effectiveMax = methodSingleMax !== undefined && methodSingleMax > 0 ? methodSingleMax : maxAmount;
  const effectiveMin =
    methodSingleMin !== undefined && methodSingleMin > 0 ? Math.max(methodSingleMin, minAmount) : minAmount;
  const feeRate = methodLimits?.[effectivePaymentType]?.feeRate ?? 0;
  const feeAmount = feeRate > 0 && selectedAmount > 0 ? Math.ceil(((selectedAmount * feeRate) / 100) * 100) / 100 : 0;
  const payAmount =
    feeRate > 0 && selectedAmount > 0 ? Math.round((selectedAmount + feeAmount) * 100) / 100 : selectedAmount;
  const isValid =
    selectedAmount >= effectiveMin &&
    selectedAmount <= effectiveMax &&
    (isVND ? Number.isInteger(selectedAmount) : hasValidCentPrecision(selectedAmount)) &&
    isMethodAvailable;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    await onSubmit(selectedAmount, effectivePaymentType);
  };

  const coffeeCount = isVND && selectedAmount >= 2000 ? Math.floor(selectedAmount / 2000) : 0;

  const renderPaymentIcon = (type: string) => {
    const iconType = getPaymentIconType(type);
    if (iconType === 'alipay') {
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#00AEEF] text-xl font-bold leading-none text-white">
          A
        </span>
      );
    }
    if (iconType === 'wxpay') {
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#07C160] text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M10 3C6.13 3 3 5.58 3 8.75c0 1.7.84 3.23 2.17 4.29l-.5 2.21 2.4-1.32c.61.17 1.25.27 1.93.27.22 0 .43-.01.64-.03C9.41 13.72 9 12.88 9 12c0-3.31 3.13-6 7-6 .26 0 .51.01.76.03C15.96 3.98 13.19 3 10 3z" />
            <path d="M16 8c-3.31 0-6 2.24-6 5s2.69 5 6 5c.67 0 1.31-.1 1.9-.28l2.1 1.15-.55-2.44C20.77 15.52 22 13.86 22 12c0-2.21-2.69-4-6-4z" />
          </svg>
        </span>
      );
    }
    if (iconType === 'stripe') {
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635bff] text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </span>
      );
    }
    if (iconType === 'sepay') {
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="6" width="22" height="15" rx="2" />
            <path d="M1 10h22" />
            <path d="M12 2L2 6h20L12 2z" />
          </svg>
        </span>
      );
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Account info */}
      <div className={[
        'flex items-center gap-3 rounded-xl p-4',
        dark ? 'bg-slate-800/60' : 'bg-slate-50',
      ].join(' ')}>
        <div className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          dark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600',
        ].join(' ')}>
          {(userName || 'U')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className={['truncate text-sm font-medium', dark ? 'text-slate-100' : 'text-slate-900'].join(' ')}>
            {userName || (locale === 'vi' ? `Ng\u01b0\u1eddi d\u00f9ng #${userId}` : `User #${userId}`)}
          </div>
          {userBalance !== undefined && (
            <div className={['text-xs', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
              {locale === 'vi' ? 'S\u1ed1 d\u01b0:' : 'Balance:'}{' '}
              <span className={['font-semibold', dark ? 'text-emerald-400' : 'text-emerald-600'].join(' ')}>
                {userBalance.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Amount section */}
      {fixedAmount ? (
        <div className={[
          'rounded-xl p-6 text-center',
          dark ? 'bg-slate-800/60' : 'bg-slate-50',
        ].join(' ')}>
          <div className={['text-xs font-medium uppercase tracking-wider', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
            {locale === 'vi' ? 'S\u1ed1 ti\u1ec1n n\u1ea1p' : 'Recharge Amount'}
          </div>
          <div className={['mt-2 text-3xl font-bold', dark ? 'text-emerald-400' : 'text-emerald-600'].join(' ')}>
            {formatAmount(fixedAmount)}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Input */}
          <div className="relative">
            <div className={[
              'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium',
              dark ? 'text-slate-500' : 'text-slate-400',
            ].join(' ')}>
              {isVND ? 'VND' : '\u00a5'}
            </div>
            <input
              type="text"
              inputMode="decimal"
              step={isVND ? '1' : '0.01'}
              min={effectiveMin}
              max={effectiveMax}
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              placeholder={isVND ? `${effectiveMax}` : `${effectiveMin} - ${effectiveMax}`}
              className={[
                'w-full rounded-xl border-2 py-3.5 pl-14 pr-4 text-lg font-semibold transition-all focus:outline-none',
                dark
                  ? 'border-slate-700 bg-slate-800/60 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                  : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10',
              ].join(' ')}
            />
          </div>

          {/* Quick amount chips */}
          <div className="flex flex-wrap gap-2">
            {activeQuickAmounts.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAmount(val)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  amount === val
                    ? dark
                      ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/50'
                      : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/30'
                    : dark
                      ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                ].join(' ')}
              >
                {formatAmount(val)}
              </button>
            ))}
          </div>

          {/* Coffee meter */}
          {isVND && (
            <div className={[
              'flex items-center gap-2.5 rounded-xl px-4 py-3',
              dark ? 'bg-amber-500/10' : 'bg-amber-50',
            ].join(' ')}>
              <span className="text-xl">{'\u2615'}</span>
              <div className="flex-1">
                {coffeeCount > 0 ? (
                  <div>
                    <span className={['text-sm font-semibold', dark ? 'text-amber-300' : 'text-amber-700'].join(' ')}>
                      {coffeeCount} coffee{coffeeCount > 1 ? 's' : ''}
                    </span>
                    <span className={['ml-1.5 text-xs', dark ? 'text-amber-400/60' : 'text-amber-600/60'].join(' ')}>
                      {Array.from({ length: Math.min(coffeeCount, 10) }, () => '\u2615').join('')}
                    </span>
                  </div>
                ) : (
                  <span className={['text-xs', dark ? 'text-amber-400/80' : 'text-amber-600/80'].join(' ')}>
                    2,000 VND = 1 cup of coffee
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Validation message */}
          {customAmount !== '' && !isValid && (() => {
            const num = parseFloat(customAmount);
            let msg = locale === 'vi'
              ? 'S\u1ed1 ti\u1ec1n ph\u1ea3i n\u1eb1m trong ph\u1ea1m vi v\u00e0 h\u1ed7 tr\u1ee3 t\u1ed1i \u0111a 2 ch\u1eef s\u1ed1 th\u1eadp ph\u00e2n'
              : 'Amount must be within range and support up to 2 decimal places';
            if (!isNaN(num)) {
              if (num < minAmount)
                msg = locale === 'vi' ? `N\u1ea1p t\u1ed1i thi\u1ec3u: ${formatAmount(minAmount)}` : `Minimum: ${formatAmount(minAmount)}`;
              else if (num > effectiveMax)
                msg = locale === 'vi' ? `N\u1ea1p t\u1ed1i \u0111a: ${formatAmount(effectiveMax)}` : `Maximum: ${formatAmount(effectiveMax)}`;
            }
            return (
              <div className={[
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700',
              ].join(' ')}>
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {msg}
              </div>
            );
          })()}
        </div>
      )}

      {/* Payment method */}
      {enabledPaymentTypes.length > 1 && (
        <div className="space-y-2">
          <label className={['text-xs font-medium uppercase tracking-wider', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
            {locale === 'vi' ? 'Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n' : 'Payment Method'}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {enabledPaymentTypes.map((type) => {
              const meta = PAYMENT_TYPE_META[type];
              const displayInfo = getPaymentDisplayInfo(type, locale);
              const isSelected = effectivePaymentType === type;
              const limitInfo = methodLimits?.[type];
              const isUnavailable = limitInfo !== undefined && !limitInfo.available;

              return (
                <button
                  key={type}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => !isUnavailable && setPaymentType(type)}
                  title={
                    isUnavailable
                      ? locale === 'vi'
                        ? 'H\u1ea1n ng\u00e0y h\u00f4m nay \u0111\u00e3 \u0111\u1ea1t'
                        : 'Daily limit reached'
                      : undefined
                  }
                  className={[
                    'relative flex items-center gap-2 rounded-xl border-2 px-3 py-3 transition-all sm:flex-1 sm:justify-center',
                    isUnavailable
                      ? dark
                        ? 'cursor-not-allowed border-slate-800 bg-slate-800/30 opacity-40'
                        : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-40'
                      : isSelected
                        ? dark
                          ? `border-indigo-500/60 bg-indigo-500/10 text-slate-100 ring-1 ring-indigo-500/20`
                          : `border-indigo-500/40 bg-indigo-50/50 text-slate-900 ring-1 ring-indigo-500/10`
                        : dark
                          ? 'border-slate-800 bg-slate-800/30 text-slate-300 hover:border-slate-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  {renderPaymentIcon(type)}
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-sm font-semibold">{displayInfo.channel || type}</span>
                    {isUnavailable ? (
                      <span className="text-[10px] text-red-400">
                        {locale === 'vi' ? 'H\u1ea1n ng\u00e0y \u0111\u00e3 \u0111\u1ea1t' : 'Limit reached'}
                      </span>
                    ) : displayInfo.sublabel ? (
                      <span className={['text-[10px]', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
                        {displayInfo.sublabel}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {(() => {
            const limitInfo = methodLimits?.[effectivePaymentType];
            if (!limitInfo || limitInfo.available) return null;
            return (
              <p className={['text-xs', dark ? 'text-amber-300' : 'text-amber-600'].join(' ')}>
                {locale === 'vi'
                  ? 'Ph\u01b0\u01a1ng th\u1ee9c n\u00e0y \u0111\u00e3 \u0111\u1ea1t h\u1ea1n. Vui l\u00f2ng ch\u1ecdn ph\u01b0\u01a1ng th\u1ee9c kh\u00e1c.'
                  : "This method has reached today's limit. Please choose another."}
              </p>
            );
          })()}
        </div>
      )}

      {/* Fee breakdown */}
      {feeRate > 0 && selectedAmount > 0 && (
        <div className={[
          'space-y-2 rounded-xl p-4 text-sm',
          dark ? 'bg-slate-800/60 text-slate-300' : 'bg-slate-50 text-slate-600',
        ].join(' ')}>
          <div className="flex items-center justify-between">
            <span>{locale === 'vi' ? 'S\u1ed1 ti\u1ec1n n\u1ea1p' : 'Amount'}</span>
            <span>{formatAmount(selectedAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{locale === 'vi' ? `Ph\u00ed (${feeRate}%)` : `Fee (${feeRate}%)`}</span>
            <span>{formatAmount(feeAmount)}</span>
          </div>
          <div className={[
            'flex items-center justify-between border-t pt-2 font-semibold',
            dark ? 'border-slate-700 text-slate-100' : 'border-slate-200 text-slate-900',
          ].join(' ')}>
            <span>{locale === 'vi' ? 'T\u1ed5ng c\u1ed9ng' : 'Total'}</span>
            <span>{formatAmount(payAmount)}</span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || loading}
        className={[
          'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold tracking-wide transition-all',
          isValid && !loading
            ? [
                'text-white shadow-lg active:scale-[0.98]',
                getPaymentMeta(effectivePaymentType).buttonClass,
                dark ? 'shadow-indigo-500/20' : 'shadow-indigo-500/25',
              ].join(' ')
            : dark
              ? 'cursor-not-allowed bg-slate-800 text-slate-600'
              : 'cursor-not-allowed bg-slate-100 text-slate-400',
        ].join(' ')}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {locale === 'vi' ? '\u0110ang x\u1eed l\u00fd...' : 'Processing...'}
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            {locale === 'vi'
              ? `N\u1ea1p ${formatAmount(feeRate > 0 && selectedAmount > 0 ? payAmount : selectedAmount || 0)}`
              : `Pay ${formatAmount(feeRate > 0 && selectedAmount > 0 ? payAmount : selectedAmount || 0)}`}
          </>
        )}
      </button>
    </form>
  );
}
