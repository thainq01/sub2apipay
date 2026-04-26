import { redirect } from 'next/navigation';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  // Set screen to home
  qs.set('screen', 'home');

  // Preserve all query params (token, lang, theme, ui_mode, etc.)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) qs.set(key, v);
    }
  }

  redirect(`/app?${qs.toString()}`);
}
