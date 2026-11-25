import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  ModalDialog,
  Form,
  Button,
  Alert,
  ActionRow,
  Spinner,
} from '@openedx/paragon';
import { getOrganizations, getOrgAccess, setOrgAccess } from '../data/api';
import OrgMultiSelect from './OrgMultiSelect';

const OrgAccessModal = ({
  isOpen, user, onClose, onSaved,
}) => {
  const [loaded, setLoaded] = useState(null);
  const [available, setAvailable] = useState([]);
  const [orgAdmin, setOrgAdmin] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [visibility, setVisibility] = useState(false);
  const [chip, setChip] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const submission = useRef(0);
  const inFlight = useRef(false);
  const enabledOnce = useRef(false);

  const apply = (state) => {
    setLoaded(state);
    setOrgAdmin(state.org_admin);
    setOrgs(state.organizations || []);
    setVisibility(state.visibility);
    setChip(state.global_creator);
    setUnderstood(false);
    enabledOnce.current = !!(
      state.org_admin
      && !state.global_creator
      && state.organizations?.length
    );
  };
  const load = useCallback(async () => {
    const token = ++submission.current;
    setLoading(true);
    setLoadError(false);
    setError('');
    try {
      const [state, organizations] = await Promise.all([
        getOrgAccess(user.username),
        getOrganizations(),
      ]);
      if (submission.current !== token) {
        return;
      }
      apply(state);
      setAvailable(organizations.results);
    } catch (err) {
      if (submission.current === token) {
        setLoadError(true);
      }
    } finally {
      if (submission.current === token) {
        setLoading(false);
      }
    }
  }, [user]);
  useEffect(() => {
    if (isOpen && user) {
      load();
    }
    return () => {
      submission.current += 1;
    };
  }, [isOpen, user, load]);

  const close = () => {
    submission.current += 1;
    onClose();
  };
  const changeOrgs = (next) => {
    setOrgs(next);
    if (chip) {
      setChip(false);
    }
    if (next.length && !enabledOnce.current) {
      setVisibility(true);
      enabledOnce.current = true;
    }
  };
  const toggleAdmin = (checked) => {
    setOrgAdmin(checked);
    if (!checked) {
      setVisibility(false);
    }
    if (checked && orgs.length && !chip && !enabledOnce.current) {
      setVisibility(true);
      enabledOnce.current = true;
    }
  };
  const payload = {
    org_admin: orgAdmin,
    organizations: orgAdmin ? orgs : [],
    visibility: orgAdmin && !chip && orgs.length > 0 && visibility,
    confirm_downgrade: !!(loaded?.global_creator && (!chip || !orgAdmin)),
  };
  const initial = loaded && {
    org_admin: loaded.org_admin,
    organizations: loaded.org_admin ? loaded.organizations || [] : [],
    visibility: loaded.org_admin && loaded.visibility,
    confirm_downgrade: false,
  };
  const changed = initial
    && (payload.org_admin !== initial.org_admin
      || payload.visibility !== initial.visibility
      || payload.confirm_downgrade
      || ((loaded.partial_visibility_orgs || []).length > 0
        && !payload.visibility)
      || [...payload.organizations].sort().join('\u0000')
        !== [...initial.organizations].sort().join('\u0000'));
  const partial = loaded?.partial_visibility_orgs || [];
  const needsAcknowledgement = partial.length > 0 && !payload.visibility;
  const disabled = loading
    || saving
    || !loaded
    || !loaded.editable
    || !changed
    || (orgAdmin && (chip || !orgs.length))
    || (needsAcknowledgement && !understood);
  const save = async (event) => {
    event.preventDefault();
    if (disabled || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError('');
    setFieldErrors({});
    const token = submission.current;
    try {
      const state = await setOrgAccess(user.username, payload);
      if (submission.current !== token) {
        return;
      }
      apply(state);
      onSaved(user);
      close();
    } catch (err) {
      if (submission.current !== token) {
        return;
      }
      const body = err?.response?.data || {};
      setError(
        body.detail
          || 'Something went wrong. Nothing was changed. Please try again.',
      );
      setFieldErrors(body.field_errors || {});
      if (err?.response?.status >= 500) {
        try {
          const state = await getOrgAccess(user.username);
          if (submission.current === token) {
            apply(state);
          }
        } catch (reloadError) {
          /* Keep the error and the current form. */
        }
      }
    } finally {
      if (submission.current === token) {
        inFlight.current = false;
        setSaving(false);
      }
    }
  };
  useEffect(() => {
    if (isOpen) {
      inFlight.current = false;
      setSaving(false);
    }
  }, [isOpen, user]);
  const REASONS = {
    global_staff: 'Global staff already have access to every course.',
    disabled: 'This account is deactivated. Reactivate it before changing org access.',
  };
  const reason = REASONS[loaded?.not_editable_reason]
    || 'Activate this account before giving org access.';
  let visibilityHelp = 'Open and manage every course in these organizations, including future ones.';
  if (!orgAdmin || !orgs.length) {
    visibilityHelp = 'Turn on Org admin and choose an organization first.';
  }
  if (chip && orgAdmin) {
    visibilityHelp = 'Choose specific organizations first.';
  }
  return (
    <ModalDialog
      title={`Access for ${user?.name || user?.username || ''}`}
      isOpen={isOpen}
      onClose={close}
      hasCloseButton
    >
      <ModalDialog.Header>
        <ModalDialog.Title>
          Access for {user?.name || user?.username}
        </ModalDialog.Title>
        {user?.name && <p className="small text-muted mb-0">{user.username}</p>}
      </ModalDialog.Header>
      {loading ? (
        <ModalDialog.Body>
          <Spinner animation="border" screenReaderText="Loading access" />
        </ModalDialog.Body>
      ) : null}
      {!loading && loadError && (
        <ModalDialog.Body>
          <Alert variant="danger">
            Could not load this user&apos;s access. Please try again.
          </Alert>
          <Button onClick={load}>Retry</Button>
        </ModalDialog.Body>
      )}
      {!loading && !loadError && loaded && !loaded.editable && (
        <>
          <ModalDialog.Body>{reason}</ModalDialog.Body>
          <ModalDialog.Footer>
            <Button onClick={close}>Close</Button>
          </ModalDialog.Footer>
        </>
      )}
      {!loading && !loadError && loaded?.editable && (
        <Form onSubmit={save}>
          <ModalDialog.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            <section>
              <Form.Switch
                checked={orgAdmin}
                onChange={(e) => toggleAdmin(e.target.checked)}
                className="mb-1"
              >
                <span className="font-weight-bold">Org admin</span>
              </Form.Switch>
              <p className="small text-muted mb-0">
                Create course runs, re-runs and libraries.
              </p>
              {orgAdmin && (
                <div className="mt-3">
                  <p className="small font-weight-bold mb-1">Organizations</p>
                  {loaded.global_creator && (
                    <Form.Checkbox
                      checked={chip}
                      onChange={() => {
                        setChip(true);
                        setOrgs(loaded.organizations || []);
                        setVisibility(false);
                      }}
                    >
                      All organizations
                    </Form.Checkbox>
                  )}
                  <OrgMultiSelect
                    options={available}
                    value={chip ? [] : orgs}
                    onChange={changeOrgs}
                  />
                  {!chip && !orgs.length && (
                    <div className="text-danger small mt-1">
                      Choose at least one organization.
                    </div>
                  )}
                  {fieldErrors.organizations && (
                    <div className="text-danger small mt-1">
                      {[].concat(fieldErrors.organizations).join(' ')}
                    </div>
                  )}
                  {loaded.global_creator && !chip && (
                    <Alert variant="warning" className="mt-3 mb-0">
                      This user can create runs in every organization. Saving
                      limits them to: {orgs.join(', ')}.
                    </Alert>
                  )}
                </div>
              )}
              {loaded.global_creator && !orgAdmin && (
                <Alert variant="warning" className="mt-2 mb-0">
                  This user can create runs in every organization. Saving
                  removes that.
                </Alert>
              )}
            </section>

            <hr className="my-4" />

            <section className="mb-3">
              <Form.Switch
                checked={!!payload.visibility}
                disabled={!orgAdmin || chip || !orgs.length}
                onChange={(e) => setVisibility(e.target.checked)}
                className="mb-1"
              >
                <span className="font-weight-bold">Org visibility</span>
              </Form.Switch>
              <p className="small text-muted mb-0">{visibilityHelp}</p>
              {fieldErrors.visibility && (
                <div className="text-danger small mt-1">
                  {[].concat(fieldErrors.visibility).join(' ')}
                </div>
              )}
            </section>

            {partial.length > 0 && (
              <Alert variant="warning" className="mb-3">
                Org visibility is only partly set for: {partial.join(', ')}.
                Saving with it off removes it.
                {needsAcknowledgement && (
                  <div className="mt-2">
                    <Form.Checkbox
                      checked={understood}
                      onChange={(e) => setUnderstood(e.target.checked)}
                    >
                      I understand
                    </Form.Checkbox>
                  </div>
                )}
              </Alert>
            )}
            <p className="small text-muted mb-0">
              Saving replaces this user&apos;s current org access.
            </p>
          </ModalDialog.Body>
          <ModalDialog.Footer>
            <ActionRow>
              <Button variant="tertiary" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={disabled}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </ActionRow>
          </ModalDialog.Footer>
        </Form>
      )}
    </ModalDialog>
  );
};
OrgAccessModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  user: PropTypes.shape({ username: PropTypes.string, name: PropTypes.string }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
OrgAccessModal.defaultProps = { user: null };
export default OrgAccessModal;
