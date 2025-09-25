import NextAuth from "next-auth";

// Lazy-load authOptions to avoid Prisma client init during Next build without prisma generate
let authOptions: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  authOptions = (0, eval)('require')("@moxmuse/api/src/auth").authOptions
} catch (_e) {
  authOptions = undefined
}

const handler = NextAuth(authOptions ?? {} as any);

export { handler as GET, handler as POST };