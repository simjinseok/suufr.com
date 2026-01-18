'use client';
import React from 'react';
import { Form, Button, NumberField, Surface, Switch, Tabs } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { updateSettings } from '@/actions/settings';
import type { TUserSettings } from '@/types/index';

export default function SettingsForm({ settings }: { settings: TUserSettings }) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      timeFormat: settings.timeFormat,
      defaultDuration: settings.defaultDuration,
      autoUpdateNextPaymentAt: settings.autoUpdateNextPaymentAt,
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateSettings, {
    fields: {
      timeFormat: settings.timeFormat,
      defaultDuration: settings.defaultDuration,
      autoUpdateNextPaymentAt: settings.autoUpdateNextPaymentAt,
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-sm">
      <Form
        id={formId}
        action={formAction}
        validationErrors={state.fieldErrors}
      >
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold">시간 형식</h2>
              <p className="mt-1 text-sm text-gray-500">캘린더 및 수업 목록에 표시되는 시간 형식을 선택합니다.</p>
            </div>
            <Controller
              control={control}
              name="timeFormat"
              render={({ field: { name, value, onChange } }) => (
                <React.Fragment>
                  <Tabs selectedKey={value} onSelectionChange={onChange}>
                    <Tabs.ListContainer>
                      <Tabs.List>
                        <Tabs.Tab id="24h">
                          24h
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="12h">
                          12h
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </Tabs>
                  <input type="hidden" name={name} value={value} />
                </React.Fragment>
              )}
            />
          </div>

          <div className="flex justify-between items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold">기본 수업 시간</h2>
              <p className="mt-1 text-sm text-gray-500">새 수업 추가 시 기본으로 설정되는 수업 시간입니다.</p>
            </div>
            <Controller
              control={control}
              name="defaultDuration"
              render={({ field: { name, value, onChange } }) => (
                <NumberField
                  name={name}
                  value={value}
                  onChange={onChange}
                  minValue={5}
                  maxValue={480}
                  step={5}
                  aria-label="기본 수업 시간"
                >
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input className="w-16 text-center" />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              )}
            />
          </div>

          <div className="flex justify-between items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold">다음 결제 예정일 자동 업데이트</h2>
              <p className="mt-1 text-sm text-gray-500">레슨 추가 시 마지막 수업의 다음 회차를 다음 결제 예정일로 자동 설정합니다.</p>
            </div>
            <Controller
              control={control}
              name="autoUpdateNextPaymentAt"
              render={({ field: { name, value, onChange } }) => (
                <React.Fragment>
                  <Switch
                    name={name}
                    value="on"
                    isSelected={value}
                    onChange={onChange}
                    aria-label="다음 결제 예정일 자동 업데이트"
                  >
                    <Switch.Control>
                      <Switch.Thumb>
                        <Switch.Icon />
                      </Switch.Thumb>
                    </Switch.Control>
                  </Switch>
                </React.Fragment>
              )}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            form={formId}
            variant="primary"
            type="submit"
            isPending={isPending}
          >
            저장
          </Button>
        </div>
      </Form>
    </Surface>
  );
}
