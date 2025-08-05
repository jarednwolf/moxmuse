import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log NextAuth events for debugging
    console.log("NextAuth Log:", {
      timestamp: new Date().toISOString(),
      ...body
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("NextAuth logging error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}