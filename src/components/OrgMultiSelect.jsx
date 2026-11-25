import React, {
  useEffect, useId, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Chip, Form } from '@openedx/paragon';
import { Close } from '@openedx/paragon/icons';

/**
 * Searchable multi-select for organizations. Selected organizations show as
 * removable chips above a search box. Typing filters the list of organizations
 * that are not selected yet, and choosing one adds it. A long list stays one
 * scrollable box, so 20 or 200 organizations take the same space as two.
 */
const OrgMultiSelect = ({ options, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const listId = useId();

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return options.filter(
      (org) => !value.includes(org.short_name)
        && (!term || `${org.short_name} ${org.name}`.toLowerCase().includes(term)),
    );
  }, [options, value, query]);

  const add = (shortName) => {
    onChange([...value, shortName]);
    setQuery('');
    setOpen(false);
  };
  const remove = (shortName) => onChange(value.filter((name) => name !== shortName));
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && matches.length) {
        add(matches[0].short_name);
      }
    }
  };

  return (
    <div ref={wrapper} className="org-multiselect position-relative">
      {value.length > 0 && (
        <div className="d-flex flex-wrap mb-2" style={{ gap: '.5rem' }}>
          {value.map((shortName) => (
            <Chip
              key={shortName}
              iconAfter={Close}
              iconAfterAlt={`Remove ${shortName}`}
              onIconAfterClick={() => remove(shortName)}
            >
              {shortName}
            </Chip>
          ))}
        </div>
      )}
      <Form.Control
        type="text"
        role="combobox"
        aria-label="Search organizations"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        placeholder="Search organizations to add"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Organizations"
          className="org-multiselect-list bg-white border rounded shadow-sm"
        >
          {matches.length ? matches.map((org) => (
            <button
              key={org.short_name}
              type="button"
              role="option"
              aria-selected={false}
              className="org-multiselect-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(org.short_name)}
            >
              {org.short_name} ({org.name})
            </button>
          )) : (
            <div className="px-3 py-2 text-muted">
              {options.length === value.length
                ? 'All organizations are selected.'
                : 'No organizations match your search.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

OrgMultiSelect.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({
    short_name: PropTypes.string.isRequired,
    name: PropTypes.string,
  })).isRequired,
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default OrgMultiSelect;
