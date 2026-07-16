-- Keep historical pages untouched while enforcing trim-normalized sibling titles for all new writes.
CREATE OR REPLACE FUNCTION enforce_wiki_page_sibling_title_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
       AND NEW.space_id IS NOT DISTINCT FROM OLD.space_id
       AND NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id
       AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
        RETURN NEW;
    END IF;

    NEW.title := btrim(NEW.title);
    IF NEW.title = '' THEN
        RAISE EXCEPTION 'WIKI_PAGE_TITLE_REQUIRED' USING ERRCODE = '22023';
    END IF;
    IF char_length(NEW.title) > 255 THEN
        RAISE EXCEPTION 'WIKI_PAGE_TITLE_TOO_LONG' USING ERRCODE = '22001';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
        NEW.tenant_id || '|' || NEW.space_id::text || '|' || COALESCE(NEW.parent_id::text, 'root') || '|' || NEW.title,
        0));
    IF EXISTS (
        SELECT 1
        FROM wiki_page page
        WHERE page.tenant_id = NEW.tenant_id
          AND page.space_id = NEW.space_id
          AND page.parent_id IS NOT DISTINCT FROM NEW.parent_id
          AND page.title = NEW.title
          AND NOT page.is_deleted
          AND page.id IS DISTINCT FROM NEW.id
    ) THEN
        RAISE EXCEPTION 'WIKI_PAGE_SIBLING_TITLE_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wiki_page_sibling_title_integrity ON wiki_page;
CREATE TRIGGER trg_wiki_page_sibling_title_integrity
BEFORE INSERT OR UPDATE OF tenant_id, space_id, parent_id, title ON wiki_page
FOR EACH ROW EXECUTE FUNCTION enforce_wiki_page_sibling_title_integrity();
