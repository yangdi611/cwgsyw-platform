package com.cwgsyw.platform.module.cmdb.spatial.service;

import com.cwgsyw.platform.common.BusinessException;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Private object-storage adapter for the spatial domain. It does not depend on changedoc storage. */
@Service
@RequiredArgsConstructor
public class SpatialAssetStorage {
    private final MinioClient minioClient;
    @Value("${minio.bucket}")
    private String bucket;

    public void upload(String key, byte[] content, String contentType) {
        try {
            if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
            minioClient.putObject(PutObjectArgs.builder().bucket(bucket).object(key)
                    .stream(new ByteArrayInputStream(content), (long) content.length, -1L).contentType(contentType).build());
        } catch (Exception exception) {
            throw BusinessException.serviceUnavailable("SPATIAL_ASSET_UPLOAD_FAILED", "参考图上传失败，请稍后重试");
        }
    }

    public InputStream download(String key) {
        try {
            return minioClient.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception exception) {
            throw new BusinessException(404, "SPATIAL_ASSET_NOT_FOUND", "参考图不存在");
        }
    }

    public void delete(String key) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception exception) {
            throw BusinessException.serviceUnavailable("SPATIAL_ASSET_DELETE_FAILED", "参考图删除失败，请稍后重试");
        }
    }
}
