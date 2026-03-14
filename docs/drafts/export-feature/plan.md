# 组件导出/下载功能 - 执行计划

## 概述

为 uigen 添加组件导出功能，允许用户将 AI 生成的组件下载为 ZIP 文件或复制单个文件到剪贴板。

## 技术方案

### 数据流
```
VirtualFileSystem.getAllFiles()
       ↓
  Map<path, content>
       ↓
  client-zip 打包
       ↓
  Blob + download trigger
```

### 依赖选择
- **client-zip** (推荐) - 纯浏览器端 ZIP 生成，无服务端依赖
- 备选: JSZip (更大，但更流行)

## 执行步骤

### Phase 1: 核心导出功能 (30 min)

#### Step 1.1: 安装依赖
```bash
npm install client-zip
```

#### Step 1.2: 创建导出工具函数
**文件**: `src/lib/export.ts`

```typescript
import { downloadZip } from 'client-zip';

export interface ExportFile {
  name: string;  // 相对路径，如 "App.jsx"
  content: string;
}

// 将 VFS 文件转换为 ZIP 并下载
export async function downloadAsZip(
  files: Map<string, string>,
  projectName: string = 'component'
): Promise<void> {
  const entries: ExportFile[] = [];

  files.forEach((content, path) => {
    // 移除前导斜杠: "/App.jsx" → "App.jsx"
    const name = path.startsWith('/') ? path.slice(1) : path;
    entries.push({ name, content });
  });

  const blob = await downloadZip(entries).blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName}.zip`;
  link.click();

  URL.revokeObjectURL(url);
}

// 复制单个文件到剪贴板
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
```

#### Step 1.3: 创建下载按钮组件
**文件**: `src/components/DownloadButton.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileSystem } from '@/lib/contexts/file-system-context';
import { downloadAsZip } from '@/lib/export';

export function DownloadButton() {
  const { getAllFiles } = useFileSystem();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    const files = getAllFiles();

    if (files.size === 0) {
      // 可选: 显示 toast 提示没有文件
      return;
    }

    setIsDownloading(true);
    try {
      await downloadAsZip(files);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="ml-2">导出 ZIP</span>
    </Button>
  );
}
```

### Phase 2: UI 集成 (15 min)

#### Step 2.1: 添加到 HeaderActions
**文件**: `src/components/HeaderActions.tsx`

在现有按钮前添加 DownloadButton:

```tsx
import { DownloadButton } from './DownloadButton';

// 在 return 语句中，Tabs 后面添加
<div className="flex items-center gap-2">
  <DownloadButton />
  {/* 现有的项目选择器等 */}
</div>
```

### Phase 3: 增强功能 (可选，30 min)

#### Step 3.1: 文件预览弹窗
- 在代码标签页中，每个文件旁添加复制按钮
- 使用 lucide-react 的 `Copy` 图标
- 复制成功后显示 toast 反馈

#### Step 3.2: 导出选项
- 选择性导出 (勾选要导出的文件)
- 导出格式选择 (ZIP / 单文件)

#### Step 3.3: 包含 package.json
自动生成 package.json 包含必要依赖:
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.0.0"
  }
}
```

## 文件变更清单

| 文件 | 操作 | 描述 |
|------|------|------|
| `package.json` | 修改 | 添加 client-zip 依赖 |
| `src/lib/export.ts` | 新建 | 导出工具函数 |
| `src/components/DownloadButton.tsx` | 新建 | 下载按钮组件 |
| `src/components/HeaderActions.tsx` | 修改 | 集成下载按钮 |

## 验收标准

- [ ] 点击按钮下载 ZIP 文件
- [ ] ZIP 文件包含所有 VFS 中的文件
- [ ] 文件路径结构正确 (无前导斜杠)
- [ ] 空文件系统时按钮禁用或提示
- [ ] 下载过程中显示 loading 状态

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 大文件导出卡顿 | 添加进度指示，限制文件大小 |
| 浏览器不支持 Blob | 检测兼容性，提供降级方案 |
| 移动端下载问题 | 测试移动端行为 |

## 时间估算

- Phase 1 (核心): 30 min
- Phase 2 (UI): 15 min
- Phase 3 (增强): 30 min (可选)
- **总计: 45-75 min**
