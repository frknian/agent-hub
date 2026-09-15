"use client";
import { signIn, signOut } from "next-auth/react";
import { Button } from "./ui/button";
export function AuthButton({ logout = false }: { logout?: boolean }) {
  return (
    <Button
      variant={logout ? "outline" : "default"}
      onClick={() =>
        logout
          ? signOut({ callbackUrl: "/login" })
          : signIn("github", { callbackUrl: "/dashboard" })
      }
    >
      {logout ? "Çıkış yap" : "GitHub ile devam et"}
    </Button>
  );
}
