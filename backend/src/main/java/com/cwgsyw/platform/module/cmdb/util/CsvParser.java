package com.cwgsyw.platform.module.cmdb.util;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.mozilla.universalchardet.UniversalDetector;

import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * CSV parsing utility with encoding detection.
 * Detects encoding (UTF-8 first, then GBK fallback) and parses CSV into list of maps.
 */
public final class CsvParser {

    private static final int MAX_ROWS = 5000;

    private CsvParser() {}

    /**
     * Detect encoding of raw bytes. Tries UTF-8 first, falls back to juniversalchardet detection.
     */
    public static String detectEncoding(byte[] data) {
        // Try UTF-8 validation first
        String asUtf8 = new String(data, StandardCharsets.UTF_8);
        byte[] reEncoded = asUtf8.getBytes(StandardCharsets.UTF_8);
        if (Arrays.equals(data, reEncoded)) {
            return "UTF-8";
        }
        // Use juniversalchardet instance-based detection
        UniversalDetector detector = new UniversalDetector(null);
        detector.handleData(data, 0, Math.min(data.length, 4096));
        detector.dataEnd();
        String detected = detector.getDetectedCharset();
        if (detected != null && Charset.isSupported(detected)) {
            return detected;
        }
        return "GBK";
    }

    /**
     * Parse CSV bytes with the given encoding.
     * Returns list of maps (header → value) for each row.
     */
    public static List<Map<String, String>> parse(byte[] data, String encoding) throws Exception {
        if (data == null || data.length == 0) {
            return Collections.emptyList();
        }

        // Strip UTF-8 BOM if present (EF BB BF)
        if (data.length >= 3 && (data[0] & 0xFF) == 0xEF && (data[1] & 0xFF) == 0xBB && (data[2] & 0xFF) == 0xBF) {
            data = Arrays.copyOfRange(data, 3, data.length);
        }

        Charset charset = Charset.forName(encoding);
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setTrim(true)
                .build();

        try (CSVParser parser = CSVParser.parse(new InputStreamReader(new ByteArrayInputStream(data), charset), format)) {
            List<Map<String, String>> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                Map<String, String> row = new LinkedHashMap<>();
                for (String header : parser.getHeaderMap().keySet()) {
                    String value = record.isMapped(header) ? record.get(header) : null;
                    if (value != null && !value.isEmpty()) {
                        row.put(header, value);
                    }
                }
                rows.add(row);
                if (rows.size() >= MAX_ROWS) {
                    throw new IllegalArgumentException("请分批导入，单次上限 5000 行");
                }
            }
            return rows;
        }
    }

    /**
     * Sanitize a CSV value to prevent CSV injection (formula injection).
     * Strips leading = + - @ \t \r characters.
     */
    public static String sanitize(String value) {
        if (value == null || value.isEmpty()) return value;
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            return "'" + value;
        }
        return value;
    }
}
