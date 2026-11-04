package com.cwgsyw.platform.module.sosreport.parser;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.archivers.tar.TarConstants;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.apache.commons.compress.compressors.xz.XZCompressorOutputStream;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SosArchiveReaderTest {

    private static final String TOP = "sosreport-host-2026-01-01-abc/";

    @Test
    void readsOnlyWhitelistedRegularFiles() throws IOException {
        byte[] archive = xzTar(tar -> {
            file(tar, TOP + "sos_commands/host/hostname", "web-01\n");
            file(tar, TOP + "etc/ansible/hosts", "[all:vars]\nansible_password=do-not-read\n");
            file(tar, TOP + "root/anaconda-ks.cfg", "rootpw do-not-read\n");
            file(tar, TOP + "var/log/secure", "do-not-read\n");
            file(tar, TOP + "sos_commands/process/ps_auxwww", "do-not-read\n");
            file(tar, TOP + "sos_commands/networking/ethtool_-S_eth0", "do-not-read\n");
        });

        SosArchiveReader.Result result = new SosArchiveReader().read(new ByteArrayInputStream(archive));

        assertEquals(Map.of("sos_commands/host/hostname", "web-01\n"), result.files());
        assertEquals(6, result.entries());
    }

    @Test
    void supportsGzip() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (OutputStream gz = new GzipCompressorOutputStream(out)) {
            writeTar(gz, tar -> file(tar, TOP + "etc/hostname", "web-02\n"));
        }

        SosArchiveReader.Result result = new SosArchiveReader().read(new ByteArrayInputStream(out.toByteArray()));

        assertEquals("web-02\n", result.files().get("etc/hostname"));
    }

    @Test
    void doesNotFollowSymlinksOrReadSpecialEntries() throws IOException {
        byte[] archive = xzTar(tar -> {
            special(tar, TOP + "etc/os-release", TarConstants.LF_SYMLINK, "../../etc/passwd");
            special(tar, TOP + "etc/hostname", TarConstants.LF_LINK, TOP + "etc/secret");
            special(tar, TOP + "sos_commands/host/hostname", TarConstants.LF_FIFO, null);
            special(tar, TOP + "proc/mdstat", TarConstants.LF_CHR, null);
            file(tar, TOP + "sos_commands/kernel/uname_-a", "Linux h 5 x86_64\n");
        });

        SosArchiveReader.Result result = new SosArchiveReader().read(new ByteArrayInputStream(archive));

        assertEquals(Map.of("sos_commands/kernel/uname_-a", "Linux h 5 x86_64\n"), result.files());
        assertEquals(4, result.skippedSpecial());
    }

    @Test
    void rejectsPathTraversal() throws IOException {
        byte[] traversal = xzTar(tar -> rawFile(tar, TOP + "../../etc/cron.d/evil", "x"));
        assertEquals("ARCHIVE_UNSAFE", failure(traversal, SosArchiveReader.Limits.defaults()).getCode());
    }

    @Test
    void rejectsAbsolutePath() {
        SosParseException exception = assertThrows(SosParseException.class, () -> SosArchiveReader.relativePath("/etc/shadow"));
        assertEquals("ARCHIVE_UNSAFE", exception.getCode());
    }

    @Test
    void acceptsBackslashInFileNames() {
        assertEquals("etc/systemd/dev-disk-by\\x2duuid.swap",
            SosArchiveReader.relativePath(TOP + "etc/systemd/dev-disk-by\\x2duuid.swap"));
        assertNull(SosArchiveReader.relativePath(TOP));
    }

    @Test
    void stopsDecompressionBombEvenInSkippedEntries() throws IOException {
        byte[] archive = xzTar(tar -> file(tar, TOP + "var/log/huge", "0".repeat(2 * 1024 * 1024)));
        SosArchiveReader.Limits limits = new SosArchiveReader.Limits(1024 * 1024, 1000, 1024, 1024 * 1024, 64 * 1024, Duration.ofMinutes(1));

        assertEquals("ARCHIVE_TOO_LARGE", failure(archive, limits).getCode());
    }

    @Test
    void rejectsTooManyEntries() throws IOException {
        byte[] archive = xzTar(tar -> {
            for (int i = 0; i < 5; i++) file(tar, TOP + "var/f" + i, "x");
        });
        SosArchiveReader.Limits limits = new SosArchiveReader.Limits(1024 * 1024, 3, 1024, 1024 * 1024, 64 * 1024, Duration.ofMinutes(1));

        assertEquals("ARCHIVE_TOO_LARGE", failure(archive, limits).getCode());
    }

    @Test
    void limitsTotalRetainedContent() throws IOException {
        byte[] archive = xzTar(tar -> {
            for (int i = 0; i < 20; i++) {
                file(tar, TOP + "sos_commands/networking/ethtool_eth" + i, "0".repeat(500));
            }
        });
        SosArchiveReader.Limits limits = new SosArchiveReader.Limits(1024 * 1024, 1000, 1024, 2048, 64 * 1024, Duration.ofMinutes(1));

        assertEquals("ARCHIVE_TOO_LARGE", failure(archive, limits).getCode());
    }

    @Test
    void enforcesXzMemoryLimit() throws IOException {
        byte[] archive = xzTar(tar -> file(tar, TOP + "etc/hostname", "x"));
        SosArchiveReader.Limits limits = new SosArchiveReader.Limits(1024 * 1024, 1000, 1024, 1024 * 1024, 1, Duration.ofMinutes(1));

        assertEquals("ARCHIVE_TOO_LARGE", failure(archive, limits).getCode());
    }

    @Test
    void skipsOversizedWhitelistedFileWithWarning() throws IOException {
        byte[] archive = xzTar(tar -> {
            file(tar, TOP + "etc/hostname", "ok\n");
            file(tar, TOP + "sos_commands/hardware/dmidecode", "0".repeat(4096));
        });
        SosArchiveReader.Limits limits = new SosArchiveReader.Limits(1024 * 1024, 1000, 1024, 1024 * 1024, 64 * 1024, Duration.ofMinutes(1));

        SosArchiveReader.Result result = new SosArchiveReader(limits).read(new ByteArrayInputStream(archive));

        assertFalse(result.files().containsKey("sos_commands/hardware/dmidecode"));
        assertEquals(1, result.warnings().size());
    }

    @Test
    void rejectsUnsupportedFormatAndCorruption() throws IOException {
        byte[] plain = "this is not an archive at all".getBytes(StandardCharsets.UTF_8);
        assertEquals("UNSUPPORTED_FORMAT", failure(plain, SosArchiveReader.Limits.defaults()).getCode());

        byte[] truncated = java.util.Arrays.copyOf(xzTar(tar -> file(tar, TOP + "etc/hostname", "x".repeat(5000))), 40);
        assertEquals("ARCHIVE_CORRUPT", failure(truncated, SosArchiveReader.Limits.defaults()).getCode());
    }

    @Test
    void rejectsArchiveWithoutSosFiles() throws IOException {
        byte[] archive = xzTar(tar -> file(tar, "project/README.md", "hello"));

        assertEquals("NOT_SOSREPORT", failure(archive, SosArchiveReader.Limits.defaults()).getCode());
    }

    @Test
    void errorMessagesDoNotEchoArchiveContent() throws IOException {
        byte[] archive = xzTar(tar -> rawFile(tar, TOP + "../secret-name-in-archive", "x"));

        SosParseException exception = failure(archive, SosArchiveReader.Limits.defaults());

        assertFalse(exception.getMessage().contains("secret-name-in-archive"));
    }

    @Test
    void whitelistExcludesFilesThatCanHoldCredentials() {
        for (String path : new String[] {
            "etc/ansible/hosts", "root/anaconda-ks.cfg", "etc/shadow", "var/log/secure", "var/log/messages",
            "sos_commands/process/ps_auxwww", "sos_commands/ansible/ansible_all_-m_ping_-vvvv",
            "etc/sysconfig/network-scripts/ifcfg-eth0", "sos_commands/networking/ethtool_-S_eth0",
            "sos_commands/networking/ethtool_-k_eth0", "sos_commands/block/udevadm_info_-a_.dev.sda",
            "proc/net/bonding/../../../etc/shadow"}) {
            assertFalse(SosArchiveReader.isWhitelisted(path), path);
        }
        assertTrue(SosArchiveReader.isWhitelisted("sos_commands/networking/ethtool_eth0"));
        assertTrue(SosArchiveReader.isWhitelisted("sos_commands/networking/ethtool_-i_bond0"));
        assertTrue(SosArchiveReader.isWhitelisted("sos_commands/block/udevadm_info_.dev.nvme0n1"));
    }

    @Test
    void recognizesMagicBytes() {
        assertTrue(SosArchiveReader.isSupportedMagic(new byte[] {(byte) 0xFD, '7', 'z', 'X', 'Z', 0}));
        assertTrue(SosArchiveReader.isSupportedMagic(new byte[] {0x1F, (byte) 0x8B, 8, 0, 0, 0}));
        assertFalse(SosArchiveReader.isSupportedMagic("PK\u0003\u0004zz".getBytes(StandardCharsets.ISO_8859_1)));
    }

    private static SosParseException failure(byte[] archive, SosArchiveReader.Limits limits) {
        return assertThrows(SosParseException.class,
            () -> new SosArchiveReader(limits).read(new ByteArrayInputStream(archive)));
    }

    private interface TarWriter {
        void write(TarArchiveOutputStream tar) throws IOException;
    }

    private static byte[] xzTar(TarWriter writer) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (OutputStream xz = new XZCompressorOutputStream(out)) {
            writeTar(xz, writer);
        }
        return out.toByteArray();
    }

    private static void writeTar(OutputStream target, TarWriter writer) throws IOException {
        TarArchiveOutputStream tar = new TarArchiveOutputStream(target);
        tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
        writer.write(tar);
        tar.finish();
        tar.flush();
    }

    private static void file(TarArchiveOutputStream tar, String name, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        TarArchiveEntry entry = new TarArchiveEntry(name);
        entry.setSize(bytes.length);
        tar.putArchiveEntry(entry);
        tar.write(bytes);
        tar.closeArchiveEntry();
    }

    /** 保留 .. 等原始路径：TarArchiveEntry(name) 会规范化，所以用 preserve 模式构造。 */
    private static void rawFile(TarArchiveOutputStream tar, String name, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        TarArchiveEntry entry = new TarArchiveEntry(name, true);
        entry.setSize(bytes.length);
        tar.putArchiveEntry(entry);
        tar.write(bytes);
        tar.closeArchiveEntry();
    }

    private static void special(TarArchiveOutputStream tar, String name, byte flag, String link) throws IOException {
        TarArchiveEntry entry = new TarArchiveEntry(name, flag);
        if (link != null) entry.setLinkName(link);
        entry.setSize(0);
        tar.putArchiveEntry(entry);
        tar.closeArchiveEntry();
    }
}
