import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
export async function GET(
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const handler = NextAuth(authOptions());
  return handler(request, { params: await context.params });
}
export const POST = GET;
