/**
 * DRF answers a bad request with field-keyed errors; anything else is a
 * generic failure. `fieldMap` maps the local field name a form uses to the
 * wire field name DRF returns (they can differ, e.g. `identifiers` vs
 * `identifier`), so a caller gets back errors keyed the way its inputs are.
 */
export const extractFieldErrors = (error, fieldMap) => {
  const body = error?.response?.data || {};
  const entries = Object.entries(fieldMap);
  const hasFieldErrors = entries.some(([, wireField]) => !!body[wireField]);
  const fieldErrors = hasFieldErrors
    ? Object.fromEntries(entries.map(([localField, wireField]) => [
      localField, [].concat(body[wireField] || []).join(' '),
    ]))
    : {};
  return { hasFieldErrors, fieldErrors };
};

export default extractFieldErrors;
