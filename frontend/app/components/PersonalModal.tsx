'use client';

import { useState } from 'react';
import { apiFetch, type SubProject, type SubTask } from '../lib/api';
import Modal from './Modal';
import ProgressBar from './ProgressBar';
import { softColorForId, textColorForId } from './AppShell/colors';

const TEXT = {
  title: '\uac1c\uc778 \uce98\ub9b0\ub354 \uc5c5\ubb34 \uc0c1\uc138',
  assignee: '\ub2f4\ub2f9\uc790',
  unassigned: '\ubbf8\uc9c0\uc815',
  progress: '\uc5c5\ubb34 \uc9c4\ud589\ub960',
  progressAriaSuffix: '\uc9c4\ud589\ub960',
  assigneeOnly: '\uc774 \uccb4\ud06c\ub9ac\uc2a4\ud2b8\ub294 \ub2f4\ub2f9\uc790\ub9cc \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.',
  emptyTasks: '\uc544\uc9c1 \uc138\ubd80 \uc5c5\ubb34\uac00 \ub4f1\ub85d\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.',
  detailTasks: '\uc138\ubd80 \uc5c5\ubb34',
  weight: '\ube44\uc911',
  current: '\ud604\uc7ac \uc9c4\ud589 \u00b7 ',
  allDone:
    '\ubaa8\ub4e0 \uc138\ubd80 \uc5c5\ubb34\uac00 \uc644\ub8cc\ub418\uc5b4 \ud504\ub85c\uc81d\ud2b8 \uc9c4\ud589\ub960\uc774 \ubc18\uc601\ub418\uc5c8\uc2b5\ub2c8\ub2e4.',
  close: '\ub2eb\uae30',
  check: '\u2713',
} as const;

type Props = {
  open: boolean;
  isAdmin: boolean;
  currentUserId: number;
  subproject: SubProject | null;
  onClose: () => void;
  onChanged: () => void;
};

export default function PersonalModal({
  open,
  isAdmin,
  currentUserId,
  subproject,
  onClose,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!subproject) return null;

  const assignedIds = subproject.assignee_ids?.length
    ? subproject.assignee_ids
    : subproject.assignee_id == null
      ? []
      : [subproject.assignee_id];
  const assigneeLabel = subproject.assignees?.length
    ? subproject.assignees.map((assignee) => assignee.name).join(', ')
    : (subproject.assignee?.name ?? TEXT.unassigned);
  const accentUserId = assignedIds.includes(currentUserId)
    ? currentUserId
    : assignedIds[0];
  const canEdit =
    isAdmin ||
    assignedIds.includes(currentUserId);

  const tasks = [...subproject.subtasks].sort(
    (left, right) => left.order_index - right.order_index,
  );
  const currentStep = tasks.find((task) => !task.is_done);
  const isAllDone = tasks.length > 0 && tasks.every((task) => task.is_done);
  const accentSurface = accentUserId
    ? softColorForId(accentUserId)
    : 'bg-surface-subtle';
  const accentText = accentUserId
    ? textColorForId(accentUserId)
    : 'text-text-muted';

  async function toggle(task: SubTask) {
    if (!canEdit || busy !== null) return;
    setBusy(task.id);
    setError('');
    try {
      await apiFetch(`/subtasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_done: !task.is_done }),
      });
      onChanged();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={subproject.name}>
      <div className="space-y-5">
        <div>
          <p className="text-nano font-bold uppercase tracking-[1px] text-text-subtle">
            {TEXT.title}
          </p>
          <h3 className="mt-2 text-[19px] font-bold text-text">
            {subproject.name}
          </h3>
          <p className="mt-2 text-micro text-text-subtle">
            {subproject.start_date} - {subproject.end_date}
          </p>
        </div>

        <div
          className={`rounded-[20px] border px-3 py-2 ${accentSurface} ${accentText}`}
        >
          <p className="text-micro font-semibold">
            {TEXT.assignee} {assigneeLabel}
          </p>
        </div>

        <div className={`rounded-[10px] border p-4 ${accentSurface}`}>
          <div className="flex items-center justify-between">
            <p className={`text-micro font-bold ${accentText}`}>{TEXT.progress}</p>
            <span className={`text-body font-bold ${accentText}`}>
              {Math.round(subproject.progress)}%
            </span>
          </div>
          <ProgressBar
            value={subproject.progress}
            size="md"
            className="mt-2"
            ariaLabel={`${subproject.name} ${TEXT.progressAriaSuffix}`}
          />
        </div>

        {!canEdit && (
          <p className="rounded-xl bg-verify-warn-bg px-4 py-3 text-sm text-verify-warn-fg">
            {TEXT.assigneeOnly}
          </p>
        )}

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-center text-sm text-text-subtle">
              {TEXT.emptyTasks}
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-white p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2 pl-6">
                <span className="text-nano font-bold uppercase tracking-[0.8px] text-text-subtle">
                  {TEXT.detailTasks}
                </span>
                <span className="text-nano font-bold uppercase tracking-[0.8px] text-text-subtle">
                  {TEXT.weight}
                </span>
              </div>

              <ul className="space-y-1">
                {tasks.map((task) => {
                  const isCurrent = currentStep?.id === task.id;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 border-b border-surface-subtle py-2 last:border-b-0"
                    >
                      <button
                        type="button"
                        disabled={!canEdit || busy !== null}
                        onClick={() => void toggle(task)}
                        className={`flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border text-nano ${
                          task.is_done
                            ? 'border-verify-pass-fg bg-verify-pass-fg text-white'
                            : isCurrent
                              ? 'border-brand bg-white text-brand'
                              : 'border-border-strong bg-white text-transparent'
                        }`}
                      >
                        {TEXT.check}
                      </button>

                      <span
                        className={`flex-1 text-small ${
                          task.is_done
                            ? 'text-text-faint line-through'
                            : isCurrent
                              ? 'font-bold text-brand'
                              : 'text-text'
                        }`}
                      >
                        {isCurrent && !task.is_done ? TEXT.current : ''}
                        {task.name}
                      </span>

                      <span
                        className={`min-w-[32px] text-right text-micro font-semibold ${
                          task.is_done
                            ? 'text-verify-pass-fg'
                            : isCurrent
                              ? 'text-brand'
                              : 'text-text-subtle'
                        }`}
                      >
                        {Number(task.weight).toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {isAllDone && (
          <p className="rounded-xl bg-verify-pass-bg px-4 py-3 text-sm text-verify-pass-fg">
            {TEXT.allDone}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-verify-fail-bg px-4 py-3 text-sm text-verify-fail-fg">
            {error}
          </p>
        )}

        <div className="flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-strong px-4 py-2 text-micro font-bold text-text-muted hover:bg-background"
          >
            {TEXT.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
