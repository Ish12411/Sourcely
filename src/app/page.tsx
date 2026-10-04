import { cookies } from "next/headers";
import Workspace from "@/components/Workspace";
import { SIDEBAR_COOKIE } from "@/lib/sidebarCookie";

export default async function Page() {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  return <Workspace sidebarCollapsedHint={collapsed} />;
}
