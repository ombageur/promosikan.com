import { Check, ChevronsUpDown, LogOut, Menu, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { ROLE_LABELS } from "@shared/permissions";
import { DemoBadge } from "@/components/intelligence/badges";
import { DemoDataBanner } from "@/components/intelligence/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMyWorkspaces, useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth";
import { Brand } from "./Brand";
import { NAV_GROUPS } from "./navigation";
import { WorkspaceAvatar } from "./WorkspaceAvatar";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { basePath: base, can, isPublicDemo } = useWorkspace();

  return (
    <nav aria-label="Navigasi utama" className="grid gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          <ul className="grid gap-0.5">
            {group.items
              .filter((item) => (!item.permission || can(item.permission)) && !(isPublicDemo && item.requiresAccount))
              .map(({ label, icon: Icon, path, end }) => (
                <li key={label}>
                  <NavLink
                    to={path ? `${base}/${path}` : base}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive ? "bg-secondary text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-foreground",
                      )
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function WorkspaceSwitcher() {
  const { workspace, role } = useWorkspace();
  const { data: workspaces, isLoading } = useMyWorkspaces();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full min-w-0 items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left hover:bg-slate-50 sm:w-64"
        aria-label="Ganti workspace"
      >
        <WorkspaceAvatar name={workspace.name} logoUrl={workspace.logoUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{workspace.name}</span>
          <span className="block text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspace Anda</DropdownMenuLabel>
          {isLoading && <p className="px-2 py-1.5 text-sm text-muted-foreground">Memuat…</p>}
          {workspaces?.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => navigate(`/w/${ws.id}`)}>
              <WorkspaceAvatar name={ws.name} logoUrl={ws.logoUrl} className="size-6 text-xs" />
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
              {ws.id === workspace.id && <Check className="size-4 text-primary" aria-label="Aktif" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/onboarding")}>
          <Plus aria-hidden />
          Buat workspace baru
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const name = user.displayName || user.email || "Pengguna";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground"
        aria-label="Menu akun"
      >
        {user.photoURL ? <img src={user.photoURL} alt="" className="size-full object-cover" /> : name.charAt(0).toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut aria-hidden />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PublicDemoBar() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      <span className="mr-auto hidden truncate text-sm font-semibold sm:block">Demo — Publish Agency</span>
      <Button variant="ghost" nativeButton={false} render={<Link to="/login" />}>
        Masuk
      </Button>
      <Button nativeButton={false} render={<Link to="/register" />}>
        Daftar gratis
      </Button>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { workspace, basePath, isPublicDemo } = useWorkspace();

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r bg-white px-3 py-5 lg:flex">
        <Brand to={basePath} className="mb-7 px-2" />
        <SidebarNav />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigasi">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white px-3 py-5 shadow-xl">
            <div className="mb-7 flex items-center justify-between px-2">
              <Brand to={basePath} />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">
                <X />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
            <Menu />
          </Button>
          {isPublicDemo ? (
            <PublicDemoBar />
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <WorkspaceSwitcher />
              </div>
              {workspace.isDemo && <DemoBadge />}
              <UserMenu />
            </>
          )}
        </header>
        <DemoDataBanner />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
