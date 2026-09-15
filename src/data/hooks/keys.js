/**
 * Every cache key in one place, so a mutation never has to guess the shape of
 * the list it invalidates.
 */
export const keys = {
  me: () => ['me'],
  users: {
    all: ['users'],
    list: (params) => ['users', 'list', params],
  },
  roles: () => ['roles'],
  reporting: {
    summary: () => ['reporting', 'summary'],
    trends: (months) => ['reporting', 'trends', months],
    breakdowns: () => ['reporting', 'breakdowns'],
    courses: (params) => ['reporting', 'courses', params],
  },
  courseReports: {
    downloads: (courseId) => ['course-reports', courseId, 'downloads'],
    certificates: (courseId) => ['course-reports', courseId, 'certificates'],
  },
};

export default keys;
