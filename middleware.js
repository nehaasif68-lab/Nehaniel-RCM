import { NextResponse } from "next/server";

export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/orgs/:path*",
    "/dashboard/:path*",
    "/update-password",
  ],
};
