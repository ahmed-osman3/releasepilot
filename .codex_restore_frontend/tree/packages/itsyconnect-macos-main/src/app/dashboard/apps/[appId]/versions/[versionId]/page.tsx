import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ appId: string; versionId: string }>;
}

export default async function VersionPage({ params }: Props) {
  const { appId } = await params;
  redirect(`/dashboard/apps/${appId}/store-listing`);
}
