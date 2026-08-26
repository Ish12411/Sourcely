import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Reachable without being signed in. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Auth not configured yet: let everything through rather than bricking the
  // app behind a sign-in page that cannot work. The login page explains itself.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Calling getUser() here is what refreshes an expiring session and writes the
  // rotated cookies onto `response`. Removing it silently signs people out
  // roughly every hour.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // API routes must never be redirected. A fetch() following a 307 receives the
  // login page's HTML with a 200, which is indistinguishable from success at
  // the call site — `res.ok` is true and `res.json()` throws on markup. Each
  // route checks the session itself and answers with a JSON 401, which a client
  // can actually act on. Middleware still runs above this line, so the session
  // cookie is refreshed on API calls too.
  if (path.startsWith("/api/")) return response;

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    // Remember where they were headed — a shared thread link has to survive
    // the detour through sign-in, or sharing is broken for anyone new.
    redirect.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    /*
      Everything except Next internals and static files. The negative lookahead
      keeps the auth check off asset requests, which would otherwise pay for a
      token revalidation on every font and image.
    */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
