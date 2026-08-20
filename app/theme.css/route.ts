import { NextResponse } from "next/server";
import { THEME_CSS } from "../theme-css";

export async function GET() {
  return new NextResponse(THEME_CSS, {
    status: 200,
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
