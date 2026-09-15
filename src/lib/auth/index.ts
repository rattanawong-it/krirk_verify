import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AuditAction, writeAuditLog } from "@/lib/services/audit.service";
import { verifyCredentials } from "@/lib/services/auth.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "./auth.config";

// code ถูกส่งกลับไปยัง server action เพื่อแปลเป็นข้อความสองภาษา เช่น "locked:28"
class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // ล็อกอินผิดเป็นเหตุการณ์ปกติและบันทึกใน AuditLog แล้ว — ไม่พิมพ์ stack trace กลบ error จริง
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, remember: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse({
          email: raw.email,
          password: raw.password,
          remember: raw.remember === "true" || raw.remember === true,
        });
        if (!parsed.success) throw new LoginError("invalid");

        const result = await verifyCredentials(
          parsed.data.email,
          parsed.data.password,
          await getRequestContext(),
        );
        if (!result.ok) {
          throw new LoginError(result.minutes ? `${result.code}:${result.minutes}` : result.code);
        }
        return { ...result.user, remember: parsed.data.remember };
      },
    }),
  ],
  events: {
    async signOut(message) {
      const actorId = "token" in message ? message.token?.id : undefined;
      if (actorId) {
        writeAuditLog({ action: AuditAction.LOGOUT, actorId, context: await getRequestContext() });
      }
    },
  },
});
