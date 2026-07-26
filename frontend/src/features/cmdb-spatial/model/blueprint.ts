import {
  FACILITY_TYPES,
  type SpatialDocument,
  type SpatialElement,
  type SpatialElementType,
  type SpatialGeometry,
} from "./types";

export const SPATIAL_BLUEPRINT_FORMAT = "cwgsyw-spatial-blueprint";
export const SPATIAL_BLUEPRINT_VERSION = 1;
export const MAX_SPATIAL_BLUEPRINT_BYTES = 5 * 1024 * 1024;

const ELEMENT_TYPES: SpatialElementType[] = [
  "ROOM_OUTLINE",
  "WALL",
  "DOOR",
  "RACK_ROW",
  "RACK_SLOT",
  "AISLE",
  "ZONE",
  "FACILITY",
  "TEXT",
];
const ELEMENT_TYPE_SET = new Set<string>(ELEMENT_TYPES);
const FACILITY_TYPE_SET = new Set<string>(FACILITY_TYPES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SpatialBlueprintFile {
  format: typeof SPATIAL_BLUEPRINT_FORMAT;
  formatVersion: typeof SPATIAL_BLUEPRINT_VERSION;
  exportedAt: string;
  document: SpatialDocument;
}

export function createSpatialBlueprint(
  document: SpatialDocument,
): SpatialBlueprintFile {
  return {
    format: SPATIAL_BLUEPRINT_FORMAT,
    formatVersion: SPATIAL_BLUEPRINT_VERSION,
    exportedAt: new Date().toISOString(),
    document: sanitizeDocument(document),
  };
}

export function serializeSpatialBlueprint(document: SpatialDocument): string {
  return JSON.stringify(createSpatialBlueprint(document), null, 2);
}

export function parseSpatialBlueprint(source: string): SpatialDocument {
  let payload: unknown;
  try {
    payload = JSON.parse(source);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  const file = requireRecord(payload, "图纸文件");
  if (file.format !== SPATIAL_BLUEPRINT_FORMAT) {
    throw new Error("文件不是平台空间布局图纸");
  }
  if (file.formatVersion !== SPATIAL_BLUEPRINT_VERSION) {
    throw new Error(`不支持的图纸格式版本：${String(file.formatVersion)}`);
  }
  const document = validateDocument(file.document);
  return sanitizeDocument(document);
}

function validateDocument(value: unknown): SpatialDocument {
  const document = requireRecord(value, "图纸内容");
  if (document.schemaVersion !== 1) throw new Error("不支持的布局文档版本");
  const canvas = requireRecord(document.canvas, "画布");
  const logicalWidth = requireInteger(canvas.logicalWidth, "画布宽度", 100, 10000);
  const logicalHeight = requireInteger(canvas.logicalHeight, "画布高度", 100, 10000);
  if (!Array.isArray(document.elements)) throw new Error("图纸缺少元素列表");
  if (document.elements.length > 2000) throw new Error("图纸元素不能超过 2000 个");

  const ids = new Set<string>();
  const rackNames = new Set<string>();
  let outlineCount = 0;
  const elements = document.elements.map((value, index) => {
    const element = validateElement(value, index);
    if (ids.has(element.id)) throw new Error(`第 ${index + 1} 个元素的标识重复`);
    ids.add(element.id);
    if (element.type === "ROOM_OUTLINE") outlineCount += 1;
    if (element.type === "RACK_SLOT") {
      const name = element.name?.trim();
      if (!name) throw new Error(`第 ${index + 1} 个机柜位缺少编号`);
      if (rackNames.has(name)) throw new Error(`机柜位编号“${name}”重复`);
      rackNames.add(name);
    }
    return element;
  });
  if (outlineCount !== 1) throw new Error("图纸必须且只能包含一个机房外轮廓");
  validateDoorAttachments(elements);

  const result: SpatialDocument = {
    schemaVersion: 1,
    canvas: { logicalWidth, logicalHeight },
    elements,
  };
  if (canvas.gridSize !== undefined) {
    result.canvas.gridSize = requirePositiveNumber(canvas.gridSize, "网格大小");
  }
  if (canvas.backgroundColor !== undefined) {
    result.canvas.backgroundColor = requireString(canvas.backgroundColor, "画布背景色");
  }
  return result;
}

function validateElement(value: unknown, index: number): SpatialElement {
  const label = `第 ${index + 1} 个元素`;
  const element = requireRecord(value, label);
  const id = requireString(element.id, `${label}标识`);
  if (!UUID_PATTERN.test(id)) throw new Error(`${label}标识不是有效的 UUID`);
  const type = requireString(element.type, `${label}类型`);
  if (!ELEMENT_TYPE_SET.has(type)) throw new Error(`${label}类型不受支持`);
  const geometry = validateGeometry(element.geometry, label);
  const result: SpatialElement = { id, type: type as SpatialElementType, geometry };

  if (element.name !== undefined) result.name = requireString(element.name, `${label}名称`);
  if (element.text !== undefined) result.text = requireString(element.text, `${label}文字`);
  if (element.locked !== undefined) result.locked = requireBoolean(element.locked, `${label}锁定状态`);
  if (element.zIndex !== undefined) result.zIndex = requireFiniteNumber(element.zIndex, `${label}层级`);
  if (element.rack !== undefined) result.rack = validateRack(element.rack, label);
  if (element.zone !== undefined) result.zone = validateZone(element.zone, label);
  if (element.facility !== undefined) result.facility = validateFacility(element.facility, label);
  if (element.door !== undefined) result.door = validateDoor(element.door, label);
  return result;
}

function validateGeometry(value: unknown, label: string): SpatialGeometry {
  const geometry = requireRecord(value, `${label}几何信息`);
  const kind = requireString(geometry.kind, `${label}几何类型`);
  if (kind === "RECT") {
    const x = requireUnitNumber(geometry.x, `${label}横坐标`);
    const y = requireUnitNumber(geometry.y, `${label}纵坐标`);
    const width = requireUnitNumber(geometry.width, `${label}宽度`, true);
    const height = requireUnitNumber(geometry.height, `${label}高度`, true);
    if (x + width > 1.000001 || y + height > 1.000001) {
      throw new Error(`${label}超出画布范围`);
    }
    const result: Extract<SpatialGeometry, { kind: "RECT" }> = {
      kind,
      x,
      y,
      width,
      height,
    };
    if (geometry.rotation !== undefined) {
      const rotation = requireFiniteNumber(geometry.rotation, `${label}旋转角度`);
      if (rotation < 0 || rotation >= 360) throw new Error(`${label}旋转角度无效`);
      result.rotation = rotation;
    }
    return result;
  }
  if (kind !== "POLYGON" && kind !== "LINE") throw new Error(`${label}几何类型不受支持`);
  if (!Array.isArray(geometry.points)) throw new Error(`${label}缺少坐标点`);
  const minimum = kind === "POLYGON" ? 3 : 2;
  if (geometry.points.length < minimum) throw new Error(`${label}坐标点数量不足`);
  const points = geometry.points.map((point, pointIndex): [number, number] => {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error(`${label}第 ${pointIndex + 1} 个坐标点无效`);
    }
    return [
      requireUnitNumber(point[0], `${label}第 ${pointIndex + 1} 个横坐标`),
      requireUnitNumber(point[1], `${label}第 ${pointIndex + 1} 个纵坐标`),
    ];
  });
  return { kind, points };
}

function validateRack(value: unknown, label: string): NonNullable<SpatialElement["rack"]> {
  const rack = requireRecord(value, `${label}机柜位信息`);
  const result: NonNullable<SpatialElement["rack"]> = {};
  if (rack.rowCode !== undefined) result.rowCode = requireString(rack.rowCode, `${label}机柜列代码`);
  if (rack.positionNo !== undefined) result.positionNo = requireString(rack.positionNo, `${label}机柜位序号`);
  if (rack.slotState !== undefined && !["EMPTY", "RESERVED", "OCCUPIED", "DISABLED"].includes(String(rack.slotState))) {
    throw new Error(`${label}机柜位状态无效`);
  }
  result.slotState = "EMPTY";
  return result;
}

function validateZone(value: unknown, label: string): NonNullable<SpatialElement["zone"]> {
  const zone = requireRecord(value, `${label}区域信息`);
  const result: NonNullable<SpatialElement["zone"]> = {};
  if (zone.color !== undefined) result.color = requireString(zone.color, `${label}区域颜色`);
  if (zone.opacity !== undefined) result.opacity = requireUnitNumber(zone.opacity, `${label}区域透明度`);
  return result;
}

function validateFacility(value: unknown, label: string): NonNullable<SpatialElement["facility"]> {
  const facility = requireRecord(value, `${label}设施信息`);
  if (facility.facilityType === undefined) return {};
  const facilityType = requireString(facility.facilityType, `${label}设施类型`);
  if (!FACILITY_TYPE_SET.has(facilityType)) throw new Error(`${label}设施类型无效`);
  return { facilityType: facilityType as NonNullable<SpatialElement["facility"]>["facilityType"] };
}

function validateDoor(value: unknown, label: string): NonNullable<SpatialElement["door"]> {
  const door = requireRecord(value, `${label}门信息`);
  const result: NonNullable<SpatialElement["door"]> = {};
  if (door.edgeElementId !== undefined) result.edgeElementId = requireString(door.edgeElementId, `${label}挂接元素`);
  if (door.segmentIndex !== undefined) result.segmentIndex = requireInteger(door.segmentIndex, `${label}挂接边序号`, 0, Number.MAX_SAFE_INTEGER);
  if (door.position !== undefined) result.position = requireUnitNumber(door.position, `${label}挂接位置`);
  if (door.style !== undefined) {
    if (door.style !== "SINGLE" && door.style !== "DOUBLE") throw new Error(`${label}门样式无效`);
    result.style = door.style;
  }
  if (door.swing !== undefined) {
    if (door.swing !== "LEFT" && door.swing !== "RIGHT") throw new Error(`${label}开门方向无效`);
    result.swing = door.swing;
  }
  if (door.direction !== undefined) {
    if (door.direction !== "INWARD" && door.direction !== "OUTWARD") throw new Error(`${label}门朝向无效`);
    result.direction = door.direction;
  }
  return result;
}

function validateDoorAttachments(elements: SpatialElement[]) {
  const elementsById = new Map(elements.map((element) => [element.id, element]));
  elements.forEach((element) => {
    if (element.type !== "DOOR") return;
    const edge = element.door?.edgeElementId ? elementsById.get(element.door.edgeElementId) : undefined;
    if (!edge || (edge.type !== "WALL" && edge.type !== "ROOM_OUTLINE")) {
      throw new Error(`门“${element.name || element.id}”未挂接到有效墙体或外轮廓`);
    }
    if (edge.geometry.kind === "RECT") throw new Error(`门“${element.name || element.id}”挂接信息无效`);
    const edgeCount = edge.geometry.kind === "POLYGON" ? edge.geometry.points.length : edge.geometry.points.length - 1;
    const segmentIndex = element.door?.segmentIndex;
    if (segmentIndex === undefined || segmentIndex < 0 || segmentIndex >= edgeCount) {
      throw new Error(`门“${element.name || element.id}”挂接边序号无效`);
    }
  });
}

function sanitizeDocument(document: SpatialDocument): SpatialDocument {
  return {
    schemaVersion: 1,
    canvas: {
      logicalWidth: document.canvas.logicalWidth,
      logicalHeight: document.canvas.logicalHeight,
      ...(document.canvas.gridSize === undefined ? {} : { gridSize: document.canvas.gridSize }),
      ...(document.canvas.backgroundColor === undefined ? {} : { backgroundColor: document.canvas.backgroundColor }),
    },
    elements: document.elements.map(sanitizeElement),
  };
}

function sanitizeElement(element: SpatialElement): SpatialElement {
  const result: SpatialElement = {
    id: element.id,
    type: element.type,
    geometry: structuredClone(element.geometry),
  };
  if (element.name !== undefined) result.name = element.name;
  if (element.text !== undefined) result.text = element.text;
  if (element.locked !== undefined) result.locked = element.locked;
  if (element.zIndex !== undefined) result.zIndex = element.zIndex;
  if (element.rack !== undefined) result.rack = { ...element.rack, slotState: "EMPTY" };
  if (element.zone !== undefined) result.zone = { ...element.zone };
  if (element.facility !== undefined) result.facility = { ...element.facility };
  if (element.door !== undefined) result.door = { ...element.door };
  return result;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}格式无效`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}格式无效`);
  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label}格式无效`);
  return value;
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}必须是有效数字`);
  return value;
}

function requirePositiveNumber(value: unknown, label: string): number {
  const result = requireFiniteNumber(value, label);
  if (result <= 0) throw new Error(`${label}必须大于 0`);
  return result;
}

function requireInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  const result = requireFiniteNumber(value, label);
  if (!Number.isInteger(result) || result < minimum || result > maximum) throw new Error(`${label}超出允许范围`);
  return result;
}

function requireUnitNumber(value: unknown, label: string, positive = false): number {
  const result = requireFiniteNumber(value, label);
  if (result < 0 || result > 1 || (positive && result === 0)) throw new Error(`${label}超出允许范围`);
  return result;
}
