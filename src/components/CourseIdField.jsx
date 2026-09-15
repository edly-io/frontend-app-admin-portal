import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Form, Icon, Spinner } from '@openedx/paragon';
import { ExpandLess, ExpandMore } from '@openedx/paragon/icons';

import { getCourseReports } from '../data/api';

const SEARCH_DEBOUNCE_MS = 300;
// Below this, a query is too broad to be a useful lookup and not worth a request.
const MIN_QUERY_LENGTH = 2;
// Caps the rendered list, not the request — the backend already limits results per page.
const MAX_VISIBLE_SUGGESTIONS = 8;

/**
 * Course run ID field styled as a searchable dropdown, backed by the
 * reporting course list. Stays a plain editable text input underneath —
 * selecting a suggestion just fills it, and a value with no matching
 * suggestion still submits as typed (some valid course runs may not be in
 * the search index).
 *
 * Performance: a query under MIN_QUERY_LENGTH never hits the API, results
 * are cached per query for the field's lifetime (retyping/backspacing to a
 * query already seen is free), and picking a suggestion doesn't trigger a
 * redundant search for the id it just filled in.
 */
const CourseIdField = ({
  controlId, label, value, onChange, isInvalid, feedback,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return undefined;
    }
    const query = value.trim();
    const cacheKey = query.toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const handle = setTimeout(() => {
      getCourseReports({ search: query, page: 1 })
        .then((data) => {
          if (!active) { return; }
          const results = data.results || [];
          cacheRef.current.set(cacheKey, results);
          setSuggestions(results);
        })
        .catch(() => { if (active) { setSuggestions([]); } })
        .finally(() => { if (active) { setLoading(false); } });
    }, SEARCH_DEBOUNCE_MS);
    return () => { active = false; clearTimeout(handle); };
  }, [value]);

  useEffect(() => { setHighlightedIndex(-1); }, [suggestions]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) { setIsOpen(false); }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const query = value.trim();
  const visibleSuggestions = suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
  const isQueryTooShort = query.length > 0 && query.length < MIN_QUERY_LENGTH;
  const showMenu = isOpen && (loading || isQueryTooShort || suggestions.length > 0);
  const listboxId = `${controlId}-listbox`;

  const selectSuggestion = (courseId) => {
    skipNextSearchRef.current = true;
    onChange(courseId);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!visibleSuggestions.length) { return; }
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((i) => Math.min(visibleSuggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      if (!visibleSuggestions.length) { return; }
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && visibleSuggestions[highlightedIndex]) {
        e.preventDefault();
        selectSuggestion(visibleSuggestions[highlightedIndex].course_id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Form.Group controlId={controlId}>
        <Form.Label>{label}</Form.Label>
        <Form.Control
          placeholder="course-v1:Org+Course+Run"
          value={value}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          isInvalid={isInvalid}
          autoComplete="off"
          role="combobox"
          aria-expanded={showMenu}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
          trailingElement={loading ? (
            <Spinner animation="border" size="sm" screenReaderText="Searching course runs" />
          ) : (
            <button
              type="button"
              className="btn btn-link p-0 text-muted"
              tabIndex={-1}
              aria-label={isOpen ? 'Hide suggestions' : 'Show suggestions'}
              onClick={() => setIsOpen((o) => !o)}
            >
              <Icon src={isOpen ? ExpandLess : ExpandMore} />
            </button>
          )}
        />
        {feedback && <Form.Control.Feedback type="invalid">{feedback}</Form.Control.Feedback>}
      </Form.Group>
      {showMenu && (
        <div
          id={listboxId}
          role="listbox"
          className="dropdown-menu show"
          style={{
            maxHeight: '14rem', overflowY: 'auto', width: '100%', zIndex: 1000,
          }}
        >
          {loading && <div className="dropdown-item-text text-muted small">Searching…</div>}
          {!loading && isQueryTooShort && (
            <div className="dropdown-item-text text-muted small">Keep typing to search…</div>
          )}
          {!loading && visibleSuggestions.map((course, index) => (
            <button
              key={course.course_id}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              type="button"
              className={`dropdown-item${index === highlightedIndex ? ' active' : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectSuggestion(course.course_id)}
            >
              {course.display_name}
              <span className="text-muted small d-block">{course.course_id}</span>
            </button>
          ))}
          {!loading && suggestions.length > MAX_VISIBLE_SUGGESTIONS && (
            <div className="dropdown-item-text text-muted small">
              {`+${suggestions.length - MAX_VISIBLE_SUGGESTIONS} more — keep typing to narrow`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

CourseIdField.propTypes = {
  controlId: PropTypes.string.isRequired,
  label: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isInvalid: PropTypes.bool,
  feedback: PropTypes.string,
};

CourseIdField.defaultProps = {
  label: 'Course run ID',
  isInvalid: false,
  feedback: '',
};

export default CourseIdField;
