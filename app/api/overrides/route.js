import { NextResponse } from "next/server";
export const GET = () => NextResponse.json({ error: "disabled in demo" }, { status: 405 });
export const POST = () => NextResponse.json({ error: "disabled in demo" }, { status: 405 });
