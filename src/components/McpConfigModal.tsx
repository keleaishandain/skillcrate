import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Terminal,
  Play,
  Zap,
  Layers,
  FileCode,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Skill } from '../types';

interface McpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: Skill[];
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const McpConfigModal: React.FC<McpConfigModalProps> = ({
  isOpen,
  onClose,
  skills,
  onShowToast
}) => {
  const [activeSnippetTab, setActiveSnippetTab] = useState<'claude' | 'cursor' | 'opencode'>('claude');
  const [copied, setCopied] = useState(false);

  // MCP tool tester state
  const [selectedTool, setSelectedTool] = useState<'skills_list' | 'skills_search' | 'skills_get'>('skills_list');
  const [searchParam, setSearchParam] = useState('git');
  const [toolResponse, setToolResponse] = useState<string>('');
  const [isRunningTool, setIsRunningTool] = useState(false);

  if (!isOpen) return null;

  const claudeDesktopSnippet = `{
  "mcpServers": {
    "skill-curator": {
      "command": "skill-curator-mcp",
      "args": []
    }
  }
}`;

  const cursorSnippet = `{
  "mcpServers": {
    "skill-curator": {
      "command": "skill-curator-mcp",
      "args": []
    }
  }
}`;

  const openCodeSnippet = `{
  "mcp": {
    "skill-curator": {
      "type": "local",
      "command": ["skill-curator-mcp"]
    }
  }
}`;

  const activeSnippet =
    activeSnippetTab === 'claude'
      ? claudeDesktopSnippet
      : activeSnippetTab === 'cursor'
      ? cursorSnippet
      : openCodeSnippet;

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(activeSnippet);
    setCopied(true);
    onShowToast('复制成功', `已将 ${activeSnippetTab} 的 MCP 配置代码块复制到剪贴板`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunMcpTool = () => {
    setIsRunningTool(true);
    setTimeout(() => {
      setIsRunningTool(false);
      if (selectedTool === 'skills_list') {
        setToolResponse(JSON.stringify({
          status: 'ok',
          total: skills.length,
          skills: skills.slice(0, 4).map(s => ({
            name: s.name,
            version: s.version,
            category: s.category,
            endpoints: s.endpoints
          }))
        }, null, 2));
      } else if (selectedTool === 'skills_search') {
        const matched = skills.filter(s => s.name.includes(searchParam) || s.tags.includes(searchParam));
        setToolResponse(JSON.stringify({
          status: 'ok',
          query: searchParam,
          resultsCount: matched.length,
          results: matched.map(s => ({ name: s.name, description: s.description, tags: s.tags }))
        }, null, 2));
      } else {
        const s = skills[0];
        setToolResponse(JSON.stringify({
          status: 'ok',
          name: s.name,
          version: s.version,
          promptLength: s.contentMd.length,
          contentPreview: s.contentMd.substring(0, 120) + '...'
        }, null, 2));
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 text-base">⚡</span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">MCP 服务配置与协议交互 (Model Context Protocol)</h3>
              <p className="text-[11px] text-slate-400">本地 stdio 子进程 | 支持 Claude Desktop、Cursor 及其他 MCP Client</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[75vh]">
          {/* Section 1: One Click Snippet Copy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">1. 一键复制客户端 MCP 配置文件片段:</span>
              <button
                onClick={handleCopySnippet}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
              >
                {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                <span>{copied ? '已复制到剪贴板' : '一键复制 JSON 代码块'}</span>
              </button>
            </div>

            {/* Client Tabs */}
            <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-1">
              <button
                onClick={() => setActiveSnippetTab('claude')}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeSnippetTab === 'claude' ? 'bg-slate-800 text-indigo-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Claude Desktop (claude_desktop_config.json)
              </button>
              <button
                onClick={() => setActiveSnippetTab('cursor')}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeSnippetTab === 'cursor' ? 'bg-slate-800 text-indigo-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cursor / VS Code MCP
              </button>
              <button
                onClick={() => setActiveSnippetTab('opencode')}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeSnippetTab === 'opencode' ? 'bg-slate-800 text-indigo-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                OpenCode Config
              </button>
            </div>

            {/* Code Block */}
            <div className="relative bg-[#0d1117] p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
              <pre>{activeSnippet}</pre>
            </div>
          </div>

          {/* Section 2: Interactive MCP Tool Playground */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Terminal size={14} className="text-indigo-400" />
              <span>2. MCP RPC 工具即时调用调试 (Interactive Playground):</span>
            </span>

            <div className="flex items-center space-x-2 bg-[#0d1117] p-2 rounded-lg border border-slate-800">
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
              >
                <option value="skills_list">mcp:skills_list (获取全部技能)</option>
                <option value="skills_search">mcp:skills_search (关键字检索)</option>
                <option value="skills_get">mcp:skills_get_prompt (拉取具体 Prompt)</option>
              </select>

              {selectedTool === 'skills_search' && (
                <input
                  type="text"
                  value={searchParam}
                  onChange={(e) => setSearchParam(e.target.value)}
                  placeholder="搜索关键词 (如 git, tailwind)..."
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 flex-1 font-mono"
                />
              )}

              <button
                onClick={handleRunMcpTool}
                disabled={isRunningTool}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center space-x-1 transition shadow-sm ml-auto"
              >
                <Play size={11} className={isRunningTool ? 'animate-spin' : 'fill-white'} />
                <span>{isRunningTool ? '读取中...' : '预览本地响应'}</span>
              </button>
            </div>

            {toolResponse && (
              <div className="bg-[#0d1117] p-3 rounded-lg border border-emerald-500/30 text-[11px] font-mono text-emerald-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {toolResponse}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">服务模式: stdio JSON-RPC（按需启动 skill-curator-mcp）</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
