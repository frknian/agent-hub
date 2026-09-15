"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  ListTodo,
  Bot,
  CircleDollarSign,
  Settings,
  Layers,
} from "lucide-react";
const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projeler", icon: FolderGit2 },
  { href: "/tasks", label: "Görevler", icon: ListTodo },
  { href: "/agents", label: "Agentlar", icon: Bot },
  { href: "/costs", label: "Maliyet", icon: CircleDollarSign },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];
export function Navigation() {
  const path = usePathname();
  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-card p-5 md:flex md:flex-col">
        <Link
          href="/dashboard"
          className="mb-12 flex items-center gap-3 text-lg font-bold"
        >
          <span className="rounded-lg bg-primary p-2 text-white">
            <Layers size={20} />
          </span>
          Agent Hub
        </Link>
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground">
          WORKSPACE
        </p>
        <nav aria-label="Ana navigasyon" className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${path.startsWith(href) ? "bg-accent font-semibold text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-muted p-4">
          <p className="text-xs font-semibold">Milestone 1</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Projelerini düzenle.
            <br />
            Görevlerini tek yerde takip et.
          </p>
        </div>
      </aside>
      <nav
        aria-label="Mobil navigasyon"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={path.startsWith(href) ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[9px] ${path.startsWith(href) ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
