import { redirect } from 'next/navigation'

export default async function SubmissionsIndexPage({
  params,
}: {
  params: Promise<{ appId: string }>
}) {
  const { appId } = await params
  redirect(`/apps/${appId}`)
}
