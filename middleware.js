import { NextResponse } from "next/server";

// Public demo: no session gate and no environment variables required.
export function middleware() {
  return NextResponse.next();
}
