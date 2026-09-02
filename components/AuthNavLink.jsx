'use client';

import { useEffect, useState } from 'react';

export default function AuthNavLink({ className = '', onClick }) {
  const [email, setEmail] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEmail(data?.email || null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const href = email ? '/account' : '/login';
  const label = email ? 'Workspace' : 'Log in';

  return (
    <a
      href={href}
      onClick={onClick}
      className={className}
      aria-label={ready ? label : 'Log in'}
    >
      {ready ? label : 'Log in'}
    </a>
  );
}
