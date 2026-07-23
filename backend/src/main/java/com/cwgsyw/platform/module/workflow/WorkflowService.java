package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.workflow.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringReader;
import java.io.StringWriter;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;

@Service
@RequiredArgsConstructor
public class WorkflowService {
    private static final String HISTORICAL_DELETED_DEFINITION_KEY = "historical-deleted-definition";
    private static final String HISTORICAL_DELETED_DEFINITION_NAME = "历史已删除流程定义";
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final RepositoryService repositoryService;
    private final HistoryService historyService;
    private final JdbcTemplate jdbcTemplate;
    private final SysConfigService configService;

    // ========== Process Definition CRUD ==========

    /**
     * List all process definitions (latest version only)
     */
    public PageResult<ProcessDefinitionVO> listDefinitions(int page, int size) {
        var query = repositoryService.createProcessDefinitionQuery()
            .latestVersion()
            .orderByProcessDefinitionName().asc();
        long total = query.count();
        var definitions = query.listPage((page - 1) * size, size);
        List<ProcessDefinitionVO> vos = definitions.stream().map(def -> {
            var vo = new ProcessDefinitionVO();
            vo.setId(def.getId());
            vo.setName(def.getName());
            vo.setKey(def.getKey());
            vo.setVersion(def.getVersion());
            vo.setDescription(def.getDescription());
            vo.setCategory(def.getCategory());
            vo.setDeploymentId(def.getDeploymentId());
            vo.setSuspended(def.isSuspended());
            vo.setTenantId(def.getTenantId());
            return vo;
        }).toList();
        // Batch load deployment times
        Set<String> deploymentIds = vos.stream().map(ProcessDefinitionVO::getDeploymentId).collect(Collectors.toSet());
        Map<String, LocalDateTime> deploymentTimeMap = deploymentIds.isEmpty() ? Map.of() :
            repositoryService.createDeploymentQuery().deploymentIds(new ArrayList<>(deploymentIds)).list().stream()
                .collect(Collectors.toMap(org.flowable.engine.repository.Deployment::getId,
                    d -> d.getDeploymentTime().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime()));
        vos.forEach(vo -> vo.setDeploymentTime(deploymentTimeMap.get(vo.getDeploymentId())));
        var result = new PageResult<ProcessDefinitionVO>();
        result.setRecords(vos);
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * Get process definition detail including BPMN XML
     */
    public ProcessDefinitionDetailVO getDefinition(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Get BPMN XML
        String xml;
        try (var bis = repositoryService.getProcessModel(definitionId)) {
            xml = new String(bis.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("读取流程定义XML失败: " + definitionId, e);
        }
        var vo = new ProcessDefinitionDetailVO();
        vo.setId(def.getId());
        vo.setName(def.getName());
        vo.setKey(def.getKey());
        vo.setVersion(def.getVersion());
        vo.setDescription(def.getDescription());
        vo.setCategory(def.getCategory());
        vo.setDeploymentId(def.getDeploymentId());
        vo.setSuspended(def.isSuspended());
        vo.setTenantId(def.getTenantId());
        vo.setXml(xml);
        return vo;
    }

    /**
     * Create/deploy a new process definition
     */
    @Transactional
    public ProcessDefinitionVO createDefinition(SaveProcessDefinitionReq req, String tenantId) {
        validateDefinitionRequest(req);
        long existingCount = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(req.getKey()).count();
        if (existingCount > 0) {
            throw new IllegalArgumentException("流程 Key 已存在: " + req.getKey());
        }
        // Replace the process id in the BPMN XML with the user's desired key.
        // Flowable derives the process definition key from <process id="...">,
        // not from the deployment properties. Without this, every new process
        // would use "Process_1" from the editor template.
        String xml = syncDefinitionMetadata(req.getXml(), req, req.getKey(), req.getCategory());
        String resourceName = req.getKey() + ".bpmn20.xml";
        Deployment deployment = deployDefinition(req, resourceName, xml);
        var def = repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.getId()).singleResult();
        var vo = new ProcessDefinitionVO();
        vo.setId(def.getId());
        vo.setName(def.getName());
        vo.setKey(def.getKey());
        vo.setVersion(def.getVersion());
        vo.setDescription(req.getDescription());
        vo.setCategory(def.getCategory());
        vo.setDeploymentId(deployment.getId());
        vo.setDeploymentTime(deployment.getDeploymentTime().toInstant()
            .atZone(java.time.ZoneId.systemDefault()).toLocalDateTime());
        vo.setSuspended(false);
        vo.setTenantId(tenantId);
        return vo;
    }

    /**
     * Update process definition — deploys a new version.
     * Flowable automatically uses the latest version when starting by key,
     * so we don't need to suspend/deprecate old versions.
     */
    @Transactional
    public ProcessDefinitionVO updateDefinition(String definitionId, SaveProcessDefinitionReq req, String tenantId) {
        validateDefinitionRequest(req);
        var oldDef = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (oldDef == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);

        String newXml = syncDefinitionMetadata(req.getXml(), req, oldDef.getKey(), req.getCategory());

        String resourceName = req.getKey() + ".bpmn20.xml";
        Deployment deployment = deployDefinition(req, resourceName, newXml);
        var newDef = repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.getId()).singleResult();
        var vo = new ProcessDefinitionVO();
        vo.setId(newDef.getId());
        vo.setName(newDef.getName());
        vo.setKey(newDef.getKey());
        vo.setVersion(newDef.getVersion());
        vo.setDescription(req.getDescription());
        vo.setCategory(newDef.getCategory());
        vo.setDeploymentId(deployment.getId());
        vo.setDeploymentTime(deployment.getDeploymentTime().toInstant()
            .atZone(java.time.ZoneId.systemDefault()).toLocalDateTime());
        vo.setSuspended(false);
        vo.setTenantId(tenantId);
        return vo;
    }

