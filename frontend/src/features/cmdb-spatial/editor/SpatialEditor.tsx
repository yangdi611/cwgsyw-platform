"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlertTriangle,
  ArrowLeft,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Box,
  CheckCircle2,
  ChevronRight,
  Copy,
  ClipboardPaste,
  DoorOpen,
  Download,
  Grid3X3,
  ImageUp,
  Layers,
  Lock,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Send,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error";
import {
  getFacilityCandidates,
  getRackCandidates,
  getSpatialDraft,
  publishSpatialDraft,
  saveSpatialDraft,
  spatialQueryKeys,
  uploadReferenceImage,
  validateSpatialDraft,
} from "../api/spatial-api";
import {
  alignElements,
  createElement,
  cloneDocument,
  distributeElements,
  duplicateElements,
  generateRackRow,
  insertPointOnClosestEdge,
  moveElements,
  removeElement,
  removePoint,
  replaceElementGeometry,
  snapDoorToNearestEdge,
  updateElement,
  updateElementGeometry,
} from "../model/document";
import { elementLabel, viewportForDocument } from "../model/geometry";
import {
  MAX_SPATIAL_BLUEPRINT_BYTES,
  parseSpatialBlueprint,
  serializeSpatialBlueprint,
} from "../model/blueprint";
import {
  FACILITY_TYPE_LABELS,
  FACILITY_TYPES,
  type SpatialDocument,
  type SpatialElement,
  type SpatialElementType,
  type SpatialFacilityType,
  type SpatialLayoutVersion,
} from "../model/types";

// Konva creates browser canvas nodes; keep its editor stage out of the server render.
const SpatialEditorStage = dynamic(
  () =>
    import("./SpatialEditorStage").then((module) => module.SpatialEditorStage),
  {
    ssr: false,
    loading: () => <div className="h-full animate-pulse bg-v2-surface-soft" />,
  },
);

interface SpatialEditorProps {
  roomId: number;
  layoutId: number;
  canPublish: boolean;
}
type History = { undo: SpatialDocument[]; redo: SpatialDocument[] };
const PALETTE: Array<{
  type: SpatialElementType;
  label: string;
  icon: typeof Warehouse;
}> = [
  { type: "ROOM_OUTLINE", label: "外轮廓", icon: SquareDashedMousePointer },
  { type: "WALL", label: "墙体", icon: Layers },
  { type: "DOOR", label: "门", icon: DoorOpen },
  { type: "AISLE", label: "通道", icon: ChevronRight },
  { type: "ZONE", label: "区域", icon: Grid3X3 },
  { type: "FACILITY", label: "设施", icon: Wrench },
  { type: "TEXT", label: "文字", icon: Box },
];

export function SpatialEditor({
  roomId,
  layoutId,
  canPublish,
}: SpatialEditorProps) {
  const {
    data: draft,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: spatialQueryKeys.draft(layoutId),
    queryFn: () => getSpatialDraft(layoutId),
  });
  if (isLoading)
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-sm text-v2-muted">
        正在加载编辑草稿...
      </div>
    );
  if (isError)
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-sm text-v2-danger">
        <AlertTriangle className="h-8 w-8" />
        {getApiErrorMessage(error, "草稿加载失败")}
      </div>
    );
  if (!draft) return null;
  return (
    <SpatialEditorSession
      key={draft.versionId}
      roomId={roomId}
      layoutId={layoutId}
      canPublish={canPublish}
      draft={draft}
    />
  );
}

