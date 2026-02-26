"""Tests for domain_resolver module — slug generation and candidate logic."""

from app.processing.domain_resolver import _slugify


class TestSlugify:
    def test_simple_company(self):
        slugs = _slugify("Apple")
        assert "apple" in slugs

    def test_strips_inc(self):
        slugs = _slugify("Apple Inc.")
        assert "apple" in slugs
        # Should not have "inc" as part of slugs
        assert not any("inc." in s for s in slugs)

    def test_multi_word(self):
        slugs = _slugify("Wells Fargo")
        assert "wellsfargo" in slugs
        assert "wells-fargo" in slugs
        assert "wells" in slugs

    def test_strips_llc(self):
        slugs = _slugify("Acme Solutions LLC")
        assert "acmesolutions" in slugs

    def test_generates_initials(self):
        slugs = _slugify("Johnson & Johnson")
        # "and" and "&" stripped, but "johnson" should be there
        assert "johnson" in slugs

    def test_adds_corp_suffix(self):
        slugs = _slugify("Tesla")
        assert "teslacorp" in slugs
        assert "teslainc" in slugs
        assert "teslaco" in slugs

    def test_empty_string(self):
        assert _slugify("") == []

    def test_only_suffixes(self):
        # If company name is just "Inc", should return empty
        assert _slugify("Inc") == []

    def test_strips_punctuation(self):
        slugs = _slugify("Macy's")
        assert "macys" in slugs

    def test_hyphenated_multi_word(self):
        slugs = _slugify("Home Depot")
        assert "homedepot" in slugs
        assert "home-depot" in slugs

    def test_short_name(self):
        slugs = _slugify("HP")
        assert "hp" in slugs

    def test_complex_name(self):
        slugs = _slugify("The Walt Disney Company")
        assert "waltdisney" in slugs
