package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.util.List;

@Data
public class ResourceAccessRequest {
    @NotNull
    private Long ownerUserId;
    @NotNull
    private Long ownerGroupId;
    @NotNull
    @PositiveOrZero
    private Long version;
    @NotBlank
    @Pattern(regexp = "^(0|2)[0-7]{3}$")
    private String mode;
    @Valid
    private List<ResourceAclEntryRequest> entries = List.of();
    @Valid
    private List<ResourceAclEntryRequest> defaultEntries = List.of();

    @Data
    public static class ResourceAclEntryRequest {
        @NotBlank
        @Pattern(regexp = "user|group|role")
        private String subjectType;
        @NotNull
        private Long subjectId;
        @NotBlank
        @Pattern(regexp = "[r-][w-][x-]")
        private String permissions;
    }
}