function SpatialEditorSession({
  roomId,
  layoutId,
  canPublish,
  draft,
}: SpatialEditorProps & { draft: SpatialLayoutVersion }) {
  const queryClient = useQueryClient();
  const viewportRef = useRef<HTMLDivElement>(null);
  const blueprintInputRef = useRef<HTMLInputElement>(null);
  const changeGeneration = useRef(0);
  const blueprintAwaitingConfirmation = useRef(false);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState({ scale: 1, x: 32, y: 32 });
  const [document, setDocument] = useState<SpatialDocument>(() =>
    cloneDocument(draft.document),
  );
  const [revision, setRevision] = useState(draft.revision);
  const [history, setHistory] = useState<History>({ undo: [], redo: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<SpatialElement[]>([]);
  const pasteCount = useRef(1);
  const [smartAlignment, setSmartAlignment] = useState(true);
  const [orthogonalSnap, setOrthogonalSnap] = useState(true);
  const [status, setStatus] = useState("已保存");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveCompletedTick, setSaveCompletedTick] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [validationText, setValidationText] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const fit = useCallback(() => {
    if (!viewportRef.current || !document) return;
    setViewport(
      viewportForDocument(
        document.canvas.logicalWidth,
        document.canvas.logicalHeight,
        viewportRef.current.clientWidth,
        viewportRef.current.clientHeight,
      ),
    );
  }, [document]);
  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      }),
    );
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    fit();
  }, [fit]);
  const selected = useMemo(
    () =>
      document?.elements.find((element) => element.id === selectedIds[0]) ||
      null,
    [document, selectedIds],
  );
  const markDirty = () => {
    changeGeneration.current += 1;
    setHasUnsavedChanges(true);
    setStatus("未保存");
  };
  const change = (next: SpatialDocument) => {
    setHistory((current) => ({
      undo: [...current.undo.slice(-49), cloneDocument(document)],
      redo: [],
    }));
    setDocument(next);
    markDirty();
  };
  const undo = () =>
    setHistory((current) => {
      const previous = current.undo.at(-1);
      if (!previous || !document) return current;
      setDocument(previous);
      markDirty();
      return {
        undo: current.undo.slice(0, -1),
        redo: [cloneDocument(document), ...current.redo],
      };
    });
  const redo = () =>
    setHistory((current) => {
      const next = current.redo[0];
      if (!next || !document) return current;
      setDocument(next);
      markDirty();
      return {
        undo: [...current.undo, cloneDocument(document)],
        redo: current.redo.slice(1),
      };
    });
  const persist = async () => {
    blueprintAwaitingConfirmation.current = false;
    const documentToSave = cloneDocument(document);
    const generation = changeGeneration.current;
    setStatus("保存中");
    const next = await saveSpatialDraft(layoutId, revision, documentToSave);
    const changedDuringSave = changeGeneration.current !== generation;
    setRevision(next.revision);
    setHasUnsavedChanges(changedDuringSave);
    setStatus(changedDuringSave ? "未保存" : "已保存");
    setHasConflict(false);
    setSaveCompletedTick((value) => value + 1);
    queryClient.setQueryData(spatialQueryKeys.draft(layoutId), next);
    return next.revision;
  };
  const save = useMutation({
    mutationFn: persist,
    onError: (reason) => {
      setStatus(getApiErrorMessage(reason, "保存失败"));
      setHasConflict(getApiErrorCode(reason) === "SPATIAL_DRAFT_CONFLICT");
    },
  });
  const validate = useMutation({
    mutationFn: async () => {
      await persist();
      return validateSpatialDraft(layoutId);
    },
    onSuccess: (result) =>
      setValidationText(
        result.valid
          ? result.warnings.length
            ? `校验通过，${result.warnings.length} 项提示`
            : "校验通过"
          : `发现 ${result.errors.length} 项阻断错误`,
      ),
    onError: (reason) =>
      setValidationText(getApiErrorMessage(reason, "保存或校验失败")),
  });
  const publish = useMutation({
    mutationFn: async () => {
      const nextRevision = await persist();
      return publishSpatialDraft(layoutId, nextRevision, publishNote);
    },
    onSuccess: () => {
      setPublishOpen(false);
      queryClient.invalidateQueries({
        queryKey: spatialQueryKeys.draft(layoutId),
      });
      queryClient.invalidateQueries({
        queryKey: spatialQueryKeys.published(roomId),
      });
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadReferenceImage(layoutId, file),
    onSuccess: (asset) => {
      if (!document) return;
      change({
        ...cloneDocument(document),
        reference: {
          assetId: asset.assetId,
          visibleInPublishedView: false,
          opacity: 0.35,
          locked: true,
          transform: { x: 0.05, y: 0.05, width: 0.9, height: 0.9, rotation: 0 },
        },
      });
    },
  });
  const reloadDraft = async () => {
    setStatus("正在重新载入草稿");
    try {
      const next = await getSpatialDraft(layoutId);
      queryClient.setQueryData(spatialQueryKeys.draft(layoutId), next);
      changeGeneration.current += 1;
      setDocument(cloneDocument(next.document));
      setRevision(next.revision);
      setHistory({ undo: [], redo: [] });
      setSelectedIds([]);
      setHasUnsavedChanges(false);
      setHasConflict(false);
      setStatus("已重新载入草稿");
    } catch (reason) {
      setStatus(getApiErrorMessage(reason, "重新载入草稿失败"));
    }
  };
  const downloadConflictSnapshot = () => {
    const payload = JSON.stringify({ layoutId, revision, document }, null, 2);
    const href = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    const link = window.document.createElement("a");
    link.href = href;
    link.download = `spatial-layout-${layoutId}-revision-${revision}-conflict.json`;
    link.click();
    URL.revokeObjectURL(href);
  };
  const exportBlueprint = () => {
    const href = URL.createObjectURL(
      new Blob([serializeSpatialBlueprint(document)], {
        type: "application/json",
      }),
    );
    const link = window.document.createElement("a");
    const date = new Date().toLocaleDateString("sv-SE");
    link.href = href;
    link.download = `机房图纸-${date}.json`;
    link.click();
    URL.revokeObjectURL(href);
    setStatus("图纸已导出（不包含 CI 绑定和参考图）");
  };
  const importBlueprint = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > MAX_SPATIAL_BLUEPRINT_BYTES) {
      setValidationText("图纸导入失败：文件不能超过 5 MB");
      return;
    }
    try {
      const imported = parseSpatialBlueprint(await file.text());
      if (
        !window.confirm(
          "导入将替换当前草稿中的全部图纸元素，但不会导入 CI 绑定和参考图。替换后可使用撤销恢复，是否继续？",
        )
      ) {
        setStatus("已取消导入图纸");
        return;
      }
      change(imported);
      blueprintAwaitingConfirmation.current = true;
      setSelectedIds([]);
      setValidationText(
        `图纸导入成功，共 ${imported.elements.length} 个元素；CI 绑定和参考图未导入，请确认后保存。`,
      );
    } catch (reason) {
      setValidationText(
        `图纸导入失败：${reason instanceof Error ? reason.message : "无法读取文件"}`,
      );
    }
  };
  useEffect(() => {
    if (
      !hasUnsavedChanges ||
      hasConflict ||
      blueprintAwaitingConfirmation.current ||
      save.isPending ||
      validate.isPending ||
      publish.isPending
    )
      return;
    const timer = window.setTimeout(() => save.mutate(), 900);
    return () => window.clearTimeout(timer);
  }, [
    document,
    hasConflict,
    hasUnsavedChanges,
    publish.isPending,
    save,
    saveCompletedTick,
    validate.isPending,
  ]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);
  const confirmLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      !hasUnsavedChanges ||
      window.confirm("当前布局仍有未保存内容，确定离开编辑器吗？")
    )
      return;
    event.preventDefault();
  };
  const add = (type: SpatialElementType) => {
    if (
      type === "DOOR" &&
      !document.elements.some(
        (element) => element.type === "WALL" || element.type === "ROOM_OUTLINE",
      )
    ) {
      setValidationText("请先添加机房外轮廓或墙体，再添加门");
      return;
    }
    const created = createElement(type, document.elements.length);
    if (
      type === "ROOM_OUTLINE" &&
      document.elements.some((element) => element.type === "ROOM_OUTLINE")
    ) {
      setValidationText("布局只能保留一个机房外轮廓");
      return;
    }
    const next = {
      ...cloneDocument(document),
      elements: [...document.elements, created],
    };
    change(
      type === "DOOR" ? snapDoorToNearestEdge(next, created.id, {}) : next,
    );
    setSelectedIds([created.id]);
  };
  const select = (id: string, additive: boolean) =>
    setSelectedIds((current) =>
      additive
        ? current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        : [id],
    );
  const align = (axis: Parameters<typeof alignElements>[2]) =>
    change(alignElements(document, selectedIds, axis));
  const distribute = (axis: "horizontal" | "vertical") =>
    change(distributeElements(document, selectedIds, axis));
  const copySelected = () => {
    const copied = cloneDocument({
      ...document,
      elements: document.elements.filter(
        (element) =>
          selectedIds.includes(element.id) &&
          !element.locked &&
          element.type !== "ROOM_OUTLINE",
      ),
    }).elements;
    if (!copied.length) return;
    setClipboard(copied);
    pasteCount.current = 1;
    setStatus(`已复制 ${copied.length} 个元素`);
  };
  const paste = () => {
    if (!clipboard.length) return;
    const result = duplicateElements(document, clipboard, 0.02 * pasteCount.current);
    if (!result.ids.length) return;
    change(result.document);
    setSelectedIds(result.ids);
    pasteCount.current += 1;
  };
  const removeSelected = () => {
    if (!selectedIds.length) return;
    change({
      ...cloneDocument(document),
      elements: document.elements.filter(
        (element) =>
          !selectedIds.includes(element.id) ||
          element.locked ||
          element.type === "ROOM_OUTLINE",
      ),
    });
    setSelectedIds([]);
  };
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const copied = cloneDocument({
          ...document,
          elements: document.elements.filter(
            (element) =>
              selectedIds.includes(element.id) &&
              !element.locked &&
              element.type !== "ROOM_OUTLINE",
          ),
        }).elements;
        if (!copied.length) return;
        event.preventDefault();
        setClipboard(copied);
        pasteCount.current = 1;
        setStatus(`已复制 ${copied.length} 个元素`);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        if (!clipboard.length) return;
        event.preventDefault();
        const result = duplicateElements(
          document,
          clipboard,
          0.02 * pasteCount.current,
        );
        if (!result.ids.length) return;
        setHistory((current) => ({
          undo: [...current.undo.slice(-49), cloneDocument(document)],
          redo: [],
        }));
        setDocument(result.document);
        markDirty();
        setSelectedIds(result.ids);
        pasteCount.current += 1;
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (
        !selectedIds.some((id) => {
          const element = document.elements.find((item) => item.id === id);
          return element && !element.locked && element.type !== "ROOM_OUTLINE";
        })
      )
        return;
      event.preventDefault();
      setHistory((current) => ({
        undo: [...current.undo.slice(-49), cloneDocument(document)],
        redo: [],
      }));
      setDocument({
        ...cloneDocument(document),
        elements: document.elements.filter(
          (element) =>
            !selectedIds.includes(element.id) ||
            element.locked ||
            element.type === "ROOM_OUTLINE",
        ),
      });
      changeGeneration.current += 1;
      setHasUnsavedChanges(true);
      setStatus("未保存");
      setSelectedIds([]);
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [clipboard, document, selectedIds]);
  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col md:-m-6">
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-v2-border bg-v2-surface px-4 py-2">
        <Link
          href={`/cmdb/spatial/rooms/${roomId}`}
          onClick={confirmLeave}
          className="inline-flex h-8 w-8 items-center justify-center rounded-v2-sm text-v2-muted hover:bg-v2-surface-hover"
          title="返回查看器"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-28 flex-1">
          <p className="text-sm font-semibold text-v2-fg">编辑空间布局</p>
          <p className="text-xs text-v2-muted">{status}</p>
        </div>
        {hasConflict && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadConflictSnapshot}
            >
              导出当前 JSON
            </Button>
            <Button variant="outline" size="sm" onClick={reloadDraft}>
              重新载入草稿
            </Button>
          </>
        )}
        <ToolButton label="撤销" disabled={!history.undo.length} onClick={undo}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="重做" disabled={!history.redo.length} onClick={redo}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="缩小"
          onClick={() =>
            setViewport((v) => ({ ...v, scale: Math.max(0.1, v.scale - 0.1) }))
          }
        >
          <Minus className="h-4 w-4" />
        </ToolButton>
        <span className="w-10 text-center text-xs text-v2-muted">
          {Math.round(viewport.scale * 100)}%
        </span>
        <ToolButton
          label="放大"
          onClick={() =>
            setViewport((v) => ({ ...v, scale: Math.min(4, v.scale + 0.1) }))
          }
        >
          <Plus className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="适配画布" onClick={fit}>
          <RotateCcw className="h-4 w-4" />
        </ToolButton>
        <input
          ref={blueprintInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="选择空间布局图纸文件"
          onChange={importBlueprint}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => blueprintInputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          导入图纸
        </Button>
        <Button variant="outline" size="sm" onClick={exportBlueprint}>
          <Download className="mr-1.5 h-4 w-4" />
          导出图纸
        </Button>
        {selectedIds.length > 1 && (
          <>
            <ToolButton label="左对齐" onClick={() => align("left")}>
              <AlignLeft className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="水平居中" onClick={() => align("center")}>
              <AlignCenterHorizontal className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="右对齐" onClick={() => align("right")}>
              <AlignRight className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="顶部对齐" onClick={() => align("top")}>
              <AlignStartVertical className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="垂直居中" onClick={() => align("middle")}>
              <AlignCenterVertical className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="底部对齐" onClick={() => align("bottom")}>
              <AlignEndVertical className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              label="水平等距"
              onClick={() => distribute("horizontal")}
            >
              <BetweenHorizontalEnd className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="垂直等距" onClick={() => distribute("vertical")}>
              <BetweenVerticalEnd className="h-4 w-4" />
            </ToolButton>
          </>
        )}
        <ToolButton
          label="复制所选元素"
          disabled={
            !selectedIds.some((id) => {
              const element = document.elements.find((item) => item.id === id);
              return element && !element.locked && element.type !== "ROOM_OUTLINE";
            })
          }
          onClick={copySelected}
        >
          <Copy className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="粘贴元素"
          disabled={!clipboard.length}
          onClick={paste}
        >
          <ClipboardPaste className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="删除所选元素"
          disabled={
            !selectedIds.some((id) => {
              const element = document.elements.find((item) => item.id === id);
              return (
                element && !element.locked && element.type !== "ROOM_OUTLINE"
              );
            })
          }
          onClick={removeSelected}
        >
          <Trash2 className="h-4 w-4" />
        </ToolButton>
        <Button
          variant="outline"
          size="sm"
          onClick={() => validate.mutate()}
          disabled={validate.isPending}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          校验
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          <Save className="mr-1.5 h-4 w-4" />
          保存
        </Button>
        {canPublish && (
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Send className="mr-1.5 h-4 w-4" />
            发布
          </Button>
        )}
      </header>
      {validationText && (
        <div className="flex items-center justify-between border-b border-v2-border bg-v2-surface-soft px-4 py-2 text-sm">
          <span>{validationText}</span>
          <button onClick={() => setValidationText(null)} title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-52 shrink-0 border-r border-v2-border bg-v2-surface p-3 lg:block">
          <p className="mb-2 text-xs font-medium text-v2-muted">组件库</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTE.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => add(type)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-v2-sm border border-v2-border text-xs text-v2-fg hover:bg-v2-surface-hover"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-v2-border pt-3">
            <p className="text-xs font-medium text-v2-muted">绘图辅助</p>
            <div className="flex items-center justify-between gap-2 text-xs text-v2-fg">
              <span>智能对齐</span>
              <Switch
                size="sm"
                checked={smartAlignment}
                onCheckedChange={setSmartAlignment}
                aria-label="智能对齐"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-v2-fg">
              <span>正交吸附</span>
              <Switch
                size="sm"
                checked={orthogonalSnap}
                onCheckedChange={setOrthogonalSnap}
                aria-label="正交吸附"
              />
            </div>
          </div>
          <RackRowForm
            document={document}
            onGenerate={(items) =>
              change({
                ...cloneDocument(document),
                elements: [...document.elements, ...items],
              })
            }
          />
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-v2-muted">
            <ImageUp className="h-4 w-4" />
            上传参考图
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <ReferenceControls document={document} onChange={change} />
        </aside>
        <section
          ref={viewportRef}
          role="region"
          aria-label="机房空间布局编辑画布"
          className="min-w-0 flex-1 overflow-hidden bg-v2-surface"
        >
          <SpatialEditorStage
            document={document}
            referenceImageUrl={
              document.reference?.assetId
                ? `/api/cmdb/spatial/assets/${document.reference.assetId}/content`
                : undefined
            }
            width={size.width}
            height={size.height}
            scale={viewport.scale}
            position={{ x: viewport.x, y: viewport.y }}
            selectedIds={selectedIds}
            smartAlignment={smartAlignment}
            orthogonalSnap={orthogonalSnap}
            onPositionChange={(position) =>
              setViewport((current) => ({ ...current, ...position }))
            }
            onSelect={select}
            onClearSelection={() => setSelectedIds([])}
            onMove={(id, geometry) =>
              change(
                document.elements.find((element) => element.id === id)?.type ===
                  "DOOR"
                  ? snapDoorToNearestEdge(document, id, geometry)
                  : updateElementGeometry(document, id, geometry),
              )
            }
            onMultiMove={(anchorId, geometry) => {
              const anchor = document.elements.find(
                (element) => element.id === anchorId,
              );
              if (
                anchor?.geometry.kind !== "RECT" ||
                geometry.x === undefined ||
                geometry.y === undefined
              )
                return;
              change(
                moveElements(
                  document,
                  selectedIds,
                  geometry.x - anchor.geometry.x,
                  geometry.y - anchor.geometry.y,
                ),
              );
            }}
            onPointsChange={(id, pointIndex, point) => {
              const element = document.elements.find((item) => item.id === id);
              if (
                element?.geometry.kind !== "POLYGON" &&
                element?.geometry.kind !== "LINE"
              )
                return;
              const points = [...element.geometry.points];
              points[pointIndex] = point;
              change(
                replaceElementGeometry(document, id, {
                  ...element.geometry,
                  points,
                }),
              );
            }}
            onInsertPoint={(id, point) =>
              change(insertPointOnClosestEdge(document, id, point))
            }
            onRemovePoint={(id, pointIndex) =>
              change(removePoint(document, id, pointIndex))
            }
            onReferenceMove={(transform) =>
              change({
                ...cloneDocument(document),
                reference: { ...document.reference, transform },
              })
            }
          />
        </section>
        <aside className="hidden w-80 shrink-0 border-l border-v2-border bg-v2-surface lg:block">
          <PropertiesPanel
            element={selected}
            selectedElements={document.elements.filter((element) =>
              selectedIds.includes(element.id),
            )}
            document={document}
            layoutId={layoutId}
            onChange={change}
            onDelete={() => {
              if (selected) {
                change(removeElement(document, selected.id));
                setSelectedIds((current) =>
                  current.filter((id) => id !== selected.id),
                );
              }
            }}
          />
        </aside>
      </main>
      {publishOpen && (
        <PublishDialog
          note={publishNote}
          onNote={setPublishNote}
          pending={publish.isPending}
          error={publish.error}
          onCancel={() => setPublishOpen(false)}
          onConfirm={() => publish.mutate()}
        />
      )}
    </div>
  );
}

function ToolButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button variant="ghost" size="icon" title={label} {...props}>
      {children}
    </Button>
  );
}
function RackRowForm({
  document,
  onGenerate,
}: {
  document: SpatialDocument;
  onGenerate: (items: SpatialElement[]) => void;
}) {
  const [code, setCode] = useState("F");
  const [count, setCount] = useState(9);
  const [slotWidth, setSlotWidth] = useState(4);
  const [slotHeight, setSlotHeight] = useState(8);
  const [gap, setGap] = useState(1);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "vertical",
  );
  const [numbering, setNumbering] = useState<"ascending" | "descending">(
    "ascending",
  );
  const generate = () => {
    try {
      onGenerate(
        generateRackRow(document, {
          rowCode: code,
          count,
          startNo: 1,
          padding: 2,
          orientation,
          numbering,
          slotState: "EMPTY",
          slotWidth: slotWidth / 100,
          slotHeight: slotHeight / 100,
          gap: gap / 100,
        }),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "机柜列生成失败");
    }
  };
  return (
    <div className="mt-4 space-y-2 border-t border-v2-border pt-3">
      <p className="text-xs font-medium text-v2-muted">机柜列生成</p>
      <div className="flex gap-2">
        <Input
          className="h-8"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label="机柜列代码"
        />
        <Input
          className="h-8"
          type="number"
          min={1}
          max={200}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          aria-label="机柜数量"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-v2-muted">
          宽度 %
          <Input
            className="mt-1 h-8"
            type="number"
            min={0.5}
            max={50}
            step={0.1}
            value={slotWidth}
            onChange={(event) => setSlotWidth(Number(event.target.value))}
            aria-label="批量机柜宽度"
          />
        </label>
        <label className="text-xs text-v2-muted">
          高度 %
          <Input
            className="mt-1 h-8"
            type="number"
            min={0.5}
            max={50}
            step={0.1}
            value={slotHeight}
            onChange={(event) => setSlotHeight(Number(event.target.value))}
            aria-label="批量机柜高度"
          />
        </label>
        <label className="text-xs text-v2-muted">
          间距 %
          <Input
            className="mt-1 h-8"
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={gap}
            onChange={(event) => setGap(Number(event.target.value))}
            aria-label="批量机柜间距"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-v2-muted">
          排列方向
          <select
            className="mt-1 h-8 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm text-v2-fg"
            value={orientation}
            onChange={(event) =>
              setOrientation(event.target.value as "horizontal" | "vertical")
            }
            aria-label="机柜排列方向"
          >
            <option value="vertical">纵向</option>
            <option value="horizontal">横向</option>
          </select>
        </label>
        <label className="text-xs text-v2-muted">
          编号顺序
          <select
            className="mt-1 h-8 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm text-v2-fg"
            value={numbering}
            onChange={(event) =>
              setNumbering(event.target.value as "ascending" | "descending")
            }
            aria-label="机柜编号顺序"
          >
            <option value="ascending">正序</option>
            <option value="descending">倒序</option>
          </select>
        </label>
      </div>
      <Button className="w-full" variant="outline" size="sm" onClick={generate}>
        <Warehouse className="mr-1.5 h-4 w-4" />
        生成机柜位
      </Button>
    </div>
  );
}
function ReferenceControls({
  document,
  onChange,
}: {
  document: SpatialDocument;
  onChange: (document: SpatialDocument) => void;
}) {
  const reference = document.reference;
  if (!reference?.assetId) return null;
  const update = (patch: Partial<NonNullable<SpatialDocument["reference"]>>) =>
    onChange({
      ...cloneDocument(document),
      reference: { ...reference, ...patch },
    });
  return (
    <div className="mt-4 space-y-3 border-t border-v2-border pt-3">
      <p className="text-xs font-medium text-v2-muted">参考图</p>
      <label className="flex items-center justify-between gap-2 text-xs text-v2-fg">
        <span>在已发布视图显示</span>
        <input
          aria-label="在已发布视图显示参考图"
          type="checkbox"
          checked={reference.visibleInPublishedView === true}
          onChange={(event) =>
            update({ visibleInPublishedView: event.target.checked })
          }
        />
      </label>
      <label
        className="block text-xs text-v2-fg"
        htmlFor="spatial-reference-opacity"
      >
        透明度 {Math.round((reference.opacity ?? 0.35) * 100)}%
        <input
          id="spatial-reference-opacity"
          aria-label="参考图透明度"
          className="mt-1 w-full"
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          value={reference.opacity ?? 0.35}
          onChange={(event) => update({ opacity: Number(event.target.value) })}
        />
      </label>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => update({ locked: !reference.locked })}
      >
        {reference.locked ? (
          <Unlock className="mr-1.5 h-4 w-4" />
        ) : (
          <Lock className="mr-1.5 h-4 w-4" />
        )}
        {reference.locked ? "解除参考图锁定" : "锁定参考图"}
      </Button>
    </div>
  );
}
function PropertiesPanel({
  element,
  selectedElements,
  document,
  layoutId,
  onChange,
  onDelete,
}: {
  element: SpatialElement | null;
  selectedElements: SpatialElement[];
  document: SpatialDocument;
  layoutId: number;
  onChange: (document: SpatialDocument) => void;
  onDelete: () => void;
}) {
  const { data: rackCandidates = [] } = useQuery({
    queryKey: ["cmdb", "spatial", "rack-candidates", layoutId],
    queryFn: () => getRackCandidates(layoutId),
    enabled: element?.type === "RACK_SLOT",
  });
  const { data: facilityCandidates = [] } = useQuery({
    queryKey: ["cmdb", "spatial", "facility-candidates", layoutId],
    queryFn: () => getFacilityCandidates(layoutId),
    enabled: element?.type === "FACILITY",
  });
  if (!element)
    return (
      <div className="p-4 text-sm text-v2-muted">
        选择机柜、设施或区域编辑属性。
      </div>
    );
  const candidates =
    element.type === "RACK_SLOT" ? rackCandidates : facilityCandidates;
  const availableCandidates = candidates.filter(
    (candidate) =>
      !candidate.bound ||
      candidate.ciInstanceId === element.binding?.ciInstanceId,
  );
  const onlyRacks =
    selectedElements.length > 1 &&
    selectedElements.every(
      (item) => item.type === "RACK_SLOT" && item.geometry.kind === "RECT",
    );
  const bind = (value: string) =>
    onChange(
      updateElement(document, element.id, {
        binding: value ? { ciInstanceId: Number(value) } : undefined,
        rack:
          element.type === "RACK_SLOT"
            ? { ...element.rack, slotState: value ? "OCCUPIED" : "EMPTY" }
            : element.rack,
      }),
    );
  const changeFacilityType = (facilityType: SpatialFacilityType) =>
    onChange(
      updateElement(document, element.id, {
        facility: { ...element.facility, facilityType },
        name:
          element.name ===
          FACILITY_TYPE_LABELS[element.facility?.facilityType || "GENERAL"]
            ? FACILITY_TYPE_LABELS[facilityType]
            : element.name,
      }),
    );
  return (
    <div className="space-y-4 overflow-y-auto p-4">
      {onlyRacks ? (
        <>
          <div>
            <p className="text-xs text-v2-muted">批量选择</p>
            <p className="font-semibold text-v2-fg">
              已选 {selectedElements.length} 个机柜
            </p>
          </div>
          <BatchRackDimensionControls
            document={document}
            elements={selectedElements}
            onChange={onChange}
          />
        </>
      ) : (
        <>
          <div>
            <p className="text-xs text-v2-muted">{element.type}</p>
            <p className="font-semibold text-v2-fg">{elementLabel(element)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spatial-element-name">名称</Label>
            <Input
              id="spatial-element-name"
              value={element.name || ""}
              onChange={(event) =>
                onChange(
                  updateElement(document, element.id, {
                    name: event.target.value,
                  }),
                )
              }
            />
          </div>
          {element.type === "ROOM_OUTLINE" && (
            <p className="text-xs leading-5 text-v2-muted">
              拖动四角可扩大或缩小外轮廓，双击边线可增加顶点。
            </p>
          )}
          {element.type === "ZONE" && (
            <section className="space-y-3">
              <Label>区域样式</Label>
              <div className="flex items-center gap-2">
                <input
                  aria-label="区域颜色"
                  className="h-9 w-12 cursor-pointer rounded-v2-sm border border-v2-border bg-v2-surface p-1"
                  type="color"
                  value={element.zone?.color || "#a855f7"}
                  onChange={(event) =>
                    onChange(
                      updateElement(document, element.id, {
                        zone: { ...element.zone, color: event.target.value },
                      }),
                    )
                  }
                />
                <span className="text-xs text-v2-muted">填充颜色</span>
              </div>
              <label className="block text-xs text-v2-muted">
                透明度 {Math.round((element.zone?.opacity ?? 0.18) * 100)}%
                <input
                  aria-label="区域透明度"
                  className="mt-1 w-full"
                  type="range"
                  min="0.05"
                  max="0.6"
                  step="0.05"
                  value={element.zone?.opacity ?? 0.18}
                  onChange={(event) =>
                    onChange(
                      updateElement(document, element.id, {
                        zone: {
                          ...element.zone,
                          opacity: Number(event.target.value),
                        },
                      }),
                    )
                  }
                />
              </label>
            </section>
          )}
          {element.type === "FACILITY" && (
            <div className="space-y-2">
              <Label htmlFor="spatial-facility-type">设施类型</Label>
              <select
                id="spatial-facility-type"
                className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm"
                value={element.facility?.facilityType || "GENERAL"}
                onChange={(event) =>
                  changeFacilityType(event.target.value as SpatialFacilityType)
                }
              >
                {FACILITY_TYPES.map((facilityType) => (
                  <option key={facilityType} value={facilityType}>
                    {FACILITY_TYPE_LABELS[facilityType]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {element.type !== "ROOM_OUTLINE" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                onChange(
                  updateElement(document, element.id, {
                    locked: !element.locked,
                  }),
                )
              }
            >
              {element.locked ? (
                <Unlock className="mr-1.5 h-4 w-4" />
              ) : (
                <Lock className="mr-1.5 h-4 w-4" />
              )}
              {element.locked ? "解除锁定" : "锁定元素"}
            </Button>
          )}
          {element.type === "TEXT" && (
            <div className="space-y-2">
              <Label htmlFor="spatial-element-text">文字</Label>
              <Textarea
                id="spatial-element-text"
                value={element.text || ""}
                onChange={(event) =>
                  onChange(
                    updateElement(document, element.id, {
                      text: event.target.value,
                    }),
                  )
                }
              />
            </div>
          )}
          {element.type === "RACK_SLOT" && (
            <RackDimensionControls
              document={document}
              element={element}
              onChange={onChange}
            />
          )}
          {(element.type === "RACK_SLOT" || element.type === "FACILITY") && (
            <div className="space-y-2">
              <Label htmlFor="spatial-ci-binding">CI 绑定</Label>
              <select
                id="spatial-ci-binding"
                className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm"
                value={element.binding?.ciInstanceId || ""}
                onChange={(event) => bind(event.target.value)}
              >
                <option value="">不绑定</option>
                {availableCandidates.map((candidate) => (
                  <option
                    key={candidate.ciInstanceId}
                    value={candidate.ciInstanceId}
                  >
                    {candidate.name}（{candidate.status || "未知状态"}）
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={element.type === "ROOM_OUTLINE"}
          >
            <X className="mr-1.5 h-4 w-4" />
            删除元素
          </Button>
        </>
      )}
    </div>
  );
}

function RackDimensionControls({
  document,
  element,
  onChange,
}: {
  document: SpatialDocument;
  element: SpatialElement;
  onChange: (document: SpatialDocument) => void;
}) {
  if (element.geometry.kind !== "RECT") return null;
  const update = (width: number, height: number) =>
    onChange(updateElementGeometry(document, element.id, { width, height }));
  const widthPercent = Number((element.geometry.width * 100).toFixed(1));
  const heightPercent = Number((element.geometry.height * 100).toFixed(1));
  return (
    <section className="space-y-2">
      <Label>机柜尺寸</Label>
      <div className="grid grid-cols-3 gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update(0.025, 0.055)}
        >
          紧凑
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update(0.04, 0.08)}
        >
          标准
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update(0.055, 0.11)}
        >
          加大
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-v2-muted">
          宽度 %
          <Input
            aria-label="机柜宽度"
            className="mt-1 h-8"
            type="number"
            min="0.5"
            max="50"
            step="0.1"
            value={widthPercent}
            onChange={(event) =>
              update(
                Math.max(0.005, Number(event.target.value) / 100),
                element.geometry.kind === "RECT"
                  ? element.geometry.height
                  : 0.08,
              )
            }
          />
        </label>
        <label className="text-xs text-v2-muted">
          高度 %
          <Input
            aria-label="机柜高度"
            className="mt-1 h-8"
            type="number"
            min="0.5"
            max="50"
            step="0.1"
            value={heightPercent}
            onChange={(event) =>
              update(
                element.geometry.kind === "RECT"
                  ? element.geometry.width
                  : 0.04,
                Math.max(0.005, Number(event.target.value) / 100),
              )
            }
          />
        </label>
      </div>
    </section>
  );
}

function BatchRackDimensionControls({
  document,
  elements,
  onChange,
}: {
  document: SpatialDocument;
  elements: SpatialElement[];
  onChange: (document: SpatialDocument) => void;
}) {
  const [axis, setAxis] = useState<"horizontal" | "vertical">("vertical");
  const [gapPercent, setGapPercent] = useState(1);
  const first = elements[0].geometry;
  if (first.kind !== "RECT") return null;
  const update = (width: number, height: number) => {
    const ids = new Set(elements.map((element) => element.id));
    const next = cloneDocument(document);
    next.elements = next.elements.map((element) =>
      ids.has(element.id) && element.geometry.kind === "RECT"
        ? { ...element, geometry: { ...element.geometry, width, height } }
        : element,
    );
    onChange(next);
  };
  const applyGap = () => {
    const selected = elements.filter(
      (
        element,
      ): element is SpatialElement & {
        geometry: Extract<SpatialElement["geometry"], { kind: "RECT" }>;
      } => element.geometry.kind === "RECT",
    );
    const sorted = [...selected].sort((left, right) =>
      axis === "horizontal"
        ? left.geometry.x - right.geometry.x
        : left.geometry.y - right.geometry.y,
    );
    if (sorted.length < 2) return;
    const start =
      axis === "horizontal" ? sorted[0].geometry.x : sorted[0].geometry.y;
    const occupied = sorted.reduce(
      (sum, element) =>
        sum +
        (axis === "horizontal"
          ? element.geometry.width
          : element.geometry.height),
      0,
    );
    const gap = Math.min(
      Math.max(0, gapPercent / 100),
      Math.max(0, (1 - start - occupied) / (sorted.length - 1)),
    );
    const positions = new Map<string, number>();
    let cursor = start;
    sorted.forEach((element) => {
      positions.set(element.id, cursor);
      cursor +=
        (axis === "horizontal"
          ? element.geometry.width
          : element.geometry.height) + gap;
    });
    const next = cloneDocument(document);
    next.elements = next.elements.map((element) => {
      const position = positions.get(element.id);
      if (position === undefined || element.geometry.kind !== "RECT")
        return element;
      return {
        ...element,
        geometry:
          axis === "horizontal"
            ? { ...element.geometry, x: position }
            : { ...element.geometry, y: position },
      };
    });
    onChange(next);
  };
  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <Label>统一机柜尺寸</Label>
        <div className="grid grid-cols-3 gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update(0.025, 0.055)}
          >
            紧凑
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update(0.04, 0.08)}
          >
            标准
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update(0.055, 0.11)}
          >
            加大
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-v2-muted">
            宽度 %
            <Input
              aria-label="批量机柜宽度调整"
              className="mt-1 h-8"
              type="number"
              min="0.5"
              max="50"
              step="0.1"
              value={Number((first.width * 100).toFixed(1))}
              onChange={(event) =>
                update(
                  Math.max(0.005, Number(event.target.value) / 100),
                  first.height,
                )
              }
            />
          </label>
          <label className="text-xs text-v2-muted">
            高度 %
            <Input
              aria-label="批量机柜高度调整"
              className="mt-1 h-8"
              type="number"
              min="0.5"
              max="50"
              step="0.1"
              value={Number((first.height * 100).toFixed(1))}
              onChange={(event) =>
                update(
                  first.width,
                  Math.max(0.005, Number(event.target.value) / 100),
                )
              }
            />
          </label>
        </div>
      </div>
      <div className="space-y-2 border-t border-v2-border pt-3">
        <Label>统一机柜间距</Label>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <select
            aria-label="批量机柜间距方向"
            className="h-8 rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm"
            value={axis}
            onChange={(event) =>
              setAxis(event.target.value as "horizontal" | "vertical")
            }
          >
            <option value="vertical">纵向</option>
            <option value="horizontal">横向</option>
          </select>
          <Input
            aria-label="批量机柜间距调整"
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={gapPercent}
            onChange={(event) => setGapPercent(Number(event.target.value))}
          />
          <Button type="button" variant="outline" size="sm" onClick={applyGap}>
            应用
          </Button>
        </div>
        <p className="text-xs text-v2-muted">
          按所选机柜在该方向的顺序排列，超出画布时自动取可用最大间距。
        </p>
      </div>
    </section>
  );
}
function PublishDialog({
  note,
  onNote,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  note: string;
  onNote: (note: string) => void;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-v2-md border border-v2-border bg-v2-surface p-5 shadow-v2-lg"
      >
        <h2 className="text-base font-semibold text-v2-fg">发布空间布局</h2>
        <p className="mt-1 text-sm text-v2-muted">
          发布后当前版本不可修改，后续编辑会基于此版本创建新草稿。
        </p>
        <Label htmlFor="spatial-publish-note" className="mt-4 block">
          版本说明
        </Label>
        <Textarea
          id="spatial-publish-note"
          className="mt-2"
          value={note}
          onChange={(event) => onNote(event.target.value)}
          maxLength={500}
        />
        {Boolean(error) && (
          <p className="mt-2 text-sm text-v2-danger">
            {getApiErrorMessage(error, "发布失败，请先修复校验错误")}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "发布中..." : "确认发布"}
          </Button>
        </div>
      </div>
    </div>
  );
}
