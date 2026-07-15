"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./app-shell.module.css";

const destinations = [
  { href: "/today", label: "Today" },
  { href: "/progress", label: "Progress" },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={styles.nav}>
      {destinations.map(({ href, label }) => {
        const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={styles.navLink}
            href={href}
            key={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
