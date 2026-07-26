package com.cwgsyw.platform.module.cmdb.spatial.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialAssetVO;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialAsset;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialVersionAsset;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialAssetMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialLayoutMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialVersionAssetMapper;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Reference-image lifecycle with content sniffing and DB/object-store compensation. */
@Service
@RequiredArgsConstructor
public class SpatialAssetService {
    static final long MAX_BYTES = 20L * 1024 * 1024;
    static final long MAX_PIXELS = 40_000_000L;
    private final SpatialAssetMapper assetMapper;
    private final SpatialVersionAssetMapper versionAssetMapper;
    private final SpatialLayoutMapper layoutMapper;
    private final SpatialAssetStorage storage;
    private final AuditLogMapper auditLogMapper;

    @Transactional
    public SpatialAssetVO uploadReference(Long layoutId, MultipartFile file, String tenantId, Long operatorId) {
        requireLayout(layoutId, tenantId);
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("SPATIAL_ASSET_EMPTY", "请选择参考图文件");
        if (file.getSize() > MAX_BYTES) throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "SPATIAL_ASSET_TOO_LARGE", "参考图不能超过 20MB");
        byte[] content = read(file);
        ImageInfo image = inspect(content);
        if ((long) image.width * image.height > MAX_PIXELS) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "SPATIAL_ASSET_PIXELS_TOO_LARGE", "参考图像素数量超出限制");
        }
        String hash = sha256(content);
        SpatialAsset duplicate = assetMapper.selectOne(new LambdaQueryWrapper<SpatialAsset>()
                .eq(SpatialAsset::getTenantId, tenantId).eq(SpatialAsset::getLayoutId, layoutId)
                .eq(SpatialAsset::getAssetType, "REFERENCE_IMAGE").eq(SpatialAsset::getSha256, hash)
                .eq(SpatialAsset::getIsDeleted, false).last("LIMIT 1"));
        if (duplicate != null) return toVO(duplicate);

        String key = "cmdb-spatial/" + tenantId + "/" + layoutId + "/" + UUID.randomUUID() + "/original";
        storage.upload(key, content, image.contentType);
        try {
            SpatialAsset asset = new SpatialAsset();
            asset.setTenantId(tenantId); asset.setLayoutId(layoutId); asset.setAssetType("REFERENCE_IMAGE");
            asset.setObjectKey(key); asset.setOriginalName(safeName(file.getOriginalFilename())); asset.setContentType(image.contentType);
            asset.setByteSize((long) content.length); asset.setSha256(hash); asset.setPixelWidth(image.width); asset.setPixelHeight(image.height);
            asset.setCreatedBy(operatorId); asset.setCreatedAt(LocalDateTime.now());
            assetMapper.insert(asset);
            audit(tenantId, "upload_asset", asset.getId(), operatorId, "layoutId=" + layoutId);
            return toVO(asset);
        } catch (RuntimeException exception) {
            try { storage.delete(key); } catch (RuntimeException cleanup) { exception.addSuppressed(cleanup); }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public SpatialAsset requireReadable(Long assetId, String tenantId) {
        SpatialAsset asset = assetMapper.selectById(assetId);
        if (asset == null || Boolean.TRUE.equals(asset.getIsDeleted()) || !tenantId.equals(asset.getTenantId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SPATIAL_ASSET_NOT_FOUND", "参考图不存在");
        }
        return asset;
    }

    @Transactional(readOnly = true)
    public InputStream open(Long assetId, String tenantId, boolean canUpdate) {
        SpatialAsset asset = requireReadable(assetId, tenantId);
        if (!canUpdate && !versionAssetMapper.isReferencedByPublishedVersion(assetId, tenantId)) {
            throw BusinessException.forbidden("SPATIAL_DRAFT_ASSET_FORBIDDEN", "无权读取未发布草稿的参考图");
        }
        return storage.download(asset.getObjectKey());
    }

    @Transactional
    public void delete(Long assetId, String tenantId, Long operatorId) {
        SpatialAsset asset = requireReadable(assetId, tenantId);
        long references = versionAssetMapper.selectCount(new LambdaQueryWrapper<SpatialVersionAsset>()
                .eq(SpatialVersionAsset::getTenantId, tenantId).eq(SpatialVersionAsset::getAssetId, assetId));
        if (references > 0) throw new BusinessException(HttpStatus.CONFLICT, "SPATIAL_ASSET_REFERENCED", "参考图仍被布局版本引用，不能删除");
        storage.delete(asset.getObjectKey());
        asset.setDeletedBy(operatorId); asset.setDeletedAt(LocalDateTime.now());
        assetMapper.updateById(asset); assetMapper.deleteById(assetId);
        audit(tenantId, "delete_asset", assetId, operatorId, "layoutId=" + asset.getLayoutId());
    }

    private void requireLayout(Long layoutId, String tenantId) {
        var layout = layoutMapper.selectById(layoutId);
        if (layout == null || Boolean.TRUE.equals(layout.getIsDeleted()) || !tenantId.equals(layout.getTenantId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SPATIAL_LAYOUT_NOT_FOUND", "空间布局不存在");
        }
    }
    private byte[] read(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            byte[] content = input.readAllBytes();
            if (content.length > MAX_BYTES) throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "SPATIAL_ASSET_TOO_LARGE", "参考图不能超过 20MB");
            return content;
        } catch (IOException exception) { throw BusinessException.badRequest("SPATIAL_ASSET_READ_FAILED", "无法读取参考图文件"); }
    }
    static ImageInfo inspect(byte[] content) {
        if (content.length >= 24 && content[0] == (byte) 0x89 && content[1] == 0x50 && content[2] == 0x4e && content[3] == 0x47) {
            return new ImageInfo("image/png", be32(content, 16), be32(content, 20));
        }
        if (content.length >= 4 && (content[0] & 0xff) == 0xff && (content[1] & 0xff) == 0xd8) return jpegInfo(content);
        if (content.length >= 30 && content[0] == 'R' && content[1] == 'I' && content[2] == 'F' && content[3] == 'F'
                && content[8] == 'W' && content[9] == 'E' && content[10] == 'B' && content[11] == 'P') return webpInfo(content);
        throw BusinessException.badRequest("SPATIAL_ASSET_TYPE_INVALID", "参考图仅支持 PNG、JPEG 或 WebP 格式");
    }
    private static ImageInfo jpegInfo(byte[] content) {
        for (int i = 2; i + 9 < content.length;) {
            if ((content[i] & 0xff) != 0xff) { i++; continue; }
            int marker = content[i + 1] & 0xff; i += 2;
            if (marker == 0xd8 || marker == 0xd9) continue;
            if (i + 1 >= content.length) break;
            int length = ((content[i] & 0xff) << 8) | (content[i + 1] & 0xff);
            if (length < 2 || i + length > content.length) break;
            if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
                return new ImageInfo("image/jpeg", ((content[i + 5] & 0xff) << 8) | (content[i + 6] & 0xff), ((content[i + 3] & 0xff) << 8) | (content[i + 4] & 0xff));
            }
            i += length;
        }
        throw BusinessException.badRequest("SPATIAL_ASSET_IMAGE_INVALID", "JPEG 文件缺少有效尺寸信息");
    }
    private static ImageInfo webpInfo(byte[] c) {
        String type = new String(c, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
        if ("VP8X".equals(type) && c.length >= 30) return new ImageInfo("image/webp", le24(c, 24) + 1, le24(c, 27) + 1);
        if ("VP8 ".equals(type) && c.length >= 30 && c[23] == (byte) 0x9d && c[24] == 0x01 && c[25] == 0x2a) return new ImageInfo("image/webp", le16(c, 26) & 0x3fff, le16(c, 28) & 0x3fff);
        if ("VP8L".equals(type) && c.length >= 25 && c[20] == 0x2f) { int bits = (c[21] & 255) | ((c[22] & 255) << 8) | ((c[23] & 255) << 16) | ((c[24] & 255) << 24); return new ImageInfo("image/webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); }
        throw BusinessException.badRequest("SPATIAL_ASSET_IMAGE_INVALID", "WebP 文件缺少有效尺寸信息");
    }
    private static int be32(byte[] c, int offset) { return ((c[offset] & 255) << 24) | ((c[offset + 1] & 255) << 16) | ((c[offset + 2] & 255) << 8) | (c[offset + 3] & 255); }
    private static int le16(byte[] c, int offset) { return (c[offset] & 255) | ((c[offset + 1] & 255) << 8); }
    private static int le24(byte[] c, int offset) { return (c[offset] & 255) | ((c[offset + 1] & 255) << 8) | ((c[offset + 2] & 255) << 16); }
    private static String sha256(byte[] content) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content)); } catch (Exception exception) { throw new IllegalStateException("无法计算参考图摘要", exception); } }
    private static String safeName(String name) { if (name == null || name.isBlank()) return "reference-image"; return name.replaceAll("[\\r\\n]", "_").substring(0, Math.min(name.length(), 255)); }
    private static SpatialAssetVO toVO(SpatialAsset asset) { return new SpatialAssetVO(asset.getId(), asset.getOriginalName(), asset.getContentType(), asset.getByteSize(), asset.getPixelWidth(), asset.getPixelHeight(), asset.getCreatedAt()); }
    private void audit(String tenantId, String action, Long targetId, Long operatorId, String remark) { auditLogMapper.insert(AuditLog.builder().tenantId(tenantId).module("cmdb_spatial").action(action).targetId(targetId).targetType("ci_spatial_asset").operatorId(operatorId).remark(remark).createdAt(LocalDateTime.now()).build()); }
    record ImageInfo(String contentType, int width, int height) { }
}
