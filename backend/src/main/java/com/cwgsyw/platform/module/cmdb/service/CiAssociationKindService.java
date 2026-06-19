package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationKindVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiAssociationKindService {

    private final CiAssociationKindMapper ciAssociationKindMapper;

    /**
     * 列出当前租户下的关联类型（内置，只读）。
     */
    public List<CiAssociationKindVO> list(String tenantId) {
        LambdaQueryWrapper<CiAssociationKind> q = new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getIsDeleted, false)
                .orderByAsc(CiAssociationKind::getId);
        return ciAssociationKindMapper.selectList(q).stream()
                .map(this::toVO).collect(Collectors.toList());
    }

    private CiAssociationKindVO toVO(CiAssociationKind entity) {
        CiAssociationKindVO vo = new CiAssociationKindVO();
        vo.setId(entity.getId());
        vo.setCode(entity.getCode());
        vo.setName(entity.getName());
        vo.setIsBuiltIn(entity.getIsBuiltIn());
        return vo;
    }
}
