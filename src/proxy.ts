import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  if (
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.get("host") || "")
  )
    return new NextResponse("Localhost access only", { status: 403 });
  if (
    request.headers.get("sec-fetch-site") === "cross-site" &&
    request.nextUrl.pathname.startsWith("/api/")
  )
    return new NextResponse("Cross-site access denied", { status: 403 });
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
