import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/actions/settings';

import SettingsForm from './_settings-form';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user } = await getSession();
  const settings = await getUserSettings(user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">설정</h1>
      <div className="mt-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
