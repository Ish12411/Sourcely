import { headers } from "next/headers";
import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Sign in — Sourcely",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/*
  Reads the query string and user agent here, on the server, rather than with
  useSearchParams() in the form. useSearchParams() forces the form out of the
  server HTML behind a Suspense boundary, so the page arrived as an empty
  beige screen and the form only appeared once ~240 KB of JavaScript had
  downloaded and run — seconds of nothing on a phone, and the first thing
  anyone sees when the app opens. Now the form is in the HTML itself.
*/
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ua = (await headers()).get("user-agent") ?? "";
  // Same-origin paths only: after sign-in the form
  // navigates here, and an unchecked value would send people off-site.
  const nextParam = first(params.next) ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  return (
    <LoginForm
      next={next}
      initialError={first(params.error) ?? null}
      deleted={first(params.deleted) === "1"}
      // Same test as Natively's SDK. Deciding it on the server means the
      // Google button is never drawn in the app and then yanked away.
      nativeApp={/Natively\/(iOS|Android)/.test(ua)}
    />
  );
}
