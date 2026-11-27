import { NextResponse, type NextRequest } from "next/server";

// Overwrite the client header so server-side authorization receives the real route.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-app-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/).*)"] };
