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

  const canEdit =
    isAdmin ||
    (subproject.assignee_id !== null && subproject.assignee_id === currentUserId);

  const tasks = [...subproject.subtasks].sort(
    (left, right) => left.order_index - right.order_index,
  );
  const currentStep = tasks.find((task) => !task.is_done);
  const isAllDone = tasks.length > 0 && tasks.every((task) => task.is_done);
  const accentSurface = subproject.assignee_id
    ? softColorForId(subproject.assignee_id)
    : 'bg-[#F1EFE8]';
  const accentText = subproject.assignee_id
    ? textColorForId(subproject.assignee_id)
    : 'text-[#5F5E5A]';

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
          <p className="text-[9px] font-bold uppercase tracking-[1px] text-[#888780]">
            {TEXT.title}
          </p>
          <h3 className="mt-2 text-[19px] font-bold text-[#1A1A1A]">
            {subproject.name}
          </h3>
          <p className="mt-2 text-[11px] text-[#888780]">
            {subproject.start_date} - {subproject.end_date}
          </p>
        </div>

        <div
          className={`rounded-[20px] border px-3 py-2 ${accentSurface} ${accentText}`}
        >
          <p className="text-[11px] font-semibold">
            {TEXT.assignee} {subproject.assignee?.name ?? TEXT.unassigned}
          </p>
        </div>

        <div className={`rounded-[10px] border p-4 ${accentSurface}`}>
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold ${accentText}`}>{TEXT.progress}</p>
            <span className={`text-[13px] font-bold ${accentText}`}>
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
          <p className="rounded-xl bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]">
            {TEXT.assigneeOnly}
          </p>
        )}

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#D3D1C7] bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#888780]">
              {TEXT.emptyTasks}
            </p>
          ) : (
            <div className="rounded-xl border border-[#EAEAE4] bg-white p-4">
              <div className="mb-3 flex items-center justify-between border-b border-[#EAEAE4] pb-2 pl-6">
                <span className="text-[9px] font-bold uppercase tracking-[0.8px] text-[#888780]">
                  {TEXT.detailTasks}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.8px] text-[#888780]">
                  {TEXT.weight}
                </span>
              </div>

              <ul className="space-y-1">
                {tasks.map((task) => {
                  const isCurrent = currentStep?.id === task.id;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 border-b border-[#F1EFE8] py-2 last:border-b-0"
                    >
                      <button
                        type="button"
                        disabled={!canEdit || busy !== null}
                        onClick={() => void toggle(task)}
                        className={`flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border text-[9px] ${
                          task.is_done
                            ? 'border-[#22C55E] bg-[#22C55E] text-white'
                            : isCurrent
                              ? 'border-[#534AB7] bg-white text-[#534AB7]'
                              : 'border-[#D3D1C7] bg-white text-transparent'
                        }`}
                      >
                        {TEXT.check}
                      </button>

                      <span
                        className={`flex-1 text-[12px] ${
                          task.is_done
                            ? 'text-[#B4B2A9] line-through'
                            : isCurrent
                              ? 'font-bold text-[#534AB7]'
                              : 'text-[#1A1A1A]'
                        }`}
                      >
                        {isCurrent && !task.is_done ? TEXT.current : ''}
                        {task.name}
                      </span>

                      <span
                        className={`min-w-[32px] text-right text-[11px] font-semibold ${
                          task.is_done
                            ? 'text-[#22C55E]'
                            : isCurrent
                              ? 'text-[#534AB7]'
                              : 'text-[#888780]'
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
          <p className="rounded-xl bg-[#EAF3DE] px-4 py-3 text-sm text-[#3B6D11]">
            {TEXT.allDone}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-[#FCEBEB] px-4 py-3 text-sm text-[#A32D2D]">
            {error}
          </p>
        )}

        <div className="flex justify-end border-t border-[#EAEAE4] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#D3D1C7] px-4 py-2 text-[11px] font-bold text-[#5F5E5A] hover:bg-[#F8F8F5]"
          >
            {TEXT.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