    private Deployment deployDefinition(SaveProcessDefinitionReq req, String resourceName, String xml) {
        try {
            return repositoryService.createDeployment()
                .name(req.getName())
                .category(req.getCategory())
                .addString(resourceName, xml)
                .deploy();
        } catch (RuntimeException exception) {
            throw BusinessException.badRequest("BPMN_DEPLOYMENT_INVALID", "BPMN 流程定义无法部署，请检查流程结构和属性");
        }
    }

    static String syncDefinitionMetadata(String xml, SaveProcessDefinitionReq req, String processKey, String category) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setExpandEntityReferences(false);
            factory.setNamespaceAware(true);
            var document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
            String namespace = "http://www.omg.org/spec/BPMN/20100524/MODEL";
            Element definitions = (Element) document.getElementsByTagNameNS(namespace, "definitions").item(0);
            Element process = (Element) document.getElementsByTagNameNS(namespace, "process").item(0);
            process.setAttribute("id", processKey);
            process.setAttribute("name", req.getName());
            if (category != null) definitions.setAttribute("targetNamespace", category);
            var documentationNodes = process.getElementsByTagNameNS(namespace, "documentation");
            Element documentation;
            if (documentationNodes.getLength() > 0) {
                documentation = (Element) documentationNodes.item(0);
            } else {
                documentation = document.createElementNS(namespace, "bpmn:documentation");
                process.insertBefore(documentation, process.getFirstChild());
            }
            documentation.setTextContent(req.getDescription() == null ? "" : req.getDescription());
            TransformerFactory transformerFactory = TransformerFactory.newInstance();
            transformerFactory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            var transformer = transformerFactory.newTransformer();
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
            transformer.setOutputProperty(OutputKeys.ENCODING, StandardCharsets.UTF_8.name());
            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(document), new StreamResult(writer));
            return writer.toString();
        } catch (Exception exception) {
            throw BusinessException.badRequest("BPMN_XML_INVALID", "BPMN XML 格式无效");
        }
    }

    private void validateDefinitionRequest(SaveProcessDefinitionReq req) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setExpandEntityReferences(false);
            factory.setNamespaceAware(true);
            var document = factory.newDocumentBuilder().parse(
                new org.xml.sax.InputSource(new java.io.StringReader(req.getXml())));
            String namespace = "http://www.omg.org/spec/BPMN/20100524/MODEL";
            if (document.getElementsByTagNameNS(namespace, "definitions").getLength() != 1
                    || document.getElementsByTagNameNS(namespace, "process").getLength() != 1
                    || document.getElementsByTagNameNS(namespace, "startEvent").getLength() < 1
                    || document.getElementsByTagNameNS(namespace, "endEvent").getLength() < 1) {
                throw BusinessException.badRequest("BPMN_XML_INVALID", "BPMN 必须包含 definitions、process、开始事件和结束事件");
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw BusinessException.badRequest("BPMN_XML_INVALID", "BPMN XML 格式无效");
        }
    }

    /**
     * Delete process definition and all versions
     */
    @Transactional
    public void deleteDefinition(String definitionId, String tenantId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_NOT_FOUND", "流程定义不存在");
        }
        List<String> definitionIds = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(def.getKey()).list().stream().map(d -> d.getId()).toList();
        if (isBoundToBusinessProcess(definitionIds, tenantId)) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_BOUND", "流程定义已被业务流程绑定，请先在系统配置中更换绑定");
        }
        if (runtimeService.createProcessInstanceQuery().processDefinitionKey(def.getKey()).count() > 0) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_RUNNING_INSTANCES", "流程定义存在运行中的实例，无法删除");
        }
        repositoryService.createProcessDefinitionQuery().processDefinitionKey(def.getKey()).list().stream()
            .map(d -> d.getDeploymentId()).distinct()
            .forEach(deploymentId -> repositoryService.deleteDeployment(deploymentId, false));
    }

    /**
     * Delete a single version of a process definition.
     * Fails if this is the last version or if it is bound to a business module.
     */
    @Transactional
    public void deleteDefinitionVersion(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_NOT_FOUND", "流程定义不存在");
        }
        // Protect: don't allow deleting the last version
        long versionCount = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(def.getKey()).count();
        if (versionCount <= 1) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_LAST_VERSION", "至少保留一个版本，无法删除");
        }
        if (runtimeService.createProcessInstanceQuery().processDefinitionId(definitionId).count() > 0) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_RUNNING_INSTANCES", "该版本存在运行中的实例，无法删除");
        }
        repositoryService.deleteDeployment(def.getDeploymentId(), false);
    }

    /**
     * Activate a suspended definition version — makes it available to start.
     * MUTEX: suspends all other versions of the same process key so that
     * only one version can be active at a time.
     */
    @Transactional
    public void activateDefinition(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Suspend all other versions of the same key first (mutex)
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(def.getKey())
            .list().stream()
            .filter(d -> !d.getId().equals(definitionId) && !d.isSuspended())
            .forEach(d -> repositoryService.suspendProcessDefinitionById(d.getId(), true, null));
        // Then activate the target version
        repositoryService.activateProcessDefinitionById(definitionId, true, null);
    }

    /**
     * Suspend (deactivate) a definition version.
     */
    @Transactional
    public void suspendDefinition(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_NOT_FOUND", "流程定义不存在");
        }
        if (def.isSuspended()) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_ALREADY_SUSPENDED", "流程定义已处于挂起状态");
        }
        repositoryService.suspendProcessDefinitionById(definitionId, true, null);
    }

    /**
     * Get all historical versions for a key
     */
    public List<ProcessDefinitionVO> getDefinitionVersions(String key) {
        List<ProcessDefinitionVO> vos = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(key)
            .orderByProcessDefinitionVersion().desc()
            .list().stream().map(def -> {
                var vo = new ProcessDefinitionVO();
                vo.setId(def.getId());
                vo.setName(def.getName());
                vo.setKey(def.getKey());
                vo.setVersion(def.getVersion());
                vo.setDescription(def.getDescription());
                vo.setCategory(def.getCategory());
                vo.setDeploymentId(def.getDeploymentId());
                vo.setSuspended(def.isSuspended());
                vo.setTenantId(def.getTenantId());
                return vo;
            }).toList();
        // Batch load deployment times
        Set<String> deploymentIds = vos.stream().map(ProcessDefinitionVO::getDeploymentId).collect(Collectors.toSet());
        Map<String, LocalDateTime> deploymentTimeMap = deploymentIds.isEmpty() ? Map.of() :
            repositoryService.createDeploymentQuery().deploymentIds(new ArrayList<>(deploymentIds)).list().stream()
                .collect(Collectors.toMap(org.flowable.engine.repository.Deployment::getId,
                    d -> d.getDeploymentTime().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime()));
        vos.forEach(vo -> vo.setDeploymentTime(deploymentTimeMap.get(vo.getDeploymentId())));
        return vos;
    }

    // ========== Process Stats ==========

    /**
     * Get statistics for a process definition key
     */
    public ProcessStatsVO getProcessStats(String processDefinitionKey) {
        if (HISTORICAL_DELETED_DEFINITION_KEY.equals(processDefinitionKey)) {
            List<HistoricProcessInstance> unresolvedHistory = historyService.createHistoricProcessInstanceQuery().list().stream()
                .filter(instance -> instance.getProcessDefinitionKey() == null)
                .toList();
            long finishedCount = unresolvedHistory.stream()
                .filter(instance -> instance.getEndTime() != null)
                .count();
            double avgDurationSec = unresolvedHistory.stream()
                .filter(instance -> instance.getDurationInMillis() != null)
                .mapToLong(HistoricProcessInstance::getDurationInMillis)
                .average()
                .orElse(0) / 1000.0;

            ProcessStatsVO stats = new ProcessStatsVO();
            stats.setProcessDefinitionKey(HISTORICAL_DELETED_DEFINITION_KEY);
            stats.setName(HISTORICAL_DELETED_DEFINITION_NAME);
            stats.setTotalStarted(unresolvedHistory.size());
            stats.setFinishedCount((int) finishedCount);
            stats.setRunningCount(0);
            stats.setSuccessRate(unresolvedHistory.isEmpty() ? 0 : finishedCount * 100.0 / unresolvedHistory.size());
            stats.setAvgDurationSeconds(avgDurationSec);
            return stats;
        }

        // Running instances
        long runningCount = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey).count();

        // Finished instances
        long finishedCount = historyService.createHistoricProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey).finished().count();

        // Average duration (in seconds)
        double avgDurationSec = 0;
        if (finishedCount > 0) {
            var finished = historyService.createHistoricProcessInstanceQuery()
                .processDefinitionKey(processDefinitionKey).finished()
                .orderByProcessInstanceEndTime().desc()
                .listPage(0, 100);
            avgDurationSec = finished.stream()
                .filter(pi -> pi.getDurationInMillis() != null)
                .mapToLong(org.flowable.engine.history.HistoricProcessInstance::getDurationInMillis)
                .average()
                .orElse(0) / 1000.0;
        }

        // Success rate: finished / total started * 100
        long totalStarted = runningCount + finishedCount;
        double successRate = totalStarted > 0 ? (double) finishedCount / totalStarted * 100 : 0;

        ProcessStatsVO stats = new ProcessStatsVO();
        stats.setProcessDefinitionKey(processDefinitionKey);
        stats.setTotalStarted(totalStarted);
        stats.setRunningCount(runningCount);
        stats.setFinishedCount(finishedCount);
        stats.setSuccessRate(Math.round(successRate * 10) / 10.0);
        stats.setAvgDurationSeconds(Math.round(avgDurationSec * 10) / 10.0);
        return stats;
    }

    /**
     * Get stats for all process definitions
     */
    public List<ProcessStatsVO> getAllProcessStats() {
        Map<String, org.flowable.engine.repository.ProcessDefinition> definitionsByKey =
            repositoryService.createProcessDefinitionQuery().latestVersion().list().stream()
                .collect(Collectors.toMap(
                    org.flowable.engine.repository.ProcessDefinition::getKey,
                    definition -> definition,
                    (first, ignored) -> first,
                    LinkedHashMap::new));

        List<HistoricProcessInstance> historicInstances = historyService.createHistoricProcessInstanceQuery().list();
        Map<String, HistoricProcessInstance> historyByKey = historicInstances.stream()
            .filter(instance -> instance.getProcessDefinitionKey() != null)
            .collect(Collectors.toMap(
                HistoricProcessInstance::getProcessDefinitionKey,
                instance -> instance,
                (first, ignored) -> first,
                LinkedHashMap::new));

        runtimeService.createProcessInstanceQuery().list().stream()
            .map(ProcessInstance::getProcessDefinitionKey)
            .filter(Objects::nonNull)
            .forEach(key -> historyByKey.putIfAbsent(key, null));

        LinkedHashSet<String> keys = new LinkedHashSet<>(definitionsByKey.keySet());
        keys.addAll(historyByKey.keySet());

        List<ProcessStatsVO> stats = keys.stream().map(key -> {
            ProcessStatsVO processStats = getProcessStats(key);
            var definition = definitionsByKey.get(key);
            if (definition != null) {
                processStats.setName(definition.getName());
                processStats.setVersion(definition.getVersion());
                processStats.setProcessDefinitionId(definition.getId());
            } else {
                HistoricProcessInstance historicInstance = historyByKey.get(key);
                processStats.setName(historicInstance != null && historicInstance.getProcessDefinitionName() != null
                    ? historicInstance.getProcessDefinitionName() : key);
                processStats.setVersion(historicInstance != null ? historicInstance.getProcessDefinitionVersion() : null);
                processStats.setProcessDefinitionId(historicInstance != null ? historicInstance.getProcessDefinitionId() : null);
            }
            return processStats;
        }).toList();

        List<HistoricProcessInstance> unresolvedHistory = historicInstances.stream()
            .filter(instance -> instance.getProcessDefinitionKey() == null)
            .toList();
        if (unresolvedHistory.isEmpty()) return stats;

        ProcessStatsVO historicalStats = new ProcessStatsVO();
        historicalStats.setProcessDefinitionKey(HISTORICAL_DELETED_DEFINITION_KEY);
        historicalStats.setName(HISTORICAL_DELETED_DEFINITION_NAME);
        historicalStats.setTotalStarted(unresolvedHistory.size());
        historicalStats.setFinishedCount((int) unresolvedHistory.stream()
            .filter(instance -> instance.getEndTime() != null).count());
        historicalStats.setRunningCount(0);
        historicalStats.setSuccessRate(historicalStats.getFinishedCount() * 100.0 / historicalStats.getTotalStarted());
        historicalStats.setAvgDurationSeconds(unresolvedHistory.stream()
            .filter(instance -> instance.getDurationInMillis() != null)
            .mapToLong(HistoricProcessInstance::getDurationInMillis)
            .average().orElse(0) / 1000.0);
        List<ProcessStatsVO> result = new ArrayList<>(stats);
        result.add(historicalStats);
        return result;
    }

    // ========== Generic Process Instance Management ==========

    private LocalDateTime dateToLocal(java.util.Date d) {
        return d != null ? d.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime() : null;
    }

    /**
     * Generic process start — by definition ID (specific version) or by key (latest version)
     */
    @Transactional
    public InstanceVO startProcess(StartProcessRequest req, Long userId, String tenantId) {
        if (req.getProcessDefinitionId() == null || req.getProcessDefinitionId().isBlank()) {
            if (req.getProcessDefinitionKey() == null || req.getProcessDefinitionKey().isBlank()) {
                throw BusinessException.badRequest("WORKFLOW_DEFINITION_REQUIRED", "必须指定流程定义 ID 或 Key");
            }
        }
        Map<String, Object> vars = req.getVariables() != null ? req.getVariables() : new HashMap<>();
        ProcessInstance pi;
        if (req.getProcessDefinitionId() != null && !req.getProcessDefinitionId().isBlank()) {
            requireStartableDefinition(repositoryService.createProcessDefinitionQuery()
                .processDefinitionId(req.getProcessDefinitionId()).singleResult());
            pi = runtimeService.startProcessInstanceById(
                req.getProcessDefinitionId(), req.getBusinessKey(), vars);
        } else {
            requireStartableDefinition(repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(req.getProcessDefinitionKey()).latestVersion().singleResult());
            pi = runtimeService.startProcessInstanceByKey(
                req.getProcessDefinitionKey(), req.getBusinessKey(), vars);
        }
        return toInstanceVO(pi);
    }

    /**
     * List running process instances
     */
    public PageResult<InstanceVO> listRunningInstances(String key, int page, int size) {
        var query = runtimeService.createProcessInstanceQuery();
        if (key != null && !key.isEmpty()) query.processDefinitionKey(key);
        query.orderByStartTime().desc();
        long total = query.count();
        var pis = query.listPage((page - 1) * size, size);
        var result = new PageResult<InstanceVO>();
        result.setRecords(pis.stream().map(this::toInstanceVO).toList());
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * Suspend process instance
     */
    @Transactional
    public void suspendInstance(String instanceId) {
        var instance = requireRunningInstance(instanceId);
        if (instance.isSuspended()) {
            throw BusinessException.badRequest("WORKFLOW_INSTANCE_ALREADY_SUSPENDED", "流程实例已处于挂起状态");
        }
        runtimeService.suspendProcessInstanceById(instanceId);
    }

    /**
     * Activate process instance
     */
    @Transactional
    public void activateInstance(String instanceId) {
        var instance = requireRunningInstance(instanceId);
        if (!instance.isSuspended()) {
            throw BusinessException.badRequest("WORKFLOW_INSTANCE_ALREADY_ACTIVE", "流程实例已处于激活状态");
        }
        runtimeService.activateProcessInstanceById(instanceId);
    }

    /**
     * Delete (terminate) process instance
     */
    @Transactional
    public void deleteInstance(String instanceId, String reason) {
        requireRunningInstance(instanceId);
        runtimeService.deleteProcessInstance(instanceId, reason);
    }

    private boolean isBoundToBusinessProcess(List<String> definitionIds, String tenantId) {
        return configService.getAll(tenantId).entrySet().stream()
            .filter(entry -> entry.getKey().endsWith("_process_definition_id"))
            .map(Map.Entry::getValue)
            .anyMatch(definitionIds::contains);
    }

    private void requireStartableDefinition(org.flowable.engine.repository.ProcessDefinition definition) {
        if (definition == null) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_NOT_FOUND", "流程定义不存在");
        }
        if (definition.isSuspended()) {
            throw BusinessException.badRequest("WORKFLOW_DEFINITION_SUSPENDED", "流程定义已挂起，无法发起实例");
        }
    }

    private ProcessInstance requireRunningInstance(String instanceId) {
        ProcessInstance instance = runtimeService.createProcessInstanceQuery()
            .processInstanceId(instanceId).singleResult();
        if (instance == null) {
            throw BusinessException.badRequest("WORKFLOW_INSTANCE_NOT_FOUND", "流程实例不存在或已结束");
        }
        return instance;
    }

    /**
     * List finished (historical) process instances
     */
    public PageResult<InstanceVO> listFinishedInstances(String key, int page, int size) {
        var query = historyService.createHistoricProcessInstanceQuery().finished();
        if (key != null && !key.isEmpty()) query.processDefinitionKey(key);
        query.orderByProcessInstanceEndTime().desc();
        long total = query.count();
        var pis = query.listPage((page - 1) * size, size);
        var result = new PageResult<InstanceVO>();
        result.setRecords(pis.stream().map(hpi -> {
            var vo = new InstanceVO();
            vo.setId(hpi.getId());
            vo.setBusinessKey(hpi.getBusinessKey());
            vo.setProcessDefinitionName(hpi.getProcessDefinitionName());
            vo.setProcessDefinitionKey(hpi.getProcessDefinitionKey());
            vo.setStartTime(dateToLocal(hpi.getStartTime()));
            vo.setEndTime(dateToLocal(hpi.getEndTime()));
            vo.setEnded(true);
            return vo;
        }).toList());
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * Get historic activities for process diagram highlighting
     */
    public List<HistoricActivityVO> getHistoricActivities(String instanceId) {
        return historyService.createHistoricActivityInstanceQuery()
            .processInstanceId(instanceId)
            .orderByHistoricActivityInstanceStartTime().asc()
            .list().stream().map(a -> {
                HistoricActivityVO activity = new HistoricActivityVO();
                activity.setActivityId(a.getActivityId());
                activity.setActivityName(a.getActivityName());
                activity.setActivityType(a.getActivityType());
                activity.setStartTime(dateToLocal(a.getStartTime()));
                activity.setEndTime(dateToLocal(a.getEndTime()));
                activity.setAssignee(a.getAssignee() != null ? a.getAssignee() : "");
                return activity;
            }).toList();
    }

    /**
     * Update process definition name and/or key for all versions of a process.
     * Uses JdbcTemplate for direct DB updates since Flowable has no API for this.
     */
    @Transactional
    public ProcessDefinitionVO renameDefinition(String definitionId, UpdateProcessMetaReq req) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);

        String oldKey = def.getKey();
        String newKey = req.getKey() != null && !req.getKey().isBlank() ? req.getKey().trim() : oldKey;
        String newName = req.getName() != null && !req.getName().isBlank() ? req.getName().trim() : null;

        if (newKey.equals(oldKey) && newName == null) {
            throw new IllegalArgumentException("至少需要提供 name 或 key");
        }

        // Check key uniqueness if changing key
        if (!newKey.equals(oldKey)) {
            long existing = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(newKey).count();
            if (existing > 0) {
                throw new IllegalArgumentException("流程 Key 已存在: " + newKey);
            }
        }

        // Update name in ACT_RE_PROCDEF and ACT_RE_DEPLOYMENT
        if (newName != null) {
            jdbcTemplate.update("UPDATE ACT_RE_PROCDEF SET NAME_ = ? WHERE KEY_ = ?", newName, oldKey);
            jdbcTemplate.update("UPDATE ACT_RE_DEPLOYMENT SET NAME_ = ? WHERE ID_ IN " +
                "(SELECT DEPLOYMENT_ID_ FROM ACT_RE_PROCDEF WHERE KEY_ = ?)", newName, oldKey);
        }

        // Update key in ACT_RE_PROCDEF and BPMN XML in ACT_GE_BYTEARRAY
        if (!newKey.equals(oldKey)) {
            jdbcTemplate.update("UPDATE ACT_RE_PROCDEF SET KEY_ = ? WHERE KEY_ = ?", newKey, oldKey);
            // Update XML process id in byte arrays for all versions
            jdbcTemplate.update(
                "UPDATE ACT_GE_BYTEARRAY SET BYTES_ = REPLACE(BYTES_, " +
                "('<bpmn:process id=\"' || ? || '\"'), ('<bpmn:process id=\"' || ? || '\"')) " +
                "WHERE DEPLOYMENT_ID_ IN (SELECT DEPLOYMENT_ID_ FROM ACT_RE_PROCDEF WHERE KEY_ = ?) " +
                "AND NAME_ LIKE '%.bpmn20.xml'", newKey, oldKey, newKey);
        }

        // Refresh and return the updated definition
        var updatedDef = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        var vo = new ProcessDefinitionVO();
        vo.setId(updatedDef.getId());
        vo.setName(updatedDef.getName());
        vo.setKey(updatedDef.getKey());
        vo.setVersion(updatedDef.getVersion());
        vo.setDescription(updatedDef.getDescription());
        vo.setCategory(updatedDef.getCategory());
        vo.setDeploymentId(updatedDef.getDeploymentId());
        vo.setSuspended(updatedDef.isSuspended());
        vo.setTenantId(updatedDef.getTenantId());
        return vo;
    }

    private InstanceVO toInstanceVO(ProcessInstance pi) {
        var vo = new InstanceVO();
        vo.setId(pi.getId());
        vo.setBusinessKey(pi.getBusinessKey());
        vo.setProcessDefinitionId(pi.getProcessDefinitionId());
        vo.setProcessDefinitionKey(pi.getProcessDefinitionKey());
        vo.setProcessDefinitionName(pi.getProcessDefinitionName());
        vo.setStartTime(dateToLocal(pi.getStartTime()));
        vo.setEnded(pi.isEnded());
        vo.setSuspended(pi.isSuspended());
        return vo;
    }

}
