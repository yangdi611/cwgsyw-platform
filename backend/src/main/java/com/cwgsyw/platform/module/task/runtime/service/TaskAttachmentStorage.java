package com.cwgsyw.platform.module.task.runtime.service;

import com.cwgsyw.platform.common.BusinessException;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.CopyObjectArgs;
import io.minio.SourceObject;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.Http.Method;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class TaskAttachmentStorage {
    private final MinioClient minioClient;
    @Value("${minio.bucket}")
    private String bucket;

    public void upload(String objectKey, InputStream stream, long size, String contentType) {
        try {
            if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
            minioClient.putObject(PutObjectArgs.builder().bucket(bucket).object(objectKey)
                .stream(stream, size, -1L).contentType(contentType).build());
        } catch (Exception exception) {
            throw BusinessException.serviceUnavailable("TASK_ATTACHMENT_UPLOAD_FAILED", "附件上传失败，请稍后重试");
        }
    }

    public InputStream download(String objectKey) {
        try {
            return minioClient.getObject(GetObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception exception) {
            throw new BusinessException(404, "TASK_ATTACHMENT_NOT_FOUND", "附件不存在");
        }
    }

    public String temporaryUrl(String objectKey) {
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder().bucket(bucket).object(objectKey)
                .method(Method.GET).expiry(10, TimeUnit.MINUTES).build());
        } catch (Exception exception) {
            throw BusinessException.serviceUnavailable("TASK_ATTACHMENT_URL_FAILED", "附件临时访问地址生成失败");
        }
    }

    public void copy(String sourceKey, String targetKey) {
        try {
            minioClient.copyObject(CopyObjectArgs.builder().bucket(bucket).object(targetKey)
                .source(SourceObject.builder().bucket(bucket).object(sourceKey).build()).build());
        } catch (Exception exception) {
            throw BusinessException.serviceUnavailable("TASK_ATTACHMENT_COPY_FAILED", "附件冻结失败，请稍后重试");
        }
    }

    public void delete(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception exception) {
            throw BusinessException.serviceUnavailable("TASK_ATTACHMENT_DELETE_FAILED", "附件删除失败，请稍后重试");
        }
    }
}
