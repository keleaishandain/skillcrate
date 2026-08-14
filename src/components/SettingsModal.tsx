import React, { useEffect, useState } from 'react';
import {
  X,
  Settings,
  Sliders,
  ShieldCheck,
  Folder,
  Layers,
  Save,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  settings: AppSettings | null;
  onSave: (settings: AppSettings) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  settings,
  onSave
}) => {
  const [draft, setDraft] = useState<AppSettings | null>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(draft);
      onShowToast('设置已保存', '偏好已写入 ~/.skill-curator/state.json', 'success');
      onClose();
    } catch (error) {
      onShowToast('设置保存失败', String(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">系统偏好与算法配置</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Storage paths */}
          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center space-x-1.5">
              <HardDrive size={12} className="text-slate-400" />
              <span>中央技能库本地存储目录:</span>
            </label>
            <input
              type="text"
              value={draft.repoPath}
              readOnly
              className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-400 font-mono cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center space-x-1.5">
              <ShieldCheck size={12} className="text-slate-400" />
              <span>安全隔离仓存储目录:</span>
            </label>
            <input
              type="text"
              value={draft.archivePath}
              readOnly
              className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-400 font-mono cursor-not-allowed"
            />
          </div>

          {/* Claude Binary Path */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Claude Code CLI 可执行文件路径:</label>
            <input
              type="text"
              value={draft.claudeBinary}
              onChange={(e) => setDraft({ ...draft, claudeBinary: e.target.value })}
              className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Quarantine Protection Period */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              可逆安全隔离锁保留期 (天数):
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={draft.quarantineDays}
                onChange={(e) => setDraft({ ...draft, quarantineDays: parseInt(e.target.value) || 30 })}
                className="w-24 bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none"
              />
              <span className="text-slate-400">天（期满后进入待归档状态，绝不物理静默删除）</span>
            </div>
          </div>

          {/* Auto sync toggle */}
          <div className="flex items-center space-x-2.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <input
              type="checkbox"
              id="auto-sync"
              checked={draft.autoSyncOnSave}
              onChange={(e) => setDraft({ ...draft, autoSyncOnSave: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
            />
            <label htmlFor="auto-sync" className="text-slate-300 cursor-pointer">
              在 UI 中编辑保存 SKILL.md 时，自动同步软链至所有已启用的 CLI 端点
            </label>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">TF-IDF 职责重叠阈值:</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                value={draft.similarityThreshold}
                onChange={(e) => setDraft({ ...draft, similarityThreshold: Number(e.target.value) })}
                className="flex-1 accent-indigo-500"
              />
              <span className="w-12 text-right font-mono text-indigo-300">{draft.similarityThreshold.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
          >
            <Save size={12} />
            <span>{saving ? '保存中...' : '保存偏好设置'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
