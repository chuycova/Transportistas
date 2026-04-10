// ─── app/(dashboard)/users/[userId]/page.tsx ─────────────────────────────────
import { UserDetailPage } from '@/features/users/user-detail-page';

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function UserDetailRoute({ params }: Props) {
  const { userId } = await params;
  return <UserDetailPage userId={userId} />;
}
