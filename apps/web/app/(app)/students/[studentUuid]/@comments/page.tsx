import { getSession } from '@/utils/auth';
import { studentCommentsApi } from '@/utils/api';
import Comments from './_comments';

export default async function CommentsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const { studentUuid } = await params;
  const session = await getSession();

  if (!session?.organization) {
    return null;
  }

  const { data: comments } = await studentCommentsApi.listByStudent(studentUuid);

  return <Comments comments={comments} studentUuid={studentUuid} />;
}
