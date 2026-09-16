/**
 * The empty DRF pagination envelope. List hooks fall back to it before their
 * first page lands, so callers can read `count`/`results` unconditionally.
 */
export const EMPTY_PAGE = { count: 0, results: [] };

export default EMPTY_PAGE;
