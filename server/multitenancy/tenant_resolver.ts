import { KibanaRequest } from '../../../../src/core/server';
import { SecurityPluginConfigType } from '..';
import { SecuritySessionCookie } from '../session/security_cookie';

/**
 * Resovles the tenant the user is using.
 *
 * @param request Kibana request.
 * @param config security plugin config.
 * @param cookie cookie extracted from the request. The cookie should have been parsed by AuthenticationHandler.
 * pass it as parameter instead of extracting again.
 * @param authInfo authentication info, the Elasticsearch authinfo API response.
 *
 * @returns user preferred tenant of the request.
 */

export const PRIVATE_TENANT: string = '__user__';
export const GLOBAL_TENANT: string = '';

export function resolveTenant(
  request: KibanaRequest,
  username: string,
  availabeTenants: any,
  config: SecurityPluginConfigType,
  cookie: SecuritySessionCookie,
  authInfo: any
): string {
  let selectedTenant: string = undefined;
  if (request.query && ((request.query as any).security_tenant || (request.query as any).securitytenant)) {
    selectedTenant = (request.query as any).security_tenant
      ? (request.query as any).security_tenant
      : (request.query as any).securitytenant;
  } else if (request.headers.securitytenant || request.headers.security_tenant) {
    selectedTenant = request.headers.securitytenant
      ? (request.headers.securitytenant as string)
      : (request.headers.security_tenant as string);
  } else if (cookie.tentent) {
    selectedTenant = cookie.tentent;
  } else {
    selectedTenant = undefined;
  }

  const preferredTenants = config.multitenancy.tenants.preferred;
  const globalTenantEnabled = config.multitenancy.tenants.enable_global;
  const privateTenantEnabled = config.multitenancy.tenants.enable_private;

  return resolve(username, selectedTenant, preferredTenants, availabeTenants, globalTenantEnabled, privateTenantEnabled);
}

/**
 * Determines whether the request requires tenant info.
 * @param request kibana request.
 *
 * @returns true if the request requires tenant info, otherwise false.
 */
export function isMultitenantPath(request: KibanaRequest): boolean {
  return (
    request.url.path.startsWith('/elasticsearch') ||
    request.url.path.startsWith('/api') ||
    request.url.path.startsWith('/app') ||
    request.url.path === '/'
  );
}

function resolve(
  username: string,
  requestedTenant: string,
  preferredTenants: string[],
  availableTenants: any, // is an object like { tenant_name_1: true, tenant_name_2: false, ... }
  globalTenantEnabled: boolean,
  privateTenantEnabled: boolean
): string {
  let availableTenantsClone = _.cloneDeep(availableTenants);
  delete availableTenantsClone[username];

  if (!globalTenantEnabled && !privateTenantEnabled && _.isEmpty(availableTenantsClone)) {
    return undefined;
  }

  if (requestedTenant) {
    if (availableTenants[requestedTenant]) {
      return requestedTenant;
    }

    if (privateTenantEnabled && availableTenants[username] && requestedTenant === PRIVATE_TENANT /* || requestedTenant === 'private'*/) {
      return PRIVATE_TENANT;
    }

    if (globalTenantEnabled && requestedTenant === GLOBAL_TENANT /*|| requestedTenant === 'global'*/) {
      return GLOBAL_TENANT;
    }
  }

  if (preferredTenants && !_.isEmpty(preferredTenants)) {
    for (let element of preferredTenants) {
      const tenant = element.toLowerCase();

      if (tenant === GLOBAL_TENANT && globalTenantEnabled) {
        return GLOBAL_TENANT;
      }

      if (tenant === PRIVATE_TENANT && privateTenantEnabled && availableTenants[username]) {
        return PRIVATE_TENANT;
      }

      if (availableTenants[tenant]) {
        return tenant;
      }
    }
  }

  if (globalTenantEnabled) {
    return GLOBAL_TENANT;
  }

  if (privateTenantEnabled) {
    return PRIVATE_TENANT;
  }

  // fall back to the first tenant in the available tenants
  return _.findKey(availableTenantsClone, (value: boolean) => value);
}
