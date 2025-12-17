/**
 * Custom SDK to replace base44 SDK
 * Uses different backend endpoint
 * Based on src/sdk/index.ts structure
 */

interface CustomClient {
  asServiceRole: {
    entities: any;
    integrations: any;
  };
}

/**
 * Get backend API URL from environment or use default
 */
function getBackendUrl(): string {
  return Deno.env.get('BACKEND_API_URL') || 'https://dev-bannermaker-api.leveragehero.net';
}

/**
 * Extract authorization token from request headers
 */
function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Ensure URL ends with /
 */
function ensureBase(url: string): string {
  return url.endsWith("/") ? url : url + "/";
}

/**
 * Create HTTP client similar to SDK original
 */
function createHttp(serverUrl: string, token: string | null) {
  const buildUrl = (path: string, query?: Record<string, any>) => {
    const u = new URL(path, ensureBase(serverUrl));
    if (query) {
      Object.entries(query).forEach(
        ([k, v]) => v != null && u.searchParams.append(k, String(v))
      );
    }
    return u.toString();
  };

  const request = async (
    path: string,
    init?: RequestInit & { query?: Record<string, any> }
  ) => {
    const url = buildUrl(path, init?.query);
    
    const headers: HeadersInit = {
      Accept: "application/json",
      ...(init?.headers || {}),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (response.status === 204) return undefined;

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const looksJson =
      contentType.includes("application/json") ||
      contentType.includes("application/problem+json");

    let data: any = text;
    if (looksJson) {
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        // Ignore parse errors
      }
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText || ""}`.trim()
      );
    }

    // Return data.data if exists, otherwise return data
    return looksJson ? (data.data ?? data) : text;
  };

  return { request };
}

/**
 * Create entities module - dynamic entities based on entity name
 * Similar to src/sdk/index.ts createEntities function
 */
function createEntities(http: ReturnType<typeof createHttp>) {
  return new Proxy(
    {},
    {
      get(_target, entityName: string) {
        const entity = String(entityName);
        return new Proxy(
          {},
          {
            get(_t2, methodName: string) {
              const method = String(methodName);
              return async (...args: any[]) => {
                switch (method) {
                  case "list":
                    return http.request(`${entity}`, {
                      method: "GET",
                      query: args[0],
                    });
                  case "filter": {
                    const p = args[0] ?? {};
                    return http.request(`${entity}`, {
                      method: "GET",
                      query: {
                        q: JSON.stringify(p.q ?? p ?? {}),
                        sort: p.sort,
                        limit: p.limit,
                        skip: p.skip,
                        fields: p.fields,
                      },
                    });
                  }
                  case "get":
                    return http.request(
                      `${entity}/${encodeURIComponent(args[0])}`,
                      { method: "GET" }
                    );
                  case "create":
                    return http.request(`${entity}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(args[0] ?? {}),
                    });
                  case "update":
                    return http.request(`${entity}/${encodeURIComponent(args[0])}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(args[1] ?? {}),
                    });
                  case "delete":
                    return http.request(
                      `${entity}/${encodeURIComponent(args[0])}`,
                      { method: "DELETE" }
                    );
                  default:
                    return http.request(`${entity}`, {
                      method: "GET",
                      query: args[0],
                    });
                }
              };
            },
          }
        );
      },
    }
  );
}

/**
 * Create integrations module - dynamic integrations
 * Similar to src/sdk/index.ts createIntegrations function
 */
function createIntegrations(http: ReturnType<typeof createHttp>) {
  return new Proxy(
    {},
    {
      get(_target, pkgName: string) {
        const pkg = String(pkgName);
        return new Proxy(
          {},
          {
            get(_t2, actionName: string) {
              const action = String(actionName);
              return async (data?: any) => {
                return http.request(`integrations/${pkg}/${action}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data ?? {}),
                });
              };
            },
          }
        );
      },
    }
  );
}

/**
 * Create custom client from request
 * Compatible with base44 SDK interface
 */
export function createClientFromRequest(req: Request): CustomClient {
  const backendUrl = Deno.env.get('VITE_API_URL');
  if (!backendUrl) {
    throw new Error('BACKEND_API_URL is not set');
  }
  const token = getAuthToken(req);
  const http = createHttp(backendUrl, token);
  
  return {
    asServiceRole: {
      entities: createEntities(http),
      integrations: createIntegrations(http),
    },
  };
}

