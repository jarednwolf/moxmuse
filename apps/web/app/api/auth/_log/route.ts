import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Handle all HTTP methods to prevent any 404s
export async function POST(request: NextRequest) {
  try {
    // Simply return success without logging to prevent console spam
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}