import { redirect } from 'next/navigation';

export default async function PayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  // Set screen to pay
  qs.set('screen', 'pay');

  // Preserve all query params (token, lang, theme, ui_mode, resume_order, amount, tab, etc.)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) qs.set(key, v);
    }
  }

  redirect(`/app?${qs.toString()}`);
}
