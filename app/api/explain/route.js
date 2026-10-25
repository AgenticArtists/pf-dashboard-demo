import { NextResponse } from "next/server";
export const POST = () => NextResponse.json({ error: "disabled in demo" }, { status: 405 });
