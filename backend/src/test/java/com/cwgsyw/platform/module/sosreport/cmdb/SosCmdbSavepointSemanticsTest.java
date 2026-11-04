package com.cwgsyw.platform.module.sosreport.cmdb;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.sql.Savepoint;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 用真实的 Spring 事务管理器验证 {@link SosCmdbApplyService} 依赖的事务语义。
 *
 * <p>审批回调运行在审批事务内，CI 写入方法自带 {@code @Transactional}。
 * 写入失败时必须只回滚 CI，审批事务还能提交。这里用真实的 {@link DataSourceTransactionManager}，
 * 只把 JDBC 连接换成 Mock，直接观察发给数据库的提交和回滚。
 */
class SosCmdbSavepointSemanticsTest {

    private Connection connection;
    private Savepoint savepoint;
    private TransactionTemplate outer;
    private TransactionTemplate nested;
    private TransactionTemplate participating;

    @BeforeEach
    void setUp() throws SQLException {
        connection = mock(Connection.class);
        savepoint = mock(Savepoint.class);
        DatabaseMetaData metaData = mock(DatabaseMetaData.class);
        when(metaData.supportsSavepoints()).thenReturn(true);
        when(connection.getMetaData()).thenReturn(metaData);
        when(connection.getAutoCommit()).thenReturn(true);
        when(connection.setSavepoint(any())).thenReturn(savepoint);
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenReturn(connection);

        DataSourceTransactionManager manager = new DataSourceTransactionManager(dataSource);
        outer = new TransactionTemplate(manager);
        nested = new TransactionTemplate(manager);
        nested.setPropagationBehavior(TransactionDefinition.PROPAGATION_NESTED);
        // 相当于 CiInstanceCommandService 上的 @Transactional（默认 REQUIRED）。
        participating = new TransactionTemplate(manager);
    }

    private void failingWrite() {
        participating.executeWithoutResult(status -> {
            throw new IllegalArgumentException("字段 序列号 的值已存在");
        });
    }

    @Test
    void failedWriteInSavepointRollsBackOnlyTheWriteAndApprovalCommits() throws SQLException {
        outer.executeWithoutResult(status -> {
            assertThrows(IllegalArgumentException.class,
                () -> nested.executeWithoutResult(inner -> failingWrite()));
            // 这里相当于把申请标记为 apply_failed。
        });

        InOrder order = inOrder(connection);
        order.verify(connection).setSavepoint(any());
        order.verify(connection).rollback(savepoint);
        order.verify(connection).commit();
        verify(connection, never()).rollback();
    }

    @Test
    void successfulWriteReleasesSavepointAndCommits() throws SQLException {
        Long id = outer.execute(status -> nested.execute(inner ->
            participating.execute(write -> 100L)));

        assertEquals(100L, id);
        verify(connection).releaseSavepoint(savepoint);
        verify(connection).commit();
        verify(connection, never()).rollback(any(Savepoint.class));
        verify(connection, never()).rollback();
    }

    /** 反例：说明为什么不能直接 try/catch。这是保存点存在的原因，也防止以后被“简化”掉。 */
    @Test
    void catchingWithoutSavepointWouldFailTheWholeApproval() throws SQLException {
        assertThrows(UnexpectedRollbackException.class, () -> outer.executeWithoutResult(status ->
            assertThrows(IllegalArgumentException.class, this::failingWrite)));

        verify(connection).rollback();
        verify(connection, never()).commit();
    }
}
