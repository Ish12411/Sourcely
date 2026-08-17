import Workspace from "@/components/Workspace";

export const metadata = {
  title: "Shared research — Sourcely",
};

export default async function SharedPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <Workspace openShareId={shareId} />;
}
