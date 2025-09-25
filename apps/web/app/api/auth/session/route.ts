import { getServerSession } from "next-auth";
// Import authOptions lazily to avoid initializing Prisma at build time
let authOptions: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  authOptions = (0, eval)('require')("@moxmuse/api/src/auth").authOptions
} catch (_e) {
  authOptions = undefined
}
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // If authOptions failed to load (e.g., during build without DB), return empty session
    if (!authOptions) {
      return NextResponse.json(null)
    }
    const session = await getServerSession(authOptions);
    return NextResponse.json(session);
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(null, { status: 500 });
  }
}