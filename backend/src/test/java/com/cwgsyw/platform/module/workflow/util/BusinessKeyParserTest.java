package com.cwgsyw.platform.module.workflow.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BusinessKeyParserTest {

    @Test
    void parsesNewFormatTaskSubmission() {
        ParsedBusinessKey p = BusinessKeyParser.parse("task_submission:123");
        assertThat(p.isRecognized()).isTrue();
        assertThat(p.getBusinessType()).isEqualTo("task_submission");
        assertThat(p.getBusinessId()).isEqualTo("123");
        assertThat(p.isLegacyFormat()).isFalse();
        assertThat(p.getRawBusinessKey()).isEqualTo("task_submission:123");
    }

    @Test
    void parsesNewFormatWikiPage() {
        ParsedBusinessKey p = BusinessKeyParser.parse("wiki_page:456");
        assertThat(p.isRecognized()).isTrue();
        assertThat(p.getBusinessType()).isEqualTo("wiki_page");
        assertThat(p.getBusinessId()).isEqualTo("456");
        assertThat(p.isLegacyFormat()).isFalse();
    }

    @Test
    void parsesNewFormatChangeDoc() {
        ParsedBusinessKey p = BusinessKeyParser.parse("change_doc:789");
        assertThat(p.isRecognized()).isTrue();
        assertThat(p.getBusinessType()).isEqualTo("change_doc");
        assertThat(p.getBusinessId()).isEqualTo("789");
    }

    @Test
    void parsesNewFormatDeviceAccess() {
        ParsedBusinessKey p = BusinessKeyParser.parse("device_access:321");
        assertThat(p.isRecognized()).isTrue();
        assertThat(p.getBusinessType()).isEqualTo("device_access");
        assertThat(p.getBusinessId()).isEqualTo("321");
    }

    @Test
    void parsesLegacyWikiPage() {
        ParsedBusinessKey p = BusinessKeyParser.parse("wikiPage:456");
        assertThat(p.isRecognized()).isTrue();
        assertThat(p.getBusinessType()).isEqualTo("wiki_page");
        assertThat(p.getBusinessId()).isEqualTo("456");
        assertThat(p.isLegacyFormat()).isTrue();
    }

    @Test
    void extensibleNewFormatTypeIsRecognized() {
        ParsedBusinessKey p = BusinessKeyParser.parse("some_unknown_thing:1");
        assertThat(p.isRecognized()).isTrue();
        assertThat(p.getBusinessType()).isEqualTo("some_unknown_thing");
        assertThat(p.getBusinessId()).isEqualTo("1");
        assertThat(p.isLegacyFormat()).isFalse();
        assertThat(p.getRawBusinessKey()).isEqualTo("some_unknown_thing:1");
    }

    @Test
    void nullIsUnrecognized() {
        ParsedBusinessKey p = BusinessKeyParser.parse(null);
        assertThat(p.isRecognized()).isFalse();
        assertThat(p.getRawBusinessKey()).isNull();
    }

    @Test
    void blankIsUnrecognized() {
        ParsedBusinessKey p = BusinessKeyParser.parse("  ");
        assertThat(p.isRecognized()).isFalse();
    }

    @Test
    void noColonIsUnrecognized() {
        ParsedBusinessKey p = BusinessKeyParser.parse("task_submission123");
        assertThat(p.isRecognized()).isFalse();
    }

    @Test
    void emptyIdPartIsUnrecognized() {
        ParsedBusinessKey p = BusinessKeyParser.parse("task_submission:");
        assertThat(p.isRecognized()).isFalse();
    }

    @Test
    void emptyTypePartIsUnrecognized() {
        ParsedBusinessKey p = BusinessKeyParser.parse(":123");
        assertThat(p.isRecognized()).isFalse();
    }

    @Test
    void uppercaseTypeIsUnrecognizedUnlessLegacyAlias() {
        // Camel case not in the legacy alias table should be unrecognized.
        ParsedBusinessKey p = BusinessKeyParser.parse("ChangeDoc:1");
        assertThat(p.isRecognized()).isFalse();
    }

    @Test
    void buildProducesExpectedFormat() {
        assertThat(BusinessKeyParser.build("task_submission", 123L)).isEqualTo("task_submission:123");
        assertThat(BusinessKeyParser.build("wiki_page", 456)).isEqualTo("wiki_page:456");
    }
}
