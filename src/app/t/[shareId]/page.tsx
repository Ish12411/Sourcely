import { cookies } from "next/headers";
import Workspace from "@/components/Workspace";
import { SIDEBAR_COOKIE } from "@/lib/sidebarCookie";

export const metadata = {
  title: "Shared research — Sourcely",
};

export default async function SharedPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  return <Workspace openShareId={shareId} sidebarCollapsedHint={collapsed} />;
}
