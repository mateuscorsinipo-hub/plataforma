"use client";

import { CreditCardIcon, LogOutIcon, SettingsIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { initialsOf, safeAvatarUrl } from "@/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  displayName,
  username,
  avatarUrl,
  isStaff,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isStaff: boolean;
}) {
  return (
    <DropdownMenu>
      {/* O nome acessível começa pelo texto visível (as iniciais), como pede o critério 2.5.3 da WCAG. */}
      <DropdownMenuTrigger className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
        <Avatar className="size-10">
          {safeAvatarUrl(avatarUrl) ? <AvatarImage src={safeAvatarUrl(avatarUrl)!} alt="" /> : null}
          <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
        </Avatar>
        <span className="sr-only">: menu da conta</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-sm font-bold text-foreground">{displayName}</span>
          <span className="block truncate text-xs font-medium text-muted-foreground">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`}>
            <UserRoundIcon />
            Meu perfil público
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/configuracoes">
            <SettingsIcon />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/assinatura">
            <CreditCardIcon />
            Plano e consumo
          </Link>
        </DropdownMenuItem>
        {isStaff ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheckIcon />
              Administração
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild destructive>
            <button type="submit" className="w-full">
              <LogOutIcon />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
