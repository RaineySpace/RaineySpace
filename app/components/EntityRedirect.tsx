'use client';

import { useEffect } from 'react';
import { redirectTarget } from '@/lib/redirects';

export default function EntityRedirect({ url, title }: { url: string; title: string }) {
  useEffect(() => { window.location.replace(redirectTarget(url, window.location.href)); }, [url]);
  return <div className="py-8">
    <noscript><meta httpEquiv="refresh" content={`0;url=${url}`} /></noscript>
    <h1 className="page-title">{title}</h1>
    <p className="mt-3 meta">正在跳转，<a href={url} data-no-page-transition className="underline">点击这里继续访问</a>。</p>
  </div>;
}
