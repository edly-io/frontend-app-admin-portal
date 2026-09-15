import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Form } from '@openedx/paragon';

import { getCourseReports } from '../data/api';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Course run ID field with search-as-you-type suggestions from the reporting
 * course list. Stays a plain editable text input underneath — selecting a
 * suggestion just fills it, and a value with no matching suggestion still
 * submits as typed (some valid course runs may not be in the search index).
 */
const CourseIdField = ({
  controlId, label, value, onChange, isInvalid, feedback,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const query = value.trim();
    if (!query) { setSuggestions([]); return undefined; }
    let active = true;
    const handle = setTimeout(() => {
      getCourseReports({ search: query, page: 1 })
        .then((data) => { if (active) { setSuggestions(data.results || []); } })
        .catch(() => { if (active) { setSuggestions([]); } });
    }, SEARCH_DEBOUNCE_MS);
    return () => { active = false; clearTimeout(handle); };
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) { setIsOpen(false); }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectSuggestion = (courseId) => {
    onChange(courseId);
    setIsOpen(false);
  };

  const showMenu = isOpen && suggestions.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Form.Group controlId={controlId}>
        <Form.Label>{label}</Form.Label>
        <Form.Control
          placeholder="course-v1:Org+Course+Run"
          value={value}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          isInvalid={isInvalid}
          autoComplete="off"
        />
        {feedback && <Form.Control.Feedback type="invalid">{feedback}</Form.Control.Feedback>}
      </Form.Group>
      {showMenu && (
        <div
          className="dropdown-menu show"
          style={{
            maxHeight: '14rem', overflowY: 'auto', width: '100%', zIndex: 1000,
          }}
        >
          {suggestions.map((course) => (
            <button
              key={course.course_id}
              type="button"
              className="dropdown-item"
              onClick={() => selectSuggestion(course.course_id)}
            >
              {course.display_name}
              <span className="text-muted small d-block">{course.course_id}</span>
            </button>
          ))}
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
