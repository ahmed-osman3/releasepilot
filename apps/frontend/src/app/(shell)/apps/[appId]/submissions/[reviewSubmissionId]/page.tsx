import { redirect } from 'next/navigation'

export default async function SubmissionWorkspacePage({
  params,
}: {
  params: Promise<{ appId: string; reviewSubmissionId: string }>
}) {
  const { appId } = await params
  redirect(`/apps/${appId}`)
}
