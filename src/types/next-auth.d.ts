import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/auth/rbac";

declare module "next-auth" {
  interface User {
    role: AppRole;
    remember?: boolean;
  }

  interface Session {
    user: { id: string; role: AppRole } & DefaultSession["user"];
    loginAt: number;
  }
}

// next-auth/jwt เป็นเพียง re-export — ต้อง augment ที่ @auth/core/jwt โดยตรง
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    remember: boolean;
    loginAt: number;
  }
}
