import type { NextAuthConfig } from "next-auth";

// config ที่ไม่แตะ DB/bcrypt — ใช้ร่วมกันระหว่าง proxy.ts และ auth หลัก

export const REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const SHORT_SESSION_SECONDS = 8 * 60 * 60;

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE_SECONDS },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.remember = user.remember ?? false;
        token.loginAt = Math.floor(Date.now() / 1000);
      }
      // ไม่ติ๊ก "จำการเข้าสู่ระบบ" → หมดอายุใน 8 ชั่วโมงแม้ cookie ยังอยู่
      if (!token.remember && token.loginAt) {
        const age = Math.floor(Date.now() / 1000) - token.loginAt;
        if (age > SHORT_SESSION_SECONDS) return null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.loginAt = token.loginAt;
      return session;
    },
  },
} satisfies NextAuthConfig;
