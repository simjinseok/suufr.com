// DAV XML Namespaces
export const NS = {
  DAV: 'DAV:',
  CALDAV: 'urn:ietf:params:xml:ns:caldav',
  CARDDAV: 'urn:ietf:params:xml:ns:carddav',
  CS: 'http://calendarserver.org/ns/',
} as const;

// DAV property names
export const DAV_PROPS = {
  // WebDAV
  RESOURCETYPE: 'resourcetype',
  DISPLAYNAME: 'displayname',
  GETCONTENTTYPE: 'getcontenttype',
  GETETAG: 'getetag',
  GETLASTMODIFIED: 'getlastmodified',
  CURRENT_USER_PRINCIPAL: 'current-user-principal',
  PRINCIPAL_URL: 'principal-URL',
  SUPPORTED_REPORT_SET: 'supported-report-set',

  // CalDAV
  CALENDAR_HOME_SET: 'calendar-home-set',
  CALENDAR_DATA: 'calendar-data',
  CALENDAR_DESCRIPTION: 'calendar-description',
  CALENDAR_TIMEZONE: 'calendar-timezone',
  SUPPORTED_CALENDAR_COMPONENT_SET: 'supported-calendar-component-set',

  // CardDAV
  ADDRESSBOOK_HOME_SET: 'addressbook-home-set',
  ADDRESS_DATA: 'address-data',
  ADDRESSBOOK_DESCRIPTION: 'addressbook-description',
  SUPPORTED_ADDRESS_DATA: 'supported-address-data',
} as const;

// Content types
export const CONTENT_TYPES = {
  XML: 'application/xml; charset=utf-8',
  CALENDAR: 'text/calendar; charset=utf-8',
  VCARD: 'text/vcard; charset=utf-8',
} as const;

// DAV capabilities
export const DAV_CAPABILITIES = {
  LEVEL_1: '1',
  LEVEL_2: '2',
  LEVEL_3: '3',
  CALENDAR_ACCESS: 'calendar-access',
  ADDRESSBOOK: 'addressbook',
} as const;
