'use client';

import { getPaymentTypeLabel, getPaymentMeta } from '@/lib/pay-utils';
import type { Locale } from '@/lib/locale';

interface PaymentMethod {
  paymentType: string;
  amount: number;
  count: number;
  percentage: number;
}

interface PaymentMethodChartProps {
  data: PaymentMethod[];
  dark?: boolean;
  locale?: Locale;
}

export default function PaymentMethodChart({ data, dark, locale = 'en' }: PaymentMethodChartProps) {
  const title = locale === 'vi' ? 'Phân bố phương thức thanh toán' : 'Payment Method Distribution';
  const emptyText = locale === 'vi' ? 'Không có dữ liệu' : 'No data';
  const currency = locale === 'vi' ? 'VND' : '$';

  if (data.length === 0) {
    return (
      <div
        className={[
          'rounded-xl border p-6',
          dark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white shadow-sm',
        ].join(' ')}
      >
        <h3 className={['mb-4 text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
          {title}
        </h3>
        <p className={['text-center text-sm py-8', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>{emptyText}</p>
      </div>
    );
  }

  return (
    <div
      className={[
        'rounded-xl border p-6',
        dark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white shadow-sm',
      ].join(' ')}
    >
      <h3 className={['mb-4 text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>{title}</h3>
      <div className="space-y-4">
        {data.map((method) => {
          const meta = getPaymentMeta(method.paymentType);
          const label = getPaymentTypeLabel(method.paymentType, locale);
          return (
            <div key={method.paymentType}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{label}</span>
                <span className={dark ? 'text-slate-400' : 'text-slate-500'}>
                  {currency}
                  {method.amount.toLocaleString()} · {method.percentage}%
                </span>
              </div>
              <div
                className={['h-3 w-full overflow-hidden rounded-full', dark ? 'bg-slate-700' : 'bg-slate-100'].join(
                  ' ',
                )}
              >
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    dark ? meta.chartBar.dark : meta.chartBar.light,
                  ].join(' ')}
                  style={{ width: `${method.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
