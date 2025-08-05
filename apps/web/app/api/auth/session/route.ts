import { getServerSession } from "next-auth";
import { authOptions } from "@moxmuse/api/src/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    return NextResponse.json(session);
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(null, { status: 500 });
  }
}