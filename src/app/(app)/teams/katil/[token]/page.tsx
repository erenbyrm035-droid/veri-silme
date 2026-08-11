import { TeamInviteClient } from "@/components/teams/TeamInviteClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Takım Daveti · Viva" };

export default async function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TeamInviteClient token={token} />;
}
