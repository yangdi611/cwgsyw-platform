package com.cwgsyw.platform.module.changedoc;

import io.minio.*;
import io.minio.errors.ErrorResponseException;
import com.cwgsyw.platform.common.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class MinioStorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    public void upload(String objectKey, InputStream data, long size, String contentType) {
        try {
            ensureBucket();
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(data, size, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("上传文件失败: " + e.getMessage(), e);
        }
    }

    public InputStream download(String objectKey) {
        try {
            return minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("下载文件失败: " + e.getMessage(), e);
        }
    }

    public long objectSize(String objectKey) {
        try {
            return minioClient.statObject(StatObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build())
                    .size();
        } catch (Exception e) {
            throw new RuntimeException("读取文件信息失败: " + e.getMessage(), e);
        }
    }

    public void delete(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("删除文件失败 key={}: {}", objectKey, e.getMessage());
        }
    }

    public void deleteOrThrow(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("删除文件失败 key={}: {}", objectKey, e.getMessage());
            throw BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "对象存储删除失败，请稍后重试");
        }
    }

    public void copyOrThrow(String sourceKey, String targetKey) {
        try {
            minioClient.copyObject(CopyObjectArgs.builder()
                .bucket(bucket)
                .object(targetKey)
                .source(CopySource.builder().bucket(bucket).object(sourceKey).build())
                .build());
        } catch (Exception e) {
            log.warn("复制文件失败 source={} target={}: {}", sourceKey, targetKey, e.getMessage());
            throw BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "对象存储删除失败，请稍后重试");
        }
    }

    /** Copies an object when present, allowing cleanup to remove stale metadata for a missing object. */
    public boolean copyIfPresent(String sourceKey, String targetKey) {
        try {
            minioClient.copyObject(CopyObjectArgs.builder()
                .bucket(bucket)
                .object(targetKey)
                .source(CopySource.builder().bucket(bucket).object(sourceKey).build())
                .build());
            return true;
        } catch (ErrorResponseException exception) {
            if ("NoSuchKey".equals(exception.errorResponse().code())) return false;
            log.warn("复制文件失败 source={} target={}: {}", sourceKey, targetKey, exception.getMessage());
            throw BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "对象存储删除失败，请稍后重试");
        } catch (Exception exception) {
            log.warn("复制文件失败 source={} target={}: {}", sourceKey, targetKey, exception.getMessage());
            throw BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "对象存储删除失败，请稍后重试");
        }
    }

    private void ensureBucket() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }
}
